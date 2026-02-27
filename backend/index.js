// backend/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

// --- 1. IMPORTAMOS HTTP Y SOCKET.IO (NUEVO) ---
const http = require("http");
const { Server } = require("socket.io");

// --- SERVICIOS Y UTILIDADES ---
const { setupAuth } = require("./google-drive");
const { inicializarTablas } = require("./services/dbInit");

const {
  sincronizarBaseDeDatos,
  sincronizarPedidos,
  sincronizarStockSemielaborados,
  sincronizarMateriasPrimas,
} = require("./services/syncService");

const {
  iniciarBotReceptor,
  getBot,
  checkAlertasMantenimiento,
} = require("./services/telegramBotListener");

const { vigilarCompetencia } = require("./services/competenciaService");
const { protect } = require("./middleware/auth"); // <-- ACÁ ESTÁ EL PATOVICA

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
const depositoRoutes = require("./routes/deposito");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ==========================================
// 2. CREACIÓN DEL SERVIDOR Y RADAR (NUEVO)
// ==========================================
// Envolvemos Express en un servidor HTTP nativo
const server = http.createServer(app);

// Inicializamos Socket.io permitiendo conexiones cruzadas (CORS)
const io = new Server(server, {
  cors: {
    origin: "*", // Permite que tu frontend se conecte sin bloqueos
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Escuchamos la actividad en tiempo real del GPS
io.on("connection", (socket) => {
  console.log("🟢 Dispositivo conectado al radar satelital:", socket.id);

  // Cuando un celular transmite su ubicación
  socket.on("enviarUbicacion", (data) => {
    // Reenviamos esa data a TODOS los demás (los que miran el mapa)
    socket.broadcast.emit("recibirUbicacion", {
      idSocket: socket.id,
      ...data,
    });
  });

  // Cuando el celular pierde conexión o cierra la app
  socket.on("disconnect", () => {
    console.log("🔴 Dispositivo desconectado del radar:", socket.id);
    io.emit("repartidorDesconectado", socket.id);
  });
});

// ==========================================
// 1. RUTA PÚBLICA (SIN CANDADO)
// ==========================================
// A esta ruta puede entrar cualquiera para registrarse o iniciar sesión
app.use("/api/auth", authRoutes);

// ==========================================
// 2. RUTAS PRIVADAS (CON "protect")
// ==========================================
// Si alguien intenta entrar acá sin la llave (Token JWT), rebota automáticamente
app.use("/api", protect, generalRoutes);
app.use("/api/compras", protect, comprasRoutes);
app.use("/api/produccion", protect, produccionRoutes);
app.use("/api/ingenieria", protect, ingenieriaRoutes);
app.use("/api/planificacion", protect, planificacionRoutes);
app.use("/api/operarios", protect, operariosRoutes);
app.use("/api/logistica", protect, logisticaRoutes);
app.use("/api/analisis", protect, analisisRoutes);
app.use("/api/ia", protect, iaRoutes);
app.use("/api/mantenimiento", protect, mantenimientoRoutes);
app.use("/api/feriados", protect, feriadosRoutes);
app.use("/api/rrhh", protect, rrhhRoutes);
app.use("/api/changelog", protect, changelogRoutes);
app.use("/api/sugerencias", protect, sugerenciasRoutes);
app.use("/api/deposito", protect, depositoRoutes);

async function iniciarServidor() {
  try {
    await setupAuth();
    await inicializarTablas();

    // --- 3. CAMBIO CLAVE: Usamos server.listen en lugar de app.listen ---
    server.listen(PORT, () =>
      console.log(`🚀 Servidor y Radar corriendo en puerto ${PORT}`),
    );

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

    // --- VIGILANCIA MANTENIMIENTO ---
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
