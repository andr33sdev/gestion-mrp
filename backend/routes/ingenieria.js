// backend/routes/ingenieria.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect, restrictTo } = require("../middleware/auth");
// Importamos las funciones del servicio de sincronización
const {
  sincronizarStockSemielaborados,
  sincronizarMateriasPrimas,
} = require("../services/syncService");

router.use(protect);

// --- RUTAS DE LECTURA (Públicas para usuarios logueados) ---

router.get("/semielaborados", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM semielaborados ORDER BY nombre ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/materias-primas", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM materias_primas ORDER BY nombre ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/recetas/all", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.producto_terminado, r.cantidad, r.semielaborado_id, s.codigo, s.nombre
      FROM recetas r LEFT JOIN semielaborados s ON r.semielaborado_id = s.id
    `);
    const agrupadas = {};
    rows.forEach((row) => {
      if (!agrupadas[row.producto_terminado])
        agrupadas[row.producto_terminado] = [];
      agrupadas[row.producto_terminado].push({
        semielaborado_id: row.semielaborado_id,
        codigo: row.codigo,
        nombre: row.nombre,
        cantidad: Number(row.cantidad),
      });
    });
    res.json(agrupadas);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/recetas/:producto", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*, s.codigo, s.nombre, s.stock_actual, 
      (SELECT TO_CHAR(MAX(ultima_actualizacion), 'DD/MM/YYYY HH24:MI') FROM recetas WHERE producto_terminado = $1) as fecha_receta 
      FROM recetas r JOIN semielaborados s ON r.semielaborado_id = s.id WHERE r.producto_terminado = $1`,
      [req.params.producto]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/recetas-semielaborados/all", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.semielaborado_id, r.cantidad, mp.id as materia_prima_id, mp.codigo, mp.nombre as mp_nombre 
       FROM recetas_semielaborados r JOIN materias_primas mp ON r.materia_prima_id = mp.id`
    );
    const agrupadas = rows.reduce((acc, row) => {
      if (!acc[row.semielaborado_id]) acc[row.semielaborado_id] = [];
      acc[row.semielaborado_id].push({
        materia_prima_id: row.materia_prima_id,
        codigo: row.codigo,
        nombre: row.mp_nombre,
        cantidad: Number(row.cantidad),
      });
      return acc;
    }, {});
    res.json(agrupadas);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

router.get("/recetas-semielaborados/:id", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*, mp.codigo, mp.nombre, mp.stock_actual 
       FROM recetas_semielaborados r JOIN materias_primas mp ON r.materia_prima_id = mp.id 
       WHERE r.semielaborado_id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// --- FICHA TÉCNICA COMPLETA (CON HISTORIAL) ---
router.get("/ficha/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Info Básica + Stock
    const semiRes = await db.query(
      "SELECT * FROM semielaborados WHERE id = $1",
      [id]
    );
    if (semiRes.rowCount === 0)
      return res.status(404).json({ msg: "Producto no encontrado" });

    // 2. Receta Activa (Detallada)
    const recetaRes = await db.query(
      `
            SELECT mp.codigo, mp.nombre, rs.cantidad, mp.stock_actual as stock_mp 
            FROM recetas_semielaborados rs
            JOIN materias_primas mp ON rs.materia_prima_id = mp.id
            WHERE rs.semielaborado_id = $1
            ORDER BY mp.nombre ASC
        `,
      [id]
    );

    // 3. Historial de Producción (Últimos 10 registros)
    const prodRes = await db.query(
      `
            SELECT rp.fecha_produccion, rp.cantidad_ok, rp.cantidad_scrap, o.nombre as operario, rp.turno
            FROM registros_produccion rp
            LEFT JOIN operarios o ON rp.operario_id = o.id
            WHERE rp.semielaborado_id = $1
            ORDER BY rp.fecha_produccion DESC
            LIMIT 10
        `,
      [id]
    );

    // 4. Estadísticas Simples
    const statsRes = await db.query(
      `
            SELECT 
                SUM(cantidad_ok) as total_historico,
                AVG(cantidad_ok) as promedio_lote
            FROM registros_produccion 
            WHERE semielaborado_id = $1
        `,
      [id]
    );

    // 5. Cajón de Recetas (Versiones Guardadas)
    const versionesRes = await db.query(
      `
            SELECT id, nombre_version, to_char(fecha_guardado, 'DD/MM/YYYY HH24:MI') as fecha, ingredientes_json
            FROM historial_recetas 
            WHERE semielaborado_id = $1 
            ORDER BY fecha_guardado DESC
        `,
      [id]
    );

    res.json({
      producto: semiRes.rows[0],
      receta: recetaRes.rows,
      historial: prodRes.rows,
      stats: statsRes.rows[0],
      versiones: versionesRes.rows,
    });
  } catch (e) {
    console.error("Error ficha técnica:", e);
    res.status(500).send(e.message);
  }
});

// --- CÁLCULO DE STOCK MÍNIMO SUGERIDO (IA/ESTADÍSTICA) ---
router.get("/sugerencias-stock-minimo", async (req, res) => {
  try {
    // LÓGICA DE DEMANDA REAL (Ventas x Receta) - Últimos 6 meses
    const query = `
        SELECT 
            s.id, 
            s.codigo, 
            s.nombre, 
            s.alerta_1 as minimo_actual,
            -- Sumamos el stock de todas las plantas para mostrar la realidad actual
            (s.stock_planta_26 + s.stock_planta_37 + s.stock_deposito_ayolas + s.stock_deposito_quintana) as stock_total,
            -- Calculamos consumo teórico basado en ventas
            COALESCE(SUM(p.cantidad * r.cantidad), 0) as total_periodo
        FROM semielaborados s
        -- Unimos con la tabla 'recetas' que define qué semielaborado usa cada producto terminado
        JOIN recetas r ON s.id = r.semielaborado_id
        -- Unimos con 'pedidos' coincidiendo el modelo vendido con el producto terminado de la receta
        JOIN pedidos p ON UPPER(p.modelo) = UPPER(r.producto_terminado)
        
        WHERE p.fecha >= NOW() - INTERVAL '6 months'
          AND (p.estado IS NULL OR UPPER(p.estado) NOT LIKE '%CANCELADO%')
          
        GROUP BY s.id, s.codigo, s.nombre, s.alerta_1, s.stock_planta_26, s.stock_planta_37, s.stock_deposito_ayolas, s.stock_deposito_quintana
        HAVING COALESCE(SUM(p.cantidad * r.cantidad), 0) > 0
        ORDER BY total_periodo DESC
    `;

    const { rows } = await db.query(query);

    const sugerencias = rows.map((row) => {
      const total = Number(row.total_periodo);
      const promedioMensual = Math.ceil(total / 6); // Promedio mensual (base 6 meses)
      const stockActual = Number(row.stock_total);

      return {
        id: row.id,
        codigo: row.codigo,
        nombre: row.nombre,
        minimo_actual: Number(row.minimo_actual),
        stock_actual: stockActual,
        promedio_mensual: promedioMensual,
        sugerido: promedioMensual, // Sugerimos cubrir 1 mes de demanda
        diferencia: promedioMensual - Number(row.minimo_actual),
      };
    });

    res.json(sugerencias);
  } catch (e) {
    console.error("Error calculando mínimos:", e);
    res.status(500).send(e.message);
  }
});

// --- APLICAR SUGERENCIA (ACTUALIZAR DB) ---
// Nota: Aunque ahora lo manejes por Excel, dejo la ruta por si decides usarla a futuro.
router.put("/aplicar-minimo/:id", async (req, res) => {
  const { id } = req.params;
  const { nuevo_minimo } = req.body;
  try {
    await db.query("UPDATE semielaborados SET alerta_1 = $1 WHERE id = $2", [
      nuevo_minimo,
      id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// --- RUTAS DE ESCRITURA (SOLO GERENCIA) ---
router.use(restrictTo("GERENCIA"));

// 1. SINCRONIZACIÓN STOCK
router.post("/sincronizar-stock", async (req, res) => {
  const result = await sincronizarStockSemielaborados();
  if (result.success) {
    res.json({ msg: "Stock sincronizado correctamente", count: result.count });
  } else {
    res.status(500).json({ msg: "Error al sincronizar", error: result.error });
  }
});

// 2. SINCRONIZACIÓN MATERIAS PRIMAS
router.post("/sincronizar-mp", async (req, res) => {
  const r = await sincronizarMateriasPrimas();
  if (r.success) res.json({ msg: "OK", count: r.count });
  else res.status(500).send(r.error);
});

// 3. GUARDAR RECETA (PRODUCTO TERMINADO -> SEMIELABORADOS)
router.post("/recetas", async (req, res) => {
  const { producto_terminado, items } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO productos_ingenieria (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING",
      [producto_terminado]
    );
    await client.query("DELETE FROM recetas WHERE producto_terminado = $1", [
      producto_terminado,
    ]);
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO recetas (producto_terminado, semielaborado_id, cantidad) VALUES ($1, $2, $3)`,
          [producto_terminado, item.id, item.cantidad || 1]
        );
      }
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

// 4. GUARDAR RECETA (SEMIELABORADO -> MATERIAS PRIMAS) CON HISTORIAL
router.post("/recetas-semielaborados", async (req, res) => {
  const { semielaborado_id, items, nombre_version } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // A. Actualizar Receta ACTIVA
    await client.query(
      "DELETE FROM recetas_semielaborados WHERE semielaborado_id = $1",
      [semielaborado_id]
    );
    for (const item of items) {
      await client.query(
        "INSERT INTO recetas_semielaborados (semielaborado_id, materia_prima_id, cantidad) VALUES ($1, $2, $3)",
        [semielaborado_id, item.id, item.cantidad || 1]
      );
    }

    // B. Guardar en CAJÓN DE RECETAS (Historial)
    if (nombre_version) {
      await client.query(
        "INSERT INTO historial_recetas (semielaborado_id, nombre_version, ingredientes_json) VALUES ($1, $2, $3)",
        [semielaborado_id, nombre_version, JSON.stringify(items)]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally {
    client.release();
  }
});

module.exports = router;
