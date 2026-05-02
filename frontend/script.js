// ===== PRODUCTOS DE PRUEBA =====
const productos = [
    {
        id: 1,
        nombre: "Zapato Casual Hombre",
        precio: 89900,
        imagen: "https://via.placeholder.com/250x200?text=Zapato+Casual"
    },
    {
        id: 2,
        nombre: "Tenis Deportivo",
        precio: 120000,
        imagen: "https://via.placeholder.com/250x200?text=Tenis+Deportivo"
    },
    {
        id: 3,
        nombre: "Sandalia Mujer",
        precio: 65000,
        imagen: "https://via.placeholder.com/250x200?text=Sandalia+Mujer"
    },
    {
        id: 4,
        nombre: "Bota de Cuero",
        precio: 195000,
        imagen: "https://via.placeholder.com/250x200?text=Bota+Cuero"
    }
];

// ===== CARRITO =====
let carrito = [];

// ===== MOSTRAR PRODUCTOS =====
function mostrarProductos() {
    const grid = document.getElementById('grid-productos');
    grid.innerHTML = '';

    productos.forEach(producto => {
        const tarjeta = document.createElement('div');
        tarjeta.classList.add('tarjeta');
        tarjeta.innerHTML = `
            <img src="${producto.imagen}" alt="${producto.nombre}">
            <h3>${producto.nombre}</h3>
            <p class="precio">$${producto.precio.toLocaleString('es-CO')}</p>
            <button class="btn-agregar" onclick="agregarAlCarrito(${producto.id})">
                Agregar al carrito
            </button>
        `;
        grid.appendChild(tarjeta);
    });
}

// ===== AGREGAR AL CARRITO =====
function agregarAlCarrito(id) {
    const producto = productos.find(p => p.id === id);
    carrito.push(producto);
    actualizarContador();
    alert(`✅ ${producto.nombre} agregado al carrito`);
}

// ===== ACTUALIZAR CONTADOR =====
function actualizarContador() {
    document.getElementById('contador-carrito').textContent = carrito.length;
}

// ===== INICIAR =====
mostrarProductos();