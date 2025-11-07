// src/App.jsx
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FaFire,
  FaSnowflake,
  FaPowerOff,
  FaHistory,
  FaHourglassHalf,
  FaChartPie,
  FaTachometerAlt,
} from "react-icons/fa";

// --- Constantes ---
const API_URL = "http://localhost:4000/api/registros";
const POLLING_INTERVAL = 10000;
const HORAS_TIMEOUT_ENFRIADO = 2;
const MAX_HORAS_CICLO_PROMEDIO = 4;

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

// --- FUNCIÓN AUXILIAR 2: Obtener Estado (¡ACTUALIZADA!) ---
function getStationStatus(stationId, allRecords) {
  // 1. Get Status y Last Event (sin cambios)
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

  // 2. Filtrar todos los inicios de ciclo (sin cambios)
  const cycleStartEvents = allRecords.filter((reg) =>
    reg.accion.includes(`Se inicio ciclo Estacion ${stationId}`)
  );

  // (Quitamos el cálculo de totalCycles, ya no se usa)

  // 3. Lógica de Promedio y Ciclo Anterior (sin cambios)
  let cycleDuration = "N/A";
  let averageCycleTime = "N/A";
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
    }
  }

  // 4. Get Hora de Inicio del Ciclo EN VIVO (sin cambios)
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

  // 5. KPI: Ciclos de Hoy (sin cambios)
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

  // 6. Lógica de Timeout (sin cambios)
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

  // 7. Devolvemos todo
  return {
    status,
    lastEvent: lastEvent || null,
    cycleDuration,
    liveCycleStartTime,
    cyclesToday,
    // (quitamos 'totalCycles')
    averageCycleTime,
  };
}

// --- Componente de la Tarjeta de Estación (¡ACTUALIZADO!) ---
function StationCard({ title, data }) {
  const [liveDuration, setLiveDuration] = useState("---");

  // Animaciones (sin cambios)
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
  // Estilos (sin cambios)
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

  // Efecto Timer (sin cambios)
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

  // Formateador de fecha (sin cambios)
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
      {/* --- CAMBIO: Título SIN subtítulo --- */}
      <h2 className="text-3xl font-bold text-white mb-5">{title}</h2>
      {/* (Se eliminó el <p> con 'data.totalCycles') */}

      {/* Indicador de Estado (sin cambios) */}
      <div
        className={`flex flex-col items-center justify-center p-8 rounded-lg ${styles.textColor} mb-6`}
      >
        <motion.div animate={animations[data.status]}>
          <IconComponent className="text-6xl" />
        </motion.div>
        <span className="text-4xl font-extrabold mt-4">{data.status}</span>
      </div>

      {/* Grid de 4 KPIs (2x2) (sin cambios) */}
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

      {/* Detalles del Último Evento (sin cambios) */}
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

// --- Componente Principal de la App (Sin cambios) ---
export default function App() {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Polling
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

  // Pre-cálculo para la tabla
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
        try {
          const date1 = new Date(starts[i].timestamp);
          const date2 = new Date(starts[i + 1].timestamp);
          const diffMs = date1.getTime() - date2.getTime();
          newMap[starts[i].id] = formatDuration(diffMs);
        } catch (e) {
          console.error(e);
        }
      }
    };
    processStarts(station1Starts);
    processStarts(station2Starts);
    return newMap;
  }, [registros]);

  // Derivamos los estados (ya no incluyen 'totalCycles')
  const statusEstacion1 = getStationStatus(1, registros);
  const statusEstacion2 = getStationStatus(2, registros);

  // Paginación
  const totalPages = Math.ceil(registros.length / ITEMS_PER_PAGE);
  const historialPaginado = registros.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const handleNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  // Carga
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-12">
          <StationCard title="Estación 1 (Izquierda)" data={statusEstacion1} />
          <StationCard title="Estación 2 (Derecha)" data={statusEstacion2} />
        </div>

        <h2 className="text-3xl font-semibold mb-6">
          Historial Reciente (Global)
        </h2>
        <div className="bg-slate-800 rounded-lg shadow-xl overflow-x-auto">
          <table className="w-full table-auto min-w-[700px]">
            <thead className="bg-slate-700 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Acción</th>
                <th className="px-4 py-3">Tiempo de Ciclo (HH:MM:SS)</th>
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

                return (
                  <tr key={reg.id} className="hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm">{fechaStr}</td>
                    <td className="px-4 py-3 text-sm font-mono">{horaStr}</td>
                    <td className="px-4 py-3">{reg.accion}</td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {cycleTimeMap[reg.id] || "---"}
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
