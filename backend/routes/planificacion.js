const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect, restrictTo } = require("../middleware/auth");
const { enviarAlertaMRP } = require("../services/telegramBotListener");
const { getPlanById } = require("../controllers/planificacionController");
const { sincronizarPedidos } = require("../services/syncService");

router.use(protect);

// --- RUTAS DE LECTURA ---

router.get("/", async (req, res) => {
  const { rows } = await db.query(
    "SELECT * FROM planes_produccion ORDER BY fecha_creacion DESC",
  );
  res.json(rows);
});

router.get("/abiertos", async (req, res) => {
  const { rows } = await db.query(
    "SELECT id, nombre FROM planes_produccion WHERE estado = 'ABIERTO' ORDER BY fecha_creacion DESC",
  );
  res.json(rows);
});

// NUEVA RUTA PARA EL TABLERO KANBAN (Fusionada)
// Trae los ítems de planes abiertos para mostrar en las tarjetas estéticas
router.get("/kanban", async (req, res) => {
  try {
    const query = `
      SELECT 
        pi.*, 
        s.nombre as producto_nombre,
        p.nombre as plan_nombre,
        p.estado as plan_estado
      FROM planes_items pi
      JOIN semielaborados s ON pi.semielaborado_id = s.id
      JOIN planes_produccion p ON pi.plan_id = p.id
      WHERE p.estado = 'ABIERTO' OR pi.estado != 'FINALIZADO'
      ORDER BY pi.fecha_inicio_estimada ASC, pi.id DESC
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- RUTAS PARA LA FICHA DE ÍTEM ---
router.get("/item/:id/notas", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT notas FROM plan_item_notas WHERE plan_item_id = $1",
      [req.params.id],
    );
    res.json({ notas: rows.length ? rows[0].notas : "" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.put("/item/:id/notas", async (req, res) => {
  try {
    const { notas } = req.body;
    const itemId = req.params.id;

    await db.query(
      `INSERT INTO plan_item_notas (plan_item_id, notas) VALUES ($1, $2)
       ON CONFLICT (plan_item_id) DO UPDATE SET notas = EXCLUDED.notas`,
      [itemId, notas],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("ERROR EN NOTAS:", err.message); // Esto te dirá el problema real en la terminal
    res.status(500).send("Error al guardar la nota: " + err.message);
  }
});

router.get("/sin-stock", async (req, res) => {
  try {
    const query = `
      SELECT * FROM pedidos_clientes 
      WHERE 
        (estado ILIKE '%SIN STOCK%' OR estado ILIKE '%S/STOCK%' OR estado ILIKE '%FALTA%' OR estado ILIKE '%A PRODUCIR%' OR estado ILIKE '%REVISAR%' OR estado ILIKE '%ATRASADO%')
        AND estado NOT ILIKE '%CANCELADO%' AND estado NOT ILIKE '%ENTREGADO%' AND estado NOT ILIKE '%DESPACHADO%' AND estado NOT ILIKE '%ANULADO%'
        AND (fecha_despacho IS NULL OR fecha_despacho = '')
        AND (fecha_preparacion IS NULL OR fecha_preparacion = '')
      ORDER BY id DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (e) {
    console.error("Error al buscar pedidos sin stock:", e);
    res.status(500).json([]);
  }
});

router.get("/:id", getPlanById);

router.get("/:id/operarios", async (req, res) => {
  const { rows } = await db.query(
    `SELECT o.nombre, SUM(r.cantidad_ok) as total_producido 
     FROM registros_produccion r 
     JOIN operarios o ON r.operario_id = o.id 
     JOIN planes_items pi ON r.plan_item_id = pi.id 
     WHERE pi.plan_id = $1 GROUP BY o.nombre ORDER BY total_producido DESC`,
    [req.params.id],
  );
  res.json(rows);
});

router.get("/:id/historial", async (req, res) => {
  const { rows } = await db.query(
    `SELECT rp.id, s.nombre as semielaborado, o.nombre as operario, rp.cantidad_ok as cantidad, rp.cantidad_scrap as scrap, rp.motivo_scrap as motivo, rp.fecha_produccion 
     FROM registros_produccion rp 
     JOIN planes_items pi ON rp.plan_item_id = pi.id 
     JOIN semielaborados s ON rp.semielaborado_id = s.id 
     JOIN operarios o ON rp.operario_id = o.id 
     WHERE pi.plan_id = $1 ORDER BY rp.fecha_produccion DESC`,
    [req.params.id],
  );
  res.json(rows);
});

async function verificarAlertasMRP(client, planId, nombrePlan) {
  try {
    const query = `
            SELECT mp.nombre, mp.stock_actual, mp.stock_minimo, 
            SUM(rs.cantidad * pi.cantidad_requerida) as consumo_total
            FROM planes_items pi 
            JOIN recetas_semielaborados rs ON pi.semielaborado_id = rs.semielaborado_id 
            JOIN materias_primas mp ON rs.materia_prima_id = mp.id
            WHERE pi.plan_id = $1 
            GROUP BY mp.id, mp.nombre, mp.stock_actual, mp.stock_minimo
        `;
    const { rows } = await client.query(query, [planId]);
    const materialesCriticos = [];
    for (const mp of rows) {
      const stock = Number(mp.stock_actual);
      const saldoFinal = stock - Number(mp.consumo_total);
      if (
        saldoFinal < Number(mp.stock_minimo) &&
        Number(mp.consumo_total) > 0
      ) {
        materialesCriticos.push({
          nombre: mp.nombre,
          stock: stock.toFixed(2),
          minimo: Number(mp.stock_minimo).toFixed(2),
          consumo: Number(mp.consumo_total).toFixed(2),
          saldo: saldoFinal.toFixed(2),
        });
      }
    }
    if (materialesCriticos.length > 0)
      enviarAlertaMRP(nombrePlan, materialesCriticos);
  } catch (e) {
    console.error("Error MRP:", e);
  }
}

// --- RUTAS DE ESCRITURA ---

router.post("/", restrictTo("GERENCIA", "JEFE PRODUCCIÓN"), async (req, res) => {
  const { nombre, items } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const resPlan = await client.query(
      "INSERT INTO planes_produccion (nombre, estado) VALUES ($1, 'ABIERTO') RETURNING id",
      [nombre],
    );
    const planId = resPlan.rows[0].id;

    for (const item of items) {
      await client.query(
        "INSERT INTO planes_items (plan_id, semielaborado_id, cantidad_requerida, ritmo_turno, fecha_inicio_estimada, estado) VALUES ($1, $2, $3, $4, $5, 'PENDIENTE')",
        [
          planId,
          item.semielaborado.id,
          item.cantidad,
          item.ritmo_turno || 50,
          item.fecha_inicio_estimada || null,
        ],
      );
    }
    await verificarAlertasMRP(client, planId, nombre);
    await client.query("COMMIT");
    res.status(201).json({ success: true, planId });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally {
    client.release();
  }
});

// NUEVA RUTA: Actualizar ítem individual desde el Kanban
router.put("/item/:id", async (req, res) => {
  const { estado, maquina } = req.body;
  try {
    await db.query(
      // Usamos COALESCE para que si 'maquina' viene vacío, no borre lo que ya estaba ni tire error
      "UPDATE planes_items SET estado = $1, maquina = COALESCE($2, maquina) WHERE id = $3",
      [estado, maquina || null, req.params.id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error guardando estado en Kanban:", err.message);
    res.status(500).send(err.message);
  }
});

// OBTENER COMENTARIOS DE UN ÍTEM
router.get("/item/:id/comentarios", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM plan_item_comentarios WHERE plan_item_id = $1 ORDER BY fecha ASC",
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// AGREGAR UN NUEVO COMENTARIO
router.post("/item/:id/comentarios", async (req, res) => {
  try {
    const { texto, usuario } = req.body;
    await db.query(
      "INSERT INTO plan_item_comentarios (plan_item_id, usuario, texto) VALUES ($1, $2, $3)",
      [req.params.id, usuario, texto],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// EDITAR UN COMENTARIO
router.put("/item/:itemId/comentarios/:comentarioId", async (req, res) => {
  try {
    const { texto } = req.body;
    await db.query(
      "UPDATE plan_item_comentarios SET texto = $1 WHERE id = $2",
      [texto, req.params.comentarioId],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ELIMINAR UN COMENTARIO
router.delete("/item/:itemId/comentarios/:comentarioId", async (req, res) => {
  try {
    await db.query("DELETE FROM plan_item_comentarios WHERE id = $1", [
      req.params.comentarioId,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/sincronizar-ya", async (req, res) => {
  try {
    await sincronizarPedidos();
    res.json({
      success: true,
      message: "Base de datos actualizada con el Excel",
    });
  } catch (e) {
    res.status(500).json({ error: "Error al sincronizar" });
  }
});

router.put("/:id/estado", restrictTo("GERENCIA", "JEFE PRODUCCIÓN"), async (req, res) => {
  const { estado } = req.body;
  await db.query("UPDATE planes_produccion SET estado = $1 WHERE id = $2", [
    estado,
    req.params.id,
  ]);
  res.json({ success: true });
});

router.put("/:id", restrictTo("GERENCIA", "JEFE PRODUCCIÓN"), async (req, res) => {
  const { nombre, items } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (nombre)
      await client.query(
        "UPDATE planes_produccion SET nombre = $1 WHERE id = $2",
        [nombre, req.params.id],
      );

    const current = await client.query(
      "SELECT id FROM planes_items WHERE plan_id = $1",
      [req.params.id],
    );
    const dbIds = current.rows.map((r) => r.id);
    const incomingIds = [];

    for (const item of items) {
      // 👇 Tomamos el estado que manda el frontend, o PENDIENTE por defecto
      const estadoFila = item.estado_kanban || "PENDIENTE";

      if (item.plan_item_id) {
        await client.query(
          // 👇 Se agregó "estado = $4"
          `UPDATE planes_items SET cantidad_requerida = $1, ritmo_turno = $2, fecha_inicio_estimada = $3, estado = $4 WHERE id = $5`,
          [
            item.cantidad,
            item.ritmo_turno || 50,
            item.fecha_inicio_estimada || null,
            estadoFila, // 👈 Nuevo
            item.plan_item_id,
          ],
        );
        incomingIds.push(item.plan_item_id);
      } else {
        await client.query(
          // 👇 Se agregó la columna "estado" al INSERT
          "INSERT INTO planes_items (plan_id, semielaborado_id, cantidad_requerida, ritmo_turno, fecha_inicio_estimada, estado) VALUES ($1, $2, $3, $4, $5, $6)",
          [
            req.params.id,
            item.semielaborado.id,
            item.cantidad,
            item.ritmo_turno || 50,
            item.fecha_inicio_estimada || null,
            estadoFila, // 👈 Nuevo
          ],
        );
      }
    }
    const toDelete = dbIds.filter((id) => !incomingIds.includes(id));
    if (toDelete.length)
      await client.query("DELETE FROM planes_items WHERE id = ANY($1::int[])", [
        toDelete,
      ]);
    if (nombre) await verificarAlertasMRP(client, req.params.id, nombre);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally {
    client.release();
  }
});

router.delete("/:id", restrictTo("GERENCIA"), async (req, res) => {
  await db.query("DELETE FROM planes_produccion WHERE id = $1", [
    req.params.id,
  ]);
  res.json({ success: true });
});

module.exports = router;
