// backend/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

// --- SERVICIOS Y UTILIDADES ---
const { setupAuth } = require("./google-drive");
const { inicializarTablas } = require("./services/dbInit");

// IMPORTANTE: Importamos TODAS las funciones de sincronización (incluida Materias Primas)
const {
  sincronizarBaseDeDatos,
  sincronizarPedidos,
  sincronizarStockSemielaborados,
  sincronizarMateriasPrimas,
} = require("./services/syncService");

// Importamos el bot y el getter de la instancia
const {
  iniciarBotReceptor,
  getBot,
} = require("./services/telegramBotListener");

// Importamos el servicio de vigilancia de competencia
const { vigilarCompetencia } = require("./services/competenciaService");

// --- IMPORTAR RUTAS ---
const generalRoutes = require("./routes/general");
const comprasRoutes = require("./routes/compras");
const produccionRoutes = require("./routes/produccion");
const ingenieriaRoutes = require("./routes/ingenieria");
const planificacionRoutes = require("./routes/planificacion");
const operariosRoutes = require("./routes/operarios");
const logisticaRoutes = require("./routes/logistica");
// const iaRoutes = require("./routes/ia"); // (Descomentar si vuelves a usar la IA)

const app = express();
const PORT = process.env.PORT || 4000;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- ASIGNACIÓN DE RUTAS ---
app.use("/api", generalRoutes);
app.use("/api/compras", comprasRoutes);
app.use("/api/produccion", produccionRoutes);
app.use("/api/ingenieria", ingenieriaRoutes);
app.use("/api/planificacion", planificacionRoutes);
app.use("/api/operarios", operariosRoutes);
app.use("/api/logistica", logisticaRoutes);
// app.use("/api/ia", iaRoutes); // (Descomentar si vuelves a usar la IA)

// --- INICIO DEL SERVIDOR ---
async function iniciarServidor() {
  try {
    await setupAuth();
    await inicializarTablas();

    app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));

    // Servicios Background
    console.log("⏰ Iniciando servicios...");

    // 1. Ejecución inicial
    sincronizarBaseDeDatos();
    sincronizarPedidos();
    sincronizarStockSemielaborados();
    sincronizarMateriasPrimas();
    iniciarBotReceptor();

    // 2. Cron Jobs (Intervalos)
    setInterval(sincronizarBaseDeDatos, 2 * 60 * 1000);
    setInterval(sincronizarPedidos, 15 * 60 * 1000);
    setInterval(sincronizarStockSemielaborados, 15 * 60 * 1000);
    setInterval(sincronizarMateriasPrimas, 15 * 60 * 1000);

    // 3. Vigilancia Competencia (Cada 1 hora)
    setInterval(() => {
      const bot = getBot();
      const adminId = process.env.TELEGRAM_ADMIN_ID;
      if (bot && adminId) vigilarCompetencia(bot, adminId);
    }, 60 * 60 * 1000);
  } catch (error) {
    console.error("❌ Error fatal:", error);
  }
}

iniciarServidor();
