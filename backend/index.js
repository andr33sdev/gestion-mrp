const express = require("express");
const cors = require("cors");
const db = require("./db"); // Importa el pool de db
const { leerArchivoHorno, setupAuth } = require("./google-drive");
const { parsearLog } = require("./parser");
const format = require("pg-format"); // Para el bulk-insert

const app = express();
const PORT = 4000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- FUNCIÓN HELPER DE SINCRONIZACIÓN ---
async function sincronizarBaseDeDatos() {
  console.log("[TIMER] ¡Iniciando sincronización automática!");

  const client = await db.connect(); // db ahora es el pool
  console.log("[TIMER] Cliente de base de datos conectado.");

  try {
    // 1. LEER
    console.log("[TIMER] Paso 1: Leyendo archivo de Google Drive...");
    const textoCrudo = await leerArchivoHorno();

    // 2. PARSEAR
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

    // 3. EJECUTAR LA TRANSACCIÓN
    await client.query("BEGIN");
    await client.query("DELETE FROM registros");

    const valores = registros.map((r) => [r.fecha, r.hora, r.accion]);
    const consulta = format(
      "INSERT INTO registros (fecha, hora, accion) VALUES %L",
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

// RUTA GET: Obtener todos los registros (¡LA VERSIÓN CORREGIDA!)
app.get("/api/registros", async (req, res) => {
  try {
    // 1. Convierte 'fecha' (DATE) y 'hora' (TIME) a texto (TEXT).
    // 2. Los concatena (ej: '2025-11-06 07:45:08').
    // 3. Convierte esa cadena de texto a un TIMESTAMP.
    // 4. LE AVISA a Postgres que ese timestamp es hora 'America/Argentina/Buenos_Aires'.
    // 5. Postgres lo convierte a UTC (con la 'Z') para que Javascript lo entienda.
    const { rows } = await db.query(`
      SELECT 
        id, 
        accion,
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
  // 1. Nos conectamos a Google Drive
  await setupAuth();

  // 2. Iniciamos el servidor web
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });

  // 3. Ejecuta la sincronización AHORA MISMO
  console.log("Ejecutando sincronización inicial...");
  await sincronizarBaseDeDatos();

  // 4. La programa para cada 2 minutos
  const DOS_MINUTOS = 2 * 60 * 1000;
  setInterval(sincronizarBaseDeDatos, DOS_MINUTOS);

  console.log(`La sincronización automática se ejecutará cada 2 minutos.`);
}

iniciarServidor();
