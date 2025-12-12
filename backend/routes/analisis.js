const express = require("express");
const router = express.Router();
const db = require("../db");
const { protect } = require("../middleware/auth");

router.use(protect);

// --- HELPERS MATEMÁTICOS ---
function calcularPendiente(valores) {
  const n = valores.length;
  if (n < 2) return 0;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  valores.forEach((y, x) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });
  const denominador = n * sumXX - sumX * sumX;
  if (denominador === 0) return 0;
  return (n * sumXY - sumX * sumY) / denominador;
}

function calcularEstabilidad(valores) {
  const n = valores.length;
  if (n < 2) return 0;
  const media = valores.reduce((a, b) => a + b, 0) / n;
  if (media === 0) return 0;
  const variance = valores.reduce((a, b) => a + Math.pow(b - media, 2), 0) / n;
  return Math.sqrt(variance) / media;
}

router.get("/tendencias", async (req, res) => {
  try {
    // 1. CONSULTA HISTÓRICA MENSUAL (PRODUCTOS)
    const queryMensualProd = `
      SELECT 
        to_char(fecha, 'YYYY-MM') as periodo,
        modelo,
        SUM(cantidad) as total
      FROM pedidos
      WHERE fecha >= date_trunc('month', NOW() - INTERVAL '6 months')
        AND (estado IS NULL OR UPPER(estado) NOT LIKE '%CANCELADO%')
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `;

    // 2. CONSULTA SEMANAL
    const querySemanal = `
      SELECT 
        to_char(fecha, 'IYYY-IW') as periodo,
        modelo,
        SUM(cantidad) as total
      FROM pedidos
      WHERE fecha >= date_trunc('week', NOW() - INTERVAL '12 weeks')
        AND (estado IS NULL OR UPPER(estado) NOT LIKE '%CANCELADO%')
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `;

    // 3. CONSULTA GLOBALES (12 MESES)
    const queryGlobal = `
      SELECT 
        to_char(fecha, 'YYYY-MM') as mes_key,
        to_char(fecha, 'TMMon') as mes_nombre,
        COALESCE(SUM(cantidad), 0) as total,
        COALESCE(SUM(CASE WHEN detalles ILIKE '%MercadoLibre%' OR cliente ILIKE '%MercadoLibre%' THEN cantidad ELSE 0 END), 0) as ml
      FROM pedidos
      WHERE fecha >= date_trunc('month', NOW() - INTERVAL '11 months')
        AND (estado IS NULL OR UPPER(estado) NOT LIKE '%CANCELADO%')
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `;

    // 4. CONSULTA MTD (MES ACTUAL vs MES PASADO)
    const queryMTD = `
      SELECT 
        -- Actual Total
        COALESCE(SUM(CASE 
            WHEN date_trunc('month', fecha) = date_trunc('month', NOW()) 
            THEN cantidad ELSE 0 
        END), 0) as actual_total,
        
        -- Anterior Mismo Día
        COALESCE(SUM(CASE 
            WHEN date_trunc('month', fecha) = date_trunc('month', NOW() - INTERVAL '1 month') 
                 AND EXTRACT(DAY FROM fecha) <= EXTRACT(DAY FROM NOW())
            THEN cantidad ELSE 0 
        END), 0) as anterior_mismo_dia,

        -- Anterior Total Final
        COALESCE(SUM(CASE 
            WHEN date_trunc('month', fecha) = date_trunc('month', NOW() - INTERVAL '1 month') 
            THEN cantidad ELSE 0 
        END), 0) as anterior_total_final

      FROM pedidos
      WHERE fecha >= date_trunc('month', NOW() - INTERVAL '1 month')
      AND (estado IS NULL OR UPPER(estado) NOT LIKE '%CANCELADO%')
    `;

    const [resMensual, resSemanal, resGlobal, resMTD] = await Promise.all([
      db.query(queryMensualProd),
      db.query(querySemanal),
      db.query(queryGlobal),
      db.query(queryMTD),
    ]);

    // --- PROCESAMIENTO TENDENCIAS PRODUCTOS ---
    const mapMensual = {};
    const meses = [...new Set(resMensual.rows.map((r) => r.periodo))].sort();
    const mesActualIso = new Date().toISOString().slice(0, 7);
    const mesesCerrados = meses.filter((m) => m !== mesActualIso);

    resMensual.rows.forEach((r) => {
      if (r.periodo === mesActualIso) return;
      if (!mapMensual[r.modelo])
        mapMensual[r.modelo] = Array(mesesCerrados.length).fill(0);
      const idx = mesesCerrados.indexOf(r.periodo);
      if (idx >= 0) mapMensual[r.modelo][idx] = Number(r.total);
    });

    const tendencias = Object.keys(mapMensual)
      .map((modelo) => {
        const historia = mapMensual[modelo];
        const total = historia.reduce((a, b) => a + b, 0);
        const ceros = historia.filter((v) => v === 0).length;

        if (ceros > 2 || total < 20) return null;

        return {
          modelo,
          historia,
          pendiente: calcularPendiente(historia),
          estabilidad: calcularEstabilidad(historia),
          ultimo_valor: historia[historia.length - 1],
          total,
        };
      })
      .filter(Boolean);

    const onFire = tendencias
      .filter((t) => t.pendiente > 2)
      .sort((a, b) => b.pendiente - a.pendiente);
    const coolingDown = tendencias
      .filter((t) => t.pendiente < -1)
      .sort((a, b) => a.pendiente - b.pendiente);
    const estables = tendencias
      .filter((t) => Math.abs(t.pendiente) < 10 && t.estabilidad < 0.4)
      .sort((a, b) => b.total - a.total);

    // --- PROCESAMIENTO SEMANAL ---
    const mapSemanal = {};
    const semanas = [...new Set(resSemanal.rows.map((r) => r.periodo))].sort();
    const ultimas8Semanas = semanas.slice(-9, -1);

    resSemanal.rows.forEach((r) => {
      if (!ultimas8Semanas.includes(r.periodo)) return;
      if (!mapSemanal[r.modelo])
        mapSemanal[r.modelo] = Array(ultimas8Semanas.length).fill(0);
      const idx = ultimas8Semanas.indexOf(r.periodo);
      mapSemanal[r.modelo][idx] = Number(r.total);
    });

    const aceleracion = Object.keys(mapSemanal)
      .map((modelo) => {
        const h = mapSemanal[modelo];
        const actual = h.slice(4, 8).reduce((a, b) => a + b, 0);
        const anterior = h.slice(0, 4).reduce((a, b) => a + b, 0);
        if (anterior < 5) return null;
        const crec = ((actual - anterior) / anterior) * 100;
        return { modelo, historia: h, crecimiento: Math.round(crec), actual };
      })
      .filter(Boolean)
      .filter((p) => p.crecimiento > 20)
      .sort((a, b) => b.crecimiento - a.crecimiento);

    // --- PROCESAMIENTO GLOBALES ---
    const graficoGlobal = resGlobal.rows.map((r) => ({
      mes_nombre: r.mes_nombre,
      total: Number(r.total),
      ml: Number(r.ml),
    }));

    // --- NUEVO CÁLCULO DE PROYECCIÓN (RUN RATE) ---
    const mtdRaw = resMTD.rows[0] || {};
    const actualMTD = Number(mtdRaw.actual_total || 0);

    const hoy = new Date();
    const diaActual = hoy.getDate(); // Ej: 4
    const diasEnMes = new Date(
      hoy.getFullYear(),
      hoy.getMonth() + 1,
      0
    ).getDate(); // Ej: 31

    let proyeccionGlobal = 0;

    if (actualMTD > 0 && diaActual > 0) {
      // Fórmula Run Rate: (Lo que llevo / Días que pasaron) * Días Totales
      // Ejemplo: (2000 / 4) * 31 = 15.500
      proyeccionGlobal = Math.round((actualMTD / diaActual) * diasEnMes);
    } else {
      // Fallback a histórico si es día 1 a la mañana
      const historiaGlobal = graficoGlobal.slice(0, -1).map((r) => r.total);
      const pendienteGlobal = calcularPendiente(historiaGlobal.slice(-6));
      const ultimoTotal = historiaGlobal[historiaGlobal.length - 1] || 0;
      proyeccionGlobal = Math.max(0, Math.round(ultimoTotal + pendienteGlobal));
    }

    // ML Share
    const totalYear = graficoGlobal.reduce((acc, curr) => acc + curr.total, 0);
    const mlYear = graficoGlobal.reduce((acc, curr) => acc + curr.ml, 0);
    const mlShare = totalYear > 0 ? Math.round((mlYear / totalYear) * 100) : 0;

    // MTD Progreso
    const anteriorMismoDia = Number(mtdRaw.anterior_mismo_dia || 0);
    let progreso = 0;
    if (anteriorMismoDia > 0) {
      progreso = Math.round(
        ((actualMTD - anteriorMismoDia) / anteriorMismoDia) * 100
      );
    } else if (actualMTD > 0) {
      progreso = 100;
    }

    res.json({
      on_fire: onFire,
      estables: estables,
      aceleracion: aceleracion,
      cooling_down: coolingDown,
      grafico_global: graficoGlobal,
      proyeccion_global: proyeccionGlobal, // Ahora usa Run Rate
      ml_share: mlShare,
      mtd: {
        actual: actualMTD,
        anterior_mismo_dia: anteriorMismoDia,
        anterior_total: Number(mtdRaw.anterior_total_final || 0),
        progreso_porcentaje: progreso,
      },
    });
  } catch (e) {
    console.error("Error Análisis:", e);
    res.status(500).send(e.message);
  }
});

// --- NUEVO: RUNWAY DE INSUMOS (RELOJ DE ARENA) ---
router.get("/insumos-runway", async (req, res) => {
  try {
    const diasAnalisis = 90; // Miramos 3 meses atrás para el promedio

    // 1. Traer Stock Actual de Materias Primas
    const { rows: mps } = await db.query(
      "SELECT id, codigo, nombre, stock_actual, stock_minimo FROM materias_primas"
    );

    // 2. Traer Ventas de los últimos 90 días
    // (Normalizamos nombre para cruzar con recetas)
    const ventasRes = await db.query(`
        SELECT UPPER(modelo) as modelo, SUM(cantidad) as total_vendido
        FROM pedidos
        WHERE fecha >= NOW() - INTERVAL '${diasAnalisis} days'
          AND (estado IS NULL OR UPPER(estado) NOT LIKE '%CANCELADO%')
        GROUP BY UPPER(modelo)
    `);

    // 3. Traer Recetas (Semielaborado -> Materias Primas)
    // Necesitamos cruzar el Nombre del Modelo (Venta) -> Semielaborado -> MP
    // Asumimos que el "Modelo" del pedido coincide con el "Nombre" del Semielaborado
    const recetasRes = await db.query(`
        SELECT UPPER(s.nombre) as modelo, mp.id as mp_id, rs.cantidad
        FROM recetas_semielaborados rs
        JOIN semielaborados s ON rs.semielaborado_id = s.id
        JOIN materias_primas mp ON rs.materia_prima_id = mp.id
    `);

    // --- CÁLCULO DE CONSUMO DIARIO (BURN RATE) ---
    const consumoDiarioMap = {}; // { mp_id: 2.5 } (2.5 kg por día)

    ventasRes.rows.forEach((venta) => {
      // Buscar recetas que coincidan con este modelo vendido
      const recetasDelModelo = recetasRes.rows.filter(
        (r) => r.modelo === venta.modelo
      );

      recetasDelModelo.forEach((ingrediente) => {
        const consumoTotalPeriodo = ingrediente.cantidad * venta.total_vendido;
        const consumoDiario = consumoTotalPeriodo / diasAnalisis;

        if (!consumoDiarioMap[ingrediente.mp_id])
          consumoDiarioMap[ingrediente.mp_id] = 0;
        consumoDiarioMap[ingrediente.mp_id] += consumoDiario;
      });
    });

    // --- ARMADO DEL REPORTE FINAL ---
    const reporte = mps.map((mp) => {
      const burnRate = consumoDiarioMap[mp.id] || 0; // Consumo diario
      const stock = Number(mp.stock_actual);

      let diasRestantes = 9999;
      let fechaAgotamiento = null;

      if (burnRate > 0) {
        diasRestantes = Math.floor(stock / burnRate);
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + diasRestantes);
        fechaAgotamiento = fecha.toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "short",
        });
      }

      // Clasificación de Urgencia
      let status = "SAFE"; // +30 días
      if (diasRestantes <= 7) status = "CRITICAL"; // 1 semana o menos
      else if (diasRestantes <= 30) status = "WARNING"; // Menos de un mes

      return {
        id: mp.id,
        nombre: mp.nombre,
        codigo: mp.codigo,
        stock_actual: stock,
        stock_minimo: Number(mp.stock_minimo),
        burn_rate: Number(burnRate.toFixed(2)), // Cuánto gasto por día
        dias_restantes: diasRestantes,
        fecha_agotamiento: fechaAgotamiento,
        status,
      };
    });

    // Ordenar: Primero lo Crítico (menor días restantes)
    const reporteOrdenado = reporte.sort(
      (a, b) => a.dias_restantes - b.dias_restantes
    );

    res.json(reporteOrdenado);
  } catch (e) {
    console.error("Error Runway:", e);
    res.status(500).send(e.message);
  }
});

module.exports = router;
