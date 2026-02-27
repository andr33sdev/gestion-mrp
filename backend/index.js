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
// 2. CREACIÓN DEL SERVIDOR Y RADAR (MODIFICADO)
// ==========================================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// MEMORIA PERSISTENTE PARA EVITAR "VEHÍCULOS 0"
const flotaActiva = {};
const timersDesconexion = {};

io.on("connection", (socket) => {
  console.log("🟢 Dispositivo conectado al radar satelital:", socket.id);

  // Enviamos los vehículos que ya están en memoria apenas alguien abre el mapa
  socket.emit("estadoInicialFlota", flotaActiva);

  socket.on("enviarUbicacion", (data) => {
    // Usamos el nombre como ID único para que no dependa del ID de socket
    const idUnico = data.nombre || socket.id;

    // Si el usuario volvió, cancelamos su borrado programado
    if (timersDesconexion[idUnico]) {
      clearTimeout(timersDesconexion[idUnico]);
      delete timersDesconexion[idUnico];
    }

    // Guardamos/Actualizamos en la memoria del servidor
    flotaActiva[idUnico] = {
      ...data,
      idSocket: socket.id,
      ultimaConexion: new Date(),
    };

    // Reenviamos a los mapas
    socket.broadcast.emit("recibirUbicacion", flotaActiva[idUnico]);
  });

  socket.on("disconnect", () => {
    // Buscamos a quién le pertenecía este socket
    const idUnico = Object.keys(flotaActiva).find(
      (key) => flotaActiva[key].idSocket === socket.id,
    );

    if (idUnico) {
      console.log(`🟡 Corte de señal para ${idUnico}. Esperando 60s...`);

      // No lo borramos del mapa inmediatamente, le damos 1 minuto de gracia
      timersDesconexion[idUnico] = setTimeout(() => {
        console.log(`🔴 Desconexión definitiva: ${idUnico}`);
        delete flotaActiva[idUnico];
        io.emit("repartidorDesconectado", idUnico);
        delete timersDesconexion[idUnico];
      }, 60000);
    }
  });
});

// ==========================================
// 1. RUTA PÚBLICA (SIN CANDADO)
// ==========================================
app.use("/api/auth", authRoutes);

// ==========================================
// 2. RUTAS PRIVADAS (CON "protect")
// ==========================================
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
