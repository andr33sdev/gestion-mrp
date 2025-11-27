// backend/routes/planificacion.js
const express = require("express");
const router = express.Router();
const db = require("../db");
// 1. Importamos los middlewares de seguridad
const { protect, restrictTo } = require("../middleware/auth");
// 2. Importamos la función de alerta MRP
const { enviarAlertaMRP } = require("../services/telegramBotListener");

// 3. Protegemos TODAS las rutas para que exijan al menos un API KEY válida
router.use(protect);

// --- RUTAS DE LECTURA (ACCESIBLES PARA TODOS: OPERARIO Y GERENCIA) ---

// Obtener todos los planes
router.get("/", async (req, res) => {
  const { rows } = await db.query(
    "SELECT * FROM planes_produccion ORDER BY fecha_creacion DESC"
  );
  res.json(rows);
});

// Obtener planes abiertos
router.get("/abiertos", async (req, res) => {
  const { rows } = await db.query(
    "SELECT id, nombre FROM planes_produccion WHERE estado = 'ABIERTO' ORDER BY fecha_creacion DESC"
  );
  res.json(rows);
});

// Obtener detalle de un plan
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const planRes = await db.query(
    "SELECT * FROM planes_produccion WHERE id=$1",
    [id]
  );
  if (planRes.rowCount === 0) return res.status(404).send("No existe");
  const plan = planRes.rows[0];
  const itemsRes = await db.query(
    `
        SELECT pi.id as plan_item_id, pi.cantidad_requerida,
        COALESCE((SELECT SUM(rp.cantidad_ok) FROM registros_produccion rp WHERE rp.plan_item_id = pi.id), 0) as cantidad_producida,
        s.id, s.nombre, s.codigo
        FROM planes_items pi JOIN semielaborados s ON pi.semielaborado_id = s.id WHERE pi.plan_id = $1
    `,
    [id]
  );
  plan.items = itemsRes.rows.map((i) => ({
    ...i,
    semielaborado: { id: i.id, nombre: i.nombre, codigo: i.codigo },
    cantidad: Number(i.cantidad_requerida),
    producido: Number(i.cantidad_producida),
  }));
  res.json(plan);
});

// Stats Operarios
router.get("/:id/operarios", async (req, res) => {
  const { rows } = await db.query(
    `
        SELECT o.nombre, SUM(r.cantidad_ok) as total_producido
        FROM registros_produccion r JOIN operarios o ON r.operario_id = o.id JOIN planes_items pi ON r.plan_item_id = pi.id
        WHERE pi.plan_id = $1 GROUP BY o.nombre ORDER BY total_producido DESC
    `,
    [req.params.id]
  );
  res.json(rows);
});

// Historial detallado
router.get("/:id/historial", async (req, res) => {
  const { rows } = await db.query(
    `
        SELECT rp.id, s.nombre as semielaborado, o.nombre as operario, rp.cantidad_ok as cantidad, rp.cantidad_scrap as scrap, rp.motivo_scrap as motivo, rp.fecha_produccion
        FROM registros_produccion rp JOIN planes_items pi ON rp.plan_item_id = pi.id JOIN semielaborados s ON rp.semielaborado_id = s.id JOIN operarios o ON rp.operario_id = o.id
        WHERE pi.plan_id = $1 ORDER BY rp.fecha_produccion DESC
    `,
    [req.params.id]
  );
  res.json(rows);
});

// --- FUNCIÓN AUXILIAR PARA CALCULAR MRP Y ALERTAR ---
async function verificarAlertasMRP(client, planId, nombrePlan) {
  try {
    // 1. Obtener todos los items del plan con sus recetas y consumo de MP
    // Esta consulta hace la explosión de materiales automática
    const query = `
            SELECT 
                mp.nombre, 
                mp.stock_actual, 
                mp.stock_minimo,
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
      const minimo = Number(mp.stock_minimo);
      const consumo = Number(mp.consumo_total);
      const saldoFinal = stock - consumo;

      // Si el saldo teórico al terminar el plan es menor al mínimo Y hubo consumo
      if (saldoFinal < minimo && consumo > 0) {
        materialesCriticos.push({
          nombre: mp.nombre,
          stock: stock.toFixed(2),
          minimo: minimo.toFixed(2),
          consumo: consumo.toFixed(2),
          saldo: saldoFinal.toFixed(2),
        });
      }
    }

    // Si encontramos problemas, enviamos la alerta
    if (materialesCriticos.length > 0) {
      // No usamos await para no frenar la respuesta al usuario en el frontend
      enviarAlertaMRP(nombrePlan, materialesCriticos);
    }
  } catch (e) {
    console.error("Error calculando alertas MRP:", e);
  }
}

// --- RUTAS DE ESCRITURA (SOLO GERENCIA) ---
// Aquí aplicamos el middleware restrictTo('GERENCIA')

// Crear Plan
router.post("/", restrictTo("GERENCIA"), async (req, res) => {
  const { nombre, items } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const resPlan = await client.query(
      "INSERT INTO planes_produccion (nombre, estado) VALUES ($1, 'ABIERTO') RETURNING id",
      [nombre]
    );
    const planId = resPlan.rows[0].id;
    for (const item of items) {
      await client.query(
        "INSERT INTO planes_items (plan_id, semielaborado_id, cantidad_requerida) VALUES ($1, $2, $3)",
        [planId, item.semielaborado.id, item.cantidad]
      );
    }

    // --- VERIFICAR ALERTAS MRP ---
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

// Cambiar Estado (Abrir/Cerrar)
router.put("/:id/estado", restrictTo("GERENCIA"), async (req, res) => {
  const { estado } = req.body;
  await db.query("UPDATE planes_produccion SET estado = $1 WHERE id = $2", [
    estado,
    req.params.id,
  ]);
  res.json({ success: true });
});

// Editar Plan existente
router.put("/:id", restrictTo("GERENCIA"), async (req, res) => {
  const { nombre, items } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE planes_produccion SET nombre = $1 WHERE id = $2",
      [nombre, req.params.id]
    );

    // Actualización inteligente de ítems
    const current = await client.query(
      "SELECT id FROM planes_items WHERE plan_id = $1",
      [req.params.id]
    );
    const dbIds = current.rows.map((r) => r.id);
    const incomingIds = [];

    for (const item of items) {
      if (item.plan_item_id) {
        await client.query(
          "UPDATE planes_items SET cantidad_requerida = $1 WHERE id = $2",
          [item.cantidad, item.plan_item_id]
        );
        incomingIds.push(item.plan_item_id);
      } else {
        await client.query(
          "INSERT INTO planes_items (plan_id, semielaborado_id, cantidad_requerida) VALUES ($1, $2, $3)",
          [req.params.id, item.semielaborado.id, item.cantidad]
        );
      }
    }

    const toDelete = dbIds.filter((id) => !incomingIds.includes(id));
    if (toDelete.length)
      await client.query("DELETE FROM planes_items WHERE id = ANY($1::int[])", [
        toDelete,
      ]);

    // --- VERIFICAR ALERTAS MRP (AL EDITAR TAMBIÉN) ---
    await verificarAlertasMRP(client, req.params.id, nombre);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally {
    client.release();
  }
});

// Eliminar Plan
router.delete("/:id", restrictTo("GERENCIA"), async (req, res) => {
  await db.query("DELETE FROM planes_produccion WHERE id = $1", [
    req.params.id,
  ]);
  res.json({ success: true });
});

module.exports = router;
