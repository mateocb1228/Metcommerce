const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Protección básica contra fuerza bruta: bloquea un usuario tras varios
// intentos fallidos seguidos. Se guarda en memoria (suficiente para un
// panel de administración de un solo servidor).
const MAX_INTENTOS   = 5;
const BLOQUEO_MS     = 5 * 60 * 1000; // 5 minutos
const intentosFallidos = new Map(); // nombre_usuario -> { intentos, bloqueadoHasta }

function estaBloqueado(usuario) {
    const registro = intentosFallidos.get(usuario);
    if (!registro) return false;
    if (registro.bloqueadoHasta && registro.bloqueadoHasta > Date.now()) return true;
    if (registro.bloqueadoHasta && registro.bloqueadoHasta <= Date.now()) {
        intentosFallidos.delete(usuario);
    }
    return false;
}

function registrarFallo(usuario) {
    const registro = intentosFallidos.get(usuario) || { intentos: 0, bloqueadoHasta: null };
    registro.intentos++;
    if (registro.intentos >= MAX_INTENTOS) {
        registro.bloqueadoHasta = Date.now() + BLOQUEO_MS;
    }
    intentosFallidos.set(usuario, registro);
}

function limpiarIntentos(usuario) {
    intentosFallidos.delete(usuario);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
        return res.status(400).json({ error: 'usuario y password son requeridos' });
    }

    if (estaBloqueado(usuario)) {
        return res.status(429).json({ error: 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.' });
    }

    try {
        const [rows] = await db.query(
            'SELECT * FROM usuarios WHERE nombre_usuario = ? AND activo = 1',
            [usuario]
        );
        const cuenta = rows[0];

        // Se compara siempre contra un hash (real o dummy) para no filtrar,
        // por temporización, si el usuario existe o no.
        const hash = cuenta ? cuenta.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinva';
        const passwordValido = await bcrypt.compare(password, hash);

        if (!cuenta || !passwordValido) {
            registrarFallo(usuario);
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        limpiarIntentos(usuario);

        const token = jwt.sign(
            { id: cuenta.id, usuario: cuenta.nombre_usuario, rol: cuenta.rol },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        res.json({
            token,
            usuario: {
                id: cuenta.id,
                usuario: cuenta.nombre_usuario,
                nombre_completo: cuenta.nombre_completo,
                rol: cuenta.rol
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/me — permite al panel validar que la sesión sigue activa
router.get('/me', requireAuth, (req, res) => {
    res.json({ usuario: req.usuario });
});

module.exports = router;
