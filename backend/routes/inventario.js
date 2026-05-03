const router = require('express').Router();
const db     = require('../config/db');

// GET /api/inventario  (todo el inventario, alertas primero)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT i.*, p.nombre, p.precio,
                   (i.cantidad <= i.stock_minimo) AS alerta_stock
            FROM inventario i
            JOIN productos p ON i.id_producto = p.id
            WHERE p.activo = 1
            ORDER BY alerta_stock DESC, p.nombre ASC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inventario/alertas  (solo productos con stock bajo)
router.get('/alertas', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT i.*, p.nombre, p.precio
            FROM inventario i
            JOIN productos p ON i.id_producto = p.id
            WHERE i.cantidad <= i.stock_minimo AND p.activo = 1
            ORDER BY i.cantidad ASC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inventario/:id_producto
router.get('/:id_producto', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT i.*, p.nombre FROM inventario i
             JOIN productos p ON i.id_producto = p.id
             WHERE i.id_producto = ?`,
            [req.params.id_producto]
        );
        if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado en inventario' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/inventario/:id_producto
// Body: { cantidad, stock_minimo? }
router.put('/:id_producto', async (req, res) => {
    const { cantidad, stock_minimo } = req.body;
    if (cantidad === undefined) return res.status(400).json({ error: 'cantidad es requerida' });

    try {
        let query, valores;
        if (stock_minimo !== undefined) {
            query  = 'UPDATE inventario SET cantidad=?, stock_minimo=? WHERE id_producto=?';
            valores = [cantidad, stock_minimo, req.params.id_producto];
        } else {
            query  = 'UPDATE inventario SET cantidad=? WHERE id_producto=?';
            valores = [cantidad, req.params.id_producto];
        }
        const [result] = await db.query(query, valores);
        if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado en inventario' });
        res.json({ mensaje: 'Inventario actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
