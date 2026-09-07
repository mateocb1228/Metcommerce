requerirSesion();

const usuario = obtenerUsuario();
if (usuario) {
    document.getElementById('nombre-usuario').textContent = usuario.nombre_completo || usuario.usuario;
}
document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

const tablaProductos = document.getElementById('tabla-productos');
const modalOverlay   = document.getElementById('modal-overlay');
const modalTitulo    = document.getElementById('modal-titulo');
const formProducto   = document.getElementById('form-producto');
const btnGuardar     = document.getElementById('btn-guardar-producto');
const selectCategoria = document.getElementById('categoria');

let productosCache = [];

// ===== CARGAR CATEGORÍAS PARA EL SELECT =====
async function cargarCategorias() {
    try {
        const categorias = await apiFetch('/categorias');
        categorias.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            selectCategoria.appendChild(opt);
        });
    } catch (err) {
        console.error('No se pudieron cargar las categorías:', err);
    }
}

// ===== CARGAR PRODUCTOS =====
async function cargarProductos() {
    tablaProductos.innerHTML = '<p class="msg-cargando">Cargando productos...</p>';
    try {
        productosCache = await apiFetch('/productos');
        renderizarTabla();
    } catch (err) {
        tablaProductos.innerHTML = `<p class="msg-vacio">No se pudo conectar al servidor. Verifica que el backend esté corriendo en localhost:3000.</p>`;
    }
}

function renderizarTabla() {
    if (!productosCache.length) {
        tablaProductos.innerHTML = '<p class="msg-vacio">No hay productos registrados.</p>';
        return;
    }

    tablaProductos.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${productosCache.map(p => {
                    const stock = p.stock ?? 0;
                    const badge = stock === 0 ? 'badge-agotado' : (stock <= 5 ? 'badge-bajo' : 'badge-ok');
                    return `
                        <tr>
                            <td><img class="img-mini" src="${p.imagen_url || ''}" alt=""></td>
                            <td>${p.nombre}</td>
                            <td>${p.categoria || '—'}</td>
                            <td>${formatoMoneda(p.precio)}</td>
                            <td><span class="badge ${badge}">${stock}</span></td>
                            <td>
                                <button class="btn-accion btn-editar" data-id="${p.id}">Editar</button>
                                <button class="btn-accion btn-eliminar" data-id="${p.id}">Eliminar</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    tablaProductos.querySelectorAll('.btn-editar').forEach(btn =>
        btn.addEventListener('click', () => abrirModalEditar(btn.dataset.id))
    );
    tablaProductos.querySelectorAll('.btn-eliminar').forEach(btn =>
        btn.addEventListener('click', () => eliminarProducto(btn.dataset.id))
    );
}

// ===== MODAL =====
function abrirModalNuevo() {
    formProducto.reset();
    document.getElementById('producto-id').value = '';
    document.getElementById('stock_minimo').value = 5;
    modalTitulo.textContent = 'Agregar producto';
    modalOverlay.hidden = false;
}

function abrirModalEditar(id) {
    const p = productosCache.find(x => String(x.id) === String(id));
    if (!p) return;

    formProducto.reset();
    document.getElementById('producto-id').value = p.id;
    document.getElementById('nombre').value = p.nombre;
    document.getElementById('descripcion').value = p.descripcion || '';
    document.getElementById('precio').value = p.precio;
    document.getElementById('stock').value = p.stock ?? 0;
    document.getElementById('stock_minimo').value = p.stock_minimo ?? 5;
    document.getElementById('imagen_url').value = p.imagen_url || '';
    document.getElementById('categoria').value = p.id_categoria || '';

    modalTitulo.textContent = 'Editar producto';
    modalOverlay.hidden = false;
}

function cerrarModal() {
    modalOverlay.hidden = true;
}

document.getElementById('btn-nuevo-producto').addEventListener('click', abrirModalNuevo);
document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar-modal').addEventListener('click', cerrarModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) cerrarModal(); });

// ===== GUARDAR (crear o editar) =====
formProducto.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('producto-id').value;
    const datos = {
        nombre: document.getElementById('nombre').value.trim(),
        descripcion: document.getElementById('descripcion').value.trim(),
        precio: parseFloat(document.getElementById('precio').value),
        imagen_url: document.getElementById('imagen_url').value.trim(),
        id_categoria: document.getElementById('categoria').value || null
    };
    const stock = parseInt(document.getElementById('stock').value, 10);
    const stockMinimo = parseInt(document.getElementById('stock_minimo').value, 10);

    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    try {
        let idProducto = id;

        if (id) {
            await apiFetch(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
        } else {
            const creado = await apiFetch('/productos', {
                method: 'POST',
                body: JSON.stringify({ ...datos, stock_inicial: stock })
            });
            idProducto = creado.id;
        }

        await apiFetch(`/inventario/${idProducto}`, {
            method: 'PUT',
            body: JSON.stringify({ cantidad: stock, stock_minimo: stockMinimo })
        });

        mostrarToast(id ? 'Producto actualizado' : 'Producto creado');
        cerrarModal();
        cargarProductos();
    } catch (err) {
        mostrarToast(err.message, true);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar';
    }
});

// ===== ELIMINAR =====
async function eliminarProducto(id) {
    const p = productosCache.find(x => String(x.id) === String(id));
    if (!confirm(`¿Eliminar "${p?.nombre}"? Esta acción no se puede deshacer desde el panel.`)) return;

    try {
        await apiFetch(`/productos/${id}`, { method: 'DELETE' });
        mostrarToast('Producto eliminado');
        cargarProductos();
    } catch (err) {
        mostrarToast(err.message, true);
    }
}

cargarCategorias();
cargarProductos();
