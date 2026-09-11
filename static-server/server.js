const express = require('express');
const path    = require('path');

const app = express();

app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Frontend/Admin de MetCommerce corriendo en el puerto ${PORT}`));
