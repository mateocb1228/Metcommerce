const contenido = document.getElementById('contenido-confirmacion');
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cargarPedido() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    // MercadoPago agrega payment_id (y status) a la URL al redirigir de
    // vuelta desde el checkout. Se usa para confirmar el pago contra la API
    // de MercadoPago antes de mostrar el pedido, porque en desarrollo local
    // el webhook no puede alcanzar este servidor.
    const paymentId = params.get('payment_id') || params.get('collection_id');

    if (!token || !REGEX_UUID.test(token)) {
        renderizarError('No encontramos ese pedido.');
        return;
    }

    if (paymentId) {
        try {
            await fetch(`${API}/pagos/confirmar?token=${encodeURIComponent(token)}&payment_id=${encodeURIComponent(paymentId)}`);
        } catch { /* si falla, igual se muestra el pedido con su estado actual */ }
    }

    try {
        const res = await fetch(`${API}/pedidos/token/${encodeURIComponent(token)}`);

        if (res.status === 404) {
            renderizarError('No encontramos ese pedido. Puede que el enlace sea incorrecto.');
            return;
        }
        if (!res.ok) {
            renderizarError('Ocurrió un error al cargar tu pedido. Intenta más tarde.');
            return;
        }

        const pedido = await res.json();
        renderizarPedido(pedido);
    } catch {
        renderizarError('No se pudo conectar con el servidor para confirmar tu pedido. Verifica tu conexión.');
    }
}

function renderizarError(mensaje) {
    contenido.innerHTML = `
        <div class="confirmacion-card">
            <div class="confirmacion-icono">⚠️</div>
            <h1>Ups...</h1>
            <p class="confirmacion-numero">${escapeHtml(mensaje)}</p>
            <a href="index.html" class="btn-volver-tienda">Volver a la tienda</a>
        </div>
    `;
}

const ESTADO_PAGO_UI = {
    confirmado: { icono: '✅', titulo: '¡Pago aprobado!' },
    pendiente:  { icono: '⏳', titulo: 'Pago pendiente', mensaje: 'Todavía no se confirmó el pago. Si pagaste, puede tardar unos minutos en reflejarse.' },
    cancelado:  { icono: '❌', titulo: 'El pago no se pudo procesar', mensaje: 'El pedido quedó registrado pero el pago fue rechazado o cancelado.' },
    enviado:    { icono: '✅', titulo: '¡Pedido confirmado!' },
    entregado:  { icono: '✅', titulo: '¡Pedido confirmado!' }
};

function renderizarPedido(pedido) {
    const ui = ESTADO_PAGO_UI[pedido.estado] || ESTADO_PAGO_UI.pendiente;
    contenido.innerHTML = `
        <div class="confirmacion-card">
            <div class="confirmacion-icono">${ui.icono}</div>
            <h1>${ui.titulo}</h1>
            ${ui.mensaje ? `<p class="confirmacion-numero">${escapeHtml(ui.mensaje)}</p>` : ''}
            <p class="confirmacion-numero">Número de pedido <strong>#${pedido.id}</strong> — ${escapeHtml(formatoFecha(pedido.fecha_creacion))}</p>

            <div class="detalle-pedido">
                <h3>Entregar a</h3>
                <div class="detalle-fila"><span>${escapeHtml(pedido.cliente_nombre)}</span><span>${escapeHtml(pedido.cliente_telefono || '')}</span></div>
                <div class="detalle-fila"><span>${escapeHtml(pedido.cliente_direccion || 'Sin dirección registrada')}</span><span></span></div>
            </div>

            <div class="detalle-pedido">
                <h3>Productos</h3>
                ${pedido.items.map(item => {
                    const variante = [item.color, item.talla ? `Talla ${item.talla}` : null].filter(Boolean).join(' · ');
                    return `
                    <div class="detalle-fila">
                        <span>
                            ${escapeHtml(item.nombre)} × ${item.cantidad}
                            ${variante ? `<span class="variante">${escapeHtml(variante)}</span>` : ''}
                        </span>
                        <span>${formatoMoneda(item.precio_unitario * item.cantidad)}</span>
                    </div>
                `;
                }).join('')}
                <div class="resumen-total" style="margin-top: 10px;">
                    <span>Total</span>
                    <span>${formatoMoneda(pedido.total)}</span>
                </div>
            </div>

            <a href="index.html" class="btn-volver-tienda">Volver a la tienda</a>
        </div>
    `;
}

cargarPedido();
