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
  FaHourglassHalf,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
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

export default function AnalisisPedidos() {
  const [datosPedidos, setDatosPedidos] = useState([]);
  const [datosRecetas, setDatosRecetas] = useState({});
  const [datosStock, setDatosStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Vistas: DASHBOARD | CONSUMO | TENDENCIAS
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
        console.error("❌ Error cargando datos de análisis:", error);
        setErrorMsg(error.message || "Error de conexión con el servidor.");
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

    // --- LÓGICA PEDIDOS (OPs) ---
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

    // Set global de OPs para el promedio anual
    const uniqueOpsGlobal = new Set();

    const consumoTotal2025 = {};
    const consumoUltimos6Meses = {};
    const missingRecipesMap = {};

    let totalUnidadesVendidas = 0;

    datosPedidos.forEach((row) => {
      const dStr = row.fecha || row.FECHA || row.Fecha;
      if (!dStr) return;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return;

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

        // --- LÓGICA MENSUAL (Pedidos) ---
        const mName = monthNames[d.getMonth()];
        if (monthOpsMap[mName]) {
          totalUnidadesVendidas += cantVendida;

          // Si hay OP válida, la agregamos al set del mes y al global para contar pedidos únicos
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

    // Gráfico Evolución: Usamos .size del Set de OPs
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
    const filteredRaw = datosPedidos.filter((row) => {
      const d = new Date(row.FECHA || row.Fecha || row.fecha);
      return !isNaN(d) && d.getFullYear() >= 2025;
    });

    return {
      salesByMonth,
      totalOrders: uniqueOrders.size,
      totalUnits: totalUnidadesVendidas,
      totalOps: uniqueOpsGlobal.size,
      mlOrders: uniqueMLOrders.size,
      recordMonthName: recordMonth?.mes || "-",
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
      .sort(
        (a, b) => new Date(b.fecha || b.FECHA) - new Date(a.fecha || a.FECHA)
      )
      .map((r) => {
        const cant = Number(r.cantidad || r.CANTIDAD || 1);
        total += cant;
        const key =
          modoVista === "CLIENTES"
            ? r.modelo || r.MODELO || ""
            : r.cliente || r.CLIENTE || "";
        pieMap[key] = (pieMap[key] || 0) + cant;
        const d = new Date(r.fecha || r.FECHA);
        if (!isNaN(d)) {
          const mName = monthNames[d.getMonth()];
          if (prodMonthMap[mName] !== undefined) prodMonthMap[mName] += cant;
        }
        return {
          fecha: new Date(r.fecha || r.FECHA).toLocaleDateString("es-AR"),
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

  // --- CÁLCULOS KPI NUEVOS (Promedio y Tendencia en PEDIDOS) ---
  const lastMonthData = analysisData.salesByMonth[
    analysisData.salesByMonth.length - 1
  ] || { ventas: 0, mes: "-" };
  const prevMonthData = analysisData.salesByMonth[
    analysisData.salesByMonth.length - 2
  ] || { ventas: 0 };
  const mesesTranscurridos = Math.max(1, analysisData.salesByMonth.length);
  // Promedio mensual de Pedidos
  const promedioMensual = Math.round(
    analysisData.totalOps / mesesTranscurridos
  );

  const trendDiff = lastMonthData.ventas - prevMonthData.ventas;
  const trendPercent =
    prevMonthData.ventas > 0
      ? ((trendDiff / prevMonthData.ventas) * 100).toFixed(0)
      : 0;

  // Lógica Modal Detalle
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

  return (
    <div className="animate-in fade-in duration-500 relative pb-20">
      {/* 1. TABS DESLIZABLES (Estética Limpia para Móvil y Desktop) */}
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
          {/* HEADER Y BUSCADOR COMPACTO */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold flex items-center gap-3 text-white">
                {isCli ? (
                  <FaUsers className="text-purple-400" />
                ) : (
                  <FaCubes className="text-blue-400" />
                )}
                Análisis 2025
              </h1>
              <p className="text-xs md:text-sm text-gray-400 mt-1">
                Visión general de rendimiento
              </p>
            </div>

            <div className="w-full xl:w-auto flex flex-col md:flex-row gap-3">
              {/* Toggle Productos/Clientes */}
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

              {/* Buscador Full Width en Móvil */}
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

          {/* GRID: 12 columnas en escritorio */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 mb-12">
            {/* KPI 1 - Promedio Mensual (2 columnas desktop) */}
            <div
              className={`bg-slate-800 p-6 rounded-xl border-l-4 shadow-lg flex flex-col justify-center lg:col-span-2 h-full ${
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

            {/* KPI 2 - Pedidos Actuales (2 columnas desktop) */}
            <div className="bg-slate-800 p-6 rounded-xl border-l-4 border-yellow-500 shadow-lg flex flex-col justify-center lg:col-span-2 h-full">
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
                    {trendDiff > 0 ? <FaArrowUp /> : <FaArrowDown />}
                    {trendPercent}% vs mes anterior
                  </div>
                </>
              )}
            </div>

            {/* List 1 - Top 5 Mes (3 columnas desktop) */}
            <div className="bg-slate-800 p-5 rounded-xl border-t-4 border-green-500 shadow-lg lg:col-span-3 h-full">
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

            {/* List 2 - Top 5 Semana (3 columnas desktop) */}
            <div className="bg-slate-800 p-5 rounded-xl border-t-4 border-teal-500 shadow-lg lg:col-span-3 h-full">
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

            {/* KPI 3 - Récord (2 columnas desktop) */}
            <div className="bg-slate-800 p-5 rounded-xl border-t-4 border-purple-500 shadow-lg flex flex-col justify-center items-center lg:col-span-2 h-full">
              <h3 className="text-gray-400 text-xs font-bold mb-2 uppercase text-center">
                Mes Récord (Pedidos)
              </h3>
              <p className="text-4xl font-black text-purple-400">
                {analysisData.recordMonthName}
              </p>
            </div>
          </div>

          {/* GRÁFICOS (Altura ajustada para móvil) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
            <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-700 h-[350px] md:h-[450px]">
              <h3 className="text-lg font-bold mb-6 text-gray-200">
                Top 10 Anual (Unidades)
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.y}
                  layout="vertical"
                  margin={{ left: 0, right: 10, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeOpacity={0.1}
                    horizontal
                    vertical={false}
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    width={100}
                    style={{ fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      fontSize: "12px",
                      border: "none",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill={isCli ? "#a855f7" : "#3b82f6"}
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  >
                    {data.y.map((e, i) => (
                      <Cell
                        key={i}
                        fill={
                          i < 3 ? (isCli ? "#d8b4fe" : "#60a5fa") : "#475569"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-700 h-[350px] md:h-[450px]">
              <h3 className="text-lg font-bold mb-6 text-gray-200">
                Evolución Mensual (Pedidos)
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={analysisData.salesByMonth}
                  margin={{ left: -20, right: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeOpacity={0.1} vertical={false} />
                  <XAxis
                    dataKey="mes"
                    stroke="#94a3b8"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "#4ade80" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="#4ade80"
                    strokeWidth={4}
                    dot={{ r: 6, fill: "#1e293b", strokeWidth: 3 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* --- OTRAS VISTAS (Sin Runway) --- */}
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
