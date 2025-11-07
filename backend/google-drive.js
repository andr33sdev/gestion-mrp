// backend/google-drive.js
const { google } = require("googleapis");

// --- Leemos todas las claves desde las Variables de Entorno ---
const FILE_ID = process.env.DRIVE_FILE_ID;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost"; // Esto se queda así

let drive;

async function setupAuth() {
  try {
    if (!FILE_ID || !REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
      console.error("ERROR: Faltan variables de entorno críticas de Google.");
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
    await oAuth2Client.getAccessToken();
    drive = google.drive({ version: "v3", auth: oAuth2Client });
    console.log("¡Conexión con Google Drive establecida con éxito!");
  } catch (err) {
    console.error(
      "Error al configurar la autenticación de Google Drive:",
      err.message
    );
    process.exit(1);
  }
}

async function leerArchivoHorno() {
  if (!drive)
    throw new Error("El cliente de Google Drive no está inicializado.");
  try {
    const response = await drive.files.get({
      fileId: FILE_ID,
      alt: "media",
    });
    return response.data;
  } catch (err) {
    console.error("Error al leer el archivo de Google Drive:", err.message);
    throw new Error("No se pudo leer el archivo de Drive.");
  }
}

module.exports = {
  setupAuth,
  leerArchivoHorno,
};
