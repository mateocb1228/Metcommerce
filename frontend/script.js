let productosCache = [];

// ===== CARGAR PRODUCTOS DESDE LA API =====
async function cargarProductos() {
    const grid = document.getElementById('grid-productos');
    grid.innerHTML = '<p class="msg-cargando">Cargando productos...</p>';

    try {
        const res = await fetch(`${API}/productos`);
        if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
        productosCache = await res.json();
        mostrarProductos(productosCache);
    } catch (err) {
        grid.innerHTML = `
            <p class="msg-error">
                No se pudo conectar al servidor.<br>
                Asegúrate de que el backend está corriendo en <strong>localhost:3000</strong>.
            </p>`;
        console.error(err);
    }
}

// ===== RENDERIZAR TARJETAS =====
function mostrarProductos(productos) {
    const grid = document.getElementById('grid-productos');
    grid.innerHTML = '';

    if (!productos.length) {
        grid.innerHTML = '<p class="msg-cargando">No hay productos disponibles.</p>';
        return;
    }

    productos.forEach(p => {
        const agotado  = p.stock === 0;
        const stockBajo = p.stock > 0 && p.stock <= 5;
        const precio   = parseFloat(p.precio).toLocaleString('es-CO');

        const tarjeta = document.createElement('div');
        tarjeta.classList.add('tarjeta');
        if (agotado) tarjeta.classList.add('sin-stock');

        tarjeta.innerHTML = `
            <img src="${escapeHtml(p.imagen_url || '')}" alt="${escapeHtml(p.nombre)}">
            ${p.categoria ? `<span class="badge-categoria">${escapeHtml(p.categoria)}</span>` : ''}
            <h3>${escapeHtml(p.nombre)}</h3>
            ${p.descripcion ? `<p class="descripcion">${escapeHtml(p.descripcion)}</p>` : ''}
            <p class="precio">$${precio}</p>
            <p class="stock-info ${agotado ? 'agotado' : stockBajo ? 'stock-bajo' : ''}">
                ${agotado ? '❌ Agotado' : stockBajo ? `⚠️ Últimas ${p.stock} unidades` : `✅ Disponible`}
            </p>
            <button class="btn-agregar" data-id="${p.id}" ${agotado ? 'disabled' : ''}>
                ${agotado ? 'Sin stock' : 'Agregar al carrito'}
            </button>
        `;
        grid.appendChild(tarjeta);
    });

    grid.querySelectorAll('.btn-agregar').forEach(btn => {
        btn.addEventListener('click', () => manejarAgregarAlCarrito(btn.dataset.id));
    });
}

// ===== AGREGAR AL CARRITO (delega en carrito.js, que persiste en localStorage) =====
function manejarAgregarAlCarrito(id) {
    const producto = productosCache.find(p => String(p.id) === String(id));
    if (!producto) return;

    const resultado = agregarAlCarrito({
        id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        imagen_url: producto.imagen_url,
        stock: producto.stock
    }, 1);

    if (resultado.ok) {
        mostrarToast(`✅ ${producto.nombre} agregado`);
    } else {
        mostrarToast(`⚠️ ${resultado.mensaje}`, true);
    }
}

// ===== INICIO =====
cargarProductos();
