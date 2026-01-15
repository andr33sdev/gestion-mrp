// backend/services/competenciaService.js
const axios = require("axios");
const cheerio = require("cheerio");
const db = require("../db");

function parsearPrecio(texto) {
  if (!texto) return 0;

  // 1. Convertimos a string por seguridad
  let limpio = texto.toString();

  // 2. Quitamos el símbolo de moneda y espacios si los hubiera (limpieza básica)
  // Pero OJO: Primero eliminamos los PUNTOS de miles, antes de tocar decimales.

  // Caso Argentina: "9.550,00" -> Queremos "9550.00"

  // A. Eliminar todos los puntos (son separadores de miles)
  limpio = limpio.replace(/\./g, "");

  // B. Reemplazar la coma por punto (para que JS lo entienda como decimal)
  limpio = limpio.replace(/,/g, ".");

  // C. Limpiar cualquier otro caracter basura (ej: $, letras)
  limpio = limpio.replace(/[^0-9.]/g, "");

  return parseFloat(limpio) || 0;
}

// 1. Modificamos escanearProducto para que devuelva HTML (Más seguro)
async function escanearProducto(item) {
  try {
    console.log(`🕵️ Analizando: ${item.alias}`);

    const { data } = await axios.get(item.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);
    let precio = 0;

    // ... (Tu lógica de detección de precios de siempre va aquí) ...
    // ... (Mantenemos tu lógica de selectores de ML) ...
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
    // ...

    console.log(`   > Precio: $${precio} (Guardado: $${item.ultimo_precio})`);

    if (precio > 0) {
      await db.query(
        "UPDATE competencia_tracking SET ultima_revision = NOW() WHERE id = $1",
        [item.id]
      );

      // Detectamos cambio
      if (
        item.ultimo_precio == 0 ||
        precio !== parseFloat(item.ultimo_precio)
      ) {
        const precioAnterior = parseFloat(item.ultimo_precio);

        await db.query(
          "UPDATE competencia_tracking SET ultimo_precio = $1 WHERE id = $2",
          [precio, item.id]
        );

        if (precioAnterior > 0) {
          const diferencia = precio - precioAnterior;
          const porcentaje = Math.round((diferencia / precioAnterior) * 100);
          const emoji = diferencia > 0 ? "📈 SUBIÓ" : "📉 BAJÓ";

          // --- RETORNAMOS HTML ---
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

// 2. Modificamos vigilarCompetencia para que NO se detenga si uno falla
async function vigilarCompetencia(botInstance, adminChatId) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM competencia_tracking WHERE activo = TRUE"
    );

    console.log(
      `🔍 Revisando ${rows.length} productos para ChatID: ${adminChatId}`
    );

    for (const item of rows) {
      const alerta = await escanearProducto(item);

      if (alerta && botInstance && adminChatId) {
        // --- TRY/CATCH INTERNO (AQUÍ ESTÁ LA MAGIA) ---
        try {
          await botInstance.sendMessage(adminChatId, alerta, {
            parse_mode: "HTML", // Usamos HTML que es robusto
            disable_web_page_preview: true,
          });
          console.log(`✅ Mensaje enviado para: ${item.alias}`);
        } catch (sendError) {
          // Si falla ESTE producto, lo vemos en consola pero el bucle SIGUE
          console.error(
            `❌ ERROR AL ENVIAR TELEGRAM (${item.alias}):`,
            sendError.message
          );

          // Intento de rescate: Enviar mensaje plano sin formato si falla el HTML
          try {
            await botInstance.sendMessage(
              adminChatId,
              `⚠️ Alerta (Formato fallido) - ${item.alias}: $${item.ultimo_precio}`
            );
          } catch (e) {}
        }
        // ----------------------------------------------
      }

      // Pequeña pausa para no saturar
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (e) {
    console.error("❌ Error General en Vigilancia:", e);
  }
}

module.exports = { vigilarCompetencia, escanearProducto };
