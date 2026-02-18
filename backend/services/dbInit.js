// backend/services/dbInit.js
const db = require("../db");

async function inicializarTablas() {
  const client = await db.connect();
  try {
    console.log("🛠️ Verificando y actualizando estructura de Base de Datos...");

    // --- 1. TABLAS BASE (ESTADO Y LOGS) ---
    await client.query(
      `CREATE TABLE IF NOT EXISTS estado_produccion (estacion_id INTEGER PRIMARY KEY, producto_actual TEXT);`,
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS registros (id SERIAL PRIMARY KEY, fecha DATE, hora TIME, accion TEXT, tipo VARCHAR(50), productos_json TEXT);`,
    );

    // --- 2. SEMIELABORADOS ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS semielaborados (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(100) UNIQUE NOT NULL,
        nombre VARCHAR(255),
        stock_actual NUMERIC DEFAULT 0,
        stock_planta_26 NUMERIC DEFAULT 0,
        stock_planta_37 NUMERIC DEFAULT 0,
        stock_deposito_ayolas NUMERIC DEFAULT 0,
        stock_deposito_quintana NUMERIC DEFAULT 0,
        alerta_1 NUMERIC DEFAULT 0,
        alerta_2 NUMERIC DEFAULT 0,
        alerta_3 NUMERIC DEFAULT 0,
        velocidad_estandar INTEGER DEFAULT 100,
        ultima_actualizacion TIMESTAMP DEFAULT NOW(),
        variantes JSONB DEFAULT '[]' -- Columna nueva para variantes
      );
    `);

    // Migraciones de columnas stock (por seguridad)
    const columnasStock = [
      "stock_planta_26",
      "stock_planta_37",
      "stock_deposito_ayolas",
      "stock_deposito_quintana",
    ];
    for (const col of columnasStock) {
      try {
        await client.query(
          `ALTER TABLE semielaborados ADD COLUMN IF NOT EXISTS ${col} NUMERIC DEFAULT 0;`,
        );
      } catch (e) {}
    }
    const columnasAlerta = ["alerta_1", "alerta_2", "alerta_3"];
    for (const col of columnasAlerta) {
      try {
        await client.query(
          `ALTER TABLE semielaborados ADD COLUMN IF NOT EXISTS ${col} NUMERIC DEFAULT 0;`,
        );
      } catch (e) {}
    }
    // Asegurar columna variantes
    try {
      await client.query(
        `ALTER TABLE semielaborados ADD COLUMN IF NOT EXISTS variantes JSONB DEFAULT '[]';`,
      );
    } catch (e) {}

    // --- 3. MATERIAS PRIMAS E INGENIERÍA ---
    await client.query(
      `CREATE TABLE IF NOT EXISTS materias_primas (id SERIAL PRIMARY KEY, codigo VARCHAR(100) UNIQUE NOT NULL, nombre VARCHAR(255), stock_actual NUMERIC DEFAULT 0, stock_minimo NUMERIC DEFAULT 0, ultima_actualizacion TIMESTAMP DEFAULT NOW());`,
    );
    try {
      await client.query(
        `ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS stock_minimo NUMERIC DEFAULT 0;`,
      );
    } catch (e) {}

    await client.query(
      `CREATE TABLE IF NOT EXISTS productos_ingenieria (nombre VARCHAR(255) PRIMARY KEY);`,
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS recetas (id SERIAL PRIMARY KEY, producto_terminado VARCHAR(255) REFERENCES productos_ingenieria(nombre) ON DELETE CASCADE, semielaborado_id INTEGER REFERENCES semielaborados(id), cantidad NUMERIC DEFAULT 1, ultima_actualizacion TIMESTAMP DEFAULT NOW());`,
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

    // --- HISTORIAL DE RECETAS ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS historial_recetas (
        id SERIAL PRIMARY KEY,
        semielaborado_id INTEGER REFERENCES semielaborados(id) ON DELETE CASCADE,
        nombre_version VARCHAR(255),
        fecha_guardado TIMESTAMP DEFAULT NOW(),
        ingredientes_json JSONB
      );
    `);

    // --- 4. PLANIFICACIÓN ---
    await client.query(
      `CREATE TABLE IF NOT EXISTS planes_produccion (id SERIAL PRIMARY KEY, nombre VARCHAR(255) NOT NULL, fecha_creacion TIMESTAMP DEFAULT NOW(), estado VARCHAR(50) DEFAULT 'ABIERTO');`,
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS planes_items (id SERIAL PRIMARY KEY, plan_id INTEGER REFERENCES planes_produccion(id) ON DELETE CASCADE, semielaborado_id INTEGER REFERENCES semielaborados(id), cantidad_requerida NUMERIC NOT NULL DEFAULT 0, cantidad_producida NUMERIC NOT NULL DEFAULT 0, fecha_inicio_estimada DATE DEFAULT CURRENT_DATE, ritmo_turno NUMERIC DEFAULT 50);`,
    );

    // Migraciones Planes
    try {
      await client.query(
        `ALTER TABLE planes_items ADD COLUMN IF NOT EXISTS cantidad_producida NUMERIC NOT NULL DEFAULT 0;`,
      );
    } catch (e) {}
    try {
      await client.query(
        `ALTER TABLE planes_items ADD COLUMN IF NOT EXISTS fecha_inicio_estimada DATE DEFAULT CURRENT_DATE;`,
      );
    } catch (e) {}
    try {
      await client.query(
        `ALTER TABLE planes_items ADD COLUMN IF NOT EXISTS ritmo_turno NUMERIC DEFAULT 50;`,
      );
    } catch (e) {}

    // --- 5. OPERARIOS Y REGISTROS ---
    await client.query(
      `CREATE TABLE IF NOT EXISTS operarios (id SERIAL PRIMARY KEY, nombre VARCHAR(255) UNIQUE NOT NULL, activo BOOLEAN DEFAULT true);`,
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS registros_produccion (id SERIAL PRIMARY KEY, plan_item_id INTEGER REFERENCES planes_items(id) ON DELETE SET NULL, semielaborado_id INTEGER REFERENCES semielaborados(id) NOT NULL, operario_id INTEGER REFERENCES operarios(id) NOT NULL, cantidad_ok NUMERIC NOT NULL DEFAULT 0, cantidad_scrap NUMERIC NOT NULL DEFAULT 0, motivo_scrap VARCHAR(255), turno VARCHAR(50) NOT NULL DEFAULT 'Diurno', fecha_produccion TIMESTAMP NOT NULL DEFAULT NOW());`,
    );

    // --- 6. LOGÍSTICA ---
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
        `ALTER TABLE movimientos_logistica ADD COLUMN IF NOT EXISTS codigo_remito VARCHAR(100);`,
      );
    } catch (e) {}
    try {
      await client.query(
        `ALTER TABLE movimientos_logistica ADD COLUMN IF NOT EXISTS chofer VARCHAR(100);`,
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

    // --- 7. PEDIDOS CLIENTES (MODIFICADO PARA SEGURIDAD) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS pedidos_clientes (
        id SERIAL PRIMARY KEY,
        fecha VARCHAR(50),
        periodo VARCHAR(50),
        op VARCHAR(100),
        cliente VARCHAR(200),
        modelo VARCHAR(200),
        detalles TEXT,
        oc_cliente VARCHAR(100),
        cantidad VARCHAR(50),
        estado VARCHAR(50),
        programado VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        
        -- CAMBIO CLAVE: Usamos VARCHAR para evitar errores con formatos de Excel ("11/2/26")
        fecha_preparacion VARCHAR(50),
        fecha_despacho VARCHAR(50),
        usuario_despacho VARCHAR(100)
      );
    `);

    // --- MIGRACIÓN DE URGENCIA PARA AGREGAR COLUMNAS FALTANTES ---
    try {
      console.log("--> Actualizando tabla pedidos_clientes...");

      // 1. Aseguramos que existan las columnas (como VARCHAR para evitar errores de fecha)
      await client.query(
        `ALTER TABLE pedidos_clientes ADD COLUMN IF NOT EXISTS fecha_preparacion VARCHAR(50)`,
      );
      await client.query(
        `ALTER TABLE pedidos_clientes ADD COLUMN IF NOT EXISTS fecha_despacho VARCHAR(50)`,
      );
      await client.query(
        `ALTER TABLE pedidos_clientes ADD COLUMN IF NOT EXISTS usuario_despacho VARCHAR(100)`,
      );

      // 2. IMPORTANTE: ELIMINAR LA RESTRICCIÓN DE OP ÚNICA
      // Esto estaba causando el error "duplicate key". Lo borramos para permitir OPs con múltiples ítems.
      await client.query(
        `ALTER TABLE pedidos_clientes DROP CONSTRAINT IF EXISTS pedidos_clientes_op_key`,
      );
      await client.query(
        `ALTER TABLE pedidos_clientes DROP CONSTRAINT IF EXISTS unique_op`,
      ); // Por si tiene otro nombre

      // ¡¡¡ BORRA O COMENTA ESTAS LÍNEAS !!!
      // await client.query(
      //   `ALTER TABLE pedidos_clientes ADD CONSTRAINT pedidos_clientes_op_key UNIQUE (op)`,
      // );

      console.log(
        "--> Tabla pedidos_clientes liberada de restricciones únicas.",
      );
    } catch (e) {
      console.warn("Nota sobre pedidos_clientes:", e.message);
    }

    // --- 8. COMPRAS ---
    await client.query(
      `CREATE TABLE IF NOT EXISTS solicitudes_compra (id SERIAL PRIMARY KEY, fecha_creacion TIMESTAMP DEFAULT NOW(), estado VARCHAR(50) DEFAULT 'PENDIENTE');`,
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS solicitudes_items (id SERIAL PRIMARY KEY, solicitud_id INTEGER REFERENCES solicitudes_compra(id) ON DELETE CASCADE, materia_prima_id INTEGER REFERENCES materias_primas(id), cantidad NUMERIC NOT NULL, proveedor_recomendado VARCHAR(255), cantidad_recibida NUMERIC DEFAULT 0, estado VARCHAR(50) DEFAULT 'PENDIENTE');`,
    );

    // --- 9. LOGÍSTICA INTERNA ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_reposicion (
        id SERIAL PRIMARY KEY,
        semielaborado_id INTEGER REFERENCES semielaborados(id),
        cantidad NUMERIC NOT NULL,
        destino VARCHAR(50),
        estado VARCHAR(20) DEFAULT 'PENDIENTE',
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        fecha_despacho TIMESTAMP
      );
    `);

    // --- 10. COMPETENCIA TRACKING ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS competencia_tracking (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        alias VARCHAR(100),
        sitio VARCHAR(50),
        ultimo_precio NUMERIC DEFAULT 0,
        ultima_revision TIMESTAMP DEFAULT NOW(),
        activo BOOLEAN DEFAULT TRUE
      );
    `);

    // --- 11. PROGRAMACIÓN DE MÁQUINAS ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS programacion_maquinas (
        id SERIAL PRIMARY KEY,
        fecha DATE NOT NULL,
        maquina VARCHAR(50) NOT NULL,
        brazo VARCHAR(50) DEFAULT 'Estación 1',
        semielaborado_id INTEGER REFERENCES semielaborados(id),
        cantidad INTEGER DEFAULT 0,
        unidades_por_ciclo INTEGER DEFAULT 1,
        grupo_id INTEGER DEFAULT 1,
        turno VARCHAR(20) DEFAULT 'FULL',
        orden INTEGER DEFAULT 0
      );
    `);
    // Migraciones Maquinas
    try {
      await client.query(
        "ALTER TABLE programacion_maquinas ADD COLUMN IF NOT EXISTS grupo_id INTEGER DEFAULT 1;",
      );
    } catch (e) {}
    try {
      await client.query(
        "ALTER TABLE programacion_maquinas ADD COLUMN IF NOT EXISTS brazo VARCHAR(50) DEFAULT 'Estación 1';",
      );
    } catch (e) {}

    // --- 12. MANTENIMIENTO ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets_mantenimiento (
        id SERIAL PRIMARY KEY,
        maquina VARCHAR(100) NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        descripcion TEXT,
        prioridad VARCHAR(20) DEFAULT 'MEDIA',
        tipo VARCHAR(20) DEFAULT 'CORRECTIVO',
        estado VARCHAR(20) DEFAULT 'PENDIENTE',
        creado_por VARCHAR(100),
        asignado_a VARCHAR(100),
        solucion_notas TEXT,
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        fecha_inicio_revision TIMESTAMP,
        fecha_solucion TIMESTAMP,
        alerta_24h_enviada BOOLEAN DEFAULT FALSE
      );
    `);
    try {
      await client.query(
        "ALTER TABLE tickets_mantenimiento ADD COLUMN IF NOT EXISTS alerta_24h_enviada BOOLEAN DEFAULT FALSE;",
      );
    } catch (e) {}

    // --- 13. SOLICITUDES LOGÍSTICA ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_logistica (
        id SERIAL PRIMARY KEY,
        producto VARCHAR(255) NOT NULL,
        cantidad INT NOT NULL,
        prioridad VARCHAR(50) DEFAULT 'MEDIA',
        estado VARCHAR(50) DEFAULT 'PENDIENTE',
        solicitante VARCHAR(100),
        notas TEXT,
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        fecha_actualizacion TIMESTAMP DEFAULT NOW()
      );
    `);

    // --- 14. LOGÍSTICA HISTORIAL Y COMENTARIOS ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS historial_logistica (
      id SERIAL PRIMARY KEY,
      solicitud_id INTEGER REFERENCES solicitudes_logistica(id),
      accion VARCHAR(100),
      usuario VARCHAR(100),
      detalle TEXT,
      fecha TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS comentarios_logistica (
      id SERIAL PRIMARY KEY,
      solicitud_id INTEGER REFERENCES solicitudes_logistica(id) ON DELETE CASCADE,
      usuario VARCHAR(100),
      mensaje TEXT,
      fecha TIMESTAMP DEFAULT NOW()
      );
    `);

    // --- 15. TELEGRAM SUSCRIPTORES ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS telegram_suscriptores (
      chat_id BIGINT PRIMARY KEY,
      first_name VARCHAR(100),
      username VARCHAR(100),
      fecha_suscripcion TIMESTAMP DEFAULT NOW()
    );
    `);

    // --- 16. FERIADOS ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS feriados (
        fecha DATE PRIMARY KEY,
        descripcion VARCHAR(255)
      );
    `);

    // --- 17. RRHH ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS rrhh_categorias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        valor_hora NUMERIC DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rrhh_personal (
        nombre VARCHAR(255) PRIMARY KEY,
        categoria_id INTEGER REFERENCES rrhh_categorias(id) ON DELETE SET NULL,
        fecha_actualizacion TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rrhh_cierres (
        id SERIAL PRIMARY KEY,
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        nombre_periodo VARCHAR(100) NOT NULL,
        total_pagado NUMERIC(15, 2),
        cantidad_empleados INTEGER,
        datos_snapshot JSONB NOT NULL
      );
    `);

    // --- 18. CHANGELOG PRODUCTO ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS historial_cambios_producto (
        id SERIAL PRIMARY KEY,
        fecha TIMESTAMP DEFAULT NOW(),
        producto VARCHAR(255) NOT NULL,
        tipo_cambio VARCHAR(50),
        descripcion TEXT,
        responsable VARCHAR(100),
        notificado_a TEXT,
        adjuntos_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        lleva_reflectiva BOOLEAN DEFAULT FALSE,
        tipo_reflectiva VARCHAR(50),
        tipo_protector VARCHAR(50),
        tipo_aplicacion VARCHAR(50)
      );
    `);
    // Migraciones Reflectivos
    try {
      await client.query(
        `ALTER TABLE historial_cambios_producto ADD COLUMN IF NOT EXISTS lleva_reflectiva BOOLEAN DEFAULT FALSE`,
      );
      await client.query(
        `ALTER TABLE historial_cambios_producto ADD COLUMN IF NOT EXISTS tipo_reflectiva VARCHAR(50)`,
      );
      await client.query(
        `ALTER TABLE historial_cambios_producto ADD COLUMN IF NOT EXISTS tipo_protector VARCHAR(50)`,
      );
      await client.query(
        `ALTER TABLE historial_cambios_producto ADD COLUMN IF NOT EXISTS tipo_aplicacion VARCHAR(50)`,
      );
    } catch (e) {}

    // --- 19. SUGERENCIAS COMPRA ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS sugerencias_compra (
        id SERIAL PRIMARY KEY,
        materia_prima_id INTEGER REFERENCES materias_primas(id),
        cantidad NUMERIC NOT NULL,
        solicitante VARCHAR(100),
        sector VARCHAR(100),
        prioridad VARCHAR(20) DEFAULT 'NORMAL',
        estado VARCHAR(20) DEFAULT 'PENDIENTE',
        comentario TEXT,
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        fecha_resolucion TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS historial_sugerencias (
        id SERIAL PRIMARY KEY,
        sugerencia_id INTEGER REFERENCES sugerencias_compra(id) ON DELETE CASCADE,
        accion VARCHAR(50),
        usuario VARCHAR(100),
        fecha TIMESTAMP DEFAULT NOW(),
        detalle TEXT
      );
    `);

    // --- NUEVO: TABLA LOCAL DE PEDIDOS (Por si decides usarla aparte) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS pedidos_produccion (
          id SERIAL PRIMARY KEY,
          id_externo VARCHAR(255) UNIQUE,
          fecha DATE,
          cliente VARCHAR(255),
          modelo VARCHAR(255),
          cantidad INTEGER,
          estado VARCHAR(50) DEFAULT 'PENDIENTE',
          fecha_despacho TIMESTAMP,
          usuario_despacho VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW()
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
