// backend/routes/mantenimiento.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// Importamos Firebase Admin (asegurate de tenerlo inicializado en tu index.js o archivo principal)
const admin = require("firebase-admin");

router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM tickets_mantenimiento ORDER BY id DESC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- EL GATILLO DE CREACIÓN DE TICKETS Y ALERTAS PUSH ---
router.post("/", async (req, res) => {
  const {
    maquina,
    titulo,
    descripcion,
    prioridad,
    tipo,
    creado_por,
    asignado_a,
  } = req.body;

  try {
    // 1. Guardamos el ticket en la base de datos
    const result = await db.query(
      `INSERT INTO tickets_mantenimiento (maquina, titulo, descripcion, estado, prioridad, tipo, creado_por, asignado_a, fecha_creacion, alerta_24h_enviada) 
       VALUES ($1, $2, $3, 'PENDIENTE', $4, $5, $6, $7, CURRENT_TIMESTAMP, false) RETURNING *`,
      [
        maquina,
        titulo || "Falla",
        descripcion,
        prioridad || "MEDIA",
        tipo || "CORRECTIVO",
        creado_por,
        asignado_a || "Técnico de Turno",
      ],
    );

    const nuevoTicket = result.rows[0];

    // 2. DISPARAMOS LAS NOTIFICACIONES PUSH (FIREBASE)
    // Usamos un try/catch interno para que si falla Google, el ticket se cree igual en la BD
    try {
      // Buscamos los tokens de los roles que deben enterarse
      const { rows: usuariosPush } = await db.query(
        "SELECT fcm_token FROM usuarios WHERE rol IN ('MANTENIMIENTO', 'JEFE MANTENIMIENTO', 'GERENCIA', 'JEFE PRODUCCIÓN') AND fcm_token IS NOT NULL AND fcm_token != ''",
      );

      // Extraemos solo los strings de los tokens
      const tokens = usuariosPush.map((u) => u.fcm_token);

      if (tokens.length > 0) {
        // Armamos el mensaje de alerta
        const mensajePush = {
          notification: {
            title: `🚨 Falla en ${nuevoTicket.maquina}`,
            body: `[Prioridad ${nuevoTicket.prioridad}] - ${nuevoTicket.titulo}`,
          },
          data: {
            // Mandamos data oculta por si el día de mañana querés que al tocar la app abra este ticket
            ruta: "/mantenimiento",
            ticketId: String(nuevoTicket.id),
          },
          tokens: tokens, // Array de todos los celulares destino
        };

        // Disparamos a todos al mismo tiempo
        const pushResponse = await admin
          .messaging()
          .sendEachForMulticast(mensajePush);
        console.log(
          `✅ Alerta Push de Mantenimiento enviada. Éxito: ${pushResponse.successCount}, Fallos: ${pushResponse.failureCount}`,
        );
      } else {
        console.log(
          "ℹ️ Nuevo ticket creado, pero no hay celulares con sesión activa para recibir la alerta.",
        );
      }
    } catch (pushErr) {
      console.error("❌ Falló el envío de la alerta Push:", pushErr);
    }

    // Devolvemos el ticket creado a React
    res.status(201).json(nuevoTicket);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.put("/:id/estado", async (req, res) => {
  const {
    estado,
    resuelto_por,
    fecha_inicio_revision,
    fecha_solucion,
    notas_revision,
    solucion_notas,
  } = req.body;

  try {
    let query =
      "UPDATE tickets_mantenimiento SET estado = $1, resuelto_por = $2";
    let params = [estado, resuelto_por];
    let counter = 3;

    if (fecha_inicio_revision !== undefined) {
      query += `, fecha_inicio_revision = $${counter}`;
      params.push(fecha_inicio_revision);
      counter++;
    }
    if (fecha_solucion !== undefined) {
      query += `, fecha_solucion = $${counter}`;
      params.push(fecha_solucion);
      counter++;
    }
    if (notas_revision !== undefined) {
      query += `, notas_revision = $${counter}`;
      params.push(notas_revision);
      counter++;
    }
    if (solucion_notas !== undefined) {
      query += `, solucion_notas = $${counter}`;
      params.push(solucion_notas);
      counter++;
    }

    query += ` WHERE id = $${counter}`;
    params.push(req.params.id);

    await db.query(query, params);
    res.json({ success: true, msg: "Estado actualizado" });
  } catch (err) {
    console.error("Error al actualizar ticket:", err);
    res.status(500).send(err.message);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM tickets_mantenimiento WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true, msg: "Ticket eliminado" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- RUTAS PARA EL PERFIL DE MÁQUINA ---
router.get("/maquina/:nombre", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT notas FROM maquinas_perfil WHERE maquina = $1",
      [req.params.nombre],
    );
    res.json({ notas: rows.length ? rows[0].notas : "" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.put("/maquina/:nombre", async (req, res) => {
  try {
    const { notas } = req.body;
    await db.query(
      `INSERT INTO maquinas_perfil (maquina, notas) VALUES ($1, $2)
       ON CONFLICT (maquina) DO UPDATE SET notas = EXCLUDED.notas`,
      [req.params.nombre, notas],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
