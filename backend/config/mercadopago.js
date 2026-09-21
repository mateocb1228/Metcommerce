const { MercadoPagoConfig } = require('mercadopago');

// El access token decide contra qué cuenta corre el pago: uno de "Credenciales
// de prueba" del panel de MercadoPago simula el cobro sin mover dinero real,
// uno de "Credenciales de producción" cobra de verdad. Ambos empiezan con
// APP_USR-, así que la diferencia está en cuál copiaste, no en el texto.
//
// No se valida acá (ni se lanza excepción) para que el servidor pueda
// arrancar igual aunque todavía no se haya configurado el .env; routes/pagos.js
// es quien rechaza la solicitud con un mensaje claro si falta el token.
const mpClient = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'sin-configurar'
});

module.exports = mpClient;
