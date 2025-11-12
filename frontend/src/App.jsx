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
const ADMIN_PASSWORD = "admin123"; // Contraseña del panel

// --- FUNCIÓN AUXILIAR 1: Formatear Duración ---
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

// --- FUNCIÓN AUXILIAR 2: Obtener Estado de Estación ---
function getStationStatus(stationId, allRecords) {
  const lastEvent = allRecords.find(
    (reg) =>
      reg.accion.includes(`Estacion ${stationId}`) && reg.tipo !== "PRODUCCION"
  );

  let status = "INACTIVA";
  let lastEventTimestamp = null;

  if (lastEvent) {
    lastEventTimestamp = lastEvent.timestamp;
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
        if (i === 0) {
          cycleDuration = formatDuration(diffMs);
        }
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
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const todayStr = today.toISOString().substring(0, 10);
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

  if (status === "ENFRIANDO") {
    try {
      const enfriandoStartTime = new Date(lastEventTimestamp);
      const now = new Date();
      const diffMs = now.getTime() - enfriandoStartTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
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

// --- Componente de la Tarjeta de Estación ---
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
    const updateDuration = () => {
      const now = new Date();
      const diffMs = now.getTime() - data.liveCycleStartTime.getTime();
      setLiveDuration(formatDuration(diffMs));
    };
    updateDuration();
    const timerId = setInterval(updateDuration, 1000);
    return () => clearInterval(timerId);
  }, [data.liveCycleStartTime]);

  const formatFullTimestamp = (timestampString) => {
    if (!timestampString) return { fecha: "N/A", hora: "N/A" };
    const date = new Date(timestampString);
    const options = { timeZone: "America/Argentina/Buenos_Aires" };
    return {
      fecha: date.toLocaleDateString("es-AR", options),
      hora: date.toLocaleTimeString("es-AR", {
        ...options,
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
          <FaHourglassHalf className="text-2xl text-green-300 mx-auto mb-1" />
          <div className="text-xs text-green-300 uppercase">En Vivo</div>
          <div className="text-2xl font-bold font-mono">{liveDuration}</div>
        </div>
        <div className="bg-blue-900/80 p-3 rounded-lg shadow-inner">
          <FaChartPie className="text-2xl text-blue-300 mx-auto mb-1" />
          <div className="text-xs text-blue-300 uppercase">Ciclos Hoy</div>
          <div className="text-2xl font-bold font-mono">{data.cyclesToday}</div>
        </div>
        <div className="bg-black/20 p-3 rounded-lg shadow-inner">
          <FaHistory className="text-2xl text-gray-300 mx-auto mb-1" />
          <div className="text-xs text-gray-300 uppercase">Ciclo Ant.</div>
          <div className="text-2xl font-bold font-mono">
            {data.cycleDuration}
          </div>
        </div>
        <div className="bg-purple-900/80 p-3 rounded-lg shadow-inner">
          <FaTachometerAlt className="text-2xl text-purple-300 mx-auto mb-1" />
          <div className="text-xs text-purple-300 uppercase">
            Prom. (Últ. 10)
          </div>
          <div className="text-2xl font-bold font-mono">
            {data.averageCycleTime}
          </div>
        </div>
      </div>

      {data.status !== "INACTIVA" && (
        <div className="mb-4">
          <h3 className="font-semibold text-lg mb-2 text-gray-200">
            Producción Actual:
          </h3>
          <div className="bg-black/20 p-3 rounded-lg max-h-32 overflow-y-auto">
            {data.productos && data.productos.length > 0 ? (
              <ul className="list-disc list-inside text-gray-200 space-y-1">
                {data.productos.map((prod, index) => (
                  <li key={index}>{prod}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 italic text-sm text-center">
                No hay productos cargados.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="text-sm text-gray-200 bg-black/20 p-4 rounded-lg">
        <h3 className="font-semibold text-lg mb-2">Último Evento:</h3>
        {data.lastEvent ? (
          <>
            <p>
              <strong>Acción:</strong> {data.lastEvent.accion}
            </p>
            <p>
              <strong>Fecha:</strong> {lastEventFecha}
            </p>
            <p>
              <strong>Hora:</strong> {lastEventHora}
            </p>
          </>
        ) : (
          <p>No hay eventos registrados.</p>
        )}
      </div>
    </div>
  );
}

// --- Componente del Menú de Alarmas ---
function AlarmMenu({ alarms }) {
  const [isOpen, setIsOpen] = useState(false);
  if (alarms.length === 0) return null;
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const options = { timeZone: "America/Argentina/Buenos_Aires" };
    return date.toLocaleTimeString("es-AR", {
      ...options,
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const dropdownVariants = {
    closed: {
      opacity: 0,
      scaleY: 0,
      transition: { duration: 0.2, ease: "easeOut" },
    },
    open: {
      opacity: 1,
      scaleY: 1,
      transition: { duration: 0.3, ease: "easeIn" },
    },
  };
  return (
    <div className="relative mb-8 w-full md:w-1/2 mx-auto z-10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-red-700 text-white p-3 rounded-lg shadow-lg flex items-center justify-center font-bold text-lg hover:bg-red-600 transition-colors"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <FaExclamationTriangle className="mr-3" />
        </motion.div>
        {alarms.length} Alarma(s) en las últimas {ALARMA_WINDOW_HOURS}hs
      </button>
      <motion.div
        initial="closed"
        animate={isOpen ? "open" : "closed"}
        variants={dropdownVariants}
        className="absolute w-full bg-slate-700 rounded-b-lg shadow-xl overflow-hidden transform-origin-top"
      >
        <div className="p-4 max-h-60 overflow-y-auto">
          {alarms.map((alarm) => (
            <div
              key={alarm.id}
              className="flex items-start p-2 border-b border-slate-600 last:border-b-0"
            >
              <FaExclamationTriangle className="text-yellow-300 mr-3 mt-1" />
              <div>
                <span className="font-semibold text-gray-200">
                  ({formatTime(alarm.timestamp)})
                </span>
                <p className="text-gray-300">{alarm.accion}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// --- Componente: Dashboard ---
function Dashboard() {
  const [registros, setRegistros] = useState([]);
  const [produccion, setProduccion] = useState({ 1: [], 2: [] });
  const [cargando, setCargando] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchDatos = () => {
      Promise.all([
        fetch(REGISTROS_API_URL).then((res) => {
          if (!res.ok) throw new Error(`Error HTTP ${res.status} en registros`);
          return res.json();
        }),
        fetch(PRODUCCION_API_URL).then((res) => {
          if (!res.ok)
            throw new Error(`Error HTTP ${res.status} en produccion`);
          return res.json();
        }),
      ])
        .then(([dataRegistros, dataProduccion]) => {
          setRegistros(dataRegistros);
          setProduccion(dataProduccion);
          setCargando(false);
        })
        .catch((err) => {
          console.error("Error al cargar datos:", err);
          setCargando(false);
        });
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
    const processStationCycles = (stationId, stationName) => {
      const starts = registros.filter(
        (reg) =>
          reg.tipo === "EVENTO" &&
          reg.accion.includes(`Se inicio ciclo Estacion ${stationId}`)
      );
      for (let i = 0; i < starts.length - 1; i++) {
        const currentEvent = starts[i];
        const previousEvent = starts[i + 1];
        try {
          const date1 = new Date(currentEvent.timestamp);
          const date2 = new Date(previousEvent.timestamp);
          const diffMs = date1.getTime() - date2.getTime();
          const durationMinutes = diffMs / (1000 * 60);
          if (durationMinutes > 0 && durationMinutes <= maxMinutes) {
            combinedData.push({
              timestamp: currentEvent.timestamp,
              [stationName]: durationMinutes,
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
    processStationCycles(1, "Estación 1");
    processStationCycles(2, "Estación 2");
    return combinedData
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-30);
  }, [registros]);

  const recentAlarms = useMemo(() => {
    const now = new Date();
    const windowMs = ALARMA_WINDOW_HOURS * 60 * 60 * 1000;
    const pastLimit = now.getTime() - windowMs;
    return registros.filter(
      (reg) =>
        reg.tipo === "ALARMA" && new Date(reg.timestamp).getTime() > pastLimit
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
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const historialPaginado = registros.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const handleNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  const formatXAxis = (timestamp) => {
    const date = new Date(timestamp);
    const options = { timeZone: "America/Argentina/Buenos_Aires" };
    return date.toLocaleDateString("es-AR", {
      ...options,
      day: "2-digit",
      month: "2-digit",
    });
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-2xl">
        <FaSpinner className="animate-spin mr-4" />
        Cargando datos del horno...
      </div>
    );
  }

  return (
    <>
      <h1 className="text-4xl md:text-5xl font-bold text-center mb-10">
        Monitor en Vivo - Horno de Rotomoldeo
      </h1>
      <AlarmMenu alarms={recentAlarms} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-12">
        <StationCard title="Estación 1 (Izquierda)" data={statusEstacion1} />
        <StationCard title="Estación 2 (Derecha)" data={statusEstacion2} />
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        Evolución de Tiempos de Ciclo (Últimos 30)
      </h2>
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 h-[400px] mb-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={cycleChartData}
            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis
              dataKey="timestamp"
              stroke="#94a3b8"
              tickFormatter={formatXAxis}
              padding={{ left: 20, right: 20 }}
            />
            <YAxis
              stroke="#94a3b8"
              allowDecimals={false}
              label={{
                value: "Duración (Minutos)",
                angle: -90,
                position: "insideLeft",
                fill: "#94a3b8",
                dy: 40,
              }}
              domain={[25, "dataMax + 10"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(30, 41, 59, 0.9)",
                borderColor: "#334155",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(value) => [`${value.toFixed(0)} minutos`, null]}
              labelFormatter={(label) =>
                new Date(label).toLocaleString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                  dateStyle: "short",
                  timeStyle: "short",
                })
              }
            />
            <Legend wrapperStyle={{ color: "#cbd5e1" }} />
            <Line
              type="monotone"
              dataKey="Estación 1"
              stroke="#c0392b"
              strokeWidth={2}
              connectNulls
              dot={{ r: 4 }}
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey="Estación 2"
              stroke="#2980b9"
              strokeWidth={2}
              connectNulls
              dot={{ r: 4 }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
              <th className="px-4 py-3 text-center">
                Tiempo de Ciclo (HH:MM:SS)
              </th>
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

              const isAlarma = reg.tipo === "ALARMA";
              const isProduccion = reg.tipo === "PRODUCCION";
              const tipoClass = isAlarma
                ? "bg-red-600/90 text-red-100"
                : isProduccion
                ? "bg-green-600/90 text-green-100"
                : "bg-blue-600/90 text-blue-100";

              let productosParseados = [];
              if (isProduccion) {
                try {
                  productosParseados = JSON.parse(reg.productos_json || "[]");
                } catch (e) {
                  console.error("Error parseando productos_json:", e);
                }
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
                    {isProduccion ? (
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
                            Sin productos cargados
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
          className="px-5 py-2 bg-slate-600 text-white rounded-md shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-500 transition-colors"
        >
          Anterior
        </button>
        <span className="font-semibold">
          Página {currentPage} de {totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          className="px-5 py-2 bg-slate-600 text-white rounded-md shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-500 transition-colors"
        >
          Siguiente
        </button>
      </div>
    </>
  );
}

// --- Componente: PanelControl (¡MEJORADO CON AUTOCOMPLETADO!) ---
function PanelControl() {
  const [produccion, setProduccion] = useState({ 1: [], 2: [] });
  const [input1, setInput1] = useState("");
  const [input2, setInput2] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- NUEVO: Estado para sugerencias de productos ---
  const [sugerencias, setSugerencias] = useState([]);

  // Cargar producción actual
  const fetchProduccion = async () => {
    try {
      setLoading(true);
      const res = await fetch(PRODUCCION_API_URL);
      if (!res.ok) throw new Error("Error al cargar productos");
      const data = await res.json();
      setProduccion(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- NUEVO: Cargar lista de modelos desde el Excel de pedidos ---
  useEffect(() => {
    fetchProduccion();

    // Fetch silencioso para llenar el autocompletado
    fetch(PEDIDOS_API_URL)
      .then((res) => res.json())
      .then((data) => {
        const modelosSet = new Set();
        data.forEach((row) => {
          // Extraemos todos los modelos únicos
          const m = row.MODELO || row.Modelo || row.modelo;
          if (m && typeof m === "string" && m.trim() !== "") {
            modelosSet.add(m.trim());
          }
        });
        // Ordenamos alfabéticamente
        setSugerencias(Array.from(modelosSet).sort());
      })
      .catch((err) =>
        console.warn("No se pudieron cargar sugerencias de productos:", err)
      );
  }, []);

  const handleAdd = async (estacion_id, producto) => {
    if (!producto) return;
    try {
      const res = await fetch(PRODUCCION_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estacion_id, producto }),
      });
      if (!res.ok) throw new Error("Error del servidor al añadir");
      if (estacion_id === 1) setInput1("");
      if (estacion_id === 2) setInput2("");
      fetchProduccion();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al añadir producto");
    }
  };

  const handleClear = async (estacion_id) => {
    if (
      !window.confirm(
        `¿Estás seguro de que quieres borrar TODOS los productos de la Estación ${estacion_id}?`
      )
    )
      return;
    try {
      const res = await fetch(`${PRODUCCION_API_URL}/${estacion_id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error del servidor al borrar");
      fetchProduccion();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al borrar productos");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-2xl">
        <FaSpinner className="animate-spin mr-4" />
        Cargando productos...
      </div>
    );
  }

  return (
    <>
      <h1 className="text-4xl md:text-5xl font-bold text-center mb-10">
        Panel de Producción
      </h1>
      {error && (
        <div className="bg-red-800 border border-red-600 text-white p-4 rounded-lg text-center mb-6">
          <FaExclamationTriangle className="inline mr-2" /> {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <EstacionControlPanel
          title="Estación 1 (Izquierda)"
          estacionId={1}
          productos={produccion[1] || []}
          inputValue={input1}
          onInputChange={setInput1}
          onAdd={handleAdd}
          onClear={handleClear}
          color="red"
          sugerencias={sugerencias} // Pasamos las sugerencias
        />
        <EstacionControlPanel
          title="Estación 2 (Derecha)"
          estacionId={2}
          productos={produccion[2] || []}
          inputValue={input2}
          onInputChange={setInput2}
          onAdd={handleAdd}
          onClear={handleClear}
          color="blue"
          sugerencias={sugerencias} // Pasamos las sugerencias
        />
      </div>
    </>
  );
}

// --- Sub-componente del Panel de Control (¡AHORA CON DATALIST!) ---
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
  const colorClasses = {
    red: {
      bg: "bg-red-900/50",
      border: "border-red-700",
      button: "bg-red-600 hover:bg-red-500",
      list: "border-red-800",
    },
    blue: {
      bg: "bg-blue-900/50",
      border: "border-blue-700",
      button: "bg-blue-600 hover:bg-blue-500",
      list: "border-blue-800",
    },
  };
  const styles = colorClasses[color];
  const listId = `list-sugerencias-${estacionId}`; // ID único para el datalist

  return (
    <div
      className={`rounded-xl shadow-2xl p-6 ${styles.bg} border-2 ${styles.border}`}
    >
      <h2 className="text-3xl font-bold text-white mb-6">{title}</h2>
      <div className="flex gap-2 mb-4 relative">
        {/* INPUT CON AUTOCOMPLETADO */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Nombre del producto"
          className="p-3 bg-gray-800 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-opacity-50"
          list={listId} // Conectamos con el datalist
        />

        {/* LISTA DE SUGERENCIAS OCULTA */}
        <datalist id={listId}>
          {sugerencias &&
            sugerencias.map((item, index) => (
              <option key={index} value={item} />
            ))}
        </datalist>

        <button
          onClick={() => onAdd(estacionId, inputValue)}
          className={`px-5 py-3 rounded-lg text-white font-semibold transition-colors ${styles.button} disabled:opacity-50`}
          disabled={!inputValue}
        >
          <FaPlus />
        </button>
      </div>
      <h3 className="text-xl font-semibold text-gray-300 mb-3 mt-8">
        Productos en Horno ({productos.length})
      </h3>
      <div
        className={`bg-gray-900/70 rounded-lg p-4 h-64 overflow-y-auto border ${styles.list}`}
      >
        {productos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FaBoxOpen className="text-4xl mb-2" />
            <span>No hay productos cargados</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {productos.map((prod, index) => (
              <li
                key={index}
                className="text-white bg-gray-800 p-3 rounded shadow-md text-lg"
              >
                {prod}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={() => onClear(estacionId)}
        disabled={productos.length === 0}
        className="w-full mt-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FaTrash /> Limpiar Lista de Estación
      </button>
    </div>
  );
}

// --- Componente: Login ---
function LoginPage({ onLoginSuccess }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) {
      setError("");
      onLoginSuccess();
    } else {
      setError("Contraseña incorrecta. Intente de nuevo.");
      setInput("");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center pt-10">
      <div className="w-full max-w-md bg-slate-800 rounded-xl shadow-2xl p-8">
        <h2 className="text-3xl font-bold text-white text-center mb-6">
          Acceso Restringido
        </h2>
        <p className="text-center text-gray-400 mb-6">
          Por favor, ingrese la contraseña para acceder al Panel de Control.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="password"
              class="block text-sm font-bold text-gray-300 mb-2"
            >
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <FaKey className="text-gray-500" />
              </span>
              <input
                type="password"
                id="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full p-3 pl-10 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>
          {error && (
            <p className="text-red-400 text-center text-sm mb-4">{error}</p>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

// --- COMPONENTE DE ANÁLISIS DE PEDIDOS (Versión Final: Productos + Clientes) ---
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
  const MODAL_ITEMS_PER_PAGE = 5;

  useEffect(() => {
    fetch(PEDIDOS_API_URL)
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

    // 1. Filtrar por año 2025
    const filteredData = datos.filter((row) => {
      const dateVal = row.FECHA || row.Fecha || row.fecha;
      if (!dateVal) return false;
      const rowDate = new Date(dateVal);
      return !isNaN(rowDate) && rowDate.getFullYear() >= 2025;
    });

    if (filteredData.length === 0) return null;

    // Estructuras de datos
    const uniqueOrders = new Set();
    const uniqueMLOrders = new Set();

    // Mapas Productos
    const productMapYear = {};
    const productMapMonth = {};
    const productMapWeek = {};

    // Mapas Clientes
    const clientMapYear = {};
    const clientMapMonth = {};
    const clientMapWeek = {};
    const activeClients = new Set(); // Clientes únicos

    // Listas para el buscador
    const allModelsSet = new Set();
    const allClientsSet = new Set();

    // Mapa Global Mensual
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
        activeClients.add(clientName);
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
        if (detalles.toString().toLowerCase().includes("mercadolibre")) {
          uniqueMLOrders.add(oc);
        }
      }

      // --- MENSUAL GLOBAL ---
      const monthIndex = rowDate.getMonth();
      const monthName = monthNames[monthIndex];
      if (monthMap[monthName] !== undefined) {
        monthMap[monthName] += cantidad;
      }
    });

    // Helpers de ordenamiento
    const getTop3 = (map) =>
      Object.entries(map)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

    const getTop10 = (map) =>
      Object.entries(map)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    // Data procesada para retornar
    const salesByMonth = monthNames.slice(0, currentMonth + 1).map((name) => ({
      mes: name,
      ventas: monthMap[name],
    }));
    const recordMonth = [...salesByMonth].sort(
      (a, b) => b.ventas - a.ventas
    )[0];

    return {
      // Globales
      salesByMonth,
      totalOrders: uniqueOrders.size,
      mlOrders: uniqueMLOrders.size,
      recordMonthName: recordMonth?.mes || "-",
      filteredRawData: filteredData,

      // Datos Productos
      topProductsYear: getTop10(productMapYear),
      top3ProdMonth: getTop3(productMapMonth),
      top3ProdWeek: getTop3(productMapWeek),
      allModels: Array.from(allModelsSet).sort(),

      // Datos Clientes
      topClientsYear: getTop10(clientMapYear),
      totalActiveClients: activeClients.size,
      top3ClientMonth: getTop3(clientMapMonth),
      top3ClientWeek: getTop3(clientMapWeek),
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

    const rawData = analysisData.filteredRawData;

    // Filtramos las filas correspondientes al item seleccionado
    const rows =
      modoVista === "PRODUCTOS"
        ? rawData.filter((r) => (r.MODELO || r.Modelo) === nombre)
        : rawData.filter((r) => (r.CLIENTE || r.Cliente) === nombre);

    if (rows.length === 0) return;

    // Estadísticas del Modal
    let totalUnits = 0;
    const pieMap = {}; // Mapa para la torta (Relación Cliente-Producto)

    rows.forEach((row) => {
      const cant = Number(row.CANTIDAD || row.Cantidad || 1);
      totalUnits += cant;

      // Si veo un cliente, quiero saber qué productos compra.
      // Si veo un producto, quiero saber qué clientes lo compran.
      const key =
        modoVista === "CLIENTES"
          ? row.MODELO || row.Modelo || "Desconocido"
          : row.CLIENTE || row.Cliente || "Desconocido";

      pieMap[key] = (pieMap[key] || 0) + cant;
    });

    // Top 5 para gráfico de torta
    const topPie = Object.entries(pieMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Historial de pedidos (Bitácora)
    const lastOrders = [...rows]
      .sort(
        (a, b) => new Date(b.FECHA || b.Fecha) - new Date(a.FECHA || a.Fecha)
      ) // Más reciente primero
      .slice(0, 100) // Máximo 100 para paginar
      .map((row) => ({
        fecha: new Date(row.FECHA || row.Fecha).toLocaleDateString("es-AR"),
        // La columna variable muestra el dato complementario
        columnaVariable:
          modoVista === "CLIENTES"
            ? row.MODELO || row.Modelo || "-"
            : row.CLIENTE || row.Cliente || "-",
        cantidad: row.CANTIDAD || row.Cantidad || 1,
        oc: row.OC || row.oc || "-",
      }));

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

  // Paginación del Modal en tiempo de render
  let modalPaginationData = [];
  let totalModalPages = 0;
  if (selectedItem) {
    totalModalPages = Math.ceil(
      selectedItem.lastOrders.length / MODAL_ITEMS_PER_PAGE
    );
    const startIndex = (modalPage - 1) * MODAL_ITEMS_PER_PAGE;
    modalPaginationData = selectedItem.lastOrders.slice(
      startIndex,
      startIndex + MODAL_ITEMS_PER_PAGE
    );
  }

  // Colores para gráfico de torta
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

  // Configuración dinámica de las tarjetas según el modo
  const cardTotalTitle = isClientMode ? "Clientes Activos" : "Total Pedidos";
  const cardTotalValue = isClientMode
    ? analysisData.totalActiveClients
    : analysisData.totalOrders;
  const cardTotalSub = isClientMode
    ? "Han comprado en 2025"
    : "OCs Únicos (Año)";

  const cardTopList = isClientMode
    ? analysisData.topClientsYear
    : analysisData.topProductsYear;
  const cardTop3Month = isClientMode
    ? analysisData.top3ClientMonth
    : analysisData.top3ProdMonth;
  const cardTop3Week = isClientMode
    ? analysisData.top3ClientWeek
    : analysisData.top3ProdWeek;

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
          {/* SWITCH */}
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

          {/* BUSCADOR */}
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

      {/* TARJETAS DE RESUMEN (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-12">
        {/* Card 1: Total */}
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

        {/* Card 2: MercadoLibre o Top Cliente */}
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

        {/* Card 3: Top Mes */}
        <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-t-4 border-green-500">
          <h3 className="text-gray-400 uppercase text-xs font-bold mb-3 text-center">
            Top 3 Mes Actual
          </h3>
          {cardTop3Month.length > 0 ? (
            <ul className="space-y-2">
              {cardTop3Month.map((p, i) => (
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

        {/* Card 4: Top Semana */}
        <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-t-4 border-teal-400">
          <h3 className="text-gray-400 uppercase text-xs font-bold mb-3 text-center">
            Top 3 Semana
          </h3>
          {cardTop3Week.length > 0 ? (
            <ul className="space-y-2">
              {cardTop3Week.map((p, i) => (
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

        {/* Card 5: Mes Récord */}
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

      {/* GRÁFICOS PRINCIPALES */}
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

                {/* Gráfico de Torta */}
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
                          }}
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
                {/* Bitácora Historial */}
                <div className="bg-slate-700/30 p-5 rounded-xl border border-slate-600">
                  <h3 className="text-gray-200 font-bold mb-4 flex items-center justify-between text-sm uppercase">
                    <div className="flex items-center gap-2">
                      <FaHistory className="text-green-400" /> Historial de
                      Pedidos
                    </div>
                    <span className="text-xs text-gray-500 normal-case">
                      Página {modalPage} de {totalModalPages}
                    </span>
                  </h3>

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
                            <td className="px-3 py-2 font-mono text-xs">
                              {order.fecha}
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
                              No hay registros recientes
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
                    <button
                      onClick={() =>
                        setModalPage((prev) =>
                          Math.min(prev + 1, totalModalPages)
                        )
                      }
                      disabled={modalPage === totalModalPages}
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

// --- Componente Principal App (Router) ---
export default function App() {
  const [page, setPage] = useState(window.location.pathname);
  const [isAuthenticated, setIsAuthenticated] = useState(
    sessionStorage.getItem("isAutenticado") === "true"
  );

  useEffect(() => {
    const onLocationChange = () => {
      setPage(window.location.pathname);
    };
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setPage(path);
  };

  const handleLoginSuccess = () => {
    sessionStorage.setItem("isAutenticado", "true");
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("isAutenticado");
    setIsAuthenticated(false);
    navigate("/");
  };

  // --- Lógica de Navegación Actualizada ---
  let component;
  if (page === "/panel-control") {
    component = isAuthenticated ? (
      <PanelControl />
    ) : (
      <LoginPage onLoginSuccess={handleLoginSuccess} />
    );
  } else if (page === "/analisis-pedidos") {
    component = <AnalisisPedidos />;
  } else {
    component = <Dashboard />;
  }

  const activeClass = "bg-slate-600 text-white shadow-lg scale-105";
  const inactiveClass =
    "bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-gray-200";

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8 font-sans selection:bg-blue-500 selection:text-white">
      <div className="max-w-7xl mx-auto">
        {/* --- MENÚ DE NAVEGACIÓN --- */}
        <nav className="flex flex-wrap justify-center items-center gap-4 mb-10 bg-black/20 p-4 rounded-2xl backdrop-blur-sm">
          <button
            onClick={() => navigate("/")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
              page === "/" ? activeClass : inactiveClass
            }`}
          >
            <FaHome className="text-xl" />
            Monitor
          </button>

          {/* ¡NUEVO BOTÓN! */}
          <button
            onClick={() => navigate("/analisis-pedidos")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
              page === "/analisis-pedidos" ? activeClass : inactiveClass
            }`}
          >
            <FaChartLine className="text-xl" />
            Análisis Pedidos
          </button>

          <button
            onClick={() => navigate("/panel-control")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
              page === "/panel-control" ? activeClass : inactiveClass
            }`}
          >
            <FaTools className="text-xl" />
            Panel de Control
          </button>

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-red-900/80 text-red-200 hover:bg-red-700 transition-all duration-300 border border-red-800 ml-auto"
            >
              <FaSignOutAlt />
              Salir
            </button>
          )}
        </nav>

        {/* Renderiza el componente activo */}
        {component}
      </div>
    </div>
  );
}
