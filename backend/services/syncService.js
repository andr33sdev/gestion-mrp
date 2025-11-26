const db = require("../db");
const {
  leerArchivoHorno,
  leerArchivoPedidos,
  leerStockSemielaborados,
} = require("../google-drive");
const { parsearLog } = require("../parser");
const format = require("pg-format");
const XLSX = require("xlsx");

// --- HELPERS ---

// --- HELPER FECHA ---
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

// Helper para formatear fecha a texto YYYY-MM-DD (Para guardar en columna TEXT)
function formatearFechaParaDB(fechaObj) {
  if (!fechaObj || !(fechaObj instanceof Date) || isNaN(fechaObj)) return null;
  return fechaObj.toISOString().split("T")[0]; // Devuelve "2025-11-25"
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

// --- SYNC PEDIDOS (CONVERSIÓN A TEXTO) ---
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
        const key = normalizarEncabezado(n.razon_social);
        mapaNovedades[key] = n.fecha_nueva;
      }
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawMatrix.length, 30); i++) {
      const rowString = JSON.stringify(rawMatrix[i]).toUpperCase();
      if (rowString.includes("FECHA") && rowString.includes("CLIENTE")) {
        headerRowIndex = i;
        console.log(`   ✅ Encabezados Pedidos encontrados en fila ${i + 1}`);
        break;
      }
    }
    if (headerRowIndex === -1) headerRowIndex = 0;

    const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
    const valoresInsertar = [];
    const FECHA_CORTE = new Date("2025-01-01");

    for (const r of data) {
      let fecha = null;
      let cliente = null;
      let modelo = null;
      let cantidad = 0;
      let oc = null;
      let estado = null;
      let detalles = null;
      let fechaDespachoObj = null; // Objeto Date temporal

      for (const key of Object.keys(r)) {
        const k = normalizarEncabezado(key);
        const val = r[key];

        if (k === "FECHA" || k === "FECHAPEDIDO") {
          fecha = parsearFechaExcel(val);
        } else if (k === "CLIENTE" || k === "RAZONSOCIAL") cliente = val;
        else if (k === "MODELO" || k === "ARTICULO" || k === "PRODUCTO")
          modelo = val;
        else if (k === "CANTIDAD" || k === "CANT" || k === "Q")
          cantidad = limpiarNumero(val);
        else if (k === "OC" || k === "ORDENCOMPRA") oc = val;
        else if (k === "ESTADO" || k === "SITUACION" || k.includes("DEMORA"))
          estado = val;
        else if (k === "DETALLES" || k === "OBSERVACIONES" || k === "OBS")
          detalles = val;
        else if (
          k.includes("DESPACHO") ||
          k.includes("ENTREGA") ||
          k === "SALIDA"
        ) {
          fechaDespachoObj = parsearFechaExcel(val);
        }
      }

      if (!fecha || fecha < FECHA_CORTE) continue;

      if (cliente) {
        const keyCliente = normalizarEncabezado(cliente);
        if (mapaNovedades[keyCliente]) {
          fechaDespachoObj = new Date(mapaNovedades[keyCliente]);
        }
      }

      // CONVERTIR FECHA DESPACHO A STRING (YYYY-MM-DD) O NULL
      const fechaDespachoStr = formatearFechaParaDB(fechaDespachoObj);

      if (fechaDespachoStr) {
        estado = "ENTREGADO";
      } else {
        if (!estado) estado = "PENDIENTE";
      }

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
        // Insertamos fecha_despacho como string, la tabla ahora lo aceptará
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
    console.error("❌ [SYNC] Error Pedidos:", err.message);
  } finally {
    client.release();
  }
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
