const express = require("express");
const router = express.Router();
const db = require("../db");

// ==========================================
// --- MÓDULO MAESTRO: CO-WORKING KANBAN ---
// ==========================================

// 1. OBTENER TODO EL TABLERO (Proyectos con sus tareas y micro-tareas anidadas)
router.get("/proyectos", async (req, res) => {
  try {
    // Traemos proyectos activos
    const { rows: proyectos } = await db.query(
      "SELECT * FROM proyectos ORDER BY fecha_creacion DESC",
    );

    // Traemos tareas asociadas
    const { rows: tareas } = await db.query(
      "SELECT * FROM tareas_proyecto ORDER BY posicion ASC",
    );

    // Traemos micro-tareas individuales
    const { rows: microTareas } = await db.query(
      "SELECT * FROM micro_tareas ORDER BY fecha_creacion ASC",
    );

    // Estructuramos el JSON anidado para que al Frontend le sea ultra simple renderizar
    const tableroCompleto = proyectos.map((p) => {
      const tareasDelProyecto = tareas
        .filter((t) => t.proyecto_id === p.id)
        .map((t) => ({
          ...t,
          micro_tareas: microTareas.filter((m) => m.tarea_id === t.id),
        }));

      return {
        ...p,
        tareas: tareasDelProyecto,
      };
    });

    res.json(tableroCompleto);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener el tablero de proyectos");
  }
});

// 2. CREAR UN NUEVO PROYECTO
router.post("/proyectos", async (req, res) => {
  const { nombre, descripcion } = req.body;
  try {
    const { rows } = await db.query(
      "INSERT INTO proyectos (nombre, descripcion) VALUES ($1, $2) RETURNING *",
      [nombre, descripcion],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).send("Error al crear el proyecto");
  }
});

// 3. CREAR UNA TAREA MAYOR DENTRO DE UN PROYECTO
router.post("/tareas", async (req, res) => {
  const { proyecto_id, titulo, descripcion, estado } = req.body;
  try {
    // Calculamos posición máxima actual para ponerla al final de la columna
    const posRes = await db.query(
      "SELECT COALESCE(MAX(posicion), 0) + 1 as sig FROM tareas_proyecto WHERE proyecto_id = $1 AND estado = $2",
      [proyecto_id, estado || "PENDIENTE"],
    );
    const posicion = posRes.rows[0].sig;

    const { rows } = await db.query(
      "INSERT INTO tareas_proyecto (proyecto_id, titulo, descripcion, estado, posicion) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [proyecto_id, titulo, descripcion, estado || "PENDIENTE", posicion],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).send("Error al crear la tarea principal");
  }
});

// 4. ACTUALIZAR POSICION/ESTADO DE UNA TAREA (Esencial para el Drag and Drop)
router.put("/tareas/:id/posicion", async (req, res) => {
  const { id } = req.params;
  const { estado, posicion } = req.body;
  try {
    const { rows } = await db.query(
      "UPDATE tareas_proyecto SET estado = $1, posicion = $2 WHERE id = $3 RETURNING *",
      [estado, posicion, id],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).send("Error al mover la tarea");
  }
});

// 5. REGISTRAR MICRO-TAREA AL ARRASTRAR UNA PERSONA DENTRO DE OTRA TAREA
router.post("/tareas/:id/microtareas", async (req, res) => {
  const { id: tarea_id } = req.params;
  const { asignado_a, descripcion, creado_por } = req.body;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Insertamos la micro-tarea asignada
    const microRes = await client.query(
      "INSERT INTO micro_tareas (tarea_id, asignado_a, descripcion, creado_por) VALUES ($1, $2, $3, $4) RETURNING *",
      [tarea_id, asignado_a, descripcion, creado_por],
    );
    const nuevaMicroTarea = microRes.rows[0];

    // Buscamos el nombre de la tarea mayor para armar el mensaje de la notificación
    const tareaMayorRes = await client.query(
      "SELECT titulo FROM tareas_proyecto WHERE id = $1",
      [tarea_id],
    );
    const tituloTareaMayor = tareaMayorRes.rows[0]?.titulo || "una tarea";

    // 2. INYECCIÓN AUTOMÁTICA EN LA CAMPANITA DEL USUARIO ASIGNADO
    const mensajeNotificacion = `⚠️ ${creado_por} te asignó una micro-tarea: "${descripcion}" dentro de la tarea "${tituloTareaMayor}".`;
    await client.query(
      "INSERT INTO notificaciones_usuario (usuario, mensaje) VALUES ($1, $2)",
      [asignado_a, mensajeNotificacion],
    );

    await client.query("COMMIT");
    res.json(nuevaMicroTarea);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Error al asignar micro-tarea");
  } finally {
    client.release();
  }
});

// 6. TOGGLE DE COMPLETADO DE UNA MICRO-TAREA
router.put("/microtareas/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const { completado } = req.body;
  try {
    const { rows } = await db.query(
      "UPDATE micro_tareas SET completado = $1 WHERE id = $2 RETURNING *",
      [completado, id],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).send("Error al actualizar la micro-tarea");
  }
});

// ==========================================
// --- SISTEMA DE NOTIFICACIONES (CAMPANITA) ---
// ==========================================

// 7. OBTENER CANTIDAD DE NOTIFICACIONES SIN LEER (Para el cuadradito rojo con número)
router.get("/notificaciones/unread/count", async (req, res) => {
  const { usuario } = req.query;
  try {
    // A. Contamos alertas normales de la base de datos
    const { rows: normalCount } = await db.query(
      "SELECT COUNT(*) as unread_count FROM notificaciones_usuario WHERE usuario = $1 AND leido = FALSE",
      [usuario],
    );
    let count = parseInt(normalCount[0].unread_count) || 0;

    // B. 🔥 INTELIGENCIA INTEGRADA: Si es Gerencia (Andrés) o Expedición (Mauro), sumamos las solicitudes pendientes de ML
    if (usuario === "Andrés" || usuario === "Mauro") {
      const { rows: mlCount } = await db.query(
        "SELECT COUNT(*) as ml_pending FROM solicitudes_stock_ml WHERE estado = 'PENDIENTE' AND archivada = FALSE",
      );
      count += parseInt(mlCount[0].ml_pending) || 0;
    }

    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al contar notificaciones");
  }
});

// 8. OBTENER EL HISTORIAL DE NOTIFICACIONES DE UN USUARIO (Inyecta las rutas clickables)
router.get("/notificaciones", async (req, res) => {
  const { usuario } = req.query;
  try {
    // A. Traemos el historial tradicional de alertas
    const { rows: normalNotifs } = await db.query(
      "SELECT id, mensaje, leido, fecha_creacion FROM notificaciones_usuario WHERE usuario = $1 ORDER BY fecha_creacion DESC LIMIT 20",
      [usuario],
    );
    let result = normalNotifs.map((n) => ({ ...n, url: null }));

    // B. 🔥 INTEGRACIÓN DE ENLACES: Si es Andrés o Mauro, les inyectamos al principio las órdenes pendientes de MercadoLibre
    if (usuario === "Andrés" || usuario === "Mauro") {
      const { rows: mlNotifs } = await db.query(
        "SELECT id, articulo_nombre, cantidad_sugerida FROM solicitudes_stock_ml WHERE estado = 'PENDIENTE' AND archivada = FALSE ORDER BY fecha_creacion DESC",
      );

      const mlAlertas = mlNotifs.map((m) => ({
        id: `ml-${m.id}`,
        mensaje: `📦 [MERCADOLIBRE] Nueva solicitud de stock para: "${m.articulo_nombre}". Sugerido: ${m.cantidad_sugerida ? m.cantidad_sugerida + " u." : "No especificado"}.`,
        leido: false,
        fecha_creacion: new Date(),
        url: "/solicitudes-ml", // Al hacer click en el App.jsx, redireccionará de forma instantánea aquí
      }));

      result = [...mlAlertas, ...result];
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener notificaciones");
  }
});

// 9. MARCAR TODAS LAS NOTIFICACIONES COMO LEÍDAS (Al abrir la campanita)
router.put("/notificaciones/read-all", async (req, res) => {
  const { usuario } = req.body;
  try {
    // Solo cambia a leídas las notificaciones normales de UI. Las de MercadoLibre persisten hasta que se resuelvan (Aprobada/Rechazada)
    await db.query(
      "UPDATE notificaciones_usuario SET leido = TRUE WHERE usuario = $1",
      [usuario],
    );
    res.json({ message: "Notificaciones marcadas como leídas" });
  } catch (err) {
    res.status(500).send("Error al actualizar notificaciones");
  }
});

// 10. ELIMINAR ALERTAS MAESTRAS DE UI (Omite de forma natural a MercadoLibre)
router.delete("/notificaciones/clear-all", async (req, res) => {
  const { usuario } = req.body;
  try {
    // Borra permanentemente los logs del sistema del usuario sin tocar la tabla de MercadoLibre
    await db.query("DELETE FROM notificaciones_usuario WHERE usuario = $1", [
      usuario,
    ]);
    res.json({ message: "Buzón de alertas limpiado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al vaciar buzón de alertas");
  }
});

module.exports = router;
