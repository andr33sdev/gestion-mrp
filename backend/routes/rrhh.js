const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect } = require("../middleware/auth");

router.use(protect);

// --- CATEGORÍAS ---
router.get("/categorias", async (req, res) => {
  // Solo traemos las activas para no llenar de basura la pantalla
  const { rows } = await db.query(
    "SELECT * FROM rrhh_categorias WHERE activo = true ORDER BY id ASC",
  );
  res.json(rows);
});

router.post("/categorias", async (req, res) => {
  const { nombre, valor_hora } = req.body;
  try {
    // --- CORRECCIÓN AQUÍ: Forzamos 'true' en el INSERT ---
    const resDb = await db.query(
      "INSERT INTO rrhh_categorias (nombre, valor_hora, activo) VALUES ($1, $2, true) RETURNING *",
      [nombre, valor_hora || 0],
    );
    res.json(resDb.rows[0]);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

router.put("/categorias/:id", async (req, res) => {
  const { nombre, valor_hora } = req.body;
  try {
    await db.query(
      "UPDATE rrhh_categorias SET nombre=$1, valor_hora=$2 WHERE id=$3",
      [nombre, valor_hora, req.params.id],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Borrado lógico (Soft Delete)
router.delete("/categorias/:id", async (req, res) => {
  try {
    // PASO 1: Liberar a los empleados (poner su categoría en NULL)
    // Así vuelven a aparecer en la columna "Sin Asignar" del Frontend
    await db.query(
      "UPDATE rrhh_personal SET categoria_id = NULL WHERE categoria_id = $1",
      [req.params.id],
    );

    // PASO 2: Ahora sí, desactivamos la categoría
    await db.query("UPDATE rrhh_categorias SET activo = false WHERE id=$1", [
      req.params.id,
    ]);

    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// --- PERSONAL (MAPPING) ---
router.get("/personal", async (req, res) => {
  const { rows } = await db.query(`
    SELECT p.nombre, p.categoria_id, c.valor_hora, c.nombre as categoria_nombre
    FROM rrhh_personal p
    LEFT JOIN rrhh_categorias c ON p.categoria_id = c.id
  `);
  res.json(rows);
});

router.post("/personal/asignar", async (req, res) => {
  const { nombre, categoria_id } = req.body;
  try {
    await db.query(
      `
      INSERT INTO rrhh_personal (nombre, categoria_id) VALUES ($1, $2)
      ON CONFLICT (nombre) DO UPDATE SET categoria_id = $2, fecha_actualizacion = NOW()
    `,
      [nombre, categoria_id],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// --- HISTORIAL / CIERRES ---

// Guardar un nuevo cierre
router.post("/cierres", async (req, res) => {
  const { nombre_periodo, total_pagado, cantidad_empleados, datos_snapshot } =
    req.body;
  try {
    await db.query(
      "INSERT INTO rrhh_cierres (nombre_periodo, total_pagado, cantidad_empleados, datos_snapshot) VALUES ($1, $2, $3, $4)",
      [
        nombre_periodo,
        total_pagado,
        cantidad_empleados,
        JSON.stringify(datos_snapshot),
      ],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Obtener lista de cierres (SIN el JSON pesado para que la lista cargue rápido)
router.get("/cierres", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id, fecha_creacion, nombre_periodo, total_pagado, cantidad_empleados FROM rrhh_cierres ORDER BY id DESC",
    );
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Obtener un cierre específico CON el JSON para reimprimir
router.get("/cierres/:id", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM rrhh_cierres WHERE id = $1",
      [req.params.id],
    );
    if (rows.length === 0) return res.status(404).send("No encontrado");
    res.json(rows[0]);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// --- NUEVO: ELIMINAR UN CIERRE ---
router.delete("/cierres/:id", async (req, res) => {
  try {
    // Usamos DELETE físico porque es un historial que el usuario decidió borrar explícitamente
    await db.query("DELETE FROM rrhh_cierres WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send("Error al eliminar el cierre");
  }
});

module.exports = router;
