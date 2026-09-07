// Crea o actualiza un usuario del panel de administración.
// Uso: node scripts/crear-admin.js <usuario> <password> ["Nombre completo"]
const bcrypt = require('bcryptjs');
const db     = require('../config/db');

async function main() {
    const [usuario, password, nombreCompleto] = process.argv.slice(2);

    if (!usuario || !password) {
        console.error('Uso: node scripts/crear-admin.js <usuario> <password> ["Nombre completo"]');
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('La contraseña debe tener al menos 8 caracteres.');
        process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);

    await db.query(
        `INSERT INTO usuarios (nombre_usuario, password_hash, nombre_completo, rol)
         VALUES (?, ?, ?, 'admin')
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), nombre_completo = VALUES(nombre_completo), activo = 1`,
        [usuario, hash, nombreCompleto || usuario]
    );

    console.log(`Usuario administrador "${usuario}" creado/actualizado correctamente.`);
    process.exit(0);
}

main().catch(err => {
    console.error('Error creando el usuario:', err.message);
    process.exit(1);
});
