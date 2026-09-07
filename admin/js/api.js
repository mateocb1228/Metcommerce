const API_BASE = 'http://localhost:3000/api';
const TOKEN_KEY   = 'mc_admin_token';
const USUARIO_KEY = 'mc_admin_usuario';

function guardarSesion(token, usuario) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
}

function obtenerToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function obtenerUsuario() {
    try {
        return JSON.parse(localStorage.getItem(USUARIO_KEY));
    } catch {
        return null;
    }
}

function cerrarSesion() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
    window.location.href = 'login.html';
}

// Llamar al inicio de cada página protegida (dashboard, productos, etc.)
function requerirSesion() {
    if (!obtenerToken()) {
        window.location.href = 'login.html';
    }
}

// Fetch con token de administrador. Redirige a login si la sesión expiró.
async function apiFetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = obtenerToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
        cerrarSesion();
        throw new Error('Sesión expirada');
    }

    let data = null;
    try { data = await res.json(); } catch { /* respuesta sin cuerpo */ }

    if (!res.ok) {
        throw new Error(data?.error || `Error del servidor (${res.status})`);
    }
    return data;
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

function formatoMoneda(valor) {
    return `$${parseFloat(valor || 0).toLocaleString('es-CO')}`;
}

function formatoFecha(fechaISO) {
    return new Date(fechaISO).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}
