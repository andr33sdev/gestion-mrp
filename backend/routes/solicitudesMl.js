const express = require("express");
const router = express.Router();
const db = require("../db");
const webpush = require("web-push"); // 🔥 NUEVO: Importar librería push

// 🔥 CONFIGURACIÓN DE LLAVES VAPID (Reemplaza con tus llaves reales o usa variables de entorno)
// Puedes generarlas una vez en la consola con: npx web-push generate-vapid-keys
const publicVapidKey =
  process.env.PUBLIC_VAPID_KEY || "BACda5YCAJNetpy6KCdj6n4ghujb0C4Nk4mCytZsHZndZkUWN6Zf4fjR6awrUPoNEK_Irw0-_v8lKCKU6i28QaQ";
const privateVapidKey =
  process.env.PRIVATE_VAPID_KEY || "KmlCjlspTc7AUuvnTHEvEPShDlmXnfzC5eo_FZiEvlE";

webpush.setVapidDetails(
  "mailto:produccion.a@conoflex.com.ar",
  publicVapidKey,
  privateVapidKey,
);

// NUEVO ENDPOINT: Registrar suscripción push del celular de un usuario
router.post("/suscribir", async (req, res) => {
  const { suscripcion, usuario } = req.body;
  try {
    // Evitar duplicados del mismo dispositivo/usuario
    await db.query(
      "DELETE FROM web_push_suscripciones WHERE suscripcion_json = $1",
      [JSON.stringify(suscripcion)],
    );

    await db.query(
      "INSERT INTO web_push_suscripciones (usuario, suscripcion_json) VALUES ($1, $2)",
      [usuario || "Anónimo", JSON.stringify(suscripcion)],
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al registrar dispositivo");
  }
});

// 1. OBTENER TODAS LAS SOLICITUDES (Filtradas por estado de archivado)
router.get("/", async (req, res) => {
  const { archivada } = req.query;
  try {
    const { rows } = await db.query(
      "SELECT * FROM solicitudes_stock_ml WHERE archivada = $1 ORDER BY fecha_actualizacion DESC",
      [archivada === "true"],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener solicitudes de stock");
  }
});

// 2. OBTENER PRODUCTOS ÚNICOS VENDIDOS POR MERCADOLIBRE (Para el auto-completado instantáneo)
router.get("/productos-ml", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT DISTINCT modelo 
      FROM pedidos_clientes 
      WHERE detalles ILIKE '%MercadoLibre%' OR cliente ILIKE '%MercadoLibre%'
      ORDER BY modelo ASC
    `);
    res.json(rows.map((r) => r.modelo));
  } catch (err) {
    res.status(500).send("Error al obtener catálogo de MercadoLibre");
  }
});

// 3. CREAR NUEVA SOLICITUD (Exclusivo Sector MercadoLibre)
router.post("/", async (req, res) => {
  const { articulo_nombre, cantidad_actual, cantidad_sugerida, solicitante } =
    req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const resSol = await client.query(
      "INSERT INTO solicitudes_stock_ml (articulo_nombre, cantidad_actual, cantidad_sugerida, solicitante) VALUES ($1, $2, $3, $4) RETURNING *",
      [
        articulo_nombre,
        cantidad_actual,
        cantidad_sugerida || null,
        solicitante,
      ],
    );
    const nuevaSol = resSol.rows[0];

    await client.query(
      "INSERT INTO historial_solicitudes_ml (solicitud_id, usuario, cambio) VALUES ($1, $2, $3)",
      [
        nuevaSol.id,
        solicitante,
        `Solicitud iniciada. Stock actual: ${cantidad_actual}. Sugerido: ${cantidad_sugerida || "Ninguno"}`,
      ],
    );

    await client.query("COMMIT");

    // 🔥 NUEVO: Enviar Notificación Push Web en segundo plano a todos los celulares registrados
    try {
      const subsRes = await db.query("SELECT * FROM web_push_suscripciones");
      const payload = JSON.stringify({
        title: "📦 MercadoLibre: Solicitud Stock",
        body: `${solicitante} solicita subir stock de ${articulo_nombre} (Sugiere: ${cantidad_sugerida || "N/A"})`,
      });

      subsRes.rows.forEach((sub) => {
        webpush.sendNotification(sub.suscripcion_json, payload).catch((err) => {
          // Si el token del celular caducó (status 410 o 404), lo removemos automáticamente para limpiar la base de datos
          if (err.statusCode === 410 || err.statusCode === 404) {
            db.query("DELETE FROM web_push_suscripciones WHERE id = $1", [
              sub.id,
            ]).catch(() => {});
          }
        });
      });
    } catch (pushErr) {
      console.error("Error al procesar disparador push:", pushErr);
    }

    res.json(nuevaSol);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send("Error al registrar solicitud");
  } finally {
    client.release();
  }
});

// 4. ATENDER SOLICITUD (Aprobar/Rechazar - Exclusivo Expedición / Gerencia)
router.put("/:id/atender", async (req, res) => {
  const { id } = req.params;
  const { estado, cantidad_aprobada, aprobador } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE solicitudes_stock_ml SET estado = $1, cantidad_aprobada = $2, aprobador = $3, fecha_actualizacion = NOW() WHERE id = $4",
      [estado, cantidad_aprobada || null, aprobador, id],
    );

    const detalleCambio =
      estado === "APROBADA"
        ? `Solicitud APROBADA con cantidad: ${cantidad_aprobada} u.`
        : `Solicitud RECHAZADA. No se incrementará el stock.`;

    await client.query(
      "INSERT INTO historial_solicitudes_ml (solicitud_id, usuario, cambio) VALUES ($1, $2, $3)",
      [id, aprobador, detalleCambio],
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send("Error al procesar dictamen");
  } finally {
    client.release();
  }
});

// 5. EDITAR CANTIDAD SUGERIDA (Exclusivo Sector MercadoLibre - Solo si está PENDIENTE)
router.put("/:id/editar", async (req, res) => {
  const { id } = req.params;
  const { cantidad_sugerida, usuario } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const prevRes = await client.query(
      "SELECT cantidad_sugerida, estado FROM solicitudes_stock_ml WHERE id = $1",
      [id],
    );
    if (prevRes.rows[0]?.estado !== "PENDIENTE") {
      return res
        .status(400)
        .send("No se puede editar una solicitud ya procesada");
    }

    await client.query(
      "UPDATE solicitudes_stock_ml SET cantidad_sugerida = $1, fecha_actualizacion = NOW() WHERE id = $2",
      [cantidad_sugerida || null, id],
    );

    await client.query(
      "INSERT INTO historial_solicitudes_ml (solicitud_id, usuario, cambio) VALUES ($1, $2, $3)",
      [
        id,
        usuario,
        `Se modificó la cantidad sugerida de ${prevRes.rows[0].cantidad_sugerida || "Ninguna"} a ${cantidad_sugerida || "Ninguna"}`,
      ],
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send("Error al editar");
  } finally {
    client.release();
  }
});

// 6. ARCHIVAR SOLICITUD (Exclusivo Sector MercadoLibre)
router.put("/:id/archivar", async (req, res) => {
  const { id } = req.params;
  const { usuario } = req.body;
  try {
    await db.query(
      "UPDATE solicitudes_stock_ml SET archivada = TRUE, fecha_actualizacion = NOW() WHERE id = $1",
      [id],
    );
    await db.query(
      "INSERT INTO historial_solicitudes_ml (solicitud_id, usuario, cambio) VALUES ($1, $2, 'Solicitud movida al archivo de MercadoLibre')",
      [id, usuario],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).send("Error al archivar");
  }
});

// 7. OBTENER HISTORIAL / AUDITORÍA DE UNA SOLICITUD
router.get("/:id/historial", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM historial_solicitudes_ml WHERE solicitud_id = $1 ORDER BY fecha ASC",
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send("Error al traer auditoría");
  }
});

module.exports = router;
