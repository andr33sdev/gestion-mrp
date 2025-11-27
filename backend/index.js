require("dotenv").config();
const express = require("express");
const cors = require("cors");

// --- SERVICIOS Y UTILIDADES ---
const { setupAuth } = require("./google-drive");
const { inicializarTablas } = require("./services/dbInit");

// IMPORTANTE: Aquí importamos las 3 funciones de sincronización
const {
  sincronizarBaseDeDatos,
  sincronizarPedidos,
  sincronizarStockSemielaborados,
  sincronizarMateriasPrimas,
} = require("./services/syncService");

const { iniciarBotReceptor } = require("./services/telegramBotListener");

// --- IMPORTAR RUTAS ---
const generalRoutes = require("./routes/general");
const comprasRoutes = require("./routes/compras");
const produccionRoutes = require("./routes/produccion");
const ingenieriaRoutes = require("./routes/ingenieria");
const planificacionRoutes = require("./routes/planificacion");
const operariosRoutes = require("./routes/operarios");
const logisticaRoutes = require("./routes/logistica");

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

// --- INICIO DEL SERVIDOR ---
async function iniciarServidor() {
  try {
    // 1. Autenticación Google Drive
    await setupAuth();

    // 2. Inicializar Base de Datos
    await inicializarTablas();

    // 3. Levantar Servidor
    app.listen(PORT, () =>
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
    );

    // 4. Tareas en Segundo Plano
    console.log("⏰ Servicios background iniciados...");

    // Ejecución inmediata al arrancar
    sincronizarBaseDeDatos();
    sincronizarPedidos();
    sincronizarStockSemielaborados(); // <--- Ahora sí funcionará porque está importada
    sincronizarMateriasPrimas();
    iniciarBotReceptor();

    // Cron Jobs (Intervalos)
    setInterval(sincronizarBaseDeDatos, 2 * 60 * 1000); // Logs cada 2 min
    setInterval(sincronizarPedidos, 15 * 60 * 1000); // Pedidos cada 15 min
    //setInterval(sincronizarStockSemielaborados, 15 * 60 * 1000); // Stock cada 15 min
    //setInterval(sincronizarMateriasPrimas, 15 * 60 * 1000); // Cada 15 min
  } catch (error) {
    console.error("❌ Error fatal al iniciar servidor:", error);
  }
}

iniciarServidor();
