const grid = document.getElementById('grid-productos');
const tabs = document.getElementById('filtro-tabs');

function obtenerCategoriaURL() {
    return new URLSearchParams(window.location.search).get('categoria') || '';
}

function marcarTabActivo(categoria) {
    tabs.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('activo', btn.dataset.categoria.toLowerCase() === categoria.toLowerCase());
    });
}

async function cargarCatalogo(categoria) {
    grid.innerHTML = '<p class="msg-cargando">Cargando productos...</p>';
    try {
        const url = categoria ? `${API}/productos?categoria=${encodeURIComponent(categoria)}` : `${API}/productos`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
        const productos = await res.json();
        renderizarGridProductos(grid, productos, 'No hay productos en esta categoría todavía.');
    } catch (err) {
        grid.innerHTML = `
            <p class="msg-error">
                No se pudo conectar al servidor.<br>
                Asegúrate de que el backend está corriendo en <strong>localhost:3000</strong>.
            </p>`;
        console.error(err);
    }
}

tabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
        const categoria = btn.dataset.categoria;
        const url = categoria ? `catalogo.html?categoria=${encodeURIComponent(categoria)}` : 'catalogo.html';
        history.pushState({}, '', url);
        marcarTabActivo(categoria);
        cargarCatalogo(categoria);
    });
});

const categoriaInicial = obtenerCategoriaURL();
marcarTabActivo(categoriaInicial);
cargarCatalogo(categoriaInicial);
