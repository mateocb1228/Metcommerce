const contenedor   = document.getElementById('contenedor-carrito');
const bannerAvisos = document.getElementById('banner-avisos');

const productosCache = {}; // id_producto -> detalle completo (con tallas), para validar stock

async function obtenerProducto(id) {
    if (productosCache[id]) return productosCache[id];
    const res = await fetch(`${API}/productos/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    productosCache[id] = data;
    return data;
}

async function iniciar() {
    let carrito = obtenerCarrito();

    if (!carrito.length) {
        renderizarVacio();
        return;
    }

    // Revalida cada línea contra el stock real de esa talla: un producto pudo
    // agotarse, eliminarse o cambiar de precio desde que se agregó al carrito.
    const avisos = [];
    try {
        carrito = await revalidarCarrito(carrito, avisos);
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

async function revalidarCarrito(carrito, avisos) {
    const actualizado = [];
    for (const item of carrito) {
        const actual = await obtenerProducto(item.id);
        if (!actual) {
            avisos.push(`"${item.nombre}" ya no está disponible y se quitó del carrito.`);
            continue;
        }

        let stockDisponible;
        if (actual.tallas?.length && item.talla !== null && item.talla !== undefined) {
            stockDisponible = actual.tallas.find(t => t.talla === item.talla)?.stock ?? 0;
        } else {
            stockDisponible = actual.stock ?? 0;
        }

        if (stockDisponible === 0) {
            avisos.push(`"${item.nombre}"${item.talla ? ' talla ' + item.talla : ''} se agotó y se quitó del carrito.`);
            continue;
        }

        let cantidad = item.cantidad;
        if (cantidad > stockDisponible) {
            avisos.push(`Solo quedan ${stockDisponible} unidades de "${item.nombre}"${item.talla ? ' talla ' + item.talla : ''}; se ajustó la cantidad.`);
            cantidad = stockDisponible;
        }

        actualizado.push({ ...item, cantidad, precio: parseFloat(actual.precio), stockDisponible });
    }
    guardarCarrito(actualizado.map(({ stockDisponible, ...resto }) => resto));
    return actualizado;
}

function mostrarAvisos(avisos) {
    if (!avisos.length) { bannerAvisos.classList.remove('visible'); return; }
    bannerAvisos.innerHTML = avisos.map(a => `⚠️ ${escapeHtml(a)}`).join('<br>');
    bannerAvisos.classList.add('visible');
}

function renderizarVacio() {
    contenedor.innerHTML = `
        <div class="carrito-vacio">
            <p>Tu carrito está vacío.</p>
            <a href="catalogo.html">Ver catálogo</a>
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
        const clave = claveLinea(item);
        const stockMax = item.stockDisponible ?? Infinity;
        const variante = [item.color, item.talla ? `Talla ${item.talla}` : null].filter(Boolean).join(' · ');

        const fila = document.createElement('div');
        fila.className = 'item-carrito';
        fila.innerHTML = `
            <img src="${escapeHtml(item.imagen_url || '')}" alt="${escapeHtml(item.nombre)}">
            <div class="item-info">
                <h3>${escapeHtml(item.nombre)}</h3>
                ${variante ? `<span class="variante">${escapeHtml(variante)}</span>` : ''}
                <span class="precio-unit">${formatoMoneda(item.precio)} c/u</span>
            </div>
            <div class="qty-stepper mini">
                <button class="btn-restar" data-clave="${escapeHtml(clave)}">−</button>
                <span>${item.cantidad}</span>
                <button class="btn-sumar" data-clave="${escapeHtml(clave)}" ${item.cantidad >= stockMax ? 'disabled' : ''}>+</button>
            </div>
            <div class="item-subtotal">${formatoMoneda(item.precio * item.cantidad)}</div>
            <button class="btn-quitar" data-clave="${escapeHtml(clave)}" title="Quitar producto">✕</button>
        `;
        lista.appendChild(fila);
    });

    lista.querySelectorAll('.btn-restar').forEach(btn =>
        btn.addEventListener('click', () => cambiarCantidad(btn.dataset.clave, -1)));
    lista.querySelectorAll('.btn-sumar').forEach(btn =>
        btn.addEventListener('click', () => cambiarCantidad(btn.dataset.clave, 1)));
    lista.querySelectorAll('.btn-quitar').forEach(btn =>
        btn.addEventListener('click', () => { eliminarDelCarrito(btn.dataset.clave); iniciar(); }));

    document.getElementById('btn-ir-checkout').addEventListener('click', () => {
        window.location.href = 'checkout.html';
    });
    document.getElementById('btn-vaciar-carrito').addEventListener('click', () => {
        if (confirm('¿Vaciar todo el carrito?')) { vaciarCarrito(); iniciar(); }
    });
}

function cambiarCantidad(clave, delta) {
    const carrito = obtenerCarrito();
    const item = carrito.find(p => claveLinea(p) === clave);
    if (!item) return;

    const actual = productosCache[item.id];
    const stockMax = actual?.tallas?.length
        ? (actual.tallas.find(t => t.talla === item.talla)?.stock ?? Infinity)
        : (actual?.stock ?? Infinity);
    const nuevaCantidad = item.cantidad + delta;

    if (nuevaCantidad > stockMax) {
        mostrarToast('No hay más stock disponible.', true);
        return;
    }

    actualizarCantidadCarrito(clave, nuevaCantidad);
    iniciar();
}

iniciar();
