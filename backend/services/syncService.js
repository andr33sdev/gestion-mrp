// backend/services/syncService.js
const db = require("../db");
const {
  leerArchivoHorno,
  leerArchivoPedidos,
  leerStockSemielaborados,
  leerMateriasPrimas,
} = require("../google-drive");
const { parsearLog } = require("../parser");
const { enviarAlertaStock } = require("./telegramBotListener");
const format = require("pg-format");
const XLSX = require("xlsx");

// --- HELPERS ---
function parsearFechaExcel(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === "number") {
    const fechaBase = new Date(1899, 11, 30);
    const dias = Math.floor(valor);
    const ms = (valor - dias) * 86400 * 1000;
    const fecha = new Date(fechaBase.getTime() + dias * 86400000 + ms);
    return isNaN(fecha.getTime()) ? null : fecha;
  }
  if (typeof valor === "string") {
    const partes = valor.trim().split("/");
    if (partes.length === 3) {
      let dia = parseInt(partes[0], 10);
      let mes = parseInt(partes[1], 10) - 1;
      let anio = parseInt(partes[2], 10);
      if (anio < 100) anio += 2000;
      const fecha = new Date(anio, mes, dia);
      return isNaN(fecha.getTime()) ? null : fecha;
    }
    const fechaStd = new Date(valor);
    return isNaN(fechaStd.getTime()) ? null : fechaStd;
  }
  return null;
}

function normalizarEncabezado(txt) {
  if (!txt) return "";
  return txt
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function limpiarCodigo(cod) {
  if (!cod) return null;
  return cod.toString().trim().toUpperCase();
}

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

function formatearFechaParaDB(fechaObj) {
  if (!fechaObj || !(fechaObj instanceof Date) || isNaN(fechaObj)) return null;
  return fechaObj.toISOString().split("T")[0];
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
          accion: `Estacion ${row.estacion_id}`,
        };
      } catch (e) {
        acc[row.estacion_id] = {
          json: "[]",
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
      let stationId = null;
      if (reg.accion.includes("Estacion 1")) stationId = 1;
      else if (reg.accion.includes("Estacion 2")) stationId = 2;

      if (stationId && reg.accion.includes("Se inicio ciclo")) {
        const key = `${reg.fecha}T${reg.hora}_${reg.accion}`;
        if (!dbTriggerSet.has(key)) {
          const products = currentProduccion[stationId];
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

    const allRecordsToInsert = [...registrosOriginales, ...newArchiveRecords];
    if (allRecordsToInsert.length === 0) {
      await client.query("COMMIT");
      return { success: true, msg: "Sin registros nuevos." };
    }

    await client.query("DELETE FROM registros WHERE tipo != 'PRODUCCION'");

    const LOTE_SIZE = 1000;
    for (let i = 0; i < allRecordsToInsert.length; i += LOTE_SIZE) {
      const lote = allRecordsToInsert.slice(i, i + LOTE_SIZE);
      const valores = lote.map((r) => [
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
    }

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
// 2. SYNC PEDIDOS
// =====================================================
async function sincronizarPedidos() {
  console.log("⏳ [SYNC] Iniciando sincronización de Pedidos...");
  let workbook;
  try {
    const buffer = await leerArchivoPedidos();
    workbook = XLSX.read(Buffer.from(buffer), {
      type: "buffer",
      cellDates: false,
    });
  } catch (e) {
    console.error("❌ [SYNC] Error descargando Excel Pedidos:", e.message);
    return;
  }

  const client = await db.connect();
  try {
    const { rows: novedades } = await client.query(
      "SELECT razon_social, fecha_nueva FROM novedades_pedidos"
    );
    const mapaNovedades = {};
    novedades.forEach((n) => {
      if (n.razon_social) {
        mapaNovedades[normalizarEncabezado(n.razon_social)] = n.fecha_nueva;
      }
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    let headerRowIndex = 0;

    for (let i = 0; i < Math.min(rawMatrix.length, 30); i++) {
      const rowString = JSON.stringify(rawMatrix[i]).toUpperCase();
      if (rowString.includes("FECHA") && rowString.includes("CLIENTE")) {
        headerRowIndex = i;
        break;
      }
    }

    const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
    const valoresInsertar = [];
    const FECHA_CORTE = new Date("2025-01-01");

    for (const r of data) {
      let fecha = null,
        cliente = null,
        modelo = null,
        cantidad = 0,
        oc = null,
        estado = null,
        detalles = null,
        fechaDespachoObj = null;

      for (const key of Object.keys(r)) {
        // Normalizamos y QUITAMOS ESPACIOS para comparar
        const k = normalizarEncabezado(key);
        const kSinEspacios = k.replace(/\s+/g, "");

        const val = r[key];

        if (kSinEspacios === "FECHA" || kSinEspacios === "FECHAPEDIDO")
          fecha = parsearFechaExcel(val);
        else if (kSinEspacios === "CLIENTE" || kSinEspacios === "RAZONSOCIAL")
          cliente = val;
        else if (kSinEspacios === "MODELO" || kSinEspacios === "ARTICULO")
          modelo = val;
        else if (
          kSinEspacios === "CANTIDAD" ||
          kSinEspacios === "CANT" ||
          kSinEspacios === "Q"
        )
          cantidad = limpiarNumero(val);
        else if (kSinEspacios === "OC" || kSinEspacios === "ORDENCOMPRA")
          oc = val;
        else if (kSinEspacios === "ESTADO" || kSinEspacios === "SITUACION")
          estado = val;
        else if (
          kSinEspacios === "DETALLES" ||
          kSinEspacios === "OBSERVACIONES"
        )
          detalles = val;
        else if (
          kSinEspacios.includes("DESPACHO") ||
          kSinEspacios.includes("ENTREGA") ||
          kSinEspacios === "SALIDA"
        )
          fechaDespachoObj = parsearFechaExcel(val);
      }

      if (!fecha || fecha < FECHA_CORTE) continue;

      if (cliente) {
        const keyCliente = normalizarEncabezado(cliente);
        if (mapaNovedades[keyCliente])
          fechaDespachoObj = new Date(mapaNovedades[keyCliente]);
      }

      const fechaDespachoStr = formatearFechaParaDB(fechaDespachoObj);
      if (fechaDespachoStr) estado = "ENTREGADO";
      else if (!estado) estado = "PENDIENTE";

      valoresInsertar.push([
        fecha,
        cliente,
        modelo,
        cantidad,
        oc,
        estado,
        detalles,
        fechaDespachoStr,
      ]);
    }

    await client.query("BEGIN");
    await client.query("TRUNCATE TABLE pedidos RESTART IDENTITY");

    const TAMANO_LOTE = 500;
    if (valoresInsertar.length > 0) {
      for (let i = 0; i < valoresInsertar.length; i += TAMANO_LOTE) {
        const lote = valoresInsertar.slice(i, i + TAMANO_LOTE);
        await client.query(
          format(
            "INSERT INTO pedidos (fecha, cliente, modelo, cantidad, oc, estado, detalles, fecha_despacho) VALUES %L",
            lote
          )
        );
      }
    }

    await client.query("COMMIT");
    console.log(`✅ [SYNC] Pedidos: ${valoresInsertar.length} registros.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ [SYNC] Error Pedidos:", err.message);
  } finally {
    client.release();
  }
}

// =====================================================
// 3. SYNC STOCK + ALERTAS (CON QUITA DE ESPACIOS)
// =====================================================
async function sincronizarStockSemielaborados() {
  const client = await db.connect();
  try {
    console.log(
      "\n📥 [SYNC] Iniciando Sincronización Rápida de Stock y Alertas..."
    );
    const buffer = await leerStockSemielaborados();
    const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });

    await client.query("BEGIN");

    // --- PASO A: ALERTAS (LOTE ÚNICO) ---
    const nombreHojaGeneral = workbook.SheetNames[0];
    const sheetGeneral = workbook.Sheets[nombreHojaGeneral];

    const rawGeneral = XLSX.utils.sheet_to_json(sheetGeneral, { header: 1 });
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawGeneral.length, 10); i++) {
      if (JSON.stringify(rawGeneral[i]).toUpperCase().includes("ALERTA")) {
        headerRowIdx = i;
        break;
      }
    }
    const dataAlerta = XLSX.utils.sheet_to_json(sheetGeneral, {
      range: headerRowIdx,
    });
    const mapaAlertas = new Map();

    for (const row of dataAlerta) {
      let codigo = null;
      let nombre = null;
      let a1 = 0,
        a2 = 0,
        a3 = 0;

      for (const key of Object.keys(row)) {
        const k = normalizarEncabezado(key);
        const kSinEspacios = k.replace(/\s+/g, ""); // "ALERTA1"

        if (kSinEspacios === "CODIGO" || kSinEspacios === "COD")
          codigo = limpiarCodigo(row[key]);
        else if (kSinEspacios === "ARTICULO" || kSinEspacios === "DESCRIPCION")
          nombre = row[key];
        else if (kSinEspacios.includes("ALERTA1") || kSinEspacios === "MINIMO")
          a1 = limpiarNumero(row[key]);
        else if (kSinEspacios.includes("ALERTA2") || kSinEspacios === "MEDIO")
          a2 = limpiarNumero(row[key]);
        else if (kSinEspacios.includes("ALERTA3") || kSinEspacios === "MAXIMO")
          a3 = limpiarNumero(row[key]);
      }
      if (codigo) {
        mapaAlertas.set(codigo, [codigo, nombre || "Sin Nombre", a1, a2, a3]);
      }
    }

    const alertasParaInsertar = Array.from(mapaAlertas.values());

    if (alertasParaInsertar.length > 0) {
      const queryAlertas = format(
        `INSERT INTO semielaborados (codigo, nombre, alerta_1, alerta_2, alerta_3) VALUES %L
             ON CONFLICT (codigo) DO UPDATE SET 
             alerta_1 = EXCLUDED.alerta_1,
             alerta_2 = EXCLUDED.alerta_2,
             alerta_3 = EXCLUDED.alerta_3,
             nombre = COALESCE(EXCLUDED.nombre, semielaborados.nombre),
             ultima_actualizacion = NOW()`,
        alertasParaInsertar
      );
      await client.query(queryAlertas);
      console.log(
        `   ✅ Alertas actualizadas: ${alertasParaInsertar.length} productos.`
      );
    }

    // --- PASO B: STOCK (POR LOTES POR HOJA) ---
    const sheetMapping = {
      "STOCK 26": "stock_planta_26",
      "STOCK 37": "stock_planta_37",
      "STOCK AYOLAS": "stock_deposito_ayolas",
      "STOCK 33": "stock_deposito_quintana",
    };

    let totalUpdates = 0;

    for (const [sheetNameKey, dbColumn] of Object.entries(sheetMapping)) {
      const realSheetName = workbook.SheetNames.find(
        (s) => s.toUpperCase().trim() === sheetNameKey
      );
      if (!realSheetName) continue;

      await client.query(`UPDATE semielaborados SET ${dbColumn} = 0`);

      const sheet = workbook.Sheets[realSheetName];
      const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
        const rowString = JSON.stringify(rawMatrix[i]).toUpperCase();
        if (rowString.includes("CODIGO") && rowString.includes("STOCK")) {
          headerRowIndex = i;
          break;
        }
      }

      const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
      const mapaStock = new Map();

      for (const row of data) {
        let codigo = null,
          nombre = null,
          stock = 0;
        for (const key of Object.keys(row)) {
          const k = normalizarEncabezado(key);
          const kSinEspacios = k.replace(/\s+/g, "");

          if (kSinEspacios === "CODIGO" || kSinEspacios === "COD")
            codigo = limpiarCodigo(row[key]);
          else if (
            kSinEspacios === "ARTICULO" ||
            kSinEspacios === "DESCRIPCION"
          )
            nombre = row[key];
          else if (kSinEspacios === "STOCK" || kSinEspacios === "SALDO")
            stock = limpiarNumero(row[key]);
        }
        if (codigo) {
          mapaStock.set(codigo, [codigo, nombre || "Sin Nombre", stock]);
        }
      }

      const valoresHoja = Array.from(mapaStock.values());

      if (valoresHoja.length > 0) {
        const queryStock = format(
          `INSERT INTO semielaborados (codigo, nombre, %I) VALUES %L
                 ON CONFLICT (codigo) DO UPDATE SET 
                 %I = EXCLUDED.%I,
                 nombre = COALESCE(EXCLUDED.nombre, semielaborados.nombre),
                 ultima_actualizacion = NOW()`,
          dbColumn,
          valoresHoja,
          dbColumn,
          dbColumn
        );
        await client.query(queryStock);
        totalUpdates += valoresHoja.length;
      }
    }

    // --- PASO C: ALERTAS TELEGRAM ---
    const resAlertas = await client.query(`
        SELECT codigo, nombre, alerta_1, 
               (stock_planta_26 + stock_planta_37 + stock_deposito_ayolas + stock_deposito_quintana) as total
        FROM semielaborados
        WHERE alerta_1 > 0 
          AND (stock_planta_26 + stock_planta_37 + stock_deposito_ayolas + stock_deposito_quintana) <= alerta_1
    `);

    const itemsCriticos = resAlertas.rows.map((r) => ({
      codigo: r.codigo,
      nombre: r.nombre,
      total: Number(r.total),
      minimo: Number(r.alerta_1),
    }));

    await client.query("COMMIT");
    console.log(
      `✅ [SYNC STOCK] Finalizado. Total registros procesados: ${totalUpdates}.`
    );

    if (itemsCriticos.length > 0) {
      enviarAlertaStock(itemsCriticos).catch((e) =>
        console.error("Error Telegram Async:", e)
      );
    }

    return {
      success: true,
      count: totalUpdates,
      alertas: itemsCriticos.length,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error Sync Stock:", err);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

// =====================================================
// 4. SYNC MATERIAS PRIMAS (CORREGIDO + DEDUPLICADO + ESPACIOS)
// =====================================================
async function sincronizarMateriasPrimas() {
  const client = await db.connect();
  try {
    console.log("⏳ [SYNC] Materias Primas...");
    const buffer = await leerMateriasPrimas();
    const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
      const str = JSON.stringify(rawMatrix[i]).toUpperCase();
      if (str.includes("CODIGO") && str.includes("STOCK")) {
        headerRowIdx = i;
        break;
      }
    }

    const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx });
    const mapaMP = new Map();

    for (const row of data) {
      let codigo = null,
        nombre = null,
        stock = 0,
        minimo = 0;

      for (const key of Object.keys(row)) {
        // Normalizar y QUITAR ESPACIOS para que "STOCK MIN" sea "STOCKMIN"
        const k = normalizarEncabezado(key);
        const kSinEspacios = k.replace(/\s+/g, "");

        if (
          kSinEspacios === "CODIGO" ||
          kSinEspacios === "COD" ||
          kSinEspacios === "ID"
        )
          codigo = limpiarCodigo(row[key]);
        else if (
          kSinEspacios === "ARTICULO" ||
          kSinEspacios === "DESCRIPCION" ||
          kSinEspacios === "MATERIAL" ||
          kSinEspacios === "NOMBRE"
        )
          nombre = row[key];
        else if (
          kSinEspacios === "STOCK" ||
          kSinEspacios === "CANTIDAD" ||
          kSinEspacios === "EXISTENCIA"
        )
          stock = limpiarNumero(row[key]);
        // AHORA SÍ DETECTARÁ "STOCK MIN" PORQUE SERÁ "STOCKMIN"
        else if (
          kSinEspacios === "STOCKMIN" ||
          kSinEspacios === "MINIMO" ||
          kSinEspacios === "MIN" ||
          kSinEspacios.includes("STOCKMIN")
        )
          minimo = limpiarNumero(row[key]);
      }

      // Filtro Inteligente: Debe tener código, nombre y código no ser gigante (evita títulos de categoría)
      if (codigo && nombre && codigo.length < 30) {
        mapaMP.set(codigo, [codigo, nombre, stock, minimo, new Date()]);
      }
    }

    const valoresInsertar = Array.from(mapaMP.values());

    if (valoresInsertar.length > 0) {
      await client.query("BEGIN");
      const query = format(
        `INSERT INTO materias_primas (codigo, nombre, stock_actual, stock_minimo, ultima_actualizacion) 
             VALUES %L
             ON CONFLICT (codigo) DO UPDATE SET 
             stock_actual = EXCLUDED.stock_actual,
             stock_minimo = EXCLUDED.stock_minimo,
             nombre = COALESCE(EXCLUDED.nombre, materias_primas.nombre),
             ultima_actualizacion = NOW()`,
        valoresInsertar
      );
      await client.query(query);
      await client.query("COMMIT");
      console.log(
        `✅ [SYNC MP] Actualizadas ${valoresInsertar.length} materias primas.`
      );
    }

    return { success: true, count: valoresInsertar.length };
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("❌ Error Sync MP:", err.message);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

module.exports = {
  sincronizarBaseDeDatos,
  sincronizarPedidos,
  sincronizarStockSemielaborados,
  sincronizarMateriasPrimas,
};
