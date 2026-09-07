// Construye una tarjeta de producto reutilizable (home "Novedades" y catálogo).
// Cambiar el color desde el swatch solo actualiza la imagen de vista previa,
// no navega — el clic en el resto de la tarjeta sí lleva al detalle.
function crearTarjetaProducto(producto) {
    const a = document.createElement('a');
    a.href = `producto.html?id=${producto.id}`;
    a.className = 'tarjeta';

    const precio = parseFloat(producto.precio).toLocaleString('es-CO');
    const colores = producto.colores || [];
    const imagenInicial = producto.imagen_url || colores[0]?.imagen_url || '';

    a.innerHTML = `
        <div class="tarjeta-img">
            <img src="${escapeHtml(imagenInicial)}" alt="${escapeHtml(producto.nombre)}">
        </div>
        <div class="tarjeta-cuerpo">
            ${producto.categoria ? `<span class="badge-categoria">${escapeHtml(producto.categoria)}</span>` : ''}
            <h3>${escapeHtml(producto.nombre)}</h3>
            <p class="precio">$${precio}</p>
            <div class="tarjeta-colores"></div>
        </div>
    `;

    const img = a.querySelector('.tarjeta-img img');
    const contenedorColores = a.querySelector('.tarjeta-colores');

    colores.slice(0, 5).forEach((c, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'swatch' + (i === 0 ? ' activo' : '');
        btn.style.background = c.hex;
        btn.title = c.nombre;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (c.imagen_url) img.src = c.imagen_url;
            contenedorColores.querySelectorAll('.swatch').forEach(s => s.classList.remove('activo'));
            btn.classList.add('activo');
        });
        contenedorColores.appendChild(btn);
    });

    return a;
}

function renderizarGridProductos(contenedor, productos, mensajeVacio = 'No hay productos disponibles.') {
    contenedor.innerHTML = '';
    if (!productos.length) {
        contenedor.innerHTML = `<p class="msg-vacio">${escapeHtml(mensajeVacio)}</p>`;
        return;
    }
    productos.forEach(p => contenedor.appendChild(crearTarjetaProducto(p)));
}
