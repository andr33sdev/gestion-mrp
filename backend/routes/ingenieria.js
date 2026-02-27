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
      `SELECT 
         s.*,
         COALESCE(
           NULLIF((
             SELECT SUM(rs.cantidad * COALESCE(mp.precio, 0))
             FROM recetas_semielaborados rs
             JOIN materias_primas mp ON rs.materia_prima_id = mp.id
             WHERE rs.semielaborado_id = s.id
           ), 0), 
           s.costo_usd, 
           0
         ) AS costo
       FROM semielaborados s 
       ORDER BY s.nombre ASC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// NUEVO: GUARDAR COSTO DIRECTO (IMPORTADOS)
router.put("/semielaborados/:id/costo", async (req, res) => {
  const { costo_usd } = req.body;
  try {
    await db.query("UPDATE semielaborados SET costo_usd = $1 WHERE id = $2", [
      costo_usd,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// ACTUALIZAR DATOS TÉCNICOS (PROCESO Y PARÁMETROS)
router.put("/semielaborados/:id/tecnica", async (req, res) => {
  const { id } = req.params;
  const { tipo_proceso, parametros_maquina } = req.body;
  try {
    await db.query(
      "UPDATE semielaborados SET tipo_proceso = $1, parametros_maquina = $2 WHERE id = $3",
      [tipo_proceso, parametros_maquina, id],
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).send("Error al guardar datos técnicos");
  }
});

// 1. OBTENER MATERIAS PRIMAS (Con datos de Iglú)
router.get("/materias-primas", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM materias_primas ORDER BY nombre ASC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 2. GUARDAR CONFIGURACIÓN DEL IGLÚ (NUEVO)
router.put("/materias-primas/:id/iglu", async (req, res) => {
  const { id } = req.params;
  const { en_iglu, fila_iglu, lado_iglu, color_hex } = req.body;

  try {
    await db.query(
      `UPDATE materias_primas 
       SET en_iglu = $1, fila_iglu = $2, lado_iglu = $3, color_hex = $4 
       WHERE id = $5`,
      [en_iglu, fila_iglu || 0, lado_iglu || 0, color_hex || "#888888", id],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 1. Obtener todos los pallets ubicados
router.get("/deposito/pallets", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.*, mp.nombre, mp.codigo, mp.color_hex 
      FROM ubicaciones_iglu u
      JOIN materias_primas mp ON u.materia_prima_id = mp.id
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 2. Crear un nuevo pallet
router.post("/deposito/pallets", async (req, res) => {
  const { materia_prima_id, cantidad, fila, lado, columna } = req.body;
  try {
    // Validación básica de colisión
    const existe = await db.query(
      "SELECT id FROM ubicaciones_iglu WHERE fila=$1 AND lado=$2 AND columna=$3",
      [fila, lado, columna],
    );
    if (existe.rowCount > 0) {
      return res.status(400).json({ msg: "Ubicación ocupada" });
    }

    await db.query(
      "INSERT INTO ubicaciones_iglu (materia_prima_id, cantidad, fila, lado, columna) VALUES ($1, $2, $3, $4, $5)",
      [materia_prima_id, cantidad, fila || 0, lado || 0, columna || 0],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 3. Modificar pallet (Mover o ajustar cantidad)
router.put("/deposito/pallets/:id", async (req, res) => {
  const { id } = req.params;
  const { cantidad, fila, lado } = req.body;
  try {
    await db.query(
      "UPDATE ubicaciones_iglu SET cantidad=$1, fila=$2, lado=$3 WHERE id=$4",
      [cantidad, fila, lado, id],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// 4. Eliminar pallet (Se consumió o salió del iglú)
router.delete("/deposito/pallets/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM ubicaciones_iglu WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
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
      [req.params.producto],
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
       FROM recetas_semielaborados r JOIN materias_primas mp ON r.materia_prima_id = mp.id`,
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
      [req.params.id],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// --- FICHA TÉCNICA COMPLETA (CON HISTORIAL Y SPECS) ---
router.get("/ficha/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Info Básica + Stock + Variantes
    const semiRes = await db.query(
      "SELECT * FROM semielaborados WHERE id = $1",
      [id],
    );
    if (semiRes.rowCount === 0)
      return res.status(404).json({ msg: "Producto no encontrado" });

    const nombreProducto = semiRes.rows[0].nombre;

    // 2. Receta Activa (Detallada)
    const recetaRes = await db.query(
      `
            SELECT mp.codigo, mp.nombre, rs.cantidad, mp.stock_actual as stock_mp 
            FROM recetas_semielaborados rs
            JOIN materias_primas mp ON rs.materia_prima_id = mp.id
            WHERE rs.semielaborado_id = $1
            ORDER BY mp.nombre ASC
        `,
      [id],
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
      [id],
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
      [id],
    );

    // 5. Cajón de Recetas (Versiones Guardadas)
    const versionesRes = await db.query(
      `
            SELECT id, nombre_version, to_char(fecha_guardado, 'DD/MM/YYYY') as fecha
            FROM historial_recetas 
            WHERE semielaborado_id = $1 
            ORDER BY fecha_guardado DESC
            LIMIT 1
        `,
      [id],
    );

    // 6. ÚLTIMAS ESPECIFICACIONES (Changelog) - NUEVO
    const specsRes = await db.query(
      `
        SELECT * FROM historial_cambios_producto 
        WHERE producto = $1 AND lleva_reflectiva = true
        ORDER BY fecha DESC 
        LIMIT 1
      `,
      [nombreProducto],
    );

    res.json({
      producto: semiRes.rows[0], // Aquí vienen las variantes si existen en la tabla
      receta: recetaRes.rows,
      historial: prodRes.rows,
      stats: statsRes.rows[0],
      ultima_version_receta: versionesRes.rows[0],
      specs: specsRes.rows[0] || {},
    });
  } catch (e) {
    console.error("Error ficha técnica:", e);
    res.status(500).send(e.message);
  }
});

// --- CÁLCULO DE STOCK MÍNIMO SUGERIDO (IA/ESTADÍSTICA) ---
router.get("/sugerencias-stock-minimo", async (req, res) => {
  try {
    const query = `
        SELECT 
            s.id, 
            s.codigo, 
            s.nombre, 
            s.alerta_1 as minimo_actual,
            (s.stock_planta_26 + s.stock_planta_37 + s.stock_deposito_ayolas + s.stock_deposito_quintana) as stock_total,
            COALESCE(SUM(p.cantidad * r.cantidad), 0) as total_periodo
        FROM semielaborados s
        JOIN recetas r ON s.id = r.semielaborado_id
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
      const promedioMensual = Math.ceil(total / 6);
      const stockActual = Number(row.stock_total);

      return {
        id: row.id,
        codigo: row.codigo,
        nombre: row.nombre,
        minimo_actual: Number(row.minimo_actual),
        stock_actual: stockActual,
        promedio_mensual: promedioMensual,
        sugerido: promedioMensual,
        diferencia: promedioMensual - Number(row.minimo_actual),
      };
    });

    res.json(sugerencias);
  } catch (e) {
    console.error("Error calculando mínimos:", e);
    res.status(500).send(e.message);
  }
});

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

// --- OBTENER HISTORIAL DE RECETAS (CAJÓN DE VERSIONES) ---
router.get("/historial-recetas", async (req, res) => {
  const { tipo, ref } = req.query;
  try {
    let query = "";
    if (tipo === "SEMIELABORADO") {
      // ACÁ ESTÁ LA CLAVE: se pide la columna "activa" en el SELECT
      query = `SELECT id, nombre_version, to_char(fecha_guardado, 'DD/MM/YYYY HH24:MI') as fecha, ingredientes_json as items, activa FROM historial_recetas WHERE semielaborado_id = $1 ORDER BY fecha_guardado DESC`;
    } else {
      query = `SELECT id, nombre_version, to_char(fecha_guardado, 'DD/MM/YYYY HH24:MI') as fecha, ingredientes_json as items, activa FROM historial_recetas WHERE producto_terminado = $1 ORDER BY fecha_guardado DESC`;
    }
    const { rows } = await db.query(query, [ref]);
    const historialFormateado = rows.map((row) => ({
      ...row,
      items:
        typeof row.items === "string" ? JSON.parse(row.items) : row.items || [],
    }));
    res.json(historialFormateado);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// --- ACTIVAR UNA VERSIÓN DEL HISTORIAL ---
router.put("/historial-recetas/:id/activar", async (req, res) => {
  const { id } = req.params;
  const { tipo, ref_id } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Obtenemos los items de esa receta
    const { rows } = await client.query(
      "SELECT ingredientes_json FROM historial_recetas WHERE id = $1",
      [id],
    );
    if (rows.length === 0) throw new Error("Receta no encontrada");
    const items =
      typeof rows[0].ingredientes_json === "string"
        ? JSON.parse(rows[0].ingredientes_json)
        : rows[0].ingredientes_json;

    if (tipo === "SEMIELABORADO") {
      // 1. Apagamos todas las de este semielaborado
      await client.query(
        "UPDATE historial_recetas SET activa = false WHERE semielaborado_id = $1",
        [ref_id],
      );
      // 2. Encendemos solo la elegida
      await client.query(
        "UPDATE historial_recetas SET activa = true WHERE id = $1",
        [id],
      );
      // 3. Reemplazamos la receta en la tabla productiva
      await client.query(
        "DELETE FROM recetas_semielaborados WHERE semielaborado_id = $1",
        [ref_id],
      );
      for (const item of items) {
        await client.query(
          "INSERT INTO recetas_semielaborados (semielaborado_id, materia_prima_id, cantidad) VALUES ($1, $2, $3)",
          [ref_id, item.id, item.cantidad || 1],
        );
      }
    } else {
      // 1. Apagamos todas las de este producto
      await client.query(
        "UPDATE historial_recetas SET activa = false WHERE producto_terminado = $1",
        [ref_id],
      );
      // 2. Encendemos solo la elegida
      await client.query(
        "UPDATE historial_recetas SET activa = true WHERE id = $1",
        [id],
      );
      // 3. Reemplazamos la receta en la tabla productiva
      await client.query("DELETE FROM recetas WHERE producto_terminado = $1", [
        ref_id,
      ]);
      for (const item of items) {
        await client.query(
          "INSERT INTO recetas (producto_terminado, semielaborado_id, cantidad) VALUES ($1, $2, $3)",
          [ref_id, item.id, item.cantidad || 1],
        );
      }
    }
    await client.query("COMMIT");
    res.json({ success: true, items });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ msg: e.message });
  } finally {
    client.release();
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

// 3. GUARDAR RECETA (PRODUCTO TERMINADO -> SEMIELABORADOS) CON HISTORIAL
router.post("/recetas", async (req, res) => {
  const { producto_terminado, items, nombre_version } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Verificar si el nombre de versión ya existe
    if (nombre_version) {
      const existe = await client.query(
        "SELECT id FROM historial_recetas WHERE producto_terminado = $1 AND UPPER(nombre_version) = UPPER($2)",
        [producto_terminado, nombre_version],
      );
      if (existe.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          msg: "Ya existe una versión con ese nombre para este producto.",
        });
      }
    }

    await client.query(
      "INSERT INTO productos_ingenieria (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING",
      [producto_terminado],
    );
    await client.query("DELETE FROM recetas WHERE producto_terminado = $1", [
      producto_terminado,
    ]);

    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          "INSERT INTO recetas (producto_terminado, semielaborado_id, cantidad) VALUES ($1, $2, $3)",
          [producto_terminado, item.id, item.cantidad || 1],
        );
      }
    }

    if (nombre_version) {
      await client.query(
        "UPDATE historial_recetas SET activa = false WHERE producto_terminado = $1",
        [producto_terminado],
      );
      await client.query(
        "INSERT INTO historial_recetas (producto_terminado, nombre_version, ingredientes_json, activa) VALUES ($1, $2, $3, true)",
        [producto_terminado, nombre_version, JSON.stringify(items)],
      );
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ msg: err.message });
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

    if (nombre_version) {
      const existe = await client.query(
        "SELECT id FROM historial_recetas WHERE semielaborado_id = $1 AND UPPER(nombre_version) = UPPER($2)",
        [semielaborado_id, nombre_version],
      );
      if (existe.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          msg: "Ya existe una versión con ese nombre para este componente.",
        });
      }
    }

    await client.query(
      "DELETE FROM recetas_semielaborados WHERE semielaborado_id = $1",
      [semielaborado_id],
    );
    for (const item of items) {
      await client.query(
        "INSERT INTO recetas_semielaborados (semielaborado_id, materia_prima_id, cantidad) VALUES ($1, $2, $3)",
        [semielaborado_id, item.id, item.cantidad || 1],
      );
    }

    if (nombre_version) {
      await client.query(
        "UPDATE historial_recetas SET activa = false WHERE semielaborado_id = $1",
        [semielaborado_id],
      );
      await client.query(
        "INSERT INTO historial_recetas (semielaborado_id, nombre_version, ingredientes_json, activa) VALUES ($1, $2, $3, true)",
        [semielaborado_id, nombre_version, JSON.stringify(items)],
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

// --- OBTENER HISTORIAL DE RECETAS (CAJÓN DE VERSIONES) ---
router.get("/historial-recetas", async (req, res) => {
  const { tipo, ref } = req.query;
  try {
    let query = "";
    if (tipo === "SEMIELABORADO") {
      query = `SELECT id, nombre_version, to_char(fecha_guardado, 'DD/MM/YYYY HH24:MI') as fecha, ingredientes_json as items, activa FROM historial_recetas WHERE semielaborado_id = $1 ORDER BY fecha_guardado DESC`;
    } else {
      query = `SELECT id, nombre_version, to_char(fecha_guardado, 'DD/MM/YYYY HH24:MI') as fecha, ingredientes_json as items, activa FROM historial_recetas WHERE producto_terminado = $1 ORDER BY fecha_guardado DESC`;
    }
    const { rows } = await db.query(query, [ref]);
    const historialFormateado = rows.map((row) => ({
      ...row,
      items:
        typeof row.items === "string" ? JSON.parse(row.items) : row.items || [],
    }));
    res.json(historialFormateado);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// --- ACTIVAR UNA VERSIÓN DEL HISTORIAL ---
router.put("/historial-recetas/:id/activar", async (req, res) => {
  const { id } = req.params;
  const { tipo, ref_id } = req.body;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT ingredientes_json FROM historial_recetas WHERE id = $1",
      [id],
    );
    if (rows.length === 0) throw new Error("Receta no encontrada");
    const items =
      typeof rows[0].ingredientes_json === "string"
        ? JSON.parse(rows[0].ingredientes_json)
        : rows[0].ingredientes_json;

    if (tipo === "SEMIELABORADO") {
      await client.query(
        "UPDATE historial_recetas SET activa = false WHERE semielaborado_id = $1",
        [ref_id],
      );
      await client.query(
        "UPDATE historial_recetas SET activa = true WHERE id = $1",
        [id],
      );
      await client.query(
        "DELETE FROM recetas_semielaborados WHERE semielaborado_id = $1",
        [ref_id],
      );
      for (const item of items) {
        await client.query(
          "INSERT INTO recetas_semielaborados (semielaborado_id, materia_prima_id, cantidad) VALUES ($1, $2, $3)",
          [ref_id, item.id, item.cantidad || 1],
        );
      }
    } else {
      await client.query(
        "UPDATE historial_recetas SET activa = false WHERE producto_terminado = $1",
        [ref_id],
      );
      await client.query(
        "UPDATE historial_recetas SET activa = true WHERE id = $1",
        [id],
      );
      await client.query("DELETE FROM recetas WHERE producto_terminado = $1", [
        ref_id,
      ]);
      for (const item of items) {
        await client.query(
          "INSERT INTO recetas (producto_terminado, semielaborado_id, cantidad) VALUES ($1, $2, $3)",
          [ref_id, item.id, item.cantidad || 1],
        );
      }
    }
    await client.query("COMMIT");
    res.json({ success: true, items });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ msg: e.message });
  } finally {
    client.release();
  }
});

// --- RENOMBRAR UNA VERSIÓN DEL HISTORIAL ---
router.put("/historial-recetas/:id/renombrar", async (req, res) => {
  try {
    const { nombre_version } = req.body;
    await db.query(
      "UPDATE historial_recetas SET nombre_version = $1 WHERE id = $2",
      [nombre_version, req.params.id],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
});

// --- ELIMINAR UNA VERSIÓN DEL HISTORIAL ---
router.delete("/historial-recetas/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM historial_recetas WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
});

// --- NUEVO: OBTENER PRODUCTOS CON SU COSTO DIRECTO ---
router.get("/productos", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM productos_ingenieria ORDER BY nombre ASC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- NUEVO: GUARDAR COSTO DIRECTO/IMPORTACIÓN ---
router.put("/productos/:nombre/costo", async (req, res) => {
  const { costo_usd } = req.body;
  try {
    await db.query(
      "INSERT INTO productos_ingenieria (nombre, costo_usd) VALUES ($1, $2) ON CONFLICT (nombre) DO UPDATE SET costo_usd = EXCLUDED.costo_usd",
      [req.params.nombre, costo_usd],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

module.exports = router;
