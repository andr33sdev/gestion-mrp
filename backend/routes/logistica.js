const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect, restrictTo } = require("../middleware/auth"); // Importar middlewares

// Proteger rutas (Logística suele ser para Gerencia o Depósito)
// Puedes ajustar los roles según necesites
router.use(protect);

router.get("/stock", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      "SELECT id, codigo, nombre, stock_planta_26, stock_planta_37, stock_deposito_ayolas, stock_deposito_quintana FROM semielaborados ORDER BY nombre ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 2. ENVÍO (SOLO GENERA REMITO, NO DESCUENTA STOCK)
router.post("/enviar", async (req, res) => {
  const { items, origen, destino, chofer } = req.body;
  const codigo_remito = `REM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      // --- COMENTADO: NO TOCAMOS EL STOCK ---
      // await client.query(`UPDATE semielaborados SET ${colOrigen} = ${colOrigen} - $1 WHERE id = $2`, [item.cantidad, item.id]);

      // SOLO REGISTRAMOS EL MOVIMIENTO
      await client.query(
        "INSERT INTO movimientos_logistica (semielaborado_id, cantidad, origen, destino, estado, codigo_remito, chofer) VALUES ($1, $2, $3, $4, 'EN_TRANSITO', $5, $6)",
        [item.id, item.cantidad, origen, destino, codigo_remito, chofer]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, codigo_remito });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally {
    client.release();
  }
});

// 3. RECIBIR (SOLO CAMBIA ESTADO A RECIBIDO, NO SUMA STOCK)
// Permitimos rol DEPOSITO aquí también
router.post(
  "/recibir",
  restrictTo("GERENCIA", "DEPOSITO", "PANEL"),
  async (req, res) => {
    const { codigo_remito } = req.body;
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const movRes = await client.query(
        "SELECT * FROM movimientos_logistica WHERE codigo_remito = $1 AND estado = 'EN_TRANSITO'",
        [codigo_remito]
      );
      if (movRes.rowCount === 0)
        throw new Error("Remito no válido o ya recibido");

      const destino = movRes.rows[0].destino;
      const origen = movRes.rows[0].origen;

      for (const mov of movRes.rows) {
        // --- COMENTADO: NO TOCAMOS EL STOCK ---
        // await client.query(`UPDATE semielaborados SET ${colDestino} = ${colDestino} + $1 WHERE id = $2`, [mov.cantidad, mov.semielaborado_id]);

        // SOLO ACTUALIZAMOS EL ESTADO DEL REMITO
        await client.query(
          "UPDATE movimientos_logistica SET estado = 'RECIBIDO', fecha_recepcion = NOW() WHERE id = $1",
          [mov.id]
        );
      }
      await client.query("COMMIT");
      res.json({
        success: true,
        msg: `Recibidos ${movRes.rowCount} items correctamente.`,
        origen,
        destino,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      res.status(400).json({ msg: e.message });
    } finally {
      client.release();
    }
  }
);

// EDICIÓN MANUAL (Esta sí la dejamos por si hay que corregir algo a mano desde la app)
router.put("/stock/:id", restrictTo("GERENCIA"), async (req, res) => {
  const { p26, p37, ayolas, quintana } = req.body;
  try {
    await db.query(
      "UPDATE semielaborados SET stock_planta_26=$1, stock_planta_37=$2, stock_deposito_ayolas=$3, stock_deposito_quintana=$4 WHERE id=$5",
      [
        Number(p26) || 0,
        Number(p37) || 0,
        Number(ayolas) || 0,
        Number(quintana) || 0,
        req.params.id,
      ]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 5. HERRAMIENTA: RESETEAR NEGATIVOS (Limpieza de Zombis)
router.post("/reset-negativos", restrictTo("GERENCIA"), async (req, res) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Pone a 0 cualquier columna que tenga valor negativo
    const query = `
            UPDATE semielaborados 
            SET 
                stock_planta_26 = GREATEST(0, stock_planta_26),
                stock_planta_37 = GREATEST(0, stock_planta_37),
                stock_deposito_ayolas = GREATEST(0, stock_deposito_ayolas),
                stock_deposito_quintana = GREATEST(0, stock_deposito_quintana)
            WHERE 
                stock_planta_26 < 0 OR 
                stock_planta_37 < 0 OR 
                stock_deposito_ayolas < 0 OR 
                stock_deposito_quintana < 0
        `;

    const result = await client.query(query);
    await client.query("COMMIT");

    res.json({
      success: true,
      msg: `Se corrigieron ${result.rowCount} productos con stock negativo.`,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ msg: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;

router.get("/historial", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT codigo_remito, origen, destino, chofer, estado, MIN(fecha_creacion) as fecha, COUNT(*) as total_items, SUM(cantidad) as total_unidades FROM movimientos_logistica GROUP BY codigo_remito, origen, destino, chofer, estado ORDER BY fecha DESC LIMIT 50"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

router.get("/despachos-automaticos", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM historial_despachos ORDER BY fecha_despacho DESC LIMIT 100"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

module.exports = router;
