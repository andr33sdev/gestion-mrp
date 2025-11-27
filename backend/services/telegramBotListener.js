// backend/services/telegramBotListener.js
const TelegramBot = require("node-telegram-bot-api");
const db = require("../db");

const token = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_ID;

let botInstance = null;

/**
 * Obtiene la instancia del bot según el entorno.
 * Evita conflicto 409 en local.
 */
function getBot() {
  if (!botInstance && token) {
    const esProduccion =
      process.env.RENDER || process.env.NODE_ENV === "production";

    if (esProduccion) {
      console.log("🤖 [TELEGRAM] Modo Producción (Polling Activo).");
      botInstance = new TelegramBot(token, { polling: true });
    } else {
      console.log("🛑 [TELEGRAM] Modo Local (Polling Desactivado).");
      botInstance = new TelegramBot(token, { polling: false });
    }
  }
  return botInstance;
}

function iniciarBotReceptor() {
  const bot = getBot();
  if (!bot) return;

  if (bot.options.polling === false) return;

  bot.on("polling_error", (error) => {
    if (error.code !== "EFATAL")
      console.warn(`[TELEGRAM WARN] ${error.code || error.message}`);
  });

  // --- LISTENER DE MENSAJES (HOJA DE RUTA) ---
  bot.on("message", async (msg) => {
    const texto = msg.text || "";
    const chatId = msg.chat.id;

    if (texto === "/start") {
      bot.sendMessage(chatId, "👋 Bot de Gestión MRP Activo.");
      return;
    }

    const esHojaDeRuta =
      (texto.includes("Hoja de Ruta") || texto.includes("Hoja De Ruta")) &&
      texto.includes("FECHA:");

    if (esHojaDeRuta) {
      console.log(`📩 [TELEGRAM] Procesando Hoja de Ruta...`);
      try {
        const lineas = texto.split("\n");
        let idCliente = "",
          razSoc = "",
          fechaStr = "";

        lineas.forEach((l) => {
          if (l.includes("IDCLIENTE:")) idCliente = l.split(":")[1].trim();
          if (l.includes("RAZSOC:")) razSoc = l.split(":")[1].trim();
          if (l.includes("FECHA:")) fechaStr = l.split(":")[1].trim();
        });

        const fechaFinal = fechaStr.replace(/\./g, "-");
        if (!razSoc || !fechaFinal) throw new Error("Datos incompletos");

        const client = await db.connect();
        await client.query(
          `INSERT INTO novedades_pedidos (cliente, razon_social, fecha_nueva, mensaje_original) VALUES ($1, $2, $3, $4)`,
          [idCliente, razSoc, fechaFinal, texto]
        );
        client.release();

        bot.sendMessage(
          chatId,
          `✅ **Hoja de Ruta Capturada**\nCliente: *${razSoc}*\nFecha: *${fechaFinal}*`,
          { parse_mode: "Markdown" }
        );
      } catch (e) {
        console.error("❌ Error Telegram:", e.message);
        bot.sendMessage(chatId, "⚠️ Error al leer los datos.");
      }
    }
  });
}

// --- FUNCIÓN MEJORADA: REPORTE DE STOCK ---
async function enviarAlertaStock(itemsCriticos) {
  const bot = getBot();
  if (!bot) return;

  try {
    let targetId = ADMIN_CHAT_ID;
    if (!targetId) {
      console.warn("⚠️ [TELEGRAM] Faltante: TELEGRAM_ADMIN_ID en .env");
      return;
    }

    // Configuración de paginación (Telegram soporta ~4096 chars, aprox 15-20 productos bien formateados)
    const ITEMS_POR_MENSAJE = 15;

    // Iteramos en trozos para enviar múltiples mensajes si la lista es larga (ej: 56 items)
    for (let i = 0; i < itemsCriticos.length; i += ITEMS_POR_MENSAJE) {
      const lote = itemsCriticos.slice(i, i + ITEMS_POR_MENSAJE);
      const esElPrimero = i === 0;
      const esElUltimo = i + ITEMS_POR_MENSAJE >= itemsCriticos.length;

      let mensaje = "";

      if (esElPrimero) {
        mensaje += `🚨 **ALERTA DE STOCK CRÍTICO** 🚨\n`;
        mensaje += `📉 Se detectaron *${itemsCriticos.length} productos* bajo el mínimo.\n\n`;
      } else {
        mensaje += `... *continuación del reporte* ...\n\n`;
      }

      lote.forEach((item) => {
        // Cálculo visual de gravedad
        const porcentaje =
          item.minimo > 0 ? Math.round((item.total / item.minimo) * 100) : 0;
        let icono = "⚠️";
        if (porcentaje <= 25)
          icono = "🔴"; // Muy crítico (menos del 25% del mínimo)
        else if (porcentaje <= 50) icono = "🟠"; // Crítico medio

        // Formato de Tarjeta Limpia
        mensaje += `${icono} *${item.codigo}* (Cobertura: ${porcentaje}%)\n`;
        mensaje += `   📦 Actual: *${item.total}* /  🎯 Mínimo: ${item.minimo}\n`;
        mensaje += `   📝 _${item.nombre}_\n`;
        mensaje += `   ────────────────\n`;
      });

      if (esElUltimo) {
        mensaje += `\n✅ *Fin del reporte.*`;
      }

      // Enviamos este "trozo"
      await bot.sendMessage(targetId, mensaje, { parse_mode: "Markdown" });
    }

    console.log(
      `✅ Reporte de Alerta enviado (${itemsCriticos.length} items).`
    );
  } catch (e) {
    console.error("Error enviando alerta Telegram:", e.message);
  }
}

// --- NUEVA FUNCIÓN: ALERTA DE MRP (PLANIFICACIÓN) ---
async function enviarAlertaMRP(nombrePlan, materialesCriticos) {
  const bot = getBot();
  if (!bot) return;

  try {
    let targetId = ADMIN_CHAT_ID;
    if (!targetId) {
      // Fallback: intentar leer de DB si no hay env var
      const res = await db.query(
        "SELECT mensaje_original FROM novedades_pedidos LIMIT 1"
      );
      console.warn("⚠️ [TELEGRAM] Faltante: TELEGRAM_ADMIN_ID.");
      return;
    }

    let mensaje = `🏭 **NUEVO PLAN DE PRODUCCIÓN**\n`;
    mensaje += `📂 Plan: *"${nombrePlan}"*\n\n`;
    mensaje += `⚠️ **ALERTA MRP:** Las siguientes materias primas quedarían por debajo del mínimo teórico al finalizar este plan:\n\n`;

    materialesCriticos.slice(0, 15).forEach((mp) => {
      mensaje += `🔻 *${mp.nombre}*\n`;
      mensaje += `   Actual: ${mp.stock} | Consumo Plan: ${mp.consumo}\n`;
      mensaje += `   📉 Final: *${mp.saldo}* (Mín: ${mp.minimo})\n`;
      mensaje += `   ────────────────\n`;
    });

    if (materialesCriticos.length > 15) {
      mensaje += `... y ${materialesCriticos.length - 15} materiales más.`;
    }

    await bot.sendMessage(targetId, mensaje, { parse_mode: "Markdown" });
    console.log(`✅ Alerta MRP enviada para plan "${nombrePlan}".`);
  } catch (e) {
    console.error("Error enviando alerta MRP:", e.message);
  }
}

module.exports = { iniciarBotReceptor, enviarAlertaStock, enviarAlertaMRP };
