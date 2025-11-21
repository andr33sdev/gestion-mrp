const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect, restrictTo } = require("../middleware/auth");

router.use(protect);

router.get("/stock", protect, async (req, res) => {
    const { rows } = await db.query("SELECT id, codigo, nombre, stock_planta_26, stock_planta_37, stock_deposito_ayolas, stock_deposito_quintana FROM semielaborados ORDER BY nombre ASC");
    res.json(rows);
});

router.get("/historial", protect, async (req, res) => {
    const { rows } = await db.query("SELECT codigo_remito, origen, destino, chofer, estado, MIN(fecha_creacion) as fecha, COUNT(*) as total_items, SUM(cantidad) as total_unidades FROM movimientos_logistica GROUP BY codigo_remito, origen, destino, chofer, estado ORDER BY fecha DESC LIMIT 50");
    res.json(rows);
});

router.use(restrictTo('GERENCIA')); // Solo logistica puede acceder a estas rutas

router.post("/enviar", protect, async (req, res) => {
    const { items, origen, destino, chofer } = req.body;
    const colMap = { PLANTA_26: "stock_planta_26", PLANTA_37: "stock_planta_37", DEP_AYOLAS: "stock_deposito_ayolas", DEP_QUINTANA: "stock_deposito_quintana" };
    const colOrigen = colMap[origen];
    const codigo_remito = `REM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (!colOrigen) return res.status(400).json({ msg: "Origen inválido" });

    const client = await db.connect();
    try {
        await client.query("BEGIN");
        for (const item of items) {
            await client.query(`UPDATE semielaborados SET ${colOrigen} = ${colOrigen} - $1 WHERE id = $2`, [item.cantidad, item.id]);
            await client.query("INSERT INTO movimientos_logistica (semielaborado_id, cantidad, origen, destino, estado, codigo_remito, chofer) VALUES ($1, $2, $3, $4, 'EN_TRANSITO', $5, $6)", [item.id, item.cantidad, origen, destino, codigo_remito, chofer]);
        }
        await client.query("COMMIT");
        res.json({ success: true, codigo_remito });
    } catch (e) { await client.query("ROLLBACK"); res.status(500).send(e.message); } finally { client.release(); }
});

router.post("/recibir", protect, async (req, res) => {
    const { codigo_remito } = req.body;
    const colMap = { PLANTA_26: "stock_planta_26", PLANTA_37: "stock_planta_37", DEP_AYOLAS: "stock_deposito_ayolas", DEP_QUINTANA: "stock_deposito_quintana" };
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const movRes = await client.query("SELECT * FROM movimientos_logistica WHERE codigo_remito = $1 AND estado = 'EN_TRANSITO'", [codigo_remito]);
        if (movRes.rowCount === 0) throw new Error("Remito no válido");
        const destino = movRes.rows[0].destino;
        const colDestino = colMap[destino];
        for (const mov of movRes.rows) {
            await client.query(`UPDATE semielaborados SET ${colDestino} = ${colDestino} + $1 WHERE id = $2`, [mov.cantidad, mov.semielaborado_id]);
            await client.query("UPDATE movimientos_logistica SET estado = 'RECIBIDO', fecha_recepcion = NOW() WHERE id = $1", [mov.id]);
        }
        await client.query("COMMIT");
        res.json({ success: true, msg: `Recibidos ${movRes.rowCount} items`, origen: movRes.rows[0].origen, destino });
    } catch (e) { await client.query("ROLLBACK"); res.status(400).json({ msg: e.message }); } finally { client.release(); }
});

router.put("/stock/:id", protect, async (req, res) => {
    const { p26, p37, ayolas, quintana } = req.body;
    await db.query("UPDATE semielaborados SET stock_planta_26=$1, stock_planta_37=$2, stock_deposito_ayolas=$3, stock_deposito_quintana=$4 WHERE id=$5",
        [Number(p26) || 0, Number(p37) || 0, Number(ayolas) || 0, Number(quintana) || 0, req.params.id]);
    res.json({ success: true });
});

router.get("/despachos-automaticos", protect, async (req, res) => {
    const { rows } = await db.query("SELECT * FROM historial_despachos ORDER BY fecha_despacho DESC LIMIT 100");
    res.json(rows);
});

module.exports = router;