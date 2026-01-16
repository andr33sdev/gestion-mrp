const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect } = require("../middleware/auth");

router.use(protect);

// Obtener todos los feriados
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT to_char(fecha, 'YYYY-MM-DD') as fecha, descripcion FROM feriados"
    );
    // Devolvemos un array simple de fechas ['2026-01-01', '2026-12-25']
    res.json(rows.map((r) => r.fecha));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Alternar feriado (Si existe borra, si no existe crea)
router.post("/toggle", async (req, res) => {
  const { fecha } = req.body; // Espera 'YYYY-MM-DD'
  try {
    const check = await db.query(
      "SELECT fecha FROM feriados WHERE fecha = $1",
      [fecha]
    );

    if (check.rowCount > 0) {
      // Si existe, lo borramos
      await db.query("DELETE FROM feriados WHERE fecha = $1", [fecha]);
      res.json({ action: "removed" });
    } else {
      // Si no existe, lo creamos
      await db.query(
        "INSERT INTO feriados (fecha, descripcion) VALUES ($1, 'Feriado')",
        [fecha]
      );
      res.json({ action: "added" });
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
