const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect, restrictTo } = require("../middleware/auth");

router.use(protect);

// LECTURA PÚBLICA (Necesaria para el selector de operario)
router.get("/", async (req, res) => {
    const { rows } = await db.query("SELECT * FROM operarios WHERE activo = true ORDER BY nombre ASC");
    res.json(rows);
});

router.get("/:id/stats", async (req, res) => {
    const { id } = req.params;
    const [op, total, top, rec] = await Promise.all([
        db.query("SELECT nombre FROM operarios WHERE id=$1", [id]),
        db.query("SELECT SUM(cantidad_ok) as total_unidades FROM registros_produccion WHERE operario_id=$1", [id]),
        db.query("SELECT s.nombre, SUM(r.cantidad_ok) as total FROM registros_produccion r JOIN semielaborados s ON r.semielaborado_id=s.id WHERE r.operario_id=$1 GROUP BY s.nombre ORDER BY total DESC LIMIT 1", [id]),
        db.query(`SELECT r.id, s.nombre, r.cantidad_ok as cantidad, r.cantidad_scrap, r.motivo_scrap, r.fecha_produccion, r.turno FROM registros_produccion r JOIN semielaborados s ON r.semielaborado_id=s.id WHERE r.operario_id=$1 ORDER BY r.fecha_produccion DESC LIMIT 10`, [id])
    ]);
    if (op.rowCount === 0) return res.status(404).json({ msg: "No existe" });
    res.json({
        nombre: op.rows[0].nombre,
        totalUnidades: total.rows[0].total_unidades || 0,
        topProducto: top.rows[0] || null,
        actividadReciente: rec.rows
    });
});

// ESCRITURA RESTRINGIDA (Solo Gerencia crea/borra operarios)
router.use(restrictTo('GERENCIA'));

router.post("/", async (req, res) => {
    try {
        const { rows } = await db.query("INSERT INTO operarios (nombre) VALUES ($1) RETURNING *", [req.body.nombre]);
        res.status(201).json(rows[0]);
    } catch (e) { res.status(500).send(e.message); }
});

router.delete("/:id", async (req, res) => {
    await db.query("UPDATE operarios SET activo = false WHERE id = $1", [req.params.id]);
    res.json({ success: true });
});

module.exports = router;