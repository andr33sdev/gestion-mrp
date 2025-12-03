const express = require("express");
const router = express.Router();
const db = require("../db");
// Usamos el SDK oficial
const { GoogleGenAI } = require("@google/genai");
const { protect, restrictTo } = require("../middleware/auth");

// Configuración Cliente
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_NAME = "gemini-2.0-flash-lite";

router.use(protect);
router.use(restrictTo("GERENCIA"));

router.post("/chat", async (req, res) => {
  const { mensaje } = req.body;
  if (!mensaje) return res.status(400).json({ msg: "Escribe un mensaje." });

  try {
    const inicioAnio = new Date(new Date().getFullYear(), 0, 1)
      .toISOString()
      .split("T")[0];

    // 1. RECOPILACIÓN DE DATOS
    const [
      stockSemis,
      stockMP,
      planes,
      ventasMensuales,
      detalleVentasMensual,
      ultimosPedidos,
    ] = await Promise.all([
      // A. Inventario
      db.query(
        "SELECT codigo, nombre, stock_actual, alerta_1 FROM semielaborados ORDER BY nombre ASC"
      ),

      // B. Materias Primas
      db.query(
        "SELECT nombre, stock_actual, stock_minimo FROM materias_primas ORDER BY nombre ASC"
      ),

      // C. Producción
      db.query(
        "SELECT nombre, estado FROM planes_produccion WHERE estado = 'ABIERTO'"
      ),

      // D. Tendencia Global
      db.query(
        `
        SELECT to_char(fecha, 'Month') as mes, SUM(cantidad) as total 
        FROM pedidos WHERE fecha >= $1 
        GROUP BY to_char(fecha, 'Month'), to_char(fecha, 'MM') 
        ORDER BY to_char(fecha, 'MM') ASC
      `,
        [inicioAnio]
      ),

      // E. DETALLE POR PRODUCTO Y MES (Con Nombre de Mes para contexto)
      db.query(
        `
        SELECT to_char(fecha, 'MM') as mes_num, to_char(fecha, 'Month') as mes_nombre, modelo, SUM(cantidad) as total
        FROM pedidos
        WHERE fecha >= $1
        GROUP BY mes_num, mes_nombre, modelo
        ORDER BY mes_num DESC, total DESC
      `,
        [inicioAnio]
      ),

      // F. Últimos Pedidos
      db.query(`
        SELECT to_char(fecha, 'DD/MM') as f, cliente, modelo, cantidad, estado 
        FROM pedidos ORDER BY fecha DESC
      `),
    ]);

    // 2. PROCESAMIENTO DE TEXTO

    // Formato enriquecido para la IA: [Mes 11 - November] Modelo: Cantidad
    const textoDetalleMensual = detalleVentasMensual.rows
      .map(
        (r) =>
          `[Mes ${r.mes_num} - ${r.mes_nombre.trim()}] ${r.modelo}: ${r.total}`
      )
      .join("\n");

    const textoStock = stockSemis.rows
      .map((s) => `${s.codigo} (${s.nombre}): ${s.stock_actual}`)
      .join(", ");

    const textoMP = stockMP.rows
      .map((m) => `${m.nombre}: ${m.stock_actual}`)
      .join(", ");

    const textoTendencia = ventasMensuales.rows
      .map((v) => `${v.mes.trim()}: ${v.total}`)
      .join(" -> ");

    const textoPedidos = ultimosPedidos.rows
      .map((p) => `${p.f} | ${p.cliente} | ${p.modelo} (${p.cantidad})`)
      .join("\n");

    // 3. EL PROMPT AGRESIVO EN PROYECCIONES
    const fullPrompt = `
      ACTÚA COMO: Gerente de Inteligencia de Negocios de "Horno Rotomoldeo".
      FECHA HOY: ${new Date().toLocaleDateString("es-AR")}

      TIENES ACCESO TOTAL A LA BASE DE DATOS. AQUÍ ESTÁ TU CEREBRO:

      === 📅 1. ENCICLOPEDIA DE VENTAS POR PRODUCTO (MES A MES) ===
      ${textoDetalleMensual}
      --------------------------------------------------------------

      === 📊 2. TENDENCIA GLOBAL DE LA FÁBRICA ===
      ${textoTendencia}

      === 🏭 3. STOCK ACTUAL ===
      ${textoStock}

      === 🧪 4. MATERIAS PRIMAS ===
      ${textoMP}

      === 📦 5. ÚLTIMOS PEDIDOS ===
      ${textoPedidos}

      === ⚙️ 6. PRODUCCIÓN ACTIVA ===
      ${planes.rows.map((p) => p.nombre).join(", ") || "Sin planes."}

      --- INSTRUCCIONES ESTRICTAS ---
      1. **PRECISIÓN:** Si preguntan por un dato histórico (ej: Noviembre), BUSCA en la sección 1 y da el dato exacto.
      
      2. **PROYECCIONES (IMPORTANTE):** Si te piden una estimación para el mes en curso o futuro (ej: Diciembre), **NO DIGAS QUE NO TIENES DATOS**.
         - **TU TAREA:** Busca las ventas de ese producto en los últimos 3 meses en la sección 1.
         - **CALCULA:** Saca un promedio mental rápido.
         - **RESPONDE:** "Basado en la tendencia de los últimos 3 meses (X, Y, Z), proyecto que cerraremos Diciembre con aprox. [TU CÁLCULO] unidades."
      
      3. **RELACIONES:** Si preguntan por "Tanque 500" y ves "2071LE" en la lista con muchas ventas, asume que es ese y acláralo.

      PREGUNTA DEL GERENTE: "${mensaje}"
    `;

    // 4. GENERAR
    const result = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: fullPrompt,
    });

    res.json({ respuesta: result.text });
  } catch (error) {
    console.error("Error IA:", error);
    let errorMsg = "Error de conexión.";
    if (error.message.includes("404"))
      errorMsg = "Modelo no encontrado (Revisar API Key).";
    if (error.message.includes("503"))
      errorMsg = "Cerebro saturado, intenta de nuevo.";
    res.status(500).json({ respuesta: errorMsg });
  }
});

module.exports = router;
