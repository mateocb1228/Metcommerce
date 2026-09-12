// Agrega la columna pedidos.token (UUID) para que la página de confirmación
// del cliente deje de identificar el pedido por su id numérico (enumerable)
// y use en su lugar un token aleatorio.
//
// Es idempotente: si la columna ya existe y es NOT NULL, no hace nada.
//
// Uso: node scripts/migrar-token-pedidos.js
const crypto = require('crypto');
const db     = require('../config/db');

async function columnaTokenExiste(conn) {
    const [rows] = await conn.query(`
        SELECT IS_NULLABLE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'token'
    `);
    return rows[0] || null;
}

async function main() {
    const conn = await db.getConnection();
    try {
        const columna = await columnaTokenExiste(conn);
        if (columna && columna.IS_NULLABLE === 'NO') {
            console.log('La migración ya se aplicó antes (pedidos.token ya existe). Nada que hacer.');
            process.exit(0);
        }

        if (!columna) {
            console.log('1/3 Agregando columna token (nullable)...');
            await conn.query('ALTER TABLE pedidos ADD COLUMN token CHAR(36) NULL AFTER id');
        } else {
            console.log('1/3 La columna token ya existe (nullable). Continuando...');
        }

        console.log('2/3 Generando un token único para cada pedido existente...');
        const [pedidos] = await conn.query('SELECT id FROM pedidos WHERE token IS NULL');
        for (const { id } of pedidos) {
            await conn.query('UPDATE pedidos SET token=? WHERE id=?', [crypto.randomUUID(), id]);
        }
        console.log(`   ${pedidos.length} pedido(s) actualizados.`);

        console.log('3/3 Haciendo token obligatorio y único...');
        await conn.query('ALTER TABLE pedidos MODIFY token CHAR(36) NOT NULL');
        try {
            await conn.query('ALTER TABLE pedidos ADD UNIQUE KEY uq_pedidos_token (token)');
        } catch (err) {
            if (err.code !== 'ER_DUP_KEYNAME') throw err; // ya se había creado en un intento anterior
        }

        console.log('Migración completada correctamente.');
        process.exit(0);
    } catch (err) {
        console.error('Error en la migración:', err.message);
        process.exit(1);
    } finally {
        conn.release();
    }
}

main();
