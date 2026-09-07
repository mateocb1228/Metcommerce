-- MetCommerce — Esquema de base de datos
-- Ejecutar en MySQL: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS metcommerce
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_spanish_ci;

USE metcommerce;

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
    total             DECIMAL(12,2) NOT NULL,
    estado            ENUM('pendiente','confirmado','enviado','entregado','cancelado') DEFAULT 'pendiente',
    fecha_creacion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE detalle_pedidos (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido        INT           NOT NULL,
    id_producto      INT           NOT NULL,
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

INSERT INTO categorias (nombre) VALUES
    ('Calzado'),
    ('Ropa'),
    ('Accesorios');

INSERT INTO productos (nombre, descripcion, precio, imagen_url, id_categoria) VALUES
    ('Zapato Casual Hombre', 'Zapato cómodo para uso diario',         89900,  'https://via.placeholder.com/250x200?text=Zapato+Casual',  1),
    ('Tenis Deportivo',      'Ideal para deporte y uso casual',        120000, 'https://via.placeholder.com/250x200?text=Tenis+Deportivo', 1),
    ('Sandalia Mujer',       'Sandalia cómoda y elegante',             65000,  'https://via.placeholder.com/250x200?text=Sandalia+Mujer',  1),
    ('Bota de Cuero',        'Bota resistente de cuero genuino',       195000, 'https://via.placeholder.com/250x200?text=Bota+Cuero',      1);

INSERT INTO inventario (id_producto, cantidad, stock_minimo) VALUES
    (1, 25, 5),
    (2, 18, 5),
    (3,  7, 5),
    (4,  3, 5);  -- stock bajo: activará alerta
