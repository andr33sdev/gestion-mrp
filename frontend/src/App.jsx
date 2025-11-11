// src/App.jsx
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

// Íconos del Dashboard y Panel de Control (importación combinada y corregida)
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
} from "react-icons/fa"; // <-- ¡RUTA CORREGIDA! Volvemos al import estándar.

// Gráficos
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// INICIO DEL CÓDIGO DEL DASHBOARD Y PANEL DE CONTROL
// --- Constantes ---
const API_BASE_URL = "https://horno-backend.onrender.com/api";
//const API_BASE_URL = "http://localhost:4000/api"; <-- Para desarrollo local
const REGISTROS_API_URL = `${API_BASE_URL}/registros`;
const PRODUCCION_API_URL = `${API_BASE_URL}/produccion`;

const POLLING_INTERVAL = 10000;
const HORAS_TIMEOUT_ENFRIADO = 2;
const MAX_HORAS_CICLO_PROMEDIO = 4;
const ALARMA_WINDOW_HOURS = 24;

// --- FUNCIÓN AUXILIAR 1: Formatear Duración (Sin cambios) ---
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

// --- FUNCIÓN AUXILIAR 2: Obtener Estado de Estación (Sin cambios) ---
function getStationStatus(stationId, allRecords) {
  const lastEvent = allRecords.find((reg) =>
    reg.accion.includes(`Estacion ${stationId}`)
  );
  let status = "INACTIVA";
  let lastEventTimestamp = null;
  if (lastEvent) {
    lastEventTimestamp = lastEvent.timestamp;
    if (lastEvent.accion.includes("Se inicio ciclo")) status = "COCINANDO";
    else if (lastEvent.accion.includes("Enfriando")) status = "ENFRIANDO";
  }
  const cycleStartEvents = allRecords.filter((reg) =>
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

// --- Componente de la Tarjeta de Estación (Sin cambios) ---
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

// --- Componente del Menú de Alarmas (Sin cambios) ---
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

// --- Componente de la Página: Dashboard (¡ACTUALIZADO!) ---
function Dashboard() {
  const [registros, setRegistros] = useState([]);
  const [produccion, setProduccion] = useState({ 1: [], 2: [] });
  const [cargando, setCargando] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Polling (Sin cambios desde la última vez)
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

  // Pre-cálculo para la tabla (Sin cambios)
  const cycleTimeMap = useMemo(() => {
    const station1Starts = registros.filter((reg) =>
      reg.accion.includes("Se inicio ciclo Estacion 1")
    );
    const station2Starts = registros.filter((reg) =>
      reg.accion.includes("Se inicio ciclo Estacion 2")
    );
    const newMap = {};
    const processStarts = (starts) => {
      for (let i = 0; i < starts.length - 1; i++) {
        const currentEvent = starts[i];
        const previousEvent = starts[i + 1];
        try {
          const date1 = new Date(currentEvent.timestamp);
          const date2 = new Date(previousEvent.timestamp);
          const diffMs = date1.getTime() - date2.getTime();
          newMap[currentEvent.id] = {
            durationMs: diffMs,
            durationStr: formatDuration(diffMs),
          };
        } catch (e) {
          console.error(e);
        }
      }
    };
    processStarts(station1Starts);
    processStarts(station2Starts);
    return newMap;
  }, [registros]);

  // Pre-cálculo para el gráfico (Sin cambios)
  const cycleChartData = useMemo(() => {
    const combinedData = [];
    const maxMinutes = MAX_HORAS_CICLO_PROMEDIO * 60;
    const processStationCycles = (stationId, stationName) => {
      const starts = registros.filter((reg) =>
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

  // Pre-cálculo para el Menú de Alarmas (Sin cambios)
  const recentAlarms = useMemo(() => {
    const now = new Date();
    const windowMs = ALARMA_WINDOW_HOURS * 60 * 60 * 1000;
    const pastLimit = now.getTime() - windowMs;
    return registros.filter(
      (reg) =>
        reg.tipo === "ALARMA" && new Date(reg.timestamp).getTime() > pastLimit
    );
  }, [registros]);

  // Derivamos los estados (Sin cambios)
  const statusEstacion1 = getStationStatus(1, registros);
  const statusEstacion2 = getStationStatus(2, registros);
  const avgMsEstacion1 = statusEstacion1.averageCycleTimeMs;
  const avgMsEstacion2 = statusEstacion2.averageCycleTimeMs;

  statusEstacion1.productos = produccion[1] || [];
  statusEstacion2.productos = produccion[2] || [];

  // Lógica de Paginación (Sin cambios)
  const calculatedTotalPages = Math.ceil(registros.length / ITEMS_PER_PAGE);
  const totalPages = Math.min(calculatedTotalPages, 50);
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

  // Formateador de eje X (Sin cambios)
  const formatXAxis = (timestamp) => {
    const date = new Date(timestamp);
    const options = { timeZone: "America/Argentina/Buenos_Aires" };
    return date.toLocaleDateString("es-AR", {
      ...options,
      day: "2-digit",
      month: "2-digit",
    });
  };

  // Carga (Sin cambios)
  if (cargando) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-2xl">
        <FaSpinner className="animate-spin mr-4" />
        Cargando datos del horno...
      </div>
    );
  }

  // Render
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

      {/* --- ¡TABLA DE HISTORIAL ACTUALIZADA! --- */}
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
              <th className="px-4 py-3">Acción / Productos</th>
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
              let durationStr = "---";
              let slowCycleClass = "";
              const cycleData = cycleTimeMap[reg.id];
              if (cycleData) {
                durationStr = cycleData.durationStr;
                if (reg.accion.includes("Estacion 1") && avgMsEstacion1) {
                  if (cycleData.durationMs > avgMsEstacion1 * 1.5) {
                    slowCycleClass = "text-red-400 font-bold";
                  }
                } else if (
                  reg.accion.includes("Estacion 2") &&
                  avgMsEstacion2
                ) {
                  if (cycleData.durationMs > avgMsEstacion2 * 1.5) {
                    slowCycleClass = "text-red-400 font-bold";
                  }
                }
              }
              const isAlarma = reg.tipo === "ALARMA";
              const tipoClass = isAlarma
                ? "bg-red-600/90 text-red-100"
                : "bg-blue-600/90 text-blue-100";

              // --- ¡NUEVA LÓGICA! ---
              // Parseamos los productos guardados en el registro
              let productosDelCiclo = [];
              if (
                reg.accion.includes("Se inicio ciclo") &&
                reg.productos_json
              ) {
                try {
                  productosDelCiclo = JSON.parse(reg.productos_json);
                } catch (e) {
                  console.warn(
                    "JSON inválido en registros:",
                    reg.productos_json
                  );
                }
              }
              // --- FIN NUEVA LÓGICA ---

              return (
                <tr key={reg.id} className="hover:bg-slate-700/50">
                  <td className="px-4 py-3 text-sm text-center">{fechaStr}</td>
                  <td className="px-4 py-3 text-sm font-mono text-center">
                    {horaStr}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${tipoClass}`}
                    >
                      {reg.tipo}
                    </span>
                  </td>

                  {/* --- ¡CELDA MODIFICADA! --- */}
                  <td className="px-4 py-3 text-left">
                    {/* La acción principal */}
                    <span>{reg.accion}</span>
                    {/* Si hay productos en este ciclo, los mostramos */}
                    {productosDelCiclo.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        <FaCubes className="text-gray-400 mt-1" />
                        <div className="flex flex-wrap gap-2">
                          {productosDelCiclo.map((prod, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-gray-600 text-gray-200 px-2 py-0.5 rounded-full"
                            >
                              {prod}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                  {/* --- FIN CELDA MODIFICADA --- */}

                  <td
                    className={`px-4 py-3 text-sm font-mono text-center ${slowCycleClass}`}
                  >
                    {durationStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* --- FIN TABLA ACTUALIZADA --- */}

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

// --- Componente de la Página: Panel de Control (Sin cambios) ---
function PanelControl() {
  const [produccion, setProduccion] = useState({ 1: [], 2: [] });
  const [input1, setInput1] = useState("");
  const [input2, setInput2] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    fetchProduccion();
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
    ) {
      return;
    }

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
        />
      </div>
    </>
  );
}

// --- Sub-componente del Panel de Control (Sin cambios) ---
function EstacionControlPanel({
  title,
  estacionId,
  productos,
  inputValue,
  onInputChange,
  onAdd,
  onClear,
  color,
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

  return (
    <div
      className={`rounded-xl shadow-2xl p-6 ${styles.bg} border-2 ${styles.border}`}
    >
      <h2 className="text-3xl font-bold text-white mb-6">{title}</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Nombre del producto (ej: Kayak Rojo)"
          className="flex-grow p-3 bg-gray-800 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-opacity-50"
        />
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

// --- Componente de la Página: Login (Sin cambios) ---
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
              className="block text-sm font-bold text-gray-300 mb-2"
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

// --- Contraseña (Sin cambios) ---
const ADMIN_PASSWORD = "admin123";

// --- Componente Principal 'App' (Sin cambios) ---
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

  let component;
  if (page === "/panel-control") {
    component = isAuthenticated ? (
      <PanelControl />
    ) : (
      <LoginPage onLoginSuccess={handleLoginSuccess} />
    );
  } else {
    component = <Dashboard />;
  }

  const activeClass = "bg-slate-600 text-white";
  const inactiveClass = "bg-slate-800 text-gray-400 hover:bg-slate-700";

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <nav className="flex justify-center items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-colors ${
              page === "/" ? activeClass : inactiveClass
            }`}
          >
            <FaHome />
            Monitor
          </button>
          <button
            onClick={() => navigate("/panel-control")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-colors ${
              page === "/panel-control" ? activeClass : inactiveClass
            }`}
          >
            <FaTools />
            Panel de Control
          </button>

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold bg-red-800 text-gray-300 hover:bg-red-700 transition-colors"
            >
              <FaSignOutAlt />
              Salir
            </button>
          )}
        </nav>

        {component}
      </div>
    </div>
  );
}
