const router = require('express').Router();
const { Preference, Payment } = require('mercadopago');
const mpClient = require('../config/mercadopago');
const db = require('../config/db');
const { crearLimitador } = require('../middleware/rateLimit');

// Mismo criterio que la creación de pedidos: sin límite, alguien podría
// generar preferencias de pago en bucle contra la cuenta de MercadoPago.
const limitarCreacionPreferencia = crearLimitador({
    ventanaMs: 10 * 60 * 1000,
    maxSolicitudes: 10,
    mensaje: 'Demasiadas solicitudes de pago. Intenta de nuevo en unos minutos.'
});

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEDA = process.env.MERCADOPAGO_CURRENCY || 'COP';

// POST /api/pagos/preferencia/:token
// Pública: la llama el checkout justo después de crear el pedido (que ya le
// entregó el token) para obtener el link de pago de MercadoPago.
router.post('/preferencia/:token', limitarCreacionPreferencia, async (req, res) => {
    const { token } = req.params;
    if (!REGEX_UUID.test(token)) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
        return res.status(503).json({ error: 'El pago con MercadoPago todavía no está configurado en el servidor.' });
    }

    try {
        const [[pedido]] = await db.query('SELECT * FROM pedidos WHERE token=?', [token]);
        if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
        if (pedido.estado !== 'pendiente') {
            return res.status(409).json({ error: 'Este pedido ya fue procesado.' });
        }

        const [items] = await db.query(`
            SELECT dp.cantidad, dp.precio_unitario, p.nombre
            FROM detalle_pedidos dp
            JOIN productos p ON dp.id_producto = p.id
            WHERE dp.id_pedido = ?
        `, [pedido.id]);

        // URL_TIENDA es distinta de FRONTEND_URL (que solo restringe CORS y
        // se deja vacía en desarrollo): esta la necesita MercadoPago para
        // redirigir de vuelta al comprador, así que siempre tiene un valor,
        // por defecto la tienda corriendo localmente.
        const urlTienda = process.env.URL_TIENDA || 'http://localhost:8080';
        const urlConfirmacion = `${urlTienda}/confirmacion.html?token=${token}`;

        const preference = new Preference(mpClient);
        const resultado = await preference.create({
            body: {
                items: items.map(item => ({
                    title: item.nombre,
                    quantity: item.cantidad,
                    unit_price: Number(item.precio_unitario),
                    currency_id: MONEDA
                })),
                external_reference: token,
                back_urls: {
                    success: urlConfirmacion,
                    pending: urlConfirmacion,
                    failure: urlConfirmacion
                },
                // Con credenciales de prueba, MercadoPago genera solo
                // sandbox_init_point; con las de producción, solo init_point.
                ...(process.env.BACKEND_URL ? { notification_url: `${process.env.BACKEND_URL}/api/pagos/webhook` } : {})
            }
        });

        await db.query('UPDATE pedidos SET mp_preference_id=? WHERE id=?', [resultado.id, pedido.id]);

        res.json({ checkout_url: resultado.sandbox_init_point || resultado.init_point });
    } catch (err) {
        console.error('Error creando preferencia de MercadoPago:', err);
        res.status(500).json({ error: 'No se pudo iniciar el pago. Intenta de nuevo.' });
    }
});

// Consulta el pago directamente contra la API de MercadoPago (nunca se
// confía en el estado que venga por query string o body: cualquiera podría
// mandar status=approved a mano) y, si corresponde, actualiza el pedido.
// Idempotente: si ya se había procesado este payment_id, no hace nada.
async function confirmarPago(paymentId) {
    const payment = new Payment(mpClient);
    const info = await payment.get({ id: paymentId });

    const token = info.external_reference;
    if (!token || !REGEX_UUID.test(token)) return null;

    const [[pedido]] = await db.query('SELECT * FROM pedidos WHERE token=?', [token]);
    if (!pedido) return null;
    if (pedido.mp_payment_id === String(paymentId)) return pedido.estado; // ya procesado

    const ESTADO_POR_STATUS = {
        approved: 'confirmado',
        rejected: 'cancelado',
        cancelled: 'cancelado'
        // 'pending' e 'in_process' dejan el pedido como está (pendiente).
    };
    const nuevoEstado = ESTADO_POR_STATUS[info.status];

    if (nuevoEstado) {
        await db.query('UPDATE pedidos SET estado=?, mp_payment_id=? WHERE id=?', [nuevoEstado, String(paymentId), pedido.id]);
        return nuevoEstado;
    }
    return pedido.estado;
}

// GET /api/pagos/confirmar?token=&payment_id=
// Pública: la llama la página de confirmación cuando MercadoPago redirige de
// vuelta al comprador (back_urls) con el payment_id en la URL. Sirve para
// reflejar el pago al instante sin depender de que el webhook llegue
// (en desarrollo local, MercadoPago no puede alcanzar localhost).
router.get('/confirmar', async (req, res) => {
    const { token, payment_id } = req.query;
    if (!token || !REGEX_UUID.test(token) || !payment_id) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
    }
    try {
        const [[pedido]] = await db.query('SELECT id FROM pedidos WHERE token=?', [token]);
        if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

        const estado = await confirmarPago(payment_id);
        res.json({ estado });
    } catch (err) {
        console.error('Error confirmando pago:', err);
        res.status(500).json({ error: 'No se pudo confirmar el pago' });
    }
});

// POST /api/pagos/webhook
// Pública (la llama MercadoPago, no el navegador del cliente). Solo funciona
// si BACKEND_URL es una URL pública real; en localhost no hay forma de que
// MercadoPago la alcance, por eso existe también /confirmar.
router.post('/webhook', async (req, res) => {
    try {
        const tipo = req.query.type || req.body?.type || req.query.topic;
        const paymentId = req.query['data.id'] || req.body?.data?.id || req.query.id;

        if (tipo === 'payment' && paymentId) {
            await confirmarPago(paymentId);
        }
        res.sendStatus(200); // MercadoPago reintenta si no responde 200/201
    } catch (err) {
        console.error('Error procesando webhook de MercadoPago:', err);
        res.sendStatus(200); // igual se responde 200 para que no siga reintentando algo que va a seguir fallando
    }
});

module.exports = router;
