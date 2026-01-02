import { useEffect, useState, useMemo } from "react";
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
} from "recharts";
import { PEDIDOS_API_URL, API_BASE_URL, authFetch } from "../utils.js";
import SearchBar from "../components/analisis/SearchBar";
import ConsumptionView from "../components/analisis/ConsumptionView";
import DetailModal from "../components/analisis/DetailModal";
import TendenciasView from "../components/analisis/TendenciasView";

const RECETAS_ALL_URL = `${API_BASE_URL}/ingenieria/recetas/all`;
const STOCK_SEMIS_URL = `${API_BASE_URL}/ingenieria/semielaborados`;

const normalizeKey = (key) => (key || "").trim().toUpperCase();

// --- HELPER: PARSEO DE FECHAS ---
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  if (Object.prototype.toString.call(dateStr) === "[object Date]") {
    return isNaN(dateStr) ? null : dateStr;
  }
  const str = String(dateStr).trim();
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      return isNaN(d) ? null : d;
    }
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

// --- COMPONENTES VISUALES ---
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

const TableProgressBar = ({ value, max, colorClass }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden ml-auto">
      <div
        className={`h-full ${colorClass}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

// --- MODAL PARETO ---
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
      stockMap[normalizeKey(s.nombre)] =
        Number(s.stock_planta_26 || 0) +
        Number(s.stock_planta_37 || 0) +
        Number(s.stock_deposito_ayolas || 0) +
        Number(s.stock_deposito_quintana || 0);
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

      const cantVendida = Number(row.cantidad || row.CANTIDAD || 1);
      const prodName = row.modelo || row.MODELO || "Desconocido";
      const cliName = row.cliente || row.CLIENTE || "Desconocido";
      const detalles = (row.detalles || row.DETALLES || "")
        .toString()
        .toLowerCase();
      const oc = row.oc_cliente || row.OC || row.oc;
      const op = row.op || row.OP;
      const prodKey = normalizeKey(prodName);

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
          const cliKey = normalizeKey(cliName);
          allClients.add(cliName);
          if (!isML) activeClients.add(cliName);
          cliMapY[cliKey] = (cliMapY[cliKey] || 0) + cantVendida;
        }

        if (prodName !== "Desconocido") {
          allModels.add(prodName);
          prodMapY[prodKey] = (prodMapY[prodKey] || 0) + cantVendida;

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

      // Short term logic
      const startOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );
      const startOfWeek = new Date(now);
      startOfWeek.setDate(
        now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)
      );
      startOfWeek.setHours(0, 0, 0, 0);

      if (d >= startOfCurrentMonth) {
        if (cliName !== "Desconocido")
          cliMapM[normalizeKey(cliName)] =
            (cliMapM[normalizeKey(cliName)] || 0) + cantVendida;
        if (prodName !== "Desconocido")
          prodMapM[prodKey] = (prodMapM[prodKey] || 0) + cantVendida;
      }
      if (d >= startOfWeek) {
        if (cliName !== "Desconocido")
          cliMapW[normalizeKey(cliName)] =
            (cliMapW[normalizeKey(cliName)] || 0) + cantVendida;
        if (prodName !== "Desconocido")
          prodMapW[prodKey] = (prodMapW[prodKey] || 0) + cantVendida;
      }
    });

    const getTop = (map, n) =>
      Object.entries(map)
        .map(([name, value]) => ({ name, value }))
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

    const salesByMonth = last12Months.map((m) => ({
      mes: m.label,
      ventas: m.total,
    }));
    const recordMonth = [...salesByMonth].sort(
      (a, b) => b.ventas - a.ventas
    )[0];

    // CÁLCULO DE CONSUMO Y ALERTAS
    let criticalItemsCount = 0; // Contador de alertas
    const consumoData = Object.values(consumoTotalPeriodo)
      .map((data) => {
        const stock = stockMap[normalizeKey(data.name)] || 0;
        const promedioMensual = data.total / 12;
        const promedioDiario = data.total / 365;
        const diasRestantes =
          promedioDiario > 0 ? stock / promedioDiario : 9999;

        if (diasRestantes < 7) criticalItemsCount++; // Alerta si < 7 días

        return {
          name: data.name,
          value: data.total,
          stock: stock,
          monthly: promedioMensual.toFixed(0),
          daily: promedioDiario.toFixed(2),
          daysLeft: diasRestantes === 9999 ? "∞" : diasRestantes.toFixed(1),
          daysLeftVal: diasRestantes,
          chartData: last12Months.map((m, i) => ({
            mes: m.label,
            consumo: data.months[i] || 0,
          })),
          usedInChart: Object.entries(data.usedIn)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
        };
      })
      .sort((a, b) => a.daysLeftVal - b.daysLeftVal);

    const missingData = Object.values(missingRecipesMap).sort(
      (a, b) => b.count - a.count
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
        y: getTop(prodMapY, 10),
        m: getTop(prodMapM, 5),
        w: getTop(prodMapW, 5),
        list: Array.from(allModels).sort(),
        pareto: paretoProd,
      },
      cli: {
        y: getTop(cliMapY, 10),
        active: activeClients.size,
        m: getTop(cliMapM, 5),
        w: getTop(cliMapW, 5),
        list: Array.from(allClients).sort(),
        pareto: paretoCli,
      },
      consumo: consumoData,
      criticalItemsCount, // Exportamos el conteo
      missingRecipes: missingData,
      daysAnalyzed: 365,
    };
  }, [datosPedidos, datosRecetas, datosStock]);

  const handleSearch = (val) => {
    setBusqueda(val);
    if (val && analysisData) {
      const list =
        modoVista === "PRODUCTOS"
          ? analysisData.prod.list
          : analysisData.cli.list;
      setSugerencias(
        list.filter((i) => i.toLowerCase().includes(val.toLowerCase()))
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
          : r.cliente || r.CLIENTE) === name
    );

    let total = 0;
    const pieMap = {};
    const last12Keys = analysisData.salesByMonth.map((m) => m.mes);
    const prodMonthMap = new Array(12).fill(0);
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
        const cant = Number(r.cantidad || r.CANTIDAD || 1);
        total += cant;
        const key =
          modoVista === "CLIENTES"
            ? r.modelo || r.MODELO
            : r.cliente || r.CLIENTE;
        pieMap[key] = (pieMap[key] || 0) + cant;
        const d = parseDate(r.fecha || r.FECHA);
        if (d) {
          const idx = getMonthIndex(d);
          if (idx >= 0 && idx < 12) prodMonthMap[idx] += cant;
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
      salesChart: last12Keys.map((l, i) => ({
        mes: l,
        ventas: prodMonthMap[i],
      })),
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
    0
  ).getDate();
  const currentDay = now.getDate();
  const currentSales = lastMonthData.ventas;

  let projectedValue = 0;
  if (currentSales > 0) {
    projectedValue = Math.round(
      (currentSales / currentDay) * daysInCurrentMonth
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
        : h.isML
    );
    totalPages = Math.ceil(filtered.length / MODAL_ITEMS_PER_PAGE);
    modalHistory = filtered.slice(
      (modalPage - 1) * MODAL_ITEMS_PER_PAGE,
      modalPage * MODAL_ITEMS_PER_PAGE
    );
    dynamicChartData = selectedItem.salesChart;
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
      {/* TABS CON ALERTAS */}
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
              {/* BADGE DE ALERTA */}
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
          {/* HEADER */}
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

          {/* GRID DASHBOARD */}
          <div className="flex flex-col gap-6 mb-12">
            {/* FILA 1: KPIs */}
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

            {/* FILA 2: LISTAS SECUNDARIAS */}
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

          {/* FILA 3: TABLAS DE DATOS */}
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
                      <th className="px-4 py-3 w-32 hidden md:table-cell">
                        Volumen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {data.y.slice(0, 10).map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-center">
                          <RankIcon index={index} />
                        </td>
                        <td className="px-4 py-3 font-medium text-white truncate max-w-[150px]">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-blue-300">
                          {item.value}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell align-middle">
                          <TableProgressBar
                            value={item.value}
                            max={maxValTop}
                            colorClass={isCli ? "bg-purple-500" : "bg-blue-500"}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col h-full p-4">
              <div className="mb-4 border-b border-slate-700 pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                  <FaCalendarCheck className="text-green-500" /> Evolución
                  Mensual
                </h3>
                <div className="flex items-center gap-3">
                  {incluirMesActual && (
                    <div className="text-xs font-mono text-gray-400 bg-slate-900 px-2 py-1 rounded border border-slate-600 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></span>
                      Proy:{" "}
                      <span className="text-white font-bold">
                        {projectedValue}
                      </span>
                      {currentSales === 0 && (
                        <span className="text-[10px] text-gray-500">
                          (Est. Histórica)
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setIncluirMesActual(!incluirMesActual)}
                    className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-colors border ${
                      incluirMesActual
                        ? "bg-slate-700 text-green-400 border-green-500/50"
                        : "bg-slate-800 text-gray-500 border-slate-600 hover:border-gray-400 hover:text-gray-300"
                    }`}
                  >
                    {incluirMesActual ? <FaEye /> : <FaEyeSlash />}{" "}
                    {incluirMesActual ? "Mes Actual: ON" : "Mes Actual: OFF"}
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartDataToShow}
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
                      fontSize={12}
                      tickMargin={10}
                      interval={0}
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
                    {incluirMesActual && (
                      <ReferenceLine
                        y={projectedValue}
                        stroke="#94a3b8"
                        strokeDasharray="3 3"
                        label={{
                          position: "right",
                          value: "Proyección",
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
                        r: 4,
                        fill: "#1e293b",
                        stroke: "#4ade80",
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 6, fill: "#4ade80" }}
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
