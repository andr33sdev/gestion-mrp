// backend/index.js
const express = require("express");
const cors = require("cors");
const db = require("./db");
const {
  leerArchivoHorno,
  setupAuth,
  leerArchivoPedidos,
  leerStockSemielaborados,
  leerMateriasPrimas, // Importamos la nueva función
} = require("./google-drive");
const { parsearLog } = require("./parser");
const format = require("pg-format");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --- FUNCIÓN DE INICIO: VERIFICA Y CORRIGE LA BASE DE DATOS ---
async function inicializarTablas() {
  const client = await db.connect();
  try {
    console.log("Verificando tablas de base de datos...");

    // Tablas de Horno
    await client.query(`
      CREATE TABLE IF NOT EXISTS estado_produccion (
        estacion_id INTEGER PRIMARY KEY,
        producto_actual TEXT
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS registros (
        id SERIAL PRIMARY KEY,
        fecha DATE,
        hora TIME,
        accion TEXT,
        tipo VARCHAR(50),
        productos_json TEXT
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS semielaborados (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(100) UNIQUE NOT NULL,
        nombre VARCHAR(255),
        stock_actual NUMERIC DEFAULT 0,
        ultima_actualizacion TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tablas de Ingeniería (Nivel 1 y 2)
    await client.query(`
      CREATE TABLE IF NOT EXISTS productos_ingenieria (
        nombre VARCHAR(255) PRIMARY KEY
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS recetas (
        id SERIAL PRIMARY KEY,
        producto_terminado VARCHAR(255) REFERENCES productos_ingenieria(nombre) ON DELETE CASCADE,
        semielaborado_id INTEGER REFERENCES semielaborados(id),
        cantidad NUMERIC DEFAULT 1,
        ultima_actualizacion TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS materias_primas (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(100) UNIQUE NOT NULL,
        nombre VARCHAR(255),
        stock_actual NUMERIC DEFAULT 0,
        ultima_actualizacion TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS recetas_semielaborados (
        id SERIAL PRIMARY KEY,
        semielaborado_id INTEGER REFERENCES semielaborados(id) ON DELETE CASCADE,
        materia_prima_id INTEGER REFERENCES materias_primas(id) ON DELETE CASCADE,
        cantidad NUMERIC DEFAULT 1,
        CONSTRAINT uq_receta_semi UNIQUE(semielaborado_id, materia_prima_id)
      );
    `);

    // --- Tablas de Planificación (CON LÓGICA DE CORRECCIÓN) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS planes_produccion (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        fecha_creacion TIMESTAMP DEFAULT NOW(),
        estado VARCHAR(50) DEFAULT 'ABIERTO'
      );
    `);

    // 1. Crear la tabla 'planes_items' (si no existe) con el nombre 'cantidad' original (por si acaso)
    await client.query(`
      CREATE TABLE IF NOT EXISTS planes_items (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES planes_produccion(id) ON DELETE CASCADE,
        semielaborado_id INTEGER REFERENCES semielaborados(id),
        cantidad NUMERIC NOT NULL DEFAULT 0 
        -- (Si la tabla ya existe, este comando no hace nada)
      );
    `);

    // 2. CORRECCIÓN A: Renombrar 'cantidad' a 'cantidad_requerida'
    try {
      await client.query(`
        ALTER TABLE planes_items 
        RENAME COLUMN cantidad TO cantidad_requerida;
      `);
      console.log("✔ Columna 'cantidad' renombrada a 'cantidad_requerida'.");
    } catch (e) {
      if (e.code === "42701") {
        // 42701 = column 'cantidad_requerida' already exists
        console.log("i Columna 'cantidad_requerida' ya existía.");
      } else if (e.code === "42703") {
        // 42703 = column 'cantidad' does not exist
        console.log(
          "i Columna 'cantidad' no existía, saltando renombrado (ya estaba ok)."
        );
      } else {
        throw e; // Lanzar otros errores
      }
    }

    // 3. CORRECCIÓN B: Añadir 'cantidad_producida'
    try {
      await client.query(`
        ALTER TABLE planes_items 
        ADD COLUMN cantidad_producida NUMERIC NOT NULL DEFAULT 0;
      `);
      console.log("✔ Columna 'cantidad_producida' añadida a planes_items.");
    } catch (e) {
      if (e.code === "42701") {
        // 42701 = column 'cantidad_producida' already exists
        console.log("i Columna 'cantidad_producida' ya existía.");
      } else {
        throw e; // Lanzar otros errores
      }
    }

    console.log("✔ Todas las tablas fueron verificadas y corregidas.");
  } catch (err) {
    console.error("❌ Error fatal inicializando tablas:", err.message);
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
  } catch (err) {
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
      return res
        .status(400)
        .json({
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

app.get("/api/ingenieria/recetas/all", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows: manualProds } = await db.query(
      "SELECT nombre FROM productos_ingenieria"
    );
    const { rows: recipes } = await db.query(
      `SELECT r.producto_terminado, r.cantidad, s.id as semielaborado_id, s.codigo, s.nombre
       FROM recetas r
       JOIN semielaborados s ON r.semielaborado_id = s.id`
    );
    const recetasAgrupadas = {};
    manualProds.forEach((p) => {
      recetasAgrupadas[p.nombre] = [];
    });
    recipes.forEach((row) => {
      const prod = row.producto_terminado;
      if (!recetasAgrupadas[prod]) recetasAgrupadas[prod] = [];
      recetasAgrupadas[prod].push({
        semielaborado_id: row.semielaborado_id,
        codigo: row.codigo,
        nombre: row.nombre,
        cantidad: row.cantidad,
      });
    });
    res.json(recetasAgrupadas);
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

app.get("/api/ingenieria/recetas-semielaborados/:id", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*, mp.codigo, mp.nombre, mp.stock_actual
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

app.get("/api/ingenieria/recetas-semielaborados/all", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      `SELECT r.semielaborado_id, r.cantidad, mp.id as materia_prima_id, mp.codigo, mp.nombre
       FROM recetas_semielaborados r
       JOIN materias_primas mp ON r.materia_prima_id = mp.id`
    );
    const recetasAgrupadas = rows.reduce((acc, row) => {
      const semi_id = row.semielaborado_id;
      if (!acc[semi_id]) acc[semi_id] = [];
      acc[semi_id].push({
        materia_prima_id: row.materia_prima_id,
        codigo: row.codigo,
        nombre: row.nombre,
        cantidad: Number(row.cantidad),
      });
      return acc;
    }, {});
    res.json(recetasAgrupadas);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// =====================================================
// --- RUTAS DE PLANIFICACIÓN (NUEVAS) ---
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

// --- INICIO DEL SERVIDOR ---
async function iniciarServidor() {
  await setupAuth();
  await inicializarTablas(); // Asegura que las tablas existan Y ESTÉN CORREGIDAS
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
  await sincronizarBaseDeDatos();
  setInterval(sincronizarBaseDeDatos, 2 * 60 * 1000);
}

iniciarServidor();
