const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect, restrictTo } = require("../middleware/auth");
const { sincronizarPedidos } = require("../services/syncService");

router.use(protect);

// 1. OBTENER PEDIDOS (ORDEN CRONOLÓGICO REAL)
router.get("/pedidos", async (req, res) => {
  try {
    const { rows } = await db.query(`
            SELECT * FROM pedidos_clientes 
            WHERE estado NOT ILIKE '%CANCELADO%'
            ORDER BY 
                -- Convertimos texto "DD/MM/YY HH:MI" a timestamp para ordenar perfecto
                -- Si no tiene hora, to_timestamp asume 00:00:00
                to_timestamp(fecha, 'DD/MM/YY HH24:MI') DESC,
                id DESC
            LIMIT 50000
        `);
    res.json(rows);
  } catch (e) {
    // Fallback por si hay fechas corruptas que rompan el to_timestamp
    try {
      const { rows } = await db.query(
        `SELECT * FROM pedidos_clientes WHERE estado NOT ILIKE '%CANCELADO%' ORDER BY id DESC LIMIT 50000`,
      );
      res.json(rows);
    } catch (err2) {
      res.status(500).send(err2.message);
    }
  }
});

// 2. SINCRONIZAR
router.post("/sincronizar", async (req, res) => {
  try {
    await sincronizarPedidos();
    res.json({ success: true, msg: "Sincronización completada." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. PREPARAR
router.post("/preparar/:id", async (req, res) => {
  try {
    const hoy = new Date();
    const fechaTxt = `${hoy.getDate()}/${hoy.getMonth() + 1}/${String(hoy.getFullYear()).slice(-2)}`;
    await db.query(
      "UPDATE pedidos_clientes SET fecha_preparacion = $1 WHERE id = $2",
      [fechaTxt, req.params.id],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 4. DESPACHAR
router.post(
  "/despachar/:id",
  restrictTo("DEPOSITO", "GERENCIA"),
  async (req, res) => {
    const { id } = req.params;
    const usuario = req.userRole || "Depósito";
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const pRes = await client.query(
        "SELECT * FROM pedidos_clientes WHERE id = $1",
        [id],
      );
      const pedido = pRes.rows[0];

      const recetaRes = await client.query(
        `SELECT r.semielaborado_id, r.cantidad as consumo_unitario FROM recetas r WHERE TRIM(UPPER(r.producto_terminado)) = TRIM(UPPER($1))`,
        [pedido.modelo],
      );
      if (recetaRes.rowCount > 0) {
        const cantNum =
          parseFloat(
            pedido.cantidad ? pedido.cantidad.replace(/\./g, "") : "0",
          ) || 0;
        for (const item of recetaRes.rows) {
          await client.query(
            "UPDATE semielaborados SET stock_actual = stock_actual - $1 WHERE id = $2",
            [item.consumo_unitario * cantNum, item.semielaborado_id],
          );
        }
      }
      const hoy = new Date();
      const fechaTxt = `${hoy.getDate()}/${hoy.getMonth() + 1}/${String(hoy.getFullYear()).slice(-2)}`;
      await client.query(
        "UPDATE pedidos_clientes SET estado = 'DESPACHADO', fecha_despacho = $1, usuario_despacho = $2 WHERE id = $3",
        [fechaTxt, usuario, id],
      );
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      res.status(400).json({ success: false, error: e.message });
    } finally {
      client.release();
    }
  },
);

// 5. REVERTIR
router.post("/revertir/:id", restrictTo("GERENCIA"), async (req, res) => {
  try {
    await db.query(
      "UPDATE pedidos_clientes SET estado = 'PENDIENTE', fecha_despacho = NULL, usuario_despacho = NULL WHERE id = $1",
      [req.params.id],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

module.exports = router;
