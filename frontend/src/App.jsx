// src/App.jsx
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
// Importamos TODOS los íconos
import {
  FaFire,
  FaSnowflake,
  FaPowerOff,
  FaHourglassHalf,
  FaChartPie,
  FaHistory,
  FaTachometerAlt,
  FaExclamationTriangle,
} from "react-icons/fa";
// Importamos Recharts (para el gráfico de líneas)
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

// --- Constantes ---
const API_URL = "https://horno-backend.onrender.com/api/registros";
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
  // (Esta función es idéntica a la versión anterior)
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
  // (Este componente es idéntico a la versión anterior)
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

// --- Componente Principal de la App ---
export default function App() {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Polling (Sin cambios)
  useEffect(() => {
    const fetchRegistros = () => {
      fetch(API_URL)
        .then((res) => res.json())
        .then((data) => {
          setRegistros(data);
          setCargando(false);
        })
        .catch((err) => {
          console.error(err);
          setCargando(false);
        });
    };
    fetchRegistros();
    const intervalId = setInterval(fetchRegistros, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  // Pre-cálculo para la tabla (Sin cambios)
  const cycleTimeMap = useMemo(() => {
    // (Lógica idéntica)
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
    // (Lógica idéntica)
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

  // --- LÓGICA DE PAGINACIÓN ACTUALIZADA ---
  const calculatedTotalPages = Math.ceil(registros.length / ITEMS_PER_PAGE);
  // --- LÍMITE DE 25 PÁGINAS ---
  const totalPages = Math.min(calculatedTotalPages, 25);

  // --- Efecto para reajustar la página si está fuera de los límites ---
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages); // Vuelve a la última página válida (ej: 25)
    }
  }, [currentPage, totalPages]);

  const historialPaginado = registros.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const handleNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages)); // totalPages ya está limitado
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  // --- FIN LÓGICA DE PAGINACIÓN ---

  // Formateador para el eje X (Sin cambios)
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
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-2xl animate-pulse">
        Cargando datos del horno...
      </div>
    );
  }

  // Render
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-10">
          Monitor en Vivo - Horno de Rotomoldeo
        </h1>

        {/* Menú de Alarmas */}
        <AlarmMenu alarms={recentAlarms} />

        {/* Tarjetas de Estaciones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-12">
          <StationCard title="Estación 1 (Izquierda)" data={statusEstacion1} />
          <StationCard title="Estación 2 (Derecha)" data={statusEstacion2} />
        </div>

        {/* Gráfico de Líneas */}
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

        {/* Tabla de Historial Reciente (con 'tipo') */}
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

                // Lógica de Alerta de Ciclo Lento
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

                // Lógica de Etiqueta de Tipo
                const isAlarma = reg.tipo === "ALARMA";
                const tipoClass = isAlarma
                  ? "bg-red-600/90 text-red-100"
                  : "bg-blue-600/90 text-blue-100";

                return (
                  <tr
                    key={reg.id}
                    className="hover:bg-slate-700/50 text-center"
                  >
                    <td className="px-4 py-3 text-sm">{fechaStr}</td>
                    <td className="px-4 py-3 text-sm font-mono">{horaStr}</td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${tipoClass}`}
                      >
                        {reg.tipo}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-left">{reg.accion}</td>
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

        {/* Controles de Paginación */}
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
      </div>
    </div>
  );
}
