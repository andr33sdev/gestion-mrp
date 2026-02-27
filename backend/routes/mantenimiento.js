const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM tickets_mantenimiento ORDER BY id DESC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/", async (req, res) => {
  const {
    maquina,
    titulo,
    descripcion,
    prioridad,
    tipo,
    creado_por,
    asignado_a,
  } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO tickets_mantenimiento (maquina, titulo, descripcion, estado, prioridad, tipo, creado_por, asignado_a, fecha_creacion, alerta_24h_enviada) 
       VALUES ($1, $2, $3, 'PENDIENTE', $4, $5, $6, $7, CURRENT_TIMESTAMP, false) RETURNING *`,
      [
        maquina,
        titulo || "Falla",
        descripcion,
        prioridad || "MEDIA",
        tipo || "CORRECTIVO",
        creado_por,
        asignado_a || "Técnico de Turno",
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.put("/:id/estado", async (req, res) => {
  const {
    estado,
    resuelto_por,
    fecha_inicio_revision,
    fecha_solucion,
    notas_revision,
    solucion_notas,
  } = req.body;
  try {
    let query =
      "UPDATE tickets_mantenimiento SET estado = $1, resuelto_por = $2";
    let params = [estado, resuelto_por];
    let queryCount = 3;

    if (fecha_inicio_revision) {
      query += `, fecha_inicio_revision = $${queryCount}`;
      params.push(fecha_inicio_revision);
      queryCount++;
    }
    if (fecha_solucion) {
      query += `, fecha_solucion = $${queryCount}`;
      params.push(fecha_solucion);
      queryCount++;
    }
    if (notas_revision !== undefined) {
      query += `, notas_revision = $${queryCount}`;
      params.push(notas_revision);
      queryCount++;
    }
    if (solucion_notas !== undefined) {
      query += `, solucion_notas = $${queryCount}`;
      params.push(solucion_notas);
      queryCount++;
    }

    query += ` WHERE id = $${queryCount}`;
    params.push(req.params.id);

    await db.query(query, params);
    res.json({ success: true, msg: "Estado actualizado" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM tickets_mantenimiento WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true, msg: "Ticket eliminado" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- NUEVAS RUTAS PARA EL PERFIL DE MÁQUINA ---
router.get("/maquina/:nombre", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT notas FROM maquinas_perfil WHERE maquina = $1",
      [req.params.nombre],
    );
    res.json({ notas: rows.length ? rows[0].notas : "" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.put("/maquina/:nombre", async (req, res) => {
  try {
    const { notas } = req.body;
    await db.query(
      `INSERT INTO maquinas_perfil (maquina, notas) VALUES ($1, $2)
       ON CONFLICT (maquina) DO UPDATE SET notas = EXCLUDED.notas`,
      [req.params.nombre, notas],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
