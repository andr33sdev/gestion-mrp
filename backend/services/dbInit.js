const db = require("../db");

async function inicializarTablas() {
  const client = await db.connect();
  try {
    console.log("🛠️ Verificando y actualizando estructura de Base de Datos...");

    // --- 1. TABLAS BASE (ESTADO Y LOGS) ---
    await client.query(
      `CREATE TABLE IF NOT EXISTS estado_produccion (estacion_id INTEGER PRIMARY KEY, producto_actual TEXT);`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS registros (id SERIAL PRIMARY KEY, fecha DATE, hora TIME, accion TEXT, tipo VARCHAR(50), productos_json TEXT);`
    );

    // --- 2. SEMIELABORADOS (CON MIGRACIÓN DE COLUMNAS STOCK) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS semielaborados (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(100) UNIQUE NOT NULL,
        nombre VARCHAR(255),
        stock_actual NUMERIC DEFAULT 0, -- (Obsoleto, pero se mantiene por compatibilidad)
        ultima_actualizacion TIMESTAMP DEFAULT NOW()
      );
    `);

    // Migraciones seguras para las 4 plantas (try-catch silencioso por si ya existen)
    const columnasStock = [
      "stock_planta_26",
      "stock_planta_37",
      "stock_deposito_ayolas",
      "stock_deposito_quintana",
    ];

    for (const col of columnasStock) {
      try {
        await client.query(
          `ALTER TABLE semielaborados ADD COLUMN ${col} NUMERIC DEFAULT 0;`
        );
      } catch (e) {}
    }

    // --- 3. MATERIAS PRIMAS E INGENIERÍA ---
    await client.query(
      `CREATE TABLE IF NOT EXISTS materias_primas (id SERIAL PRIMARY KEY, codigo VARCHAR(100) UNIQUE NOT NULL, nombre VARCHAR(255), stock_actual NUMERIC DEFAULT 0, ultima_actualizacion TIMESTAMP DEFAULT NOW());`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS productos_ingenieria (nombre VARCHAR(255) PRIMARY KEY);`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS recetas (id SERIAL PRIMARY KEY, producto_terminado VARCHAR(255) REFERENCES productos_ingenieria(nombre) ON DELETE CASCADE, semielaborado_id INTEGER REFERENCES semielaborados(id), cantidad NUMERIC DEFAULT 1, ultima_actualizacion TIMESTAMP DEFAULT NOW());`
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS recetas_semielaborados (
        id SERIAL PRIMARY KEY,
        semielaborado_id INTEGER REFERENCES semielaborados(id) ON DELETE CASCADE,
        materia_prima_id INTEGER REFERENCES materias_primas(id) ON DELETE CASCADE,
        cantidad NUMERIC DEFAULT 1,
        CONSTRAINT uq_receta_semi UNIQUE(semielaborado_id, materia_prima_id)
      );
    `);
    try {
      await client.query(
        `ALTER TABLE recetas_semielaborados RENAME COLUMN cantidad_ok TO cantidad;`
      );
    } catch (e) {}

    // --- 4. PLANIFICACIÓN ---
    await client.query(
      `CREATE TABLE IF NOT EXISTS planes_produccion (id SERIAL PRIMARY KEY, nombre VARCHAR(255) NOT NULL, fecha_creacion TIMESTAMP DEFAULT NOW(), estado VARCHAR(50) DEFAULT 'ABIERTO');`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS planes_items (id SERIAL PRIMARY KEY, plan_id INTEGER REFERENCES planes_produccion(id) ON DELETE CASCADE, semielaborado_id INTEGER REFERENCES semielaborados(id), cantidad_requerida NUMERIC NOT NULL DEFAULT 0, cantidad_producida NUMERIC NOT NULL DEFAULT 0);`
    );
    // Ajustes de nombres de columnas viejas
    try {
      await client.query(
        `ALTER TABLE planes_items RENAME COLUMN cantidad TO cantidad_requerida;`
      );
    } catch (e) {}
    try {
      await client.query(
        `ALTER TABLE planes_items ADD COLUMN cantidad_producida NUMERIC NOT NULL DEFAULT 0;`
      );
    } catch (e) {}

    // --- 5. OPERARIOS Y REGISTROS ---
    await client.query(
      `CREATE TABLE IF NOT EXISTS operarios (id SERIAL PRIMARY KEY, nombre VARCHAR(255) UNIQUE NOT NULL, activo BOOLEAN DEFAULT true);`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS registros_produccion (id SERIAL PRIMARY KEY, plan_item_id INTEGER REFERENCES planes_items(id) ON DELETE SET NULL, semielaborado_id INTEGER REFERENCES semielaborados(id) NOT NULL, operario_id INTEGER REFERENCES operarios(id) NOT NULL, cantidad_ok NUMERIC NOT NULL DEFAULT 0, cantidad_scrap NUMERIC NOT NULL DEFAULT 0, motivo_scrap VARCHAR(255), turno VARCHAR(50) NOT NULL DEFAULT 'Diurno', fecha_produccion TIMESTAMP NOT NULL DEFAULT NOW());`
    );
    try {
      await client.query(
        `ALTER TABLE registros_produccion RENAME COLUMN cantidad TO cantidad_ok;`
      );
    } catch (e) {}

    // --- 6. LOGÍSTICA (Movimientos y Despachos) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS movimientos_logistica (
        id SERIAL PRIMARY KEY,
        semielaborado_id INTEGER REFERENCES semielaborados(id),
        cantidad NUMERIC NOT NULL,
        origen VARCHAR(50),
        destino VARCHAR(50),
        estado VARCHAR(20) DEFAULT 'EN_TRANSITO',
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        fecha_recepcion TIMESTAMP,
        codigo_remito VARCHAR(100),
        chofer VARCHAR(100)
      );
    `);
    try {
      await client.query(
        `ALTER TABLE movimientos_logistica ADD COLUMN codigo_remito VARCHAR(100);`
      );
    } catch (e) {}
    try {
      await client.query(
        `ALTER TABLE movimientos_logistica ADD COLUMN chofer VARCHAR(100);`
      );
    } catch (e) {}

    await client.query(`
      CREATE TABLE IF NOT EXISTS historial_despachos (
        id SERIAL PRIMARY KEY,
        fecha_despacho TIMESTAMP,
        cliente VARCHAR(255),
        oc VARCHAR(100),
        modelo_producto VARCHAR(255),
        semielaborado_nombre VARCHAR(255),
        cantidad_descontada NUMERIC,
        fecha_registro TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_despacho UNIQUE (oc, modelo_producto, cliente, fecha_despacho, semielaborado_nombre)
      );
    `);

    // --- 7. PEDIDOS (Se recrea siempre para asegurar estructura limpia del Excel) ---
    try {
      await client.query("DROP TABLE IF EXISTS pedidos");
      await client.query(`
          CREATE TABLE pedidos (
            id SERIAL PRIMARY KEY,
            fecha TIMESTAMP,
            periodo VARCHAR(100),
            oc VARCHAR(100),
            cliente VARCHAR(255),
            modelo VARCHAR(255),
            detalles TEXT,
            categoria VARCHAR(100),
            cantidad NUMERIC,
            estado VARCHAR(100),
            programado TIMESTAMP,
            preparado TIMESTAMP,
            fecha_despacho TEXT
          );
        `);
    } catch (e) {
      console.error("Error tabla pedidos:", e.message);
    }

    // --- 8. COMPRAS ---
    await client.query(
      `CREATE TABLE IF NOT EXISTS solicitudes_compra (id SERIAL PRIMARY KEY, fecha_creacion TIMESTAMP DEFAULT NOW(), estado VARCHAR(50) DEFAULT 'PENDIENTE');`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS solicitudes_items (id SERIAL PRIMARY KEY, solicitud_id INTEGER REFERENCES solicitudes_compra(id) ON DELETE CASCADE, materia_prima_id INTEGER REFERENCES materias_primas(id), cantidad NUMERIC NOT NULL, proveedor_recomendado VARCHAR(255));`
    );
    try {
      await client.query(
        `ALTER TABLE solicitudes_items ADD COLUMN cantidad_recibida NUMERIC DEFAULT 0;`
      );
    } catch (e) {}
    try {
      await client.query(
        `ALTER TABLE solicitudes_items ADD COLUMN estado VARCHAR(50) DEFAULT 'PENDIENTE';`
      );
    } catch (e) {}

    // --- 9. LOGÍSTICA INTERNA (REPOSICIÓN ENTRE PLANTAS) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_reposicion (
        id SERIAL PRIMARY KEY,
        semielaborado_id INTEGER REFERENCES semielaborados(id),
        cantidad NUMERIC NOT NULL,
        destino VARCHAR(50), -- Quien lo pide (Ej: DEP_AYOLAS)
        estado VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, DESPACHADO, CANCELADO
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        fecha_despacho TIMESTAMP
      );
    `);

    // --- 10. NOVEDADES DE TELEGRAM (MEMORIA PERSISTENTE) ---
    // Guarda los cambios de fecha que llegan por el bot para que el Sync no los borre
    await client.query(`
      CREATE TABLE IF NOT EXISTS novedades_pedidos (
        id SERIAL PRIMARY KEY,
        cliente VARCHAR(255),
        razon_social VARCHAR(255),
        fecha_nueva DATE,
        mensaje_original TEXT,
        fecha_registro TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✔ Tablas verificadas y actualizadas correctamente.");
  } catch (err) {
    console.error("❌ Error inicializando tablas:", err.message);
  } finally {
    client.release();
  }
}

module.exports = { inicializarTablas };
