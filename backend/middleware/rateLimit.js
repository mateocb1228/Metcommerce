// Limitador de solicitudes en memoria, por IP. Mismo enfoque que el bloqueo
// de intentos fallidos de login (suficiente para un solo servidor): no hace
// falta una dependencia externa ni un almacén compartido como Redis.
//
// Sirve para proteger endpoints públicos que hacen escrituras costosas
// (por ejemplo, crear pedidos, que descuenta stock real) de scripts que
// automaticen solicitudes para agotar inventario o llenar la base de datos
// de basura.
function crearLimitador({ ventanaMs, maxSolicitudes, mensaje }) {
    const solicitudesPorIp = new Map(); // ip -> { conteo, inicioVentana }

    // Evita que el Map crezca sin límite con IPs que ya no vuelven a pedir.
    setInterval(() => {
        const ahora = Date.now();
        for (const [ip, registro] of solicitudesPorIp) {
            if (ahora - registro.inicioVentana > ventanaMs) solicitudesPorIp.delete(ip);
        }
    }, ventanaMs).unref();

    return function limitador(req, res, next) {
        const ip = req.ip;
        const ahora = Date.now();
        const registro = solicitudesPorIp.get(ip);

        if (!registro || ahora - registro.inicioVentana > ventanaMs) {
            solicitudesPorIp.set(ip, { conteo: 1, inicioVentana: ahora });
            return next();
        }

        registro.conteo++;
        if (registro.conteo > maxSolicitudes) {
            return res.status(429).json({ error: mensaje });
        }
        next();
    };
}

module.exports = { crearLimitador };
