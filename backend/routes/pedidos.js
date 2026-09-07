const router = require('express').Router();
const db     = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const MAX_ITEMS = 50;
const MAX_CANTIDAD_POR_ITEM = 50;
const REGEX_TELEFONO = /^[0-9+()\-\s]{7,20}$/;

// Valida el cuerpo de un pedido antes de tocar la base de datos.
// Se valida también en el servidor (no solo en el frontend) porque el
// endpoint es público: cualquiera puede llamarlo directamente con datos
// manipulados (p. ej. cantidades negativas, que si no se rechazan aquí
// terminarían restando un número negativo del inventario y AUMENTÁNDOLO).
function validarPedido({ cliente_nombre, cliente_telefono, cliente_direccion, items }) {
    const errores = [];

    if (typeof cliente_nombre !== 'string' || cliente_nombre.trim().length < 3 || cliente_nombre.trim().length > 150) {
        errores.push('El nombre debe tener entre 3 y 150 caracteres.');
    }
    if (typeof cliente_telefono !== 'string' || !REGEX_TELEFONO.test(cliente_telefono.trim())) {
        errores.push('El teléfono no es válido.');
    }
    if (typeof cliente_direccion !== 'string' || cliente_direccion.trim().length < 5 || cliente_direccion.trim().length > 255) {
        errores.push('La dirección debe tener entre 5 y 255 caracteres.');
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
        errores.push(`El pedido debe tener entre 1 y ${MAX_ITEMS} productos.`);
    } else {
        const itemsValidos = items.every(item => {
            const idValido = Number.isInteger(item?.id_producto) && item.id_producto > 0;
            const cantidadValida = Number.isInteger(item?.cantidad) && item.cantidad > 0 && item.cantidad <= MAX_CANTIDAD_POR_ITEM;
            const tallaValida = item?.talla === undefined || item.talla === null ||
                (Number.isInteger(item.talla) && item.talla >= 30 && item.talla <= 50);
            const colorValido = item?.color === undefined || item.color === null ||
                (typeof item.color === 'string' && item.color.length <= 50);
            return idValido && cantidadValida && tallaValida && colorValido;
        });
        if (!itemsValidos) {
            errores.push('Hay productos con datos inválidos en el pedido.');
        }
    }

    return errores;
}

// GET /api/pedidos
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM pedidos ORDER BY fecha_creacion DESC'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pedidos/:id  (con items)
router.get('/:id', async (req, res) => {
    try {
        const [[pedido]] = await db.query('SELECT * FROM pedidos WHERE id=?', [req.params.id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

        const [items] = await db.query(`
            SELECT dp.*, p.nombre, p.imagen_url
            FROM detalle_pedidos dp
            JOIN productos p ON dp.id_producto = p.id
            WHERE dp.id_pedido = ?
        `, [req.params.id]);

        res.json({ ...pedido, items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pedidos
// Body: { cliente_nombre, cliente_telefono, cliente_direccion, items: [{ id_producto, cantidad }] }
router.post('/', async (req, res) => {
    const { cliente_nombre, cliente_telefono, cliente_direccion, items } = req.body;

    const errores = validarPedido({ cliente_nombre, cliente_telefono, cliente_direccion, items });
    if (errores.length) {
        return res.status(400).json({ error: errores[0], errores });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        let total = 0;
        const itemsDetalle = [];

        // SELECT ... FOR UPDATE bloquea la fila de stock hasta el commit, para
        // que dos compras simultáneas del mismo producto/talla no lean el mismo
        // stock disponible y ambas lo den por válido (condición de carrera).
        for (const item of items) {
            const [[producto]] = await conn.query(
                'SELECT nombre, precio FROM productos WHERE id=? AND activo=1', [item.id_producto]
            );
            if (!producto) throw new Error('Uno de los productos del pedido ya no está disponible.');

            const [tallasProducto] = await conn.query(
                'SELECT talla FROM producto_tallas WHERE id_producto=?', [item.id_producto]
            );

            if (tallasProducto.length) {
                // Este producto maneja tallas: el stock real vive en producto_tallas,
                // así que la talla es obligatoria y se descuenta esa fila puntual
                // (comprar talla 40 no puede afectar la disponibilidad de la talla 42).
                if (!Number.isInteger(item.talla)) {
                    throw new Error(`Debes indicar una talla para "${producto.nombre}".`);
                }
                const [[fila]] = await conn.query(
                    'SELECT stock FROM producto_tallas WHERE id_producto=? AND talla=? FOR UPDATE',
                    [item.id_producto, item.talla]
                );
                if (!fila || fila.stock < item.cantidad) {
                    throw new Error(`Stock insuficiente para "${producto.nombre}" talla ${item.talla}. Disponible: ${fila ? fila.stock : 0}.`);
                }
                await conn.query(
                    'UPDATE producto_tallas SET stock = stock - ? WHERE id_producto=? AND talla=?',
                    [item.cantidad, item.id_producto, item.talla]
                );
            } else {
                const [[inv]] = await conn.query(
                    'SELECT cantidad FROM inventario WHERE id_producto=? FOR UPDATE', [item.id_producto]
                );
                if (!inv || inv.cantidad < item.cantidad) {
                    throw new Error(`Stock insuficiente para "${producto.nombre}". Disponible: ${inv ? inv.cantidad : 0}.`);
                }
            }

            total += producto.precio * item.cantidad;
            itemsDetalle.push({ ...item, precio_unitario: producto.precio });
        }

        const [pedidoResult] = await conn.query(
            'INSERT INTO pedidos (cliente_nombre, cliente_telefono, cliente_direccion, total) VALUES (?, ?, ?, ?)',
            [cliente_nombre.trim(), cliente_telefono.trim(), cliente_direccion.trim(), total]
        );
        const id_pedido = pedidoResult.insertId;

        for (const item of itemsDetalle) {
            await conn.query(
                'INSERT INTO detalle_pedidos (id_pedido, id_producto, talla, color, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?, ?)',
                [id_pedido, item.id_producto, item.talla ?? null, item.color ?? null, item.cantidad, item.precio_unitario]
            );
            await conn.query(
                'UPDATE inventario SET cantidad = cantidad - ? WHERE id_producto=?',
                [item.cantidad, item.id_producto]
            );
        }

        await conn.commit();
        res.status(201).json({ id: id_pedido, total, mensaje: 'Pedido creado' });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// PUT /api/pedidos/:id/estado
router.put('/:id/estado', requireAuth, async (req, res) => {
    const { estado } = req.body;
    const validos = ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado'];
    if (!validos.includes(estado)) {
        return res.status(400).json({ error: `Estado inválido. Opciones: ${validos.join(', ')}` });
    }
    try {
        const [result] = await db.query(
            'UPDATE pedidos SET estado=? WHERE id=?', [estado, req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Pedido no encontrado' });
        res.json({ mensaje: 'Estado actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
