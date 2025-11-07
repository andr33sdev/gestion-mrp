const express = require("express");
const cors = require("cors");
const db = require("./db");
const { leerArchivoHorno, setupAuth } = require("./google-drive");
const { parsearLog } = require("./parser");
const format = require("pg-format");

const app = express();
// --- CAMBIO: Usamos el puerto de Render o 4000 si es local ---
const PORT = process.env.PORT || 4000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- FUNCIÓN HELPER DE SINCRONIZACIÓN (¡ACTUALIZADA!) ---
async function sincronizarBaseDeDatos() {
  console.log("[TIMER] ¡Iniciando sincronización automática!");

  const client = await db.connect();
  console.log("[TIMER] Cliente de base de datos conectado.");

  try {
    // 1. LEER
    console.log("[TIMER] Paso 1: Leyendo archivo de Google Drive...");
    const textoCrudo = await leerArchivoHorno();

    // 2. PARSEAR
    console.log("[TIMER] Paso 2: Parseando el texto...");
    const registros = parsearLog(textoCrudo);
    if (registros.length === 0) {
      // ... (código de error sin cambios)
      console.log("[TIMER] No se encontraron registros válidos en el archivo.");
      client.release();
      return { success: false, msg: "No se encontraron registros válidos." };
    }

    console.log(
      `[TIMER] Paso 3: Sincronizando ${registros.length} registros...`
    );

    // 3. EJECUTAR LA TRANSACCIÓN (¡ACTUALIZADA!)
    await client.query("BEGIN");
    await client.query("DELETE FROM registros");

    // --- CAMBIO: Mapeamos el 'tipo' también ---
    const valores = registros.map((r) => [r.fecha, r.hora, r.accion, r.tipo]);
    // --- CAMBIO: Insertamos la nueva columna 'tipo' ---
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

// --- RUTAS ---
app.get("/", (req, res) => {
  res.send("¡Mi servidor de backend funciona!");
});

// --- RUTA GET: (¡ACTUALIZADA!) ---
app.get("/api/registros", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        id, 
        accion,
        tipo, -- <-- ¡NUEVA COLUMNA ENVIADA AL FRONTEND!
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

// (El resto de rutas y la función iniciarServidor no cambian)

// RUTA POST: Sincronización manual
app.post("/api/sincronizar", async (req, res) => {
  const resultado = await sincronizarBaseDeDatos();

  if (resultado.success) {
    res.json({ msg: resultado.msg });
  } else {
    res.status(500).send(resultado.msg);
  }
});

// RUTA DE PRUEBA: Leer el .txt
app.get("/api/leer-archivo", async (req, res) => {
  try {
    const contenidoDelArchivo = await leerArchivoHorno();
    res.type("text/plain");
    res.send(contenidoDelArchivo);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al leer el archivo de Drive");
  }
});

// --- FUNCIÓN PARA INICIAR EL SERVIDOR ---
async function iniciarServidor() {
  await setupAuth();
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
  console.log("Ejecutando sincronización inicial...");
  await sincronizarBaseDeDatos();
  const DOS_MINUTOS = 2 * 60 * 1000;
  setInterval(sincronizarBaseDeDatos, DOS_MINUTOS);
  console.log(`La sincronización automática se ejecutará cada 2 minutos.`);
}

iniciarServidor();
