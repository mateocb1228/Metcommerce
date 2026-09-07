const jwt = require('jsonwebtoken');

// Protege rutas: exige un JWT válido en el header Authorization: Bearer <token>
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const [tipo, token] = header.split(' ');

    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
}

module.exports = { requireAuth };
