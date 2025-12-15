const express = require("express");
const router = express.Router();
const db = require("../db");
const { leerArchivoHorno } = require("../google-drive");
const { sincronizarBaseDeDatos } = require("../services/syncService");
// IMPORTANTE: Importamos el middleware de protección
const { protect } = require("../middleware/auth");

// 1. ENDPOINT DE LOGIN (Validación de credenciales)
// Al usar 'protect', si la clave está mal, este endpoint devolverá error y el Login no dejará pasar.
router.get("/", protect, (req, res) => {
    res.json({
        status: "OK",
        role: req.userRole,
        msg: `Bienvenido, acceso ${req.userRole}`
    });
});

// 2. Rutas públicas o semi-públicas
router.get("/registros", async (req, res) => {
    try {
        const { rows } = await db.query("SELECT id, accion, tipo, productos_json, CAST(fecha::TEXT || ' ' || hora::TEXT AS TIMESTAMP) AT TIME ZONE 'America/Argentina/Buenos_Aires' AS timestamp FROM registros ORDER BY timestamp DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Rutas protegidas (Si quieres que el análisis sea solo para usuarios logueados)
// Nota: Si el Dashboard es público, 'registros' no debería llevar 'protect'.
router.get("/pedidos-analisis", async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM pedidos_clientes ORDER BY fecha DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/leer-archivo", async (req, res) => {
    try {
        const txt = await leerArchivoHorno();
        res.type("text/plain").send(txt);
    } catch (e) {
        res.status(500).send("Error Drive");
    }
});

router.post("/sincronizar", async (req, res) => {
    const r = await sincronizarBaseDeDatos();
    res.status(r.success ? 200 : 500).json(r);
});

module.exports = router;