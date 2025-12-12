// backend/google-drive.js
const { google } = require("googleapis");

// --- VARIABLES DE ENTORNO ---
const FILE_ID = process.env.DRIVE_FILE_ID;
const PEDIDOS_FILE_ID = process.env.PEDIDOS_FILE_ID;
const STOCK_FILE_ID = process.env.STOCK_SEMIELABORADOS_FILE_ID;
const MP_FILE_ID = process.env.MATERIAS_PRIMAS_FILE_ID;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SHEET_ID_PEDIDOS = process.env.GOOGLE_SHEET_ID_PEDIDOS || PEDIDOS_FILE_ID;
const REDIRECT_URI = "http://localhost";

let drive;
let authClient;

// --- CONFIGURAR AUTENTICACIÓN ---
async function setupAuth() {
  try {
    // Si ya existe, lo retornamos, PERO a veces es mejor renovar si sospechamos caché
    if (authClient && drive) return authClient;

    if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
      console.error("ERROR CRÍTICO: Faltan variables de entorno de Google.");
      process.exit(1);
    }

    const oAuth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
    oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    // Forzamos la obtención del token
    await oAuth2Client.getAccessToken();

    authClient = oAuth2Client;

    // Configuración global para deshabilitar caché en axios (usado por googleapis)
    google.options({
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });

    drive = google.drive({ version: "v3", auth: authClient });

    console.log("✅ Google Auth conectado (Modo Anti-Caché Activo).");
    return authClient;
  } catch (err) {
    console.error("Error fatal Drive:", err.message);
    process.exit(1);
  }
}

// --- LECTURA DE ARCHIVOS ---

// 1. HORNO (TXT) - Descarga Binaria
async function leerArchivoHorno() {
  if (!drive) await setupAuth();
  try {
    // Agregamos un timestamp aleatorio en los headers o query params si fuera URL directa
    // Aquí usamos headers estrictos
    const response = await drive.files.get({
      fileId: FILE_ID,
      alt: "media",
      // Forzamos headers en la petición específica también
      headers: { "Cache-Control": "no-cache" },
    });
    return response.data;
  } catch (err) {
    console.error("Error leyendo Horno:", err.message);
    throw new Error("Fallo lectura Horno");
  }
}

// 2. PEDIDOS (GOOGLE SHEET) - LECTURA INTELIGENTE
async function leerArchivoPedidos() {
  try {
    if (!authClient) await setupAuth();
    const sheets = google.sheets({ version: "v4", auth: authClient });
    const targetId = PEDIDOS_FILE_ID; // Ojo aquí, veremos cuál está tomando

    // PASO 1: Obtener Metadatos COMPLETOS
    const metaData = await sheets.spreadsheets.get({
      spreadsheetId: targetId,
      headers: { "Cache-Control": "no-cache" },
    });

    const tituloArchivo = metaData.data.properties.title; // El nombre del archivo Excel
    const nombreHoja = metaData.data.sheets[0].properties.title; // El nombre de la pestaña 1

    console.log("---------------------------------------------------");
    console.log("🕵️‍♂️ REPORTE DE IDENTIDAD DEL ARCHIVO");
    console.log(`🆔 ID Usado:       ${targetId}`);
    console.log(`📄 Nombre Archivo: "${tituloArchivo}"`); // <--- ¿Coincide con el que ves en Chrome?
    console.log(`📑 Pestaña Leída:  "${nombreHoja}" (Índice 0)`);
    console.log(
      `🔗 Link generado:  https://docs.google.com/spreadsheets/d/${targetId}/edit`
    );
    console.log("---------------------------------------------------");

    // PASO 2: Leer valores forzando nueva petición
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: targetId,
      range: `${nombreHoja}!A:Z`,
      headers: { "Cache-Control": "no-cache" },
    });

    const rows = response.data.values;
    // --- 🚨 BLOQUE DE DEBUG SUPREMO ---
    console.log(
      `🔍 [DEBUG] Filas crudas descargadas de Drive: ${rows ? rows.length : 0}`
    );
    if (rows && rows.length > 0) {
      // Buscamos "Luparini" en los datos crudos recién bajados
      const fantasmas = rows.filter((r) =>
        JSON.stringify(r).toUpperCase().includes("LUPARINI")
      );

      if (fantasmas.length > 0) {
        console.log(
          "❌ MALAS NOTICIAS: Google Drive TODAVÍA está enviando 'Luparini'."
        );
        console.log("👀 Ejemplo de fila sucia:", fantasmas[0]);
        console.log(`🔢 Total de filas infectadas: ${fantasmas.length}`);
      } else {
        console.log(
          "✨ BUENAS NOTICIAS: Los datos de Google Drive vienen LIMPIOS."
        );
        console.log(
          "👉 CONCLUSIÓN: El problema es que NO estás borrando la tabla de tu base de datos antes de insertar."
        );
      }
    }
    // -----------------------------------

    if (!rows || rows.length === 0) return [];

    return rows;
  } catch (err) {
    console.error("❌ Error leyendo Pedidos (API):", err.message);
    return [];
  }
}

// 3. STOCK Y MATERIAS PRIMAS (EXCEL BINARIO .XLSX) - Descarga Buffer
async function descargarCualquierExcel(fileId, label) {
  if (!drive) await setupAuth();
  console.log(`[${label}] Descargando binario ID: ${fileId}...`);

  const noCacheHeaders = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };

  try {
    // Intentamos exportar si es nativo de Google Sheets
    try {
      const res = await drive.files.export(
        {
          fileId: fileId,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          headers: noCacheHeaders, // Header anti-caché
        },
        { responseType: "arraybuffer" }
      );
      return res.data;
    } catch (e) {
      // Si falla, intentamos bajar directo (si es un .xlsx subido como archivo)
      // OJO: Aquí es donde más se suele cachear
      const res = await drive.files.get(
        {
          fileId: fileId,
          alt: "media",
          headers: noCacheHeaders, // Header anti-caché
        },
        { responseType: "arraybuffer" }
      );
      return res.data;
    }
  } catch (err) {
    console.error(`Error leyendo ${label}:`, err.message);
    throw err;
  }
}

async function leerStockSemielaborados() {
  if (!STOCK_FILE_ID) throw new Error("Falta STOCK ID");
  return await descargarCualquierExcel(STOCK_FILE_ID, "Stock");
}

async function leerMateriasPrimas() {
  if (!MP_FILE_ID) throw new Error("Falta MP ID");
  return await descargarCualquierExcel(MP_FILE_ID, "Materias Primas");
}

// --- ESCRITURA PEDIDOS ---
async function agregarPedidoAlSheet(datos) {
  try {
    if (!authClient) await setupAuth();
    const sheets = google.sheets({ version: "v4", auth: authClient });
    const targetSheetId = SHEET_ID_PEDIDOS;

    const valores = [
      [
        datos.fecha,
        datos.periodo,
        datos.op_interna,
        datos.cliente,
        datos.modelo,
        datos.detalles,
        datos.oc_cliente,
        datos.cantidad,
        "",
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: targetSheetId,
      range: "Hoja1!A:I",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: valores },
      headers: { "Cache-Control": "no-cache" },
    });

    console.log(`✅ Pedido OP ${datos.op_interna} guardado en Drive.`);
    return true;
  } catch (error) {
    console.error("❌ Error escribiendo en Sheet:", error.message);
    throw error;
  }
}

module.exports = {
  setupAuth,
  leerArchivoHorno,
  leerArchivoPedidos,
  leerStockSemielaborados,
  leerMateriasPrimas,
  agregarPedidoAlSheet,
};
