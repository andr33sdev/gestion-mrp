// backend/services/telegramBotListener.js
const TelegramBot = require("node-telegram-bot-api");
const { escanearProducto } = require("./competenciaService");
const { agregarPedidoAlSheet } = require("../google-drive");
const db = require("../db");

// --- 1. CONFIGURACIÓN ---
const tokenAdmin = process.env.TELEGRAM_BOT_TOKEN;
const tokenPedidos = process.env.TELEGRAM_BOT_TOKEN_PEDIDOS;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_ID;

let botAdminInstance = null;
let botPedidosInstance = null;

const colaDePedidos = [];
let procesandoCola = false;

// --- HELPER FECHA ---
function getPeriodo(fechaStr) {
  if (!fechaStr) return "";
  const partes = fechaStr.split("/");
  if (partes.length < 3) return "";
  const mes = partes[1];
  const anio = partes[2];
  return `2/${mes}/${anio}`;
}

// --- PARSER ---
function parsearMensajePedido(text) {
  try {
    if (
      !text.includes("OP:") ||
      (!text.includes("ARTICULO:") && !text.includes("ARTÍCULO:"))
    ) {
      return null;
    }
    const lineas = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);
    const datos = {
      fecha: "",
      periodo: "",
      op_interna: "",
      oc_cliente: "-",
      cliente: "",
      modelo: "",
      detalles: "",
      cantidad: 0,
    };

    const esML = text.includes("MARKETPLACE") || text.includes("MSHOPS");
    if (esML) datos.detalles = "MercadoLibre";

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      if (linea.includes("OP:")) {
        const matchFecha = linea.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (matchFecha) {
          datos.fecha = matchFecha[0];
          datos.periodo = getPeriodo(datos.fecha);
        }
        const matchOP = linea.match(/\d{4}-(\d+)/);
        if (matchOP && matchOP[1])
          datos.op_interna = parseInt(matchOP[1], 10).toString();
      }
      if (linea.startsWith("OCOMPRA:")) {
        const ocRaw = linea.replace("OCOMPRA:", "").trim();
        if (ocRaw) datos.oc_cliente = ocRaw;
      }
      if (linea.startsWith("ARTICULO:") || linea.startsWith("ARTÍCULO:"))
        datos.modelo = linea.replace(/ART[IÍ]CULO:/, "").trim();
      if (linea.startsWith("CANTIDAD:"))
        datos.cantidad = linea.replace("CANTIDAD:", "").trim();
      if (linea.startsWith("CLIENTE:")) {
        let clienteSucio = linea.replace("CLIENTE:", "").trim();
        datos.cliente = clienteSucio.replace(/^[A-Z0-9]+\s+/, "");
      }
    }
    if (!datos.op_interna || !datos.modelo) return null;
    return datos;
  } catch (e) {
    console.error("Error parser:", e);
    return null;
  }
}

// --- PROCESADOR COLA (CON SYNC FORZADO) ---
async function procesarSiguientePedido(bot) {
  if (procesandoCola || colaDePedidos.length === 0) return;
  procesandoCola = true;
  const { datos, chatId } = colaDePedidos[0];

  try {
    console.log(`⏳ Procesando OP ${datos.op_interna}...`);
    bot.sendChatAction(chatId, "typing");
    await agregarPedidoAlSheet(datos);

    const respuesta = `✅ <b>Guardado</b>\n🆔 OP: ${datos.op_interna}\n📎 OC Cliente: ${datos.oc_cliente}\n📦 ${datos.modelo} (x${datos.cantidad})\n👤 ${datos.cliente}`;
    bot.sendMessage(chatId, respuesta, { parse_mode: "HTML" });

    console.log("↻ Forzando sincronización DB para que aparezca inmediato...");
    // IMPORTACIÓN DINÁMICA PARA EVITAR CICLO
    const { sincronizarPedidos } = require("./syncService");
    await sincronizarPedidos();

    colaDePedidos.shift();
  } catch (error) {
    console.error("❌ Error procesando cola:", error.message);
    bot.sendMessage(chatId, `❌ Error guardando OP ${datos.op_interna}.`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } finally {
    procesandoCola = false;
    procesarSiguientePedido(bot);
  }
}

function iniciarBotReceptor() {
  if (tokenAdmin && !botAdminInstance) {
    botAdminInstance = new TelegramBot(tokenAdmin, { polling: true });
    configurarBotAdmin(botAdminInstance);
  }
  if (tokenPedidos && !botPedidosInstance) {
    botPedidosInstance = new TelegramBot(tokenPedidos, { polling: true });
    configurarBotPedidos(botPedidosInstance);
  }
}

// ========================================================
//  LÓGICA BOT PEDIDOS
// ========================================================
function configurarBotPedidos(bot) {
  bot.on("message", async (msg) => {
    const texto = msg.text || "";
    const chatId = msg.chat.id;

    // A. PEDIDO EQUAL
    const datosPedido = parsearMensajePedido(texto);
    if (datosPedido) {
      colaDePedidos.push({ datos: datosPedido, chatId });
      procesarSiguientePedido(bot);
      return;
    }

    // B. CONSULTA CLIENTE
    if (/\d+/.test(texto)) {
      const numeros = texto.match(/\d+/g);
      if (!numeros) return;
      const ordenCompra = numeros.reduce((a, b) =>
        a.length > b.length ? a : b
      );
      const filtroCliente = texto
        .replace(/\d+/g, "")
        .replace(/[^a-zA-Z\s]/g, "")
        .trim()
        .toLowerCase();

      if (ordenCompra.length < 2) return;

      try {
        bot.sendChatAction(chatId, "typing");

        // --- CONSULTA CORREGIDA ---
        // 1. Quitamos 'OR op LIKE...' para que NO busque en número de OP interna
        // 2. Usamos '=' en vez de 'LIKE' para que sea exacto (412 no trae 10412)
        // 3. Quitamos los '%' del parámetro
        const res = await db.query(
          `SELECT * FROM pedidos_clientes 
           WHERE oc_cliente = $1 
           ORDER BY id DESC`,
          [ordenCompra] // Sin los signos %
        );

        let encontrados = res.rows;

        if (encontrados.length === 0) {
          bot.sendMessage(
            chatId,
            `❌ No encontré la orden <b>${ordenCompra}</b>.`,
            { parse_mode: "HTML" }
          );
          return;
        }

        // Filtro Nombre
        if (filtroCliente.length > 2) {
          encontrados = encontrados.filter((p) =>
            (p.cliente || "").toLowerCase().includes(filtroCliente)
          );
          if (encontrados.length === 0) {
            bot.sendMessage(
              chatId,
              `⚠️ Encontré la orden ${ordenCompra} pero no coincide con "${filtroCliente}".`,
              { parse_mode: "HTML" }
            );
            return;
          }
        }

        // Respuesta
        const cabecera = encontrados[0];
        let respuesta = `📋 <b>ESTADO DE ORDEN #${ordenCompra}</b>\n`;
        respuesta += `🏢 <b>Cliente:</b> ${cabecera.cliente}\n\n`;

        encontrados.forEach((p) => {
          let estado = p.estado || "PENDIENTE";
          let icono = "🕒";
          if (estado.includes("PRODUCCION")) icono = "🏭";
          if (estado.includes("STOCK") || estado.includes("TERMINADO"))
            icono = "✅";
          if (estado.includes("DESPACHADO") || estado.includes("ENVIADO"))
            icono = "🚚";

          respuesta += `${icono} <b>${p.modelo}</b> (x${p.cantidad})\n`;
          respuesta += `   Status: <i>${estado}</i>\n`;
          respuesta += `   ────────────────\n`;
        });

        bot.sendMessage(chatId, respuesta, { parse_mode: "HTML" });
      } catch (error) {
        console.error("Error DB:", error);
        bot.sendMessage(chatId, "⚠️ Error sistema.");
      }
      return;
    }

    // C. SALUDO
    if (["hola", "buenas"].some((w) => texto.toLowerCase().includes(w))) {
      bot.sendMessage(
        chatId,
        "👋 Envíame tu <b>Número de Orden (OC)</b> para ver el estado.",
        { parse_mode: "HTML" }
      );
    }
  });

  bot.on("polling_error", (error) => {
    if (error.code !== "EFATAL") console.warn(`[BOT PEDIDOS] ${error.code}`);
  });
}

function configurarBotAdmin(bot) {
  bot.on("message", async (msg) => {
    const texto = msg.text || "";
    const chatId = msg.chat.id;
    if (texto === "/start") bot.sendMessage(chatId, "🤖 Bot Admin Activo.");
  });
}

// ALERTAS
async function enviarAlertaStock(itemsCriticos) {
  if (!botAdminInstance || !ADMIN_CHAT_ID) return;
  try {
    await botAdminInstance.sendMessage(
      ADMIN_CHAT_ID,
      `⚠️ Alerta Stock: ${itemsCriticos.length} items bajos.`
    );
  } catch (e) {
    console.error(e);
  }
}
async function enviarAlertaMRP(plan, items) {
  if (!botAdminInstance || !ADMIN_CHAT_ID) return;
  try {
    await botAdminInstance.sendMessage(
      ADMIN_CHAT_ID,
      `🏭 Alerta MRP para ${plan}.`
    );
  } catch (e) {
    console.error(e);
  }
}

function getBot() {
  return botAdminInstance;
}

module.exports = {
  iniciarBotReceptor,
  enviarAlertaStock,
  enviarAlertaMRP,
  getBot,
};
