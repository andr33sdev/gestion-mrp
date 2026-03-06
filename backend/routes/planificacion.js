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
router.post(
  "/",
  restrictTo("GERENCIA", "JEFE PRODUCCIÓN"),
  async (req, res) => {
    // 👇 1. Agregamos tareas_armado al req.body
    const { nombre, items, tareas_armado } = req.body;
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const resPlan = await client.query(
        // 👇 2. Agregamos tareas_armado al INSERT
        "INSERT INTO planes_produccion (nombre, estado, tareas_armado) VALUES ($1, 'ABIERTO', $2) RETURNING id",
        [nombre, JSON.stringify(tareas_armado || [])],
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
  },
);

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

router.put(
  "/:id/estado",
  restrictTo("GERENCIA", "JEFE PRODUCCIÓN"),
  async (req, res) => {
    const { estado } = req.body;
    await db.query("UPDATE planes_produccion SET estado = $1 WHERE id = $2", [
      estado,
      req.params.id,
    ]);
    res.json({ success: true });
  },
);

router.put(
  "/:id",
  restrictTo("GERENCIA", "JEFE PRODUCCIÓN"),
  async (req, res) => {
    // 👇 1. Agregamos tareas_armado al req.body
    const { nombre, items, tareas_armado } = req.body;
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      if (nombre)
        await client.query(
          // 👇 2. Agregamos tareas_armado al UPDATE
          "UPDATE planes_produccion SET nombre = $1, tareas_armado = $2 WHERE id = $3",
          [nombre, JSON.stringify(tareas_armado || []), req.params.id],
        );

      const current = await client.query(
        "SELECT id FROM planes_items WHERE plan_id = $1",
        [req.params.id],
      );
      const dbIds = current.rows.map((r) => r.id);
      const incomingIds = [];

      for (const item of items) {
        const estadoFila = item.estado_kanban || "PENDIENTE";

        if (item.plan_item_id) {
          await client.query(
            `UPDATE planes_items SET cantidad_requerida = $1, ritmo_turno = $2, fecha_inicio_estimada = $3, estado = $4 WHERE id = $5`,
            [
              item.cantidad,
              item.ritmo_turno || 50,
              item.fecha_inicio_estimada || null,
              estadoFila,
              item.plan_item_id,
            ],
          );
          incomingIds.push(item.plan_item_id);
        } else {
          await client.query(
            "INSERT INTO planes_items (plan_id, semielaborado_id, cantidad_requerida, ritmo_turno, fecha_inicio_estimada, estado) VALUES ($1, $2, $3, $4, $5, $6)",
            [
              req.params.id,
              item.semielaborado.id,
              item.cantidad,
              item.ritmo_turno || 50,
              item.fecha_inicio_estimada || null,
              estadoFila,
            ],
          );
        }
      }
      const toDelete = dbIds.filter((id) => !incomingIds.includes(id));
      if (toDelete.length)
        await client.query(
          "DELETE FROM planes_items WHERE id = ANY($1::int[])",
          [toDelete],
        );
      if (nombre) await verificarAlertasMRP(client, req.params.id, nombre);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      res.status(500).send(e.message);
    } finally {
      client.release();
    }
  },
);

router.delete("/:id", restrictTo("GERENCIA"), async (req, res) => {
  await db.query("DELETE FROM planes_produccion WHERE id = $1", [
    req.params.id,
  ]);
  res.json({ success: true });
});

// --- ENDPOINT: TORRE DE CONTROL (ACTUALIZADO CON ARMADO Y PEDIDOS) ---
router.get("/cockpit/data", async (req, res) => {
  try {
    const radarRes = await db.query(`
      SELECT 
        pi.id, pi.cantidad_requerida as cantidad, pi.estado,
        s.nombre as producto_nombre, s.codigo,
        p.nombre as plan_nombre,
        COALESCE((SELECT SUM(cantidad_ok) FROM registros_produccion WHERE plan_item_id = pi.id), 0) as producido,
        NULL as ultimo_operario
      FROM planes_items pi
      JOIN semielaborados s ON pi.semielaborado_id = s.id
      JOIN planes_produccion p ON pi.plan_id = p.id
      WHERE pi.estado = 'PROCESO' AND p.estado = 'ABIERTO'
    `);

    const pedidosRes = await db.query(`
      SELECT id as op, cliente, modelo, cantidad, fecha 
      FROM pedidos_clientes 
      WHERE estado ILIKE '%SIN STOCK%'
      ORDER BY id DESC
    `);

    const mrpRes = await db.query(`
      SELECT 
          mp.nombre,
          mp.stock_actual,
          (mp.stock_actual - SUM(
              (CASE WHEN CAST(pi.cantidad_requerida AS TEXT) ~ '^[0-9]+(\.[0-9]+)?$' THEN CAST(pi.cantidad_requerida AS NUMERIC) ELSE 0 END) 
              * (CASE WHEN REPLACE(CAST(r.cantidad AS TEXT), ',', '.') ~ '^[0-9]+(\.[0-9]+)?$' THEN CAST(REPLACE(CAST(r.cantidad AS TEXT), ',', '.') AS NUMERIC) ELSE 0 END)
          )) as balance
      FROM planes_items pi
      JOIN planes_produccion p ON pi.plan_id = p.id
      JOIN recetas_semielaborados r ON pi.semielaborado_id = r.semielaborado_id
      JOIN materias_primas mp ON r.materia_prima_id = mp.id 
      WHERE p.estado = 'ABIERTO'
      GROUP BY mp.id, mp.nombre, mp.stock_actual
      HAVING (mp.stock_actual - SUM(
              (CASE WHEN CAST(pi.cantidad_requerida AS TEXT) ~ '^[0-9]+(\.[0-9]+)?$' THEN CAST(pi.cantidad_requerida AS NUMERIC) ELSE 0 END) 
              * (CASE WHEN REPLACE(CAST(r.cantidad AS TEXT), ',', '.') ~ '^[0-9]+(\.[0-9]+)?$' THEN CAST(REPLACE(CAST(r.cantidad AS TEXT), ',', '.') AS NUMERIC) ELSE 0 END)
          )) < 0
      ORDER BY balance ASC
    `);

    // NUEVO: Traer Tareas de Armado Pendientes de planes abiertos
    const planesRes = await db.query(
      "SELECT nombre, tareas_armado FROM planes_produccion WHERE estado = 'ABIERTO'",
    );
    const tareasArmadoPendientes = [];
    planesRes.rows.forEach((p) => {
      const tareas =
        typeof p.tareas_armado === "string"
          ? JSON.parse(p.tareas_armado)
          : p.tareas_armado || [];
      tareas.forEach((t) => {
        if (Number(t.realizado || 0) < Number(t.meta)) {
          tareasArmadoPendientes.push({ ...t, plan_nombre: p.nombre });
        }
      });
    });

    // NUEVO: Traer Pedidos de los últimos 2 meses para enlazar a las máquinas
    const historialPedidos = await db.query(`
      SELECT id as op_real, op, cliente, modelo, cantidad, fecha, estado, detalles 
      FROM pedidos_clientes 
      ORDER BY id DESC LIMIT 2000
    `);

    const maquinasRes = await db.query(
      `SELECT * FROM maquinas ORDER BY id ASC`,
    );

    res.json({
      radar: radarRes.rows,
      pedidosCriticos: pedidosRes.rows,
      alertasStock: mrpRes.rows,
      maquinas: maquinasRes.rows,
      tareasArmado: tareasArmadoPendientes, // Agregado
      pedidosHistorial: historialPedidos.rows, // Agregado
    });
  } catch (err) {
    console.error("🔥 Error en Torre de Control:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- GESTIÓN DE MÁQUINAS (ACTUALIZADO) ---
router.post("/maquinas", async (req, res) => {
  try {
    await db.query(
      "INSERT INTO maquinas (nombre, semielaborado, destino) VALUES ($1, NULL, 'STOCK')",
      [req.body.nombre],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/maquinas/:id", async (req, res) => {
  try {
    const { configuracion } = req.body;

    // Guardamos el array completo en la nueva columna JSONB
    await db.query(
      "UPDATE maquinas SET configuracion = $1, semielaborado = NULL, destino = 'STOCK', op = NULL, cliente = NULL WHERE id = $2",
      [JSON.stringify(configuracion || []), req.params.id],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/maquinas/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM maquinas WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/maquinas/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM maquinas WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
