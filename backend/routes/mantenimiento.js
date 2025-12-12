// backend/routes/mantenimiento.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// 1. Obtener Tickets
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *,
        EXTRACT(EPOCH FROM (COALESCE(fecha_inicio_revision, NOW()) - fecha_creacion))/60 as minutos_respuesta_calc,
        EXTRACT(EPOCH FROM (COALESCE(fecha_solucion, NOW()) - fecha_inicio_revision))/60 as minutos_reparacion_calc
      FROM tickets_mantenimiento 
      ORDER BY 
        CASE WHEN estado = 'PENDIENTE' THEN 1 WHEN estado = 'EN_REVISION' THEN 2 ELSE 3 END,
        CASE WHEN prioridad = 'ALTA' THEN 1 WHEN prioridad = 'MEDIA' THEN 2 ELSE 3 END,
        fecha_creacion DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 2. Crear Ticket (ACTUALIZADO: Recibe creado_por manual)
router.post("/", async (req, res) => {
  const { maquina, titulo, descripcion, prioridad, tipo, creado_por } =
    req.body;
  try {
    await db.query(
      `INSERT INTO tickets_mantenimiento (maquina, titulo, descripcion, prioridad, tipo, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        maquina,
        titulo,
        descripcion,
        prioridad || "MEDIA",
        tipo || "CORRECTIVO",
        creado_por || "Anónimo",
      ]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 3. Cambiar Estado
router.put("/:id/estado", async (req, res) => {
  const { nuevo_estado, notas, tecnico } = req.body;
  const { id } = req.params;
  try {
    if (nuevo_estado === "EN_REVISION") {
      await db.query(
        "UPDATE tickets_mantenimiento SET estado = 'EN_REVISION', fecha_inicio_revision = NOW(), asignado_a = $1 WHERE id = $2",
        [tecnico, id]
      );
    } else if (nuevo_estado === "SOLUCIONADO") {
      await db.query(
        "UPDATE tickets_mantenimiento SET estado = 'SOLUCIONADO', fecha_solucion = NOW(), solucion_notas = $1 WHERE id = $2",
        [notas, id]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 4. ELIMINAR TICKET (NUEVO)
router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM tickets_mantenimiento WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

module.exports = router;
