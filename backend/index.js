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

// --- (Función sincronizarBaseDeDatos - ¡ACTUALIZADA!) ---
async function sincronizarBaseDeDatos() {
  console.log("[TIMER] ¡Iniciando sincronización automática!");
  const client = await db.connect();
  console.log("[TIMER] Cliente de base de datos conectado.");
  try {
    console.log("[TIMER] Paso 1: Leyendo archivo de Google Drive...");
    const textoCrudo = await leerArchivoHorno();
    console.log("[TIMER] Paso 2: Parseando el texto...");
    const registrosOriginales = parsearLog(textoCrudo);

    // --- ¡NUEVA LÓGICA DE ARCHIVADO DE PRODUCCIÓN! ---

    // 2a. Iniciar transacción (movido aquí para incluir la lectura/escritura de estado_produccion)
    await client.query("BEGIN");

    // 2b. Obtener el estado actual de producción (CON BLOQUEO)
    const { rows: currentProdRows } = await client.query(
      "SELECT * FROM estado_produccion FOR UPDATE"
    );
    const currentProduccion = currentProdRows.reduce((acc, row) => {
      try {
        const list = JSON.parse(row.producto_actual || "[]");
        acc[row.estacion_id] = {
          json: row.producto_actual || "[]",
          list: list,
        };
      } catch (e) {
        acc[row.estacion_id] = { json: "[]", list: [] };
      }
      return acc;
    }, {});

    // --- ¡NUEVO PASO! ---
    // 2c. Obtener todos los triggers de EVENTO que ya existen en la DB
    // para no duplicar los archivos de PRODUCCION.
    const { rows: dbTriggers } = await client.query(
      `SELECT fecha, hora, accion 
       FROM registros 
       WHERE tipo = 'EVENTO' 
       AND (accion LIKE 'Se inicio ciclo%' OR accion LIKE 'Enfriando%')`
    );
    // Creamos un "Set" para búsqueda rápida
    const dbTriggerSet = new Set(
      dbTriggers.map((r) => {
        // Formateamos la fecha a YYYY-MM-DD (la base de datos la devuelve como objeto Date)
        const fechaDB = r.fecha.toISOString().split("T")[0];
        return `${fechaDB}T${r.hora}_${r.accion}`;
      })
    );
    console.log(
      `[TIMER] Encontrados ${dbTriggerSet.size} triggers de ciclo ya existentes en la DB.`
    );

    const newArchiveRecords = [];

    // 2d. Iterar sobre los *nuevos* logs para encontrar triggers de archivado
    for (const reg of registrosOriginales) {
      let stationId = null;
      let isStartCycle = false;
      let isCooling = false;

      if (reg.accion.includes("Estacion 1")) stationId = 1;
      else if (reg.accion.includes("Estacion 2")) stationId = 2;

      if (reg.accion.includes("Se inicio ciclo")) isStartCycle = true;
      if (reg.accion.includes("Enfriando")) isCooling = true;

      const triggerEvent = stationId && (isStartCycle || isCooling);

      if (triggerEvent) {
        // --- ¡LÓGICA DE CONTROL ACTUALIZADA! ---
        // Solo procesamos este trigger si es NUEVO
        const key = `${reg.fecha}T${reg.hora}_${reg.accion}`;

        if (!dbTriggerSet.has(key)) {
          console.log(`[TIMER] Nuevo trigger detectado: ${key}`);
          // Es un trigger nuevo, revisamos si hay productos para archivar
          const products = currentProduccion[stationId];

          if (products && products.list.length > 0) {
            console.log(
              `[TIMER] Archivando productos para ${key}: ${products.json}`
            );
            // i. Crear el nuevo registro de archivo
            const archiveAction = `Fin de ciclo E${stationId} (productos: ${products.list.join(
              ", "
            )})`; // <-- ¡MODIFICADO!

            newArchiveRecords.push({
              fecha: reg.fecha, // Usar timestamp del evento trigger
              hora: reg.hora,
              accion: archiveAction,
              tipo: "PRODUCCION", // Nuevo tipo
              productos_json: products.json, // El JSON string
            });
          }
        }
      }
    }

    // 2e. No se limpia la producción actual (lógica eliminada en el paso anterior)

    // --- FIN DE LA NUEVA LÓGICA ---

    // 2f. Combinar logs originales + nuevos archivos de producción
    const allRecordsToInsert = [...registrosOriginales, ...newArchiveRecords];

    if (allRecordsToInsert.length === 0) {
      console.log("[TIMER] No se encontraron registros válidos en el archivo.");
      // await client.query("ROLLBACK"); // Ya no es necesario, el bloque catch lo maneja
      client.release();
      return { success: false, msg: "No se encontraron registros válidos." };
    }

    console.log(
      `[TIMER] Paso 3: Sincronizando ${registrosOriginales.length} logs y ${newArchiveRecords.length} archivos de producción.`
    );
    // await client.query("BEGIN"); // Movido arriba

    // --- ¡ESTA ES LA LÍNEA CRÍTICA! ---
    // Borramos solo los logs viejos (EVENTO/ALARMA), pero conservamos nuestros registros de PRODUCCION generados.
    await client.query("DELETE FROM registros WHERE tipo != 'PRODUCCION'");

    // ¡ACTUALIZADO! Añadido productos_json
    const valores = allRecordsToInsert.map((r) => [
      r.fecha,
      r.hora,
      r.accion,
      r.tipo,
      r.productos_json || null, // Columna nueva
    ]);

    // ¡ACTUALIZADO! Añadido productos_json
    const consulta = format(
      "INSERT INTO registros (fecha, hora, accion, tipo, productos_json) VALUES %L",
      valores
    );
    await client.query(consulta);
    await client.query("COMMIT");
    console.log("[TIMER] ¡Sincronización completa!");
    return {
      success: true,
      msg: `Sincronización completa. ${allRecordsToInsert.length} registros guardados.`,
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
        productos_json, -- ¡NUEVO! Devolver también los productos
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

// --- RUTA GET /api/produccion (ACTUALIZADA) ---
// Devuelve una lista (array) de productos, no un string.
app.get("/api/produccion", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM estado_produccion");
    const estado = rows.reduce((acc, row) => {
      try {
        // Intenta parsear el JSON de la DB. Si falla, devuelve array vacío.
        acc[row.estacion_id] = JSON.parse(row.producto_actual || "[]");
      } catch (e) {
        acc[row.estacion_id] = [];
      }
      return acc;
    }, {});
    // Devuelve: { 1: ["Tanque", "Silla"], 2: ["Kayak"] }
    res.json(estado);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error en el servidor");
  }
});

// --- RUTA POST /api/produccion (ACTUALIZADA) ---
// Añade un producto a la lista JSON, no la reemplaza.
app.post("/api/produccion", async (req, res) => {
  const { estacion_id, producto } = req.body; // Cambiado de 'producto_actual' a 'producto'

  if (!estacion_id || !producto) {
    return res.status(400).json({ msg: "Faltan estacion_id o producto" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // 1. Obtenemos la lista actual
    const { rows: currentRows } = await client.query(
      "SELECT producto_actual FROM estado_produccion WHERE estacion_id = $1 FOR UPDATE",
      [estacion_id]
    );

    let currentList = [];
    try {
      currentList = JSON.parse(currentRows[0].producto_actual || "[]");
    } catch (e) {
      currentList = []; // Si hay JSON inválido, reseteamos
    }

    // 2. Añadimos el nuevo producto a la lista
    currentList.push(producto);

    // 3. Guardamos la lista actualizada (como string JSON)
    const newListString = JSON.stringify(currentList);
    const { rows } = await client.query(
      `UPDATE estado_produccion 
       SET producto_actual = $1 
       WHERE estacion_id = $2
       RETURNING *`,
      [newListString, estacion_id]
    );

    await client.query("COMMIT");

    // Devolvemos la lista actualizada (ya parseada)
    res.json(currentList);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err.message);
    res.status(500).send("Error en el servidor");
  } finally {
    client.release();
  }
});

// --- ¡NUEVA RUTA! Limpiar la lista de productos de una estación ---
app.delete("/api/produccion/:estacion_id", async (req, res) => {
  const { estacion_id } = req.params;

  try {
    // Resetea la lista a un array vacío
    const { rows } = await db.query(
      `UPDATE estado_produccion 
       SET producto_actual = '[]' 
       WHERE estacion_id = $1
       RETURNING *`,
      [estacion_id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error en el servidor");
  }
});

// Ruta de Sincronización Manual (Sin cambios)
app.post("/api/sincronizar", async (req, res) => {
  const resultado = await sincronizarBaseDeDatos();
  if (resultado.success) {
    res.json({ msg: resultado.msg });
  } else {
    res.status(500).send(resultado.msg);
  }
});

// Ruta de Prueba de Drive (Sin cambios)
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

// --- ¡NUEVA RUTA DE PRUEBA PARA FORZAR ARCHIVADO! ---
app.get("/api/test/forzar-archivado/:estacion_id", async (req, res) => {
  const { estacion_id } = req.params;
  if (estacion_id !== "1" && estacion_id !== "2") {
    return res
      .status(400)
      .json({ msg: "ID de estación inválido. Usar 1 o 2." });
  }

  console.log(`[TEST] Forzando archivado para estación ${estacion_id}...`);
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Obtener productos actuales de la estación (con bloqueo)
    const { rows: currentRows } = await client.query(
      "SELECT producto_actual FROM estado_produccion WHERE estacion_id = $1 FOR UPDATE",
      [estacion_id]
    );

    if (currentRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ msg: "Estación no encontrada" });
    }

    const producto_json = currentRows[0].producto_actual || "[]";
    let producto_list = [];
    try {
      producto_list = JSON.parse(producto_json);
    } catch (e) {
      console.error(
        `[TEST] JSON inválido en estación ${estacion_id}, se tratará como vacío.`
      );
    }

    // 2. Verificar si hay algo que archivar
    if (producto_list.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(200)
        .json({
          msg: `Estación ${estacion_id} ya estaba vacía. No se archivó nada.`,
        });
    }

    // 3. Crear el nuevo registro de historial
    const now = new Date();
    // Formatear fecha y hora para la DB (YYYY-MM-DD y HH:MM:SS)
    const fecha = now.toISOString().split("T")[0];
    const hora = now.toTimeString().split(" ")[0];
    const accion = `Fin de ciclo E${estacion_id} (TEST MANUAL) (productos: ${producto_list.join(
      ", "
    )})`; // <-- ¡MODIFICADO!

    await client.query(
      "INSERT INTO registros (fecha, hora, accion, tipo, productos_json) VALUES ($1, $2, $3, $4, $5)",
      [fecha, hora, accion, "PRODUCCION", producto_json]
    );

    // 4. Limpiar la lista de producción de la estación - ELIMINADO
    /*
        await client.query(
            "UPDATE estado_produccion SET producto_actual = '[]' WHERE estacion_id = $1",
            [estacion_id]
        );
        */

    // 5. Confirmar transacción
    await client.query("COMMIT");

    console.log(
      `[TEST] ¡Archivado exitoso para estación ${estacion_id}! (Sin limpiar la producción actual)`
    );
    res.status(200).json({
      msg: `Archivado exitoso para estación ${estacion_id}. La producción actual NO se limpió.`,
      productos_archivados: producto_list,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[TEST] Error al forzar archivado:", err.message);
    res.status(500).send("Error en el servidor durante el archivado de prueba");
  } finally {
    client.release();
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
