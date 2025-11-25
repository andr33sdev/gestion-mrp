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

// Helper: Normalizar texto
function normalizarParaComparar(txt) {
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

// Helper: Limpia números
function limpiarNumero(val) {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return val;
  let limpio = val.toString().trim();
  if (limpio.includes(",") && limpio.includes(".")) {
    limpio = limpio.replace(/\./g, "").replace(",", ".");
  } else if (limpio.includes(",")) {
    limpio = limpio.replace(",", ".");
  }
  const numero = parseFloat(limpio);
  return isNaN(numero) ? 0 : numero;
}

// =====================================================
// 1. SYNC LOGS HORNO
// =====================================================
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

// =====================================================
// 2. SYNC PEDIDOS (RESTAURADO)
// =====================================================
async function sincronizarPedidos() {
  console.log("⏳ [SYNC] Iniciando sincronización de Pedidos (Excel -> DB)...");
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
    return;
  }

  const client = await db.connect();
  try {
    const FECHA_CORTE = new Date("2025-01-01");
    const valoresInsertar = [];

    for (const r of rawData) {
      const fechaRaw = r.FECHA || r.Fecha || r.fecha;
      let fecha = null;
      if (fechaRaw) fecha = new Date(fechaRaw);
      if (!fecha || isNaN(fecha.getTime()) || fecha < FECHA_CORTE) continue;

      let cantidadRaw = r.CANTIDAD || r.Cantidad || r.cantidad || 0;
      let cantidad = 0;
      if (typeof cantidadRaw === "number") cantidad = cantidadRaw;
      else {
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
      const fechaDespachoRaw = r["FECHA DESPACHO"] || r.fecha_despacho;
      const fechaDespacho = fechaDespachoRaw
        ? new Date(fechaDespachoRaw)
        : null;

      valoresInsertar.push([
        fecha,
        cliente,
        modelo,
        cantidad,
        oc,
        estado,
        detalles,
        fechaDespacho,
      ]);
    }

    await client.query("BEGIN");
    await client.query("TRUNCATE TABLE pedidos RESTART IDENTITY");

    const TAMANO_LOTE = 500;
    if (valoresInsertar.length > 0) {
      for (let i = 0; i < valoresInsertar.length; i += TAMANO_LOTE) {
        const lote = valoresInsertar.slice(i, i + TAMANO_LOTE);
        const query = format(
          "INSERT INTO pedidos (fecha, cliente, modelo, cantidad, oc, estado, detalles, fecha_despacho) VALUES %L",
          lote
        );
        await client.query(query);
      }
    }

    await client.query("COMMIT");
    console.log(
      `✅ [SYNC] Pedidos sincronizados: ${valoresInsertar.length} registros.`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ [SYNC] Error en base de datos (Pedidos):", err.message);
  } finally {
    client.release();
  }
}

// =====================================================
// 3. SYNC STOCK MULTI-HOJA (OPTIMIZADO Y DESDUPLICADO)
// =====================================================
async function sincronizarStockSemielaborados() {
  const client = await db.connect();
  try {
    console.log("\n📥 [AUTO] --- INICIO SYNC STOCK MULTI-PLANTA (TURBO) ---");
    const { rows: productosExistentes } = await client.query(
      "SELECT codigo, nombre FROM semielaborados"
    );
    const mapaPorNombre = {};
    productosExistentes.forEach((p) => {
      if (p.nombre) mapaPorNombre[normalizarParaComparar(p.nombre)] = p.codigo;
    });

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
      if (!realSheetName) continue;

      const sheet = workbook.Sheets[realSheetName];
      const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
        const rowString = JSON.stringify(rawMatrix[i]).toUpperCase();
        if (
          rowString.includes("CODIGO") &&
          (rowString.includes("STOCK") ||
            rowString.includes("CANT") ||
            rowString.includes("SALDO") ||
            rowString.includes("TOTAL"))
        ) {
          headerRowIndex = i;
          break;
        }
      }
      if (headerRowIndex === -1) headerRowIndex = 0;

      console.log(`📄 Procesando "${realSheetName}"...`);
      const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
      const registrosUnicos = new Map();

      for (const row of data) {
        let codigoLeido = null;
        let nombreLeido = null;
        let stock = 0;

        for (const key of Object.keys(row)) {
          const k = normalizarParaComparar(key);
          if (k === "CODIGO" || k === "ARTICULO")
            codigoLeido = limpiarCodigo(row[key]);
          else if (
            k.includes("DESCRIPCION") ||
            k.includes("NOMBRE") ||
            k.includes("MATERIAL")
          )
            nombreLeido = row[key];
          else if (
            k.includes("STOCK") ||
            k.includes("SALDO") ||
            k.includes("CANTIDAD") ||
            k.includes("TOTAL") ||
            k.includes("EXISTENCIA")
          )
            stock = limpiarNumero(row[key]);
        }

        if (nombreLeido || codigoLeido) {
          const nombreFinal = nombreLeido || "SIN NOMBRE";
          let codigoFinal = codigoLeido;
          const nombreKey = normalizarParaComparar(nombreFinal);
          if (mapaPorNombre[nombreKey]) codigoFinal = mapaPorNombre[nombreKey];
          else if (!codigoFinal) codigoFinal = limpiarCodigo(nombreFinal);

          if (codigoFinal) {
            registrosUnicos.set(codigoFinal, [codigoFinal, nombreFinal, stock]);
          }
        }
      }

      const valoresParaInsertar = Array.from(registrosUnicos.values());
      if (valoresParaInsertar.length > 0) {
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
    console.log(`🎉 [FIN SYNC TURBO] Total procesado: ${totalUpdates}.`);
    return { success: true, count: totalUpdates, detalles };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ [AUTO] Error Sync Stock:", err);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

// --- SYNC MATERIAS PRIMAS ---
async function sincronizarMateriasPrimas() {}

module.exports = {
  sincronizarBaseDeDatos,
  sincronizarPedidos,
  sincronizarStockSemielaborados,
  sincronizarMateriasPrimas,
};
