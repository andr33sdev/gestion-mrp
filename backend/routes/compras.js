const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect, restrictTo } = require("../middleware/auth");

// Helper (Debe estar aquí o importado)
const actualizarEstadoSolicitud = async (client, solicitudId) => {
    const itemsRes = await client.query("SELECT estado, cantidad, cantidad_recibida FROM solicitudes_items WHERE solicitud_id = $1", [solicitudId]);
    if (itemsRes.rowCount === 0) return;
    const todosCompletos = itemsRes.rows.every(r => r.estado === "COMPLETO" || Number(r.cantidad_recibida) >= Number(r.cantidad));
    const algunoIniciado = itemsRes.rows.some(r => Number(r.cantidad_recibida) > 0);
    let nuevoEstado = "PENDIENTE";
    if (todosCompletos) nuevoEstado = "COMPLETA";
    else if (algunoIniciado) nuevoEstado = "EN PROCESO";
    await client.query("UPDATE solicitudes_compra SET estado = $1 WHERE id = $2", [nuevoEstado, solicitudId]);
};

router.use(protect);
router.use(restrictTo('GERENCIA')); // Solo gerencia puede acceder a estas rutas

router.post("/nueva", protect, async (req, res) => {
    const { items } = req.body;
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const solRes = await client.query("INSERT INTO solicitudes_compra (estado) VALUES ('PENDIENTE') RETURNING id");
        const solId = solRes.rows[0].id;
        for (const item of items) {
            await client.query("INSERT INTO solicitudes_items (solicitud_id, materia_prima_id, cantidad, proveedor_recomendado) VALUES ($1, $2, $3, $4)", [solId, item.materia_prima_id, item.cantidad, item.proveedor || "-"]);
        }
        await client.query("COMMIT");
        res.json({ success: true, solicitudId: solId });
    } catch (e) { await client.query("ROLLBACK"); res.status(500).send(e.message); } finally { client.release(); }
});

router.get("/historial", protect, async (req, res) => {
    const { rows } = await db.query("SELECT sc.id, sc.fecha_creacion, sc.estado, COUNT(si.id) as items_count FROM solicitudes_compra sc JOIN solicitudes_items si ON sc.id = si.solicitud_id GROUP BY sc.id, sc.fecha_creacion, sc.estado ORDER BY sc.fecha_creacion DESC LIMIT 50");
    res.json(rows);
});

router.get("/solicitud/:id", protect, async (req, res) => {
    const { id } = req.params;
    const cab = await db.query("SELECT * FROM solicitudes_compra WHERE id = $1", [id]);
    if (cab.rowCount === 0) return res.status(404).json({ msg: "No existe" });
    const items = await db.query("SELECT si.*, mp.nombre, mp.codigo FROM solicitudes_items si JOIN materias_primas mp ON si.materia_prima_id = mp.id WHERE si.solicitud_id = $1 ORDER BY mp.nombre ASC", [id]);
    res.json({ ...cab.rows[0], items: items.rows });
});

router.put("/item/:id/recepcion", protect, async (req, res) => {
    const { cantidad_ingresada } = req.body;
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const itemRes = await client.query("SELECT * FROM solicitudes_items WHERE id = $1", [req.params.id]);
        const item = itemRes.rows[0];
        const nuevaRec = Number(item.cantidad_recibida) + Number(cantidad_ingresada);
        let estado = "PARCIAL";
        if (nuevaRec >= item.cantidad) estado = "COMPLETO";
        await client.query("UPDATE solicitudes_items SET cantidad_recibida = $1, estado = $2 WHERE id = $3", [nuevaRec, estado, req.params.id]);
        await client.query("UPDATE materias_primas SET stock_actual = stock_actual + $1 WHERE id = $2", [cantidad_ingresada, item.materia_prima_id]);
        await actualizarEstadoSolicitud(client, item.solicitud_id);
        await client.query("COMMIT");
        res.json({ success: true });
    } catch (e) { await client.query("ROLLBACK"); res.status(500).send(e.message); } finally { client.release(); }
});

router.put("/item/:id", protect, async (req, res) => {
    const { cantidad, proveedor } = req.body;
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query("UPDATE solicitudes_items SET cantidad = $1, proveedor_recomendado = $2 WHERE id = $3", [cantidad, proveedor, req.params.id]);
        const itemRes = await client.query("SELECT solicitud_id FROM solicitudes_items WHERE id = $1", [req.params.id]);
        await actualizarEstadoSolicitud(client, itemRes.rows[0].solicitud_id);
        await client.query("COMMIT");
        res.json({ success: true });
    } catch (e) { await client.query("ROLLBACK"); res.status(500).send(e.message); } finally { client.release(); }
});

router.delete("/item/:id", protect, async (req, res) => {
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const itemRes = await client.query("SELECT solicitud_id FROM solicitudes_items WHERE id=$1", [req.params.id]);
        await client.query("DELETE FROM solicitudes_items WHERE id=$1", [req.params.id]);
        if (itemRes.rowCount > 0) await actualizarEstadoSolicitud(client, itemRes.rows[0].solicitud_id);
        await client.query("COMMIT");
        res.json({ success: true });
    } catch (e) { await client.query("ROLLBACK"); res.status(500).send(e.message); } finally { client.release(); }
});

router.post("/solicitud/:id/items", protect, async (req, res) => {
    const { materia_prima_id, cantidad, proveedor } = req.body;
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query("INSERT INTO solicitudes_items (solicitud_id, materia_prima_id, cantidad, proveedor_recomendado) VALUES ($1, $2, $3, $4)", [req.params.id, materia_prima_id, cantidad, proveedor]);
        await actualizarEstadoSolicitud(client, req.params.id);
        await client.query("COMMIT");
        res.json({ success: true });
    } catch (e) { await client.query("ROLLBACK"); res.status(500).send(e.message); } finally { client.release(); }
});

module.exports = router;