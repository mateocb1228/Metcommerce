// Módulo compartido del carrito. Se carga en index.html, carrito.html,
// checkout.html y confirmacion.html antes que el script propio de cada página.

const API = 'http://localhost:3000/api';
const CARRITO_KEY = 'mc_carrito';

// ===== PERSISTENCIA (localStorage → sobrevive a recargar la página) =====
function obtenerCarrito() {
    try {
        const raw = localStorage.getItem(CARRITO_KEY);
        const carrito = raw ? JSON.parse(raw) : [];
        return Array.isArray(carrito) ? carrito : [];
    } catch {
        return [];
    }
}

function guardarCarrito(carrito) {
    try {
        localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
    } catch {
        // localStorage no disponible (modo privado, cuota excedida, etc.)
    }
    actualizarContadorCarrito();
}

function vaciarCarrito() {
    localStorage.removeItem(CARRITO_KEY);
    actualizarContadorCarrito();
}

// ===== OPERACIONES SOBRE EL CARRITO =====
// producto: { id, nombre, precio, imagen_url, stock }
function agregarAlCarrito(producto, cantidad = 1) {
    const carrito = obtenerCarrito();
    const existente = carrito.find(p => p.id === producto.id);
    const cantidadActual = existente ? existente.cantidad : 0;
    const stockDisponible = producto.stock ?? Infinity;
    const nuevaCantidad = Math.min(cantidadActual + cantidad, stockDisponible);

    if (nuevaCantidad <= cantidadActual) {
        return { ok: false, mensaje: 'No hay más stock disponible de este producto.' };
    }

    if (existente) {
        existente.cantidad = nuevaCantidad;
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: parseFloat(producto.precio),
            imagen_url: producto.imagen_url || '',
            cantidad: nuevaCantidad
        });
    }
    guardarCarrito(carrito);
    return { ok: true, ajustado: nuevaCantidad < cantidadActual + cantidad };
}

function actualizarCantidadCarrito(id, cantidad) {
    let carrito = obtenerCarrito();
    if (cantidad <= 0) {
        carrito = carrito.filter(p => p.id !== id);
    } else {
        const item = carrito.find(p => p.id === id);
        if (item) item.cantidad = cantidad;
    }
    guardarCarrito(carrito);
    return carrito;
}

function eliminarDelCarrito(id) {
    const carrito = obtenerCarrito().filter(p => p.id !== id);
    guardarCarrito(carrito);
    return carrito;
}

function calcularTotalCarrito(carrito = obtenerCarrito()) {
    return carrito.reduce((sum, p) => sum + p.precio * p.cantidad, 0);
}

function contarItemsCarrito(carrito = obtenerCarrito()) {
    return carrito.reduce((sum, p) => sum + p.cantidad, 0);
}

function actualizarContadorCarrito() {
    const el = document.getElementById('contador-carrito');
    if (el) el.textContent = contarItemsCarrito();
}

// ===== UTILIDADES COMPARTIDAS =====
// Escapa texto antes de insertarlo en innerHTML (evita XSS con datos que
// vienen de la API o de lo que el propio usuario escribió en el checkout).
function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

function formatoMoneda(valor) {
    return `$${parseFloat(valor || 0).toLocaleString('es-CO')}`;
}

function formatoFecha(fechaISO) {
    return new Date(fechaISO).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function mostrarToast(mensaje, esError = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = mensaje;
    toast.classList.toggle('error', esError);
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), 3000);
}

document.addEventListener('DOMContentLoaded', actualizarContadorCarrito);
