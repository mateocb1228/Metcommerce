const API = 'http://localhost:3000/api';
let carrito = [];

// ===== CARGAR PRODUCTOS DESDE LA API =====
async function cargarProductos() {
    const grid = document.getElementById('grid-productos');
    grid.innerHTML = '<p class="msg-cargando">Cargando productos...</p>';

    try {
        const res = await fetch(`${API}/productos`);
        if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
        const productos = await res.json();
        mostrarProductos(productos);
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
            <img src="${p.imagen_url}" alt="${p.nombre}">
            ${p.categoria ? `<span class="badge-categoria">${p.categoria}</span>` : ''}
            <h3>${p.nombre}</h3>
            ${p.descripcion ? `<p class="descripcion">${p.descripcion}</p>` : ''}
            <p class="precio">$${precio}</p>
            <p class="stock-info ${agotado ? 'agotado' : stockBajo ? 'stock-bajo' : ''}">
                ${agotado ? '❌ Agotado' : stockBajo ? `⚠️ Últimas ${p.stock} unidades` : `✅ Disponible`}
            </p>
            <button
                class="btn-agregar"
                onclick="agregarAlCarrito(${p.id}, '${p.nombre.replace(/'/g, "\\'")}', ${p.precio})"
                ${agotado ? 'disabled' : ''}
            >
                ${agotado ? 'Sin stock' : 'Agregar al carrito'}
            </button>
        `;
        grid.appendChild(tarjeta);
    });
}

// ===== CARRITO (agrupa por producto) =====
function agregarAlCarrito(id, nombre, precio) {
    const existente = carrito.find(p => p.id === id);
    if (existente) {
        existente.cantidad++;
    } else {
        carrito.push({ id, nombre, precio: parseFloat(precio), cantidad: 1 });
    }
    actualizarContador();
    mostrarToast(`✅ ${nombre} agregado`);
}

function actualizarContador() {
    const total = carrito.reduce((sum, p) => sum + p.cantidad, 0);
    document.getElementById('contador-carrito').textContent = total;
}

// ===== TOAST DE CONFIRMACIÓN =====
function mostrarToast(mensaje) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = mensaje;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ===== INICIO =====
cargarProductos();
