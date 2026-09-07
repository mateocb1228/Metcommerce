async function cargarNovedades() {
    const grid = document.getElementById('grid-productos');
    try {
        const res = await fetch(`${API}/productos`);
        if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
        const productos = await res.json();
        renderizarGridProductos(grid, productos.slice(0, 4));
    } catch (err) {
        grid.innerHTML = `
            <p class="msg-error">
                No se pudo conectar al servidor.<br>
                Asegúrate de que el backend está corriendo en <strong>localhost:3000</strong>.
            </p>`;
        console.error(err);
    }
}

cargarNovedades();
