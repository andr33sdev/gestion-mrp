import { useEffect, useState, useCallback } from "react";
import {
  FaUsersCog,
  FaUserPlus,
  FaTrash,
  FaSpinner,
  FaUser,
  FaChartBar,
  FaHistory,
  FaChevronRight,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimes,
  FaBoxOpen,
  FaCalendarAlt,
  FaSun,
  FaMoon,
  FaPercentage,
  FaClipboardList,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../utils.js";

const API_URL = `${API_BASE_URL}/operarios`;

// --- Modal de Detalle de Producción ---
function ProduccionModal({ item, onClose, onDelete }) {
  if (!item) return null;

  // Normalización de datos
  const cantidadScrap = Number(item.cantidad_scrap || 0);
  const isScrap = cantidadScrap > 0;
  const turnoStr = (item.turno || "DIURNO").toUpperCase();
  const isDiurno = turnoStr === "DIURNO";
  const planNombre = item.plan_nombre || "Sin Plan Asignado";

  const handleDelete = () => {
    if (
      window.confirm(
        "¿Estás seguro de ANULAR este registro?\n\nSe descontará del plan y se devolverá la materia prima al stock."
      )
    ) {
      onDelete(item.id);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[150] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-600 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FaBoxOpen className="text-blue-400" /> Detalle de Registro
          </h3>
          <div className="flex gap-2">
            {/* BOTÓN ELIMINAR */}
            <button
              onClick={handleDelete}
              className="p-2 bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white rounded transition-colors border border-red-900/50"
              title="Anular Registro"
            >
              <FaTrash />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Producto */}
          <div>
            <p className="text-xs text-gray-400 uppercase font-bold mb-1">
              Producto
            </p>
            <p className="text-lg text-white font-medium leading-tight">
              {item.nombre}
            </p>
          </div>

          {/* Plan (Si existe en el backend) */}
          <div className="flex items-center gap-3 bg-slate-700/30 p-3 rounded-xl border border-slate-600/50">
            <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
              <FaClipboardList />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Contexto
              </p>
              <p className="text-sm text-white font-medium">{planNombre}</p>
            </div>
          </div>

          {/* Cantidades (Grid) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-900/20 p-3 rounded-xl border border-emerald-500/30 text-center">
              <p className="text-emerald-400 text-xs font-bold uppercase mb-1 flex justify-center items-center gap-1">
                <FaCheckCircle /> Producción OK
              </p>
              <p className="text-3xl font-bold text-white">{item.cantidad}</p>
            </div>
            <div
              className={`p-3 rounded-xl border text-center ${
                isScrap
                  ? "bg-rose-900/20 border-rose-500/30"
                  : "bg-slate-700/30 border-slate-600"
              }`}
            >
              <p
                className={`${
                  isScrap ? "text-rose-400" : "text-gray-400"
                } text-xs font-bold uppercase mb-1 flex justify-center items-center gap-1`}
              >
                <FaExclamationTriangle /> Scrap
              </p>
              <p
                className={`text-3xl font-bold ${
                  isScrap ? "text-white" : "text-gray-500"
                }`}
              >
                {cantidadScrap}
              </p>
            </div>
          </div>

          {/* Motivo Scrap */}
          {isScrap && (
            <div className="bg-rose-900/10 p-3 rounded-lg border border-rose-500/20">
              <p className="text-xs text-rose-300 font-bold mb-1">
                Motivo de Falla:
              </p>
              <p className="text-sm text-rose-100 italic">
                "{item.motivo_scrap}"
              </p>
            </div>
          )}

          {/* Fecha y Turno */}
          <div className="flex items-center justify-between text-sm text-gray-400 border-t border-slate-700 pt-4 mt-2">
            <div className="flex items-center gap-2">
              <FaCalendarAlt />{" "}
              {new Date(item.fecha_produccion).toLocaleDateString("es-AR")}
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${
                isDiurno
                  ? "bg-yellow-900/20 text-yellow-200 border-yellow-700"
                  : "bg-blue-900/20 text-blue-200 border-blue-700"
              }`}
            >
              {isDiurno ? <FaSun /> : <FaMoon />}
              <span>{turnoStr}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Componente de Detalle de Estadísticas ---
function OperarioDetalle({ operarioId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduccion, setSelectedProduccion] = useState(null);

  // Función de carga aislada para poder reusarla
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/${operarioId}/stats`);
      if (!res.ok) throw new Error("No se pudieron cargar las estadísticas");
      setStats(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [operarioId]);

  // Carga inicial al montar o cambiar ID
  useEffect(() => {
    if (operarioId) cargarDatos();
  }, [operarioId, cargarDatos]);

  // Handler de Eliminación
  const handleEliminarRegistro = async (id) => {
    try {
      // CORRECCIÓN: Apuntamos a la ruta '/registro/' para no confundir con la de hornos
      const res = await fetch(`${API_BASE_URL}/produccion/registro/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await cargarDatos(); // Recargar la lista
      } else {
        alert("Error al eliminar el registro.");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <FaSpinner className="animate-spin text-3xl" />
      </div>
    );
  }

  if (!stats) {
    return <div className="p-6 text-gray-500">Error al cargar datos.</div>;
  }

  // Cálculos de Eficiencia
  const totalOK = Number(stats.totalUnidades || 0);
  const totalScrap = Number(stats.totalScrap || 0);
  const granTotal = totalOK + totalScrap;
  const eficiencia =
    granTotal > 0 ? ((totalOK / granTotal) * 100).toFixed(1) : "100.0";

  let colorEficiencia = "text-emerald-400";
  let bordeEficiencia = "border-emerald-500/30";
  let bgEficiencia = "bg-emerald-900/20";
  if (Number(eficiencia) < 95) {
    colorEficiencia = "text-yellow-400";
    bordeEficiencia = "border-yellow-500/30";
    bgEficiencia = "bg-yellow-900/20";
  }
  if (Number(eficiencia) < 90) {
    colorEficiencia = "text-rose-400";
    bordeEficiencia = "border-rose-500/30";
    bgEficiencia = "bg-rose-900/20";
  }

  return (
    <>
      <motion.div
        key={operarioId}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="p-6 h-full flex flex-col"
      >
        <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <FaChartBar className="text-blue-400" />
          {stats.nombre}
        </h2>

        {/* GRID DE TARJETAS DE MÉTRICAS */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Unidades OK */}
          <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600">
            <h3 className="text-xs font-bold text-gray-400 uppercase">
              Unidades OK
            </h3>
            <p className="text-3xl font-bold text-emerald-400 mt-1">
              {totalOK}
            </p>
          </div>

          {/* Top Producto */}
          <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600">
            <h3 className="text-xs font-bold text-gray-400 uppercase">
              Top Producto
            </h3>
            <p
              className="text-sm font-bold text-white truncate mt-2"
              title={stats.topProducto?.nombre || "N/A"}
            >
              {stats.topProducto?.nombre || "N/A"}
            </p>
            <p className="text-xs text-gray-500">
              ({stats.topProducto?.total || 0} u.)
            </p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <FaHistory /> Actividad Reciente
        </h3>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
          <ul className="space-y-2">
            {stats.actividadReciente.length === 0 ? (
              <li className="p-8 text-sm text-gray-500 text-center italic">
                Sin actividad reciente registrada.
              </li>
            ) : (
              stats.actividadReciente.map((act, i) => {
                const hasScrap = Number(act.cantidad_scrap) > 0;
                const isDiurno = (act.turno || "DIURNO") === "DIURNO";

                return (
                  <motion.li
                    key={act.id || i}
                    whileHover={{
                      scale: 1.01,
                      backgroundColor: "rgba(255,255,255,0.05)",
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedProduccion(act)}
                    className="p-3 flex justify-between items-center rounded-lg cursor-pointer border border-transparent hover:border-slate-600 transition-all group"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-white group-hover:text-blue-300 transition-colors">
                        {act.nombre}
                      </span>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>
                          {new Date(act.fecha_produccion).toLocaleDateString(
                            "es-AR"
                          )}
                        </span>
                        {hasScrap && (
                          <span className="ml-2 text-[10px] bg-rose-900/50 text-rose-300 px-1.5 py-0.5 rounded border border-rose-800 flex items-center gap-1">
                            <FaExclamationTriangle />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-lg text-emerald-400">
                        +{act.cantidad}
                      </span>
                    </div>
                  </motion.li>
                );
              })
            )}
          </ul>
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedProduccion && (
          <ProduccionModal
            item={selectedProduccion}
            onClose={() => setSelectedProduccion(null)}
            onDelete={handleEliminarRegistro}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// --- Página Principal ---
export default function OperariosPage() {
  const [operarios, setOperarios] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", msg: "" });

  const [selectedOperarioId, setSelectedOperarioId] = useState(null);

  useEffect(() => {
    const cargarOperarios = async () => {
      try {
        setLoading(true);
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("No se pudo cargar la lista");
        const data = await res.json();
        setOperarios(data);
        if (data.length > 0 && !selectedOperarioId) {
          setSelectedOperarioId(data[0].id);
        }
      } catch (err) {
        setFeedback({ type: "error", msg: err.message });
      } finally {
        setLoading(false);
      }
    };
    cargarOperarios();
  }, []);

  const handleAgregar = async (e) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    setIsSaving(true);
    setFeedback({ type: "", msg: "" });
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoNombre.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Error al guardar");
      setOperarios([...operarios, data]);
      setNuevoNombre("");
      setFeedback({ type: "success", msg: "Operario agregado" });
      setSelectedOperarioId(data.id);
    } catch (err) {
      setFeedback({ type: "error", msg: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Seguro que quieres desactivar a este operario?"))
      return;
    setFeedback({ type: "", msg: "" });
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Error al eliminar");
      const nuevosOperarios = operarios.filter((op) => op.id !== id);
      setOperarios(nuevosOperarios);
      setFeedback({ type: "success", msg: data.msg });
      if (selectedOperarioId === id)
        setSelectedOperarioId(
          nuevosOperarios.length > 0 ? nuevosOperarios[0].id : null
        );
    } catch (err) {
      setFeedback({ type: "error", msg: err.message });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto"
    >
      <div className="flex items-center gap-4 mb-6">
        <FaUsersCog className="text-4xl text-purple-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">Panel de Operarios</h1>
          <p className="text-gray-400">
            Administra operarios y consulta sus métricas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-250px)] min-h-[600px]">
        {/* --- COLUMNA IZQUIERDA: LISTA --- */}
        <div className="md:col-span-1 bg-slate-800 border border-slate-700 rounded-xl shadow-lg flex flex-col overflow-hidden">
          <form
            onSubmit={handleAgregar}
            className="p-4 border-b border-slate-700 flex items-center gap-2"
          >
            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nuevo Operario..."
              className="flex-grow bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:border-blue-500 text-white placeholder-gray-500"
              disabled={isSaving}
            />
            <button
              type="submit"
              disabled={isSaving || !nuevoNombre.trim()}
              className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <FaSpinner className="animate-spin" />
              ) : (
                <FaUserPlus />
              )}
            </button>
          </form>
          {feedback.msg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-center p-2 text-xs rounded-lg border m-2 ${
                feedback.type === "success"
                  ? "bg-green-900/50 border-green-700 text-green-300"
                  : "bg-red-900/50 border-red-700 text-red-300"
              }`}
            >
              {feedback.msg}
            </motion.div>
          )}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading && operarios.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <FaSpinner className="animate-spin inline-block" />
              </div>
            ) : (
              <ul className="divide-y divide-slate-700">
                <AnimatePresence>
                  {operarios.length === 0 && !loading && (
                    <motion.li
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-6 text-center text-gray-500"
                    >
                      No hay operarios activos.
                    </motion.li>
                  )}
                  {operarios.map((op) => (
                    <motion.li
                      key={op.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 50 }}
                      className={`flex justify-between items-center p-4 cursor-pointer transition-colors ${
                        selectedOperarioId === op.id
                          ? "bg-blue-600/20 border-l-4 border-blue-500"
                          : "hover:bg-slate-700/50 border-l-4 border-transparent"
                      }`}
                      onClick={() => setSelectedOperarioId(op.id)}
                    >
                      <div className="flex items-center gap-3">
                        <FaUser
                          className={`${
                            selectedOperarioId === op.id
                              ? "text-blue-300"
                              : "text-gray-500"
                          }`}
                        />
                        <span
                          className={`font-medium ${
                            selectedOperarioId === op.id
                              ? "text-white"
                              : "text-gray-300"
                          }`}
                        >
                          {op.nombre}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEliminar(op.id);
                          }}
                          className="text-gray-600 hover:text-red-400 p-2 transition-colors"
                          title="Desactivar"
                        >
                          <FaTrash />
                        </button>
                        {selectedOperarioId === op.id && (
                          <FaChevronRight className="text-blue-400 text-sm" />
                        )}
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>

        {/* --- COLUMNA DERECHA: DETALLE --- */}
        <div className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden relative">
          <AnimatePresence mode="wait">
            {selectedOperarioId ? (
              <OperarioDetalle
                key={selectedOperarioId}
                operarioId={selectedOperarioId}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-gray-600"
              >
                <FaUser className="text-6xl mb-4 opacity-20" />
                <p className="text-lg font-medium">Selecciona un operario</p>
                <p className="text-sm">
                  para ver sus estadísticas y actividad.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
