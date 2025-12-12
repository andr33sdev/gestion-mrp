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
import InsumosRunway from "../components/analisis/InsumosRunway";

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
    const monthMap = {};
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
    monthNames.forEach((m) => (monthMap[m] = 0));

    const consumoTotal2025 = {};
    const consumoUltimos6Meses = {};
    const missingRecipesMap = {};

    datosPedidos.forEach((row) => {
      const dStr = row.FECHA || row.Fecha || row.fecha;
      if (!dStr) return;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return;

      const estado = (row.ESTADO || row.Estado || row.estado || "")
        .toString()
        .toUpperCase();
      if (estado.includes("CANCELADO")) return;

      const cantVendida = Number(
        row.CANTIDAD || row.Cantidad || row.cantidad || 1
      );
      const prodName = row.MODELO || row.Modelo || row.modelo || "Desconocido";
      const cliName =
        row.CLIENTE || row.Cliente || row.cliente || "Desconocido";
      const detalles = (row.DETALLES || row.Detalles || row.detalles || "")
        .toString()
        .toLowerCase();
      const oc = row.OC || row.oc;

      const prodKey = normalizeKey(prodName);

      if (d.getFullYear() >= 2025) {
        const isML = detalles.includes("mercadolibre");
        if (oc) {
          uniqueOrders.add(oc);
          if (isML) uniqueMLOrders.add(oc);
        }
        if (monthMap[monthNames[d.getMonth()]] !== undefined)
          monthMap[monthNames[d.getMonth()]] += cantVendida;

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
      .map((m) => ({ mes: m, ventas: monthMap[m] }));
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
          ? r.MODELO || r.Modelo || r.modelo
          : r.CLIENTE || r.Cliente || r.cliente) === name
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
        (a, b) =>
          new Date(b.FECHA || b.Fecha || b.fecha) -
          new Date(a.FECHA || a.Fecha || a.fecha)
      )
      .map((r) => {
        const cant = Number(r.CANTIDAD || r.Cantidad || r.cantidad || 1);
        total += cant;
        const key =
          modoVista === "CLIENTES"
            ? r.MODELO || r.Modelo || r.modelo || ""
            : r.CLIENTE || r.Cliente || r.cliente || "";
        pieMap[key] = (pieMap[key] || 0) + cant;
        const d = new Date(r.FECHA || r.Fecha || r.fecha);
        if (!isNaN(d)) {
          const mName = monthNames[d.getMonth()];
          if (prodMonthMap[mName] !== undefined) prodMonthMap[mName] += cant;
        }
        return {
          fecha: new Date(r.FECHA || r.Fecha || r.fecha).toLocaleDateString(
            "es-AR"
          ),
          col: key,
          cant,
          oc: r.OC || r.oc || "-",
          isML: (r.DETALLES || r.Detalles || r.detalles || "")
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
    // ...chart logic same as before...
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
    <div className="animate-in fade-in duration-500 relative">
      {/* --- TABS DE NAVEGACIÓN PRINCIPAL --- */}
      <div className="flex items-center border-b border-slate-700 mb-6 gap-2">
        <button
          onClick={() => setView("DASHBOARD")}
          className={`py-3 px-4 font-bold flex items-center gap-2 text-sm transition-colors ${
            view === "DASHBOARD"
              ? "text-white border-b-2 border-blue-500 bg-slate-800/50"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <FaChartLine /> Dashboard
        </button>
        <button
          onClick={() => setView("CONSUMO")}
          className={`py-3 px-4 font-bold flex items-center gap-2 text-sm transition-colors ${
            view === "CONSUMO"
              ? "text-white border-b-2 border-purple-500 bg-slate-800/50"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <FaCogs /> Consumo
        </button>
        <button
          onClick={() => setView("TENDENCIAS")}
          className={`py-3 px-4 font-bold flex items-center gap-2 text-sm transition-colors ${
            view === "TENDENCIAS"
              ? "text-white border-b-2 border-orange-500 bg-slate-800/50"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <FaRocket className="text-orange-500" /> Tendencias & IA
        </button>
        <button
          onClick={() => setView("RUNWAY")}
          className={`py-3 px-4 font-bold flex items-center gap-2 text-sm transition-colors ${
            view === "RUNWAY"
              ? "text-white border-b-2 border-amber-500 bg-slate-800/50"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <FaHourglassHalf className="text-amber-500" /> Reloj de Insumos
        </button>
      </div>

      {/* --- VISTA 1: DASHBOARD --- */}
      {view === "DASHBOARD" && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              {isCli ? (
                <FaUsers className="text-purple-400" />
              ) : (
                <FaCubes className="text-blue-400" />
              )}{" "}
              Análisis 2025
            </h1>
            <div className="flex gap-4 items-center">
              <div className="bg-slate-800 p-1 rounded-lg border border-slate-600">
                <button
                  onClick={() => setModoVista("PRODUCTOS")}
                  className={`px-4 py-2 rounded font-bold ${
                    !isCli ? "bg-blue-600 text-white" : "text-gray-400"
                  }`}
                >
                  PRODUCTOS
                </button>
                <button
                  onClick={() => setModoVista("CLIENTES")}
                  className={`px-4 py-2 rounded font-bold ${
                    isCli ? "bg-purple-600 text-white" : "text-gray-400"
                  }`}
                >
                  CLIENTES
                </button>
              </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
            <div
              className={`bg-slate-800 p-5 rounded-xl shadow-lg text-center border-t-4 flex flex-col justify-center ${
                isCli ? "border-purple-500" : "border-blue-500"
              }`}
            >
              <h3 className="text-gray-400 text-xs font-bold mb-2">
                {isCli ? "Clientes Activos" : "Total Pedidos"}
              </h3>
              <p
                className={`text-4xl font-bold ${
                  isCli ? "text-purple-400" : "text-blue-400"
                }`}
              >
                {isCli ? data.active : analysisData.totalOrders}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isCli ? "Compras directas" : "OCs Únicos"}
              </p>
            </div>
            <div className="bg-slate-800 p-5 rounded-xl shadow-lg text-center border-t-4 border-yellow-500 flex flex-col justify-center">
              <h3 className="text-gray-400 text-xs font-bold mb-2">
                {isCli ? "Cliente Top" : "MercadoLibre"}
              </h3>
              {isCli ? (
                <>
                  <p className="text-lg font-bold text-yellow-400 truncate">
                    {data.y[0]?.name}
                  </p>
                  <p className="text-xs text-gray-500">{data.y[0]?.value} u.</p>
                </>
              ) : (
                <>
                  <p className="text-4xl font-bold text-yellow-400">
                    {analysisData.mlOrders}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(
                      (analysisData.mlOrders / analysisData.totalOrders) *
                      100
                    ).toFixed(0)}
                    %
                  </p>
                </>
              )}
            </div>
            <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-t-4 border-green-500">
              <h3 className="text-gray-400 text-xs font-bold mb-3 text-center">
                Top 5 Mes
              </h3>
              <ul className="space-y-1">
                {data.m.map((p, i) => (
                  <li
                    key={i}
                    className="flex justify-between text-sm border-b border-slate-700"
                  >
                    <span className="truncate w-32">{p.name}</span>
                    <span className="text-green-400 font-bold">{p.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-t-4 border-teal-400">
              <h3 className="text-gray-400 text-xs font-bold mb-3 text-center">
                Top 5 Semana
              </h3>
              {data.w.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-gray-500 text-xs italic text-center px-2">
                    Aún no hay pedidos registrados esta semana.
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {data.w.map((p, i) => (
                    <li
                      key={i}
                      className="flex justify-between text-sm border-b border-slate-700"
                    >
                      <span className="truncate w-32">{p.name}</span>
                      <span className="text-teal-400 font-bold">{p.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-slate-800 p-5 rounded-xl shadow-lg text-center border-t-4 border-purple-500 flex flex-col justify-center">
              <h3 className="text-gray-400 text-xs font-bold mb-2">
                Mes Récord
              </h3>
              <p className="text-3xl font-bold text-purple-400">
                {analysisData.recordMonthName}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
            <div className="bg-slate-800 p-6 rounded-xl shadow-lg h-[400px]">
              <h3 className="text-xl font-bold mb-4 text-gray-200">
                Top 10 Anual
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.y} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid
                    strokeOpacity={0.1}
                    horizontal
                    vertical={false}
                  />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    width={120}
                    style={{ fontSize: "11px" }}
                  />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b" }} />
                  <Bar
                    dataKey="value"
                    fill={isCli ? "#a855f7" : "#3b82f6"}
                    radius={[0, 4, 4, 0]}
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
            <div className="bg-slate-800 p-6 rounded-xl shadow-lg h-[400px]">
              <h3 className="text-xl font-bold mb-4 text-gray-200">
                Evolución Mensual
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysisData.salesByMonth}>
                  <CartesianGrid strokeOpacity={0.1} />
                  <XAxis dataKey="mes" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b" }} />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* --- VISTA 2: CONSUMO --- */}
      {view === "CONSUMO" && <ConsumptionView analysisData={analysisData} />}

      {/* --- VISTA 3: TENDENCIAS & IA (NUEVO) --- */}
      {view === "TENDENCIAS" && <TendenciasView />}
      {/* --- VISTA 4: RUNWAY INSUMOS (NUEVO) --- */}
      {view === "RUNWAY" && <InsumosRunway />}

      {/* --- MODAL DETALLE (Igual que antes) --- */}
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
