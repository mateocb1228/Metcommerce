const router = require('express').Router();
const db     = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/productos?categoria=Hombre|Mujer  (catálogo, con colores para el swatch de la tarjeta)
router.get('/', async (req, res) => {
    try {
        const { categoria } = req.query;
        let where = 'WHERE p.activo = 1';
        const params = [];
        if (categoria) {
            where += ' AND LOWER(c.nombre) = LOWER(?)';
            params.push(categoria);
        }

        const [productos] = await db.query(`
            SELECT p.*, c.nombre AS categoria, COALESCE(i.cantidad, 0) AS stock
            FROM productos p
            LEFT JOIN categorias c ON p.id_categoria = c.id
            LEFT JOIN inventario i ON p.id = i.id_producto
            ${where}
            ORDER BY p.nombre ASC
        `, params);

        if (!productos.length) return res.json([]);

        const ids = productos.map(p => p.id);
        const [colores] = await db.query(
            'SELECT id, id_producto, nombre, color_hex FROM producto_colores WHERE id_producto IN (?) ORDER BY orden ASC',
            [ids]
        );
        const [portadas] = await db.query(
            'SELECT id_color, imagen_url FROM producto_imagenes WHERE orden = 0 AND id_producto IN (?)',
            [ids]
        );
        const portadaPorColor = {};
        portadas.forEach(im => { portadaPorColor[im.id_color] = im.imagen_url; });

        const coloresPorProducto = {};
        colores.forEach(c => {
            if (!coloresPorProducto[c.id_producto]) coloresPorProducto[c.id_producto] = [];
            coloresPorProducto[c.id_producto].push({
                id: c.id, nombre: c.nombre, hex: c.color_hex, imagen_url: portadaPorColor[c.id] || null
            });
        });

        res.json(productos.map(p => ({ ...p, colores: coloresPorProducto[p.id] || [] })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/productos/:id  (detalle completo: colores con su galería de imágenes y tallas con stock)
router.get('/:id', async (req, res) => {
    try {
        const [[producto]] = await db.query(`
            SELECT p.*, c.nombre AS categoria, COALESCE(i.cantidad, 0) AS stock
            FROM productos p
            LEFT JOIN categorias c ON p.id_categoria = c.id
            LEFT JOIN inventario i ON p.id = i.id_producto
            WHERE p.id = ? AND p.activo = 1
        `, [req.params.id]);
        if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

        const [colores] = await db.query(
            'SELECT id, nombre, color_hex FROM producto_colores WHERE id_producto = ? ORDER BY orden ASC',
            [req.params.id]
        );
        const [imagenes] = await db.query(
            'SELECT id_color, imagen_url FROM producto_imagenes WHERE id_producto = ? ORDER BY orden ASC',
            [req.params.id]
        );
        const [tallas] = await db.query(
            'SELECT talla, stock FROM producto_tallas WHERE id_producto = ? ORDER BY talla ASC',
            [req.params.id]
        );

        const coloresConImagenes = colores.map(c => ({
            id: c.id,
            nombre: c.nombre,
            hex: c.color_hex,
            imagenes: imagenes.filter(im => im.id_color === c.id).map(im => im.imagen_url)
        }));

        res.json({ ...producto, colores: coloresConImagenes, tallas });
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
