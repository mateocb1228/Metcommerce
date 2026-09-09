const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const DIR_DESTINO = path.join(__dirname, '..', 'uploads', 'productos');
fs.mkdirSync(DIR_DESTINO, { recursive: true });

// La extensión sale de una lista fija según el mimetype detectado, nunca del
// nombre de archivo que manda el cliente: así no se puede subir algo como
// "foto.jpg.exe" ni depender de un nombre de archivo arbitrario en disco.
const EXTENSION_POR_TIPO = {
    'image/jpeg':    '.jpg',
    'image/png':     '.png',
    'image/webp':    '.webp',
    'image/gif':     '.gif',
    'image/svg+xml': '.svg'
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIR_DESTINO),
    filename: (req, file, cb) => {
        const ext = EXTENSION_POR_TIPO[file.mimetype] || '';
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    }
});

const uploadImagenProducto = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (!EXTENSION_POR_TIPO[file.mimetype]) {
            return cb(new Error('Formato de imagen no permitido. Usa JPG, PNG, WEBP, GIF o SVG.'));
        }
        cb(null, true);
    }
});

// Construye la URL pública absoluta de un archivo ya guardado en /uploads,
// usando el host con el que el cliente llamó a la API (funciona igual en
// localhost que detrás de un dominio real, sin hardcodear nada).
function urlArchivo(req, filename) {
    return `${req.protocol}://${req.get('host')}/uploads/productos/${filename}`;
}

module.exports = { uploadImagenProducto, urlArchivo };
