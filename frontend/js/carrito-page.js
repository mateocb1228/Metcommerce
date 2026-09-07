const contenedor   = document.getElementById('contenedor-carrito');
const bannerAvisos = document.getElementById('banner-avisos');

let productosServidor = null; // null = aún no se pudo consultar la API

async function iniciar() {
    let carrito = obtenerCarrito();

    if (!carrito.length) {
        renderizarVacio();
        return;
    }

    // Revalida el carrito contra el stock real antes de mostrarlo: un producto
    // pudo agotarse, eliminarse o cambiar de precio desde que se agregó.
    const avisos = [];
    try {
        const res = await fetch(`${API}/productos`);
        if (res.ok) {
            productosServidor = await res.json();
            carrito = revalidarCarrito(carrito, productosServidor, avisos);
        }
    } catch {
        // Sin conexión: se muestra el carrito guardado tal cual, sin bloquear al usuario.
    }

    if (!carrito.length) {
        renderizarVacio();
    } else {
        renderizarCarrito(carrito);
    }
    mostrarAvisos(avisos);
}

function revalidarCarrito(carrito, productos, avisos) {
    const actualizado = [];
    for (const item of carrito) {
        const actual = productos.find(p => p.id === item.id);
        if (!actual) {
            avisos.push(`"${item.nombre}" ya no está disponible y se quitó del carrito.`);
            continue;
        }
        if (actual.stock === 0) {
            avisos.push(`"${item.nombre}" se agotó y se quitó del carrito.`);
            continue;
        }
        let cantidad = item.cantidad;
        if (cantidad > actual.stock) {
            avisos.push(`Solo quedan ${actual.stock} unidades de "${item.nombre}"; se ajustó la cantidad.`);
            cantidad = actual.stock;
        }
        actualizado.push({ ...item, cantidad, precio: parseFloat(actual.precio), stockDisponible: actual.stock });
    }
    guardarCarrito(actualizado.map(({ stockDisponible, ...resto }) => resto));
    return actualizado;
}

function mostrarAvisos(avisos) {
    if (!avisos.length) {
        bannerAvisos.classList.remove('visible');
        return;
    }
    bannerAvisos.innerHTML = avisos.map(a => `⚠️ ${escapeHtml(a)}`).join('<br>');
    bannerAvisos.classList.add('visible');
}

function renderizarVacio() {
    contenedor.innerHTML = `
        <div class="carrito-vacio">
            <p>Tu carrito está vacío.</p>
            <a href="index.html">Ver catálogo</a>
        </div>
    `;
}

function renderizarCarrito(carrito) {
    const total = calcularTotalCarrito(carrito);

    contenedor.innerHTML = `
        <div class="carrito-layout">
            <div class="lista-carrito" id="lista-carrito"></div>
            <div class="resumen-pedido">
                <h2>Resumen del pedido</h2>
                <div class="resumen-fila">
                    <span>Productos (${contarItemsCarrito(carrito)})</span>
                    <span>${formatoMoneda(total)}</span>
                </div>
                <div class="resumen-total">
                    <span>Total</span>
                    <span>${formatoMoneda(total)}</span>
                </div>
                <button class="btn-checkout" id="btn-ir-checkout">Proceder al pago</button>
                <button class="btn-vaciar" id="btn-vaciar-carrito">Vaciar carrito</button>
            </div>
        </div>
    `;

    const lista = document.getElementById('lista-carrito');
    carrito.forEach(item => {
        const stockMax = item.stockDisponible ?? Infinity;
        const fila = document.createElement('div');
        fila.className = 'item-carrito';
        fila.innerHTML = `
            <img src="${escapeHtml(item.imagen_url || '')}" alt="${escapeHtml(item.nombre)}">
            <div class="item-info">
                <h3>${escapeHtml(item.nombre)}</h3>
                <span class="precio-unit">${formatoMoneda(item.precio)} c/u</span>
            </div>
            <div class="qty-stepper">
                <button class="btn-restar" data-id="${item.id}">−</button>
                <span>${item.cantidad}</span>
                <button class="btn-sumar" data-id="${item.id}" ${item.cantidad >= stockMax ? 'disabled' : ''}>+</button>
            </div>
            <div class="item-subtotal">${formatoMoneda(item.precio * item.cantidad)}</div>
            <button class="btn-quitar" data-id="${item.id}" title="Quitar producto">✕</button>
        `;
        lista.appendChild(fila);
    });

    lista.querySelectorAll('.btn-restar').forEach(btn =>
        btn.addEventListener('click', () => cambiarCantidad(btn.dataset.id, -1)));
    lista.querySelectorAll('.btn-sumar').forEach(btn =>
        btn.addEventListener('click', () => cambiarCantidad(btn.dataset.id, 1)));
    lista.querySelectorAll('.btn-quitar').forEach(btn =>
        btn.addEventListener('click', () => {
            eliminarDelCarrito(Number(btn.dataset.id));
            iniciar();
        }));

    document.getElementById('btn-ir-checkout').addEventListener('click', () => {
        window.location.href = 'checkout.html';
    });
    document.getElementById('btn-vaciar-carrito').addEventListener('click', () => {
        if (confirm('¿Vaciar todo el carrito?')) {
            vaciarCarrito();
            iniciar();
        }
    });
}

function cambiarCantidad(idRaw, delta) {
    const id = Number(idRaw);
    const carrito = obtenerCarrito();
    const item = carrito.find(p => p.id === id);
    if (!item) return;

    const producto = productosServidor?.find(p => p.id === id);
    const stockMax = producto ? producto.stock : Infinity;
    const nuevaCantidad = item.cantidad + delta;

    if (nuevaCantidad > stockMax) {
        mostrarToast('No hay más stock disponible.', true);
        return;
    }

    actualizarCantidadCarrito(id, nuevaCantidad);
    iniciar();
}

iniciar();
