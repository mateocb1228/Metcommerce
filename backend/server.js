const express = require('express');
const cors    = require('cors');
const path    = require('path');
const multer  = require('multer');
require('dotenv').config();

const productosRouter  = require('./routes/productos');
const pedidosRouter    = require('./routes/pedidos');
const inventarioRouter = require('./routes/inventario');
const authRouter       = require('./routes/auth');
const dashboardRouter  = require('./routes/dashboard');
const categoriasRouter = require('./routes/categorias');

const app = express();
app.use(cors());
app.use(express.json());

// Imágenes subidas desde el panel admin (colores de producto, imagen principal).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',       authRouter);
app.use('/api/dashboard',  dashboardRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/productos',  productosRouter);
app.use('/api/pedidos',    pedidosRouter);
app.use('/api/inventario', inventarioRouter);

app.get('/', (req, res) => {
    res.json({ api: 'MetCommerce', version: '1.0', estado: 'activo' });
});

// Manejador de errores centralizado: así una subida de imagen inválida (muy
// pesada, formato no permitido) responde JSON consistente en vez de la
// página de error HTML por defecto de Express.
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || /formato de imagen no permitido/i.test(err?.message || '')) {
        return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MetCommerce API corriendo en http://localhost:${PORT}`));
