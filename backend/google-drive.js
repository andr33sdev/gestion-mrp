// backend/google-drive.js
const { google } = require("googleapis");

// --- 1. LEER TODAS LAS VARIABLES DE ENTORNO AQUÍ ---
const FILE_ID = process.env.DRIVE_FILE_ID; // Log del Horno (txt)
const PEDIDOS_FILE_ID = process.env.PEDIDOS_FILE_ID; // Excel de Pedidos
const STOCK_FILE_ID = process.env.STOCK_SEMIELABORADOS_FILE_ID; // Excel de Stock
const MP_FILE_ID = process.env.MATERIAS_PRIMAS_FILE_ID;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost";

let drive;

// --- 2. CONFIGURAR AUTENTICACIÓN ---
async function setupAuth() {
  try {
    if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
      console.error("ERROR CRÍTICO: Faltan variables de entorno de Google.");
      process.exit(1);
    }
    const oAuth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
    oAuth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN,
    });

    // Refrescamos el token inicial
    await oAuth2Client.getAccessToken();

    drive = google.drive({ version: "v3", auth: oAuth2Client });
    console.log("¡Conexión con Google Drive establecida con éxito!");
  } catch (err) {
    console.error("Error fatal al conectar con Google Drive:", err.message);
    process.exit(1);
  }
}

// --- 3. FUNCIONES DE LECTURA ---

// A. Leer Log del Horno (txt) - Siempre es descarga directa
async function leerArchivoHorno() {
  if (!drive) throw new Error("Drive no inicializado.");
  try {
    const response = await drive.files.get({ fileId: FILE_ID, alt: "media" });
    return response.data;
  } catch (err) {
    console.error("Error leyendo Horno:", err.message);
    throw new Error("No se pudo leer el archivo del Horno.");
  }
}

// B. Leer Excel de Pedidos (Puede ser binario o nativo)
async function leerArchivoPedidos() {
  if (!drive) throw new Error("Drive no inicializado.");
  if (!PEDIDOS_FILE_ID) throw new Error("Falta PEDIDOS_FILE_ID en .env");

  return await descargarCualquierExcel(PEDIDOS_FILE_ID, "Pedidos");
}

// C. Leer Excel de Stock (Puede ser binario o nativo)
async function leerStockSemielaborados() {
  if (!drive) throw new Error("Drive no inicializado.");
  if (!STOCK_FILE_ID)
    throw new Error("Falta STOCK_SEMIELABORADOS_FILE_ID en .env");

  return await descargarCualquierExcel(STOCK_FILE_ID, "Stock");
}

// --- FUNCIÓN "INTELIGENTE" (Detecta si es Sheet o Excel y actúa acorde) ---
async function descargarCualquierExcel(fileId, label) {
  console.log(`[${label}] Intentando leer ID: ${fileId}`);

  try {
    // INTENTO 1: Usar 'export' (Para Hojas de Cálculo de Google Nativas)
    // Esto convierte el Google Sheet a formato Excel (.xlsx) al vuelo
    const response = await drive.files.export(
      {
        fileId: fileId,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      },
      { responseType: "arraybuffer" }
    );

    console.log(`[${label}] Exportación nativa exitosa.`);
    return response.data;
  } catch (err) {
    // Si el error dice que "Export only supports Google Docs", es porque es un archivo binario real (.xlsx)
    // Así que intentamos descargarlo normalmente con 'get'
    if (
      err.message &&
      (err.message.includes("Export only supports Google Docs") ||
        err.code === 403)
    ) {
      console.log(
        `[${label}] No es nativo o falló exportación. Intentando descarga binaria directa...`
      );
      try {
        const response = await drive.files.get(
          {
            fileId: fileId,
            alt: "media",
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          },
          { responseType: "arraybuffer" }
        );
        return response.data;
      } catch (err2) {
        console.error(
          `[${label}] Falló también la descarga binaria:`,
          err2.message
        );
        throw new Error(
          `No se pudo leer ${label} (ni como Sheet ni como Excel).`
        );
      }
    }

    console.error(`[${label}] Error fatal leyendo archivo:`, err.message);
    if (err.response && err.response.data) {
      console.error("Detalle API:", JSON.stringify(err.response.data));
    }
    throw new Error(`No se pudo leer el archivo de ${label}.`);
  }
}

async function leerMateriasPrimas() {
  if (!drive) throw new Error("Drive no inicializado.");
  if (!MP_FILE_ID) throw new Error("Falta MATERIAS_PRIMAS_FILE_ID en .env");
  return await descargarCualquierExcel(MP_FILE_ID, "Materias Primas");
}

module.exports = {
  setupAuth,
  leerArchivoHorno,
  leerArchivoPedidos,
  leerStockSemielaborados,
  leerMateriasPrimas,
};
