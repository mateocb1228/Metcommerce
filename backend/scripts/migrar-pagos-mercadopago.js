// Agrega a pedidos las columnas necesarias para conciliar el pago con
// MercadoPago: el id de la preferencia (Checkout Pro) que se generó y el id
// del pago que confirmó el webhook. Sin esto no hay forma de saber, al
// recibir una notificación de pago, a qué pedido corresponde ni de evitar
// procesarla dos veces si MercadoPago la reenvía.
//
// Es idempotente: si las columnas ya existen, no hace nada.
//
// Uso: node scripts/migrar-pagos-mercadopago.js
const db = require('../config/db');

async function columnaExiste(conn, nombre) {
    const [rows] = await conn.query(`
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = ?
    `, [nombre]);
    return rows.length > 0;
}

async function main() {
    const conn = await db.getConnection();
    try {
        if (!(await columnaExiste(conn, 'mp_preference_id'))) {
            console.log('1/2 Agregando columna mp_preference_id...');
            await conn.query('ALTER TABLE pedidos ADD COLUMN mp_preference_id VARCHAR(64) NULL AFTER estado');
        } else {
            console.log('1/2 mp_preference_id ya existe. Continuando...');
        }

        if (!(await columnaExiste(conn, 'mp_payment_id'))) {
            console.log('2/2 Agregando columna mp_payment_id...');
            await conn.query('ALTER TABLE pedidos ADD COLUMN mp_payment_id VARCHAR(64) NULL AFTER mp_preference_id');
        } else {
            console.log('2/2 mp_payment_id ya existe. Continuando...');
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
