import { useEffect, useState, useMemo } from "react";
import {
  FaUsers,
  FaCubes,
  FaUserTie,
  FaBoxOpen,
  FaChartLine,
  FaHistory,
  FaSpinner,
  FaCogs,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PEDIDOS_API_URL, API_BASE_URL } from "../utils.js"; // Importamos API_BASE_URL

// URL para la nueva ruta del backend
const RECETAS_ALL_URL = `${API_BASE_URL}/ingenieria/recetas/all`;

// --- NUEVO HELPER: Normalizar Claves ---
// Quita espacios al inicio/final y convierte a mayúsculas para comparar
const normalizeKey = (key) => (key || "").trim().toUpperCase();

export default function AnalisisPedidos() {
  const [datosPedidos, setDatosPedidos] = useState([]);
  const [datosRecetas, setDatosRecetas] = useState({});
  const [loading, setLoading] = useState(true);

  // Estado de la Pestaña: "DASHBOARD" o "CONSUMO"
  const [view, setView] = useState("DASHBOARD");

  // Estados del Dashboard
  const [modoVista, setModoVista] = useState("PRODUCTOS");
  const [busqueda, setBusqueda] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalPage, setModalPage] = useState(1);
  const [historialFilter, setHistorialFilter] = useState("TODOS");
  const MODAL_ITEMS_PER_PAGE = 5;

  useEffect(() => {
    // Cargamos pedidos Y recetas al mismo tiempo
    Promise.all([
      fetch(`${PEDIDOS_API_URL}?t=${Date.now()}`).then((r) => r.json()),
      fetch(RECETAS_ALL_URL).then((r) => r.json()),
    ])
      .then(([pedidos, recetas]) => {
        setDatosPedidos(pedidos);
        setDatosRecetas(recetas);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  // --- PROCESAMIENTO DE DATOS (USEMEMO MEJORADO) ---
  const analysisData = useMemo(() => {
    if (datosPedidos.length === 0) return null;
    const now = new Date();
    const currentMonth = now.getMonth();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(
      now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)
    );
    startOfWeek.setHours(0, 0, 0, 0);

    // --- MEJORA: Normalizamos las claves de las recetas UNA SOLA VEZ ---
    const normalizedRecetas = {};
    Object.keys(datosRecetas).forEach((key) => {
      normalizedRecetas[normalizeKey(key)] = datosRecetas[key];
    });
    // ----------------------------------------------------------------

    const filteredData = datosPedidos.filter((row) => {
      const d = row.FECHA || row.Fecha || row.fecha;
      if (!d) return false;
      if (
        (row.ESTADO || row.Estado || "")
          .toString()
          .toUpperCase()
          .includes("CANCELADO")
      )
        return false;
      return !isNaN(new Date(d)) && new Date(d).getFullYear() >= 2025;
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

    const consumoMap = {};

    filteredData.forEach((row) => {
      const d = new Date(row.FECHA || row.Fecha || row.fecha);
      const oc = row.OC || row.oc;
      const isML = (row.DETALLES || "")
        .toString()
        .toLowerCase()
        .includes("mercadolibre");
      const prodName = row.MODELO || row.Modelo || "Desconocido";
      const cliName = row.CLIENTE || row.Cliente || "Desconocido";
      const cantVendida = Number(row.CANTIDAD || row.Cantidad || 1);

      // Clave normalizada para búsqueda
      const prodKey = normalizeKey(prodName);

      if (prodName !== "Desconocido") {
        allModels.add(prodName);
        prodMapY[prodKey] = (prodMapY[prodKey] || 0) + cantVendida; // Usamos la clave normalizada
        if (d.getMonth() === currentMonth)
          prodMapM[prodKey] = (prodMapM[prodKey] || 0) + cantVendida;
        if (d >= startOfWeek)
          prodMapW[prodKey] = (prodMapW[prodKey] || 0) + cantVendida;

        // --- LÓGICA DE EXPLOSIÓN (AHORA NORMALIZADA) ---
        const receta = normalizedRecetas[prodKey]; // Buscamos con la clave limpia
        if (receta) {
          receta.forEach((insumo) => {
            const consumoTotal = insumo.cantidad * cantVendida;
            consumoMap[insumo.nombre] =
              (consumoMap[insumo.nombre] || 0) + consumoTotal;
          });
        }
        // ----------------------------------------
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
      if (oc) {
        uniqueOrders.add(oc);
        if (isML) uniqueMLOrders.add(oc);
      }
      if (monthMap[monthNames[d.getMonth()]] !== undefined)
        monthMap[monthNames[d.getMonth()]] += cantVendida;
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

    const consumoData = Object.entries(consumoMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      salesByMonth,
      totalOrders: uniqueOrders.size,
      mlOrders: uniqueMLOrders.size,
      recordMonthName: recordMonth?.mes || "-",
      raw: filteredData,
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
      // Datos para debug:
      nombresRecetas: Object.keys(datosRecetas),
    };
  }, [datosPedidos, datosRecetas]); // Depende de ambos

  // --- MANEJO DEL BUSCADOR ---
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

  // --- SELECCIÓN DE ITEM (ABRIR MODAL) ---
  const selectItem = (name) => {
    setBusqueda("");
    setMostrarSugerencias(false);
    setModalPage(1);
    setHistorialFilter("TODOS");
    const rows = analysisData.raw.filter(
      (r) =>
        (modoVista === "PRODUCTOS"
          ? r.MODELO || r.Modelo
          : r.CLIENTE || r.Cliente) === name
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
        (a, b) => new Date(b.FECHA || b.Fecha) - new Date(a.FECHA || a.Fecha)
      )
      .map((r) => {
        const cant = Number(r.CANTIDAD || 1);
        total += cant;

        const key = modoVista === "CLIENTES" ? r.MODELO || "" : r.CLIENTE || "";
        pieMap[key] = (pieMap[key] || 0) + cant;

        const d = new Date(r.FECHA || r.Fecha || r.fecha);
        if (!isNaN(d)) {
          const mName = monthNames[d.getMonth()];
          if (prodMonthMap[mName] !== undefined) prodMonthMap[mName] += cant;
        }

        return {
          fecha: new Date(r.FECHA || r.Fecha).toLocaleDateString("es-AR"),
          col: key,
          cant,
          oc: r.OC || r.oc || "-",
          isML: (r.DETALLES || "")
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

  // --- Renderizado ---
  if (loading)
    return (
      <div className="flex justify-center items-center h-64 text-white text-2xl">
        <FaSpinner className="animate-spin mr-3" /> Cargando...
      </div>
    );
  if (!analysisData)
    return <div className="text-white text-center p-10">Sin datos.</div>;

  const isCli = modoVista === "CLIENTES";
  const data = isCli ? analysisData.cli : analysisData.prod;
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"];

  let modalHistory = [];
  let totalPages = 0;
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
  }

  // --- RENDER COMPLETO ---
  return (
    <div className="animate-in fade-in duration-500 relative">
      {/* --- PESTAÑAS PRINCIPALES --- */}
      <div className="flex items-center border-b border-slate-700 mb-6">
        <button
          onClick={() => setView("DASHBOARD")}
          className={`py-3 px-6 font-bold flex items-center gap-2 ${
            view === "DASHBOARD"
              ? "text-white border-b-2 border-blue-500"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <FaChartLine /> Dashboard
        </button>
        <button
          onClick={() => setView("CONSUMO")}
          className={`py-3 px-6 font-bold flex items-center gap-2 ${
            view === "CONSUMO"
              ? "text-white border-b-2 border-purple-500"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <FaCogs /> Consumo de Insumos
        </button>
      </div>

      {/* --- VISTA: DASHBOARD (PRODUCTOS/CLIENTES) --- */}
      {view === "DASHBOARD" && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              {isCli ? (
                <FaUsers className="text-purple-400" />
              ) : (
                <FaCubes className="text-blue-400" />
              )}{" "}
              Análisis 2025{" "}
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
              <div className="relative w-80">
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-slate-600 rounded-full py-2 px-4 focus:ring-2 focus:ring-blue-500"
                />
                {mostrarSugerencias && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto border border-slate-600">
                    {sugerencias.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => selectItem(s)}
                        className="px-4 py-2 hover:bg-slate-600 cursor-pointer text-white border-b border-slate-600 flex gap-2 items-center"
                      >
                        {isCli ? <FaUserTie /> : <FaCubes />} {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

      {/* --- VISTA: CONSUMO DE INSUMOS (NUEVA) --- */}
      {view === "CONSUMO" && (
        <div className="animate-in fade-in duration-500">
          <h1 className="text-4xl font-bold mb-2">Consumo de Insumos (2025)</h1>
          <p className="text-gray-400 mb-8">
            Demanda total de semielaborados basada en los pedidos vendidos
            (Explosión de Materiales).
          </p>

          {/* --- AYUDA DE DIAGNÓSTICO --- */}
          <details className="text-sm text-gray-500 mb-6 bg-slate-800 border border-slate-700 rounded-lg">
            <summary className="cursor-pointer p-3 font-medium">
              Ayuda: ¿Gráfico vacío o datos incorrectos?
            </summary>
            <div className="p-4 border-t border-slate-700">
              <p>
                Esto pasa si los nombres de 'MODELO' en tu Excel de Pedidos no
                coinciden con los nombres guardados en Ingeniería.
              </p>
              <p className="mt-1">
                El sistema normaliza (quita espacios y pone mayúsculas) para
                comparar.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <p className="mt-2 font-bold text-gray-300">
                    Nombres en Pedidos (Excel):
                  </p>
                  <pre className="text-xs bg-slate-900 p-2 rounded max-h-40 overflow-y-auto">
                    {JSON.stringify(
                      analysisData.prod.list.slice(0, 10),
                      null,
                      2
                    )}
                  </pre>
                </div>
                <div>
                  <p className="mt-2 font-bold text-gray-300">
                    Nombres con Receta (Ingeniería):
                  </p>
                  <pre className="text-xs bg-slate-900 p-2 rounded max-h-40 overflow-y-auto">
                    {JSON.stringify(
                      analysisData.nombresRecetas.slice(0, 10),
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            </div>
          </details>

          <div className="bg-slate-800 p-6 rounded-xl shadow-lg h-[600px]">
            <h3 className="text-xl font-bold mb-4 text-gray-200">
              Ranking de Semielaborados
            </h3>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart
                data={analysisData.consumo}
                layout="vertical"
                margin={{ left: 100 }}
              >
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
                  width={150}
                  style={{ fontSize: "10px" }}
                />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b" }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                  {analysisData.consumo.map((e, i) => (
                    <Cell key={i} fill={i < 5 ? "#c084fc" : "#581c87"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* --- MODAL DE DETALLE (MEJORADO CON GRÁFICO DE LÍNEA) --- */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-slate-600 flex flex-col">
            <div className="p-6 border-b border-slate-700 flex justify-between items-start bg-slate-800 sticky top-0 z-10">
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  {isCli ? <FaUserTie /> : <FaCubes />} {selectedItem.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-2xl text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Columna Izquierda (KPIs) */}
              <div className="space-y-6">
                <div
                  className={`bg-opacity-20 p-5 rounded-xl border text-center ${
                    isCli
                      ? "bg-purple-900 border-purple-800"
                      : "bg-blue-900 border-blue-800"
                  }`}
                >
                  <h3 className="text-xs font-bold mb-2 text-gray-300">
                    Total 2025
                  </h3>
                  <p className="text-5xl font-bold text-white">
                    {selectedItem.total}
                  </p>
                </div>
                <div className="bg-slate-700/50 p-5 rounded-xl border border-slate-600 h-64">
                  <h3 className="text-xs font-bold mb-2 text-center text-gray-300">
                    {isCli ? "Productos Favoritos" : "Top Clientes"}
                  </h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={selectedItem.pie}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        dataKey="value"
                      >
                        {selectedItem.pie.map((e, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          color: "#fff",
                        }}
                        itemStyle={{ color: "#fff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Columna Derecha (Gráfico y Bitácora) */}
              <div className="md:col-span-2 space-y-6">
                {/* --- GRÁFICO DE LÍNEA DEL MODAL --- */}
                <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                  <h3 className="text-gray-200 font-bold mb-4 text-sm uppercase">
                    Evolución Mensual (Solo{" "}
                    {selectedItem.type === "PRODUCTOS"
                      ? "este producto"
                      : "este cliente"}
                    )
                  </h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedItem.salesChart}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          strokeOpacity={0.1}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="mes"
                          stroke="#94a3b8"
                          interval={0}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          allowDecimals={false}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#334155",
                            borderRadius: "8px",
                          }}
                          itemStyle={{ color: "#3b82f6" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="ventas"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#3b82f6", stroke: "#fff" }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bitácora Historial */}
                <div className="bg-slate-700/30 p-5 rounded-xl border border-slate-600">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold flex gap-2 text-sm items-center">
                      <FaHistory className="text-green-400" /> Historial
                    </h3>
                    <div className="flex bg-slate-800 rounded p-1">
                      {["TODOS", "SIN_ML", "SOLO_ML"].map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setHistorialFilter(f);
                            setModalPage(1);
                          }}
                          className={`px-2 py-1 text-[10px] rounded ${
                            historialFilter === f
                              ? "bg-blue-600"
                              : "text-gray-400"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="min-h-[200px]">
                    <table className="w-full text-sm text-left text-gray-300">
                      <thead className="text-xs text-gray-400 bg-slate-700/50">
                        <tr>
                          <th className="p-2">Fecha</th>
                          <th className="p-2">
                            {isCli ? "Producto" : "Cliente"}
                          </th>
                          <th className="p-2">Cant</th>
                          <th className="p-2">OC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalHistory.map((h, i) => (
                          <tr
                            key={i}
                            className="border-b border-slate-700 hover:bg-slate-700/50"
                          >
                            <td className="p-2 font-mono text-xs flex gap-2">
                              {h.fecha}{" "}
                              {h.isML && (
                                <span className="bg-yellow-500 text-black px-1 rounded text-[9px]">
                                  MELI
                                </span>
                              )}
                            </td>
                            <td className="p-2 truncate max-w-[150px]">
                              {h.col}
                            </td>
                            <td className="p-2">{h.cant}</td>
                            <td className="p-2 text-xs">{h.oc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between mt-4">
                    <button
                      disabled={modalPage === 1}
                      onClick={() => setModalPage((p) => p - 1)}
                      className="px-3 py-1 bg-slate-600 text-xs rounded disabled:opacity-50"
                    >
                      Ant
                    </button>
                    <span className="text-xs text-gray-500 mt-1">
                      Página {modalPage} de {totalPages || 1}
                    </span>
                    <button
                      disabled={modalPage === totalPages || totalPages === 0}
                      onClick={() => setModalPage((p) => p + 1)}
                      className="px-3 py-1 bg-slate-600 text-xs rounded disabled:opacity-50"
                    >
                      Sig
                    </button>
                  </div>
                </div>
                <div className="bg-slate-900/30 p-3 rounded text-center text-xs text-gray-400">
                  Último movimiento:{" "}
                  <span className="text-white">{selectedItem.last}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
