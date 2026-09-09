const router = require('express').Router();
const fs     = require('fs');
const path   = require('path');
const db     = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { uploadImagenProducto, urlArchivo } = require('../middleware/upload');

const REGEX_HEX = /^#[0-9A-Fa-f]{6}$/;
const TALLA_MIN = 35;
const TALLA_MAX = 44;

// inventario.cantidad es el total agregado por producto (suma de todas las
// combinaciones color+talla). Se recalcula acá cada vez que cambian tallas o
// se borra un color, para que el admin y el dashboard nunca muestren un
// número desincronizado del desglose real.
async function sincronizarInventario(conn, idProducto) {
    await conn.query('UPDATE inventario SET cantidad=0 WHERE id_producto=?', [idProducto]);
    await conn.query(`
        UPDATE inventario i
        JOIN (SELECT id_producto, SUM(stock) AS total FROM producto_tallas WHERE id_producto=? GROUP BY id_producto) t
          ON t.id_producto = i.id_producto
        SET i.cantidad = t.total
        WHERE i.id_producto = ?
    `, [idProducto, idProducto]);
}

// Borra el archivo del disco si la URL apunta a nuestra carpeta de uploads.
// Es "best effort": si la imagen es una URL externa o el archivo ya no
// existe, simplemente no hace nada (no debe romper la respuesta de la API).
function borrarArchivoSiEsLocal(url) {
    const match = /\/uploads\/productos\/([^/?#]+)$/.exec(url || '');
    if (!match) return;
    const ruta = path.join(__dirname, '..', 'uploads', 'productos', match[1]);
    fs.unlink(ruta, () => {});
}

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

// GET /api/productos/:id  (detalle completo: cada color trae su galería de
// imágenes y su propio desglose de tallas con stock independiente)
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
            'SELECT id, nombre, color_hex, orden FROM producto_colores WHERE id_producto = ? ORDER BY orden ASC',
            [req.params.id]
        );
        const [imagenes] = await db.query(
            'SELECT id, id_color, imagen_url, orden FROM producto_imagenes WHERE id_producto = ? ORDER BY orden ASC',
            [req.params.id]
        );
        const [tallas] = await db.query(
            'SELECT id_color, talla, stock FROM producto_tallas WHERE id_producto = ? ORDER BY talla ASC',
            [req.params.id]
        );

        const coloresConDetalle = colores.map(c => ({
            id: c.id,
            nombre: c.nombre,
            hex: c.color_hex,
            imagenes: imagenes.filter(im => im.id_color === c.id).map(im => ({ id: im.id, url: im.imagen_url })),
            tallas: tallas.filter(t => t.id_color === c.id).map(({ talla, stock }) => ({ talla, stock }))
        }));

        res.json({ ...producto, colores: coloresConDetalle });
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
    if (!nombre || precio === undefined) {
        return res.status(400).json({ error: 'nombre y precio son requeridos' });
    }
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

// POST /api/productos/:id/imagen  (multipart, campo "imagen") — imagen principal del producto
router.post('/:id/imagen', requireAuth, uploadImagenProducto.single('imagen'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen (campo "imagen").' });
    try {
        const url = urlArchivo(req, req.file.filename);
        const [result] = await db.query(
            'UPDATE productos SET imagen_url=? WHERE id=? AND activo=1', [url, req.params.id]
        );
        if (!result.affectedRows) {
            borrarArchivoSiEsLocal(url);
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ imagen_url: url, mensaje: 'Imagen principal actualizada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===================== COLORES =====================

// POST /api/productos/:id/colores
router.post('/:id/colores', requireAuth, async (req, res) => {
    const nombre = (req.body.nombre || '').trim();
    const color_hex = req.body.color_hex || '';
    if (!nombre || nombre.length > 50 || !REGEX_HEX.test(color_hex)) {
        return res.status(400).json({ error: 'nombre (máx. 50 caracteres) y color_hex (formato #RRGGBB) son requeridos' });
    }
    try {
        const [[producto]] = await db.query('SELECT id FROM productos WHERE id=? AND activo=1', [req.params.id]);
        if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

        const [[{ siguienteOrden }]] = await db.query(
            'SELECT COALESCE(MAX(orden), -1) + 1 AS siguienteOrden FROM producto_colores WHERE id_producto=?',
            [req.params.id]
        );
        const [result] = await db.query(
            'INSERT INTO producto_colores (id_producto, nombre, color_hex, orden) VALUES (?, ?, ?, ?)',
            [req.params.id, nombre, color_hex, siguienteOrden]
        );
        res.status(201).json({ id: result.insertId, nombre, hex: color_hex, orden: siguienteOrden, imagenes: [], tallas: [], mensaje: 'Color creado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/productos/:id/colores/:idColor
router.put('/:id/colores/:idColor', requireAuth, async (req, res) => {
    const nombre = (req.body.nombre || '').trim();
    const color_hex = req.body.color_hex || '';
    if (!nombre || nombre.length > 50 || !REGEX_HEX.test(color_hex)) {
        return res.status(400).json({ error: 'nombre (máx. 50 caracteres) y color_hex (formato #RRGGBB) son requeridos' });
    }
    try {
        const [result] = await db.query(
            'UPDATE producto_colores SET nombre=?, color_hex=? WHERE id=? AND id_producto=?',
            [nombre, color_hex, req.params.idColor, req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Color no encontrado para este producto' });
        res.json({ mensaje: 'Color actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/productos/:id/colores/:idColor
// Borra en cascada sus imágenes y su stock por talla (producto_imagenes y
// producto_tallas referencian a producto_colores con ON DELETE CASCADE).
router.delete('/:id/colores/:idColor', requireAuth, async (req, res) => {
    const conn = await db.getConnection();
    try {
        const [imagenes] = await conn.query(
            'SELECT imagen_url FROM producto_imagenes WHERE id_color=? AND id_producto=?',
            [req.params.idColor, req.params.id]
        );

        await conn.beginTransaction();
        const [result] = await conn.query(
            'DELETE FROM producto_colores WHERE id=? AND id_producto=?',
            [req.params.idColor, req.params.id]
        );
        if (!result.affectedRows) {
            await conn.rollback();
            return res.status(404).json({ error: 'Color no encontrado para este producto' });
        }
        await sincronizarInventario(conn, req.params.id);
        await conn.commit();

        imagenes.forEach(im => borrarArchivoSiEsLocal(im.imagen_url));
        res.json({ mensaje: 'Color eliminado' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ===================== IMÁGENES DE COLOR =====================

// POST /api/productos/:id/colores/:idColor/imagenes  (multipart, campo "imagen")
router.post('/:id/colores/:idColor/imagenes', requireAuth, uploadImagenProducto.single('imagen'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen (campo "imagen").' });
    try {
        const [[color]] = await db.query(
            'SELECT id FROM producto_colores WHERE id=? AND id_producto=?', [req.params.idColor, req.params.id]
        );
        if (!color) {
            borrarArchivoSiEsLocal(urlArchivo(req, req.file.filename));
            return res.status(404).json({ error: 'Color no encontrado para este producto' });
        }

        const [[{ siguienteOrden }]] = await db.query(
            'SELECT COALESCE(MAX(orden), -1) + 1 AS siguienteOrden FROM producto_imagenes WHERE id_color=?',
            [req.params.idColor]
        );
        const url = urlArchivo(req, req.file.filename);
        const [result] = await db.query(
            'INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES (?, ?, ?, ?)',
            [req.params.id, req.params.idColor, url, siguienteOrden]
        );
        res.status(201).json({ id: result.insertId, url, orden: siguienteOrden, mensaje: 'Imagen agregada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/productos/:id/colores/:idColor/imagenes/:idImagen
router.delete('/:id/colores/:idColor/imagenes/:idImagen', requireAuth, async (req, res) => {
    try {
        const [[imagen]] = await db.query(
            'SELECT imagen_url FROM producto_imagenes WHERE id=? AND id_color=? AND id_producto=?',
            [req.params.idImagen, req.params.idColor, req.params.id]
        );
        if (!imagen) return res.status(404).json({ error: 'Imagen no encontrada' });

        await db.query('DELETE FROM producto_imagenes WHERE id=?', [req.params.idImagen]);
        borrarArchivoSiEsLocal(imagen.imagen_url);
        res.json({ mensaje: 'Imagen eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===================== TALLAS POR COLOR =====================

// PUT /api/productos/:id/colores/:idColor/tallas
// Body: { tallas: [{ talla, stock }, ...] }  — tallas 35 a 44, se guardan todas
// de una vez (upsert) y el total agregado del producto se recalcula al final.
router.put('/:id/colores/:idColor/tallas', requireAuth, async (req, res) => {
    const { tallas } = req.body;
    if (!Array.isArray(tallas) || !tallas.length) {
        return res.status(400).json({ error: 'tallas debe ser un arreglo con al menos un elemento' });
    }
    const tallasValidas = tallas.every(t =>
        Number.isInteger(t?.talla) && t.talla >= TALLA_MIN && t.talla <= TALLA_MAX &&
        Number.isInteger(t?.stock) && t.stock >= 0
    );
    if (!tallasValidas) {
        return res.status(400).json({ error: `Cada talla debe ser un entero entre ${TALLA_MIN} y ${TALLA_MAX}, con stock entero >= 0` });
    }

    const conn = await db.getConnection();
    try {
        const [[color]] = await conn.query(
            'SELECT id FROM producto_colores WHERE id=? AND id_producto=?', [req.params.idColor, req.params.id]
        );
        if (!color) return res.status(404).json({ error: 'Color no encontrado para este producto' });

        await conn.beginTransaction();
        for (const t of tallas) {
            await conn.query(
                `INSERT INTO producto_tallas (id_producto, id_color, talla, stock) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
                [req.params.id, req.params.idColor, t.talla, t.stock]
            );
        }
        await sincronizarInventario(conn, req.params.id);
        await conn.commit();
        res.json({ mensaje: 'Tallas actualizadas' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
