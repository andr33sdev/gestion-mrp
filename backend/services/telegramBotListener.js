// backend/services/telegramBotListener.js
const TelegramBot = require("node-telegram-bot-api");
const {
  escanearProducto,
  vigilarCompetencia,
} = require("./competenciaService");
const { agregarPedidoAlSheet } = require("../google-drive");
const db = require("../db");
const admin = require("firebase-admin"); // <--- AÑADIDO: Importamos Firebase Admin

// --- 1. CONFIGURACIÓN ---
const tokenAdmin = process.env.TELEGRAM_BOT_TOKEN;
const tokenPedidos = process.env.TELEGRAM_BOT_TOKEN_PEDIDOS;
const tokenMantenimiento = process.env.TELEGRAM_BOT_TOKEN_MANTENIMIENTO;
const tokenLogistica = process.env.TELEGRAM_BOT_TOKEN_LOGISTICA;

const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_ID;
const MANTENIMIENTO_CHAT_ID = process.env.TELEGRAM_CHAT_ID_MANTENIMIENTO;

let botAdminInstance = null;
let botPedidosInstance = null;
let botMantenimientoInstance = null;
let botLogisticaInstance = null;

const colaDePedidos = [];
let procesandoCola = false;

// --- FUNCIÓN AUXILIAR: ENVIAR PUSH NOTIFICATIONS ---
async function notificarPorPush(rol, titulo, body) {
  try {
    const { rows } = await db.query(
      "SELECT fcm_token FROM usuarios WHERE rol = $1 AND activo = true AND fcm_token IS NOT NULL",
      [rol],
    );

    if (rows.length === 0) return;

    const tokens = rows.map((r) => r.fcm_token);

    const message = {
      notification: { title: titulo, body: body },
      tokens: tokens,
      android: { priority: "high" },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(
      `🔔 Push intentó enviarse a ${tokens.length} dispositivo(s) del rol ${rol}. Éxitos: ${response.successCount}`,
    );

    // --- NUEVO: DETECTOR DE ERRORES DE FIREBASE ---
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(
            `❌ Firebase rechazó el token [${idx}]. Motivo:`,
            resp.error.message,
          );
        }
      });
    }
  } catch (error) {
    console.error("❌ Error grave ejecutando Push Notification:", error);
  }
}

// --- HELPER FECHA ---
function getPeriodo(fechaStr) {
  if (!fechaStr) return "";
  const partes = fechaStr.split("/");
  if (partes.length < 3) return "";
  const mes = partes[1];
  const anio = partes[2];
  return `2/${mes}/${anio}`;
}

// --- PARSER PEDIDOS ---
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

// --- PROCESADOR COLA ---
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

// ========================================================
//  INICIALIZADOR PRINCIPAL
// ========================================================
function iniciarBotReceptor() {
  if (tokenAdmin && !botAdminInstance) {
    botAdminInstance = new TelegramBot(tokenAdmin, { polling: true });
    configurarBotAdmin(botAdminInstance);
  }
  if (tokenPedidos && !botPedidosInstance) {
    botPedidosInstance = new TelegramBot(tokenPedidos, { polling: true });
    configurarBotPedidos(botPedidosInstance);
  }
  if (tokenMantenimiento && !botMantenimientoInstance) {
    botMantenimientoInstance = new TelegramBot(tokenMantenimiento, {
      polling: true,
    });
    console.log("🔧 Bot Mantenimiento Activo");
    botMantenimientoInstance.onText(/\/id/, (msg) => {
      botMantenimientoInstance.sendMessage(
        msg.chat.id,
        `Chat ID: ${msg.chat.id}`,
      );
    });
  }
  if (tokenLogistica && !botLogisticaInstance) {
    botLogisticaInstance = new TelegramBot(tokenLogistica, { polling: true });
    configurarBotLogistica(botLogisticaInstance);
    console.log("🚚 Bot Logística Activo (Modo Difusión)");
  }
}

// ========================================================
//  LOGICA BOT PEDIDOS
// ========================================================
function configurarBotPedidos(bot) {
  bot.on("message", async (msg) => {
    const texto = msg.text || "";
    const chatId = msg.chat.id;

    const datosPedido = parsearMensajePedido(texto);
    if (datosPedido) {
      colaDePedidos.push({ datos: datosPedido, chatId });
      procesarSiguientePedido(bot);
      return;
    }

    if (/\d+/.test(texto)) {
      const numeros = texto.match(/\d+/g);
      if (!numeros) return;
      const ordenCompra = numeros.reduce((a, b) =>
        a.length > b.length ? a : b,
      );
      const filtroCliente = texto
        .replace(/\d+/g, "")
        .replace(/[^a-zA-Z\s]/g, "")
        .trim()
        .toLowerCase();

      if (ordenCompra.length < 2) return;

      try {
        bot.sendChatAction(chatId, "typing");
        const res = await db.query(
          `SELECT * FROM pedidos_clientes WHERE oc_cliente = $1 ORDER BY id DESC`,
          [ordenCompra],
        );
        let encontrados = res.rows;

        if (encontrados.length === 0) {
          bot.sendMessage(
            chatId,
            `❌ No encontré la orden <b>${ordenCompra}</b>.`,
            { parse_mode: "HTML" },
          );
          return;
        }

        if (filtroCliente.length > 2) {
          encontrados = encontrados.filter((p) =>
            (p.cliente || "").toLowerCase().includes(filtroCliente),
          );
          if (encontrados.length === 0) {
            bot.sendMessage(
              chatId,
              `⚠️ Encontré la orden ${ordenCompra} pero no coincide con "${filtroCliente}".`,
              { parse_mode: "HTML" },
            );
            return;
          }
        }

        const cabecera = encontrados[0];
        let respuesta = `📋 <b>ESTADO DE ORDEN #${ordenCompra}</b>\n🏢 <b>Cliente:</b> ${cabecera.cliente}\n\n`;

        encontrados.forEach((p) => {
          let estado = p.estado || "PENDIENTE";
          let icono = "🕒";
          if (estado.includes("PRODUCCION")) icono = "🏭";
          if (estado.includes("STOCK") || estado.includes("TERMINADO"))
            icono = "✅";
          if (estado.includes("DESPACHADO") || estado.includes("ENVIADO"))
            icono = "🚚";

          respuesta += `${icono} <b>${p.modelo}</b> (x${p.cantidad})\n Status: <i>${estado}</i>\n ────────────────\n`;
        });

        bot.sendMessage(chatId, respuesta, { parse_mode: "HTML" });
      } catch (error) {
        console.error("Error DB:", error);
        bot.sendMessage(chatId, "⚠️ Error sistema.");
      }
      return;
    }

    if (["hola", "buenas"].some((w) => texto.toLowerCase().includes(w))) {
      bot.sendMessage(
        chatId,
        "👋 Envíame tu <b>Número de Orden (OC)</b> para ver el estado.",
        { parse_mode: "HTML" },
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

    if (texto === "/id") {
      bot.sendMessage(chatId, `🆔 El ID de este chat es: ${chatId}`);
      console.log("ID DETECTADO:", chatId);
    }
    if (texto === "/start") bot.sendMessage(chatId, "👷 Bot Conoflex Activo");

    if (texto === "/revisar") {
      bot.sendMessage(
        chatId,
        "🕵️ Iniciando revisión completa de competencia...",
      );
      try {
        await vigilarCompetencia(bot, chatId);
        bot.sendMessage(chatId, "✅ Revisión finalizada.");
      } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "❌ Error al ejecutar la revisión.");
      }
    }

    if (texto.startsWith("/espiar ")) {
      const partes = texto.split(" ");
      const url = partes[1];
      const alias = partes.slice(2).join(" ");

      if (!url || !alias)
        return bot.sendMessage(
          chatId,
          "⚠️ <b>Formato:</b> /espiar [URL] [Nombre]",
          { parse_mode: "HTML" },
        );

      bot.sendMessage(chatId, `🕵️ <b>Procesando:</b> ${alias}...`, {
        parse_mode: "HTML",
      });

      try {
        let sitio = "GENERICO";
        if (url.includes("mercadolibre")) sitio = "MERCADOLIBRE";
        const insertQuery = `INSERT INTO competencia_tracking (url, alias, sitio, activo, ultimo_precio, ultima_revision) VALUES ($1, $2, $3, TRUE, 0, NOW()) RETURNING *`;
        const res = await db.query(insertQuery, [url, alias, sitio]);
        const nuevoItem = res.rows[0];
        const reporte = await escanearProducto(nuevoItem);

        if (reporte)
          bot.sendMessage(chatId, reporte, { parse_mode: "Markdown" });
        else
          bot.sendMessage(
            chatId,
            `✅ <b>Guardado.</b> Se monitoreará cada hora.`,
            { parse_mode: "HTML" },
          );
      } catch (error) {
        console.error("Error comando espiar:", error);
        bot.sendMessage(chatId, "❌ Error al guardar.");
      }
    }
  });
}

// ========================================================
//  NUEVO: LÓGICA BOT LOGÍSTICA (SUSCRIPCIONES)
// ========================================================
function configurarBotLogistica(bot) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || "SinNombre";
    const username = msg.from.username || "SinUser";
    try {
      await db.query(
        `INSERT INTO telegram_suscriptores (chat_id, first_name, username) VALUES ($1, $2, $3) ON CONFLICT (chat_id) DO NOTHING`,
        [chatId, firstName, username],
      );
      bot.sendMessage(
        chatId,
        `¡Hola ${firstName}! 👋\nYa estás suscrito a las alertas de Logística.`,
      );
    } catch (err) {
      console.error("Error guardando suscriptor Logística:", err);
    }
  });

  bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      await db.query("DELETE FROM telegram_suscriptores WHERE chat_id = $1", [
        chatId,
      ]);
      bot.sendMessage(chatId, "🔕 Te has dado de baja.");
    } catch (err) {
      console.error(err);
    }
  });

  bot.on("polling_error", (error) => {
    if (error.code !== "EFATAL") console.warn(`[BOT LOGISTICA] ${error.code}`);
  });
}

async function enviarNotificacionLogistica(tipo, data) {
  if (!botLogisticaInstance) return;
  const hora = new Date().toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
  let mensaje = "";

  switch (tipo) {
    case "NUEVA_SOLICITUD":
      mensaje = `📦 <b>NUEVA SOLICITUD (#${data.id})</b>\n👤 <b>Pide:</b> ${data.solicitante}\n🛠 <b>Producto:</b> ${data.producto}\n🔢 <b>Cantidad:</b> ${data.cantidad}\n🚨 <b>Prioridad:</b> ${data.prioridad}\n⏰ <i>${hora} hs</i>`;
      break;
    case "CAMBIO_ESTADO":
      const iconos = {
        APROBADO: "✅",
        RECHAZADO: "⛔",
        PREPARADO: "📦",
        FINALIZADO: "🚀",
        ELIMINADO: "🗑",
      };
      const icono = iconos[data.estado] || "🔄";
      mensaje = `${icono} <b>ESTADO ACTUALIZADO (#${data.id})</b>\n👤 <b>Responsable:</b> ${data.usuario}\n🛠 <b>Producto:</b> ${data.producto}\n📊 <b>Nuevo Estado:</b> ${data.estado}\n⏰ <i>${hora} hs</i>`;
      break;
    case "NUEVO_COMENTARIO":
      mensaje = `💬 <b>NUEVO COMENTARIO (#${data.id})</b>\n👤 <b>${data.usuario} dice:</b>\n"<i>${data.mensaje}</i>"\n\n🛠 <b>En:</b> ${data.producto}\n⏰ <i>${hora} hs</i>`;
      break;
    default:
      return;
  }

  try {
    const res = await db.query("SELECT chat_id FROM telegram_suscriptores");
    const envios = res.rows.map((sub) =>
      botLogisticaInstance
        .sendMessage(sub.chat_id, mensaje, { parse_mode: "HTML" })
        .catch((err) => {
          if (err.response && err.response.statusCode === 403)
            db.query("DELETE FROM telegram_suscriptores WHERE chat_id = $1", [
              sub.chat_id,
            ]);
        }),
    );
    await Promise.all(envios);
  } catch (error) {
    console.error("❌ Error difusión Logística:", error.message);
  }
}

// ========================================================
//  FUNCIONES MANTENIMIENTO (CON PUSH NOTIFICATIONS)
// ========================================================
async function notificarNuevoTicketMantenimiento(ticket) {
  // 1. Notificación a Telegram (APAGADO TEMPORALMENTE)
  /*
  if (botMantenimientoInstance && MANTENIMIENTO_CHAT_ID) {
    const prioridadIcon = ticket.prioridad === "ALTA" ? "🔴" : ticket.prioridad === "MEDIA" ? "🟡" : "🔵";
    const msg = `🔧 <b>NUEVO REPORTE DE FALLA</b>\n\n🏭 <b>Máquina:</b> ${ticket.maquina}\n${prioridadIcon} <b>Prioridad:</b> ${ticket.prioridad}\n📝 <b>Problema:</b> ${ticket.titulo}\n👤 <b>Reportó:</b> ${ticket.creado_por || "Anónimo"}\n📅 <i>${new Date().toLocaleString("es-AR")}</i>`;
    try { await botMantenimientoInstance.sendMessage(MANTENIMIENTO_CHAT_ID, msg, { parse_mode: "HTML" }); } 
    catch (e) { console.error("Error Telegram Mant:", e.message); }
  }
  */

  // 2. Notificación Push a la App (Jefe de Producción o Mantenimiento)
  const pushTitle = `Falla en ${ticket.maquina} 🔧`;
  const pushBody = `Reportado por ${ticket.creado_por || "Anónimo"}: ${ticket.titulo}`;

  // Enviamos al Jefe de Producción y al Encargado de Mantenimiento
  await notificarPorPush("JEFE PRODUCCIÓN", pushTitle, pushBody);
  await notificarPorPush("ENC. MANTENIMIENTO", pushTitle, pushBody);
}

async function checkAlertasMantenimiento() {
  try {
    const query = `
        SELECT * FROM tickets_mantenimiento 
        WHERE estado != 'SOLUCIONADO'
          AND fecha_creacion < NOW() - INTERVAL '24 hours' 
          AND (alerta_24h_enviada = FALSE OR alerta_24h_enviada IS NULL)
    `;
    const { rows } = await db.query(query);

    for (const t of rows) {
      // 1. Notificación Telegram (APAGADO TEMPORALMENTE)
      /*
      if (botMantenimientoInstance && MANTENIMIENTO_CHAT_ID) {
        const msg = `🚨 <b>ALERTA: TICKET +24H</b> 🚨\n\nEl reporte #${t.id} sigue sin solución.\n🏭 <b>Máquina:</b> ${t.maquina}\n📝 <b>Título:</b> ${t.titulo}\n\n<i>Por favor, actualizar estado o resolver.</i>`;
        await botMantenimientoInstance.sendMessage(MANTENIMIENTO_CHAT_ID, msg, { parse_mode: "HTML" });
      }
      */

      // 2. Notificación Push a la App
      const pushTitle = `🚨 Ticket +24hs: ${t.maquina}`;
      const pushBody = `El reporte #${t.id} sigue sin solución. Por favor revisar.`;
      await notificarPorPush("JEFE PRODUCCIÓN", pushTitle, pushBody);
      await notificarPorPush("ENC. MANTENIMIENTO", pushTitle, pushBody);

      // Actualizar estado en DB
      await db.query(
        "UPDATE tickets_mantenimiento SET alerta_24h_enviada = TRUE WHERE id = $1",
        [t.id],
      );
    }
  } catch (e) {
    console.error("Error checkAlertasMantenimiento:", e.message);
  }
}

// ========================================================
//  ALERTAS GENERALES
// ========================================================
async function enviarAlertaStock(itemsCriticos) {
  if (!botAdminInstance || !ADMIN_CHAT_ID) return;
  try {
    await botAdminInstance.sendMessage(
      ADMIN_CHAT_ID,
      `⚠️ Alerta Stock: ${itemsCriticos.length} items bajos.`,
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
      `🏭 Alerta MRP para ${plan}.`,
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
  notificarNuevoTicketMantenimiento,
  checkAlertasMantenimiento,
  enviarNotificacionLogistica,
};
