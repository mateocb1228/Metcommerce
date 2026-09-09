const contenedor = document.getElementById('contenido-producto');

function idDesdeURL() {
    return new URLSearchParams(window.location.search).get('id');
}

let producto = null;
let colorSeleccionado = null;
let tallaSeleccionada = null;
let indiceImagen = 0;
let cantidad = 1;

async function cargarProducto() {
    const id = idDesdeURL();
    if (!id) { renderizarError('Producto no especificado.'); return; }

    try {
        const res = await fetch(`${API}/productos/${id}`);
        if (res.status === 404) { renderizarError('Este producto no existe o ya no está disponible.'); return; }
        if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
        producto = await res.json();
        colorSeleccionado = producto.colores?.[0] || null;
        renderizarProducto();
    } catch (err) {
        renderizarError('No se pudo conectar al servidor. Asegúrate de que el backend está corriendo en localhost:3000.');
        console.error(err);
    }
}

function renderizarError(mensaje) {
    contenedor.innerHTML = `<p class="msg-error" style="padding:80px 20px;">${escapeHtml(mensaje)}</p>`;
}

// El producto usa tallas si CUALQUIERA de sus colores trae desglose de tallas
// (cada color tiene su propio stock por talla, independiente de los demás).
function usaTallas() {
    return !!producto.colores?.some(c => c.tallas?.length);
}

function renderizarProducto() {
    const precio = parseFloat(producto.precio).toLocaleString('es-CO');

    contenedor.innerHTML = `
        <div class="producto-layout">
            <div class="galeria">
                <div class="galeria-principal"><img id="img-principal" alt="${escapeHtml(producto.nombre)}"></div>
                <div class="galeria-miniaturas" id="miniaturas"></div>
            </div>
            <div class="producto-info">
                ${producto.categoria ? `<span class="badge-categoria">${escapeHtml(producto.categoria)}</span>` : ''}
                <h1>${escapeHtml(producto.nombre)}</h1>
                <p class="producto-precio">$${precio}</p>
                ${producto.descripcion ? `<p class="producto-descripcion">${escapeHtml(producto.descripcion)}</p>` : ''}

                ${producto.colores?.length ? `
                <div class="selector-grupo">
                    <label>Color: <span id="nombre-color-elegido"></span></label>
                    <div class="selector-colores" id="selector-colores"></div>
                </div>` : ''}

                ${usaTallas() ? `
                <div class="selector-grupo">
                    <label>Talla</label>
                    <div class="selector-tallas" id="selector-tallas"></div>
                    <p class="aviso-stock" id="aviso-talla"></p>
                </div>` : ''}

                <div class="selector-grupo cantidad-grupo">
                    <label>Cantidad</label>
                    <div class="qty-stepper" id="qty-stepper">
                        <button type="button" id="qty-restar">−</button>
                        <span id="qty-valor">1</span>
                        <button type="button" id="qty-sumar">+</button>
                    </div>
                </div>

                <button class="btn-agregar-detalle" id="btn-agregar" disabled>Selecciona talla y color</button>
            </div>
        </div>
    `;

    if (producto.colores?.length) renderizarSelectorColores();
    if (usaTallas()) renderizarSelectorTallas();
    actualizarGaleria();
    actualizarQtyControles();
    actualizarBotonAgregar();

    document.getElementById('qty-restar').addEventListener('click', () => cambiarCantidad(-1));
    document.getElementById('qty-sumar').addEventListener('click', () => cambiarCantidad(1));
    document.getElementById('btn-agregar').addEventListener('click', agregarProductoAlCarrito);
}

// ===== GALERÍA =====
function actualizarGaleria() {
    const imagenes = colorSeleccionado?.imagenes?.length
        ? colorSeleccionado.imagenes.map(im => im.url)
        : [producto.imagen_url];
    if (indiceImagen >= imagenes.length) indiceImagen = 0;

    document.getElementById('img-principal').src = imagenes[indiceImagen];

    const miniaturas = document.getElementById('miniaturas');
    miniaturas.innerHTML = '';
    imagenes.forEach((url, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'miniatura' + (i === indiceImagen ? ' activa' : '');
        btn.innerHTML = `<img src="${escapeHtml(url)}" alt="">`;
        btn.addEventListener('click', () => { indiceImagen = i; actualizarGaleria(); });
        miniaturas.appendChild(btn);
    });
}

// ===== COLOR =====
function renderizarSelectorColores() {
    const contenedorColores = document.getElementById('selector-colores');
    contenedorColores.innerHTML = '';
    producto.colores.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'swatch' + (c.id === colorSeleccionado?.id ? ' activo' : '');
        btn.style.background = c.hex;
        btn.title = c.nombre;
        btn.addEventListener('click', () => {
            colorSeleccionado = c;
            indiceImagen = 0;
            tallaSeleccionada = null; // el stock por talla es propio de cada color
            cantidad = 1;
            contenedorColores.querySelectorAll('.swatch').forEach(s => s.classList.remove('activo'));
            btn.classList.add('activo');
            document.getElementById('nombre-color-elegido').textContent = c.nombre;
            actualizarGaleria();
            if (usaTallas()) renderizarSelectorTallas();
            actualizarQtyControles();
            actualizarBotonAgregar();
        });
        contenedorColores.appendChild(btn);
    });
    document.getElementById('nombre-color-elegido').textContent = colorSeleccionado?.nombre || '';
}

// ===== TALLA =====
// El stock por talla es propio del color elegido, no del producto en general.
function tallaStock(talla) {
    return colorSeleccionado?.tallas?.find(t => t.talla === talla)?.stock ?? 0;
}

function renderizarSelectorTallas() {
    const contenedorTallas = document.getElementById('selector-tallas');
    const tallas = colorSeleccionado?.tallas || [];
    contenedorTallas.innerHTML = '';
    tallas.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'talla-btn' + (t.talla === tallaSeleccionada ? ' activa' : '');
        btn.textContent = t.talla;
        btn.disabled = t.stock === 0;
        btn.addEventListener('click', () => {
            tallaSeleccionada = t.talla;
            contenedorTallas.querySelectorAll('.talla-btn').forEach(b => b.classList.remove('activa'));
            btn.classList.add('activa');
            cantidad = 1;
            actualizarQtyControles();
            actualizarAvisoStock();
            actualizarBotonAgregar();
        });
        contenedorTallas.appendChild(btn);
    });

    const aviso = document.getElementById('aviso-talla');
    if (tallas.every(t => t.stock === 0)) {
        aviso.textContent = `Todas las tallas de "${colorSeleccionado?.nombre || ''}" están agotadas por ahora.`;
        aviso.classList.add('bajo');
    } else {
        aviso.textContent = '';
        aviso.classList.remove('bajo');
    }
}

function actualizarAvisoStock() {
    const aviso = document.getElementById('aviso-talla');
    if (!aviso || tallaSeleccionada === null) { if (aviso) aviso.textContent = ''; return; }
    const stock = tallaStock(tallaSeleccionada);
    if (stock <= 5) {
        aviso.textContent = `⚠️ Últimas ${stock} unidades en talla ${tallaSeleccionada}`;
        aviso.classList.add('bajo');
    } else {
        aviso.textContent = `✅ Disponible en talla ${tallaSeleccionada}`;
        aviso.classList.remove('bajo');
    }
}

// ===== CANTIDAD =====
function stockMaximoActual() {
    if (usaTallas()) return tallaSeleccionada === null ? 1 : tallaStock(tallaSeleccionada);
    return producto.stock ?? 1;
}

function cambiarCantidad(delta) {
    const max = stockMaximoActual();
    cantidad = Math.min(Math.max(1, cantidad + delta), Math.max(1, max));
    actualizarQtyControles();
}

function actualizarQtyControles() {
    const max = stockMaximoActual();
    document.getElementById('qty-valor').textContent = cantidad;
    document.getElementById('qty-restar').disabled = cantidad <= 1;
    document.getElementById('qty-sumar').disabled = cantidad >= max;
}

// ===== BOTÓN AGREGAR =====
function actualizarBotonAgregar() {
    const btn = document.getElementById('btn-agregar');
    const necesitaColor = !!producto.colores?.length;
    const necesitaTalla = usaTallas();

    if (necesitaTalla && (colorSeleccionado?.tallas || []).every(t => t.stock === 0)) {
        btn.disabled = true;
        btn.textContent = 'Agotado en este color';
        return;
    }
    if ((necesitaColor && !colorSeleccionado) || (necesitaTalla && tallaSeleccionada === null)) {
        btn.disabled = true;
        btn.textContent = 'Selecciona talla y color';
        return;
    }
    btn.disabled = false;
    btn.textContent = 'Agregar al carrito';
}

function agregarProductoAlCarrito() {
    const imagenActual = document.getElementById('img-principal').src;
    const resultado = agregarAlCarrito({
        id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        imagen_url: colorSeleccionado?.imagenes?.[0]?.url || imagenActual,
        talla: tallaSeleccionada,
        color: colorSeleccionado?.nombre || null,
        id_color: colorSeleccionado?.id ?? null,
        stockDisponible: stockMaximoActual()
    }, cantidad);

    if (resultado.ok) {
        mostrarToast(`✅ ${producto.nombre} agregado al carrito`);
        cantidad = 1;
        actualizarQtyControles();
    } else {
        mostrarToast(`⚠️ ${resultado.mensaje}`, true);
    }
}

cargarProducto();
