// Módulo compartido del carrito. Se carga en todas las páginas antes que
// el script propio de cada una.

const API = 'http://localhost:3000/api';
const CARRITO_KEY = 'mc_carrito';

// Cada línea del carrito es un producto+talla+color específico, no solo un
// producto: el mismo zapato en dos tallas distintas son dos líneas.
function claveLinea({ id, talla, color }) {
    return `${id}__${talla}__${color}`;
}

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
// producto: { id, nombre, precio, imagen_url, talla, color, stockDisponible }
function agregarAlCarrito(producto, cantidad = 1) {
    const carrito = obtenerCarrito();
    const clave = claveLinea(producto);
    const existente = carrito.find(p => claveLinea(p) === clave);
    const cantidadActual = existente ? existente.cantidad : 0;
    const stockDisponible = producto.stockDisponible ?? Infinity;
    const nuevaCantidad = Math.min(cantidadActual + cantidad, stockDisponible);

    if (nuevaCantidad <= cantidadActual) {
        return { ok: false, mensaje: 'No hay más stock disponible de esta talla.' };
    }

    if (existente) {
        existente.cantidad = nuevaCantidad;
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: parseFloat(producto.precio),
            imagen_url: producto.imagen_url || '',
            talla: producto.talla,
            color: producto.color,
            cantidad: nuevaCantidad
        });
    }
    guardarCarrito(carrito);
    return { ok: true, ajustado: nuevaCantidad < cantidadActual + cantidad };
}

function actualizarCantidadCarrito(clave, cantidad) {
    let carrito = obtenerCarrito();
    if (cantidad <= 0) {
        carrito = carrito.filter(p => claveLinea(p) !== clave);
    } else {
        const item = carrito.find(p => claveLinea(p) === clave);
        if (item) item.cantidad = cantidad;
    }
    guardarCarrito(carrito);
    return carrito;
}

function eliminarDelCarrito(clave) {
    const carrito = obtenerCarrito().filter(p => claveLinea(p) !== clave);
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
