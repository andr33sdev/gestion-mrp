const express = require("express");
const cors = require("cors");
const db = require("./db"); // Importa el pool de db
const { leerArchivoHorno, setupAuth } = require("./google-drive");
const { parsearLog } = require("./parser");
const format = require("pg-format");

const app = express();
const PORT = process.env.PORT || 4000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- (Función sincronizarBaseDeDatos - SIN CAMBIOS) ---
async function sincronizarBaseDeDatos() {
  console.log("[TIMER] ¡Iniciando sincronización automática!");
  const client = await db.connect();
  console.log("[TIMER] Cliente de base de datos conectado.");
  try {
    console.log("[TIMER] Paso 1: Leyendo archivo de Google Drive...");
    const textoCrudo = await leerArchivoHorno();
    console.log("[TIMER] Paso 2: Parseando el texto...");
    const registros = parsearLog(textoCrudo);
    if (registros.length === 0) {
      console.log("[TIMER] No se encontraron registros válidos en el archivo.");
      client.release();
      return { success: false, msg: "No se encontraron registros válidos." };
    }
    console.log(
      `[TIMER] Paso 3: Sincronizando ${registros.length} registros...`
    );
    await client.query("BEGIN");
    await client.query("DELETE FROM registros");
    const valores = registros.map((r) => [r.fecha, r.hora, r.accion, r.tipo]);
    const consulta = format(
      "INSERT INTO registros (fecha, hora, accion, tipo) VALUES %L",
      valores
    );
    await client.query(consulta);
    await client.query("COMMIT");
    console.log("[TIMER] ¡Sincronización completa!");
    return {
      success: true,
      msg: `Sincronización completa. ${registros.length} registros guardados.`,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[TIMER] Error durante la sincronización:", err);
    return {
      success: false,
      msg: "Error en el servidor durante la sincronización",
    };
  } finally {
    client.release();
    console.log("[TIMER] Cliente de base de datos liberado.");
  }
}

// --- RUTAS API ---

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("¡Mi servidor de backend funciona!");
});

// Ruta de Logs (para el dashboard)
app.get("/api/registros", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        id, 
        accion,
        tipo,
        CAST(fecha::TEXT || ' ' || hora::TEXT AS TIMESTAMP) 
          AT TIME ZONE 'America/Argentina/Buenos_Aires' AS timestamp
      FROM registros 
      ORDER BY timestamp DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error en el servidor");
  }
});

// --- ¡NUEVA RUTA! Obtener el estado de producción ---
app.get("/api/produccion", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM estado_produccion");
    // Transforma el array [ {estacion_id: 1, ...}, {estacion_id: 2, ...} ]
    // en un objeto { 1: "...", 2: "..." } para el frontend
    const estado = rows.reduce((acc, row) => {
      acc[row.estacion_id] = row.producto_actual;
      return acc;
    }, {});
    res.json(estado);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error en el servidor");
  }
});

// --- ¡NUEVA RUTA! Actualizar el estado de producción ---
app.post("/api/produccion", async (req, res) => {
  const { estacion_id, producto_actual } = req.body;

  if (!estacion_id || !producto_actual) {
    return res
      .status(400)
      .json({ msg: "Faltan estacion_id o producto_actual" });
  }

  try {
    const { rows } = await db.query(
      `UPDATE estado_produccion 
       SET producto_actual = $1 
       WHERE estacion_id = $2
       RETURNING *`,
      [producto_actual, estacion_id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error en el servidor");
  }
});

// Ruta de Sincronización Manual
app.post("/api/sincronizar", async (req, res) => {
  // ... (sin cambios)
  const resultado = await sincronizarBaseDeDatos();
  if (resultado.success) {
    res.json({ msg: resultado.msg });
  } else {
    res.status(500).send(resultado.msg);
  }
});

// Ruta de Prueba de Drive
app.get("/api/leer-archivo", async (req, res) => {
  // ... (sin cambios)
  try {
    const contenidoDelArchivo = await leerArchivoHorno();
    res.type("text/plain");
    res.send(contenidoDelArchivo);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al leer el archivo de Drive");
  }
});

// --- (Función iniciarServidor - SIN CAMBIOS) ---
async function iniciarServidor() {
  await setupAuth();
  app.listen(PORT, () => {
    console.log(
      `Servidor corriendo en http://localhost:${PORT} o en el puerto ${process.env.PORT}`
    );
  });
  console.log("Ejecutando sincronización inicial...");
  await sincronizarBaseDeDatos();
  const DOS_MINUTOS = 2 * 60 * 1000;
  setInterval(sincronizarBaseDeDatos, DOS_MINUTOS);
  console.log(`La sincronización automática se ejecutará cada 2 minutos.`);
}

iniciarServidor();
