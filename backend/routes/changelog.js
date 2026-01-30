// backend/routes/changelog.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect } = require("../middleware/auth");
const { enviarNotificacionCambio } = require("../services/emailService");

router.use(protect);

// --- CONSULTA COMÚN PARA EL ORDENAMIENTO ---
// Ordenamos por FECHA (solo día) Descendente, y luego por ID Descendente.
// Así, si cargas algo con fecha manual hoy (00:00hs) y algo automático hoy (15:00hs),
// el que cargaste ÚLTIMO (mayor ID) quedará arriba, que es lo correcto.
const ORDER_CLAUSE = "ORDER BY fecha::DATE DESC, id DESC";

// 1. Obtener Historial Completo
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

// 2. Obtener Historial de UN producto
router.get("/:producto", async (req, res) => {
  try {
    const { producto } = req.params;
    const nombreDecodificado = decodeURIComponent(producto);
    const { rows } = await db.query(
      `SELECT * FROM historial_cambios_producto WHERE producto = $1 ${ORDER_CLAUSE}`,
      [nombreDecodificado],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 3. ESTADÍSTICAS DEL PRODUCTO
router.get("/stats/:producto", async (req, res) => {
  try {
    const { producto } = req.params;
    const nombre = decodeURIComponent(producto);

    // A. Stock Actual
    const stockRes = await db.query(
      `
      SELECT 
        (COALESCE(stock_planta_26,0) + COALESCE(stock_planta_37,0) + COALESCE(stock_deposito_ayolas,0) + COALESCE(stock_deposito_quintana,0)) as total
      FROM semielaborados 
      WHERE TRIM(UPPER(nombre)) = TRIM(UPPER($1))
    `,
      [nombre],
    );

    // B. Ventas Últimos 6 Meses
    const ventasRes = await db.query(
      `
      SELECT SUM(
        CASE 
            WHEN REPLACE(cantidad, ',', '.') ~ '^[0-9]+(\.[0-9]+)?$' 
            THEN CAST(REPLACE(cantidad, ',', '.') AS NUMERIC)
            ELSE 0 
        END
      ) as total_vendido
      FROM pedidos_clientes
      WHERE TRIM(UPPER(modelo)) = TRIM(UPPER($1))
      AND (
        CASE 
            WHEN fecha ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(fecha, 'DD/MM/YYYY')
            WHEN fecha ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN to_date(fecha, 'YYYY-MM-DD')
            ELSE NULL 
        END
      ) >= (CURRENT_DATE - INTERVAL '6 months')
    `,
      [nombre],
    );

    // C. Conteo de Cambios
    const cambiosRes = await db.query(
      "SELECT COUNT(*) as cant FROM historial_cambios_producto WHERE producto = $1",
      [nombre],
    );

    const stock = Number(stockRes.rows[0]?.total || 0);
    const totalVendido = Number(ventasRes.rows[0]?.total_vendido || 0);
    const promedio = (totalVendido / 6).toFixed(1);
    const totalCambios = Number(cambiosRes.rows[0]?.cant || 0);

    res.json({ stock, promedio, totalCambios });
  } catch (e) {
    console.error("Error stats changelog:", e);
    res.json({ stock: 0, promedio: 0, totalCambios: 0 });
  }
});

// 4. Registrar Cambio
router.post("/", async (req, res) => {
  const {
    producto, // Puede ser un string O un array de strings ["Prod A", "Prod B"]
    tipo_cambio,
    descripcion,
    responsable,
    emails_notificacion,
    fecha_manual,
    adjuntos_url,
    lleva_reflectiva,
    tipo_reflectiva,
    tipo_protector,
    tipo_aplicacion,
  } = req.body;

  const fecha = fecha_manual || new Date();
  const client = await db.connect(); // Usamos cliente para transacción

  try {
    await client.query("BEGIN");

    // Normalizamos: si viene un string, lo convertimos en array
    const listaProductos = Array.isArray(producto) ? producto : [producto];
    const resultados = [];

    for (const prodNombre of listaProductos) {
      const result = await client.query(
        `INSERT INTO historial_cambios_producto 
         (producto, tipo_cambio, descripcion, responsable, notificado_a, fecha, adjuntos_url, lleva_reflectiva, tipo_reflectiva, tipo_protector, tipo_aplicacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          prodNombre,
          tipo_cambio,
          descripcion,
          responsable,
          emails_notificacion,
          fecha,
          adjuntos_url || "",
          lleva_reflectiva || false,
          tipo_reflectiva || null,
          tipo_protector || null,
          tipo_aplicacion || null,
        ],
      );
      resultados.push(result.rows[0]);

      // Enviar notificación individual (opcional: podrías agruparlas si prefieres)
      if (emails_notificacion && emails_notificacion.length > 5) {
        await enviarNotificacionCambio({
          producto: prodNombre,
          tipo: tipo_cambio,
          descripcion,
          responsable,
          fecha,
          destinatarios: emails_notificacion,
        });
      }
    }

    await client.query("COMMIT");
    res.json({ success: true, data: resultados, count: resultados.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Error al registrar cambio(s)");
  } finally {
    client.release();
  }
});

// 5. Eliminar un cambio (NUEVO)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM historial_cambios_producto WHERE id = $1", [
      id,
    ]);
    res.json({ success: true, message: "Registro eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al eliminar");
  }
});

module.exports = router;
