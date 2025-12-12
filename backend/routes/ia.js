// backend/routes/ia.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// --- USAMOS LA LIBRERÍA ESTÁNDAR COMPATIBLE ---
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { protect, restrictTo } = require("../middleware/auth");

// Configuración Cliente
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Usamos el modelo Flash estable.
// Si este te da 404, cambia a "gemini-pro"
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

router.use(protect);
router.use(restrictTo("GERENCIA"));

router.post("/chat", async (req, res) => {
  const { mensaje } = req.body;
  if (!mensaje) return res.status(400).json({ msg: "Escribe un mensaje." });

  try {
    const inicioAnio = new Date(new Date().getFullYear(), 0, 1)
      .toISOString()
      .split("T")[0];

    // 1. RECOPILACIÓN MASIVA DE DATOS
    const [
      stockSemis, // Inventario actual
      stockMP, // Materias primas
      planes, // Producción en curso
      ventasMensuales, // Tendencia global (La "foto" macro)
      detalleVentasMensual, // Detalle fino por producto
      ultimosPedidos, // Contexto inmediato
    ] = await Promise.all([
      // A. Inventario Completo
      db.query(
        "SELECT codigo, nombre, stock_actual, alerta_1 FROM semielaborados ORDER BY nombre ASC"
      ),

      // B. Insumos
      db.query(
        "SELECT nombre, stock_actual, stock_minimo FROM materias_primas ORDER BY nombre ASC"
      ),

      // C. Producción
      db.query(
        "SELECT nombre, estado FROM planes_produccion WHERE estado = 'ABIERTO'"
      ),

      // D. Tendencia Global (Suma de todo)
      db.query(
        `
        SELECT to_char(fecha, 'Month') as mes, SUM(cantidad) as total 
        FROM pedidos WHERE fecha >= $1 
        GROUP BY to_char(fecha, 'Month'), to_char(fecha, 'MM') 
        ORDER BY to_char(fecha, 'MM') ASC
      `,
        [inicioAnio]
      ),

      // E. DETALLE POR PRODUCTO Y MES (LA ENCICLOPEDIA)
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
        FROM pedidos ORDER BY fecha DESC LIMIT 50
      `),
    ]);

    // 2. PROCESAMIENTO DE TEXTO

    // Formato: [Mes 11 - November] Modelo: Cantidad
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

    // 3. EL PROMPT
    const fullPrompt = `
      ACTÚA COMO: Gerente de Inteligencia de Negocios de "Horno Rotomoldeo".
      FECHA HOY: ${new Date().toLocaleDateString("es-AR")}

      TIENES ACCESO TOTAL A LA BASE DE DATOS. AQUÍ ESTÁ TU CEREBRO:

      === 📅 1. ENCICLOPEDIA DE VENTAS POR PRODUCTO (MES A MES) ===
      (Usa esta sección para responder "¿Cuánto se vendió de X en Noviembre?")
      Formato: [Mes] Modelo: Cantidad
      --------------------------------------------------------------
      ${textoDetalleMensual}
      --------------------------------------------------------------

      === 📊 2. TENDENCIA GLOBAL DE LA FÁBRICA ===
      ${textoTendencia}

      === 🏭 3. STOCK ACTUAL (ALMACÉN) ===
      ${textoStock}

      === 🧪 4. MATERIAS PRIMAS ===
      ${textoMP}

      === 📦 5. ÚLTIMOS PEDIDOS (TIEMPO REAL) ===
      ${textoPedidos}

      === ⚙️ 6. PRODUCCIÓN ACTIVA ===
      ${planes.rows.map((p) => p.nombre).join(", ") || "Sin planes."}

      --- INSTRUCCIONES DE RESPUESTA ---
      1. **PRECISIÓN:** Si te preguntan por un producto y un mes específico (ej: "2071LE en Noviembre"), BUSCA en la sección 1 (Enciclopedia). Tienes el dato exacto ahí.
      2. **PROYECCIONES:** Si te piden estimar el futuro (o el cierre del mes actual), calcula el promedio de los últimos 3 meses de la sección 1 y proyéctalo. ACLARA que es una estimación.
      3. **TOTALES:** Si te piden el total anual de un producto, suma los valores mensuales mentalmente.
      4. **ESTILO:** Sé profesional y breve.

      PREGUNTA DEL GERENTE: "${mensaje}"
    `;

    // 4. GENERAR (SINTAXIS ESTÁNDAR)
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    res.json({ respuesta: text });
  } catch (error) {
    console.error("Error IA:", error);

    let errorMsg = "Error de conexión.";
    if (error.message.includes("404"))
      errorMsg =
        "Error 404: Modelo no encontrado (Verifica API Key o nombre del modelo).";
    if (error.message.includes("503"))
      errorMsg = "Cerebro saturado (503). Intenta de nuevo.";

    res.status(500).json({ respuesta: errorMsg });
  }
});

module.exports = router;
