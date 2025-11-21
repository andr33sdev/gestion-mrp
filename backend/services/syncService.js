// backend/services/syncService.js
const db = require("../db");
const { leerArchivoHorno, leerArchivoPedidos } = require("../google-drive");
const { parsearLog } = require("../parser");
const format = require("pg-format");
const XLSX = require("xlsx");

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
                acc[row.estacion_id] = { json: "[]", list: [], accion: `Estacion ${row.estacion_id}` };
            }
            return acc;
        }, {});

        const { rows: dbTriggers } = await client.query(
            `SELECT fecha, hora, accion FROM registros WHERE tipo = 'EVENTO' AND accion LIKE 'Se inicio ciclo%'`
        );
        const dbTriggerSet = new Set(
            dbTriggers.map((r) => `${r.fecha.toISOString().split("T")[0]}T${r.hora}_${r.accion}`)
        );

        const newArchiveRecords = [];
        for (const reg of registrosOriginales) {
            let stationId = null, isStartCycle = false;
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
                            hora: archiveDateTime.toTimeString().split(" ")[0].split("(")[0].trim(),
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
        const valores = allRecordsToInsert.map((r) => [r.fecha, r.hora, r.accion, r.tipo, r.productos_json || null]);
        await client.query(format("INSERT INTO registros (fecha, hora, accion, tipo, productos_json) VALUES %L", valores));
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

// --- SYNC PEDIDOS EXCEL ---
async function sincronizarPedidos() {
    console.log("⏳ [SYNC] Iniciando sincronización de Pedidos (Excel -> DB)...");
    let rawData = [];
    try {
        const buffer = await leerArchivoPedidos();
        const wb = XLSX.read(Buffer.from(buffer), { type: "buffer", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rawData = XLSX.utils.sheet_to_json(sheet);
    } catch (e) {
        console.error("❌ [SYNC] Error descargando Excel:", e.message);
        return;
    }

    const client = await db.connect();
    try {
        // 1. Insertar Pedidos
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
                const limpio = String(cantidadRaw).replace(/,/g, ".").replace(/[^\d.-]/g, "");
                cantidad = parseFloat(limpio);
                if (isNaN(cantidad)) cantidad = 0;
            }

            const cliente = r.CLIENTE || r.Cliente || r.cliente || null;
            const modelo = r.MODELO || r.Modelo || r.modelo || null;
            const oc = r.OC || r.oc || null;
            const estado = r.ESTADO || r.Estado || r.estado || null;
            const detalles = r.DETALLES || r.Detalles || r.detalles || null;
            const fechaDespachoRaw = r["FECHA DESPACHO"] || r.fecha_despacho; // Ajustar según tu excel
            const fechaDespacho = fechaDespachoRaw ? new Date(fechaDespachoRaw) : null;

            valoresInsertar.push([fecha, cliente, modelo, cantidad, oc, estado, detalles, fechaDespacho]);
        }

        await client.query("BEGIN");
        await client.query("TRUNCATE TABLE pedidos RESTART IDENTITY");

        const TAMANO_LOTE = 500;
        for (let i = 0; i < valoresInsertar.length; i += TAMANO_LOTE) {
            const lote = valoresInsertar.slice(i, i + TAMANO_LOTE);
            // NOTA: Añadí fecha_despacho al query
            const query = format(
                "INSERT INTO pedidos (fecha, cliente, modelo, cantidad, oc, estado, detalles, fecha_despacho) VALUES %L",
                lote
            );
            await client.query(query);
        }

        // 2. Procesar Despachos Automáticos (Quintana)
        await procesarDespachosAutomaticos(client);

        await client.query("COMMIT");
        console.log("✅ [SYNC] Sincronización completada con éxito.");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ [SYNC] Error en base de datos:", err.message);
    } finally {
        client.release();
    }
}

async function procesarDespachosAutomaticos(client) {
    console.log("🚚 [DESPACHOS] Buscando nuevos despachos...");
    const { rows: despachados } = await client.query("SELECT * FROM pedidos WHERE fecha_despacho IS NOT NULL");
    let procesados = 0;

    for (const pedido of despachados) {
        const recetaRes = await client.query(`
      SELECT r.cantidad, s.nombre, s.id as semi_id
      FROM recetas r
      JOIN semielaborados s ON r.semielaborado_id = s.id
      WHERE r.producto_terminado = $1
    `, [pedido.modelo]);

        if (recetaRes.rows.length === 0) continue;

        for (const ing of recetaRes.rows) {
            const cantidadADescontar = Number(pedido.cantidad) * Number(ing.cantidad);
            const existe = await client.query(`
          SELECT 1 FROM historial_despachos 
          WHERE oc = $1 AND modelo_producto = $2 AND cliente = $3 
          AND fecha_despacho = $4 AND semielaborado_nombre = $5
       `, [pedido.oc, pedido.modelo, pedido.cliente, pedido.fecha_despacho, ing.nombre]);

            if (existe.rowCount === 0) {
                await client.query(
                    `UPDATE semielaborados SET stock_deposito_quintana = stock_deposito_quintana - $1 WHERE id = $2`,
                    [cantidadADescontar, ing.semi_id]
                );
                await client.query(
                    `INSERT INTO historial_despachos (fecha_despacho, cliente, oc, modelo_producto, semielaborado_nombre, cantidad_descontada) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [pedido.fecha_despacho, pedido.cliente, pedido.oc, pedido.modelo, ing.nombre, cantidadADescontar]
                );
                procesados++;
            }
        }
    }
    if (procesados > 0) console.log(`✅ [DESPACHOS] Se procesaron ${procesados} movimientos.`);
}

module.exports = { sincronizarBaseDeDatos, sincronizarPedidos };