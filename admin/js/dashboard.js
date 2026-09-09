requerirSesion();

const usuario = obtenerUsuario();
if (usuario) {
    document.getElementById('nombre-usuario').textContent = usuario.nombre_completo || usuario.usuario;
}

document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

async function cargarResumen() {
    const statsGrid   = document.getElementById('stats-grid');
    const tablaPedidos = document.getElementById('tabla-pedidos');
    const tablaStock   = document.getElementById('tabla-stock');

    try {
        const r = await apiFetch('/dashboard/resumen');

        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="valor">${formatoMoneda(r.ventas_totales)}</div>
                <div class="etiqueta">Ventas totales</div>
            </div>
            <div class="stat-card">
                <div class="valor">${r.total_pedidos}</div>
                <div class="etiqueta">Pedidos totales</div>
            </div>
            <div class="stat-card ${r.pedidos_pendientes > 0 ? 'alerta' : 'ok'}">
                <div class="valor">${r.pedidos_pendientes}</div>
                <div class="etiqueta">Pedidos pendientes</div>
            </div>
            <div class="stat-card">
                <div class="valor">${r.total_productos}</div>
                <div class="etiqueta">Productos activos</div>
            </div>
            <div class="stat-card ${r.productos_stock_bajo > 0 ? 'alerta' : 'ok'}">
                <div class="valor">${r.productos_stock_bajo}</div>
                <div class="etiqueta">Productos con stock bajo</div>
            </div>
        `;

        tablaPedidos.innerHTML = r.ultimos_pedidos.length
            ? `<table>
                <thead><tr><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
                <tbody>
                    ${r.ultimos_pedidos.map(p => `
                        <tr>
                            <td>${escapeHtml(p.cliente_nombre)}</td>
                            <td>${formatoMoneda(p.total)}</td>
                            <td><span class="badge badge-estado-${p.estado}">${etiquetaEstadoPedido(p.estado)}</span></td>
                            <td>${formatoFecha(p.fecha_creacion)}</td>
                        </tr>
                    `).join('')}
                </tbody>
               </table>`
            : '<p class="msg-vacio">Todavía no hay pedidos.</p>';

        tablaStock.innerHTML = r.alertas_stock.length
            ? `<table>
                <thead><tr><th>Producto</th><th>Stock</th><th>Mínimo</th></tr></thead>
                <tbody>
                    ${r.alertas_stock.map(p => `
                        <tr>
                            <td>${p.nombre}</td>
                            <td><span class="badge ${p.cantidad === 0 ? 'badge-agotado' : 'badge-bajo'}">${p.cantidad}</span></td>
                            <td>${p.stock_minimo}</td>
                        </tr>
                    `).join('')}
                </tbody>
               </table>`
            : '<p class="msg-vacio">Sin alertas de stock. ✅</p>';

    } catch (err) {
        statsGrid.innerHTML = `<p class="msg-vacio">No se pudo cargar el resumen: ${err.message}</p>`;
    }
}

cargarResumen();
