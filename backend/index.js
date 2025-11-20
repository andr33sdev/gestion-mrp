// backend/index.js
const express = require("express");
const cors = require("cors");
const db = require("./db");
const {
  leerArchivoHorno,
  setupAuth,
  leerArchivoPedidos,
  leerStockSemielaborados,
  leerMateriasPrimas,
} = require("./google-drive");
const { parsearLog } = require("./parser");
const format = require("pg-format");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());


// ============================================================
// 1. INICIALIZACIÓN DE TABLAS (VERSIÓN CORREGIDA)
// ============================================================
async function inicializarTablas() {
  const client = await db.connect();
  try {
    console.log("🛠️ Verificando y actualizando estructura de Base de Datos...");

    // --- Tablas Base ---
    await client.query(`CREATE TABLE IF NOT EXISTS estado_produccion (estacion_id INTEGER PRIMARY KEY, producto_actual TEXT);`);
    await client.query(`CREATE TABLE IF NOT EXISTS registros (id SERIAL PRIMARY KEY, fecha DATE, hora TIME, accion TEXT, tipo VARCHAR(50), productos_json TEXT);`);

    // --- SEMIELABORADOS (Corrección de Columnas de Stock) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS semielaborados (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(100) UNIQUE NOT NULL,
        nombre VARCHAR(255),
        stock_actual NUMERIC DEFAULT 0,
        ultima_actualizacion TIMESTAMP DEFAULT NOW()
      );
    `);

    // 1. Intentar migrar nombres viejos (si existen)
    try { await client.query(`ALTER TABLE semielaborados RENAME COLUMN stock_planta_1 TO stock_planta_26;`); } catch (e) { }
    try { await client.query(`ALTER TABLE semielaborados RENAME COLUMN stock_planta_2 TO stock_planta_37;`); } catch (e) { }
    try { await client.query(`ALTER TABLE semielaborados RENAME COLUMN stock_deposito TO stock_deposito_ayolas;`); } catch (e) { }

    // 2. ASEGURAR que existan las columnas nuevas (Si no existen, las crea)
    try { await client.query(`ALTER TABLE semielaborados ADD COLUMN stock_planta_26 NUMERIC DEFAULT 0;`); } catch (e) { }
    try { await client.query(`ALTER TABLE semielaborados ADD COLUMN stock_planta_37 NUMERIC DEFAULT 0;`); } catch (e) { }
    try { await client.query(`ALTER TABLE semielaborados ADD COLUMN stock_deposito_ayolas NUMERIC DEFAULT 0;`); } catch (e) { }
    try { await client.query(`ALTER TABLE semielaborados ADD COLUMN stock_deposito_quintana NUMERIC DEFAULT 0;`); } catch (e) { }


    // --- Resto de Tablas (Igual que antes) ---
    await client.query(`CREATE TABLE IF NOT EXISTS materias_primas (id SERIAL PRIMARY KEY, codigo VARCHAR(100) UNIQUE NOT NULL, nombre VARCHAR(255), stock_actual NUMERIC DEFAULT 0, ultima_actualizacion TIMESTAMP DEFAULT NOW());`);
    await client.query(`CREATE TABLE IF NOT EXISTS productos_ingenieria (nombre VARCHAR(255) PRIMARY KEY);`);

    await client.query(`CREATE TABLE IF NOT EXISTS recetas (id SERIAL PRIMARY KEY, producto_terminado VARCHAR(255) REFERENCES productos_ingenieria(nombre) ON DELETE CASCADE, semielaborado_id INTEGER REFERENCES semielaborados(id), cantidad NUMERIC DEFAULT 1, ultima_actualizacion TIMESTAMP DEFAULT NOW());`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recetas_semielaborados (
        id SERIAL PRIMARY KEY,
        semielaborado_id INTEGER REFERENCES semielaborados(id) ON DELETE CASCADE,
        materia_prima_id INTEGER REFERENCES materias_primas(id) ON DELETE CASCADE,
        cantidad NUMERIC DEFAULT 1,
        CONSTRAINT uq_receta_semi UNIQUE(semielaborado_id, materia_prima_id)
      );
    `);
    try { await client.query(`ALTER TABLE recetas_semielaborados RENAME COLUMN cantidad_ok TO cantidad;`); } catch (e) { }

    // Planificación
    await client.query(`CREATE TABLE IF NOT EXISTS planes_produccion (id SERIAL PRIMARY KEY, nombre VARCHAR(255) NOT NULL, fecha_creacion TIMESTAMP DEFAULT NOW(), estado VARCHAR(50) DEFAULT 'ABIERTO');`);
    await client.query(`CREATE TABLE IF NOT EXISTS planes_items (id SERIAL PRIMARY KEY, plan_id INTEGER REFERENCES planes_produccion(id) ON DELETE CASCADE, semielaborado_id INTEGER REFERENCES semielaborados(id), cantidad_requerida NUMERIC NOT NULL DEFAULT 0, cantidad_producida NUMERIC NOT NULL DEFAULT 0);`);
    try { await client.query(`ALTER TABLE planes_items RENAME COLUMN cantidad TO cantidad_requerida;`); } catch (e) { }
    try { await client.query(`ALTER TABLE planes_items ADD COLUMN cantidad_producida NUMERIC NOT NULL DEFAULT 0;`); } catch (e) { }

    // Operarios y Registros
    await client.query(`CREATE TABLE IF NOT EXISTS operarios (id SERIAL PRIMARY KEY, nombre VARCHAR(255) UNIQUE NOT NULL, activo BOOLEAN DEFAULT true);`);
    await client.query(`CREATE TABLE IF NOT EXISTS registros_produccion (id SERIAL PRIMARY KEY, plan_item_id INTEGER REFERENCES planes_items(id) ON DELETE SET NULL, semielaborado_id INTEGER REFERENCES semielaborados(id) NOT NULL, operario_id INTEGER REFERENCES operarios(id) NOT NULL, cantidad_ok NUMERIC NOT NULL DEFAULT 0, cantidad_scrap NUMERIC NOT NULL DEFAULT 0, motivo_scrap VARCHAR(255), turno VARCHAR(50) NOT NULL DEFAULT 'Diurno', fecha_produccion TIMESTAMP NOT NULL DEFAULT NOW());`);
    try { await client.query(`ALTER TABLE registros_produccion RENAME COLUMN cantidad TO cantidad_ok;`); } catch (e) { }

    // Logística
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
    try { await client.query(`ALTER TABLE movimientos_logistica ADD COLUMN codigo_remito VARCHAR(100);`); } catch (e) { }
    try { await client.query(`ALTER TABLE movimientos_logistica ADD COLUMN chofer VARCHAR(100);`); } catch (e) { }

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

    // Pedidos
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
        fecha_despacho TIMESTAMP
      );
    `);

    console.log("✔ Tablas y columnas verificadas correctamente.");
  } catch (err) {
    console.error("❌ Error inicializando tablas:", err.message);
  } finally {
    client.release();
  }
}

// --- FUNCIÓN HELPER: Normalizar texto ---
function normalizarTexto(txt) {
  if (!txt) return "";
  return txt
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// --- SINCRONIZACIÓN HORNO (LOGS) ---
async function sincronizarBaseDeDatos() {
  console.log("[TIMER] Sincronizando Logs Horno...");
  const client = await db.connect();
  try {
    const textoCrudo = await leerArchivoHorno();
    const registrosOriginales = parsearLog(textoCrudo);

    await client.query("BEGIN");

    const { rows: currentProdRows } = await client.query(
      "SELECT * FROM estado_produccion FOR UPDATE"
    );
    const currentProduccion = currentProdRows.reduce((acc, row) => {
      try {
        acc[row.estacion_id] = {
          json: row.producto_actual || "[]",
          list: JSON.parse(row.producto_actual || "[]"),
          accion: `Estacion ${row.estacion_id}`,
        };
      } catch (e) {
        acc[row.estacion_id] = {
          json: "[]",
          list: [],
          accion: `Estacion ${row.estacion_id}`,
        };
      }
      return acc;
    }, {});

    const { rows: dbTriggers } = await client.query(
      `SELECT fecha, hora, accion FROM registros WHERE tipo = 'EVENTO' AND accion LIKE 'Se inicio ciclo%'`
    );
    const dbTriggerSet = new Set(
      dbTriggers.map(
        (r) => `${r.fecha.toISOString().split("T")[0]}T${r.hora}_${r.accion}`
      )
    );

    const newArchiveRecords = [];
    for (const reg of registrosOriginales) {
      let stationId = null,
        isStartCycle = false;
      if (reg.accion.includes("Estacion 1")) stationId = 1;
      else if (reg.accion.includes("Estacion 2")) stationId = 2;
      if (reg.accion.includes("Se inicio ciclo")) isStartCycle = true;

      if (stationId && isStartCycle) {
        const key = `${reg.fecha}T${reg.hora}_${reg.accion}`;
        if (!dbTriggerSet.has(key)) {
          const products = currentProduccion[stationId];
          if (products && products.list.length > 0) {
            const triggerDateTime = new Date(`${reg.fecha}T${reg.hora}`);
            const archiveDateTime = new Date(triggerDateTime.getTime() - 5000);
            newArchiveRecords.push({
              fecha: archiveDateTime.toISOString().split("T")[0],
              hora: archiveDateTime
                .toTimeString()
                .split(" ")[0]
                .split("(")[0]
                .trim(),
              accion: products.accion,
              tipo: "PRODUCCION",
              productos_json: products.json,
            });
          }
        }
      }
    }

    const allRecordsToInsert = [...registrosOriginales, ...newArchiveRecords];
    if (allRecordsToInsert.length === 0) {
      client.release();
      return { success: false, msg: "Sin registros nuevos." };
    }

    await client.query("DELETE FROM registros WHERE tipo != 'PRODUCCION'");
    const valores = allRecordsToInsert.map((r) => [
      r.fecha,
      r.hora,
      r.accion,
      r.tipo,
      r.productos_json || null,
    ]);
    await client.query(
      format(
        "INSERT INTO registros (fecha, hora, accion, tipo, productos_json) VALUES %L",
        valores
      )
    );
    await client.query("COMMIT");
    return { success: true, msg: "Sincronización completa." };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[TIMER] Error:", err);
    return { success: false, msg: "Error server." };
  } finally {
    client.release();
  }
}

// --- RUTAS API GENERALES (HORNO) ---
app.get("/", (req, res) => res.send("Backend Horno Funcionando"));

app.get("/api/registros", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, accion, tipo, productos_json, CAST(fecha::TEXT || ' ' || hora::TEXT AS TIMESTAMP) AT TIME ZONE 'America/Argentina/Buenos_Aires' AS timestamp FROM registros ORDER BY timestamp DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send("Error DB");
  }
});

app.get("/api/produccion", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM estado_produccion");
    const estado = rows.reduce((acc, row) => {
      acc[row.estacion_id] = JSON.parse(row.producto_actual || "[]");
      return acc;
    }, {});
    res.json(estado);
  } catch (err) {
    res.status(500).send("Error DB");
  }
});

app.post("/api/produccion", async (req, res) => {
  const { estacion_id, producto } = req.body;
  if (!estacion_id || !producto)
    return res.status(400).json({ msg: "Datos faltantes" });
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT producto_actual FROM estado_produccion WHERE estacion_id = $1 FOR UPDATE",
      [estacion_id]
    );
    let list = JSON.parse(rows[0]?.producto_actual || "[]");
    list.push(producto);
    await client.query(
      "UPDATE estado_produccion SET producto_actual = $1 WHERE estacion_id = $2",
      [JSON.stringify(list), estacion_id]
    );
    await client.query("COMMIT");
    res.json(list);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

app.delete("/api/produccion/:estacion_id", async (req, res) => {
  try {
    await db.query(
      "UPDATE estado_produccion SET producto_actual = '[]' WHERE estacion_id = $1",
      [req.params.estacion_id]
    );
    res.json({ msg: "Limpiado" });
  } catch (err) {
    res.status(500).send("Error DB");
  }
});

app.post("/api/sincronizar", async (req, res) => {
  const r = await sincronizarBaseDeDatos();
  res.status(r.success ? 200 : 500).json(r);
});

app.get("/api/leer-archivo", async (req, res) => {
  try {
    const contenidoDelArchivo = await leerArchivoHorno();
    res.type("text/plain");
    res.send(contenidoDelArchivo);
  } catch (err) {
    res.status(500).send("Error drive");
  }
});

app.get("/api/pedidos-analisis", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const buffer = await leerArchivoPedidos();
    const wb = XLSX.read(Buffer.from(buffer), {
      type: "buffer",
      cellDates: true,
    });
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    res.json(data);
    // ¡Ahora consultamos la base de datos local! (Milisegundos)
    const { rows } = await db.query(
      "SELECT * FROM pedidos ORDER BY fecha DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// =====================================================
// --- RUTAS INGENIERÍA ---
// =====================================================

// --- SEMIELABORADOS (Nivel 1) ---
app.post("/api/ingenieria/sincronizar-stock", async (req, res) => {
  const client = await db.connect();
  try {
    console.log("--- INICIO SINCRONIZACIÓN STOCK SEMIELABORADOS ---");
    const buffer = await leerStockSemielaborados();
    const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
      const rowString = JSON.stringify(rawMatrix[i]).toUpperCase();
      if (rowString.includes("CODIGO") && rowString.includes("STOCK")) {
        headerRowIndex = i;
        console.log(`¡ENCABEZADOS SEMI ENCONTRADOS EN LA FILA ${i + 1}!`);
        break;
      }
    }
    if (headerRowIndex === -1) {
      return res.status(400).json({
        msg: "No se encontró la tabla de stock (falta CODIGO o STOCK)",
      });
    }
    const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
    await client.query("BEGIN");
    let count = 0;
    for (const row of data) {
      let codigo = null,
        nombre = null,
        stock = 0;
      for (const key of Object.keys(row)) {
        const k = normalizarTexto(key);
        if (k === "CODIGO" || k === "CÓDIGO") codigo = row[key];
        else if (
          k.includes("ARTICULO") ||
          k.includes("NOMBRE") ||
          k.includes("DESCRIPCION")
        )
          nombre = row[key];
        else if (k === "STOCK" || k === "CANTIDAD" || k === "TOTAL")
          stock = row[key];
      }
      if (codigo) {
        await client.query(
          `INSERT INTO semielaborados (codigo, nombre, stock_actual, ultima_actualizacion)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (codigo) DO UPDATE SET stock_actual = $3, nombre = $2, ultima_actualizacion = NOW()`,
          [codigo, nombre || "Sin Nombre", Number(stock) || 0]
        );
        count++;
      }
    }
    await client.query("COMMIT");
    console.log(`--- FIN SYNC SEMI: ${count} items procesados ---`);
    res.json({ msg: "Stock de semielaborados sincronizado", count });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error Sync Stock:", err);
    res.status(500).send("Error al sincronizar stock");
  } finally {
    client.release();
  }
});

app.get("/api/ingenieria/semielaborados", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      "SELECT * FROM semielaborados ORDER BY nombre ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error DB");
  }
});

// --- PRODUCTOS TERMINADOS (Nivel 0) ---
app.post("/api/ingenieria/recetas", async (req, res) => {
  const { producto_terminado, items } = req.body;
  if (!producto_terminado) return res.status(400).json({ msg: "Falta nombre" });
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO productos_ingenieria (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING",
      [producto_terminado]
    );
    await client.query("DELETE FROM recetas WHERE producto_terminado = $1", [
      producto_terminado,
    ]);
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO recetas (producto_terminado, semielaborado_id, cantidad, ultima_actualizacion) 
           VALUES ($1, $2, $3, NOW())`,
          [producto_terminado, item.id, item.cantidad || 1]
        );
      }
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

// --- RECETAS DE PRODUCTOS TERMINADOS (Nivel 1) ---
app.get("/api/ingenieria/recetas/all", async (req, res) => {
  const client = await db.connect();
  try {
    res.setHeader("Cache-Control", "no-store");
    console.log("⚡ [API] Solicitando recetas (Modo Tolerante)...");

    // 1. Consulta con LEFT JOIN para traer todo, aunque el semielaborado no exista
    const query = `
      SELECT 
        r.producto_terminado,  -- <--- ASEGÚRATE QUE DIGA 'producto_terminado'
        r.cantidad, 
        r.semielaborado_id, 
        s.id as semi_existente_id, 
        s.codigo, 
        s.nombre
      FROM recetas r
      LEFT JOIN semielaborados s ON r.semielaborado_id = s.id
      ORDER BY r.producto_terminado
    `;

    const { rows } = await client.query(query);

    // 2. Agrupamiento SIN FILTROS
    const recetasAgrupadas = {};
    let alertas = 0;

    rows.forEach((row) => {
      const prod = row.producto_terminado; // <--- Usar la misma variable

      if (!recetasAgrupadas[prod]) {
        recetasAgrupadas[prod] = [];
      }

      const existeSemielaborado = !!row.semi_existente_id;
      if (!existeSemielaborado) alertas++;

      recetasAgrupadas[prod].push({
        semielaborado_id: row.semielaborado_id,
        codigo: row.codigo || "ERROR",
        nombre: row.nombre || `⚠️ ERROR: ID ${row.semielaborado_id} BORRADO`,
        cantidad: Number(row.cantidad),
        error: !existeSemielaborado,
      });
    });

    console.log(
      `📦 [API] Enviando ${Object.keys(recetasAgrupadas).length} productos.`
    );
    if (alertas > 0)
      console.log(
        `🚨 [API] Se enviaron ${alertas} ingredientes rotos para diagnóstico.`
      );

    res.json(recetasAgrupadas);
  } catch (err) {
    console.error("❌ [API] Error en /api/ingenieria/recetas/all:", err);
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

app.get("/api/ingenieria/recetas/:producto", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      `SELECT r.*, s.codigo, s.nombre, s.stock_actual,
       (SELECT TO_CHAR(MAX(ultima_actualizacion) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') 
        FROM recetas WHERE producto_terminado = $1) as fecha_receta
       FROM recetas r
       JOIN semielaborados s ON r.semielaborado_id = s.id
       WHERE r.producto_terminado = $1`,
      [req.params.producto]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// --- MATERIAS PRIMAS (Nivel 2) ---
app.post("/api/ingenieria/sincronizar-mp", async (req, res) => {
  const client = await db.connect();
  try {
    console.log("--- INICIO SINCRONIZACIÓN MATERIAS PRIMAS ---");
    const buffer = await leerMateriasPrimas();
    const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
      const rowString = JSON.stringify(rawMatrix[i]).toUpperCase();
      if (rowString.includes("CODIGO") && rowString.includes("NOMBRE")) {
        headerRowIndex = i;
        console.log(`¡ENCABEZADOS MP ENCONTRADOS EN LA FILA ${i + 1}!`);
        break;
      }
    }
    if (headerRowIndex === -1) {
      throw new Error(
        "No se encontraron los encabezados (CODIGO, NOMBRE) en las primeras 20 filas."
      );
    }
    const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
    await client.query("BEGIN");
    let count = 0;
    for (const row of data) {
      let codigo = null,
        nombre = null,
        stock = 0;
      for (const key of Object.keys(row)) {
        const k = key.trim().toUpperCase();
        if (k === "CODIGO") codigo = row[key];
        else if (k === "NOMBRE") nombre = row[key];
        else if (k === "STOCKS" || k === "STOCK") stock = row[key];
      }
      if (codigo) {
        await client.query(
          `INSERT INTO materias_primas (codigo, nombre, stock_actual, ultima_actualizacion)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (codigo) DO UPDATE SET stock_actual = $3, nombre = $2, ultima_actualizacion = NOW()`,
          [codigo, nombre || "Sin Nombre", Number(stock) || 0]
        );
        count++;
      }
    }
    await client.query("COMMIT");
    console.log(`--- FIN SYNC MP: ${count} items procesados ---`);
    res.json({ msg: `Sincronizadas ${count} materias primas` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error Sync MP:", err);
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

app.get("/api/ingenieria/materias-primas", async (req, res) => {
  const { rows } = await db.query(
    "SELECT * FROM materias_primas ORDER BY nombre ASC"
  );
  res.json(rows);
});

// --- RECETAS DE SEMIELABORADOS (Nivel 2) ---

// =========================================================
// --- INICIO DE LA SECCIÓN CORREGIDA ---
// =========================================================

// --- RECETAS DE SEMIELABORADOS (Nivel 2) ---
app.get("/api/ingenieria/recetas-semielaborados/all", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(`
            SELECT 
                s.nombre as semi_nombre,
                r.semielaborado_id, 
                r.cantidad, 
                mp.id as materia_prima_id, 
                mp.codigo, 
                mp.nombre as mp_nombre
            FROM recetas_semielaborados r
            JOIN materias_primas mp ON r.materia_prima_id = mp.id
            JOIN semielaborados s ON r.semielaborado_id = s.id
        `);

    const recetasAgrupadas = rows.reduce((acc, row) => {
      // --- CORRECCIÓN: Usar ID en lugar de NOMBRE ---
      const idClave = row.semielaborado_id;

      if (!acc[idClave]) {
        acc[idClave] = [];
      }
      acc[idClave].push({
        materia_prima_id: row.materia_prima_id,
        codigo: row.codigo,
        nombre: row.mp_nombre,
        cantidad: Number(row.cantidad),
      });
      return acc;
    }, {});

    res.json(recetasAgrupadas);
  } catch (err) {
    console.error("[ERROR BACKEND] /recetas-semielaborados/all:", err);
    res.status(500).send(err.message);
  }
});

// ORDEN CORREGIDO: La ruta '/:id' DEBE IR DESPUÉS.
app.get("/api/ingenieria/recetas-semielaborados/:id", async (req, res) => {
  try {
    // CORRECCIÓN: Usar 'r.cantidad' aquí también
    const { rows } = await db.query(
      `SELECT r.id, r.semielaborado_id, r.materia_prima_id, r.cantidad, mp.codigo, mp.nombre, mp.stock_actual
       FROM recetas_semielaborados r
       JOIN materias_primas mp ON r.materia_prima_id = mp.id
       WHERE r.semielaborado_id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/api/ingenieria/recetas-semielaborados", async (req, res) => {
  const { semielaborado_id, items } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM recetas_semielaborados WHERE semielaborado_id = $1",
      [semielaborado_id]
    );
    for (const item of items) {
      await client.query(
        "INSERT INTO recetas_semielaborados (semielaborado_id, materia_prima_id, cantidad) VALUES ($1, $2, $3)",
        [semielaborado_id, item.id, item.cantidad || 1]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

// =========================================================
// --- FIN DE LA SECCIÓN CORREGIDA ---
// =========================================================

// =====================================================
// --- RUTAS DE PLANIFICACIÓN (USANDO 'cantidad_requerida') ---
// =====================================================

// 1. OBTENER TODOS los planes guardados
app.get("/api/planificacion", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      "SELECT * FROM planes_produccion ORDER BY fecha_creacion DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// 1b. OBTENER SÓLO los planes ABIERTOS (para el nuevo panel de carga)
app.get("/api/planificacion/abiertos", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      "SELECT id, nombre FROM planes_produccion WHERE estado = 'ABIERTO' ORDER BY fecha_creacion DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// 2. OBTENER UN PLAN Específico (con progreso)
app.get("/api/planificacion/:id", async (req, res) => {
  const { id } = req.params;
  try {
    res.setHeader("Cache-Control", "no-store");
    const planRes = await db.query(
      "SELECT * FROM planes_produccion WHERE id = $1",
      [id]
    );
    if (planRes.rows.length === 0) {
      return res.status(404).json({ msg: "Plan no encontrado" });
    }
    const plan = planRes.rows[0];
    const itemsRes = await db.query(
      `SELECT 
         pi.id as plan_item_id, 
         pi.cantidad_requerida,
         pi.cantidad_producida,
         s.id,
         s.nombre,
         s.codigo
       FROM planes_items pi
       JOIN semielaborados s ON pi.semielaborado_id = s.id
       WHERE pi.plan_id = $1`,
      [id]
    );
    plan.items = itemsRes.rows.map((row) => ({
      plan_item_id: row.plan_item_id,
      semielaborado: { id: row.id, nombre: row.nombre, codigo: row.codigo },
      cantidad: Number(row.cantidad_requerida),
      producido: Number(row.cantidad_producida),
    }));
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// 2b. OBTENER STATS DE OPERARIOS PARA UN PLAN (¡NUEVO!)
app.get("/api/planificacion/:id/operarios", async (req, res) => {
  const { id } = req.params;
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      `SELECT o.nombre, SUM(r.cantidad_ok) as total_producido
       FROM registros_produccion r
       JOIN operarios o ON r.operario_id = o.id
       JOIN planes_items pi ON r.plan_item_id = pi.id
       WHERE pi.plan_id = $1
       GROUP BY o.nombre
       ORDER BY total_producido DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// 2c. OBTENER HISTORIAL DE PRODUCCIÓN DETALLADO DE UN PLAN (NUEVO)
app.get("/api/planificacion/:id/historial", async (req, res) => {
  const { id } = req.params;
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      `SELECT 
         rp.id,
         s.nombre as semielaborado,
         o.nombre as operario,
         rp.cantidad_ok as cantidad,
         rp.cantidad_scrap as scrap,  
         rp.motivo_scrap as motivo,   
         rp.fecha_produccion
       FROM registros_produccion rp
       JOIN planes_items pi ON rp.plan_item_id = pi.id
       JOIN semielaborados s ON rp.semielaborado_id = s.id
       JOIN operarios o ON rp.operario_id = o.id
       WHERE pi.plan_id = $1
       ORDER BY rp.fecha_produccion DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// 2c. NUEVO ENDPOINT: OBTENER REGISTROS DE PRODUCCIÓN DETALLADOS POR PLAN
app.get("/api/planificacion/:id/producciones", async (req, res) => {
  const { id } = req.params;
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      `SELECT 
         rp.id, 
         rp.cantidad_ok, 
         rp.cantidad_scrap, 
         rp.motivo_scrap, 
         rp.turno,
         TO_CHAR(rp.fecha_produccion AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') as fecha_hora,
         o.nombre as operario_nombre,
         s.nombre as semielaborado_nombre
       FROM registros_produccion rp
       JOIN operarios o ON rp.operario_id = o.id
       JOIN planes_items pi ON rp.plan_item_id = pi.id
       JOIN semielaborados s ON pi.semielaborado_id = s.id
       WHERE pi.plan_id = $1
       ORDER BY rp.fecha_produccion DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// 3. GUARDAR UN NUEVO plan
app.post("/api/planificacion", async (req, res) => {
  const { nombre, items } = req.body;
  if (!nombre || !items || items.length === 0) {
    return res.status(400).json({ msg: "Faltan datos (nombre o items)" });
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const planRes = await client.query(
      "INSERT INTO planes_produccion (nombre, estado) VALUES ($1, 'ABIERTO') RETURNING id",
      [nombre]
    );
    const planId = planRes.rows[0].id;
    for (const item of items) {
      await client.query(
        "INSERT INTO planes_items (plan_id, semielaborado_id, cantidad_requerida, cantidad_producida) VALUES ($1, $2, $3, $4)",
        [planId, item.semielaborado.id, item.cantidad, item.producido || 0]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ success: true, planId: planId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error guardando plan:", err);
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

// 4. ACTUALIZAR EL ESTADO de un plan
app.put("/api/planificacion/:id/estado", async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  if (!estado) {
    return res.status(400).json({ msg: "Falta el nuevo estado" });
  }
  try {
    const result = await db.query(
      "UPDATE planes_produccion SET estado = $1 WHERE id = $2 RETURNING *",
      [estado, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Plan no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error actualizando estado:", err);
    res.status(500).send(err.message);
  }
});

// 5. ACTUALIZAR UN PLAN COMPLETO (Nombre y/o Items)
app.put("/api/planificacion/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, items } = req.body;
  if (!nombre || !items) {
    return res.status(400).json({ msg: "Faltan datos (nombre o items)" });
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE planes_produccion SET nombre = $1 WHERE id = $2",
      [nombre, id]
    );
    await client.query("DELETE FROM planes_items WHERE plan_id = $1", [id]);
    for (const item of items) {
      await client.query(
        "INSERT INTO planes_items (plan_id, semielaborado_id, cantidad_requerida, cantidad_producida) VALUES ($1, $2, $3, $4)",
        [id, item.semielaborado.id, item.cantidad, item.producido || 0]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, planId: id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error actualizando plan:", err);
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

// 6. ELIMINAR UN PLAN
app.delete("/api/planificacion/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      "DELETE FROM planes_produccion WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Plan no encontrado" });
    }
    res.json({ success: true, msg: `Plan ${id} eliminado.` });
  } catch (err) {
    console.error("Error eliminando plan:", err);
    res.status(500).send(err.message);
  }
});

// 7. REGISTRAR PRODUCCIÓN (Carga Rápida) - MODIFICADA PARA FALLAS Y TURNO
app.post("/api/produccion/registrar-a-plan", async (req, res) => {
  const {
    plan_id,
    semielaborado_id,
    cantidad_ok,
    cantidad_scrap,
    operario_id,
    motivo_scrap = "", // Puede ser vacío si scrap es 0
    turno,
    fecha_produccion, // Viene como string "YYYY-MM-DD"
  } = req.body;

  if (!plan_id || !semielaborado_id || !operario_id || !turno) {
    return res.status(400).json({
      msg: "Faltan datos obligatorios (plan, semielaborado, operario o turno)",
    });
  }

  const ok = Number(cantidad_ok) || 0;
  const scrap = Number(cantidad_scrap) || 0;
  const total_producido = ok + scrap;

  if (total_producido <= 0) {
    return res.status(400).json({
      msg: "La cantidad total producida (OK + Fallas) debe ser mayor a 0.",
    });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // --- PASO 1: Encontrar el plan_item_id ---
    const itemRes = await client.query(
      `SELECT id, (SELECT nombre FROM planes_produccion WHERE id = $1) as plan_nombre 
       FROM planes_items 
       WHERE plan_id = $1 AND semielaborado_id = $2`,
      [plan_id, semielaborado_id]
    );

    if (itemRes.rowCount === 0) {
      return res.status(404).json({
        msg: "Error: El producto no existe en el plan seleccionado. No se pudo registrar.",
      });
    }

    const plan_item_id = itemRes.rows[0].id;
    const plan_nombre = itemRes.rows[0].plan_nombre;
    const prodDate = fecha_produccion
      ? `${fecha_produccion} 12:00:00`
      : "NOW()"; // Usamos 12:00:00 para evitar problemas de timezone con sólo la fecha

    // --- PASO 2: Actualizar el progreso en planes_items (SOLO con la cantidad OK) ---
    const updateRes = await client.query(
      `UPDATE planes_items 
        SET cantidad_producida = cantidad_producida + $1 
        WHERE id = $2
        RETURNING cantidad_producida`,
      [ok, plan_item_id] // SOLO SUMAMOS CANTIDAD OK
    );

    // --- PASO 3: Insertar el registro granular (CON TODOS LOS DETALLES) ---
    await client.query(
      `INSERT INTO registros_produccion (plan_item_id, semielaborado_id, operario_id, cantidad_ok, cantidad_scrap, motivo_scrap, turno, fecha_produccion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        plan_item_id,
        semielaborado_id,
        operario_id,
        ok,
        scrap,
        motivo_scrap,
        turno,
        prodDate,
      ]
    );

    // Si todo salió bien, confirmamos la transacción
    await client.query("COMMIT");

    res.json({
      success: true,
      msg: `Producción registrada en el plan '${plan_nombre}'. (OK: ${ok}, Fallas: ${scrap})`,
      nuevo_total: updateRes.rows[0].cantidad_producida,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error registrando producción:", err);
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

// =====================================================
// --- NUEVAS RUTAS DE OPERARIOS (CRUD) ---
// =====================================================

// 1. OBTENER TODOS los operarios
app.get("/api/operarios", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      "SELECT * FROM operarios WHERE activo = true ORDER BY nombre ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// 2. AÑADIR UN NUEVO operario
app.post("/api/operarios", async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) {
    return res.status(400).json({ msg: "El nombre es obligatorio." });
  }
  try {
    const { rows } = await db.query(
      "INSERT INTO operarios (nombre) VALUES ($1) RETURNING *",
      [nombre]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      // Unique violation
      return res
        .status(409)
        .json({ msg: "Ya existe un operario con ese nombre." });
    }
    console.error(err);
    res.status(500).send(err.message);
  }
});

// 3. ELIMINAR (desactivar) UN operario
app.delete("/api/operarios/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Implementamos borrado lógico (desactivar) para no perder métricas
    const result = await db.query(
      "UPDATE operarios SET activo = false WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Operario no encontrado" });
    }
    res.json({
      success: true,
      msg: `Operario ${result.rows[0].nombre} desactivado.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// 4. OBTENER ESTADÍSTICAS de un operario (¡NUEVO!)
app.get("/api/operarios/:id/stats", async (req, res) => {
  const { id } = req.params;
  try {
    res.setHeader("Cache-Control", "no-store");

    // 1. Consulta de Operario (Igual)
    const operarioRes = db.query("SELECT nombre FROM operarios WHERE id = $1", [
      id,
    ]);

    // 2. Consulta Total (Igual)
    const totalRes = db.query(
      "SELECT SUM(cantidad_ok) as total_unidades FROM registros_produccion WHERE operario_id = $1",
      [id]
    );

    // 3. Top Producto (Igual)
    const topProductoRes = db.query(
      `SELECT s.nombre, SUM(r.cantidad_ok) as total
       FROM registros_produccion r
       JOIN semielaborados s ON r.semielaborado_id = s.id
       WHERE r.operario_id = $1
       GROUP BY s.nombre
       ORDER BY total DESC
       LIMIT 1`,
      [id]
    );

    // 4. Actividad Reciente (MODIFICADO: Incluye el nombre del Plan)
    const recienteRes = db.query(
      `SELECT 
         r.id,
         s.nombre, 
         r.cantidad_ok as cantidad, 
         r.cantidad_scrap,
         r.motivo_scrap,
         r.fecha_produccion,
         r.turno,
         pp.nombre as plan_nombre
       FROM registros_produccion r
       JOIN semielaborados s ON r.semielaborado_id = s.id
       -- Hacemos LEFT JOIN por si el plan fue borrado, para no perder el registro
       LEFT JOIN planes_items pi ON r.plan_item_id = pi.id
       LEFT JOIN planes_produccion pp ON pi.plan_id = pp.id
       WHERE r.operario_id = $1
       ORDER BY r.fecha_produccion DESC
       LIMIT 10`,
      [id]
    );

    const [op, total, top, reciente] = await Promise.all([
      operarioRes,
      totalRes,
      topProductoRes,
      recienteRes,
    ]);

    if (op.rows.length === 0) {
      return res.status(404).json({ msg: "Operario no encontrado" });
    }

    res.json({
      nombre: op.rows[0].nombre,
      totalUnidades: total.rows[0].total_unidades || 0,
      topProducto: top.rows[0] || null,
      actividadReciente: reciente.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// --- FUNCIÓN MÁGICA: Detectar despachos y descontar stock en Quintana ---
async function procesarDespachosAutomaticos(client) {
  console.log("🚚 [DESPACHOS] Buscando nuevos despachos para procesar...");

  // 1. Buscar pedidos con fecha de despacho
  const { rows: despachados } = await client.query(`
    SELECT * FROM pedidos WHERE fecha_despacho IS NOT NULL
  `);

  let procesados = 0;

  for (const pedido of despachados) {
    // 2. Buscar la receta de este producto terminado
    // (Asumimos que el 'modelo' del pedido coincide con 'producto_terminado' en recetas)
    const recetaRes = await client.query(`
      SELECT r.cantidad, s.nombre, s.id as semi_id
      FROM recetas r
      JOIN semielaborados s ON r.semielaborado_id = s.id
      WHERE r.producto_terminado = $1
    `, [pedido.modelo]);

    // Si no hay receta, no podemos descontar nada
    if (recetaRes.rows.length === 0) continue;

    for (const ing of recetaRes.rows) {
      const cantidadADescontar = Number(pedido.cantidad) * Number(ing.cantidad);

      // 3. Verificar si ya procesamos este despacho específico
      // (Usamos OC, Cliente, Modelo y Fecha como "clave única" del movimiento)
      const existe = await client.query(`
          SELECT 1 FROM historial_despachos 
          WHERE oc = $1 AND modelo_producto = $2 AND cliente = $3 
          AND fecha_despacho = $4 AND semielaborado_nombre = $5
       `, [pedido.oc, pedido.modelo, pedido.cliente, pedido.fecha_despacho, ing.nombre]);

      if (existe.rowCount === 0) {
        // ¡ES NUEVO! -> Descontar de Quintana y Registrar

        // A. Descontar de Quintana
        await client.query(`
            UPDATE semielaborados 
            SET stock_deposito_quintana = stock_deposito_quintana - $1 
            WHERE id = $2
          `, [cantidadADescontar, ing.semi_id]);

        // B. Guardar en Historial
        await client.query(`
            INSERT INTO historial_despachos (fecha_despacho, cliente, oc, modelo_producto, semielaborado_nombre, cantidad_descontada)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [pedido.fecha_despacho, pedido.cliente, pedido.oc, pedido.modelo, ing.nombre, cantidadADescontar]);

        procesados++;
      }
    }
  }

  if (procesados > 0) console.log(`✅ [DESPACHOS] Se procesaron ${procesados} movimientos de stock automáticos.`);
}

// --- FUNCIÓN: Detectar despachos y descontar stock en Quintana ---
async function procesarDespachosAutomaticos(client) {
  console.log("🚚 [DESPACHOS] Buscando nuevos despachos...");
  const { rows: despachados } = await client.query("SELECT * FROM pedidos WHERE fecha_despacho IS NOT NULL");
  let procesados = 0;

  for (const pedido of despachados) {
    // Buscar receta
    const recetaRes = await client.query(`
      SELECT r.cantidad, s.nombre, s.id as semi_id
      FROM recetas r
      JOIN semielaborados s ON r.semielaborado_id = s.id
      WHERE r.producto_terminado = $1
    `, [pedido.modelo]);

    if (recetaRes.rows.length === 0) continue;

    for (const ing of recetaRes.rows) {
      const cantidadADescontar = Number(pedido.cantidad) * Number(ing.cantidad);

      // Verificar si ya se procesó este despacho
      const existe = await client.query(`
          SELECT 1 FROM historial_despachos 
          WHERE oc = $1 AND modelo_producto = $2 AND cliente = $3 
          AND fecha_despacho = $4 AND semielaborado_nombre = $5
       `, [pedido.oc, pedido.modelo, pedido.cliente, pedido.fecha_despacho, ing.nombre]);

      if (existe.rowCount === 0) {
        // Descontar de Quintana
        await client.query(`UPDATE semielaborados SET stock_deposito_quintana = stock_deposito_quintana - $1 WHERE id = $2`, [cantidadADescontar, ing.semi_id]);
        // Registrar en Historial
        await client.query(`INSERT INTO historial_despachos (fecha_despacho, cliente, oc, modelo_producto, semielaborado_nombre, cantidad_descontada) VALUES ($1, $2, $3, $4, $5, $6)`, [pedido.fecha_despacho, pedido.cliente, pedido.oc, pedido.modelo, ing.nombre, cantidadADescontar]);
        procesados++;
      }
    }
  }
  if (procesados > 0) console.log(`✅ [DESPACHOS] Se procesaron ${procesados} movimientos automáticos.`);
}

// --- FUNCIÓN DE NORMALIZACIÓN DE CLAVES ---
// Convierte "  Cliente  " -> "CLIENTE" para evitar errores de tipeo en Excel
const normalizarHeader = (obj) => {
  const newObj = {};
  Object.keys(obj).forEach(key => {
    const cleanKey = key.trim().toUpperCase();
    newObj[cleanKey] = obj[key];
  });
  return newObj;
};

// --- FUNCIÓN DE SINCRONIZACIÓN MEJORADA (Filtro 2025 + Limpieza de datos) ---
async function sincronizarPedidos() {
  console.log("⏳ [SYNC] Iniciando sincronización de Pedidos (Excel -> DB)...");

  // NOTA: Movemos la conexión aquí abajo para no ocupar el cliente mientras descargamos
  // 1. Descargar y Procesar Excel (Esto no usa DB)
  let rawData = [];
  try {
    const buffer = await leerArchivoPedidos();
    const wb = XLSX.read(Buffer.from(buffer), {
      type: "buffer",
      cellDates: true,
    });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rawData = XLSX.utils.sheet_to_json(sheet);
  } catch (e) {
    console.error("❌ [SYNC] Error descargando Excel:", e.message);
    return; // Salimos si falla la descarga
  }

  const client = await db.connect();
  try {
    const FECHA_CORTE = new Date("2025-01-01");
    const valoresInsertar = [];

    // 2. Preparar datos en memoria
    for (const r of rawData) {
      const fechaRaw = r.FECHA || r.Fecha || r.fecha;
      let fecha = null;
      if (fechaRaw) fecha = new Date(fechaRaw);

      // Filtro
      if (!fecha || isNaN(fecha.getTime()) || fecha < FECHA_CORTE) continue;

      // Limpieza Cantidad
      let cantidadRaw = r.CANTIDAD || r.Cantidad || r.cantidad || 0;
      let cantidad = 0;
      if (typeof cantidadRaw === "number") {
        cantidad = cantidadRaw;
      } else {
        const limpio = String(cantidadRaw)
          .replace(/,/g, ".")
          .replace(/[^\d.-]/g, "");
        cantidad = parseFloat(limpio);
        if (isNaN(cantidad)) cantidad = 0;
      }

      const cliente = r.CLIENTE || r.Cliente || r.cliente || null;
      const modelo = r.MODELO || r.Modelo || r.modelo || null;
      const oc = r.OC || r.oc || null;
      const estado = r.ESTADO || r.Estado || r.estado || null;
      const detalles = r.DETALLES || r.Detalles || r.detalles || null;

      valoresInsertar.push([
        fecha,
        cliente,
        modelo,
        cantidad,
        oc,
        estado,
        detalles,
      ]);
    }

    // 3. Inserción por LOTES (Batching) - ¡LA SOLUCIÓN AL TIMEOUT!
    await client.query("BEGIN");
    await client.query("TRUNCATE TABLE pedidos RESTART IDENTITY");

    const TAMANO_LOTE = 500; // Insertamos de a 500 filas (muy rápido)
    console.log(
      `📦 [SYNC] Insertando ${valoresInsertar.length} registros en lotes de ${TAMANO_LOTE}...`
    );

    for (let i = 0; i < valoresInsertar.length; i += TAMANO_LOTE) {
      const lote = valoresInsertar.slice(i, i + TAMANO_LOTE);
      const query = format(
        "INSERT INTO pedidos (fecha, cliente, modelo, cantidad, oc, estado, detalles) VALUES %L",
        lote
      );
      await client.query(query);
    }

    await client.query("COMMIT");
    console.log("✅ [SYNC] Sincronización completada con éxito.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ [SYNC] Error en base de datos:", err.message);
  } finally {
    client.release();
  }
}


// =====================================================
// --- RUTAS DE LOGÍSTICA (CORREGIDAS: 4 UBICACIONES) ---
// =====================================================

// 1. OBTENER STOCK (Lectura corregida)
app.get("/api/logistica/stock", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    // CORRECCIÓN: Usamos los nombres REALES de la base de datos
    const { rows } = await db.query(
      `SELECT id, codigo, nombre, 
        stock_planta_26, 
        stock_planta_37, 
        stock_deposito_ayolas, 
        stock_deposito_quintana 
       FROM semielaborados ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 2. ENVÍO (Escritura corregida)
app.post("/api/logistica/enviar", async (req, res) => {
  const { items, origen, destino, chofer } = req.body;

  // Mapa actualizado de Nombres Frontend -> Columnas Backend
  const colMap = {
    'PLANTA_26': 'stock_planta_26',
    'PLANTA_37': 'stock_planta_37',
    'DEP_AYOLAS': 'stock_deposito_ayolas',
    'DEP_QUINTANA': 'stock_deposito_quintana',
    // Compatibilidad (por si quedó algún default viejo)
    'PLANTA_1': 'stock_planta_26',
    'PLANTA_2': 'stock_planta_37',
    'DEPOSITO': 'stock_deposito_ayolas'
  };

  const colOrigen = colMap[origen];
  const codigo_remito = `REM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  if (!colOrigen) return res.status(400).json({ msg: "Origen no válido" });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      await client.query(
        `UPDATE semielaborados SET ${colOrigen} = ${colOrigen} - $1 WHERE id = $2`,
        [item.cantidad, item.id]
      );
      await client.query(
        `INSERT INTO movimientos_logistica (semielaborado_id, cantidad, origen, destino, estado, codigo_remito, chofer)
           VALUES ($1, $2, $3, $4, 'EN_TRANSITO', $5, $6)`,
        [item.id, item.cantidad, origen, destino, codigo_remito, chofer || "-"]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, codigo_remito });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

// 3. RECIBIR (Escritura corregida)
app.post("/api/logistica/recibir", async (req, res) => {
  const { codigo_remito } = req.body;

  const colMap = {
    'PLANTA_26': 'stock_planta_26',
    'PLANTA_37': 'stock_planta_37',
    'DEP_AYOLAS': 'stock_deposito_ayolas',
    'DEP_QUINTANA': 'stock_deposito_quintana',
    'PLANTA_1': 'stock_planta_26',
    'PLANTA_2': 'stock_planta_37',
    'DEPOSITO': 'stock_deposito_ayolas'
  };

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const movRes = await client.query(
      "SELECT * FROM movimientos_logistica WHERE codigo_remito = $1 AND estado = 'EN_TRANSITO'",
      [codigo_remito]
    );

    if (movRes.rows.length === 0) throw new Error("Remito no encontrado o ya recibido.");

    const destino = movRes.rows[0].destino;
    const colDestino = colMap[destino];

    if (!colDestino) throw new Error("Destino del remito no válido en el sistema actual.");

    for (const mov of movRes.rows) {
      await client.query(
        `UPDATE semielaborados SET ${colDestino} = ${colDestino} + $1 WHERE id = $2`,
        [mov.cantidad, mov.semielaborado_id]
      );
      await client.query(
        "UPDATE movimientos_logistica SET estado = 'RECIBIDO', fecha_recepcion = NOW() WHERE id = $1",
        [mov.id]
      );
    }

    await client.query("COMMIT");
    res.json({
      success: true,
      msg: `Recibidos ${movRes.rowCount} ítems en ${destino}.`,
      origen: movRes.rows[0].origen,
      destino
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ msg: err.message });
  } finally {
    client.release();
  }
});

// 4. EDICIÓN MANUAL (Actualización corregida)
app.put("/api/logistica/stock/:id", async (req, res) => {
  const { id } = req.params;
  const { p26, p37, ayolas, quintana } = req.body;

  try {
    await db.query(
      `UPDATE semielaborados SET 
         stock_planta_26 = $1, 
         stock_planta_37 = $2, 
         stock_deposito_ayolas = $3, 
         stock_deposito_quintana = $4 
       WHERE id = $5`,
      [Number(p26) || 0, Number(p37) || 0, Number(ayolas) || 0, Number(quintana) || 0, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/api/logistica/historial", async (req, res) => {
  try {
    // AQUÍ ESTABA EL 404: Ahora está definido correctamente
    const { rows } = await db.query("SELECT codigo_remito, origen, destino, chofer, estado, MIN(fecha_creacion) as fecha, COUNT(*) as total_items, SUM(cantidad) as total_unidades FROM movimientos_logistica GROUP BY codigo_remito, origen, destino, chofer, estado ORDER BY fecha DESC LIMIT 50");
    return res.json(rows);
  } catch (e) { return res.status(500).send(e.message); }
});

app.get("/api/logistica/despachos-automaticos", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM historial_despachos ORDER BY fecha_despacho DESC LIMIT 100");
    return res.json(rows);
  } catch (e) { return res.status(500).send(e.message); }
});

// Reemplaza la función iniciarServidor
async function iniciarServidor() {
  await setupAuth();
  await inicializarTablas(); // Creará la tabla 'pedidos' nueva
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

  // Tareas en segundo plano
  console.log("🚀 Iniciando servicios background...");
  sincronizarBaseDeDatos().then(() => setInterval(sincronizarBaseDeDatos, 2 * 60 * 1000));
  sincronizarPedidos().then(() => setInterval(sincronizarPedidos, 15 * 60 * 1000)); // Cada 15 min
}

iniciarServidor()
