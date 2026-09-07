// Si ya hay sesión activa, saltar directo al dashboard
if (obtenerToken()) {
    window.location.href = 'dashboard.html';
}

const form        = document.getElementById('form-login');
const mensajeError = document.getElementById('mensaje-error');
const btnSubmit    = document.getElementById('btn-submit');

function mostrarError(texto) {
    mensajeError.textContent = texto;
    mensajeError.classList.add('visible');
}
function ocultarError() {
    mensajeError.classList.remove('visible');
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarError();

    const usuario  = document.getElementById('usuario').value.trim();
    const password = document.getElementById('password').value;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Ingresando...';

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password })
        });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'No se pudo iniciar sesión');
        }

        guardarSesion(data.token, data.usuario);
        window.location.href = 'dashboard.html';
    } catch (err) {
        mostrarError(err.message || 'No se pudo conectar al servidor. Verifica que el backend esté corriendo en localhost:3000.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Ingresar';
    }
});
