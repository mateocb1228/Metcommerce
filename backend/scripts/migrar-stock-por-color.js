// Migra producto_tallas de "stock por producto+talla" (compartido entre
// colores) a "stock por producto+color+talla" (independiente por color).
//
// Es idempotente: si ya se corrió antes (la columna id_color ya existe y es
// NOT NULL), lo detecta y no hace nada.
//
// Uso: node scripts/migrar-stock-por-color.js
const db = require('../config/db');

async function columnaIdColorExiste(conn) {
    const [rows] = await conn.query(`
        SELECT IS_NULLABLE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'producto_tallas' AND COLUMN_NAME = 'id_color'
    `);
    return rows[0] || null;
}

async function main() {
    const conn = await db.getConnection();
    try {
        const columna = await columnaIdColorExiste(conn);
        if (columna && columna.IS_NULLABLE === 'NO') {
            console.log('La migración ya se aplicó antes (producto_tallas.id_color ya existe). Nada que hacer.');
            process.exit(0);
        }

        await conn.beginTransaction();

        if (!columna) {
            console.log('1/6 Agregando columna id_color (nullable)...');
            await conn.query('ALTER TABLE producto_tallas ADD COLUMN id_color INT NULL AFTER id_producto');
        } else {
            console.log('1/6 La columna id_color ya existe (nullable). Continuando...');
        }

        console.log('2/6 Preparando índices (la FK de id_producto necesita uno vigente en todo momento)...');
        // No se puede quitar uq_producto_talla directamente: es el único índice
        // que empieza por id_producto y la FK hacia productos lo necesita. Primero
        // se crea la llave única nueva (también empieza por id_producto, así que
        // sirve de respaldo a esa FK) y recién ahí se quita la vieja.
        try {
            await conn.query('ALTER TABLE producto_tallas ADD UNIQUE KEY uq_producto_color_talla (id_producto, id_color, talla)');
        } catch (err) {
            if (err.code !== 'ER_DUP_KEYNAME') throw err; // ya se había creado en un intento anterior
        }
        try {
            await conn.query('ALTER TABLE producto_tallas DROP INDEX uq_producto_talla');
        } catch (err) {
            if (err.code !== 'ER_CANT_DROP_FIELD_OR_KEY') throw err; // ya se había quitado en un intento anterior
        }

        console.log('3/6 Duplicando el stock existente hacia cada color del producto...');
        // El stock original era único por producto+talla (compartido entre colores).
        // No hay forma de recuperar un desglose real por color que nunca se guardó,
        // así que se usa ese mismo número como valor de partida para CADA color;
        // el administrador debe ajustar los valores reales por color después.
        const [ins] = await conn.query(`
            INSERT INTO producto_tallas (id_producto, id_color, talla, stock)
            SELECT pt.id_producto, pc.id, pt.talla, pt.stock
            FROM producto_tallas pt
            JOIN producto_colores pc ON pc.id_producto = pt.id_producto
            WHERE pt.id_color IS NULL
        `);
        console.log(`   ${ins.affectedRows} filas nuevas (una por color).`);

        console.log('4/6 Eliminando las filas antiguas sin color...');
        const [del] = await conn.query('DELETE FROM producto_tallas WHERE id_color IS NULL');
        console.log(`   ${del.affectedRows} filas antiguas eliminadas.`);

        console.log('5/6 Haciendo id_color obligatoria y agregando su llave foránea...');
        await conn.query('ALTER TABLE producto_tallas MODIFY id_color INT NOT NULL');
        await conn.query(`
            ALTER TABLE producto_tallas
            ADD CONSTRAINT fk_producto_tallas_color FOREIGN KEY (id_color) REFERENCES producto_colores(id) ON DELETE CASCADE
        `);

        console.log('6/6 Recalculando inventario.cantidad como la suma real por producto...');
        await conn.query(`
            UPDATE inventario i
            JOIN (SELECT id_producto, SUM(stock) AS total FROM producto_tallas GROUP BY id_producto) t
              ON t.id_producto = i.id_producto
            SET i.cantidad = t.total
        `);

        await conn.commit();
        console.log('Migración completada correctamente.');
        process.exit(0);
    } catch (err) {
        await conn.rollback();
        console.error('Error en la migración, se revirtió todo:', err.message);
        process.exit(1);
    } finally {
        conn.release();
    }
}

main();
