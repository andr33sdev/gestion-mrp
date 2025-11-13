const express = require("express");
const cors = require("cors");
const db = require("./db");
const {
  leerArchivoHorno,
  setupAuth,
  leerArchivoPedidos,
  leerStockSemielaborados,
} = require("./google-drive");
const { parsearLog } = require("./parser");
const format = require("pg-format");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --- FUNCIÓN HELPER: Normalizar texto (quita acentos y mayúsculas) ---
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

// --- RUTAS API GENERALES ---
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
    res.setHeader("Cache-Control", "no-store");
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
// --- RUTAS INGENIERÍA (CORREGIDAS PARA ENCONTRAR HEADER) ---
// =====================================================

app.post("/api/ingenieria/sincronizar-stock", async (req, res) => {
  const client = await db.connect();
  try {
    console.log("--- INICIO SINCRONIZACIÓN STOCK ---");
    const buffer = await leerStockSemielaborados();
    const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });

    let sheetName = workbook.SheetNames.find((n) =>
      n.toUpperCase().includes("STOCK")
    );
    if (!sheetName) sheetName = workbook.SheetNames[0];
    console.log(`Leyendo hoja: "${sheetName}"`);

    const sheet = workbook.Sheets[sheetName];

    // 1. Convertimos a matriz de Arrays (fila por fila) para buscar el header
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // 2. Buscamos en qué fila está la palabra "CODIGO"
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
      // Escanea las primeras 20 filas
      const rowString = JSON.stringify(rawMatrix[i]).toUpperCase();
      // Buscamos palabras clave
      if (rowString.includes("CODIGO") && rowString.includes("STOCK")) {
        headerRowIndex = i;
        console.log(`¡ENCABEZADOS ENCONTRADOS EN LA FILA ${i + 1}!`);
        console.log("Cabeceras:", rawMatrix[i]);
        break;
      }
    }

    if (headerRowIndex === -1) {
      console.error(
        "NO SE ENCONTRARON LAS CABECERAS 'CODIGO' Y 'STOCK' EN LAS PRIMERAS 20 FILAS."
      );
      return res.status(400).json({
        msg: "No se encontró la tabla de stock (falta columna CODIGO o STOCK)",
      });
    }

    // 3. Volvemos a leer, pero saltando las filas basura hasta llegar al header
    const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });

    await client.query("BEGIN");
    let count = 0;

    for (const row of data) {
      // Normalizamos las claves para ser flexibles con mayúsculas/tildes
      let codigo = null;
      let nombre = null;
      let stock = 0;

      // Buscamos las columnas dinámicamente en la fila
      for (const key of Object.keys(row)) {
        const k = normalizarTexto(key);
        if (k === "CODIGO" || k === "CÓDIGO") codigo = row[key];
        else if (
          k === "ARTICULO" ||
          k === "ARTÍCULO" ||
          k === "NOMBRE" ||
          k === "DESCRIPCION"
        )
          nombre = row[key];
        else if (k === "STOCK" || k === "CANTIDAD" || k === "TOTAL")
          stock = row[key];
      }

      if (codigo) {
        await client.query(
          `
                INSERT INTO semielaborados (codigo, nombre, stock_actual, ultima_actualizacion)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (codigo) 
                DO UPDATE SET stock_actual = $3, nombre = $2, ultima_actualizacion = NOW()
            `,
          [codigo, nombre || "Sin Nombre", Number(stock) || 0]
        );
        count++;
      }
    }
    await client.query("COMMIT");
    console.log(`--- FIN SINCRONIZACIÓN: ${count} items procesados ---`);
    res.json({ msg: "Stock sincronizado", count });
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

app.post("/api/ingenieria/recetas", async (req, res) => {
  const { producto_terminado, items } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // Borramos la versión anterior
    await client.query("DELETE FROM recetas WHERE producto_terminado = $1", [
      producto_terminado,
    ]);

    // Insertamos la nueva versión con la fecha de HOY (NOW())
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO recetas 
                    (producto_terminado, semielaborado_id, cantidad, ultima_actualizacion) 
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

// --- 5. Leer Receta (CORREGIDO CON ZONA HORARIA ARGENTINA) ---
app.get("/api/ingenieria/recetas/:producto", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      `
            SELECT r.*, s.codigo, s.nombre, s.stock_actual,
            (
                SELECT TO_CHAR(
                    MAX(ultima_actualizacion) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires',
                    'DD/MM/YYYY HH24:MI'
                ) 
                FROM recetas 
                WHERE producto_terminado = $1
            ) as fecha_receta
            FROM recetas r
            JOIN semielaborados s ON r.semielaborado_id = s.id
            WHERE r.producto_terminado = $1
        `,
      [req.params.producto]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

async function iniciarServidor() {
  await setupAuth();
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
  await sincronizarBaseDeDatos();
  setInterval(sincronizarBaseDeDatos, 2 * 60 * 1000);
}

iniciarServidor();
