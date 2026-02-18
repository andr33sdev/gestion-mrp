import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FaUsers,
  FaCubes,
  FaChartLine,
  FaSpinner,
  FaExclamationTriangle,
  FaRocket,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaTrophy,
  FaMedal,
  FaListOl,
  FaCalendarCheck,
  FaSync,
  FaEye,
  FaEyeSlash,
  FaBalanceScale,
  FaChartPie,
  FaTimes,
  FaListUl,
  FaMinus,
  FaQuestionCircle,
  FaCalendarDay,
  FaCalendarWeek,
  FaCalendarAlt,
  FaCalendar,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";
import { PEDIDOS_API_URL, API_BASE_URL, authFetch } from "../utils.js";
import SearchBar from "../components/analisis/SearchBar";
import ConsumptionView from "../components/analisis/ConsumptionView";
import DetailModal from "../components/analisis/DetailModal";
import TendenciasView from "../components/analisis/TendenciasView";

const RECETAS_ALL_URL = `${API_BASE_URL}/ingenieria/recetas/all`;
const STOCK_SEMIS_URL = `${API_BASE_URL}/ingenieria/semielaborados`;

const normalizeKey = (key) => (key || "").trim().toUpperCase();

// --- PARSEO DE FECHAS "TODOTERRENO" ---
const parseDate = (dateStr) => {
  if (!dateStr) return null;

  // Si ya es objeto fecha
  if (Object.prototype.toString.call(dateStr) === "[object Date]") {
    return isNaN(dateStr) ? null : dateStr;
  }

  const str = String(dateStr).trim();

  // 1. Caso ISO (YYYY-MM-DD...) - Formato DB Nuevo
  if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
    const d = new Date(str);
    // Ajuste de zona horaria simple si viene sin hora (evita el día anterior)
    if (str.length === 10) {
      return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    }
    return isNaN(d) ? null : d;
  }

  // 2. Caso Barras (DD/MM/YYYY o DD/MM/YY) - Formato Excel Humano
  // ESTE ES EL QUE ARREGLA EL PROBLEMA DE MES INVERTIDO
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Meses 0-11
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000; // Corrección año corto
      const d = new Date(year, month, day);
      return isNaN(d) ? null : d;
    }
  }

  // 3. Caso Serial Excel (Número como String) - Formato Excel Crudo
  if (str.match(/^\d+$/)) {
    const val = parseInt(str, 10);
    if (val > 30000 && val < 60000) {
      // Rango razonable de fechas actuales
      const fechaBase = new Date(1899, 11, 30);
      const dias = Math.floor(val);
      const ms = (val - dias) * 86400 * 1000;
      return new Date(fechaBase.getTime() + dias * 86400000 + ms);
    }
  }

  // Fallback
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

// --- PARSEO DE CANTIDAD ROBUSTO ---
const parseCantidad = (val) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  // Quitamos puntos de mil y convertimos coma decimal a punto (si hubiera)
  const limpio = val.toString().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(limpio);
  return isNaN(num) ? 0 : num;
};

const RankIcon = ({ index }) => {
  if (index === 0) return <FaTrophy className="text-yellow-400" />;
  if (index === 1) return <FaMedal className="text-gray-300" />;
  if (index === 2) return <FaMedal className="text-amber-600" />;
  return (
    <span className="text-gray-500 font-mono font-bold text-xs">
      #{index + 1}
    </span>
  );
};

const PortalTooltip = ({ coords, children }) => {
  if (!coords) return null;
  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: coords.left,
        top: coords.top,
        transform: "translateX(-50%) translateY(-100%) translateY(-8px)",
      }}
    >
      {children}
    </div>,
    document.body,
  );
};

const Sparkline = ({ data, color = "#8884d8" }) => {
  if (!data || data.length === 0)
    return <div className="h-8 w-24 bg-slate-800/50 rounded"></div>;

  const chartData = data.map((val, i) => ({ i, v: val }));

  return (
    <div className="h-10 w-32 ml-auto">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`grad_${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={`url(#grad_${color})`}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TrendWidget = ({ trend, value }) => {
  const [tooltipCoords, setTooltipCoords] = useState(null);

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipCoords({
      left: rect.left + rect.width / 2,
      top: rect.top,
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="font-mono font-bold text-blue-300 text-sm">{value}</span>

      <div className="flex items-center gap-1">
        {trend === "up" && <FaArrowUp className="text-green-400 text-xs" />}
        {trend === "down" && <FaArrowDown className="text-red-400 text-xs" />}
        {trend === "neutral" && (
          <FaMinus className="text-gray-600 text-[10px]" />
        )}

        <div
          className="cursor-help ml-1"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setTooltipCoords(null)}
        >
          <FaQuestionCircle className="text-slate-600 text-[10px] hover:text-slate-400 transition-colors" />
        </div>

        <PortalTooltip coords={tooltipCoords}>
          <div className="w-56 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <p className="font-bold mb-1 text-gray-200">
              Momentum (Velocidad):
            </p>
            <p className="leading-relaxed text-gray-400 mb-2">
              Compara el promedio de ventas de los{" "}
              <span className="text-blue-300">últimos 2 meses</span> contra tu
              promedio <span className="text-blue-300">semestral</span>.
            </p>
            <div className="pt-2 border-t border-slate-700/50 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="bg-green-500/20 p-1 rounded">
                  <FaArrowUp className="text-green-400" />
                </div>
                <span className="text-gray-300">Acelerando (+10%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-red-500/20 p-1 rounded">
                  <FaArrowDown className="text-red-400" />
                </div>
                <span className="text-gray-300">Frenando (-10%)</span>
              </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-700"></div>
          </div>
        </PortalTooltip>
      </div>
    </div>
  );
};

const ParetoModal = ({ isOpen, onClose, data, isCli }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        <div className="p-6 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 rounded-lg">
              <FaChartPie className="text-indigo-400 text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Análisis de Pareto (80/20)
              </h2>
              <p className="text-sm text-gray-400">
                Estos {data.count80} {isCli ? "clientes" : "productos"} generan
                el 80% de tu volumen.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-0">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-slate-950/50 text-gray-400 uppercase text-xs sticky top-0 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 w-16 text-center">Rank</th>
                <th className="px-6 py-4">{isCli ? "Cliente" : "Producto"}</th>
                <th className="px-6 py-4 text-right">Cantidad</th>
                <th className="px-6 py-4 text-right">% Relativo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.topItems.map((item, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4 text-center font-mono text-gray-500">
                    #{idx + 1}
                  </td>
                  <td className="px-6 py-4 font-bold text-white">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-indigo-300">
                    {item.value}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">
                    {item.percent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-800 border-t border-slate-700 text-center text-xs text-gray-500">
          Prioridad Alta: Cualquier quiebre de stock o problema con estos ítems
          afecta drásticamente el resultado mensual.
        </div>
      </div>
    </div>
  );
};

export default function AnalisisPedidos() {
  const [datosPedidos, setDatosPedidos] = useState([]);
  const [datosRecetas, setDatosRecetas] = useState({});
  const [datosStock, setDatosStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [view, setView] = useState("DASHBOARD");
  const [modoVista, setModoVista] = useState("PRODUCTOS");
  const [busqueda, setBusqueda] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [modalPage, setModalPage] = useState(1);
  const [historialFilter, setHistorialFilter] = useState("TODOS");
  const [incluirMesActual, setIncluirMesActual] = useState(false);
  const [chartResolution, setChartResolution] = useState("MENSUAL");
  const [incluirMesActualModal, setIncluirMesActualModal] = useState(false);
  const [showParetoModal, setShowParetoModal] = useState(false);

  const MODAL_ITEMS_PER_PAGE = 5;

  const cargarDatos = () => {
    setLoading(true);
    setErrorMsg(null);
    const t = Date.now();

    Promise.all([
      authFetch(`${PEDIDOS_API_URL}?t=${t}`).then(async (r) => {
        if (!r.ok) throw new Error(`Error Pedidos (${r.status})`);
        return r.json();
      }),
      authFetch(RECETAS_ALL_URL).then(async (r) => {
        if (!r.ok) throw new Error(`Error Recetas (${r.status})`);
        return r.json();
      }),
      authFetch(STOCK_SEMIS_URL).then(async (r) => {
        if (!r.ok) throw new Error(`Error Stock (${r.status})`);
        return r.json();
      }),
    ])
      .then(([pedidos, recetas, stock]) => {
        setDatosPedidos(pedidos || []);
        setDatosRecetas(recetas || {});
        setDatosStock(stock || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("❌ Error cargando datos:", error);
        setErrorMsg(error.message || "Error de conexión.");
        setLoading(false);
      });
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const analysisData = useMemo(() => {
    if (!datosPedidos || datosPedidos.length === 0) return null;
    const now = new Date();

    const last12Months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = d.toLocaleDateString("es-AR", { month: "short" });
      const yShort = d.getFullYear().toString().slice(-2);
      const label = `${
        mName.charAt(0).toUpperCase() + mName.slice(1)
      } ${yShort}`;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      last12Months.push({ label, key, total: 0 });
    }

    const getMonthIndex = (dateObj) => {
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
      return last12Months.findIndex((m) => m.key === key);
    };

    const normalizedRecetas = {};
    Object.keys(datosRecetas).forEach((key) => {
      normalizedRecetas[normalizeKey(key)] = datosRecetas[key];
    });

    const stockMap = {};
    datosStock.forEach((s) => {
      const key = normalizeKey(s.nombre);
      const sumaFila =
        Number(s.stock_planta_26 || 0) +
        Number(s.stock_planta_37 || 0) +
        Number(s.stock_deposito_ayolas || 0) +
        Number(s.stock_deposito_quintana || 0);
      stockMap[key] = Math.max(stockMap[key] || 0, sumaFila);
    });

    const uniqueOrders = new Set(),
      uniqueMLOrders = new Set(),
      uniqueOpsGlobal = new Set();
    const prodMapY = {},
      prodMapM = {},
      prodMapW = {};
    const cliMapY = {},
      cliMapM = {},
      cliMapW = {};
    const prodTrendMap = {},
      cliTrendMap = {};

    const activeClients = new Set(),
      allClients = new Set(),
      allModels = new Set();
    const consumoTotalPeriodo = {},
      missingRecipesMap = {};

    datosPedidos.forEach((row) => {
      const d = parseDate(row.fecha || row.FECHA || row.Fecha);
      if (!d) return;

      const idx = getMonthIndex(d);
      const isInWindow = idx !== -1;
      const estado = (row.estado || row.ESTADO || "").toString().toUpperCase();
      if (estado.includes("CANCELADO")) return;

      // PARSEO SEGURO DE CANTIDAD
      const cantVendida = parseCantidad(row.cantidad || row.CANTIDAD || 1);

      const prodName = row.modelo || row.MODELO || "Desconocido";
      const cliName = row.cliente || row.CLIENTE || "Desconocido";
      const detalles = (row.detalles || row.DETALLES || "")
        .toString()
        .toLowerCase();
      const oc = row.oc_cliente || row.OC || row.oc;
      const op = row.op || row.OP;
      const prodKey = normalizeKey(prodName);
      const cliKey = normalizeKey(cliName);

      if (isInWindow) {
        last12Months[idx].total++;
        const isML =
          detalles.includes("mercadolibre") ||
          cliName.toLowerCase().includes("mercadolibre");

        if (oc && oc !== "-" && oc !== "0") {
          uniqueOrders.add(oc);
          if (isML) uniqueMLOrders.add(oc);
        }
        if (op && op !== "-" && op !== "0") uniqueOpsGlobal.add(op);

        if (cliName !== "Desconocido") {
          allClients.add(cliName);
          if (!isML) activeClients.add(cliName);
          cliMapY[cliKey] = (cliMapY[cliKey] || 0) + cantVendida;
          if (!cliTrendMap[cliKey]) cliTrendMap[cliKey] = Array(12).fill(0);
          cliTrendMap[cliKey][idx] += cantVendida;
        }

        if (prodName !== "Desconocido") {
          allModels.add(prodName);
          prodMapY[prodKey] = (prodMapY[prodKey] || 0) + cantVendida;
          if (!prodTrendMap[prodKey]) prodTrendMap[prodKey] = Array(12).fill(0);
          prodTrendMap[prodKey][idx] += cantVendida;

          const receta = normalizedRecetas[prodKey];
          if (receta && receta.length > 0) {
            receta.forEach((insumo) => {
              const insumoKey = normalizeKey(insumo.nombre);
              if (!consumoTotalPeriodo[insumoKey]) {
                consumoTotalPeriodo[insumoKey] = {
                  name: insumo.nombre,
                  total: 0,
                  months: Array(12).fill(0),
                  usedIn: {},
                  history: [],
                };
              }
              const cantidadConsumida = insumo.cantidad * cantVendida;
              consumoTotalPeriodo[insumoKey].total += cantidadConsumida;
              consumoTotalPeriodo[insumoKey].months[idx] += cantidadConsumida;
              if (!consumoTotalPeriodo[insumoKey].usedIn[prodName]) {
                consumoTotalPeriodo[insumoKey].usedIn[prodName] = 0;
              }
              consumoTotalPeriodo[insumoKey].usedIn[prodName] +=
                cantidadConsumida;

              consumoTotalPeriodo[insumoKey].history.push({
                fecha: d.toLocaleDateString("es-AR"),
                cant: cantidadConsumida,
              });
            });
          } else {
            const causa = receta ? "Receta Vacía" : "Sin Receta";
            if (!missingRecipesMap[prodKey])
              missingRecipesMap[prodKey] = {
                name: prodName,
                count: 0,
                reason: causa,
              };
            missingRecipesMap[prodKey].count += cantVendida;
          }
        }
      }

      const startOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      );
      const startOfWeek = new Date(now);
      startOfWeek.setDate(
        now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1),
      );
      startOfWeek.setHours(0, 0, 0, 0);

      if (d >= startOfCurrentMonth) {
        if (cliName !== "Desconocido")
          cliMapM[cliKey] = (cliMapM[cliKey] || 0) + cantVendida;
        if (prodName !== "Desconocido")
          prodMapM[prodKey] = (prodMapM[prodKey] || 0) + cantVendida;
      }
      if (d >= startOfWeek) {
        if (cliName !== "Desconocido")
          cliMapW[cliKey] = (cliMapW[cliKey] || 0) + cantVendida;
        if (prodName !== "Desconocido")
          prodMapW[prodKey] = (prodMapW[prodKey] || 0) + cantVendida;
      }
    });

    const calculateTrend = (monthlyData) => {
      if (!monthlyData) return "neutral";
      const last6Months = monthlyData.slice(5, 11);
      const total6Months = last6Months.reduce((acc, val) => acc + val, 0);
      const avgBase = total6Months / 6;
      const last2Months = monthlyData.slice(9, 11);
      const total2Months = last2Months.reduce((acc, val) => acc + val, 0);
      const avgRecent = total2Months / 2;
      if (avgBase === 0) return "neutral";
      if (avgRecent > avgBase * 1.1) return "up";
      if (avgRecent < avgBase * 0.9) return "down";
      return "neutral";
    };

    const getTop = (map, trendMap, n) =>
      Object.entries(map)
        .map(([name, value]) => ({
          name,
          value,
          trend: calculateTrend(trendMap[name]),
          history: (trendMap[name] || Array(12).fill(0)).slice(0, -1),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, n);

    const calculatePareto = (map) => {
      const sorted = Object.entries(map)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      const total = sorted.reduce((sum, item) => sum + item.value, 0);
      const cutoff = total * 0.8;
      let currentSum = 0;
      const topItems = [];
      for (let item of sorted) {
        currentSum += item.value;
        topItems.push({
          ...item,
          percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0",
        });
        if (currentSum >= cutoff) break;
      }
      return { count80: topItems.length, totalItems: sorted.length, topItems };
    };

    const paretoProd = calculatePareto(prodMapY);
    const paretoCli = calculatePareto(cliMapY);
    const topProdY = getTop(prodMapY, prodTrendMap, 10);
    const topCliY = getTop(cliMapY, cliTrendMap, 10);

    const salesByMonth = last12Months.map((m) => ({
      mes: m.label,
      ventas: m.total,
    }));
    const recordMonth = [...salesByMonth].sort(
      (a, b) => b.ventas - a.ventas,
    )[0];

    let criticalItemsCount = 0;
    const consumoData = Object.values(consumoTotalPeriodo)
      .map((data) => {
        const stock = stockMap[normalizeKey(data.name)] || 0;
        const last6Months = data.months.slice(5, 11);
        const total6Months = last6Months.reduce((acc, val) => acc + val, 0);
        const promedioMensual = total6Months / 6;
        const promedioDiario = promedioMensual / 30;
        const diasRestantes =
          promedioDiario > 0 ? stock / promedioDiario : 9999;

        if (diasRestantes < 7) criticalItemsCount++;

        const trend = calculateTrend(data.months);

        return {
          name: data.name,
          value: data.total,
          stock: stock,
          monthly: promedioMensual.toFixed(0),
          daily: promedioDiario.toFixed(2),
          daysLeft: diasRestantes === 9999 ? "∞" : diasRestantes.toFixed(1),
          daysLeftVal: diasRestantes,
          trend: trend,
          chartData: last12Months.map((m, i) => ({
            mes: m.label,
            consumo: data.months[i] || 0,
          })),
          usedInChart: Object.entries(data.usedIn)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
          history: data.history,
        };
      })
      .sort((a, b) => a.daysLeftVal - b.daysLeftVal);

    const missingData = Object.values(missingRecipesMap).sort(
      (a, b) => b.count - a.count,
    );
    const oneYearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const filteredRaw = datosPedidos.filter((row) => {
      const d = parseDate(row.fecha || row.FECHA || row.Fecha);
      return d && d >= oneYearAgo;
    });

    return {
      salesByMonth,
      totalOrders: uniqueOrders.size,
      totalOps: uniqueOpsGlobal.size,
      mlOrders: uniqueMLOrders.size,
      recordMonthName: recordMonth?.mes || "-",
      recordMax: recordMonth?.ventas || 1,
      raw: filteredRaw,
      prod: {
        y: topProdY,
        m: getTop(prodMapM, prodTrendMap, 5),
        w: getTop(prodMapW, prodTrendMap, 5),
        list: Array.from(allModels).sort(),
        pareto: paretoProd,
      },
      cli: {
        y: topCliY,
        active: activeClients.size,
        m: getTop(cliMapM, cliTrendMap, 5),
        w: getTop(cliMapW, cliTrendMap, 5),
        list: Array.from(allClients).sort(),
        pareto: paretoCli,
      },
      consumo: consumoData,
      criticalItemsCount,
      missingRecipes: missingData,
      daysAnalyzed: 365,
    };
  }, [datosPedidos, datosRecetas, datosStock]);

  const mainChartData = useMemo(() => {
    if (!datosPedidos || datosPedidos.length === 0) return [];
    const now = new Date();

    const buckets = {};
    let labels = [];

    if (chartResolution === "DIARIA") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
        });
        const key = d.toISOString().split("T")[0];
        buckets[key] = 0;
        labels.push({ label, key });
      }

      datosPedidos.forEach((row) => {
        const d = parseDate(row.fecha || row.FECHA);
        if (!d) return;
        const key = d.toISOString().split("T")[0];
        if (
          buckets.hasOwnProperty(key) &&
          !row.estado?.toString().toUpperCase().includes("CANCELADO")
        ) {
          buckets[key] += 1;
        }
      });
    } else if (chartResolution === "SEMANAL") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const weekKey = getWeekNumber(d);
        const label = `Sem ${weekKey.split("-W")[1]}`;
        buckets[weekKey] = 0;
        labels.push({ label, key: weekKey });
      }

      datosPedidos.forEach((row) => {
        const d = parseDate(row.fecha || row.FECHA);
        if (!d) return;
        const key = getWeekNumber(d);
        if (
          buckets.hasOwnProperty(key) &&
          !row.estado?.toString().toUpperCase().includes("CANCELADO")
        ) {
          buckets[key] += 1;
        }
      });
    } else {
      if (!analysisData) return [];
      return incluirMesActual
        ? analysisData.salesByMonth
        : analysisData.salesByMonth.slice(0, -1);
    }

    const result = labels.map((l) => ({
      mes: l.label,
      ventas: buckets[l.key],
    }));

    return result;
  }, [datosPedidos, chartResolution, analysisData, incluirMesActual]);

  const handleSearch = (val) => {
    setBusqueda(val);
    if (val && analysisData) {
      const list =
        modoVista === "PRODUCTOS"
          ? analysisData.prod.list
          : analysisData.cli.list;
      setSugerencias(
        list.filter((i) => i.toLowerCase().includes(val.toLowerCase())),
      );
      setMostrarSugerencias(true);
    } else setMostrarSugerencias(false);
  };

  const selectItem = (name) => {
    setBusqueda("");
    setMostrarSugerencias(false);
    setModalPage(1);
    setHistorialFilter("TODOS");

    const rows = analysisData.raw.filter(
      (r) =>
        (modoVista === "PRODUCTOS"
          ? r.modelo || r.MODELO
          : r.cliente || r.CLIENTE) === name,
    );

    let total = 0;
    const pieMap = {};
    const now = new Date();

    const getMonthIndex = (d) => {
      const diffYears = now.getFullYear() - d.getFullYear();
      const diffMonths = now.getMonth() - d.getMonth();
      return 11 - (diffYears * 12 + diffMonths);
    };

    const history = rows
      .sort((a, b) => {
        const da = parseDate(a.fecha);
        const db = parseDate(b.fecha);
        return db - da;
      })
      .map((r) => {
        // PARSEO DE CANTIDAD TAMBIÉN AQUÍ
        const cant = parseCantidad(r.cantidad || r.CANTIDAD || 1);

        total += cant;
        const key =
          modoVista === "CLIENTES"
            ? r.modelo || r.MODELO
            : r.cliente || r.CLIENTE;
        pieMap[key] = (pieMap[key] || 0) + cant;

        const d = parseDate(r.fecha || r.FECHA);

        let mIdx = -1;
        if (d) {
          mIdx = getMonthIndex(d);
        }

        return {
          fecha: d ? d.toLocaleDateString("es-AR") : "-",
          col: key,
          cant,
          oc: r.oc_cliente || r.OC || "-",
          op: r.op || r.OP || "-",
          isML: (r.detalles || r.DETALLES || "")
            .toString()
            .toLowerCase()
            .includes("mercadolibre"),
          monthIndex: mIdx,
        };
      });

    setSelectedItem({
      name,
      total,
      pie: Object.entries(pieMap)
        .map(([n, v]) => ({ name: n, value: v }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      history,
      last: history[0]?.fecha,
      salesChart: [],
    });
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-64 text-white text-2xl">
        <FaSpinner className="animate-spin mr-3" /> Cargando datos...
      </div>
    );
  if (errorMsg)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center text-white p-6">
        <FaExclamationTriangle className="text-5xl text-red-500 mb-4" />
        <h3 className="text-xl font-bold mb-2">Error de Carga</h3>
        <p className="text-red-200 mb-6 max-w-md">{errorMsg}</p>
        <button
          onClick={cargarDatos}
          className="px-6 py-2 bg-red-700 hover:bg-red-600 rounded-lg font-bold flex items-center gap-2"
        >
          <FaSync /> Reintentar
        </button>
      </div>
    );
  if (!analysisData)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center text-white p-6">
        <FaExclamationTriangle className="text-5xl text-yellow-500 mb-4" />
        <h3 className="text-xl font-bold mb-2">Sin Datos</h3>
        <button
          onClick={cargarDatos}
          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold flex items-center gap-2"
        >
          <FaSync /> Recargar
        </button>
      </div>
    );

  const isCli = modoVista === "CLIENTES";
  const data = isCli ? analysisData.cli : analysisData.prod;
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"];

  const lastMonthData = analysisData.salesByMonth[
    analysisData.salesByMonth.length - 1
  ] || { ventas: 0, mes: "-" };
  const prevMonthData = analysisData.salesByMonth[
    analysisData.salesByMonth.length - 2
  ] || { ventas: 0 };
  const promedioMensual = Math.round(analysisData.totalOps / 12);
  const trendDiff = lastMonthData.ventas - prevMonthData.ventas;
  const trendPercent =
    prevMonthData.ventas > 0
      ? ((trendDiff / prevMonthData.ventas) * 100).toFixed(0)
      : 0;

  const now = new Date();
  const daysInCurrentMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const currentDay = now.getDate();
  const currentSales = lastMonthData.ventas;

  let projectedValue = 0;
  if (currentSales > 0) {
    projectedValue = Math.round(
      (currentSales / currentDay) * daysInCurrentMonth,
    );
  } else {
    projectedValue = promedioMensual;
  }

  let modalHistory = [],
    totalPages = 0,
    dynamicChartData = [];

  if (selectedItem) {
    const filtered = selectedItem.history.filter((h) =>
      historialFilter === "TODOS"
        ? true
        : historialFilter === "SIN_ML"
          ? !h.isML
          : h.isML,
    );
    totalPages = Math.ceil(filtered.length / MODAL_ITEMS_PER_PAGE);
    modalHistory = filtered.slice(
      (modalPage - 1) * MODAL_ITEMS_PER_PAGE,
      modalPage * MODAL_ITEMS_PER_PAGE,
    );

    const aggregatedChart = new Array(12).fill(0);
    filtered.forEach((h) => {
      if (h.monthIndex >= 0 && h.monthIndex < 12) {
        aggregatedChart[h.monthIndex] += h.cant;
      }
    });

    const fullChartData = analysisData.salesByMonth.map((m, i) => ({
      mes: m.mes,
      ventas: aggregatedChart[i],
    }));

    dynamicChartData = incluirMesActualModal
      ? fullChartData
      : fullChartData.slice(0, -1);
  }

  const maxValTop = data.y[0]?.value || 1;
  const chartDataToShow = incluirMesActual
    ? analysisData.salesByMonth
    : analysisData.salesByMonth.slice(0, -1);
  const paretoInfo = data.pareto;
  const paretoPercent =
    paretoInfo.totalItems > 0
      ? ((paretoInfo.count80 / paretoInfo.totalItems) * 100).toFixed(1)
      : 0;

  return (
    <div className="animate-in fade-in duration-500 relative pb-20">
      <div className="mb-6 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-max pb-1 border-b border-slate-700">
          {[
            { id: "DASHBOARD", icon: <FaChartLine />, label: "Dashboard" },
            {
              id: "CONSUMO",
              icon: <FaBalanceScale />,
              label: "Consumo e Inventario",
              alertCount: analysisData.criticalItemsCount,
            },
            { id: "TENDENCIAS", icon: <FaRocket />, label: "Tendencias" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`py-3 px-6 rounded-t-lg font-bold flex items-center gap-2 text-sm transition-all border-b-2 relative ${
                view === tab.id
                  ? "text-blue-400 border-blue-400 bg-slate-800/30"
                  : "text-gray-400 border-transparent hover:text-white hover:bg-slate-800/20"
              }`}
            >
              {tab.icon} {tab.label}
              {tab.alertCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse shadow-sm shadow-red-500/50">
                  {tab.alertCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {view === "DASHBOARD" && (
        <>
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold flex items-center gap-3 text-white">
                {isCli ? (
                  <FaUsers className="text-purple-400" />
                ) : (
                  <FaCubes className="text-blue-400" />
                )}{" "}
                Análisis 12 Meses
              </h1>
              <p className="text-xs md:text-sm text-gray-400 mt-1">
                Visión general de rendimiento (Ventana Móvil)
              </p>
            </div>

            <div className="w-full xl:w-auto flex flex-col md:flex-row gap-3 items-center">
              <div className="bg-slate-800 p-1 rounded-xl border border-slate-600 flex shadow-sm w-full md:w-auto">
                <button
                  onClick={() => setModoVista("PRODUCTOS")}
                  className={`flex-1 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all ${
                    !isCli ? "bg-blue-600 text-white shadow" : "text-gray-400"
                  }`}
                >
                  PRODUCTOS
                </button>
                <button
                  onClick={() => setModoVista("CLIENTES")}
                  className={`flex-1 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all ${
                    isCli ? "bg-purple-600 text-white shadow" : "text-gray-400"
                  }`}
                >
                  CLIENTES
                </button>
              </div>
              <div className="flex-1 w-full md:w-auto">
                <SearchBar
                  busqueda={busqueda}
                  onSearch={handleSearch}
                  mostrarSugerencias={mostrarSugerencias}
                  sugerencias={sugerencias}
                  onSelect={selectItem}
                  isCli={isCli}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 mb-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div
                className={`bg-slate-800 p-6 rounded-xl border-l-4 shadow-lg flex flex-col justify-center h-full ${
                  isCli ? "border-purple-500" : "border-blue-500"
                }`}
              >
                <h3 className="text-gray-400 text-xs font-bold uppercase mb-2">
                  {isCli ? "Clientes Activos" : "Promedio Pedidos/Mes"}
                </h3>
                <p
                  className={`text-4xl font-bold ${
                    isCli ? "text-purple-400" : "text-blue-400"
                  }`}
                >
                  {isCli ? data.active : promedioMensual}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {isCli ? "Compras directas ult 12m" : "Media anual móvil"}
                </p>
              </div>

              <div
                onClick={() => setShowParetoModal(true)}
                className="bg-slate-800 p-6 rounded-xl border-l-4 border-indigo-500 shadow-lg flex flex-col justify-center h-full relative overflow-hidden cursor-pointer hover:bg-slate-750 transition-colors group"
              >
                <FaChartPie className="absolute -right-4 -bottom-4 text-8xl text-indigo-500/10 group-hover:text-indigo-500/20 transition-all" />
                <div className="flex justify-between items-start">
                  <h3 className="text-gray-400 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                    Principio de Pareto (80/20)
                  </h3>
                  <FaListUl className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-4xl font-bold text-indigo-400">
                    {paretoInfo.count80}
                  </p>
                  <span className="text-gray-400 text-sm mb-1">
                    items ({paretoPercent}%)
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2 group-hover:text-indigo-300 transition-colors">
                  Click para ver los {isCli ? "clientes" : "productos"} clave.
                </p>
              </div>

              <div className="bg-slate-800 p-6 rounded-xl border-l-4 border-yellow-500 shadow-lg flex flex-col justify-center h-full">
                <h3 className="text-gray-400 text-xs font-bold uppercase mb-2">
                  {isCli ? "Cliente Top" : `Pedidos ${lastMonthData.mes}`}
                </h3>
                {isCli ? (
                  <>
                    <p className="text-2xl font-bold text-yellow-400 truncate">
                      {data.y[0]?.name}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {data.y[0]?.value} u.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl font-bold text-yellow-400">
                      {lastMonthData.ventas}
                    </p>
                    <div
                      className={`text-xs font-bold mt-2 flex items-center gap-2 ${
                        trendDiff > 0
                          ? "text-green-400"
                          : trendDiff < 0
                            ? "text-red-400"
                            : "text-gray-400"
                      }`}
                    >
                      {trendDiff > 0 ? (
                        <FaArrowUp />
                      ) : trendDiff < 0 ? (
                        <FaArrowDown />
                      ) : (
                        <FaEquals />
                      )}{" "}
                      {trendPercent}% vs mes anterior
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-slate-800 p-5 rounded-xl border-t-4 border-green-500 shadow-lg h-full">
                <h3 className="text-gray-400 text-xs font-bold mb-4 uppercase tracking-wider text-center">
                  Top 5 Mes Actual
                </h3>
                <ul className="space-y-3">
                  {data.m.slice(0, 5).map((p, i) => (
                    <li
                      key={i}
                      className="flex justify-between text-sm border-b border-slate-700/50 pb-2 last:border-0"
                    >
                      <span className="truncate flex-1 text-gray-300 font-medium max-w-[200px]">
                        {p.name}
                      </span>
                      <span className="text-green-400 font-mono font-bold ml-2">
                        {p.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border-t-4 border-teal-500 shadow-lg h-full">
                <h3 className="text-gray-400 text-xs font-bold mb-4 uppercase tracking-wider text-center">
                  Top 5 Semana
                </h3>
                {data.w.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-gray-500 text-xs italic text-center">
                    Sin actividad reciente
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {data.w.slice(0, 5).map((p, i) => (
                      <li
                        key={i}
                        className="flex justify-between text-sm border-b border-slate-700/50 pb-2 last:border-0"
                      >
                        <span className="truncate flex-1 text-gray-300 font-medium max-w-[200px]">
                          {p.name}
                        </span>
                        <span className="text-teal-400 font-mono font-bold ml-2">
                          {p.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border-t-4 border-purple-500 shadow-lg flex flex-col justify-center items-center h-full">
                <h3 className="text-gray-400 text-xs font-bold mb-2 uppercase text-center">
                  Mes Récord (Pedidos)
                </h3>
                <p className="text-4xl font-black text-purple-400">
                  {analysisData.recordMonthName}
                </p>
                <p className="text-sm text-gray-500 font-mono">
                  {analysisData.recordMax} pedidos
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
            <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col h-full">
              <div className="p-4 border-b border-slate-700 bg-slate-800 sticky top-0">
                <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                  <FaListOl className="text-blue-500" /> Top 10 Anual (Unidades)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-slate-900 text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 w-10 text-center">#</th>
                      <th className="px-4 py-3">Producto / Cliente</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 w-32 hidden md:table-cell text-right pr-4">
                        Evolución
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {data.y.slice(0, 10).map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-slate-700/30 transition-colors group"
                      >
                        <td className="px-4 py-3 text-center">
                          <RankIcon index={index} />
                        </td>
                        <td className="px-4 py-3 font-medium text-white truncate max-w-[150px] relative">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <TrendWidget trend={item.trend} value={item.value} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell align-middle">
                          <Sparkline
                            data={item.history}
                            color={isCli ? "#A28DFF" : "#3b82f6"}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col h-full p-4">
              <div className="mb-4 border-b border-slate-700 pb-2 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                    <FaCalendarCheck className="text-green-500" /> Evolución
                  </h3>
                  <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-600/50">
                    <button
                      onClick={() => setChartResolution("DIARIA")}
                      className={`p-2 rounded text-xs transition-all ${
                        chartResolution === "DIARIA"
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                      title="Diario (30 días)"
                    >
                      <FaCalendarDay />
                    </button>
                    <button
                      onClick={() => setChartResolution("SEMANAL")}
                      className={`p-2 rounded text-xs transition-all ${
                        chartResolution === "SEMANAL"
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                      title="Semanal (12 semanas)"
                    >
                      <FaCalendarWeek />
                    </button>
                    <button
                      onClick={() => setChartResolution("MENSUAL")}
                      className={`p-2 rounded text-xs transition-all ${
                        chartResolution === "MENSUAL"
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                      title="Mensual (12 meses)"
                    >
                      <FaCalendarAlt />
                    </button>
                  </div>
                </div>

                {chartResolution === "MENSUAL" && (
                  <div className="flex items-center gap-3 justify-end">
                    {incluirMesActual && (
                      <div className="text-xs font-mono text-gray-400 bg-slate-900 px-2 py-1 rounded border border-slate-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></span>
                        Proy:{" "}
                        <span className="text-white font-bold">
                          {projectedValue}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => setIncluirMesActual(!incluirMesActual)}
                      className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-bold transition-colors border ${
                        incluirMesActual
                          ? "bg-slate-700 text-green-400 border-green-500/50"
                          : "bg-slate-800 text-gray-500 border-slate-600 hover:border-gray-400 hover:text-gray-300"
                      }`}
                    >
                      {incluirMesActual ? <FaEye /> : <FaEyeSlash />}{" "}
                      {incluirMesActual ? "Mes Actual: ON" : "Mes Actual: OFF"}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={mainChartData}
                    margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="mes"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickMargin={10}
                      interval={chartResolution === "DIARIA" ? 2 : 0}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        borderColor: "#475569",
                        color: "#fff",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#4ade80" }}
                    />
                    {chartResolution === "MENSUAL" && incluirMesActual && (
                      <ReferenceLine
                        y={projectedValue}
                        stroke="#94a3b8"
                        strokeDasharray="3 3"
                        label={{
                          position: "right",
                          value: "Proy",
                          fill: "#94a3b8",
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="ventas"
                      name="Pedidos"
                      stroke="#4ade80"
                      strokeWidth={3}
                      dot={{
                        r: 3,
                        fill: "#1e293b",
                        stroke: "#4ade80",
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 6, fill: "#4ade80" }}
                      animationDuration={500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {view === "CONSUMO" && <ConsumptionView analysisData={analysisData} />}
      {view === "TENDENCIAS" && <TendenciasView />}

      {selectedItem && (
        <DetailModal
          selectedItem={selectedItem}
          isCli={isCli}
          dynamicChartData={dynamicChartData}
          modalHistory={modalHistory}
          modalPage={modalPage}
          setModalPage={setModalPage}
          totalPages={totalPages}
          historialFilter={historialFilter}
          setHistorialFilter={setHistorialFilter}
          setSelectedItem={setSelectedItem}
          COLORS={COLORS}
          showCurrentMonth={incluirMesActualModal}
          setShowCurrentMonth={setIncluirMesActualModal}
        />
      )}

      <ParetoModal
        isOpen={showParetoModal}
        onClose={() => setShowParetoModal(false)}
        data={paretoInfo}
        isCli={isCli}
      />
    </div>
  );
}
