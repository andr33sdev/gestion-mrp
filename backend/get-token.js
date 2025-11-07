const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Alcance: Solo queremos leer Google Drive
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

// Ruta a tu llave descargada
const KEY_PATH = path.join(__dirname, 'client_secret.json');

// --- Esta función se ejecutará sola ---
async function authorize() {
  // 1. Lee las credenciales del JSON
  const keys = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = keys.installed;

  // 2. Crea un cliente OAuth2
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0] // Usualmente http://localhost
  );

  // 3. Genera la URL para pedir permiso
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline', // Pide el 'refresh token' (la llave permanente)
    scope: SCOPES,
  });

  console.log('--- PASO 1: AUTORIZACIÓN ---');
  console.log('Abre esta URL en tu navegador (copia y pega):');
  console.log(authUrl);
  console.log('---------------------------------');
  console.log('Luego de autorizar, Google te redirigirá a una página');
  console.log('que no cargará (localhost).');
  console.log('Copia el código "code" de la URL de tu navegador.');
  console.log('Ejemplo: ...localhost/?code=AQUI_VA_EL_CODIGO&...');
  console.log('---------------------------------');

  // 4. Pide el código al usuario
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Pega el código "code" aquí: ', async (code) => {
    rl.close();
    try {
      // 5. Canjea el código por una llave (token)
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      console.log('\n¡Autorización exitosa!');

      if (tokens.refresh_token) {
        console.log('\n--- ¡GUARDA ESTA LLAVE! ---');
        console.log('Este es tu "Refresh Token" (Llave Permanente):');
        console.log(tokens.refresh_token);
        console.log('-----------------------------');
        console.log('La usaremos en el próximo paso.');
      } else {
        console.log('\nNo se recibió un "refresh_token".');
        console.log('Asegúrate de estar usando una cuenta que no sea de Workspace o');
        console.log('de que no hayas autorizado esta app antes.');
      }
    } catch (err) {
      console.error('Error al canjear el token:', err.message);
    }
  });
}

authorize().catch(console.error);