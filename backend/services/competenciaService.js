// backend/services/competenciaService.js
const axios = require("axios");
const cheerio = require("cheerio");
const db = require("../db");

// Helper para limpiar precios (quita puntos de miles)
function parsearPrecio(texto) {
  if (!texto) return 0;
  let limpio = texto.toString();
  limpio = limpio.replace(/\./g, ""); // Quita puntos de miles
  limpio = limpio.replace(/,/g, "."); // Cambia coma decimal por punto
  limpio = limpio.replace(/[^0-9.]/g, "");
  return parseFloat(limpio) || 0;
}

async function escanearProducto(item) {
  try {
    console.log(`🕵️ Analizando: ${item.alias}`);
    const { data } = await axios.get(item.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);
    let precio = 0;

    if (item.sitio === "MERCADOLIBRE") {
      const metaPrice = $('meta[property="product:price:amount"]').attr(
        "content"
      );
      if (metaPrice) precio = parseFloat(metaPrice);
      if (!precio) {
        const precioVisual = $(
          ".ui-pdp-price__second-line .andes-money-amount__fraction"
        )
          .first()
          .text();
        precio = parsearPrecio(precioVisual);
      }
    }

    if (precio > 0) {
      await db.query(
        "UPDATE competencia_tracking SET ultima_revision = NOW() WHERE id = $1",
        [item.id]
      );

      // Detectar cambio
      if (
        item.ultimo_precio == 0 ||
        precio !== parseFloat(item.ultimo_precio)
      ) {
        const precioAnterior = parseFloat(item.ultimo_precio);

        // Guardamos nuevo precio
        await db.query(
          "UPDATE competencia_tracking SET ultimo_precio = $1 WHERE id = $2",
          [precio, item.id]
        );

        if (precioAnterior > 0) {
          const diferencia = precio - precioAnterior;
          const porcentaje = Math.round((diferencia / precioAnterior) * 100);
          const emoji = diferencia > 0 ? "📈 SUBIÓ" : "📉 BAJÓ";

          // USAMOS HTML AQUÍ
          return (
            `🚨 <b>ALERTA COMPETENCIA</b>\n\n` +
            `📦 <b>${item.alias}</b>\n` +
            `${emoji} <b>${porcentaje}%</b>\n` +
            `Antes: $${precioAnterior}\n` +
            `Ahora: <b>$${precio}</b>\n` +
            `<a href="${item.url}">Ver Publicación</a>`
          );
        } else {
          return `✅ <b>Rastreo Iniciado</b>\n📦 ${item.alias}\n💰 Precio Base: $${precio}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`❌ Error scraping ${item.alias}:`, error.message);
    return null;
  }
}

async function vigilarCompetencia(botInstance, adminChatId) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM competencia_tracking WHERE activo = TRUE"
    );

    for (const item of rows) {
      const alerta = await escanearProducto(item);

      if (alerta && botInstance && adminChatId) {
        // BLINDAJE: Try/Catch interno para que un error de envío no frene a los demás
        try {
          await botInstance.sendMessage(adminChatId, alerta, {
            parse_mode: "HTML", // <--- CLAVE: Usar HTML
            disable_web_page_preview: true,
          });
        } catch (sendError) {
          console.error(
            `❌ Error enviando a Telegram (${item.alias}):`,
            sendError.message
          );
        }
      }
      // Pausa para evitar bloqueos
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (e) {
    console.error("❌ Error General:", e);
  }
}

module.exports = { vigilarCompetencia, escanearProducto };
