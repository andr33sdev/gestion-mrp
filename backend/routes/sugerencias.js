const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect, restrictTo } = require("../middleware/auth");

router.use(protect);

// 1. OBTENER SUGERENCIAS
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, mp.nombre as mp_nombre, mp.codigo as mp_codigo, mp.stock_actual
      FROM sugerencias_compra s
      JOIN materias_primas mp ON s.materia_prima_id = mp.id
      ORDER BY 
        CASE WHEN s.estado = 'PENDIENTE' THEN 0 ELSE 1 END,
        CASE WHEN s.prioridad = 'URGENTE' THEN 0 ELSE 1 END,
        s.fecha_creacion DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 2. CREAR SUGERENCIA (CON LOG)
router.post("/", async (req, res) => {
  const { materia_prima_id, cantidad, prioridad, comentario, solicitante } =
    req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Crear Sugerencia
    const nueva = await client.query(
      `INSERT INTO sugerencias_compra 
       (materia_prima_id, cantidad, prioridad, comentario, solicitante, estado)
       VALUES ($1, $2, $3, $4, $5, 'PENDIENTE') RETURNING *`,
      [
        materia_prima_id,
        cantidad,
        prioridad || "NORMAL",
        comentario,
        solicitante,
      ],
    );
    const id = nueva.rows[0].id;

    // Crear Historial
    await client.query(
      `INSERT INTO historial_sugerencias (sugerencia_id, accion, usuario, detalle) 
       VALUES ($1, 'CREADO', $2, $3)`,
      [
        id,
        solicitante,
        `Sugerencia creada. Cant: ${cantidad}. Prioridad: ${prioridad}`,
      ],
    );

    await client.query("COMMIT");
    res.json({ success: true, data: nueva.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally {
    client.release();
  }
});

// 3. ADMINISTRAR TICKET (CAMBIAR ESTADO CON LOG)
router.put("/:id/estado", restrictTo("GERENCIA"), async (req, res) => {
  const { estado, cantidad, comentario, usuario } = req.body; // 'usuario' es quien hace la acción (Gerencia)
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (cantidad) {
      await client.query(
        "UPDATE sugerencias_compra SET cantidad = $1 WHERE id = $2",
        [cantidad, req.params.id],
      );
    }

    await client.query(
      "UPDATE sugerencias_compra SET estado = $1, comentario = COALESCE($2, comentario), fecha_resolucion = NOW() WHERE id = $3",
      [estado, comentario, req.params.id],
    );

    // Guardar en historial
    await client.query(
      `INSERT INTO historial_sugerencias (sugerencia_id, accion, usuario, detalle) 
       VALUES ($1, $2, $3, $4)`,
      [
        req.params.id,
        estado,
        usuario || "Gerencia",
        `Cambio de estado a ${estado}`,
      ],
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally {
    client.release();
  }
});

// 4. NUEVO ENDPOINT: OBTENER HISTORIAL DE UN TICKET
router.get("/:id/historial", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM historial_sugerencias WHERE sugerencia_id = $1 ORDER BY fecha DESC",
      [req.params.id],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 5. ELIMINAR TICKET
router.delete("/:id", restrictTo("GERENCIA"), async (req, res) => {
  try {
    await db.query("DELETE FROM sugerencias_compra WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

module.exports = router;
