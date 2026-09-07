const router = require('express').Router();
const db     = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/dashboard/resumen — métricas para el panel de administración
router.get('/resumen', requireAuth, async (req, res) => {
    try {
        const [[totales]] = await db.query(`
            SELECT
                (SELECT COALESCE(SUM(total),0) FROM pedidos WHERE estado != 'cancelado') AS ventas_totales,
                (SELECT COUNT(*) FROM pedidos)                                           AS total_pedidos,
                (SELECT COUNT(*) FROM pedidos WHERE estado = 'pendiente')                AS pedidos_pendientes,
                (SELECT COUNT(*) FROM productos WHERE activo = 1)                        AS total_productos,
                (SELECT COUNT(*) FROM inventario i
                    JOIN productos p ON i.id_producto = p.id
                    WHERE i.cantidad <= i.stock_minimo AND p.activo = 1)                 AS productos_stock_bajo
        `);

        const [ultimosPedidos] = await db.query(`
            SELECT id, cliente_nombre, total, estado, fecha_creacion
            FROM pedidos
            ORDER BY fecha_creacion DESC
            LIMIT 5
        `);

        const [stockBajo] = await db.query(`
            SELECT p.id, p.nombre, i.cantidad, i.stock_minimo
            FROM inventario i
            JOIN productos p ON i.id_producto = p.id
            WHERE i.cantidad <= i.stock_minimo AND p.activo = 1
            ORDER BY i.cantidad ASC
            LIMIT 5
        `);

        res.json({ ...totales, ultimos_pedidos: ultimosPedidos, alertas_stock: stockBajo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
