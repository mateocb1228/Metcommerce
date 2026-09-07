const contenido = document.getElementById('contenido-confirmacion');

async function cargarPedido() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id || !/^\d+$/.test(id)) {
        renderizarError('No encontramos ese pedido.');
        return;
    }

    try {
        const res = await fetch(`${API}/pedidos/${id}`);

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

function renderizarPedido(pedido) {
    contenido.innerHTML = `
        <div class="confirmacion-card">
            <div class="confirmacion-icono">✅</div>
            <h1>¡Pedido confirmado!</h1>
            <p class="confirmacion-numero">Número de pedido <strong>#${pedido.id}</strong> — ${escapeHtml(formatoFecha(pedido.fecha_creacion))}</p>

            <div class="detalle-pedido">
                <h3>Entregar a</h3>
                <div class="detalle-fila"><span>${escapeHtml(pedido.cliente_nombre)}</span><span>${escapeHtml(pedido.cliente_telefono || '')}</span></div>
                <div class="detalle-fila"><span>${escapeHtml(pedido.cliente_direccion || 'Sin dirección registrada')}</span><span></span></div>
            </div>

            <div class="detalle-pedido">
                <h3>Productos</h3>
                ${pedido.items.map(item => `
                    <div class="detalle-fila">
                        <span>${escapeHtml(item.nombre)} × ${item.cantidad}</span>
                        <span>${formatoMoneda(item.precio_unitario * item.cantidad)}</span>
                    </div>
                `).join('')}
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
