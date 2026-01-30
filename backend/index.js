// backend/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

// --- SERVICIOS Y UTILIDADES ---
const { setupAuth } = require("./google-drive");
const { inicializarTablas } = require("./services/dbInit");

const {
  sincronizarBaseDeDatos,
  sincronizarPedidos,
  sincronizarStockSemielaborados,
  sincronizarMateriasPrimas,
} = require("./services/syncService");

// IMPORTANTE: Traemos el check de mantenimiento
const {
  iniciarBotReceptor,
  getBot,
  checkAlertasMantenimiento, // <--- NUEVO IMPORT
} = require("./services/telegramBotListener");

const { vigilarCompetencia } = require("./services/competenciaService");

// --- IMPORTAR RUTAS ---
const generalRoutes = require("./routes/general");
const comprasRoutes = require("./routes/compras");
const produccionRoutes = require("./routes/produccion");
const ingenieriaRoutes = require("./routes/ingenieria");
const planificacionRoutes = require("./routes/planificacion");
const operariosRoutes = require("./routes/operarios");
const logisticaRoutes = require("./routes/logistica");
const analisisRoutes = require("./routes/analisis");
const iaRoutes = require("./routes/ia");
const mantenimientoRoutes = require("./routes/mantenimiento");
const feriadosRoutes = require("./routes/feriados");
const rrhhRoutes = require("./routes/rrhh");
const changelogRoutes = require("./routes/changelog");
const sugerenciasRoutes = require("./routes/sugerencias");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api", generalRoutes);
app.use("/api/compras", comprasRoutes);
app.use("/api/produccion", produccionRoutes);
app.use("/api/ingenieria", ingenieriaRoutes);
app.use("/api/planificacion", planificacionRoutes);
app.use("/api/operarios", operariosRoutes);
app.use("/api/logistica", logisticaRoutes);
app.use("/api/analisis", analisisRoutes);
app.use("/api/ia", iaRoutes);
app.use("/api/mantenimiento", mantenimientoRoutes);
app.use("/api/feriados", feriadosRoutes);
app.use("/api/rrhh", rrhhRoutes);
app.use("/api/changelog", changelogRoutes);
app.use("/api/sugerencias", sugerenciasRoutes);

async function iniciarServidor() {
  try {
    await setupAuth();
    await inicializarTablas();

    app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));

    console.log("⏰ Iniciando servicios...");

    sincronizarBaseDeDatos();
    sincronizarPedidos();
    // sincronizarStockSemielaborados();
    // sincronizarMateriasPrimas();
    iniciarBotReceptor();

    // INTERVALOS
    setInterval(sincronizarBaseDeDatos, 2 * 60 * 1000);
    setInterval(sincronizarPedidos, 15 * 60 * 1000);

    // Vigilancia Competencia (Cada 30 minutos)
    setInterval(
      () => {
        const bot = getBot();
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        if (bot && adminId) vigilarCompetencia(bot, adminId);
      },
      30 * 60 * 1000,
    );

    // --- NUEVO: VIGILANCIA MANTENIMIENTO ---
    // Revisar tickets viejos cada 1 hora
    setInterval(
      () => {
        console.log("🔧 Chequeando alertas mantenimiento 24h...");
        checkAlertasMantenimiento();
      },
      60 * 60 * 1000,
    );
  } catch (error) {
    console.error("❌ Error fatal:", error);
  }
}

iniciarServidor();
