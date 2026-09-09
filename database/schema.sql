-- MetCommerce — Esquema de base de datos (tienda de zapatos)
-- Ejecutar en MySQL: mysql --default-character-set=utf8mb4 -u root -p < schema.sql
-- (sin --default-character-set=utf8mb4 el cliente de mysql en Windows suele usar
-- otra codificación por defecto y corrompe las tildes de los datos de prueba)

CREATE DATABASE IF NOT EXISTS metcommerce
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_spanish_ci;

USE metcommerce;

-- Categorías = género (Hombre / Mujer)
CREATE TABLE categorias (
    id     INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE productos (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(200)    NOT NULL,
    descripcion    TEXT,
    precio         DECIMAL(12,2)   NOT NULL,
    imagen_url     VARCHAR(500),
    id_categoria   INT,
    activo         TINYINT(1)      DEFAULT 1,
    fecha_creacion TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id) ON DELETE SET NULL
);

-- Colores disponibles por producto (cada uno con su propio swatch)
CREATE TABLE producto_colores (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    id_producto  INT NOT NULL,
    nombre       VARCHAR(50) NOT NULL,
    color_hex    VARCHAR(7) NOT NULL,
    orden        INT DEFAULT 0,
    FOREIGN KEY (id_producto) REFERENCES productos(id) ON DELETE CASCADE
);

-- Galería de imágenes: cada imagen pertenece a un color específico del producto
CREATE TABLE producto_imagenes (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    id_producto  INT NOT NULL,
    id_color     INT NOT NULL,
    imagen_url   VARCHAR(500) NOT NULL,
    orden        INT DEFAULT 0,
    FOREIGN KEY (id_producto) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY (id_color) REFERENCES producto_colores(id) ON DELETE CASCADE
);

-- Stock por talla (35 a 44), independiente por color: el mismo zapato en
-- negro y en blanco llevan cada uno su propio stock por talla. Es la fuente
-- de verdad del inventario real; inventario.cantidad se mantiene como el
-- total agregado (suma de todas las combinaciones color+talla) para no
-- romper el dashboard/admin existente, que consulta por producto.
CREATE TABLE producto_tallas (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    id_producto  INT NOT NULL,
    id_color     INT NOT NULL,
    talla        INT NOT NULL,
    stock        INT DEFAULT 0,
    FOREIGN KEY (id_producto) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY (id_color) REFERENCES producto_colores(id) ON DELETE CASCADE,
    UNIQUE KEY uq_producto_color_talla (id_producto, id_color, talla)
);

CREATE TABLE inventario (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    id_producto          INT NOT NULL UNIQUE,
    cantidad             INT DEFAULT 0,
    stock_minimo         INT DEFAULT 5,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_producto) REFERENCES productos(id) ON DELETE CASCADE
);

CREATE TABLE pedidos (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    cliente_nombre    VARCHAR(200)  NOT NULL,
    cliente_telefono  VARCHAR(20),
    cliente_direccion VARCHAR(255),
    total             DECIMAL(12,2) NOT NULL,
    estado            ENUM('pendiente','confirmado','enviado','entregado','cancelado') DEFAULT 'pendiente',
    fecha_creacion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE detalle_pedidos (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido        INT           NOT NULL,
    id_producto      INT           NOT NULL,
    talla            INT,
    color            VARCHAR(50),
    cantidad         INT           NOT NULL,
    precio_unitario  DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (id_pedido)   REFERENCES pedidos(id)   ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES productos(id)
);

-- Usuarios del panel de administración (no confundir con clientes)
CREATE TABLE usuarios (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre_usuario  VARCHAR(50)   NOT NULL UNIQUE,
    password_hash   VARCHAR(255)  NOT NULL,
    nombre_completo VARCHAR(150),
    rol             ENUM('admin','editor') DEFAULT 'admin',
    activo          TINYINT(1)    DEFAULT 1,
    fecha_creacion  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
-- Los usuarios se crean con backend/scripts/crear-admin.js (genera el hash de la contraseña).

-- ===================== DATOS DE PRUEBA =====================
-- Tienda de zapatos: 4 productos de hombre y 4 de mujer, con varios colores
-- por producto (cada uno con su propia galería de imágenes) y stock por
-- talla (35 a 44). Las imágenes son ilustraciones SVG propias en
-- frontend/img/productos/ (no dependen de servicios externos).

-- Categorías (género)
INSERT INTO categorias (nombre) VALUES
    ('Hombre'),
    ('Mujer');

-- Productos, colores, imágenes y tallas
INSERT INTO productos (nombre, descripcion, precio, imagen_url, id_categoria) VALUES
    ('Sneaker Urbano Hombre', 'Sneaker urbano de cuero sintético con suela ligera, ideal para el día a día.', 189900, 'img/productos/sneaker-urbano-hombre--negro-a.svg', (SELECT id FROM categorias WHERE nombre='Hombre'));
SET @id_prod = LAST_INSERT_ID();

INSERT INTO producto_colores (id_producto, nombre, color_hex, orden) VALUES
    (@id_prod, 'Negro', '#1F2229', 0),
    (@id_prod, 'Blanco', '#F2F2F0', 1),
    (@id_prod, 'Azul Marino', '#24406B', 2);

SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=0);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-hombre--negro-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-hombre--negro-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=1);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-hombre--blanco-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-hombre--blanco-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=2);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-hombre--azul-marino-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-hombre--azul-marino-b.svg', 1);

-- Cada color del producto recibe, como punto de partida, el mismo desglose
-- por talla (el admin puede luego ajustar el stock real por color).
INSERT INTO producto_tallas (id_producto, id_color, talla, stock)
SELECT @id_prod, pc.id, s.talla, s.stock FROM producto_colores pc
JOIN (SELECT 35 AS talla, 0 AS stock UNION ALL SELECT 36,0 UNION ALL SELECT 37,0 UNION ALL SELECT 38,0
      UNION ALL SELECT 39,6 UNION ALL SELECT 40,14 UNION ALL SELECT 41,0 UNION ALL SELECT 42,12
      UNION ALL SELECT 43,7 UNION ALL SELECT 44,4) s
WHERE pc.id_producto = @id_prod;

INSERT INTO inventario (id_producto, cantidad, stock_minimo) VALUES (@id_prod, 0, 5);

INSERT INTO productos (nombre, descripcion, precio, imagen_url, id_categoria) VALUES
    ('Zapato Oxford Clásico', 'Zapato formal de cuero con acabado clásico, perfecto para la oficina.', 219900, 'img/productos/oxford-clasico-hombre--cafe-a.svg', (SELECT id FROM categorias WHERE nombre='Hombre'));
SET @id_prod = LAST_INSERT_ID();

INSERT INTO producto_colores (id_producto, nombre, color_hex, orden) VALUES
    (@id_prod, 'Café', '#6B4226', 0),
    (@id_prod, 'Negro', '#1F2229', 1);

SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=0);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/oxford-clasico-hombre--cafe-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/oxford-clasico-hombre--cafe-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=1);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/oxford-clasico-hombre--negro-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/oxford-clasico-hombre--negro-b.svg', 1);

INSERT INTO producto_tallas (id_producto, id_color, talla, stock)
SELECT @id_prod, pc.id, s.talla, s.stock FROM producto_colores pc
JOIN (SELECT 35 AS talla, 0 AS stock UNION ALL SELECT 36,0 UNION ALL SELECT 37,0 UNION ALL SELECT 38,0
      UNION ALL SELECT 39,4 UNION ALL SELECT 40,9 UNION ALL SELECT 41,11 UNION ALL SELECT 42,8
      UNION ALL SELECT 43,5 UNION ALL SELECT 44,0) s
WHERE pc.id_producto = @id_prod;

INSERT INTO inventario (id_producto, cantidad, stock_minimo) VALUES (@id_prod, 0, 5);

INSERT INTO productos (nombre, descripcion, precio, imagen_url, id_categoria) VALUES
    ('Bota Urbana Hombre', 'Bota resistente de cuero, pensada para uso diario en cualquier clima.', 259900, 'img/productos/bota-urbana-hombre--cafe-oscuro-a.svg', (SELECT id FROM categorias WHERE nombre='Hombre'));
SET @id_prod = LAST_INSERT_ID();

INSERT INTO producto_colores (id_producto, nombre, color_hex, orden) VALUES
    (@id_prod, 'Café Oscuro', '#4A2F1C', 0),
    (@id_prod, 'Negro', '#1F2229', 1);

SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=0);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/bota-urbana-hombre--cafe-oscuro-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/bota-urbana-hombre--cafe-oscuro-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=1);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/bota-urbana-hombre--negro-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/bota-urbana-hombre--negro-b.svg', 1);

INSERT INTO producto_tallas (id_producto, id_color, talla, stock)
SELECT @id_prod, pc.id, s.talla, s.stock FROM producto_colores pc
JOIN (SELECT 35 AS talla, 0 AS stock UNION ALL SELECT 36,0 UNION ALL SELECT 37,0 UNION ALL SELECT 38,3
      UNION ALL SELECT 39,7 UNION ALL SELECT 40,10 UNION ALL SELECT 41,9 UNION ALL SELECT 42,6
      UNION ALL SELECT 43,4 UNION ALL SELECT 44,2) s
WHERE pc.id_producto = @id_prod;

INSERT INTO inventario (id_producto, cantidad, stock_minimo) VALUES (@id_prod, 0, 5);

INSERT INTO productos (nombre, descripcion, precio, imagen_url, id_categoria) VALUES
    ('Sneaker Running Pro', 'Sneaker deportivo con amortiguación ligera, ideal para entrenar.', 229900, 'img/productos/sneaker-running-hombre--gris-a.svg', (SELECT id FROM categorias WHERE nombre='Hombre'));
SET @id_prod = LAST_INSERT_ID();

INSERT INTO producto_colores (id_producto, nombre, color_hex, orden) VALUES
    (@id_prod, 'Gris', '#7C7F85', 0),
    (@id_prod, 'Rojo', '#C0392B', 1),
    (@id_prod, 'Negro', '#1F2229', 2);

SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=0);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sneaker-running-hombre--gris-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sneaker-running-hombre--gris-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=1);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sneaker-running-hombre--rojo-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sneaker-running-hombre--rojo-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=2);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sneaker-running-hombre--negro-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sneaker-running-hombre--negro-b.svg', 1);

INSERT INTO producto_tallas (id_producto, id_color, talla, stock)
SELECT @id_prod, pc.id, s.talla, s.stock FROM producto_colores pc
JOIN (SELECT 35 AS talla, 0 AS stock UNION ALL SELECT 36,0 UNION ALL SELECT 37,0 UNION ALL SELECT 38,5
      UNION ALL SELECT 39,10 UNION ALL SELECT 40,18 UNION ALL SELECT 41,20 UNION ALL SELECT 42,14
      UNION ALL SELECT 43,9 UNION ALL SELECT 44,5) s
WHERE pc.id_producto = @id_prod;

INSERT INTO inventario (id_producto, cantidad, stock_minimo) VALUES (@id_prod, 0, 5);

INSERT INTO productos (nombre, descripcion, precio, imagen_url, id_categoria) VALUES
    ('Tacón Elegante Mujer', 'Tacón elegante de tiras finas, perfecto para ocasiones especiales.', 209900, 'img/productos/tacon-elegante-mujer--negro-a.svg', (SELECT id FROM categorias WHERE nombre='Mujer'));
SET @id_prod = LAST_INSERT_ID();

INSERT INTO producto_colores (id_producto, nombre, color_hex, orden) VALUES
    (@id_prod, 'Negro', '#1F2229', 0),
    (@id_prod, 'Nude', '#D8B48A', 1),
    (@id_prod, 'Rojo', '#C0392B', 2);

SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=0);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/tacon-elegante-mujer--negro-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/tacon-elegante-mujer--negro-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=1);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/tacon-elegante-mujer--nude-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/tacon-elegante-mujer--nude-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=2);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/tacon-elegante-mujer--rojo-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/tacon-elegante-mujer--rojo-b.svg', 1);

INSERT INTO producto_tallas (id_producto, id_color, talla, stock)
SELECT @id_prod, pc.id, s.talla, s.stock FROM producto_colores pc
JOIN (SELECT 35 AS talla, 5 AS stock UNION ALL SELECT 36,9 UNION ALL SELECT 37,12 UNION ALL SELECT 38,10
      UNION ALL SELECT 39,6 UNION ALL SELECT 40,0 UNION ALL SELECT 41,0 UNION ALL SELECT 42,0
      UNION ALL SELECT 43,0 UNION ALL SELECT 44,0) s
WHERE pc.id_producto = @id_prod;

INSERT INTO inventario (id_producto, cantidad, stock_minimo) VALUES (@id_prod, 0, 5);

INSERT INTO productos (nombre, descripcion, precio, imagen_url, id_categoria) VALUES
    ('Flat Casual Mujer', 'Flat cómodo y versátil, ideal para el uso diario.', 149900, 'img/productos/flat-casual-mujer--blanco-a.svg', (SELECT id FROM categorias WHERE nombre='Mujer'));
SET @id_prod = LAST_INSERT_ID();

INSERT INTO producto_colores (id_producto, nombre, color_hex, orden) VALUES
    (@id_prod, 'Blanco', '#F2F2F0', 0),
    (@id_prod, 'Rosa', '#E8A3B3', 1),
    (@id_prod, 'Negro', '#1F2229', 2);

SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=0);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/flat-casual-mujer--blanco-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/flat-casual-mujer--blanco-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=1);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/flat-casual-mujer--rosa-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/flat-casual-mujer--rosa-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=2);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/flat-casual-mujer--negro-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/flat-casual-mujer--negro-b.svg', 1);

INSERT INTO producto_tallas (id_producto, id_color, talla, stock)
SELECT @id_prod, pc.id, s.talla, s.stock FROM producto_colores pc
JOIN (SELECT 35 AS talla, 8 AS stock UNION ALL SELECT 36,0 UNION ALL SELECT 37,15 UNION ALL SELECT 38,11
      UNION ALL SELECT 39,7 UNION ALL SELECT 40,3 UNION ALL SELECT 41,0 UNION ALL SELECT 42,0
      UNION ALL SELECT 43,0 UNION ALL SELECT 44,0) s
WHERE pc.id_producto = @id_prod;

INSERT INTO inventario (id_producto, cantidad, stock_minimo) VALUES (@id_prod, 0, 5);

INSERT INTO productos (nombre, descripcion, precio, imagen_url, id_categoria) VALUES
    ('Sandalia Verano Mujer', 'Sandalia ligera de tiras cruzadas, perfecta para el verano.', 129900, 'img/productos/sandalia-verano-mujer--dorado-a.svg', (SELECT id FROM categorias WHERE nombre='Mujer'));
SET @id_prod = LAST_INSERT_ID();

INSERT INTO producto_colores (id_producto, nombre, color_hex, orden) VALUES
    (@id_prod, 'Dorado', '#C9A24B', 0),
    (@id_prod, 'Blanco', '#F2F2F0', 1);

SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=0);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sandalia-verano-mujer--dorado-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sandalia-verano-mujer--dorado-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=1);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sandalia-verano-mujer--blanco-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sandalia-verano-mujer--blanco-b.svg', 1);

INSERT INTO producto_tallas (id_producto, id_color, talla, stock)
SELECT @id_prod, pc.id, s.talla, s.stock FROM producto_colores pc
JOIN (SELECT 35 AS talla, 6 AS stock UNION ALL SELECT 36,10 UNION ALL SELECT 37,14 UNION ALL SELECT 38,12
      UNION ALL SELECT 39,8 UNION ALL SELECT 40,4 UNION ALL SELECT 41,0 UNION ALL SELECT 42,0
      UNION ALL SELECT 43,0 UNION ALL SELECT 44,0) s
WHERE pc.id_producto = @id_prod;

INSERT INTO inventario (id_producto, cantidad, stock_minimo) VALUES (@id_prod, 0, 5);

INSERT INTO productos (nombre, descripcion, precio, imagen_url, id_categoria) VALUES
    ('Sneaker Urbano Mujer', 'Sneaker urbano y liviano que combina estilo y comodidad.', 179900, 'img/productos/sneaker-urbano-mujer--blanco-a.svg', (SELECT id FROM categorias WHERE nombre='Mujer'));
SET @id_prod = LAST_INSERT_ID();

INSERT INTO producto_colores (id_producto, nombre, color_hex, orden) VALUES
    (@id_prod, 'Blanco', '#F2F2F0', 0),
    (@id_prod, 'Rosa Pastel', '#E8A3B3', 1),
    (@id_prod, 'Negro', '#1F2229', 2);

SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=0);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-mujer--blanco-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-mujer--blanco-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=1);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-mujer--rosa-pastel-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-mujer--rosa-pastel-b.svg', 1);
SET @id_color := (SELECT id FROM producto_colores WHERE id_producto=@id_prod AND orden=2);
INSERT INTO producto_imagenes (id_producto, id_color, imagen_url, orden) VALUES
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-mujer--negro-a.svg', 0),
    (@id_prod, @id_color, 'img/productos/sneaker-urbano-mujer--negro-b.svg', 1);

INSERT INTO producto_tallas (id_producto, id_color, talla, stock)
SELECT @id_prod, pc.id, s.talla, s.stock FROM producto_colores pc
JOIN (SELECT 35 AS talla, 4 AS stock UNION ALL SELECT 36,9 UNION ALL SELECT 37,13 UNION ALL SELECT 38,16
      UNION ALL SELECT 39,11 UNION ALL SELECT 40,6 UNION ALL SELECT 41,0 UNION ALL SELECT 42,0
      UNION ALL SELECT 43,0 UNION ALL SELECT 44,0) s
WHERE pc.id_producto = @id_prod;

INSERT INTO inventario (id_producto, cantidad, stock_minimo) VALUES (@id_prod, 0, 5);

-- inventario.cantidad es el total agregado por producto (suma de todas las
-- combinaciones color+talla); se recalcula una sola vez al final en vez de
-- escribirlo a mano arriba, para no desincronizarlo por error de aritmética.
UPDATE inventario i
JOIN (SELECT id_producto, SUM(stock) AS total FROM producto_tallas GROUP BY id_producto) t
  ON t.id_producto = i.id_producto
SET i.cantidad = t.total;
