// src/App.jsx
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

import {
  FaFire,
  FaSnowflake,
  FaPowerOff,
  FaHourglassHalf,
  FaChartPie,
  FaHistory,
  FaTachometerAlt,
  FaExclamationTriangle,
  FaTools,
  FaHome,
  FaPlus,
  FaTrash,
  FaBoxOpen,
  FaSpinner,
  FaKey,
  FaSignOutAlt,
  FaCubes,
  FaChartLine,
  FaUsers,
  FaCogs,
  FaSave,
  FaDatabase,
  FaArrowLeft,
  FaLock,
  FaUserTie, // <--- Asegurate de tener estos dos nuevos
} from "react-icons/fa";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie, // <--- Asegurate de tener estos nuevos gráficos
} from "recharts";

// Arriba de todo en App.jsx
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core"; // <--- AGREGAR DragOverlay

// --- Constantes ---
const API_BASE_URL = "https://horno-backend.onrender.com/api";
//const API_BASE_URL = "http://localhost:4000/api"; // Descomentar para desarrollo local

const REGISTROS_API_URL = `${API_BASE_URL}/registros`;
const PRODUCCION_API_URL = `${API_BASE_URL}/produccion`;
const PEDIDOS_API_URL = `${API_BASE_URL}/pedidos-analisis`;

const POLLING_INTERVAL = 10000;
const HORAS_TIMEOUT_ENFRIADO = 2;
const MAX_HORAS_CICLO_PROMEDIO = 4;
const ALARMA_WINDOW_HOURS = 24;

// --- 🔐 CONTRASEÑAS DIFERENCIADAS ---
const PASS_PANEL = "accesohorno"; // Para operarios
const PASS_GERENCIA = "accesodata"; // Para análisis e ingeniería

// ==============================================================================
// 1. FUNCIONES AUXILIARES
// ==============================================================================

function formatDuration(ms) {
  if (isNaN(ms) || ms < 0) return "N/A";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

function getStationStatus(stationId, allRecords) {
  const lastEvent = allRecords.find(
    (reg) =>
      reg.accion.includes(`Estacion ${stationId}`) && reg.tipo !== "PRODUCCION"
  );
  let status = "INACTIVA";
  if (lastEvent) {
    if (lastEvent.accion.includes("Se inicio ciclo")) status = "COCINANDO";
    else if (lastEvent.accion.includes("Enfriando")) status = "ENFRIANDO";
  }
  const cycleStartEvents = allRecords.filter(
    (reg) =>
      reg.tipo === "EVENTO" &&
      reg.accion.includes(`Se inicio ciclo Estacion ${stationId}`)
  );
  let cycleDuration = "N/A";
  let averageCycleTime = "N/A";
  let averageCycleTimeMs = null;
  const allCycleDurationsMs = [];
  if (cycleStartEvents.length >= 2) {
    for (let i = 0; i < cycleStartEvents.length - 1; i++) {
      try {
        const date1 = new Date(cycleStartEvents[i].timestamp);
        const date2 = new Date(cycleStartEvents[i + 1].timestamp);
        const diffMs = date1.getTime() - date2.getTime();
        if (i === 0) cycleDuration = formatDuration(diffMs);
        allCycleDurationsMs.push(diffMs);
      } catch (e) {
        console.error(e);
      }
    }
    const last10Durations = allCycleDurationsMs.slice(0, 10);
    const maxMs = MAX_HORAS_CICLO_PROMEDIO * 60 * 60 * 1000;
    const validDurations = last10Durations.filter((ms) => ms < maxMs);
    if (validDurations.length > 0) {
      const totalMs = validDurations.reduce((sum, ms) => sum + ms, 0);
      const avgMs = totalMs / validDurations.length;
      averageCycleTime = formatDuration(avgMs);
      averageCycleTimeMs = avgMs;
    }
  }
  let liveCycleStartTime = null;
  if (status === "COCINANDO" || status === "ENFRIANDO") {
    if (cycleStartEvents[0]) {
      try {
        liveCycleStartTime = new Date(cycleStartEvents[0].timestamp);
      } catch (e) {
        console.error(e);
      }
    }
  }
  let cyclesToday = 0;
  try {
    const todayStr = new Date().toISOString().substring(0, 10);
    cyclesToday = cycleStartEvents.filter((reg) => {
      const eventDate = new Date(reg.timestamp);
      eventDate.setMinutes(
        eventDate.getMinutes() - eventDate.getTimezoneOffset()
      );
      return eventDate.toISOString().substring(0, 10) === todayStr;
    }).length;
  } catch (e) {
    console.error(e);
  }
  if (status === "ENFRIANDO" && lastEvent) {
    try {
      const enfriandoStartTime = new Date(lastEvent.timestamp);
      const diffHours = (new Date() - enfriandoStartTime) / (1000 * 60 * 60);
      if (diffHours > HORAS_TIMEOUT_ENFRIADO) {
        status = "INACTIVA";
        liveCycleStartTime = null;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return {
    status,
    lastEvent: lastEvent || null,
    cycleDuration,
    liveCycleStartTime,
    cyclesToday,
    averageCycleTime,
    averageCycleTimeMs,
  };
}

// ==============================================================================
// 2. DASHBOARD (HORNOS EN VIVO)
// ==============================================================================

function StationCard({ title, data }) {
  const [liveDuration, setLiveDuration] = useState("---");
  const animations = {
    COCINANDO: {
      opacity: [1, 0.6, 1],
      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
    },
    ENFRIANDO: {
      rotate: [0, 360],
      transition: { duration: 10, repeat: Infinity, ease: "linear" },
    },
    INACTIVA: { opacity: 1, rotate: 0 },
  };
  const statusStyles = {
    COCINANDO: {
      bgColor: "bg-gradient-to-br from-red-700 to-red-900",
      textColor: "text-red-100",
      icon: FaFire,
    },
    ENFRIANDO: {
      bgColor: "bg-gradient-to-br from-blue-700 to-blue-900",
      textColor: "text-blue-100",
      icon: FaSnowflake,
    },
    INACTIVA: {
      bgColor: "bg-gradient-to-br from-gray-600 to-gray-800",
      textColor: "text-gray-300",
      icon: FaPowerOff,
    },
  };
  const styles = statusStyles[data.status];
  const IconComponent = styles.icon;

  useEffect(() => {
    if (!data.liveCycleStartTime) {
      setLiveDuration("---");
      return;
    }
    const timerId = setInterval(() => {
      setLiveDuration(formatDuration(new Date() - data.liveCycleStartTime));
    }, 1000);
    return () => clearInterval(timerId);
  }, [data.liveCycleStartTime]);

  const formatFullTimestamp = (timestampString) => {
    if (!timestampString) return { fecha: "N/A", hora: "N/A" };
    const date = new Date(timestampString);
    return {
      fecha: date.toLocaleDateString("es-AR"),
      hora: date.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
  };
  const { fecha: lastEventFecha, hora: lastEventHora } = formatFullTimestamp(
    data.lastEvent?.timestamp
  );

  return (
    <div
      className={`rounded-xl shadow-2xl p-6 ${styles.bgColor} transition-all duration-500`}
    >
      <h2 className="text-3xl font-bold text-white mb-5">{title}</h2>
      <div
        className={`flex flex-col items-center justify-center p-8 rounded-lg ${styles.textColor} mb-6`}
      >
        <motion.div animate={animations[data.status]}>
          <IconComponent className="text-6xl" />
        </motion.div>
        <span className="text-4xl font-extrabold mt-4">{data.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6 text-white text-center">
        <div className="bg-green-800/80 p-3 rounded-lg shadow-inner">
          <div className="text-xs text-green-300 uppercase">En Vivo</div>
          <div className="text-2xl font-bold font-mono">{liveDuration}</div>
        </div>
        <div className="bg-blue-900/80 p-3 rounded-lg shadow-inner">
          <div className="text-xs text-blue-300 uppercase">Ciclos Hoy</div>
          <div className="text-2xl font-bold font-mono">{data.cyclesToday}</div>
        </div>
        <div className="bg-black/20 p-3 rounded-lg shadow-inner">
          <div className="text-xs text-gray-300 uppercase">Ciclo Ant.</div>
          <div className="text-2xl font-bold font-mono">
            {data.cycleDuration}
          </div>
        </div>
        <div className="bg-purple-900/80 p-3 rounded-lg shadow-inner">
          <div className="text-xs text-purple-300 uppercase">
            Prom. (Últ. 10)
          </div>
          <div className="text-2xl font-bold font-mono">
            {data.averageCycleTime}
          </div>
        </div>
      </div>
      {data.status !== "INACTIVA" && (
        <div className="mb-4 bg-black/20 p-3 rounded-lg max-h-32 overflow-y-auto">
          <h3 className="font-semibold text-sm mb-1 text-gray-200">
            Producción:
          </h3>
          {data.productos && data.productos.length > 0 ? (
            <ul className="list-disc list-inside text-gray-200 text-sm">
              {data.productos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 italic text-xs">Sin carga</p>
          )}
        </div>
      )}
      <div className="text-sm text-gray-200 bg-black/20 p-4 rounded-lg">
        <p>
          <strong>Último:</strong>{" "}
          {data.lastEvent
            ? `${data.lastEvent.accion} (${lastEventHora})`
            : "N/A"}
        </p>
      </div>
    </div>
  );
}

function AlarmMenu({ alarms }) {
  const [isOpen, setIsOpen] = useState(false);
  if (alarms.length === 0) return null;
  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <div className="relative mb-8 w-full md:w-1/2 mx-auto z-10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-red-700 text-white p-3 rounded-lg shadow-lg flex items-center justify-center font-bold text-lg hover:bg-red-600"
      >
        <FaExclamationTriangle className="mr-3" /> {alarms.length} Alarma(s)
        (24hs)
      </button>
      {isOpen && (
        <div className="absolute w-full bg-slate-700 rounded-b-lg shadow-xl overflow-hidden p-4 max-h-60 overflow-y-auto">
          {alarms.map((a) => (
            <div
              key={a.id}
              className="flex items-start p-2 border-b border-slate-600"
            >
              <FaExclamationTriangle className="text-yellow-300 mr-3 mt-1" />
              <div>
                <span className="font-bold">({formatTime(a.timestamp)})</span>{" "}
                <span className="text-gray-300">{a.accion}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard({ onNavigate }) {
  const [registros, setRegistros] = useState([]);
  const [produccion, setProduccion] = useState({ 1: [], 2: [] });
  const [cargando, setCargando] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchDatos = () => {
      Promise.all([
        fetch(REGISTROS_API_URL).then((r) => r.json()),
        fetch(PRODUCCION_API_URL).then((r) => r.json()),
      ])
        .then(([regs, prod]) => {
          setRegistros(regs);
          setProduccion(prod);
          setCargando(false);
        })
        .catch(console.error);
    };
    fetchDatos();
    const intervalId = setInterval(fetchDatos, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  const cycleTimeMap = useMemo(() => {
    const station1Starts = registros.filter(
      (reg) =>
        reg.tipo === "EVENTO" &&
        reg.accion.includes("Se inicio ciclo Estacion 1")
    );
    const station2Starts = registros.filter(
      (reg) =>
        reg.tipo === "EVENTO" &&
        reg.accion.includes("Se inicio ciclo Estacion 2")
    );
    const station1Prods = registros.filter(
      (reg) => reg.tipo === "PRODUCCION" && reg.accion.includes("Estacion 1")
    );
    const station2Prods = registros.filter(
      (reg) => reg.tipo === "PRODUCCION" && reg.accion.includes("Estacion 2")
    );

    const newMap = {};
    const processStarts = (starts, prods, estacionAccion) => {
      for (let i = 0; i < starts.length - 1; i++) {
        const currentEvent = starts[i];
        const previousEvent = starts[i + 1];
        try {
          const date1 = new Date(currentEvent.timestamp);
          const date2 = new Date(previousEvent.timestamp);
          const diffMs = date1.getTime() - date2.getTime();
          const matchingProd = prods.find((p) => {
            const pDate = new Date(p.timestamp);
            return pDate < date1 && pDate > date2;
          });
          const key = matchingProd ? matchingProd.id : currentEvent.id;
          newMap[key] = {
            durationMs: diffMs,
            durationStr: formatDuration(diffMs),
            accion: estacionAccion,
          };
        } catch (e) {
          console.error(e);
        }
      }
    };
    processStarts(station1Starts, station1Prods, "Estacion 1");
    processStarts(station2Starts, station2Prods, "Estacion 2");
    return newMap;
  }, [registros]);

  const cycleChartData = useMemo(() => {
    const combinedData = [];
    const maxMinutes = MAX_HORAS_CICLO_PROMEDIO * 60;
    const processCycles = (stationId, name) => {
      const starts = registros.filter(
        (r) =>
          r.tipo === "EVENTO" &&
          r.accion.includes(`Se inicio ciclo Estacion ${stationId}`)
      );
      for (let i = 0; i < starts.length - 1; i++) {
        const diffMs =
          new Date(starts[i].timestamp) - new Date(starts[i + 1].timestamp);
        const mins = diffMs / 60000;
        if (mins > 0 && mins <= maxMinutes)
          combinedData.push({ timestamp: starts[i].timestamp, [name]: mins });
      }
    };
    processCycles(1, "Estación 1");
    processCycles(2, "Estación 2");
    return combinedData
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-30);
  }, [registros]);

  const recentAlarms = useMemo(() => {
    const limit = new Date().getTime() - ALARMA_WINDOW_HOURS * 3600000;
    return registros.filter(
      (r) => r.tipo === "ALARMA" && new Date(r.timestamp).getTime() > limit
    );
  }, [registros]);

  const statusEstacion1 = getStationStatus(1, registros);
  const statusEstacion2 = getStationStatus(2, registros);
  const avgMsEstacion1 = statusEstacion1.averageCycleTimeMs;
  const avgMsEstacion2 = statusEstacion2.averageCycleTimeMs;

  statusEstacion1.productos = produccion[1] || [];
  statusEstacion2.productos = produccion[2] || [];

  const calculatedTotalPages = Math.ceil(registros.length / ITEMS_PER_PAGE);
  const totalPages = Math.min(calculatedTotalPages, 25);
  const historialPaginado = registros.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const handleNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  if (cargando)
    return (
      <div className="flex justify-center items-center h-screen text-white text-2xl">
        <FaSpinner className="animate-spin mr-4" /> Cargando...
      </div>
    );

  return (
    <div className="animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <h1 className="text-4xl md:text-4xl font-bold text-center md:text-left flex items-center gap-3 text-white">
          <FaFire className="text-orange-500" /> Hornos en Vivo
        </h1>
        <button
          onClick={() => onNavigate("/panel-control")}
          className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg border border-slate-600 flex items-center gap-2 transition-all active:scale-95 group"
        >
          <FaTools className="text-gray-400 group-hover:text-white transition-colors" />{" "}
          Panel de Control
        </button>
      </div>

      <AlarmMenu alarms={recentAlarms} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-12">
        <StationCard title="Estación 1 (Izquierda)" data={statusEstacion1} />
        <StationCard title="Estación 2 (Derecha)" data={statusEstacion2} />
      </div>

      <div className="bg-slate-800 rounded-lg shadow-xl p-6 h-[400px] mb-12">
        <h3 className="text-xl font-bold mb-4">
          Tiempos de Ciclo (Últimos 30)
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={cycleChartData}
            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis
              dataKey="timestamp"
              stroke="#94a3b8"
              tickFormatter={(ts) =>
                new Date(ts).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                })
              }
            />
            <YAxis
              stroke="#94a3b8"
              label={{
                value: "Minutos",
                angle: -90,
                position: "insideLeft",
                fill: "#94a3b8",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                borderColor: "#334155",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Estación 1"
              stroke="#c0392b"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="Estación 2"
              stroke="#2980b9"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TABLA DE HISTORIAL RESTAURADA */}
      <h2 className="text-3xl font-semibold mb-6">
        Historial Reciente (Global)
      </h2>
      <div className="bg-slate-800 rounded-lg shadow-xl overflow-x-auto">
        <table className="w-full table-auto min-w-[800px]">
          <thead className="bg-slate-700 text-left text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3 text-center">Fecha</th>
              <th className="px-4 py-3 text-center">Hora</th>
              <th className="px-4 py-3 text-center">Tipo</th>
              <th className="px-4 py-3 text-center">Acción</th>
              <th className="px-4 py-3 text-center">Tiempo Ciclo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {historialPaginado.map((reg) => {
              const date = new Date(reg.timestamp);
              const options = { timeZone: "America/Argentina/Buenos_Aires" };
              const fechaStr = date.toLocaleDateString("es-AR", options);
              const horaStr = date.toLocaleTimeString("es-AR", {
                ...options,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
              const cycleData = cycleTimeMap[reg.id];
              let durationStr = "---";
              let slowCycleClass = "";

              if (reg.tipo === "PRODUCCION" && cycleData) {
                durationStr = cycleData.durationStr;
                if (cycleData.accion.includes("Estacion 1") && avgMsEstacion1) {
                  if (cycleData.durationMs > avgMsEstacion1 * 1.5)
                    slowCycleClass = "text-red-400 font-bold";
                } else if (
                  cycleData.accion.includes("Estacion 2") &&
                  avgMsEstacion2
                ) {
                  if (cycleData.durationMs > avgMsEstacion2 * 1.5)
                    slowCycleClass = "text-red-400 font-bold";
                }
              }

              const tipoClass =
                reg.tipo === "ALARMA"
                  ? "bg-red-600/90 text-red-100"
                  : reg.tipo === "PRODUCCION"
                  ? "bg-green-600/90 text-green-100"
                  : "bg-blue-600/90 text-blue-100";
              let productosParseados = [];
              if (reg.tipo === "PRODUCCION") {
                try {
                  productosParseados = JSON.parse(reg.productos_json || "[]");
                } catch (e) {}
              }

              return (
                <tr key={reg.id} className="hover:bg-slate-700/50 text-center">
                  <td className="px-4 py-3 text-sm">{fechaStr}</td>
                  <td className="px-4 py-3 text-sm font-mono">{horaStr}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${tipoClass}`}
                    >
                      {reg.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left">
                    {reg.tipo === "PRODUCCION" ? (
                      <div className="flex flex-wrap gap-2">
                        <span className="font-semibold text-gray-300">
                          Fin de Ciclo:
                        </span>
                        {productosParseados.length > 0 ? (
                          productosParseados.map((prod, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-gray-600 text-gray-100 rounded-md text-sm"
                            >
                              {prod}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 italic">
                            Sin productos
                          </span>
                        )}
                      </div>
                    ) : (
                      reg.accion
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm font-mono ${slowCycleClass}`}
                  >
                    {durationStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-6 text-gray-300">
        <button
          onClick={handlePrevPage}
          disabled={currentPage === 1}
          className="px-5 py-2 bg-slate-600 text-white rounded-md shadow disabled:opacity-50 hover:bg-slate-500 transition-colors"
        >
          Anterior
        </button>
        <span className="font-semibold">
          Página {currentPage} de {totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          className="px-5 py-2 bg-slate-600 text-white rounded-md shadow disabled:opacity-50 hover:bg-slate-500 transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

// ==============================================================================
// 3. PANEL DE CONTROL (MODERNO Y ESTILIZADO)
// ==============================================================================

function PanelControl({ onNavigate }) {
  const [produccion, setProduccion] = useState({ 1: [], 2: [] });
  const [input1, setInput1] = useState("");
  const [input2, setInput2] = useState("");
  const [sugerencias, setSugerencias] = useState([]);

  const fetchProduccion = async () => {
    const res = await fetch(PRODUCCION_API_URL);
    setProduccion(await res.json());
  };

  useEffect(() => {
    fetchProduccion();
  }, []);

  const handleAdd = async (estacion_id, producto) => {
    if (!producto) return;
    await fetch(PRODUCCION_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estacion_id, producto }),
    });
    if (estacion_id === 1) setInput1("");
    else setInput2("");
    fetchProduccion();
  };

  const handleClear = async (id) => {
    if (window.confirm("¿Borrar lista?")) {
      await fetch(`${PRODUCCION_API_URL}/${id}`, { method: "DELETE" });
      fetchProduccion();
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/")}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg shadow transition-all active:scale-95 border border-slate-600"
          >
            <FaArrowLeft />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FaTools className="text-gray-500" /> Panel de Control
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Gestión operativa de carga de hornos
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <EstacionControlPanel
          estacionId={1}
          title="Estación 1 (Izquierda)"
          color="red"
          productos={produccion[1] || []}
          inputValue={input1}
          onInputChange={setInput1}
          onAdd={handleAdd}
          onClear={handleClear}
          sugerencias={sugerencias}
        />
        <EstacionControlPanel
          estacionId={2}
          title="Estación 2 (Derecha)"
          color="blue"
          productos={produccion[2] || []}
          inputValue={input2}
          onInputChange={setInput2}
          onAdd={handleAdd}
          onClear={handleClear}
          sugerencias={sugerencias}
        />
      </div>
    </div>
  );
}

function EstacionControlPanel({
  title,
  estacionId,
  productos,
  inputValue,
  onInputChange,
  onAdd,
  onClear,
  color,
  sugerencias,
}) {
  const styles = {
    red: {
      borderTop: "border-t-red-500",
      iconColor: "text-red-500",
      badge: "bg-red-500/20 text-red-200 border-red-500/30",
      btn: "bg-red-600 hover:bg-red-500 ring-red-500",
    },
    blue: {
      borderTop: "border-t-blue-500",
      iconColor: "text-blue-500",
      badge: "bg-blue-500/20 text-blue-200 border-blue-500/30",
      btn: "bg-blue-600 hover:bg-blue-500 ring-blue-500",
    },
  }[color];
  const listId = `list-sugerencias-${estacionId}`;

  return (
    <div
      className={`bg-slate-800 rounded-xl shadow-2xl border border-slate-700 border-t-4 ${styles.borderTop} flex flex-col overflow-hidden`}
    >
      <div className="p-6 border-b border-slate-700 bg-slate-800/50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FaFire className={styles.iconColor} /> {title}
          </h2>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${styles.badge}`}
          >
            {productos.length} ítems
          </span>
        </div>
        <div className="flex gap-2 relative">
          <input
            type="text"
            list={listId}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all placeholder-gray-500"
            placeholder="Producto..."
            style={{
              "--tw-ring-color": color === "red" ? "#ef4444" : "#3b82f6",
            }}
          />
          <datalist id={listId}>
            {sugerencias.map((s, i) => (
              <option key={i} value={s} />
            ))}
          </datalist>
          <button
            onClick={() => onAdd(estacionId, inputValue)}
            disabled={!inputValue}
            className={`px-6 rounded-lg font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${styles.btn}`}
          >
            <FaPlus />
          </button>
        </div>
      </div>
      <div className="flex-grow p-4 bg-slate-900/30 min-h-[300px]">
        <div className="bg-slate-900 rounded-xl border border-slate-700 h-full overflow-hidden flex flex-col">
          <div className="overflow-y-auto p-2 space-y-2 flex-grow custom-scrollbar">
            {productos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60 py-10">
                <FaBoxOpen className="text-5xl mb-3" />
                <span className="text-sm">Horno vacío</span>
              </div>
            ) : (
              productos.map((prod, index) => (
                <div
                  key={index}
                  className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-left-2"
                >
                  <div
                    className={`w-2 h-8 rounded-full ${
                      color === "red" ? "bg-red-500" : "bg-blue-500"
                    }`}
                  ></div>
                  <span className="text-gray-200 font-medium text-sm">
                    {prod}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-slate-700 bg-slate-800">
        <button
          onClick={() => onClear(estacionId)}
          disabled={productos.length === 0}
          className="w-full py-3 text-sm font-bold text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
        >
          <FaTrash /> Vaciar Estación
        </button>
      </div>
    </div>
  );
}

// --- COMPONENTE DE ANÁLISIS DE PEDIDOS (v19: Historial con Filtros y Tags ML) ---
function AnalisisPedidos() {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados de Interfaz
  const [modoVista, setModoVista] = useState("PRODUCTOS"); // "PRODUCTOS" o "CLIENTES"
  const [busqueda, setBusqueda] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  // Estado del Modal
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalPage, setModalPage] = useState(1);
  const [historialFilter, setHistorialFilter] = useState("TODOS"); // NUEVO: "TODOS", "SIN_ML", "SOLO_ML"

  const MODAL_ITEMS_PER_PAGE = 5;

  useEffect(() => {
    fetch(`${PEDIDOS_API_URL}?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar el Excel");
        return res.json();
      })
      .then((data) => {
        setDatos(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // --- PROCESAMIENTO DE DATOS ---
  const analysisData = useMemo(() => {
    if (datos.length === 0) return null;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Helper: Inicio de semana
    const getStartOfWeek = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const startOfWeek = getStartOfWeek(now);

    // 1. Filtrar por año 2025 y excluir cancelados
    const filteredData = datos.filter((row) => {
      const dateVal = row.FECHA || row.Fecha || row.fecha;
      if (!dateVal) return false;

      const estado = row.ESTADO || row.Estado || "";
      if (estado.toString().toUpperCase().includes("CANCELADO")) return false;

      const rowDate = new Date(dateVal);
      return !isNaN(rowDate) && rowDate.getFullYear() >= 2025;
    });

    if (filteredData.length === 0) return null;

    // Estructuras de datos
    const uniqueOrders = new Set();
    const uniqueMLOrders = new Set();

    const productMapYear = {};
    const productMapMonth = {};
    const productMapWeek = {};

    const clientMapYear = {};
    const clientMapMonth = {};
    const clientMapWeek = {};

    const activeClients = new Set();
    const allClientsSet = new Set();
    const allModelsSet = new Set();

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

    filteredData.forEach((row) => {
      const dateVal = row.FECHA || row.Fecha || row.fecha;
      const rowDate = new Date(dateVal);
      const oc = row.OC || row.oc || row.Oc;
      const detalles = row.DETALLES || row.Detalles || row.detalles || "";
      const prodName = row.MODELO || row.Modelo || "Desconocido";
      const clientName = row.CLIENTE || row.Cliente || "Desconocido";
      const cantidad = Number(row.CANTIDAD || row.Cantidad || 1);

      const isMercadoLibre = detalles
        .toString()
        .toLowerCase()
        .includes("mercadolibre");

      // --- PRODUCTOS ---
      if (prodName && prodName !== "Desconocido") {
        allModelsSet.add(prodName);
        productMapYear[prodName] = (productMapYear[prodName] || 0) + cantidad;
        if (rowDate.getMonth() === currentMonth)
          productMapMonth[prodName] =
            (productMapMonth[prodName] || 0) + cantidad;
        if (rowDate >= startOfWeek)
          productMapWeek[prodName] = (productMapWeek[prodName] || 0) + cantidad;
      }

      // --- CLIENTES ---
      if (clientName && clientName !== "Desconocido") {
        allClientsSet.add(clientName);
        if (!isMercadoLibre) activeClients.add(clientName);

        clientMapYear[clientName] = (clientMapYear[clientName] || 0) + cantidad;
        if (rowDate.getMonth() === currentMonth)
          clientMapMonth[clientName] =
            (clientMapMonth[clientName] || 0) + cantidad;
        if (rowDate >= startOfWeek)
          clientMapWeek[clientName] =
            (clientMapWeek[clientName] || 0) + cantidad;
      }

      // --- PEDIDOS ---
      if (oc !== undefined && oc !== null && oc !== "") {
        uniqueOrders.add(oc);
        if (isMercadoLibre) uniqueMLOrders.add(oc);
      }

      // --- MENSUAL GLOBAL ---
      const monthIndex = rowDate.getMonth();
      const monthName = monthNames[monthIndex];
      if (monthMap[monthName] !== undefined) {
        monthMap[monthName] += cantidad;
      }
    });

    // Helpers de ordenamiento
    const getTop5 = (map) =>
      Object.entries(map)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const getTop10 = (map) =>
      Object.entries(map)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    // Data procesada
    const salesByMonth = monthNames.slice(0, currentMonth + 1).map((name) => ({
      mes: name,
      ventas: monthMap[name],
    }));
    const recordMonth = [...salesByMonth].sort(
      (a, b) => b.ventas - a.ventas
    )[0];

    return {
      salesByMonth,
      totalOrders: uniqueOrders.size,
      mlOrders: uniqueMLOrders.size,
      recordMonthName: recordMonth?.mes || "-",
      filteredRawData: filteredData,

      topProductsYear: getTop10(productMapYear),
      top5ProdMonth: getTop5(productMapMonth),
      top5ProdWeek: getTop5(productMapWeek),
      allModels: Array.from(allModelsSet).sort(),

      topClientsYear: getTop10(clientMapYear),
      totalActiveClients: activeClients.size,
      top5ClientMonth: getTop5(clientMapMonth),
      top5ClientWeek: getTop5(clientMapWeek),
      allClients: Array.from(allClientsSet).sort(),
    };
  }, [datos]);

  // --- MANEJO DEL BUSCADOR ---
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setBusqueda(val);
    if (val.length > 0 && analysisData) {
      const listaBase =
        modoVista === "PRODUCTOS"
          ? analysisData.allModels
          : analysisData.allClients;
      const coincidencias = listaBase.filter((item) =>
        item.toLowerCase().includes(val.toLowerCase())
      );
      setSugerencias(coincidencias);
      setMostrarSugerencias(true);
    } else {
      setMostrarSugerencias(false);
    }
  };

  // --- SELECCIÓN DE ITEM (ABRIR MODAL) ---
  const seleccionarItem = (nombre) => {
    setBusqueda("");
    setMostrarSugerencias(false);
    setModalPage(1);
    setHistorialFilter("TODOS"); // Reset del filtro al abrir nuevo modal

    const rawData = analysisData.filteredRawData;

    const rows =
      modoVista === "PRODUCTOS"
        ? rawData.filter((r) => (r.MODELO || r.Modelo) === nombre)
        : rawData.filter((r) => (r.CLIENTE || r.Cliente) === nombre);

    if (rows.length === 0) return;

    let totalUnits = 0;
    const pieMap = {};

    rows.forEach((row) => {
      const cant = Number(row.CANTIDAD || row.Cantidad || 1);
      totalUnits += cant;

      const key =
        modoVista === "CLIENTES"
          ? row.MODELO || row.Modelo || "Desconocido"
          : row.CLIENTE || row.Cliente || "Desconocido";

      pieMap[key] = (pieMap[key] || 0) + cant;
    });

    const topPie = Object.entries(pieMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Historial de pedidos (Bitácora) - CON DETECCIÓN ML
    const lastOrders = [...rows]
      .sort(
        (a, b) => new Date(b.FECHA || b.Fecha) - new Date(a.FECHA || a.Fecha)
      )
      .map((row) => {
        const detalles = row.DETALLES || row.Detalles || row.detalles || "";
        const isML = detalles.toString().toLowerCase().includes("mercadolibre");

        return {
          fecha: new Date(row.FECHA || row.Fecha).toLocaleDateString("es-AR"),
          columnaVariable:
            modoVista === "CLIENTES"
              ? row.MODELO || row.Modelo || "-"
              : row.CLIENTE || row.Cliente || "-",
          cantidad: row.CANTIDAD || row.Cantidad || 1,
          oc: row.OC || row.oc || "-",
          isML: isML, // NUEVO: Marca si es ML
        };
      });

    const lastDate = lastOrders.length > 0 ? lastOrders[0].fecha : "-";

    setSelectedItem({
      type: modoVista,
      nombre,
      totalUnits,
      topPie,
      lastOrders,
      lastDate,
    });
  };

  // --- LÓGICA DE FILTRADO Y PAGINACIÓN DEL MODAL ---
  let modalPaginationData = [];
  let totalModalPages = 0;
  let filteredHistory = [];

  if (selectedItem) {
    // 1. Aplicar Filtro
    filteredHistory = selectedItem.lastOrders.filter((order) => {
      if (historialFilter === "SIN_ML") return !order.isML;
      if (historialFilter === "SOLO_ML") return order.isML;
      return true; // "TODOS"
    });

    // 2. Calcular Paginación sobre los filtrados
    totalModalPages = Math.ceil(filteredHistory.length / MODAL_ITEMS_PER_PAGE);
    // Ajuste de seguridad por si filtramos y quedamos en una página vacía
    const safePage = Math.min(modalPage, Math.max(1, totalModalPages));
    if (safePage !== modalPage && totalModalPages > 0) setModalPage(safePage);

    const startIndex = (safePage - 1) * MODAL_ITEMS_PER_PAGE;
    // Si no hay datos, slice devuelve vacío, está bien
    modalPaginationData = filteredHistory.slice(
      startIndex,
      startIndex + MODAL_ITEMS_PER_PAGE
    );
  }

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"];

  // --- RENDERIZADO ---
  if (loading)
    return (
      <div className="flex justify-center items-center h-64 text-white text-2xl">
        <FaSpinner className="animate-spin text-4xl mr-3" /> Cargando
        análisis...
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-400">
        Error: {error}
      </div>
    );

  if (!analysisData)
    return <div className="text-white text-center p-10">Sin datos 2025.</div>;

  const isClientMode = modoVista === "CLIENTES";

  const cardTotalTitle = isClientMode ? "Clientes Activos" : "Total Pedidos";
  const cardTotalValue = isClientMode
    ? analysisData.totalActiveClients
    : analysisData.totalOrders;
  const cardTotalSub = isClientMode
    ? "Compras directas (No ML)"
    : "OCs Únicos (Año)";

  const cardTopList = isClientMode
    ? analysisData.topClientsYear
    : analysisData.topProductsYear;
  const cardTop5Month = isClientMode
    ? analysisData.top5ClientMonth
    : analysisData.top5ProdMonth;
  const cardTop5Week = isClientMode
    ? analysisData.top5ClientWeek
    : analysisData.top5ProdWeek;

  return (
    <div className="animate-in fade-in duration-500 relative">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
        <div>
          <h1 className="text-4xl font-bold text-left flex items-center gap-3">
            {isClientMode ? (
              <FaUsers className="text-purple-400" />
            ) : (
              <FaCubes className="text-blue-400" />
            )}
            Análisis de {isClientMode ? "Clientes" : "Pedidos"} 2025
          </h1>
          <p className="text-gray-400 mt-1 ml-1">
            Tablero de control comercial
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
          <div className="bg-slate-800 p-1 rounded-lg flex border border-slate-600">
            <button
              onClick={() => {
                setModoVista("PRODUCTOS");
                setBusqueda("");
              }}
              className={`px-6 py-2 rounded-md font-bold transition-all ${
                !isClientMode
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              PRODUCTOS
            </button>
            <button
              onClick={() => {
                setModoVista("CLIENTES");
                setBusqueda("");
              }}
              className={`px-6 py-2 rounded-md font-bold transition-all ${
                isClientMode
                  ? "bg-purple-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              CLIENTES
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder={
                isClientMode ? "Buscar cliente..." : "Buscar producto..."
              }
              value={busqueda}
              onChange={handleSearchChange}
              className="w-full bg-slate-800 text-white border border-slate-600 rounded-full py-3 px-5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg"
            />
            <FaBoxOpen className="absolute right-4 top-3.5 text-gray-400" />
            {mostrarSugerencias && sugerencias.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto border border-slate-600">
                {sugerencias.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => seleccionarItem(item)}
                    className="px-4 py-3 hover:bg-slate-600 cursor-pointer text-white border-b border-slate-600 last:border-0 transition-colors flex items-center gap-3"
                  >
                    {isClientMode ? (
                      <FaUserTie className="text-purple-300" />
                    ) : (
                      <FaCubes className="text-blue-300" />
                    )}
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-12">
        <div
          className={`bg-slate-800 p-5 rounded-xl shadow-lg text-center border-t-4 flex flex-col justify-center ${
            isClientMode ? "border-purple-500" : "border-blue-500"
          }`}
        >
          <h3 className="text-gray-400 uppercase text-xs font-bold mb-2">
            {cardTotalTitle}
          </h3>
          <p
            className={`text-4xl font-bold ${
              isClientMode ? "text-purple-400" : "text-blue-400"
            }`}
          >
            {cardTotalValue}
          </p>
          <p className="text-xs text-gray-500 mt-1">{cardTotalSub}</p>
        </div>

        {!isClientMode ? (
          <div className="bg-slate-800 p-5 rounded-xl shadow-lg text-center border-t-4 border-yellow-500 flex flex-col justify-center">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-2">
              MercadoLibre
            </h3>
            <p className="text-4xl font-bold text-yellow-400">
              {analysisData.mlOrders}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {(
                (analysisData.mlOrders / analysisData.totalOrders) *
                100
              ).toFixed(0)}
              % del total
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 p-5 rounded-xl shadow-lg text-center border-t-4 border-yellow-500 flex flex-col justify-center">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-2">
              Cliente Top (Año)
            </h3>
            <p className="text-lg font-bold text-yellow-400 truncate px-1">
              {cardTopList[0]?.name || "-"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {cardTopList[0]?.value || 0} u. compradas
            </p>
          </div>
        )}

        <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-t-4 border-green-500">
          <h3 className="text-gray-400 uppercase text-xs font-bold mb-3 text-center">
            Top 5 Mes Actual
          </h3>
          {cardTop5Month.length > 0 ? (
            <ul className="space-y-2">
              {cardTop5Month.map((p, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center text-sm border-b border-gray-700 pb-1 last:border-0 last:pb-0"
                >
                  <div className="flex items-center truncate pr-2">
                    <span
                      className={`font-bold mr-2 ${
                        i === 0 ? "text-yellow-400" : "text-gray-500"
                      }`}
                    >
                      #{i + 1}
                    </span>
                    <span className="text-gray-200 truncate" title={p.name}>
                      {p.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-green-400 whitespace-nowrap">
                    {p.value} u
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic text-center text-sm mt-4">
              Sin datos este mes
            </p>
          )}
        </div>

        <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-t-4 border-teal-400">
          <h3 className="text-gray-400 uppercase text-xs font-bold mb-3 text-center">
            Top 5 Semana
          </h3>
          {cardTop5Week.length > 0 ? (
            <ul className="space-y-2">
              {cardTop5Week.map((p, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center text-sm border-b border-gray-700 pb-1 last:border-0 last:pb-0"
                >
                  <div className="flex items-center truncate pr-2">
                    <span
                      className={`font-bold mr-2 ${
                        i === 0 ? "text-yellow-400" : "text-gray-500"
                      }`}
                    >
                      #{i + 1}
                    </span>
                    <span className="text-gray-200 truncate" title={p.name}>
                      {p.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-teal-400 whitespace-nowrap">
                    {p.value} u
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic text-center text-sm mt-4">
              Sin datos esta semana
            </p>
          )}
        </div>

        <div className="bg-slate-800 p-5 rounded-xl shadow-lg text-center border-t-4 border-purple-500 flex flex-col justify-center">
          <h3 className="text-gray-400 uppercase text-xs font-bold mb-2">
            Mes Récord
          </h3>
          <p className="text-3xl font-bold text-purple-400 mt-2">
            {analysisData.recordMonthName}
          </p>
          <p className="text-xs text-gray-500 mt-1">Mayor volumen global</p>
        </div>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg min-h-[450px]">
          <h3 className="text-xl font-bold mb-6 text-gray-200 flex items-center gap-2">
            {isClientMode ? (
              <FaUserTie className="text-yellow-500" />
            ) : (
              <FaBoxOpen className="text-yellow-500" />
            )}
            {isClientMode
              ? " Top 10 Clientes (Volumen Anual)"
              : " Top 10 Modelos (Global)"}
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={cardTopList}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                strokeOpacity={0.1}
                horizontal={true}
                vertical={false}
              />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#94a3b8"
                width={120}
                style={{ fontSize: "11px", fontWeight: "bold" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  borderColor: "#334155",
                  color: "#f1f5f9",
                }}
                itemStyle={{ color: "#cbd5e1" }}
                cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
              />
              <Bar
                dataKey="value"
                fill={isClientMode ? "#a855f7" : "#3b82f6"}
                radius={[0, 4, 4, 0]}
                barSize={20}
              >
                {cardTopList.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      index < 3
                        ? isClientMode
                          ? "#d8b4fe"
                          : "#60a5fa"
                        : "#475569"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl shadow-lg min-h-[450px]">
          <h3 className="text-xl font-bold mb-6 text-gray-200 flex items-center gap-2">
            <FaChartLine className="text-green-500" /> Evolución de Ventas
            Global
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              data={analysisData.salesByMonth}
              margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                strokeOpacity={0.1}
                vertical={false}
              />
              <XAxis
                dataKey="mes"
                stroke="#94a3b8"
                tick={{ fill: "#94a3b8" }}
                axisLine={{ stroke: "#475569" }}
                interval={0}
                type="category"
                padding={{ left: 20, right: 20 }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#94a3b8" }}
                axisLine={{ stroke: "#475569" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  borderColor: "#334155",
                  borderRadius: "8px",
                }}
                itemStyle={{ color: "#10b981" }}
              />
              <Line
                type="monotone"
                dataKey="ventas"
                stroke="#10b981"
                strokeWidth={4}
                dot={{ r: 6, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 9, stroke: "#10b981", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- MODAL DE DETALLE --- */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-slate-600 flex flex-col animate-in zoom-in duration-200">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-700 flex justify-between items-start sticky top-0 bg-slate-800 z-10">
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  {selectedItem.type === "PRODUCTOS" ? (
                    <FaCubes className="text-blue-400" />
                  ) : (
                    <FaUserTie className="text-purple-400" />
                  )}
                  {selectedItem.nombre}
                </h2>
                <p className="text-gray-400 mt-1">
                  {selectedItem.type === "PRODUCTOS"
                    ? "Ficha técnica del producto"
                    : "Perfil del cliente"}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-white text-2xl bg-slate-700 hover:bg-slate-600 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* COLUMNA IZQUIERDA */}
              <div className="md:col-span-1 space-y-6">
                <div
                  className={`bg-opacity-20 p-5 rounded-xl border text-center ${
                    selectedItem.type === "PRODUCTOS"
                      ? "bg-blue-900 border-blue-800"
                      : "bg-purple-900 border-purple-800"
                  }`}
                >
                  <h3
                    className={`uppercase text-xs font-bold mb-2 ${
                      selectedItem.type === "PRODUCTOS"
                        ? "text-blue-300"
                        : "text-purple-300"
                    }`}
                  >
                    Total Comprado (2025)
                  </h3>
                  <p className="text-5xl font-bold text-white">
                    {selectedItem.totalUnits}{" "}
                    <span className="text-base font-normal text-gray-400">
                      u
                    </span>
                  </p>
                </div>

                <div className="bg-slate-700/50 p-5 rounded-xl border border-slate-600">
                  <h3 className="text-gray-300 font-bold mb-4 text-sm uppercase text-center">
                    {selectedItem.type === "PRODUCTOS"
                      ? "Top Clientes"
                      : "Productos Favoritos"}
                  </h3>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={selectedItem.topPie}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {selectedItem.topPie.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            borderRadius: "8px",
                            borderColor: "#334155",
                          }}
                          itemStyle={{ color: "#f1f5f9" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2 mt-2">
                    {selectedItem.topPie.map((item, i) => (
                      <li
                        key={i}
                        className="flex justify-between text-xs text-gray-300 border-b border-slate-600 pb-1 last:border-0"
                      >
                        <span className="truncate w-32" title={item.name}>
                          {i + 1}. {item.name}
                        </span>
                        <span className="font-bold">{item.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* COLUMNA DERECHA */}
              <div className="md:col-span-2 space-y-6">
                {/* HISTORIAL CON FILTROS */}
                <div className="bg-slate-700/30 p-5 rounded-xl border border-slate-600">
                  {/* Encabezado + Filtros */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <h3 className="text-gray-200 font-bold flex items-center gap-2 text-sm uppercase">
                      <FaHistory className="text-green-400" /> Historial
                      <span className="text-gray-500 text-xs normal-case font-normal">
                        ({filteredHistory.length} pedidos)
                      </span>
                    </h3>

                    {/* BOTONERA FILTRO */}
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600">
                      <button
                        onClick={() => {
                          setHistorialFilter("TODOS");
                          setModalPage(1);
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                          historialFilter === "TODOS"
                            ? "bg-blue-600 text-white"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        onClick={() => {
                          setHistorialFilter("SIN_ML");
                          setModalPage(1);
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                          historialFilter === "SIN_ML"
                            ? "bg-blue-600 text-white"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        Sin ML
                      </button>
                      <button
                        onClick={() => {
                          setHistorialFilter("SOLO_ML");
                          setModalPage(1);
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                          historialFilter === "SOLO_ML"
                            ? "bg-yellow-600 text-white"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        Solo ML
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto min-h-[200px]">
                    <table className="w-full text-sm text-left text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-slate-700/50">
                        <tr>
                          <th className="px-3 py-2">Fecha</th>
                          <th className="px-3 py-2">
                            {selectedItem.type === "PRODUCTOS"
                              ? "Cliente"
                              : "Producto"}
                          </th>
                          <th className="px-3 py-2 text-center">Cant.</th>
                          <th className="px-3 py-2">OC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalPaginationData.map((order, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                          >
                            <td className="px-3 py-2 font-mono text-xs flex items-center gap-2">
                              {order.fecha}
                              {/* TAG MELI */}
                              {order.isML && (
                                <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 rounded">
                                  MELI
                                </span>
                              )}
                            </td>
                            <td
                              className="px-3 py-2 font-medium text-white truncate max-w-[150px]"
                              title={order.columnaVariable}
                            >
                              {order.columnaVariable}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {order.cantidad}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-400">
                              {order.oc}
                            </td>
                          </tr>
                        ))}
                        {modalPaginationData.length === 0 && (
                          <tr>
                            <td
                              colSpan="4"
                              className="text-center py-4 italic text-gray-500"
                            >
                              No hay registros con este filtro
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Controles Paginación */}
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() =>
                        setModalPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={modalPage === 1}
                      className="px-3 py-1 bg-slate-600 text-xs rounded hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Anterior
                    </button>
                    <span className="text-xs text-gray-500">
                      Página {modalPage} de {totalModalPages || 1}
                    </span>
                    <button
                      onClick={() =>
                        setModalPage((prev) =>
                          Math.min(prev + 1, totalModalPages)
                        )
                      }
                      disabled={
                        modalPage === totalModalPages || totalModalPages === 0
                      }
                      className="px-3 py-1 bg-slate-600 text-xs rounded hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/30 p-4 rounded-lg text-center border border-slate-700">
                  <p className="text-sm text-gray-400">
                    Último movimiento registrado:{" "}
                    <span className="text-white font-bold">
                      {selectedItem.lastDate}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// 4. INGENIERÍA DE PRODUCTOS (V3: Búsqueda Obligatoria en Productos)
// ==============================================================================

// 1. ÍTEM ARRASTRABLE (Semielaborado)
function DraggableItem({ item, isOverlay }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `source-${item.id}`,
      data: item,
      disabled: isOverlay,
    });

  // Interpolación manual para evitar error de librería
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0 : 1,
      }
    : undefined;

  const baseClasses =
    "p-3 mb-2 rounded border flex justify-between items-center touch-none transition-colors select-none";
  const overlayClasses =
    "bg-slate-600 border-blue-400 shadow-2xl scale-105 cursor-grabbing z-[9999]";
  const normalClasses =
    "bg-slate-700 border-slate-600 hover:bg-slate-600 cursor-grab hover:border-blue-400/50";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${baseClasses} ${isOverlay ? overlayClasses : normalClasses}`}
    >
      <div className="flex flex-col">
        <p className="font-bold text-sm text-white font-mono">{item.codigo}</p>
        <p className="text-xs text-gray-300 truncate w-40">{item.nombre}</p>
      </div>
      <span
        className={`text-xs px-2 py-1 rounded font-bold ${
          item.stock_actual > 0
            ? "bg-blue-900/50 text-blue-200"
            : "bg-red-900/50 text-red-200"
        }`}
      >
        {item.stock_actual}
      </span>
    </div>
  );
}

// 2. ÁREA DE RECETA (Donde soltamos)
function DroppableArea({ items, onRemove }) {
  const { setNodeRef, isOver } = useDroppable({ id: "receta-droppable" });

  return (
    <div
      ref={setNodeRef}
      className={`flex-grow border-2 border-dashed rounded-xl p-4 transition-all duration-200 overflow-y-auto min-h-[300px] ${
        isOver
          ? "border-green-500 bg-green-900/10"
          : "border-slate-600 bg-slate-800/30"
      }`}
    >
      {items.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 select-none">
          <FaCubes
            className={`text-5xl mb-4 transition-transform ${
              isOver ? "scale-110 text-green-500" : "opacity-20"
            }`}
          />
          <p className="font-medium">Arrastra semielaborados aquí</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((ing, idx) => (
            <li
              key={idx}
              className="bg-slate-700 p-3 rounded-lg flex justify-between items-center group border border-slate-600 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 h-8 w-8 flex items-center justify-center rounded font-bold text-green-400 border border-slate-600 text-sm">
                  {ing.cantidad}x
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-medium text-sm">
                    {ing.nombre}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {ing.codigo}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onRemove(idx)}
                className="text-gray-500 hover:text-red-400 p-2 transition-colors"
              >
                <FaTrash />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 3. COMPONENTE PRINCIPAL DE INGENIERÍA
function IngenieriaProductos() {
  const [productos, setProductos] = useState([]);
  const [semielaborados, setSemielaborados] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [ultimaModificacion, setUltimaModificacion] = useState(null);
  const [receta, setReceta] = useState([]);

  const [filtroSemi, setFiltroSemi] = useState("");
  const [filtroProd, setFiltroProd] = useState("");

  const [loading, setLoading] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);

  useEffect(() => {
    fetch(`${PEDIDOS_API_URL}?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const s = new Set();
        data.forEach((r) => {
          if (r.MODELO || r.Modelo) s.add(r.MODELO || r.Modelo);
        });
        setProductos(Array.from(s).sort());
      });
    fetch(`${API_BASE_URL}/ingenieria/semielaborados`)
      .then((r) => r.json())
      .then(setSemielaborados);
  }, []);

  const cargarReceta = async (prod) => {
    setSeleccionado(prod);
    setReceta([]);
    setUltimaModificacion(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/ingenieria/recetas/${encodeURIComponent(prod)}`
      );
      if (res.ok) {
        const data = await res.json();
        setReceta(data.map((d) => ({ ...d, id: d.semielaborado_id })));

        // --- CAMBIO AQUÍ ---
        // Ya viene formateada desde el servidor, la usamos directo
        if (data.length > 0 && data[0].fecha_receta) {
          setUltimaModificacion(data[0].fecha_receta);
        }
        // -------------------
      }
    } catch (e) {
      console.error(e);
    }
  };

  const guardar = async () => {
    if (!seleccionado) return;
    await fetch(`${API_BASE_URL}/ingenieria/recetas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        producto_terminado: seleccionado,
        items: receta.map((r) => ({ id: r.id, cantidad: 1 })),
      }),
    });
    setUltimaModificacion(new Date().toLocaleString("es-AR"));
    alert("Receta guardada exitosamente");
  };

  const syncStock = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/ingenieria/sincronizar-stock`, {
        method: "POST",
      });
      if (!r.ok) throw new Error("Error del servidor");

      const res = await fetch(`${API_BASE_URL}/ingenieria/semielaborados`);
      setSemielaborados(await res.json());
      alert("Stock sincronizado correctamente");
    } catch (e) {
      alert("Error al sincronizar stock");
    }
    setLoading(false);
  };

  const handleDragStart = (e) => setActiveDragId(e.active.id);

  const handleDragEnd = (e) => {
    setActiveDragId(null);
    if (e.over && e.over.id === "receta-droppable") {
      const itemId = e.active.id.replace("source-", "");
      // eslint-disable-next-line eqeqeq
      const itemData = semielaborados.find((s) => s.id == itemId);
      if (itemData)
        setReceta((prev) => [...prev, { ...itemData, cantidad: 1 }]);
    }
  };

  // --- LÓGICA DE FILTRADO ACTUALIZADA ---
  // Ahora AMBAS listas requieren que escribas para mostrar resultados

  const productosFiltrados =
    filtroProd.length > 0
      ? productos.filter((p) =>
          p.toLowerCase().includes(filtroProd.toLowerCase())
        )
      : [];

  const semielaboradosVisibles =
    filtroSemi.length > 0
      ? semielaborados.filter(
          (s) =>
            s.nombre.toLowerCase().includes(filtroSemi.toLowerCase()) ||
            s.codigo.toLowerCase().includes(filtroSemi.toLowerCase())
        )
      : [];

  // eslint-disable-next-line eqeqeq
  const activeItemData = activeDragId
    ? semielaborados.find((s) => `source-${s.id}` === activeDragId)
    : null;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
        {/* COLUMNA 1: PRODUCTOS TERMINADOS (Ahora oculta hasta buscar) */}
        <div className="col-span-3 bg-slate-800 rounded-xl flex flex-col border border-slate-700 overflow-hidden shadow-lg">
          <div className="p-4 bg-slate-800 border-b border-slate-700 z-10">
            <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2 text-sm uppercase">
              <FaBoxOpen /> Productos ({productos.length})
            </h3>
            <input
              type="text"
              placeholder="Buscar producto..."
              value={filtroProd}
              onChange={(e) => setFiltroProd(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex-grow overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filtroProd.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-gray-500 text-xs italic">
                Escribe para buscar...
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div className="text-center text-gray-500 text-xs mt-4">
                No hay coincidencias
              </div>
            ) : (
              productosFiltrados.map((prod, i) => (
                <div
                  key={i}
                  onClick={() => cargarReceta(prod)}
                  className={`px-3 py-2 rounded-lg cursor-pointer text-sm truncate transition-all ${
                    seleccionado === prod
                      ? "bg-blue-600 text-white font-bold shadow"
                      : "text-gray-400 hover:bg-slate-700 hover:text-gray-200"
                  }`}
                >
                  {prod}
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMNA 2: MESA DE TRABAJO */}
        <div className="col-span-5 flex flex-col bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden shadow-lg relative">
          <div className="p-5 bg-slate-800 border-b border-slate-700 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FaTools className="text-gray-500" />{" "}
                {seleccionado || "Selecciona un producto"}
              </h2>
              {seleccionado && (
                <p className="text-xs text-gray-400 mt-1">
                  Última mod:{" "}
                  <span className="text-yellow-400">
                    {ultimaModificacion || "Nunca"}
                  </span>
                </p>
              )}
            </div>
            {seleccionado && (
              <button
                onClick={guardar}
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 text-sm transition-transform active:scale-95"
              >
                <FaSave /> Guardar
              </button>
            )}
          </div>
          <div className="flex-grow p-4 flex flex-col overflow-hidden">
            {seleccionado ? (
              <>
                <DroppableArea
                  items={receta}
                  onRemove={(idx) =>
                    setReceta((prev) => prev.filter((_, i) => i !== idx))
                  }
                />
                <div className="mt-2 text-center">
                  <span className="text-xs text-gray-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    {receta.length} componentes
                  </span>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm italic">
                ← Selecciona un producto de la izquierda
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA 3: ALMACÉN SEMIELABORADOS */}
        <div className="col-span-4 bg-slate-800 rounded-xl flex flex-col border border-slate-700 overflow-hidden shadow-lg">
          <div className="p-4 bg-slate-800 border-b border-slate-700 z-10">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-purple-400 font-bold flex items-center gap-2 text-sm uppercase">
                <FaCubes /> Semielaborados
              </h3>
              <button
                onClick={syncStock}
                disabled={loading}
                className="text-[10px] uppercase font-bold tracking-wider bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded border border-slate-600 transition-colors flex items-center gap-1"
              >
                {loading ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <>
                    <FaDatabase /> Sync
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              placeholder="Buscar componente..."
              value={filtroSemi}
              onChange={(e) => setFiltroSemi(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              autoFocus
            />
          </div>
          <div className="flex-grow overflow-y-auto p-2 bg-slate-800/50 custom-scrollbar">
            {filtroSemi.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-gray-500 text-xs italic">
                Escribe para buscar...
              </div>
            ) : semielaboradosVisibles.length === 0 ? (
              <div className="text-center text-gray-500 text-xs mt-4">
                No hay coincidencias
              </div>
            ) : (
              semielaboradosVisibles.map((s) => (
                <DraggableItem key={s.id} item={s} isOverlay={false} />
              ))
            )}
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeItemData ? (
          <DraggableItem item={activeItemData} isOverlay={true} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ==============================================================================
// 6. COMPONENTE PRINCIPAL APP (ROUTER & AUTH)
// ==============================================================================

function LoginPage({
  onLoginSuccess,
  expectedPassword,
  title = "Acceso Restringido",
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === expectedPassword) {
      setError("");
      onLoginSuccess();
    } else {
      setError("Contraseña incorrecta. Intente de nuevo.");
      setInput("");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center pt-10">
      <div className="bg-slate-800 rounded-xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-white mb-2 text-center flex justify-center gap-2 items-center">
          <FaLock className="text-blue-500" /> {title}
        </h2>
        <p className="text-gray-400 text-center text-sm mb-6">
          Ingrese su clave de seguridad
        </p>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-6">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
              <FaKey />
            </span>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full p-3 pl-10 bg-slate-900 text-white rounded-lg border border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="********"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-red-400 text-center text-xs mb-4 bg-red-900/20 p-2 rounded border border-red-900">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-transform active:scale-95"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState(window.location.pathname);

  // --- DOBLE ESTADO DE AUTENTICACIÓN ---
  const [isAuthPanel, setIsAuthPanel] = useState(
    sessionStorage.getItem("auth_panel") === "true"
  );
  const [isAuthGerencia, setIsAuthGerencia] = useState(
    sessionStorage.getItem("auth_gerencia") === "true"
  );

  useEffect(() => {
    const onLocationChange = () => setPage(window.location.pathname);
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setPage(path);
  };

  // Login Handlers Específicos
  const loginPanel = () => {
    sessionStorage.setItem("auth_panel", "true");
    setIsAuthPanel(true);
  };
  const loginGerencia = () => {
    sessionStorage.setItem("auth_gerencia", "true");
    setIsAuthGerencia(true);
  };

  // Logout Global (Limpia todo)
  const handleLogout = () => {
    sessionStorage.removeItem("auth_panel");
    sessionStorage.removeItem("auth_gerencia");
    setIsAuthPanel(false);
    setIsAuthGerencia(false);
    navigate("/");
  };

  let component;
  if (page === "/panel-control") {
    component = isAuthPanel ? (
      <PanelControl onNavigate={navigate} />
    ) : (
      <LoginPage
        onLoginSuccess={loginPanel}
        expectedPassword={PASS_PANEL}
        title="Acceso Horno"
      />
    );
  } else if (page === "/analisis-pedidos") {
    component = isAuthGerencia ? (
      <AnalisisPedidos />
    ) : (
      <LoginPage
        onLoginSuccess={loginGerencia}
        expectedPassword={PASS_GERENCIA}
        title="Acceso Datos"
      />
    );
  } else if (page === "/ingenieria") {
    component = isAuthGerencia ? (
      <IngenieriaProductos />
    ) : (
      <LoginPage
        onLoginSuccess={loginGerencia}
        expectedPassword={PASS_GERENCIA}
        title="Acceso Datos"
      />
    );
  } else {
    component = <Dashboard onNavigate={navigate} />;
  }

  const btnClass = (path) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
      page === path
        ? "bg-slate-600 text-white scale-105 shadow-lg ring-1 ring-slate-500"
        : "text-gray-400 hover:text-white hover:bg-slate-800"
    }`;
  const isLoggedAny = isAuthPanel || isAuthGerencia;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8 font-sans selection:bg-blue-500 selection:text-white">
      <div className="max-w-7xl mx-auto">
        <nav className="flex flex-wrap justify-center items-center gap-3 mb-8 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md sticky top-4 z-50">
          <button onClick={() => navigate("/")} className={btnClass("/")}>
            <FaHome /> Hornos
          </button>
          <button
            onClick={() => navigate("/analisis-pedidos")}
            className={btnClass("/analisis-pedidos")}
          >
            <FaChartLine /> Análisis
          </button>
          <button
            onClick={() => navigate("/ingenieria")}
            className={btnClass("/ingenieria")}
          >
            <FaCogs /> Ingeniería
          </button>
          {isLoggedAny && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-red-400 hover:text-red-200 hover:bg-red-900/20 transition-all border border-red-900/30 ml-auto"
            >
              <FaSignOutAlt /> Salir
            </button>
          )}
        </nav>
        {component}
      </div>
    </div>
  );
}
