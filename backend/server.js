const express = require('express');
const cors    = require('cors');
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

app.use('/api/auth',       authRouter);
app.use('/api/dashboard',  dashboardRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/productos',  productosRouter);
app.use('/api/pedidos',    pedidosRouter);
app.use('/api/inventario', inventarioRouter);

app.get('/', (req, res) => {
    res.json({ api: 'MetCommerce', version: '1.0', estado: 'activo' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MetCommerce API corriendo en http://localhost:${PORT}`));
