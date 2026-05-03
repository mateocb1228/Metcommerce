const router = require('express').Router();
const db     = require('../config/db');

// GET /api/pedidos
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM pedidos ORDER BY fecha_creacion DESC'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pedidos/:id  (con items)
router.get('/:id', async (req, res) => {
    try {
        const [[pedido]] = await db.query('SELECT * FROM pedidos WHERE id=?', [req.params.id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

        const [items] = await db.query(`
            SELECT dp.*, p.nombre, p.imagen_url
            FROM detalle_pedidos dp
            JOIN productos p ON dp.id_producto = p.id
            WHERE dp.id_pedido = ?
        `, [req.params.id]);

        res.json({ ...pedido, items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pedidos
// Body: { cliente_nombre, cliente_telefono, items: [{ id_producto, cantidad }] }
router.post('/', async (req, res) => {
    const { cliente_nombre, cliente_telefono, items } = req.body;
    if (!cliente_nombre || !items?.length) {
        return res.status(400).json({ error: 'cliente_nombre e items son requeridos' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        let total = 0;
        const itemsDetalle = [];

        for (const item of items) {
            const [[producto]] = await conn.query(
                'SELECT precio FROM productos WHERE id=? AND activo=1', [item.id_producto]
            );
            if (!producto) throw new Error(`Producto ${item.id_producto} no encontrado`);

            const [[inv]] = await conn.query(
                'SELECT cantidad FROM inventario WHERE id_producto=?', [item.id_producto]
            );
            if (!inv || inv.cantidad < item.cantidad) {
                throw new Error(`Stock insuficiente para producto ${item.id_producto}`);
            }

            total += producto.precio * item.cantidad;
            itemsDetalle.push({ ...item, precio_unitario: producto.precio });
        }

        const [pedidoResult] = await conn.query(
            'INSERT INTO pedidos (cliente_nombre, cliente_telefono, total) VALUES (?, ?, ?)',
            [cliente_nombre, cliente_telefono, total]
        );
        const id_pedido = pedidoResult.insertId;

        for (const item of itemsDetalle) {
            await conn.query(
                'INSERT INTO detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
                [id_pedido, item.id_producto, item.cantidad, item.precio_unitario]
            );
            await conn.query(
                'UPDATE inventario SET cantidad = cantidad - ? WHERE id_producto=?',
                [item.cantidad, item.id_producto]
            );
        }

        await conn.commit();
        res.status(201).json({ id: id_pedido, total, mensaje: 'Pedido creado' });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// PUT /api/pedidos/:id/estado
router.put('/:id/estado', async (req, res) => {
    const { estado } = req.body;
    const validos = ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado'];
    if (!validos.includes(estado)) {
        return res.status(400).json({ error: `Estado inválido. Opciones: ${validos.join(', ')}` });
    }
    try {
        const [result] = await db.query(
            'UPDATE pedidos SET estado=? WHERE id=?', [estado, req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Pedido no encontrado' });
        res.json({ mensaje: 'Estado actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
