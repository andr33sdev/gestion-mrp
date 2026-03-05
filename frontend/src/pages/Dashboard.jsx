import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FaFire,
  FaSnowflake,
  FaPowerOff,
  FaExclamationTriangle,
  FaTools,
  FaSpinner,
  FaHistory,
  FaChartLine,
} from "react-icons/fa";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend 
} from "recharts";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import {
  REGISTROS_API_URL,
  PRODUCCION_API_URL,
  POLLING_INTERVAL,
  MAX_HORAS_CICLO_PROMEDIO,
  ALARMA_WINDOW_HOURS,
  formatDuration,
  getStationStatus,
  authFetch,
  UPDATE_FCM_TOKEN_URL,
} from "../utils.js";

// --- Sub-componente StationCard (Estilo Lebane) ---
function StationCard({ title, data }) {
  const [liveDuration, setLiveDuration] = useState("---");

  const statusConfig = {
    COCINANDO: {
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100",
      icon: FaFire,
      label: "Cocinando",
    },
    ENFRIANDO: {
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      icon: FaSnowflake,
      label: "Enfriando",
    },
    INACTIVA: {
      color: "text-slate-400",
      bg: "bg-slate-50",
      border: "border-slate-200",
      icon: FaPowerOff,
      label: "Inactiva",
    },
  };

  const config = statusConfig[data.status] || statusConfig.INACTIVA;
  const Icon = config.icon;

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

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
      <div className="p-5 border-b border-slate-50 flex justify-between items-center">
        <h3 className="font-bold text-slate-700 tracking-tight text-sm">
          {title}
        </h3>
        <div
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${config.bg} ${config.color} ${config.border}`}
        >
          {config.label}
        </div>
      </div>

      <div className="p-6 flex flex-col items-center">
        <motion.div
          animate={data.status === "COCINANDO" ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
          className={`w-16 h-16 rounded-full ${config.bg} flex items-center justify-center mb-4`}
        >
          <Icon className={`text-2xl ${config.color}`} />
        </motion.div>

        <div className="text-center mb-6">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight mb-1">
            Tiempo Actual
          </p>
          <p className="text-4xl font-bold text-slate-800 font-mono tracking-tighter">
            {liveDuration}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 w-full">
          <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
            <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">
              Hoy
            </p>
            <p className="text-base font-bold text-slate-700">
              {data.cyclesToday}
            </p>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
            <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">
              Anterior
            </p>
            <p className="text-base font-bold text-slate-700 font-mono">
              {data.cycleDuration || "00:00"}
            </p>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
            <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">
              Promedio
            </p>
            <p className="text-base font-bold text-slate-700 font-mono">
              {data.averageCycleTime || "00:00"}
            </p>
          </div>
        </div>
      </div>

      {data.productos?.length > 0 && (
        <div className="px-6 pb-6 mt-auto">
          <div className="flex flex-wrap gap-1">
            {data.productos.map((p, i) => (
              <span
                key={i}
                className="bg-blue-50 text-blue-600 text-[9px] font-bold px-2 py-1 rounded-md border border-blue-100"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Componente Principal ---
export default function Dashboard({ onNavigate }) {
  const [registros, setRegistros] = useState([]);
  const [produccion, setProduccion] = useState({ 1: [], 2: [] });
  const [cargando, setCargando] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    const fetchDatos = async () => {
      const token = localStorage.getItem("mrp_token");
      if (!token) {
        setCargando(false);
        return;
      }

      try {
        const [resReg, resProd] = await Promise.all([
          authFetch(REGISTROS_API_URL),
          authFetch(PRODUCCION_API_URL),
        ]);

        if (resReg.ok) {
          const dataReg = await resReg.json();
          if (Array.isArray(dataReg)) setRegistros(dataReg);
        }
        if (resProd.ok) {
          const dataProd = await resProd.json();
          setProduccion(dataProd);
        }
      } catch (e) {
        console.error("Error Dashboard:", e);
      } finally {
        setCargando(false);
      }
    };

    fetchDatos();
    const intervalId = setInterval(fetchDatos, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  // Registro FCM (Corrección de URL y silencio de errores)
  useEffect(() => {
    const initFCM = async () => {
      if (Capacitor.getPlatform() === "web") return;
      const tokenSesion = localStorage.getItem("mrp_token");
      if (!tokenSesion) return;

      try {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === "granted") {
          await PushNotifications.removeAllListeners();
          PushNotifications.addListener("registration", async (token) => {
            try {
              // USAMOS LA CONSTANTE DEL UTILS QUE YA TIENE LA URL DE PRODUCCIÓN
              await authFetch(UPDATE_FCM_TOKEN_URL, {
                method: "PUT",
                body: JSON.stringify({ fcm_token: token.value }),
              });
            } catch (e) {}
          });
          await PushNotifications.register();
        }
      } catch (e) {}
    };
    initFCM();
  }, []);

  // --- Cálculos ---
  const cycleTimeMap = useMemo(() => {
    if (!Array.isArray(registros)) return {};
    const newMap = {};
    const processStarts = (stationId) => {
      const starts = registros.filter(
        (r) =>
          r.tipo === "EVENTO" &&
          r.accion.includes(`Se inicio ciclo Estacion ${stationId}`),
      );
      for (let i = 0; i < starts.length - 1; i++) {
        const diffMs =
          new Date(starts[i].timestamp) - new Date(starts[i + 1].timestamp);
        newMap[starts[i].id] = {
          durationStr: formatDuration(diffMs),
          durationMs: diffMs,
        };
      }
    };
    [1, 2].forEach(processStarts);
    return newMap;
  }, [registros]);

  const cycleChartData = useMemo(() => {
    if (!Array.isArray(registros)) return [];
    const combinedData = [];
    [1, 2].forEach((id) => {
      const starts = registros.filter(
        (r) =>
          r.tipo === "EVENTO" &&
          r.accion.includes(`Se inicio ciclo Estacion ${id}`),
      );
      for (let i = 0; i < starts.length - 1; i++) {
        const mins =
          (new Date(starts[i].timestamp) - new Date(starts[i + 1].timestamp)) /
          60000;
        if (mins > 0 && mins <= MAX_HORAS_CICLO_PROMEDIO * 60)
          combinedData.push({
            timestamp: starts[i].timestamp,
            [`E${id}`]: mins,
          });
      }
    });
    return combinedData
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-15);
  }, [registros]);

  const statusE1 = getStationStatus(1, registros);
  const statusE2 = getStationStatus(2, registros);
  statusE1.productos = produccion[1] || [];
  statusE2.productos = produccion[2] || [];

  const totalPages = Math.max(1, Math.ceil(registros.length / ITEMS_PER_PAGE));
  const historialPaginado = (Array.isArray(registros) ? registros : []).slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Funciones de navegación (Aquí estaba el error)
  const handleNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  if (cargando)
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50 text-blue-600">
        <FaSpinner className="animate-spin text-3xl mb-4" />
        <span className="font-bold tracking-tighter text-sm uppercase">
          Sincronizando Sistemas...
        </span>
      </div>
    );

  return (
    <div className="p-4 lg:p-10 w-full mx-auto space-y-10 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      {/* Header Minimalista */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tighter flex items-center gap-2">
            <FaFire className="text-orange-500" /> Hornos en Vivo
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">
            Monitoreo de telemetría en tiempo real
          </p>
        </div>
        <button
          onClick={() => onNavigate("/panel-control")}
          className="bg-white hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-2xl font-bold shadow-sm border border-slate-200 flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-wider"
        >
          <FaTools className="text-slate-400" /> Panel Control
        </button>
      </div>

      {/* Grid de Estaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <StationCard title="ESTACIÓN IZQUIERDA (1)" data={statusE1} />
        <StationCard title="ESTACIÓN DERECHA (2)" data={statusE2} />
      </div>

      {/* Gráfico Estilizado Estilo Lebane (Funcionalidad Restaurada) */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-8 mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center">
            <FaChartLine className="text-slate-500 text-lg" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 tracking-tight text-lg">
              Tiempos de Ciclo
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Últimos 30 registros (minutos)
            </p>
          </div>
        </div>

        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={cycleChartData}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              {/* Cuadrícula sutil y limpia */}
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />

              <XAxis
                dataKey="timestamp"
                stroke="#94a3b8"
                fontSize={10}
                fontWeight="bold"
                tickLine={false}
                axisLine={false}
                tickFormatter={(ts) =>
                  new Date(ts).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }
              />

              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                fontWeight="bold"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}m`}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  borderColor: "#e2e8f0",
                  borderRadius: "12px",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
                labelStyle={{ color: "#64748b", marginBottom: "4px" }}
                labelFormatter={(ts) =>
                  new Date(ts).toLocaleTimeString("es-AR")
                }
              />

              {/* Leyenda automática de Recharts, pero estilizada */}
              <Legend
                iconType="circle"
                wrapperStyle={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#64748b",
                  paddingTop: "10px",
                }}
              />

              <Line
                type="monotone"
                dataKey="Estación 1"
                name="Estación 1"
                stroke="#f43f5e" /* Rose 500 */
                strokeWidth={3}
                /* Acá está la magia: le devolvemos los puntos pero con diseño limpio (centro blanco, borde de color) */
                dot={{ r: 4, fill: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 0, fill: "#f43f5e" }}
                connectNulls={true} /* Vital para que no se corte la línea */
              />

              <Line
                type="monotone"
                dataKey="Estación 2"
                name="Estación 2"
                stroke="#0ea5e9" /* Sky 500 */
                strokeWidth={3}
                dot={{ r: 4, fill: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 0, fill: "#0ea5e9" }}
                connectNulls={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de Actividad */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-2">
          <FaHistory className="text-slate-400" />
          <h3 className="font-bold text-slate-700 tracking-tight">
            Registro de Actividad
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
              <tr>
                <th className="px-8 py-5">Hora</th>
                <th className="px-8 py-5">Descripción del Evento</th>
                <th className="px-8 py-5">Categoría</th>
                <th className="px-8 py-5 text-right">Duración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {historialPaginado.map((reg) => {
                const isAlarma = reg.tipo === "ALARMA";
                const isProd = reg.tipo === "PRODUCCION";
                return (
                  <tr
                    key={reg.id}
                    className="hover:bg-slate-50/30 transition-colors"
                  >
                    <td className="px-8 py-5 text-[11px] font-bold text-slate-400 font-mono">
                      {new Date(reg.timestamp).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-bold text-slate-700">
                        {reg.accion}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`text-[9px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-tighter ${
                          isAlarma
                            ? "bg-red-50 text-red-600"
                            : isProd
                              ? "bg-green-50 text-green-600"
                              : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {reg.tipo}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right text-[11px] font-bold text-slate-600 font-mono">
                      {cycleTimeMap[reg.id]?.durationStr || "---"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginador */}
        <div className="p-6 bg-slate-50/20 flex justify-between items-center border-t border-slate-50">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="text-xs font-bold text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors uppercase tracking-widest"
          >
            Anterior
          </button>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            Pág {currentPage} / {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="text-xs font-bold text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors uppercase tracking-widest"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
