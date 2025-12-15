const express = require("express");
const router = express.Router();
const db = require("../db");
// 1. Importamos los middlewares
const { protect, restrictTo } = require("../middleware/auth");

// 2. Protección básica: Todo usuario logueado (Operario o Gerencia) puede usar estas rutas
router.use(protect);

// --- RUTAS OPERATIVAS (ACCESIBLES POR OPERARIO Y GERENCIA) ---

// Ver estado actual del horno
router.get("/", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM estado_produccion");
  const estado = rows.reduce((acc, row) => {
    acc[row.estacion_id] = JSON.parse(row.producto_actual || "[]");
    return acc;
  }, {});
  res.json(estado);
});

// Cargar producto al horno (Panel de Control)
router.post("/", async (req, res) => {
  const { estacion_id, producto } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT producto_actual FROM estado_produccion WHERE estacion_id = $1 FOR UPDATE",
      [estacion_id]
    );
    let list = JSON.parse(rows[0]?.producto_actual || "[]");
    list.push(producto);
    await client.query(
      "UPDATE estado_produccion SET producto_actual = $1 WHERE estacion_id = $2",
      [JSON.stringify(list), estacion_id]
    );
    await client.query("COMMIT");
    res.json(list);
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally {
    client.release();
  }
});

// Vaciar estación (Panel de Control)
// Permitimos que el operario vacíe la estación para seguir trabajando
router.delete("/:estacion_id", async (req, res) => {
  await db.query(
    "UPDATE estado_produccion SET producto_actual = '[]' WHERE estacion_id = $1",
    [req.params.estacion_id]
  );
  res.json({ msg: "Limpiado" });
});

// REGISTRAR PRODUCCION A PLAN (La ruta que te fallaba)
// Ahora está abierta para Operarios también
router.post("/registrar-a-plan", async (req, res) => {
  const {
    plan_id,
    semielaborado_id,
    cantidad_ok,
    cantidad_scrap,
    operario_id,
    motivo_scrap,
    turno,
    fecha_produccion,
  } = req.body;
  const ok = Number(cantidad_ok) || 0;
  const scrap = Number(cantidad_scrap) || 0;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Validar que el ítem pertenezca al plan
    const itemRes = await client.query(
      "SELECT id, (SELECT nombre FROM planes_produccion WHERE id=$1) as plan_nombre FROM planes_items WHERE plan_id=$1 AND semielaborado_id=$2",
      [plan_id, semielaborado_id]
    );
    if (itemRes.rowCount === 0)
      return res.status(404).json({ msg: "Ítem no encontrado en plan" });

    const plan_item_id = itemRes.rows[0].id;
    const prodDate = fecha_produccion
      ? `${fecha_produccion} 12:00:00`
      : "NOW()";

    // Actualizar acumulado en el plan
    const upRes = await client.query(
      "UPDATE planes_items SET cantidad_producida = cantidad_producida + $1 WHERE id=$2 RETURNING cantidad_producida",
      [ok, plan_item_id]
    );

    // Insertar registro detallado
    await client.query(
      `INSERT INTO registros_produccion (plan_item_id, semielaborado_id, operario_id, cantidad_ok, cantidad_scrap, motivo_scrap, turno, fecha_produccion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        plan_item_id,
        semielaborado_id,
        operario_id,
        ok,
        scrap,
        motivo_scrap || "",
        turno,
        prodDate,
      ]
    );

    await client.query("COMMIT");
    res.json({
      success: true,
      msg: "Registrado correctamente",
      nuevo_total: upRes.rows[0].cantidad_producida,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ msg: e.message });
  } finally {
    client.release();
  }
});

// --- RUTAS RESTRINGIDAS (SOLO GERENCIA) ---

// Borrar un registro histórico específico (Auditoría)
// Esto sí lo protegemos para que un operario no pueda "borrar sus errores" sin supervisión
router.delete("/registro/:id", restrictTo("GERENCIA"), async (req, res) => {
  const { id } = req.params;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const regRes = await client.query(
      "SELECT * FROM registros_produccion WHERE id=$1",
      [id]
    );
    if (regRes.rowCount === 0)
      return res.status(404).json({ msg: "No existe" });

    const reg = regRes.rows[0];
    if (reg.plan_item_id) {
      await client.query(
        "UPDATE planes_items SET cantidad_producida = cantidad_producida - $1 WHERE id=$2",
        [reg.cantidad_ok, reg.plan_item_id]
      );
    }
    await client.query("DELETE FROM registros_produccion WHERE id=$1", [id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ msg: e.message });
  } finally {
    client.release();
  }
});

// --- NUEVO: DATOS PARA EL CALENDARIO MAESTRO ---
router.get("/calendario", async (req, res) => {
  try {
    // 1. PASADO: Lo que ya se produjo (Registros)
    // Agrupamos por día y máquina para no llenar el calendario de 1000 eventos chicos
    const queryPasado = `
        SELECT 
            to_char(fecha_produccion, 'YYYY-MM-DD') as fecha,
            s.nombre as producto,
            SUM(rp.cantidad_ok) as total
        FROM registros_produccion rp
        JOIN semielaborados s ON rp.semielaborado_id = s.id
        GROUP BY 1, 2
    `;

    // 2. FUTURO: Planes Abiertos (Estimación)
    const queryFuturo = `
        SELECT 
            p.nombre as plan_nombre,
            p.fecha_inicio_estimada,
            p.velocidad_produccion,
            p.turnos_diarios,
            SUM(pi.cantidad_requerida) as total_requerido
        FROM planes_produccion p
        JOIN planes_items pi ON p.id = pi.plan_id
        WHERE p.estado = 'ABIERTO'
        GROUP BY p.id
    `;

    // 3. PRESENTE: Estado de las máquinas
    const queryPresente = `SELECT * FROM estado_produccion`;

    const [resPasado, resFuturo, resPresente] = await Promise.all([
      db.query(queryPasado),
      db.query(queryFuturo),
      db.query(queryPresente),
    ]);

    // --- PROCESAMIENTO DE EVENTOS ---
    const eventos = [];

    // A. Eventos Pasados (Color Verde)
    resPasado.rows.forEach((r, i) => {
      eventos.push({
        id: `past-${i}`,
        title: `✅ ${r.total}u ${r.producto}`,
        start: r.fecha, // Fecha sola (todo el día)
        end: r.fecha,
        allDay: true,
        type: "past",
      });
    });

    // B. Eventos Futuros (Color Azul)
    resFuturo.rows.forEach((r, i) => {
      const inicio = new Date(r.fecha_inicio_estimada || new Date());
      // Calculamos fin estimado
      const velocidad = r.velocidad_produccion || 100;
      const dias = Math.ceil(
        Number(r.total_requerido) / (velocidad * (r.turnos_diarios || 2))
      );
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + dias);

      eventos.push({
        id: `plan-${i}`,
        title: `📅 ${r.plan_nombre} (${r.total_requerido}u)`,
        start: inicio,
        end: fin,
        allDay: true,
        type: "future",
      });
    });

    // C. Estado Máquinas (Para el panel superior)
    // Mapeamos los IDs de estación a nombres reales
    // Suponemos: 1-3 Hornos, 4 Inyectora, 5-7 Extrusoras
    const maquinas = [
      {
        id: 1,
        nombre: "Horno 1",
        tipo: "HORNO",
        estado: "OFFLINE",
        producto: "-",
      },
      {
        id: 2,
        nombre: "Horno 2",
        tipo: "HORNO",
        estado: "OFFLINE",
        producto: "-",
      },
      {
        id: 3,
        nombre: "Horno 3",
        tipo: "HORNO",
        estado: "OFFLINE",
        producto: "-",
      },
      {
        id: 4,
        nombre: "Inyectora",
        tipo: "INYECTORA",
        estado: "OFFLINE",
        producto: "-",
      },
      {
        id: 5,
        nombre: "Extrusora 1",
        tipo: "EXTRUSORA",
        estado: "OFFLINE",
        producto: "-",
      },
      {
        id: 6,
        nombre: "Extrusora 2",
        tipo: "EXTRUSORA",
        estado: "OFFLINE",
        producto: "-",
      },
      {
        id: 7,
        nombre: "Extrusora 3",
        tipo: "EXTRUSORA",
        estado: "OFFLINE",
        producto: "-",
      },
    ];

    // Llenamos con datos reales si existen en DB
    resPresente.rows.forEach((row) => {
      const mq = maquinas.find((m) => m.id === row.estacion_id);
      if (mq) {
        mq.estado = "ONLINE"; // Si hay registro, está prendida
        try {
          const prod = JSON.parse(row.producto_actual);
          // Intentamos sacar nombre del JSON o ponemos genérico
          mq.producto = Array.isArray(prod)
            ? prod[0]?.nombre || "Produciendo..."
            : "Activo";
        } catch (e) {
          mq.producto = "Error Datos";
        }
      }
    });

    res.json({ eventos, maquinas });
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

// --- NUEVO: PROGRAMACIÓN DE MÁQUINAS (MATRIZ) ---

// 1. Obtener programación de un rango de fechas
router.get("/programacion", async (req, res) => {
  const { start, end } = req.query; // Fechas YYYY-MM-DD
  try {
    const query = `
            SELECT pm.*, s.codigo, s.nombre, s.stock_actual
            FROM programacion_maquinas pm
            JOIN semielaborados s ON pm.semielaborado_id = s.id
            WHERE pm.fecha >= $1 AND pm.fecha <= $2
            ORDER BY pm.fecha, pm.maquina, pm.orden
        `;
    const { rows } = await db.query(query, [start, end]);
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 2. Asignar (Crear)
router.post("/programacion", async (req, res) => {
  // Recibimos 'grupo_id'
  const {
    fecha,
    maquina,
    brazo,
    semielaborado_id,
    cantidad,
    unidades_por_ciclo,
    grupo_id,
  } = req.body;

  try {
    // Si no viene grupo_id, buscamos el máximo actual en esa celda y sumamos 1 (Nuevo grupo)
    let finalGrupoId = grupo_id;

    if (!finalGrupoId) {
      const maxRes = await db.query(
        "SELECT COALESCE(MAX(grupo_id), 0) as max_grp FROM programacion_maquinas WHERE fecha = $1 AND maquina = $2 AND brazo = $3",
        [fecha, maquina, brazo || "Estación 1"]
      );
      finalGrupoId = maxRes.rows[0].max_grp + 1;
    }

    await db.query(
      `INSERT INTO programacion_maquinas (fecha, maquina, brazo, semielaborado_id, cantidad, unidades_por_ciclo, grupo_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        fecha,
        maquina,
        brazo || "Estación 1",
        semielaborado_id,
        cantidad || 10,
        unidades_por_ciclo || 1,
        finalGrupoId,
      ]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 3. Eliminar asignación
router.delete("/programacion/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM programacion_maquinas WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 4. Actualizar cantidad y ciclos
router.put("/programacion/:id", async (req, res) => {
  const { cantidad, unidades_por_ciclo } = req.body; // <--- Recibimos param
  try {
    await db.query(
      "UPDATE programacion_maquinas SET cantidad = $1, unidades_por_ciclo = $2 WHERE id = $3",
      [cantidad, unidades_por_ciclo, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

module.exports = router;
