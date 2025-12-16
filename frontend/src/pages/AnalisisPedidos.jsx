import { useEffect, useState, useMemo } from "react";
import {
  FaUsers,
  FaCubes,
  FaChartLine,
  FaSpinner,
  FaCogs,
  FaSync,
  FaExclamationTriangle,
  FaRocket,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaTrophy,
  FaMedal,
  FaListOl,
  FaCalendarCheck,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { PEDIDOS_API_URL, API_BASE_URL, authFetch } from "../utils.js";
import SearchBar from "../components/analisis/SearchBar";
import ConsumptionView from "../components/analisis/ConsumptionView";
import DetailModal from "../components/analisis/DetailModal";
import TendenciasView from "../components/analisis/TendenciasView";

const RECETAS_ALL_URL = `${API_BASE_URL}/ingenieria/recetas/all`;
const STOCK_SEMIS_URL = `${API_BASE_URL}/ingenieria/semielaborados`;

const normalizeKey = (key) => (key || "").trim().toUpperCase();

// --- HELPER: PARSEO DE FECHAS (ARGENTINA DD/MM/YYYY) ---
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  // Si ya es un objeto fecha, devolverlo
  if (Object.prototype.toString.call(dateStr) === "[object Date]") {
    return isNaN(dateStr) ? null : dateStr;
  }

  const str = String(dateStr).trim();

  // Si tiene barras (DD/MM/YYYY)
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Mes 0-indexado
      let year = parseInt(parts[2], 10);
      // Ajuste para años de 2 dígitos (ej: 23 -> 2023)
      if (year < 100) year += 2000;

      const d = new Date(year, month, day);
      return isNaN(d) ? null : d;
    }
  }

  // Fallback para formato ISO u otros
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

// --- COMPONENTES AUXILIARES ---
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
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    const daysInPeriod = Math.max(
      1,
      Math.floor((now - sixMonthsAgo) / (1000 * 60 * 60 * 24))
    );

    const currentMonth = now.getMonth();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(
      now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)
    );
    startOfWeek.setHours(0, 0, 0, 0);

    const normalizedRecetas = {};
    Object.keys(datosRecetas).forEach((key) => {
      normalizedRecetas[normalizeKey(key)] = datosRecetas[key];
    });

    const stockMap = {};
    datosStock.forEach((s) => {
      const totalReal =
        Number(s.stock_planta_26 || 0) +
        Number(s.stock_planta_37 || 0) +
        Number(s.stock_deposito_ayolas || 0) +
        Number(s.stock_deposito_quintana || 0);
      stockMap[normalizeKey(s.nombre)] = totalReal;
    });

    const uniqueOrders = new Set(),
      uniqueMLOrders = new Set();
    const prodMapY = {},
      prodMapM = {},
      prodMapW = {};
    const cliMapY = {},
      cliMapM = {},
      cliMapW = {};
    const activeClients = new Set(),
      allClients = new Set(),
      allModels = new Set();

    const monthOpsMap = {};
    const monthNames = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    monthNames.forEach((m) => (monthOpsMap[m] = new Set()));

    const uniqueOpsGlobal = new Set();
    const consumoTotal2025 = {};
    const consumoUltimos6Meses = {};
    const missingRecipesMap = {};

    datosPedidos.forEach((row) => {
      // --- USO DE PARSER CORREGIDO ---
      const d = parseDate(row.fecha || row.FECHA || row.Fecha);
      if (!d) return;

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

      if (d.getFullYear() >= 2025) {
        const isML =
          detalles.includes("mercadolibre") ||
          cliName.toLowerCase().includes("mercadolibre");
        if (oc && oc !== "-" && oc !== "0") {
          uniqueOrders.add(oc);
          if (isML) uniqueMLOrders.add(oc);
        }

        const mName = monthNames[d.getMonth()];
        if (monthOpsMap[mName]) {
          if (op && op !== "-" && op !== "0") {
            monthOpsMap[mName].add(op);
            uniqueOpsGlobal.add(op);
          }
        }

        if (cliName !== "Desconocido") {
          const cliKey = normalizeKey(cliName);
          allClients.add(cliName);
          if (!isML) activeClients.add(cliName);
          cliMapY[cliKey] = (cliMapY[cliKey] || 0) + cantVendida;
          if (d.getMonth() === currentMonth)
            cliMapM[cliKey] = (cliMapM[cliKey] || 0) + cantVendida;
          if (d >= startOfWeek)
            cliMapW[cliKey] = (cliMapW[cliKey] || 0) + cantVendida;
        }

        if (prodName !== "Desconocido") {
          allModels.add(prodName);
          prodMapY[prodKey] = (prodMapY[prodKey] || 0) + cantVendida;
          if (d.getMonth() === currentMonth)
            prodMapM[prodKey] = (prodMapM[prodKey] || 0) + cantVendida;
          if (d >= startOfWeek)
            prodMapW[prodKey] = (prodMapW[prodKey] || 0) + cantVendida;

          const receta = normalizedRecetas[prodKey];
          if (receta && receta.length > 0) {
            receta.forEach((insumo) => {
              const insumoKey = normalizeKey(insumo.nombre);
              if (!consumoTotal2025[insumoKey]) {
                consumoTotal2025[insumoKey] = {
                  name: insumo.nombre,
                  total: 0,
                  months: Array(12).fill(0),
                  usedIn: {},
                };
              }
              const cantidadConsumida = insumo.cantidad * cantVendida;
              consumoTotal2025[insumoKey].total += cantidadConsumida;
              consumoTotal2025[insumoKey].months[d.getMonth()] +=
                cantidadConsumida;
              if (!consumoTotal2025[insumoKey].usedIn[prodName]) {
                consumoTotal2025[insumoKey].usedIn[prodName] = 0;
              }
              consumoTotal2025[insumoKey].usedIn[prodName] += cantidadConsumida;
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

      if (d >= sixMonthsAgo && d <= now && prodName !== "Desconocido") {
        const receta = normalizedRecetas[prodKey];
        if (receta && receta.length > 0) {
          receta.forEach((insumo) => {
            const insumoKey = normalizeKey(insumo.nombre);
            if (!consumoUltimos6Meses[insumoKey])
              consumoUltimos6Meses[insumoKey] = {
                name: insumo.nombre,
                total: 0,
              };
            consumoUltimos6Meses[insumoKey].total +=
              insumo.cantidad * cantVendida;
          });
        }
      }
    });

    const getTop = (map, n) =>
      Object.entries(map)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, n);

    const salesByMonth = monthNames
      .slice(0, currentMonth + 1)
      .map((m) => ({ mes: m, ventas: monthOpsMap[m].size }));

    const recordMonth = [...salesByMonth].sort(
      (a, b) => b.ventas - a.ventas
    )[0];

    const allSemiKeys = new Set([
      ...Object.keys(consumoTotal2025),
      ...Object.keys(consumoUltimos6Meses),
    ]);
    const consumoData = Array.from(allSemiKeys)
      .map((key) => {
        const data2025 = consumoTotal2025[key] || {
          name: key,
          total: 0,
          months: [],
          usedIn: {},
        };
        const data6M = consumoUltimos6Meses[key] || { total: 0 };
        const realName = data2025.name || data6M.name || key;
        const stock = stockMap[key] || 0;
        const promedioDiario = data6M.total / daysInPeriod;
        const promedioMensual = promedioDiario * 30;
        const diasRestantes =
          promedioDiario > 0 ? stock / promedioDiario : 9999;
        const chartData = monthNames
          .slice(0, currentMonth + 1)
          .map((mes, i) => ({ mes: mes, consumo: data2025.months[i] || 0 }));
        const usedInChart = Object.entries(data2025.usedIn)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        return {
          name: realName,
          value: data2025.total,
          stock: stock,
          monthly: promedioMensual.toFixed(0),
          daily: promedioDiario.toFixed(2),
          daysLeft: diasRestantes === 9999 ? "∞" : diasRestantes.toFixed(1),
          daysLeftVal: diasRestantes,
          chartData: chartData,
          usedInChart: usedInChart,
        };
      })
      .sort((a, b) => a.daysLeftVal - b.daysLeftVal);

    const missingData = Object.values(missingRecipesMap).sort(
      (a, b) => b.count - a.count
    );

    // Filtro para tabla raw usando el parser
    const filteredRaw = datosPedidos.filter((row) => {
      const d = parseDate(row.fecha || row.FECHA || row.Fecha);
      return d && d.getFullYear() >= 2025;
    });

    return {
      salesByMonth,
      totalOrders: uniqueOrders.size,
      totalOps: uniqueOpsGlobal.size,
      mlOrders: uniqueMLOrders.size,
      recordMonthName: recordMonth?.mes || "-",
      recordMax: recordMonth?.ventas || 1,
      raw: filteredRaw,
      rawTotalRows: filteredRaw.length,
      prod: {
        y: getTop(prodMapY, 10),
        m: getTop(prodMapM, 5),
        w: getTop(prodMapW, 5),
        list: Array.from(allModels).sort(),
      },
      cli: {
        y: getTop(cliMapY, 10),
        active: activeClients.size,
        m: getTop(cliMapM, 5),
        w: getTop(cliMapW, 5),
        list: Array.from(allClients).sort(),
      },
      consumo: consumoData,
      missingRecipes: missingData,
      daysAnalyzed: daysInPeriod,
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
    const monthNames = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    const prodMonthMap = {};
    monthNames.forEach((m) => (prodMonthMap[m] = 0));

    const history = rows
      .sort((a, b) => {
        // Ordenamiento usando parser
        const dateA = parseDate(a.fecha || a.FECHA);
        const dateB = parseDate(b.fecha || b.FECHA);
        return dateB - dateA;
      })
      .map((r) => {
        const cant = Number(r.cantidad || r.CANTIDAD || 1);
        total += cant;
        const key =
          modoVista === "CLIENTES"
            ? r.modelo || r.MODELO || ""
            : r.cliente || r.CLIENTE || "";
        pieMap[key] = (pieMap[key] || 0) + cant;

        const d = parseDate(r.fecha || r.FECHA);
        if (d) {
          const mName = monthNames[d.getMonth()];
          if (prodMonthMap[mName] !== undefined) prodMonthMap[mName] += cant;
        }
        return {
          // Formateo visual consistente
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

    const topPie = Object.entries(pieMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const salesChart = monthNames
      .slice(0, new Date().getMonth() + 1)
      .map((m) => ({ mes: m, ventas: prodMonthMap[m] }));
    setSelectedItem({
      name,
      total,
      pie: topPie,
      history,
      last: history[0]?.fecha,
      salesChart,
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
          className="px-6 py-2 bg-red-700 hover:bg-red-600 rounded-lg font-bold flex items-center gap-2 transition-colors"
        >
          <FaSync /> Reintentar
        </button>
      </div>
    );
  if (!analysisData)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center text-white p-6">
        <FaExclamationTriangle className="text-5xl text-yellow-500 mb-4" />
        <h3 className="text-xl font-bold mb-2">Sin Datos Disponibles</h3>
        <p className="text-gray-400 mb-6">
          No se encontraron pedidos registrados para este año.
        </p>
        <button
          onClick={cargarDatos}
          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold flex items-center gap-2 transition-colors"
        >
          <FaSync /> Recargar
        </button>
      </div>
    );

  const isCli = modoVista === "CLIENTES";
  const data = isCli ? analysisData.cli : analysisData.prod;
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"];

  // KPIs
  const lastMonthData = analysisData.salesByMonth[
    analysisData.salesByMonth.length - 1
  ] || {
    ventas: 0,
    mes: "-",
  };
  const prevMonthData = analysisData.salesByMonth[
    analysisData.salesByMonth.length - 2
  ] || {
    ventas: 0,
  };
  const mesesTranscurridos = Math.max(1, analysisData.salesByMonth.length);
  const promedioMensual = Math.round(
    analysisData.totalOps / mesesTranscurridos
  );

  const trendDiff = lastMonthData.ventas - prevMonthData.ventas;
  const trendPercent =
    prevMonthData.ventas > 0
      ? ((trendDiff / prevMonthData.ventas) * 100).toFixed(0)
      : 0;

  // Lógica Modal
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
    const monthNames = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    const currentMonth = new Date().getMonth();
    const salesMap = {};
    monthNames.slice(0, currentMonth + 1).forEach((m) => (salesMap[m] = 0));

    // Parseo consistente también en el modal
    filtered.forEach((row) => {
      const parts = row.fecha.split("/");
      if (parts.length === 3) {
        const monthIndex = parseInt(parts[1], 10) - 1;
        const mName = monthNames[monthIndex];
        if (salesMap[mName] !== undefined) salesMap[mName] += row.cant;
      }
    });
    dynamicChartData = Object.keys(salesMap).map((key) => ({
      mes: key,
      ventas: salesMap[key],
    }));
  }

  const maxValTop = data.y[0]?.value || 1;

  return (
    <div className="animate-in fade-in duration-500 relative pb-20">
      {/* TABS */}
      <div className="mb-6 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-max pb-1 border-b border-slate-700">
          {[
            { id: "DASHBOARD", icon: <FaChartLine />, label: "Dashboard" },
            { id: "CONSUMO", icon: <FaCogs />, label: "Consumo" },
            { id: "TENDENCIAS", icon: <FaRocket />, label: "Tendencias" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`py-3 px-6 rounded-t-lg font-bold flex items-center gap-2 text-sm transition-all border-b-2 ${
                view === tab.id
                  ? "text-blue-400 border-blue-400 bg-slate-800/30"
                  : "text-gray-400 border-transparent hover:text-white hover:bg-slate-800/20"
              }`}
            >
              {tab.icon} {tab.label}
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
                Análisis 2025
              </h1>
              <p className="text-xs md:text-sm text-gray-400 mt-1">
                Visión general de rendimiento
              </p>
            </div>

            <div className="w-full xl:w-auto flex flex-col md:flex-row gap-3">
              <div className="bg-slate-800 p-1 rounded-xl border border-slate-600 flex shadow-sm">
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
              <div className="flex-1">
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
            {/* FILA 1: KPIs PRINCIPALES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div
                className={`bg-slate-800 p-6 rounded-xl border-l-4 shadow-lg flex flex-col justify-center h-full ${
                  isCli ? "border-purple-500" : "border-blue-500"
                }`}
              >
                <h3 className="text-gray-400 text-sm font-bold uppercase mb-2">
                  {isCli ? "Clientes Activos" : "Promedio Mensual"}
                </h3>
                <p
                  className={`text-4xl md:text-5xl font-bold ${
                    isCli ? "text-purple-400" : "text-blue-400"
                  }`}
                >
                  {isCli ? data.active : promedioMensual}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {isCli ? "Compras directas" : "Pedidos / Mes"}
                </p>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border-l-4 border-yellow-500 shadow-lg flex flex-col justify-center h-full">
                <h3 className="text-gray-400 text-sm font-bold uppercase mb-2">
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
                    <p className="text-4xl md:text-5xl font-bold text-yellow-400">
                      {lastMonthData.ventas}
                    </p>
                    <div
                      className={`text-sm font-bold mt-2 flex items-center gap-2 ${
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
              </div>
            </div>
          </div>

          {/* FILA 3: TABLAS DE DATOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
            {/* TABLA 1: TOP 10 ANUAL */}
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

            {/* TABLA 2: EVOLUCIÓN MENSUAL */}
            <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col h-full">
              <div className="p-4 border-b border-slate-700 bg-slate-800 sticky top-0">
                <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                  <FaCalendarCheck className="text-green-500" /> Evolución
                  Mensual (Pedidos)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-slate-900 text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-3">Mes</th>
                      <th className="px-6 py-3 text-right">Pedidos</th>
                      <th className="px-6 py-3 text-right">Variación</th>
                      <th className="px-6 py-3 text-center">Tendencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {analysisData.salesByMonth.map((mesData, index) => {
                      const prev =
                        analysisData.salesByMonth[index - 1]?.ventas || 0;
                      const diff = index === 0 ? 0 : mesData.ventas - prev;
                      const percent =
                        prev > 0 ? ((diff / prev) * 100).toFixed(0) : 0;

                      return (
                        <tr
                          key={index}
                          className="hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="px-6 py-3 font-bold text-white uppercase tracking-wider">
                            {mesData.mes}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-lg text-green-400">
                            {mesData.ventas}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-xs">
                            {index > 0 && (
                              <span
                                className={`flex items-center justify-end gap-1 ${
                                  diff > 0
                                    ? "text-green-400"
                                    : diff < 0
                                    ? "text-red-400"
                                    : "text-gray-500"
                                }`}
                              >
                                {diff > 0 ? "+" : ""}
                                {percent}%
                                {diff > 0 ? (
                                  <FaArrowUp size={10} />
                                ) : diff < 0 ? (
                                  <FaArrowDown size={10} />
                                ) : (
                                  <FaEquals size={10} />
                                )}
                              </span>
                            )}
                            {index === 0 && (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {/* Mini Sparkline simulado */}
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full mx-auto overflow-hidden">
                              <div
                                className={`h-full ${
                                  diff >= 0 ? "bg-green-500" : "bg-red-500"
                                }`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (mesData.ventas /
                                      (analysisData.recordMax || 1)) *
                                      100
                                  )}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {view === "CONSUMO" && <ConsumptionView analysisData={analysisData} />}
      {view === "TENDENCIAS" && <TendenciasView />}

      {/* --- MODAL DETALLE --- */}
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
    </div>
  );
}
