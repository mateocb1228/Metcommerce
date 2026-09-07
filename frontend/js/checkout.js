const carrito = obtenerCarrito();

// Sin productos en el carrito no hay nada que pagar: se redirige de vuelta.
if (!carrito.length) {
    window.location.href = 'carrito.html';
}

renderizarResumen();

function renderizarResumen() {
    const contenedor = document.getElementById('resumen-items');
    contenedor.innerHTML = carrito.map(item => {
        const variante = [item.color, item.talla ? `Talla ${item.talla}` : null].filter(Boolean).join(' · ');
        return `
        <div class="resumen-mini-item">
            <span class="resumen-mini-nombre">
                ${escapeHtml(item.nombre)} × ${item.cantidad}
                ${variante ? `<span class="variante">${escapeHtml(variante)}</span>` : ''}
            </span>
            <span>${formatoMoneda(item.precio * item.cantidad)}</span>
        </div>
    `;
    }).join('');
    document.getElementById('resumen-total-valor').textContent = formatoMoneda(calcularTotalCarrito(carrito));
}

// ===== VALIDACIÓN =====
const REGEX_TELEFONO = /^[0-9+()\-\s]{7,20}$/;

function validarFormulario() {
    let valido = true;

    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const direccion = document.getElementById('direccion').value.trim();

    valido = marcarCampo('nombre', 'error-nombre',
        nombre.length >= 3 && nombre.length <= 150,
        'Ingresa tu nombre completo (mínimo 3 caracteres).') && valido;

    valido = marcarCampo('telefono', 'error-telefono',
        REGEX_TELEFONO.test(telefono),
        'Ingresa un teléfono válido (solo números, mínimo 7 dígitos).') && valido;

    valido = marcarCampo('direccion', 'error-direccion',
        direccion.length >= 5 && direccion.length <= 255,
        'Ingresa una dirección de entrega (mínimo 5 caracteres).') && valido;

    return valido ? { nombre, telefono, direccion } : null;
}

function marcarCampo(idCampo, idError, esValido, mensaje) {
    const campo = document.getElementById(idCampo);
    const error = document.getElementById(idError);
    campo.classList.toggle('invalido', !esValido);
    error.textContent = esValido ? '' : mensaje;
    error.classList.toggle('visible', !esValido);
    return esValido;
}

// ===== ENVÍO =====
const form = document.getElementById('form-checkout');
const btnConfirmar = document.getElementById('btn-confirmar');
const bannerError = document.getElementById('banner-error');

function mostrarError(mensaje) {
    bannerError.textContent = mensaje;
    bannerError.classList.add('visible');
}
function ocultarError() {
    bannerError.classList.remove('visible');
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarError();

    const datos = validarFormulario();
    if (!datos) return;

    if (!carrito.length) {
        window.location.href = 'carrito.html';
        return;
    }

    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Procesando...';

    const pedido = {
        cliente_nombre: datos.nombre,
        cliente_telefono: datos.telefono,
        cliente_direccion: datos.direccion,
        items: carrito.map(item => ({
            id_producto: item.id,
            cantidad: item.cantidad,
            talla: item.talla ?? null,
            color: item.color ?? null
        }))
    };

    try {
        const res = await fetch(`${API}/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedido)
        });

        let data = null;
        try { data = await res.json(); } catch { /* sin cuerpo */ }

        if (!res.ok) {
            const mensaje = data?.error || `No se pudo procesar el pedido (${res.status}).`;
            throw new Error(mensaje);
        }

        vaciarCarrito();
        window.location.href = `confirmacion.html?id=${data.id}`;
    } catch (err) {
        if (err instanceof TypeError) {
            // fetch lanza TypeError cuando el servidor no responde (caído, sin red, CORS)
            mostrarError('No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.');
        } else {
            mostrarError(err.message);
        }
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar pedido';
    }
});
