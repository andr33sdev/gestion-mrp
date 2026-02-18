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

// NUEVA RUTA: Obtener Pedidos Sin Stock (MEJORADA CON ESTRUCTURA JSON)
router.get("/sin-stock", async (req, res) => {
  try {
    const query = `
      SELECT * FROM pedidos_clientes 
      WHERE 
        -- 1. CRITERIO DE INCLUSIÓN (Variantes de texto que indican falta de stock)
        (
          estado ILIKE '%SIN STOCK%' 
          OR estado ILIKE '%S/STOCK%' 
          OR estado ILIKE '%FALTA%'
          OR estado ILIKE '%A PRODUCIR%'
          OR estado ILIKE '%REVISAR%'
          OR estado ILIKE '%ATRASADO%'
        )
        -- 2. CRITERIO DE EXCLUSIÓN POR ESTADO (No cancelados ni finalizados explícitos)
        AND estado NOT ILIKE '%CANCELADO%'
        AND estado NOT ILIKE '%ENTREGADO%'
        AND estado NOT ILIKE '%DESPACHADO%'
        AND estado NOT ILIKE '%ANULADO%'
        
        -- 3. CRITERIO DE EXCLUSIÓN POR PROCESO (La clave para limpiar "viejos")
        -- Si ya tiene fecha de despacho, ya salió (no es sin stock).
        AND (fecha_despacho IS NULL OR fecha_despacho = '')
        -- Si ya tiene fecha de preparación, ya se armó (el stock estaba).
        AND (fecha_preparacion IS NULL OR fecha_preparacion = '')

      ORDER BY id DESC
    `;

    const result = await db.query(query);
    res.json(result.rows);
  } catch (e) {
    console.error("Error al buscar pedidos sin stock:", e);
    // Devolvemos array vacío para no romper el frontend si falla
    res.status(500).json([]);
  }
});

// GET DETALLE DEL PLAN (CORREGIDO)
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

router.post("/", restrictTo("GERENCIA"), async (req, res) => {
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
      // AQUI AGREGAMOS LOS CAMPOS NUEVOS AL INSERT
      await client.query(
        "INSERT INTO planes_items (plan_id, semielaborado_id, cantidad_requerida, ritmo_turno, fecha_inicio_estimada) VALUES ($1, $2, $3, $4, $5)",
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

// Ruta para forzar la sincronización manual desde el botón
router.post("/sincronizar-ya", async (req, res) => {
  try {
    // Esto ejecuta la función que acabamos de corregir
    await sincronizarPedidos();
    res.json({
      success: true,
      message: "Base de datos actualizada con el Excel",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al sincronizar" });
  }
});

router.put("/:id/estado", restrictTo("GERENCIA"), async (req, res) => {
  const { estado } = req.body;
  await db.query("UPDATE planes_produccion SET estado = $1 WHERE id = $2", [
    estado,
    req.params.id,
  ]);
  res.json({ success: true });
});

// EDITAR PLAN (CORREGIDO)
router.put("/:id", restrictTo("GERENCIA"), async (req, res) => {
  const { nombre, items } = req.body;

  // Log para depuración en consola del servidor
  console.log(
    `💾 Guardando Plan ${req.params.id}. Items recibidos: ${items?.length}`,
  );

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (nombre) {
      await client.query(
        "UPDATE planes_produccion SET nombre = $1 WHERE id = $2",
        [nombre, req.params.id],
      );
    }

    const current = await client.query(
      "SELECT id FROM planes_items WHERE plan_id = $1",
      [req.params.id],
    );
    const dbIds = current.rows.map((r) => r.id);
    const incomingIds = [];

    for (const item of items) {
      // Aseguramos valores
      const ritmo = item.ritmo_turno || 50;
      const fecha = item.fecha_inicio_estimada || null;

      if (item.plan_item_id) {
        // ACTUALIZACION: Agregamos ritmo y fecha
        await client.query(
          `UPDATE planes_items 
           SET cantidad_requerida = $1, 
               ritmo_turno = $2, 
               fecha_inicio_estimada = $3
           WHERE id = $4`,
          [item.cantidad, ritmo, fecha, item.plan_item_id],
        );
        incomingIds.push(item.plan_item_id);
      } else {
        // INSERCION (Nuevos items/remanentes): Agregamos ritmo y fecha
        await client.query(
          "INSERT INTO planes_items (plan_id, semielaborado_id, cantidad_requerida, ritmo_turno, fecha_inicio_estimada) VALUES ($1, $2, $3, $4, $5)",
          [req.params.id, item.semielaborado.id, item.cantidad, ritmo, fecha],
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
    console.error("Error al guardar plan:", e);
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
