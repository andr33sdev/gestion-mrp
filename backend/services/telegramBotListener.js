// backend/services/telegramBotListener.js
const TelegramBot = require("node-telegram-bot-api");
const db = require("../db");

const token = process.env.TELEGRAM_BOT_TOKEN;

function iniciarBotReceptor() {
  if (!token) {
    console.warn("⚠️ [TELEGRAM] Sin token. El bot no iniciará.");
    return;
  }

  // polling: true hace que el bot "pregunte" a Telegram si hay mensajes nuevos cada segundo.
  // Esto funciona perfecto en local y en servidores simples.
  const bot = new TelegramBot(token, { polling: true });

  console.log("🤖 [TELEGRAM] Bot escuchando mensajes...");

  bot.on("message", async (msg) => {
    const texto = msg.text || "";
    const chatId = msg.chat.id;

    console.log(
      `📩 [TELEGRAM] Mensaje recibido de ${
        msg.from.first_name
      }: "${texto.substring(0, 50)}..."`
    );

    // 1. COMANDO /START (Para probar si vive)
    if (texto === "/start") {
      bot.sendMessage(
        chatId,
        "👋 ¡Hola! Soy el Bot de Gestión MRP.\nReenvíame una Hoja de Ruta de Equal para capturarla."
      );
      return;
    }

    // 2. DETECTAR HOJA DE RUTA (Flexibilizado)
    // Aceptamos "Serenplas", "Conoplas" o simplemente "Hoja de Ruta" junto con "FECHA:"
    const esHojaDeRuta =
      (texto.includes("Hoja de Ruta") || texto.includes("Hoja De Ruta")) &&
      texto.includes("FECHA:");

    if (esHojaDeRuta) {
      console.log("   ✅ Detectado formato de Hoja de Ruta.");

      try {
        // 3. PARSEAR DATOS
        const lineas = texto.split("\n");
        let idCliente = "";
        let razSoc = "";
        let fechaStr = "";

        lineas.forEach((l) => {
          if (l.includes("IDCLIENTE:")) idCliente = l.split(":")[1].trim();
          if (l.includes("RAZSOC:")) razSoc = l.split(":")[1].trim();
          if (l.includes("FECHA:")) fechaStr = l.split(":")[1].trim();
        });

        // Convertir 2025.11.28 -> 2025-11-28
        const fechaFinal = fechaStr.replace(/\./g, "-");

        if (!razSoc || !fechaFinal) {
          throw new Error("Faltan datos clave (RAZSOC o FECHA)");
        }

        // 4. GUARDAR EN DB
        const client = await db.connect();
        await client.query(
          `INSERT INTO novedades_pedidos (cliente, razon_social, fecha_nueva, mensaje_original)
                     VALUES ($1, $2, $3, $4)`,
          [idCliente, razSoc, fechaFinal, texto]
        );
        client.release();

        // 5. CONFIRMAR
        bot.sendMessage(
          chatId,
          `✅ **Dato Capturado**\nCliente: *${razSoc}*\nNueva Fecha: *${fechaFinal}*`,
          { parse_mode: "Markdown" }
        );
        console.log(`   💾 Guardado: ${razSoc} -> ${fechaFinal}`);
      } catch (e) {
        console.error("   ❌ Error procesando:", e.message);
        bot.sendMessage(
          chatId,
          "⚠️ Error al leer los datos. Asegúrate de reenviar el mensaje completo."
        );
      }
    } else {
      // Si no es comando ni hoja de ruta, ignoramos (o avisamos en debug)
      console.log("   Running ignored (no parece hoja de ruta).");
    }
  });

  // Manejo de errores de polling (común si hay conflictos)
  bot.on("polling_error", (error) => {
    console.error(`[TELEGRAM ERROR] ${error.code}: ${error.message}`);
  });
}

module.exports = { iniciarBotReceptor };
