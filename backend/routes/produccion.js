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
        const { rows } = await client.query("SELECT producto_actual FROM estado_produccion WHERE estacion_id = $1 FOR UPDATE", [estacion_id]);
        let list = JSON.parse(rows[0]?.producto_actual || "[]");
        list.push(producto);
        await client.query("UPDATE estado_produccion SET producto_actual = $1 WHERE estacion_id = $2", [JSON.stringify(list), estacion_id]);
        await client.query("COMMIT");
        res.json(list);
    } catch (e) { await client.query("ROLLBACK"); res.status(500).send(e.message); } finally { client.release(); }
});

// Vaciar estación (Panel de Control)
// Permitimos que el operario vacíe la estación para seguir trabajando
router.delete("/:estacion_id", async (req, res) => {
    await db.query("UPDATE estado_produccion SET producto_actual = '[]' WHERE estacion_id = $1", [req.params.estacion_id]);
    res.json({ msg: "Limpiado" });
});

// REGISTRAR PRODUCCION A PLAN (La ruta que te fallaba)
// Ahora está abierta para Operarios también
router.post("/registrar-a-plan", async (req, res) => {
    const { plan_id, semielaborado_id, cantidad_ok, cantidad_scrap, operario_id, motivo_scrap, turno, fecha_produccion } = req.body;
    const ok = Number(cantidad_ok) || 0;
    const scrap = Number(cantidad_scrap) || 0;

    const client = await db.connect();
    try {
        await client.query("BEGIN");

        // Validar que el ítem pertenezca al plan
        const itemRes = await client.query("SELECT id, (SELECT nombre FROM planes_produccion WHERE id=$1) as plan_nombre FROM planes_items WHERE plan_id=$1 AND semielaborado_id=$2", [plan_id, semielaborado_id]);
        if (itemRes.rowCount === 0) return res.status(404).json({ msg: "Ítem no encontrado en plan" });

        const plan_item_id = itemRes.rows[0].id;
        const prodDate = fecha_produccion ? `${fecha_produccion} 12:00:00` : "NOW()";

        // Actualizar acumulado en el plan
        const upRes = await client.query("UPDATE planes_items SET cantidad_producida = cantidad_producida + $1 WHERE id=$2 RETURNING cantidad_producida", [ok, plan_item_id]);

        // Insertar registro detallado
        await client.query(`INSERT INTO registros_produccion (plan_item_id, semielaborado_id, operario_id, cantidad_ok, cantidad_scrap, motivo_scrap, turno, fecha_produccion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [plan_item_id, semielaborado_id, operario_id, ok, scrap, motivo_scrap || "", turno, prodDate]);

        await client.query("COMMIT");
        res.json({ success: true, msg: "Registrado correctamente", nuevo_total: upRes.rows[0].cantidad_producida });
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
router.delete("/registro/:id", restrictTo('GERENCIA'), async (req, res) => {
    const { id } = req.params;
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const regRes = await client.query("SELECT * FROM registros_produccion WHERE id=$1", [id]);
        if (regRes.rowCount === 0) return res.status(404).json({ msg: "No existe" });

        const reg = regRes.rows[0];
        if (reg.plan_item_id) {
            await client.query("UPDATE planes_items SET cantidad_producida = cantidad_producida - $1 WHERE id=$2", [reg.cantidad_ok, reg.plan_item_id]);
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

module.exports = router;