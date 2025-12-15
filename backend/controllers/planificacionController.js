const db = require("../db");

// Obtener un plan por ID con sus items detallados
const getPlanById = async (req, res) => {
  const { id } = req.params;
  try {
    const planRes = await db.query(
      "SELECT * FROM planes_produccion WHERE id=$1",
      [id]
    );

    if (planRes.rowCount === 0) {
      return res.status(404).send("No existe el plan");
    }

    const plan = planRes.rows[0];

    // Consulta de items con detalles de ingeniería y producción
    const itemsRes = await db.query(
      `
        SELECT 
            pi.id as plan_item_id, 
            pi.cantidad_requerida,
            pi.fecha_inicio_estimada, 
            pi.ritmo_turno,
            COALESCE((SELECT SUM(rp.cantidad_ok) FROM registros_produccion rp WHERE rp.plan_item_id = pi.id), 0) as cantidad_producida,
            s.id, s.nombre, s.codigo
        FROM planes_items pi 
        JOIN semielaborados s ON pi.semielaborado_id = s.id 
        WHERE pi.plan_id = $1
        ORDER BY pi.id ASC
      `,
      [id]
    );

    // Formateo de datos para el frontend
    plan.items = itemsRes.rows.map((i) => ({
      ...i,
      semielaborado: { id: i.id, nombre: i.nombre, codigo: i.codigo },
      cantidad: Number(i.cantidad_requerida),
      producido: Number(i.cantidad_producida),
      ritmo_turno: Number(i.ritmo_turno) || 50,
      fecha_inicio_estimada: i.fecha_inicio_estimada
        ? new Date(i.fecha_inicio_estimada).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    }));

    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error del servidor al obtener el plan");
  }
};

module.exports = { getPlanById };
