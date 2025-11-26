const db = require("../db");
const {
  leerArchivoHorno,
  leerArchivoPedidos,
  leerStockSemielaborados,
  leerMateriasPrimas,
} = require("../google-drive");
const { parsearLog } = require("../parser");
const format = require("pg-format");
const XLSX = require("xlsx");

// Helper: Limpia encabezados
function normalizarEncabezado(txt) {
  if (!txt) return "";
  return txt
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Helper: Limpia códigos
function limpiarCodigo(cod) {
  if (!cod) return null;
  return cod.toString().trim().toUpperCase();
}

// Helper: Limpia números (Devuelve null si no es número, para filtrar títulos)
function limpiarNumero(val) {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "number") return val;

  let limpio = val.toString().trim();
  if (limpio === "-" || limpio === "") return null; // Guiones o vacíos son nulos (no 0, para no crear registros basura)

  // Formatos "1.000,00"
  if (limpio.includes(",") && limpio.includes(".")) {
    limpio = limpio.replace(/\./g, "").replace(",", ".");
  } else if (limpio.includes(",")) {
    limpio = limpio.replace(",", ".");
  }

  const numero = parseFloat(limpio);
  return isNaN(numero) ? null : numero;
}

// --- SYNC LOGS HORNO ---
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

// --- SYNC PEDIDOS ---
async function sincronizarPedidos() {
  console.log("⏳ [SYNC] Sync Pedidos...");
}

// --- SYNC STOCK MULTI-HOJA (MAPEO EXACTO) ---
async function sincronizarStockSemielaborados() {
  const client = await db.connect();
  try {
    console.log("\n📥 [AUTO] --- INICIO SYNC STOCK MULTI-PLANTA ---");

    const buffer = await leerStockSemielaborados();
    const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });

    const sheetMapping = {
      "STOCK 26": "stock_planta_26",
      "STOCK 37": "stock_planta_37",
      "STOCK AYOLAS": "stock_deposito_ayolas",
      "STOCK 33": "stock_deposito_quintana",
    };

    await client.query("BEGIN");
    let totalUpdates = 0;
    let detalles = [];

    for (const [sheetNameKey, dbColumn] of Object.entries(sheetMapping)) {
      const realSheetName = workbook.SheetNames.find(
        (s) => s.toUpperCase().trim() === sheetNameKey
      );

      if (!realSheetName) {
        console.warn(`⚠️ [ALERTA] Hoja "${sheetNameKey}" NO encontrada.`);
        continue;
      }

      // 1. LIMPIEZA PREVIA: Ponemos en 0 la columna de esta planta
      await client.query(`UPDATE semielaborados SET ${dbColumn} = 0`);

      const sheet = workbook.Sheets[realSheetName];

      // 2. Buscar encabezados (Buscamos la fila que tenga CODIGO, ARTICULO y STOCK)
      const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      let headerRowIndex = -1;

      for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
        const rowString = JSON.stringify(rawMatrix[i]).toUpperCase();
        // TU FORMATO EXACTO: CODIGO, ARTICULO, ..., STOCK
        if (
          rowString.includes("CODIGO") &&
          rowString.includes("ARTICULO") &&
          rowString.includes("STOCK")
        ) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) headerRowIndex = 0;
      console.log(
        `📄 Procesando "${realSheetName}" (Header fila ${
          headerRowIndex + 1
        })...`
      );

      const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
      const registrosUnicos = new Map();

      for (const row of data) {
        let codigo = null;
        let nombre = null;
        let stock = null; // null indica que no se encontró valor válido

        for (const key of Object.keys(row)) {
          const k = normalizarEncabezado(key);

          // --- MAPEO CORREGIDO ---

          // 1. CODIGO (La columna clave)
          if (k === "CODIGO" || k === "COD") {
            codigo = limpiarCodigo(row[key]);
          }

          // 2. NOMBRE (Tu columna es "ARTICULO")
          else if (k === "ARTICULO" || k === "DESCRIPCION" || k === "NOMBRE") {
            nombre = row[key];
          }

          // 3. STOCK (Tu columna es "STOCK") - Ignoramos ENTRADA y SALIDA
          else if (k === "STOCK" || k === "SALDO" || k === "CANTIDAD") {
            stock = limpiarNumero(row[key]);
          }
        }

        // FILTRO DE TÍTULOS:
        // Una fila válida debe tener CÓDIGO y un número de STOCK (aunque sea 0).
        // Las filas de título ("CONOS") no tienen código o no tienen stock numérico.
        if (codigo && stock !== null) {
          const nombreFinal = nombre || "SIN NOMBRE";
          registrosUnicos.set(codigo, [codigo, nombreFinal, stock]);
        }
      }

      const valoresParaInsertar = Array.from(registrosUnicos.values());

      if (valoresParaInsertar.length > 0) {
        console.log(
          `   ✅ Ejemplo válido: ${valoresParaInsertar[0][0]} - ${valoresParaInsertar[0][1]} -> Stock: ${valoresParaInsertar[0][2]}`
        );

        const query = format(
          `INSERT INTO semielaborados (codigo, nombre, ${dbColumn}) 
                 VALUES %L
                 ON CONFLICT (codigo) DO UPDATE SET 
                    ${dbColumn} = EXCLUDED.${dbColumn}, 
                    nombre = COALESCE(EXCLUDED.nombre, semielaborados.nombre),
                    ultima_actualizacion = NOW()`,
          valoresParaInsertar
        );

        await client.query(query);
        totalUpdates += valoresParaInsertar.length;
        detalles.push(`${realSheetName}: ${valoresParaInsertar.length}`);
      }
    }

    await client.query("COMMIT");
    console.log(
      `🎉 [FIN SYNC] Total procesado: ${totalUpdates}. Detalle: ${detalles.join(
        ", "
      )}`
    );
    return { success: true, count: totalUpdates, detalles };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ [AUTO] Error Sync Stock:", err);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

async function sincronizarMateriasPrimas() {}

module.exports = {
  sincronizarBaseDeDatos,
  sincronizarPedidos,
  sincronizarStockSemielaborados,
  sincronizarMateriasPrimas,
};
