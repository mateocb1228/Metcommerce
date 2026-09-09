requerirSesion();

const usuario = obtenerUsuario();
if (usuario) {
    document.getElementById('nombre-usuario').textContent = usuario.nombre_completo || usuario.usuario;
}
document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

const RANGO_TALLAS = Array.from({ length: 10 }, (_, i) => 35 + i); // 35..44
const contenedor = document.getElementById('contenido-producto');
const idProducto = new URLSearchParams(window.location.search).get('id');

let producto = null;
let idColorAbierto = null; // conserva qué color quedó expandido entre recargas

if (!idProducto || !/^\d+$/.test(idProducto)) {
    contenedor.innerHTML = '<p class="msg-vacio">Producto no especificado. <a href="productos.html">Volver a productos</a></p>';
} else {
    cargarProducto();
}

async function cargarProducto() {
    try {
        producto = await apiFetch(`/productos/${idProducto}`);
        renderizarTodo();
    } catch (err) {
        contenedor.innerHTML = `<p class="msg-vacio">No se pudo cargar el producto: ${escapeHtml(err.message)}. <a href="productos.html">Volver a productos</a></p>`;
    }
}

function totalStockColor(color) {
    return (color.tallas || []).reduce((sum, t) => sum + t.stock, 0);
}

function renderizarTodo() {
    document.getElementById('titulo-producto').textContent = `Gestionar: ${producto.nombre}`;

    contenedor.innerHTML = `
        <section class="panel">
            <h2>Datos generales</h2>
            <div class="pedido-cliente-fila"><span>Nombre</span><strong>${escapeHtml(producto.nombre)}</strong></div>
            <div class="pedido-cliente-fila"><span>Categoría</span><strong>${escapeHtml(producto.categoria || '—')}</strong></div>
            <div class="pedido-cliente-fila"><span>Precio</span><strong>${formatoMoneda(producto.precio)}</strong></div>
            <div class="pedido-cliente-fila"><span>Stock total (todos los colores y tallas)</span><strong>${producto.stock}</strong></div>
            <div class="pedido-cliente-fila"><span>Descripción</span><strong>${escapeHtml(producto.descripcion || '—')}</strong></div>
            <a class="btn btn-cancelar" href="productos.html?editar=${producto.id}" style="display:inline-block;margin-top:12px;">Editar datos básicos</a>
        </section>

        <section class="panel">
            <h2>Imagen principal</h2>
            <div class="imagen-principal-preview">
                ${producto.imagen_url ? `<img src="${escapeHtml(producto.imagen_url)}" alt="">` : '<p class="msg-vacio">Sin imagen principal todavía.</p>'}
            </div>
            <div class="subir-imagen-fila">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" id="input-imagen-principal">
                <button type="button" class="btn btn-guardar" id="btn-subir-imagen-principal">Subir imagen principal</button>
            </div>
        </section>

        <section class="panel">
            <h2>Colores</h2>
            ${producto.colores.length ? producto.colores.map(renderizarColorCard).join('') : '<p class="msg-vacio">Este producto todavía no tiene colores.</p>'}

            <h3 class="pedido-seccion-titulo" style="margin-top:22px;">Agregar color</h3>
            <form id="form-nuevo-color" class="form-nuevo-color">
                <div class="campo">
                    <label for="nuevo-color-nombre">Nombre</label>
                    <input type="text" id="nuevo-color-nombre" maxlength="50" required>
                </div>
                <div class="campo">
                    <label for="nuevo-color-hex">Color</label>
                    <div class="color-picker-fila">
                        <input type="color" class="input-color-hex-picker" id="nuevo-color-picker" value="#1F2229">
                        <input type="text" class="input-color-hex-texto" id="nuevo-color-hex" value="#1F2229" maxlength="7" required>
                    </div>
                </div>
                <button type="submit" class="btn btn-guardar">+ Agregar color</button>
            </form>
        </section>
    `;

    if (idColorAbierto) {
        const abierto = contenedor.querySelector(`details.color-card[data-id-color="${idColorAbierto}"]`);
        if (abierto) abierto.open = true;
    }
}

function renderizarColorCard(c) {
    const imagenes = c.imagenes || [];
    const tallasPorNumero = {};
    (c.tallas || []).forEach(t => { tallasPorNumero[t.talla] = t.stock; });

    return `
        <details class="color-card" data-id-color="${c.id}">
            <summary>
                <span class="color-swatch-grande" style="background:${escapeHtml(c.hex)}"></span>
                <span class="color-card-nombre">${escapeHtml(c.nombre)}</span>
                <span class="color-card-hex">${escapeHtml(c.hex)}</span>
                <span class="color-card-resumen">${totalStockColor(c)} en stock · ${imagenes.length} imagen(es)</span>
            </summary>

            <div class="color-card-body">
                <div class="color-card-edit">
                    <div class="campo">
                        <label>Nombre</label>
                        <input type="text" class="input-color-nombre" maxlength="50" value="${escapeHtml(c.nombre)}">
                    </div>
                    <div class="campo">
                        <label>Color</label>
                        <div class="color-picker-fila">
                            <input type="color" class="input-color-hex-picker" value="${c.hex}">
                            <input type="text" class="input-color-hex-texto" maxlength="7" value="${c.hex}">
                        </div>
                    </div>
                    <div class="color-card-edit-acciones">
                        <button type="button" class="btn btn-guardar btn-guardar-color" data-id="${c.id}">Guardar cambios</button>
                        <button type="button" class="btn-accion btn-eliminar btn-eliminar-color" data-id="${c.id}">Eliminar color</button>
                    </div>
                </div>

                <h4 class="pedido-seccion-titulo">Imágenes</h4>
                <div class="galeria-admin">
                    ${imagenes.length ? imagenes.map(im => `
                        <div class="galeria-admin-item">
                            <img src="${escapeHtml(im.url)}" alt="">
                            <button type="button" class="btn-quitar-imagen" data-id-color="${c.id}" data-id-imagen="${im.id}" title="Eliminar imagen">✕</button>
                        </div>
                    `).join('') : '<p class="msg-vacio">Sin imágenes todavía.</p>'}
                </div>
                <div class="subir-imagen-fila">
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" class="input-subir-imagen">
                    <button type="button" class="btn btn-guardar btn-subir-imagen" data-id="${c.id}">Subir imagen</button>
                </div>

                <h4 class="pedido-seccion-titulo">Tallas y stock</h4>
                <div class="grid-tallas">
                    ${RANGO_TALLAS.map(talla => `
                        <div class="talla-input-grupo">
                            <label>${talla}</label>
                            <input type="number" min="0" step="1" class="input-talla-stock" data-talla="${talla}" value="${tallasPorNumero[talla] ?? 0}">
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-guardar btn-guardar-tallas" data-id="${c.id}">Guardar tallas</button>
            </div>
        </details>
    `;
}

// ===== Sincroniza el selector de color nativo con su input de texto hex =====
contenedor.addEventListener('input', (e) => {
    const fila = e.target.closest('.color-picker-fila');
    if (!fila) return;
    const picker = fila.querySelector('.input-color-hex-picker');
    const texto = fila.querySelector('.input-color-hex-texto');
    if (e.target === picker) {
        texto.value = picker.value.toUpperCase();
    } else if (e.target === texto && /^#[0-9A-Fa-f]{6}$/.test(texto.value)) {
        picker.value = texto.value;
    }
});

// Recuerda qué color quedó abierto para volver a abrirlo tras recargar.
// "toggle" no burbujea, por eso se escucha en fase de captura.
contenedor.addEventListener('toggle', (e) => {
    if (!e.target.matches?.('details.color-card')) return;
    idColorAbierto = e.target.open ? e.target.dataset.idColor : null;
}, true);

contenedor.addEventListener('submit', async (e) => {
    if (e.target.id !== 'form-nuevo-color') return;
    e.preventDefault();
    const nombre = document.getElementById('nuevo-color-nombre').value.trim();
    const hex = document.getElementById('nuevo-color-hex').value.trim();
    if (!nombre || !/^#[0-9A-Fa-f]{6}$/i.test(hex)) {
        mostrarToast('Nombre y color (formato #RRGGBB) son requeridos', true);
        return;
    }
    try {
        await apiFetch(`/productos/${idProducto}/colores`, {
            method: 'POST',
            body: JSON.stringify({ nombre, color_hex: hex })
        });
        mostrarToast('Color agregado');
        await cargarProducto();
    } catch (err) {
        mostrarToast(err.message, true);
    }
});

contenedor.addEventListener('click', (e) => {
    const btnPrincipal = e.target.closest('#btn-subir-imagen-principal');
    if (btnPrincipal) return subirImagenPrincipal();

    const btnGuardarColor = e.target.closest('.btn-guardar-color');
    if (btnGuardarColor) return guardarColor(btnGuardarColor.dataset.id);

    const btnEliminarColor = e.target.closest('.btn-eliminar-color');
    if (btnEliminarColor) return eliminarColor(btnEliminarColor.dataset.id);

    const btnSubirImagen = e.target.closest('.btn-subir-imagen');
    if (btnSubirImagen) return subirImagenColor(btnSubirImagen.dataset.id);

    const btnQuitarImagen = e.target.closest('.btn-quitar-imagen');
    if (btnQuitarImagen) return eliminarImagen(btnQuitarImagen.dataset.idColor, btnQuitarImagen.dataset.idImagen);

    const btnGuardarTallas = e.target.closest('.btn-guardar-tallas');
    if (btnGuardarTallas) return guardarTallas(btnGuardarTallas.dataset.id);
});

async function subirImagenPrincipal() {
    const input = document.getElementById('input-imagen-principal');
    const archivo = input.files[0];
    if (!archivo) { mostrarToast('Selecciona primero un archivo de imagen', true); return; }

    const formData = new FormData();
    formData.append('imagen', archivo);
    try {
        await apiUpload(`/productos/${idProducto}/imagen`, formData);
        mostrarToast('Imagen principal actualizada');
        await cargarProducto();
    } catch (err) {
        mostrarToast(err.message, true);
    }
}

async function guardarColor(idColor) {
    const card = contenedor.querySelector(`details.color-card[data-id-color="${idColor}"]`);
    const nombre = card.querySelector('.input-color-nombre').value.trim();
    const hex = card.querySelector('.input-color-hex-texto').value.trim();
    if (!nombre || !/^#[0-9A-Fa-f]{6}$/i.test(hex)) {
        mostrarToast('Nombre y color (formato #RRGGBB) son requeridos', true);
        return;
    }
    idColorAbierto = idColor;
    try {
        await apiFetch(`/productos/${idProducto}/colores/${idColor}`, {
            method: 'PUT',
            body: JSON.stringify({ nombre, color_hex: hex })
        });
        mostrarToast('Color actualizado');
        await cargarProducto();
    } catch (err) {
        mostrarToast(err.message, true);
    }
}

async function eliminarColor(idColor) {
    const color = producto.colores.find(c => String(c.id) === String(idColor));
    if (!confirm(`¿Eliminar el color "${color?.nombre}"? También se borran sus imágenes y su stock por talla. Esta acción no se puede deshacer.`)) return;

    try {
        await apiFetch(`/productos/${idProducto}/colores/${idColor}`, { method: 'DELETE' });
        mostrarToast('Color eliminado');
        idColorAbierto = null;
        await cargarProducto();
    } catch (err) {
        mostrarToast(err.message, true);
    }
}

async function subirImagenColor(idColor) {
    const card = contenedor.querySelector(`details.color-card[data-id-color="${idColor}"]`);
    const input = card.querySelector('.input-subir-imagen');
    const archivo = input.files[0];
    if (!archivo) { mostrarToast('Selecciona primero un archivo de imagen', true); return; }

    const formData = new FormData();
    formData.append('imagen', archivo);
    idColorAbierto = idColor;
    try {
        await apiUpload(`/productos/${idProducto}/colores/${idColor}/imagenes`, formData);
        mostrarToast('Imagen agregada');
        await cargarProducto();
    } catch (err) {
        mostrarToast(err.message, true);
    }
}

async function eliminarImagen(idColor, idImagen) {
    if (!confirm('¿Eliminar esta imagen?')) return;
    idColorAbierto = idColor;
    try {
        await apiFetch(`/productos/${idProducto}/colores/${idColor}/imagenes/${idImagen}`, { method: 'DELETE' });
        mostrarToast('Imagen eliminada');
        await cargarProducto();
    } catch (err) {
        mostrarToast(err.message, true);
    }
}

async function guardarTallas(idColor) {
    const card = contenedor.querySelector(`details.color-card[data-id-color="${idColor}"]`);
    const inputs = card.querySelectorAll('.input-talla-stock');
    const tallas = Array.from(inputs).map(inp => ({
        talla: parseInt(inp.dataset.talla, 10),
        stock: Math.max(0, parseInt(inp.value, 10) || 0)
    }));
    idColorAbierto = idColor;
    try {
        await apiFetch(`/productos/${idProducto}/colores/${idColor}/tallas`, {
            method: 'PUT',
            body: JSON.stringify({ tallas })
        });
        mostrarToast('Tallas actualizadas');
        await cargarProducto();
    } catch (err) {
        mostrarToast(err.message, true);
    }
}
