requerirSesion();

const usuario = obtenerUsuario();
if (usuario) {
    document.getElementById('nombre-usuario').textContent = usuario.nombre_completo || usuario.usuario;
}
document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

const tablaPedidos = document.getElementById('tabla-pedidos-lista');
const formFiltros  = document.getElementById('form-filtros');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitulo  = document.getElementById('modal-titulo');
const modalContenido = document.getElementById('modal-contenido');

// ===== CARGAR LISTA (con filtros) =====
async function cargarPedidos() {
    tablaPedidos.innerHTML = '<p class="msg-cargando">Cargando pedidos...</p>';

    const params = new URLSearchParams();
    const estado = document.getElementById('filtro-estado').value;
    const desde  = document.getElementById('filtro-desde').value;
    const hasta  = document.getElementById('filtro-hasta').value;
    const q      = document.getElementById('filtro-busqueda').value.trim();

    if (estado) params.set('estado', estado);
    if (desde)  params.set('desde', desde);
    if (hasta)  params.set('hasta', hasta);
    if (q)      params.set('q', q);

    try {
        const pedidos = await apiFetch(`/pedidos${params.toString() ? `?${params}` : ''}`);
        renderizarTabla(pedidos);
    } catch (err) {
        tablaPedidos.innerHTML = `<p class="msg-vacio">No se pudo cargar la lista de pedidos: ${err.message}</p>`;
    }
}

function renderizarTabla(pedidos) {
    if (!pedidos.length) {
        tablaPedidos.innerHTML = '<p class="msg-vacio">No hay pedidos que coincidan con los filtros.</p>';
        return;
    }

    tablaPedidos.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Productos</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${pedidos.map(p => `
                    <tr>
                        <td>#${p.id}</td>
                        <td>${escapeHtml(p.cliente_nombre)}</td>
                        <td>${escapeHtml(p.cliente_telefono || '—')}</td>
                        <td>${p.total_items ?? '—'}</td>
                        <td>${formatoMoneda(p.total)}</td>
                        <td><span class="badge badge-estado-${p.estado}">${etiquetaEstadoPedido(p.estado)}</span></td>
                        <td>${formatoFecha(p.fecha_creacion)}</td>
                        <td><button class="btn-accion btn-editar" data-id="${p.id}">Ver detalle</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    tablaPedidos.querySelectorAll('.btn-editar').forEach(btn =>
        btn.addEventListener('click', () => abrirDetalle(btn.dataset.id))
    );
}

// ===== FILTROS =====
formFiltros.addEventListener('submit', (e) => {
    e.preventDefault();
    cargarPedidos();
});

document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
    formFiltros.reset();
    cargarPedidos();
});

// ===== MODAL DE DETALLE =====
async function abrirDetalle(id) {
    modalTitulo.textContent = `Pedido #${id}`;
    modalContenido.innerHTML = '<p class="msg-cargando">Cargando detalle...</p>';
    modalOverlay.hidden = false;

    try {
        const pedido = await apiFetch(`/pedidos/${id}`);
        renderizarDetalle(pedido);
    } catch (err) {
        modalContenido.innerHTML = `<p class="msg-vacio">No se pudo cargar el pedido: ${err.message}</p>`;
    }
}

function renderizarDetalle(pedido) {
    const subtotal = (item) => item.precio_unitario * item.cantidad;

    modalContenido.innerHTML = `
        <div class="pedido-meta">
            <div><span class="pedido-meta-etiqueta">Número</span><strong>#${pedido.id}</strong></div>
            <div><span class="pedido-meta-etiqueta">Fecha</span><strong>${formatoFecha(pedido.fecha_creacion)}</strong></div>
            <div><span class="pedido-meta-etiqueta">Estado</span><span class="badge badge-estado-${pedido.estado}">${etiquetaEstadoPedido(pedido.estado)}</span></div>
        </div>

        <div class="pedido-cliente-card">
            <h3>Datos del cliente</h3>
            <div class="pedido-cliente-fila"><span>Nombre</span><strong>${escapeHtml(pedido.cliente_nombre)}</strong></div>
            <div class="pedido-cliente-fila"><span>Teléfono</span><strong>${escapeHtml(pedido.cliente_telefono || '—')}</strong></div>
            <div class="pedido-cliente-fila"><span>Dirección</span><strong>${escapeHtml(pedido.cliente_direccion || '—')}</strong></div>
        </div>

        <h3 class="pedido-seccion-titulo">Productos</h3>
        <div class="tabla-scroll">
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Talla</th>
                        <th>Color</th>
                        <th>Cant.</th>
                        <th>Precio unit.</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${pedido.items.map(item => `
                        <tr>
                            <td>${escapeHtml(item.nombre)}</td>
                            <td>${item.talla ?? '—'}</td>
                            <td>${escapeHtml(item.color || '—')}</td>
                            <td>${item.cantidad}</td>
                            <td>${formatoMoneda(item.precio_unitario)}</td>
                            <td>${formatoMoneda(subtotal(item))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="pedido-total-fila">
            <span>Total del pedido</span>
            <strong>${formatoMoneda(pedido.total)}</strong>
        </div>

        <div class="pedido-cambio-estado">
            <h3 class="pedido-seccion-titulo">Cambiar estado</h3>
            <div class="pedido-cambio-estado-controles">
                <select id="select-nuevo-estado">
                    ${ESTADOS_PEDIDO.map(e => `<option value="${e.valor}" ${e.valor === pedido.estado ? 'selected' : ''}>${e.etiqueta}</option>`).join('')}
                </select>
                <button class="btn btn-guardar" id="btn-actualizar-estado" data-id="${pedido.id}">Actualizar estado</button>
            </div>
        </div>
    `;

    document.getElementById('btn-actualizar-estado').addEventListener('click', actualizarEstado);
}

async function actualizarEstado(e) {
    const id = e.target.dataset.id;
    const select = document.getElementById('select-nuevo-estado');
    const nuevoEstado = select.value;
    const etiqueta = etiquetaEstadoPedido(nuevoEstado);

    if (!confirm(`¿Cambiar el estado del pedido #${id} a "${etiqueta}"?`)) return;

    const boton = e.target;
    boton.disabled = true;
    boton.textContent = 'Actualizando...';

    try {
        await apiFetch(`/pedidos/${id}/estado`, {
            method: 'PUT',
            body: JSON.stringify({ estado: nuevoEstado })
        });
        mostrarToast('Estado del pedido actualizado');
        await abrirDetalle(id);
        cargarPedidos();
    } catch (err) {
        mostrarToast(err.message, true);
        boton.disabled = false;
        boton.textContent = 'Actualizar estado';
    }
}

function cerrarModal() {
    modalOverlay.hidden = true;
}

document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) cerrarModal(); });

cargarPedidos();
