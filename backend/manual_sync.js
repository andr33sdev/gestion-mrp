// backend/manual_sync.js
require("dotenv").config();
const db = require("./db");
const { leerArchivoPedidos } = require("./google-drive");
const { sincronizarPedidos } = require("./services/syncService");

async function diagnostico() {
  console.log("========================================");
  console.log("🕵️‍♂️ INICIANDO DIAGNÓSTICO MANUAL");
  console.log("========================================");

  // 1. PROBAR CONEXIÓN DB
  try {
    console.log("1️⃣ Probando conexión a Base de Datos...");
    const client = await db.connect();
    const res = await client.query("SELECT NOW()");
    console.log("   ✅ DB Conectada. Hora server:", res.rows[0].now);
    client.release();
  } catch (e) {
    console.error("   ❌ ERROR FATAL DB:", e.message);
    process.exit(1);
  }

  // 2. PROBAR LECTURA GOOGLE SHEETS
  let filas = [];
  try {
    console.log("\n2️⃣ Intentando leer Google Sheet...");
    console.log(
      "   ID usado:",
      process.env.GOOGLE_SHEET_ID_PEDIDOS || process.env.PEDIDOS_FILE_ID
    );

    filas = await leerArchivoPedidos();

    if (!filas || filas.length === 0) {
      console.error("   ❌ ERROR: Google devolvió 0 filas.");
      console.error("   Asegúrate de que:");
      console.error(
        "   a) El ID en .env sea de un Google Sheet nativo (no .xlsx)."
      );
      console.error(
        "   b) La hoja se llame 'Hoja1' (o cambia el rango en google-drive.js)."
      );
      process.exit(1);
    }

    console.log(`   ✅ Lectura Exitosa: Se obtuvieron ${filas.length} filas.`);
    console.log("   📝 Primera fila (Headers):", filas[0]);
    if (filas.length > 1) console.log("   📝 Segunda fila (Datos):", filas[1]);
  } catch (e) {
    console.error("   ❌ ERROR LEYENDO DRIVE:", e.message);
    process.exit(1);
  }

  // 3. EJECUTAR SINCRONIZACIÓN
  try {
    console.log("\n3️⃣ Ejecutando Sincronización (syncService)...");
    await sincronizarPedidos();
    console.log("   ✅ Función ejecutada.");
  } catch (e) {
    console.error("   ❌ LA SINCRONIZACIÓN FALLÓ:", e.message);
  }

  // 4. VERIFICAR RESULTADO FINAL EN DB
  try {
    console.log("\n4️⃣ Verificando tabla 'pedidos_clientes'...");
    const resultado = await db.query("SELECT * FROM pedidos_clientes");
    console.log(`   📊 TOTAL FILAS EN DB: ${resultado.rows.length}`);

    if (resultado.rows.length > 0) {
      console.log("   🎉 ¡ÉXITO! Muestra de datos:");
      console.table(
        resultado.rows.slice(0, 3).map((r) => ({
          id: r.id,
          oc: r.oc,
          cliente: r.cliente,
          modelo: r.modelo,
          categoria_oc_cliente: r.categoria,
        }))
      );
    } else {
      console.log("   ⚠️ LA TABLA SIGUE VACÍA. Algo pasó en el insert.");
    }
  } catch (e) {
    console.error("   ❌ Error consultando tabla:", e.message);
  }

  process.exit(0);
}

diagnostico();
