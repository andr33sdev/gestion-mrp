// backend/services/competenciaService.js
const axios = require("axios");
const cheerio = require("cheerio");
const db = require("../db");

function parsearPrecio(texto) {
  if (!texto) return 0;
  // Convertimos "1.500,50" o "$ 1500" a numero limpio
  const limpio = texto
    .toString()
    .replace(/[^0-9,.]/g, "")
    .replace(",", ".");
  return parseFloat(limpio) || 0;
}

// Función para escanear un item específico
async function escanearProducto(item) {
  try {
    console.log(`🕵️ Analizando URL: ${item.url}`);

    // 1. Descargar HTML (Fingiendo ser navegador real)
    const { data } = await axios.get(item.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });

    const $ = cheerio.load(data);
    let precio = 0;

    // --- ESTRATEGIA BLINDADA PARA MERCADOLIBRE ---
    if (item.sitio === "MERCADOLIBRE") {
      // A. Intento 1: Metadatos OpenGraph (Suele ser el más fácil)
      const metaPrice = $('meta[property="product:price:amount"]').attr(
        "content"
      );
      if (metaPrice) precio = parseFloat(metaPrice);

      // B. Intento 2: Datos Estructurados JSON-LD (La forma "correcta")
      if (!precio) {
        $('script[type="application/ld+json"]').each((i, el) => {
          try {
            const json = JSON.parse($(el).html());
            // Buscamos estructura de Producto
            if (json["@type"] === "Product" && json.offers) {
              const offer = Array.isArray(json.offers)
                ? json.offers[0]
                : json.offers;
              if (offer && offer.price) {
                precio = parseFloat(offer.price);
              }
            }
          } catch (e) {
            /* Ignorar errores de parseo json */
          }
        });
      }

      // C. Intento 3: Selectores Visuales (Si todo falla)
      if (!precio) {
        const precioVisual = $(
          ".ui-pdp-price__second-line .andes-money-amount__fraction"
        )
          .first()
          .text();
        precio = parsearPrecio(precioVisual);
      }
    } else {
      // Lógica genérica para otras webs
    }

    console.log(`   > Precio detectado: $${precio}`);

    // --- GUARDADO Y ALERTA ---
    if (precio > 0) {
      // 1. Actualizar fecha de revisión siempre
      await db.query(
        "UPDATE competencia_tracking SET ultima_revision = NOW() WHERE id = $1",
        [item.id]
      );

      // 2. Si es la primera vez (estaba en 0) o cambió el precio
      if (
        item.ultimo_precio == 0 ||
        precio !== parseFloat(item.ultimo_precio)
      ) {
        const precioAnterior = parseFloat(item.ultimo_precio);
        // Guardamos el nuevo precio
        await db.query(
          "UPDATE competencia_tracking SET ultimo_precio = $1 WHERE id = $2",
          [precio, item.id]
        );

        // Si es actualización (no el primer escaneo), retornamos mensaje de alerta
        if (precioAnterior > 0) {
          const diferencia = precio - precioAnterior;
          const porcentaje = Math.round((diferencia / precioAnterior) * 100);
          const emoji = diferencia > 0 ? "📈 SUBIÓ" : "📉 BAJÓ";

          return (
            `🚨 **ALERTA COMPETENCIA**\n\n` +
            `Producto: *${item.alias}*\n` +
            `${emoji} ${porcentaje}%\n` +
            `Antes: $${precioAnterior}\n` +
            `Ahora: **$${precio}**\n` +
            `[Ver Link](${item.url})`
          );
        } else {
          // Es el primer escaneo exitoso
          return `✅ **Rastreo Iniciado**\nProducto: ${item.alias}\nPrecio Base Detectado: $${precio}`;
        }
      }
    } else {
      console.log(
        "⚠️ No se pudo leer el precio (Posible bloqueo o cambio de estructura)."
      );
    }

    return null; // Sin cambios para reportar
  } catch (error) {
    console.error(`❌ Error scraping ${item.alias}:`, error.message);
    return null;
  }
}

// Función que recorre todos (Cron Job)
async function vigilarCompetencia(botInstance, adminChatId) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM competencia_tracking WHERE activo = TRUE"
    );
    for (const item of rows) {
      const alerta = await escanearProducto(item);
      if (alerta && botInstance && adminChatId) {
        await botInstance.sendMessage(adminChatId, alerta, {
          parse_mode: "Markdown",
        });
      }
      // Pausa anti-bloqueo
      await new Promise((r) => setTimeout(r, 5000));
    }
  } catch (e) {
    console.error(e);
  }
}

module.exports = { vigilarCompetencia, escanearProducto }; // <--- Exportamos escanearProducto individualmente
