const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect, restrictTo } = require("../middleware/auth");
const { notificarDespacho } = require("../services/telegramBotListener");

router.use(protect);

// ... (Mantener rutas /stock, /enviar, /recibir, etc. IGUALES) ...
// Solo asegúrate de que estas rutas anteriores sigan ahí.
// Voy a escribir el archivo completo para evitar confusiones, manteniendo lo anterior.

router.get("/stock", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await db.query(
      `SELECT id, codigo, nombre, 
             stock_planta_26, stock_planta_37, stock_deposito_ayolas, stock_deposito_quintana 
             FROM semielaborados ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/historial", async (req, res) => {
  try {
    const { rows } = await db.query(`
            SELECT 
                ml.codigo_remito, ml.origen, ml.destino, ml.chofer, ml.estado, 
                to_char(MIN(ml.fecha_creacion) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI:SS') as fecha_salida_arg,
                to_char(MAX(ml.fecha_recepcion) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI:SS') as fecha_recepcion_arg,
                COUNT(*) as total_items, SUM(ml.cantidad) as total_unidades,
                json_agg(json_build_object('nombre', s.nombre, 'codigo', s.codigo, 'cantidad', ml.cantidad)) as items_detalle
            FROM movimientos_logistica ml
            JOIN semielaborados s ON ml.semielaborado_id = s.id
            GROUP BY ml.codigo_remito, ml.origen, ml.destino, ml.chofer, ml.estado 
            ORDER BY MIN(ml.fecha_creacion) DESC LIMIT 50
        `);
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

router.post("/enviar", async (req, res) => {
  const { items, origen, destino, chofer } = req.body;
  const codigo_remito = `REM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      await client.query(
        "INSERT INTO movimientos_logistica (semielaborado_id, cantidad, origen, destino, estado, codigo_remito, chofer) VALUES ($1, $2, $3, $4, 'EN_TRANSITO', $5, $6)",
        [item.id, item.cantidad, origen, destino, codigo_remito, chofer]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, codigo_remito });
    notificarDespacho({
      codigo: codigo_remito,
      origen,
      destino,
      chofer,
      items,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally {
    client.release();
  }
});

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

router.post("/reset-negativos", restrictTo("GERENCIA"), async (req, res) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE semielaborados SET stock_planta_26 = GREATEST(0, stock_planta_26), stock_planta_37 = GREATEST(0, stock_planta_37), stock_deposito_ayolas = GREATEST(0, stock_deposito_ayolas), stock_deposito_quintana = GREATEST(0, stock_deposito_quintana) WHERE stock_planta_26 < 0 OR stock_planta_37 < 0 OR stock_deposito_ayolas < 0 OR stock_deposito_quintana < 0`
    );
    await client.query("COMMIT");
    res.json({ success: true, msg: "Stocks negativos corregidos." });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ msg: e.message });
  } finally {
    client.release();
  }
});

router.post("/reset-total-db", restrictTo("GERENCIA"), async (req, res) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE semielaborados SET stock_planta_26 = 0, stock_planta_37 = 0, stock_deposito_ayolas = 0, stock_deposito_quintana = 0`
    );
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ msg: e.message });
  } finally {
    client.release();
  }
});

router.post("/solicitud", async (req, res) => {
  const { items, destino } = req.body;
  if (!items || items.length === 0 || !destino)
    return res.status(400).json({ msg: "Faltan datos." });
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      await client.query(
        "INSERT INTO solicitudes_reposicion (semielaborado_id, cantidad, destino) VALUES ($1, $2, $3)",
        [item.id, item.cantidad, destino]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ msg: e.message });
  } finally {
    client.release();
  }
});

router.get("/solicitudes/pendientes", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT sr.*, s.nombre, s.codigo FROM solicitudes_reposicion sr JOIN semielaborados s ON sr.semielaborado_id = s.id WHERE sr.estado = 'PENDIENTE' ORDER BY sr.fecha_creacion DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
});

router.post(
  "/solicitudes/despachar",
  restrictTo("GERENCIA"),
  async (req, res) => {
    const { ids, origen, chofer } = req.body;
    if (!ids || ids.length === 0)
      return res.status(400).json({ msg: "Nada seleccionado" });
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const codigo_remito = `REM-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`;
      const itemsParaTelegram = [];
      for (const id of ids) {
        const solRes = await client.query(
          `SELECT sr.*, s.nombre FROM solicitudes_reposicion sr JOIN semielaborados s ON sr.semielaborado_id = s.id WHERE sr.id = $1`,
          [id]
        );
        if (solRes.rowCount === 0) continue;
        const solicitud = solRes.rows[0];
        itemsParaTelegram.push({
          nombre: solicitud.nombre,
          cantidad: solicitud.cantidad,
        });
        await client.query(
          "INSERT INTO movimientos_logistica (semielaborado_id, cantidad, origen, destino, estado, codigo_remito, chofer) VALUES ($1, $2, $3, $4, 'EN_TRANSITO', $5, $6)",
          [
            solicitud.semielaborado_id,
            solicitud.cantidad,
            origen,
            solicitud.destino,
            codigo_remito,
            chofer,
          ]
        );
        await client.query(
          "UPDATE solicitudes_reposicion SET estado = 'DESPACHADO', fecha_despacho = NOW() WHERE id = $1",
          [id]
        );
      }
      await client.query("COMMIT");
      res.json({ success: true, codigo_remito });
      if (itemsParaTelegram.length > 0)
        notificarDespacho({
          codigo: codigo_remito,
          origen,
          destino: "Varios/Lote",
          chofer,
          items: itemsParaTelegram,
        });
    } catch (e) {
      await client.query("ROLLBACK");
      res.status(500).json({ msg: e.message });
    } finally {
      client.release();
    }
  }
);

router.delete("/solicitud/:id", async (req, res) => {
  try {
    await db.query(
      "UPDATE solicitudes_reposicion SET estado = 'CANCELADO' WHERE id = $1",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
});

// --- HOJA DE RUTA Y PEDIDOS (LO NUEVO) ---

// 7. OBTENER CALENDARIO (Sin cambios, ya estaba)
router.get("/hoja-de-ruta", async (req, res) => {
  try {
    const { rows } = await db.query(`
            SELECT id, cliente, razon_social, fecha_nueva, mensaje_original, fecha_registro
            FROM novedades_pedidos
            ORDER BY fecha_nueva DESC
        `);
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 8. OBTENER PEDIDOS DE UN CLIENTE (PARA HOJA DE RUTA)
// Busca pedidos del cliente que NO tengan fecha de despacho (pendientes)
router.get("/hoja-de-ruta/pedidos/:cliente", async (req, res) => {
  const { cliente } = req.params;
  const clienteDecodificado = decodeURIComponent(cliente);

  try {
    // Buscamos pedidos donde el nombre del cliente sea similar
    // Y que NO tengan fecha de despacho (significa que están pendientes/en ruta)
    const { rows } = await db.query(
      `
            SELECT * FROM pedidos 
            WHERE 
                UPPER(cliente) LIKE UPPER($1)
                AND fecha_despacho IS NULL 
            ORDER BY fecha DESC
            LIMIT 20
        `,
      [`%${clienteDecodificado}%`]
    );

    res.json(rows);
  } catch (e) {
    console.error("Error buscando pedidos cliente:", e);
    res.status(500).send(e.message);
  }
});

module.exports = router;
