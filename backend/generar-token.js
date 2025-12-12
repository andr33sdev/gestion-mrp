// backend/generar_token.js
const { google } = require("googleapis");
const readline = require("readline");
require("dotenv").config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost"; // Debe coincidir con lo que pusiste en Google Cloud Console

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// AQUÍ ESTÁ LA CLAVE: Pedimos permisos de ESCRITURA (Spreadsheets + Drive)
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets", // Leer y Escribir hojas
  "https://www.googleapis.com/auth/drive", // Leer y Escribir archivos
];

const url = oauth2Client.generateAuthUrl({
  access_type: "offline", // Importante para obtener Refresh Token
  scope: SCOPES,
});

console.log("--------------------------------------------------");
console.log(
  "1. Abre este link en tu navegador (logueate con la cuenta dueña del Excel):"
);
console.log("\n", url, "\n");
console.log("--------------------------------------------------");
console.log(
  '2. Si te sale "Google no verificó esta app", dale a Avanzado -> Ir a ... (inseguro)'
);
console.log('3. Al final, la página intentará cargar "localhost" y fallará.');
console.log(
  "4. COPIA EL CÓDIGO que aparece en la barra de direcciones (ej: code=4/0AbCdEf...)"
);
console.log("--------------------------------------------------");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Pega el código aquí: ", async (code) => {
  try {
    // Decodificar el código si viene con %
    const decodedCode = decodeURIComponent(code);
    const { tokens } = await oauth2Client.getToken(decodedCode);

    console.log("\n✅ ¡ÉXITO! Aquí tienes tu nuevo token DE ESCRITURA:");
    console.log("\nGOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("\n-> Copia esto y reemplázalo en tu archivo .env");
  } catch (error) {
    console.error("\n❌ Error obteniendo token:", error.message);
  }
  rl.close();
});
