const router = require('express').Router();
const db     = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/productos
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, c.nombre AS categoria, i.cantidad AS stock
            FROM productos p
            LEFT JOIN categorias c  ON p.id_categoria = c.id
            LEFT JOIN inventario i  ON p.id = i.id_producto
            WHERE p.activo = 1
            ORDER BY p.nombre ASC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/productos/:id
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, c.nombre AS categoria, i.cantidad AS stock
            FROM productos p
            LEFT JOIN categorias c  ON p.id_categoria = c.id
            LEFT JOIN inventario i  ON p.id = i.id_producto
            WHERE p.id = ? AND p.activo = 1
        `, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/productos
router.post('/', requireAuth, async (req, res) => {
    const { nombre, descripcion, precio, imagen_url, id_categoria, stock_inicial = 0 } = req.body;
    if (!nombre || precio === undefined) {
        return res.status(400).json({ error: 'nombre y precio son requeridos' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query(
            'INSERT INTO productos (nombre, descripcion, precio, imagen_url, id_categoria) VALUES (?, ?, ?, ?, ?)',
            [nombre, descripcion, precio, imagen_url, id_categoria]
        );
        await conn.query(
            'INSERT INTO inventario (id_producto, cantidad) VALUES (?, ?)',
            [result.insertId, stock_inicial]
        );
        await conn.commit();
        res.status(201).json({ id: result.insertId, mensaje: 'Producto creado' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// PUT /api/productos/:id
router.put('/:id', requireAuth, async (req, res) => {
    const { nombre, descripcion, precio, imagen_url, id_categoria } = req.body;
    try {
        const [result] = await db.query(
            'UPDATE productos SET nombre=?, descripcion=?, precio=?, imagen_url=?, id_categoria=? WHERE id=? AND activo=1',
            [nombre, descripcion, precio, imagen_url, id_categoria, req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ mensaje: 'Producto actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/productos/:id  (soft delete — no borra de la BD)
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE productos SET activo=0 WHERE id=?', [req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ mensaje: 'Producto eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
