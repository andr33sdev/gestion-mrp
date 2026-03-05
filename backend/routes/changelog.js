// backend/routes/changelog.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect } = require("../middleware/auth");

router.use(protect);

const ORDER_CLAUSE = "ORDER BY fecha::DATE DESC, id DESC";

router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM historial_cambios_producto ${ORDER_CLAUSE}`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/:producto", async (req, res) => {
  try {
    const { producto } = req.params;
    const { rows } = await db.query(
      `SELECT * FROM historial_cambios_producto WHERE producto = $1 ${ORDER_CLAUSE}`,
      [decodeURIComponent(producto)],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

router.get("/stats/:producto", async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.producto);
    const stockRes = await db.query(
      `SELECT (COALESCE(stock_planta_26,0) + COALESCE(stock_planta_37,0) + COALESCE(stock_deposito_ayolas,0) + COALESCE(stock_deposito_quintana,0)) as total FROM semielaborados WHERE TRIM(UPPER(nombre)) = TRIM(UPPER($1))`,
      [nombre],
    );
    const ventasRes = await db.query(
      `SELECT SUM(CASE WHEN REPLACE(cantidad, ',', '.') ~ '^[0-9]+(\.[0-9]+)?$' THEN CAST(REPLACE(cantidad, ',', '.') AS NUMERIC) ELSE 0 END) as total_vendido FROM pedidos_clientes WHERE TRIM(UPPER(modelo)) = TRIM(UPPER($1)) AND (CASE WHEN fecha ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(fecha, 'DD/MM/YYYY') WHEN fecha ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN to_date(fecha, 'YYYY-MM-DD') ELSE NULL END) >= (CURRENT_DATE - INTERVAL '6 months')`,
      [nombre],
    );
    const cambiosRes = await db.query(
      "SELECT COUNT(*) as cant FROM historial_cambios_producto WHERE producto = $1",
      [nombre],
    );
    res.json({
      stock: Number(stockRes.rows[0]?.total || 0),
      promedio: (Number(ventasRes.rows[0]?.total_vendido || 0) / 6).toFixed(1),
      totalCambios: Number(cambiosRes.rows[0]?.cant || 0),
    });
  } catch (e) {
    res.json({ stock: 0, promedio: 0, totalCambios: 0 });
  }
});

// NUEVO: Crear Nota
router.post("/", async (req, res) => {
  const { titulo, responsable, fecha_manual, items } = req.body;
  const fecha = fecha_manual || new Date();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    for (const item of items) {
      const descEmpaquetada = `[TITULO]${titulo || "Actualización de Ingeniería"}[/TITULO]\n${item.descripcion || ""}`;
      await client.query(
        `INSERT INTO historial_cambios_producto (producto, tipo_cambio, descripcion, responsable, fecha, adjuntos_url, lleva_reflectiva, tipo_reflectiva, tipo_protector, tipo_aplicacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.producto,
          item.tipo_cambio,
          descEmpaquetada,
          responsable,
          fecha,
          item.adjuntos_url || "",
          item.lleva_reflectiva || false,
          item.tipo_reflectiva || null,
          item.tipo_protector || null,
          item.tipo_aplicacion || null,
        ],
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send("Error al registrar cambios");
  } finally {
    client.release();
  }
});

// NUEVO: Editar Nota Existente
router.put("/grupo", async (req, res) => {
  const {
    ids_to_delete,
    items,
    titulo,
    responsable,
    fecha_original,
    editado_por,
  } = req.body;
  const fechaEdicion = new Date().toISOString();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    if (ids_to_delete && ids_to_delete.length > 0) {
      await client.query(
        "DELETE FROM historial_cambios_producto WHERE id = ANY($1::int[])",
        [ids_to_delete],
      );
    }
    for (const item of items) {
      const descEmpaquetada = `[TITULO]${titulo}[/TITULO][EDITADO]${editado_por}|${fechaEdicion}[/EDITADO]\n${item.descripcion || ""}`;
      await client.query(
        `INSERT INTO historial_cambios_producto (producto, tipo_cambio, descripcion, responsable, fecha, adjuntos_url, lleva_reflectiva, tipo_reflectiva, tipo_protector, tipo_aplicacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.producto,
          item.tipo_cambio,
          descEmpaquetada,
          responsable,
          fecha_original,
          item.adjuntos_url || "",
          item.lleva_reflectiva || false,
          item.tipo_reflectiva || null,
          item.tipo_protector || null,
          item.tipo_aplicacion || null,
        ],
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM historial_cambios_producto WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).send("Error al eliminar");
  }
});

module.exports = router;
