// Agrega índices para acelerar las búsquedas más frecuentes en productos y
// pedidos (catálogo filtrado por categoría/activo, listado de pedidos
// filtrado por estado/fecha). Es idempotente: si un índice ya existe, lo
// detecta y no falla.
//
// Uso: node scripts/migrar-indices-busqueda.js
const db = require('../config/db');

const INDICES = [
    { tabla: 'productos', nombre: 'idx_productos_activo_nombre', sql: 'ALTER TABLE productos ADD INDEX idx_productos_activo_nombre (activo, nombre)' },
    { tabla: 'producto_imagenes', nombre: 'idx_producto_imagenes_producto_orden', sql: 'ALTER TABLE producto_imagenes ADD INDEX idx_producto_imagenes_producto_orden (id_producto, orden)' },
    { tabla: 'pedidos', nombre: 'idx_pedidos_estado', sql: 'ALTER TABLE pedidos ADD INDEX idx_pedidos_estado (estado)' },
    { tabla: 'pedidos', nombre: 'idx_pedidos_fecha_creacion', sql: 'ALTER TABLE pedidos ADD INDEX idx_pedidos_fecha_creacion (fecha_creacion)' },
];

async function indiceExiste(conn, tabla, nombre) {
    const [rows] = await conn.query(`
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
    `, [tabla, nombre]);
    return rows.length > 0;
}

async function main() {
    const conn = await db.getConnection();
    try {
        for (const { tabla, nombre, sql } of INDICES) {
            if (await indiceExiste(conn, tabla, nombre)) {
                console.log(`- ${nombre} ya existe. Nada que hacer.`);
                continue;
            }
            console.log(`- Creando ${nombre} en ${tabla}...`);
            await conn.query(sql);
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
