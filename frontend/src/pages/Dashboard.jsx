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
  FaSpinner,
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
} from "recharts";
import {
  REGISTROS_API_URL,
  PRODUCCION_API_URL,
  POLLING_INTERVAL,
  MAX_HORAS_CICLO_PROMEDIO,
  ALARMA_WINDOW_HOURS,
  formatDuration,
  getStationStatus,
} from "../utils.js";

// --- Sub-componentes del Dashboard ---

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
        className="w-full bg-red-700 text-white p-3 rounded-lg shadow-lg flex items-center justify-center font-bold text-lg hover:bg-red-600 transition-colors"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <FaExclamationTriangle className="mr-3" />
        </motion.div>
        {alarms.length} Alarma(s) (24hs)
      </button>
      {isOpen && (
        <div className="absolute w-full bg-slate-700 rounded-b-lg shadow-xl overflow-hidden p-4 max-h-60 overflow-y-auto">
          {alarms.map((a) => (
            <div
              key={a.id}
              className="flex items-start p-2 border-b border-slate-600 last:border-b-0"
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

// --- Componente Principal del Dashboard ---
export default function Dashboard({ onNavigate }) {
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
        .catch((e) => {
          console.error(e);
          setCargando(false);
        });
    };
    fetchDatos();
    const intervalId = setInterval(fetchDatos, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  const cycleTimeMap = useMemo(() => {
    const newMap = {};
    const processStarts = (stationId, actionName) => {
      const starts = registros.filter(
        (r) =>
          r.tipo === "EVENTO" &&
          r.accion.includes(`Se inicio ciclo Estacion ${stationId}`)
      );
      for (let i = 0; i < starts.length - 1; i++) {
        const diffMs =
          new Date(starts[i].timestamp) - new Date(starts[i + 1].timestamp);
        newMap[starts[i].id] = {
          durationStr: formatDuration(diffMs),
          durationMs: diffMs,
          accion: actionName,
        };
      }
    };
    processStarts(1, "Estacion 1");
    processStarts(2, "Estacion 2");
    return newMap;
  }, [registros]);

  const cycleChartData = useMemo(() => {
    const combinedData = [];
    [1, 2].forEach((id) => {
      const starts = registros.filter(
        (r) =>
          r.tipo === "EVENTO" &&
          r.accion.includes(`Se inicio ciclo Estacion ${id}`)
      );
      for (let i = 0; i < starts.length - 1; i++) {
        const mins =
          (new Date(starts[i].timestamp) - new Date(starts[i + 1].timestamp)) /
          60000;
        if (mins > 0 && mins <= MAX_HORAS_CICLO_PROMEDIO * 60)
          combinedData.push({
            timestamp: starts[i].timestamp,
            [`Estación ${id}`]: mins,
          });
      }
    });
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
      <div className="flex justify-center items-center h-screen bg-gray-900 text-white text-2xl">
        <FaSpinner className="animate-spin mr-4" /> Cargando datos del horno...
      </div>
    );

  return (
    <div className="animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <h1 className="text-4xl md:text-5xl font-bold text-center md:text-left flex items-center gap-3 text-white">
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
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#cbd5e1" }}
            />
            <Legend wrapperStyle={{ color: "#cbd5e1" }} />
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

      {/* --- TABLA DE HISTORIAL COMPLETA --- */}
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
                if (
                  cycleData.accion.includes("Estacion 1") &&
                  avgMsEstacion1 &&
                  cycleData.durationMs > avgMsEstacion1 * 1.5
                )
                  slowCycleClass = "text-red-400 font-bold";
                else if (
                  cycleData.accion.includes("Estacion 2") &&
                  avgMsEstacion2 &&
                  cycleData.durationMs > avgMsEstacion2 * 1.5
                )
                  slowCycleClass = "text-red-400 font-bold";
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
