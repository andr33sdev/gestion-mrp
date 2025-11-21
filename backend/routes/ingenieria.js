const express = require("express");
const router = express.Router();
const db = require("../db");
const { leerStockSemielaborados, leerMateriasPrimas } = require("../google-drive");
const XLSX = require("xlsx");
const { normalizarTexto } = require("../utils/helpers");

// 1. IMPORTAR SEGURIDAD
const { protect, restrictTo } = require("../middleware/auth");

// 2. PROTECCIÓN BÁSICA (Todos deben tener API Key válida)
router.use(protect);

// --- RUTAS PÚBLICAS PARA OPERARIOS Y GERENCIA (Lectura) ---
// (El operario necesita esto para los selectores de Planificación y Producción)

router.get("/semielaborados", async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM semielaborados ORDER BY nombre ASC");
        res.json(rows);
    } catch (err) { res.status(500).send(err.message); }
});

router.get("/materias-primas", async (req, res) => {
    const { rows } = await db.query("SELECT * FROM materias_primas ORDER BY nombre ASC");
    res.json(rows);
});

router.get("/recetas/all", async (req, res) => {
    try {
        const { rows } = await db.query(`
      SELECT r.producto_terminado, r.cantidad, r.semielaborado_id, s.codigo, s.nombre
      FROM recetas r LEFT JOIN semielaborados s ON r.semielaborado_id = s.id
    `);
        const agrupadas = {};
        rows.forEach(row => {
            if (!agrupadas[row.producto_terminado]) agrupadas[row.producto_terminado] = [];
            agrupadas[row.producto_terminado].push({
                semielaborado_id: row.semielaborado_id,
                codigo: row.codigo,
                nombre: row.nombre,
                cantidad: Number(row.cantidad)
            });
        });
        res.json(agrupadas);
    } catch (err) { res.status(500).send(err.message); }
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
    } catch (err) { res.status(500).send(err.message); }
});

router.get("/recetas-semielaborados/all", async (req, res) => {
    try {
        const { rows } = await db.query(`SELECT r.semielaborado_id, r.cantidad, mp.id as materia_prima_id, mp.codigo, mp.nombre as mp_nombre FROM recetas_semielaborados r JOIN materias_primas mp ON r.materia_prima_id = mp.id`);
        const agrupadas = rows.reduce((acc, row) => {
            if (!acc[row.semielaborado_id]) acc[row.semielaborado_id] = [];
            acc[row.semielaborado_id].push({ materia_prima_id: row.materia_prima_id, codigo: row.codigo, nombre: row.mp_nombre, cantidad: Number(row.cantidad) });
            return acc;
        }, {});
        res.json(agrupadas);
    } catch (e) { res.status(500).send(e.message); }
});

router.get("/recetas-semielaborados/:id", async (req, res) => {
    const { rows } = await db.query(`SELECT r.*, mp.codigo, mp.nombre, mp.stock_actual FROM recetas_semielaborados r JOIN materias_primas mp ON r.materia_prima_id = mp.id WHERE r.semielaborado_id = $1`, [req.params.id]);
    res.json(rows);
});


// --- RUTAS RESTRINGIDAS (SOLO GERENCIA) ---
// Aquí aplicamos el candado fuerte
router.use(restrictTo('GERENCIA'));

router.post("/sincronizar-stock", async (req, res) => {
    const client = await db.connect();
    try {
        const buffer = await leerStockSemielaborados();
        const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
            const rowString = JSON.stringify(rawMatrix[i]).toUpperCase();
            if (rowString.includes("CODIGO") && rowString.includes("STOCK")) {
                headerRowIndex = i;
                break;
            }
        }
        if (headerRowIndex === -1) return res.status(400).json({ msg: "No se encontró encabezado stock" });

        const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
        await client.query("BEGIN");
        let count = 0;
        for (const row of data) {
            let codigo = null, nombre = null, stock = 0;
            for (const key of Object.keys(row)) {
                const k = normalizarTexto(key);
                if (k === "CODIGO" || k === "CÓDIGO") codigo = row[key];
                else if (k.includes("ARTICULO") || k.includes("NOMBRE") || k.includes("DESCRIPCION")) nombre = row[key];
                else if (k === "STOCK" || k === "CANTIDAD" || k === "TOTAL") stock = row[key];
            }
            if (codigo) {
                await client.query(
                    `INSERT INTO semielaborados (codigo, nombre, stock_actual, ultima_actualizacion)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (codigo) DO UPDATE SET stock_actual = $3, nombre = $2, ultima_actualizacion = NOW()`,
                    [codigo, nombre || "Sin Nombre", Number(stock) || 0]
                );
                count++;
            }
        }
        await client.query("COMMIT");
        res.json({ msg: "Stock sincronizado", count });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).send(err.message);
    } finally {
        client.release();
    }
});

router.post("/recetas", async (req, res) => {
    const { producto_terminado, items } = req.body;
    if (!producto_terminado) return res.status(400).json({ msg: "Falta nombre" });
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query("INSERT INTO productos_ingenieria (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING", [producto_terminado]);
        await client.query("DELETE FROM recetas WHERE producto_terminado = $1", [producto_terminado]);
        if (items && items.length > 0) {
            for (const item of items) {
                await client.query(`INSERT INTO recetas (producto_terminado, semielaborado_id, cantidad) VALUES ($1, $2, $3)`, [producto_terminado, item.id, item.cantidad || 1]);
            }
        }
        await client.query("COMMIT");
        res.json({ success: true });
    } catch (err) { await client.query("ROLLBACK"); res.status(500).send(err.message); } finally { client.release(); }
});

router.post("/sincronizar-mp", async (req, res) => {
    const client = await db.connect();
    try {
        const buffer = await leerMateriasPrimas();
        const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        await client.query("BEGIN");
        let count = 0;
        for (const row of data) {
            const codigo = row["CODIGO"] || row["Codigo"];
            const nombre = row["NOMBRE"] || row["Nombre"];
            const stock = row["STOCK"] || row["Stock"] || 0;
            if (codigo) {
                await client.query(
                    `INSERT INTO materias_primas (codigo, nombre, stock_actual, ultima_actualizacion)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (codigo) DO UPDATE SET stock_actual = $3, nombre = $2, ultima_actualizacion = NOW()`,
                    [codigo, nombre || "Sin Nombre", Number(stock) || 0]
                );
                count++;
            }
        }
        await client.query("COMMIT");
        res.json({ msg: `Sincronizadas ${count} MP` });
    } catch (err) { await client.query("ROLLBACK"); res.status(500).send(err.message); } finally { client.release(); }
});

router.post("/recetas-semielaborados", async (req, res) => {
    const { semielaborado_id, items } = req.body;
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query("DELETE FROM recetas_semielaborados WHERE semielaborado_id = $1", [semielaborado_id]);
        for (const item of items) {
            await client.query("INSERT INTO recetas_semielaborados (semielaborado_id, materia_prima_id, cantidad) VALUES ($1, $2, $3)", [semielaborado_id, item.id, item.cantidad || 1]);
        }
        await client.query("COMMIT");
        res.json({ success: true });
    } catch (e) { await client.query("ROLLBACK"); res.status(500).send(e.message); } finally { client.release(); }
});

module.exports = router;