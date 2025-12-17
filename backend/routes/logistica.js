const express = require("express");
const router = express.Router();
const db = require("../db");

// --- CORRECCIÓN CLAVE AQUÍ ---
// Importamos la función NUEVA desde el archivo "listener" (donde están todos los bots)
const {
  enviarNotificacionLogistica,
} = require("../services/telegramBotListener");

// 1. OBTENER TODAS
router.get("/", async (req, res) => {
  try {
    const query = `
      SELECT * FROM solicitudes_logistica
      ORDER BY
        CASE 
          WHEN estado = 'PENDIENTE' AND prioridad = 'ALTA' THEN 1
          WHEN estado = 'PENDIENTE' AND prioridad = 'MEDIA' THEN 2
          WHEN estado = 'PENDIENTE' AND prioridad = 'BAJA' THEN 3
          WHEN estado = 'APROBADO' THEN 4
          WHEN estado = 'PREPARADO' THEN 5
          ELSE 6
        END ASC,
        fecha_creacion DESC
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).send("Error al obtener solicitudes");
  }
});

// 2. OBTENER HISTORIAL
router.get("/:id/historial", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM historial_logistica WHERE solicitud_id = $1 ORDER BY fecha ASC",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send("Error al obtener historial");
  }
});

// 3. OBTENER COMENTARIOS
router.get("/:id/comentarios", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM comentarios_logistica WHERE solicitud_id = $1 ORDER BY fecha ASC",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send("Error al obtener comentarios");
  }
});

// 4. CREAR SOLICITUD (Conexión al Bot)
router.post("/", async (req, res) => {
  const { producto, cantidad, prioridad, solicitante, notas } = req.body;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Insertar
    const resSol = await client.query(
      "INSERT INTO solicitudes_logistica (producto, cantidad, prioridad, solicitante, notas) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [producto, cantidad, prioridad || "MEDIA", solicitante, notas]
    );
    const nuevaSol = resSol.rows[0];

    // Historial
    await client.query(
      "INSERT INTO historial_logistica (solicitud_id, accion, usuario, detalle) VALUES ($1, $2, $3, $4)",
      [
        nuevaSol.id,
        "CREADO",
        solicitante,
        `Solicitud iniciada. Prioridad: ${prioridad}. Cant: ${cantidad}`,
      ]
    );

    await client.query("COMMIT");

    // 🔥 LLAMADA AL BOT CORREGIDA
    enviarNotificacionLogistica("NUEVA_SOLICITUD", nuevaSol);

    res.json(nuevaSol);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Error al crear");
  } finally {
    client.release();
  }
});

// 5. CAMBIAR ESTADO (Conexión al Bot)
router.put("/:id/estado", async (req, res) => {
  const { id } = req.params;
  const { estado, usuario } = req.body;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Datos previos para el bot
    const prevRes = await client.query(
      "SELECT producto, estado FROM solicitudes_logistica WHERE id = $1",
      [id]
    );
    const datosPrevios = prevRes.rows[0];
    const prevEstado = datosPrevios?.estado || "DESC";

    // Actualizar
    const result = await client.query(
      "UPDATE solicitudes_logistica SET estado = $1, fecha_actualizacion = NOW() WHERE id = $2 RETURNING *",
      [estado, id]
    );

    // Historial
    await client.query(
      "INSERT INTO historial_logistica (solicitud_id, accion, usuario, detalle) VALUES ($1, $2, $3, $4)",
      [
        id,
        estado,
        usuario || "Sistema",
        `Estado cambió de ${prevEstado} a ${estado}`,
      ]
    );

    await client.query("COMMIT");

    // 🔥 LLAMADA AL BOT CORREGIDA
    enviarNotificacionLogistica("CAMBIO_ESTADO", {
      id,
      producto: datosPrevios.producto,
      estado,
      usuario,
    });

    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send("Error al actualizar");
  } finally {
    client.release();
  }
});

// 6. AGREGAR COMENTARIO (Conexión al Bot)
router.post("/:id/comentarios", async (req, res) => {
  const { id } = req.params;
  const { usuario, mensaje } = req.body;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const prodRes = await client.query(
      "SELECT producto FROM solicitudes_logistica WHERE id = $1",
      [id]
    );
    const nombreProducto = prodRes.rows[0]?.producto || "Producto";

    // Insertar Comentario
    const resCom = await client.query(
      "INSERT INTO comentarios_logistica (solicitud_id, usuario, mensaje) VALUES ($1, $2, $3) RETURNING *",
      [id, usuario, mensaje]
    );

    // Historial
    await client.query(
      "INSERT INTO historial_logistica (solicitud_id, accion, usuario, detalle) VALUES ($1, 'COMENTARIO', $2, $3)",
      [id, usuario, `Comentario: "${mensaje.substring(0, 50)}..."`]
    );

    await client.query("COMMIT");

    // 🔥 LLAMADA AL BOT CORREGIDA
    enviarNotificacionLogistica("NUEVO_COMENTARIO", {
      id,
      producto: nombreProducto,
      usuario,
      mensaje,
    });

    res.json(resCom.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Error al comentar");
  } finally {
    client.release();
  }
});

// 7. ELIMINAR (Conexión al Bot)
router.delete("/:id", async (req, res) => {
  const { usuario } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const prodRes = await client.query(
      "SELECT producto FROM solicitudes_logistica WHERE id = $1",
      [req.params.id]
    );
    const nombreProducto = prodRes.rows[0]?.producto || "Producto";

    await client.query(
      "UPDATE solicitudes_logistica SET estado = 'ELIMINADO', fecha_actualizacion = NOW() WHERE id = $1",
      [req.params.id]
    );

    await client.query(
      "INSERT INTO historial_logistica (solicitud_id, accion, usuario, detalle) VALUES ($1, 'ELIMINADO', $2, 'Solicitud movida a papelera')",
      [req.params.id, usuario || "Admin"]
    );

    await client.query("COMMIT");

    // 🔥 LLAMADA AL BOT CORREGIDA
    enviarNotificacionLogistica("CAMBIO_ESTADO", {
      id: req.params.id,
      producto: nombreProducto,
      estado: "ELIMINADO",
      usuario,
    });

    res.json({ message: "Eliminado lógicamente" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send("Error al eliminar");
  } finally {
    client.release();
  }
});

module.exports = router;
