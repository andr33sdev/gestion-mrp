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
  FaClipboardList,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { API_BASE_URL, authFetch } from "../utils.js";

const API_URL = `${API_BASE_URL}/operarios`;

// --- MODAL DE CONFIRMACIÓN ELEGANTE (Estilo Lebane) ---
function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
}) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[300] p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden text-center p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6 border border-rose-100 shadow-sm">
          <FaExclamationTriangle size={28} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-3 tracking-tight">
          {title}
        </h3>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all active:scale-95"
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- MODAL DE DETALLE DE PRODUCCIÓN (Estilo Lebane) ---
function ProduccionModal({ item, onClose, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (!item) return null;
  const cantidadScrap = Number(item.cantidad_scrap || 0);
  const isScrap = cantidadScrap > 0;
  const turnoStr = (item.turno || "DIURNO").toUpperCase();
  const isDiurno = turnoStr === "DIURNO";
  const planNombre = item.plan_nombre || "Sin Plan Asignado";

  const executeDelete = () => {
    setShowConfirm(false);
    onDelete(item.id);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[150] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <FaBoxOpen size={14} />
            </div>
            Detalle de Registro
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(true)}
              className="p-2.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors border border-rose-100"
              title="Anular Registro"
            >
              <FaTrash size={14} />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-2.5 bg-white border border-slate-100 rounded-xl shadow-sm hover:bg-slate-50"
            >
              <FaTimes size={14} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1.5">
              Producto Elaborado
            </p>
            <p className="text-xl text-slate-800 font-bold tracking-tight leading-tight">
              {item.nombre}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
              <FaClipboardList size={16} />
            </div>
            <div>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">
                Contexto de Plan
              </p>
              <p className="text-sm text-blue-900 font-bold">{planNombre}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 text-center">
              <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest mb-2 flex justify-center items-center gap-1.5">
                <FaCheckCircle /> Producción OK
              </p>
              <p className="text-4xl font-bold text-emerald-600 font-mono tracking-tighter">
                {item.cantidad}
              </p>
            </div>
            <div
              className={`p-4 rounded-2xl border text-center ${isScrap ? "bg-rose-50/50 border-rose-100" : "bg-slate-50/50 border-slate-100"}`}
            >
              <p
                className={`${isScrap ? "text-rose-500" : "text-slate-400"} text-[10px] font-bold uppercase tracking-widest mb-2 flex justify-center items-center gap-1.5`}
              >
                <FaExclamationTriangle /> Scrap / Falla
              </p>
              <p
                className={`text-4xl font-bold font-mono tracking-tighter ${isScrap ? "text-rose-600" : "text-slate-300"}`}
              >
                {cantidadScrap}
              </p>
            </div>
          </div>

          {isScrap && (
            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
              <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest mb-1.5">
                Motivo Registrado:
              </p>
              <p className="text-sm text-rose-700 font-medium italic">
                "{item.motivo_scrap}"
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-slate-500 pt-2">
            <div className="flex items-center gap-2 font-bold text-xs">
              <FaCalendarAlt className="text-slate-400" />{" "}
              {new Date(item.fecha_produccion).toLocaleDateString("es-AR")}
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${isDiurno ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-indigo-50 text-indigo-600 border-indigo-200"}`}
            >
              {isDiurno ? <FaSun size={12} /> : <FaMoon size={12} />}
              <span>{turnoStr}</span>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showConfirm && (
          <ConfirmModal
            isOpen={showConfirm}
            title="¿Anular Registro?"
            message="Se descontará la cantidad del plan y se devolverá la materia prima al stock. Esta acción es irreversible."
            onConfirm={executeDelete}
            onCancel={() => setShowConfirm(false)}
            confirmText="Sí, anular"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- DETALLE DEL OPERARIO (Panel Derecho) ---
function OperarioDetalle({ operarioId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduccion, setSelectedProduccion] = useState(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/${operarioId}/stats`);
      if (!res.ok) throw new Error("No se pudieron cargar las estadísticas");
      setStats(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [operarioId]);

  useEffect(() => {
    if (operarioId) cargarDatos();
  }, [operarioId, cargarDatos]);

  const handleEliminarRegistro = async (id) => {
    const toastId = toast.loading("Procesando anulación...");
    try {
      const res = await authFetch(`${API_BASE_URL}/produccion/registro/${id}`, {
        method: "DELETE",
      });

      if (res.status === 403) {
        toast.error("Acceso Denegado: Permisos insuficientes.", {
          id: toastId,
        });
        return;
      }

      if (res.ok) {
        toast.success("Registro anulado correctamente.", { id: toastId });
        setSelectedProduccion(null);
        await cargarDatos();
      } else {
        const data = await res.json();
        toast.error(`Error: ${data.msg || "No se pudo anular"}`, {
          id: toastId,
        });
      }
    } catch (e) {
      toast.error("Error de conexión.", { id: toastId });
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <FaSpinner className="animate-spin text-3xl" />
      </div>
    );
  if (!stats)
    return (
      <div className="p-8 text-slate-400 font-medium text-center">
        Error al cargar datos.
      </div>
    );

  const totalOK = Number(stats.totalUnidades || 0);
  return (
    <>
      {/* CANDADO DE ALTURA: min-h-0 y overflow-hidden obligan al scroll interno */}
      <motion.div
        key={operarioId}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="p-6 md:p-8 h-full flex flex-col bg-white rounded-[2rem] border border-slate-100 shadow-sm min-h-0 overflow-hidden"
      >
        <div className="flex items-center gap-4 mb-6 md:mb-8 pb-6 border-b border-slate-50 shrink-0">
          <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-blue-100">
            <FaChartBar />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tighter">
            {stats.nombre}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8 shrink-0">
          <div className="bg-slate-50/50 p-5 md:p-6 rounded-3xl border border-slate-100 hover:shadow-md transition-all">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <FaCheckCircle className="text-emerald-400" /> Unidades OK
            </h3>
            <p className="text-4xl font-bold text-emerald-500 tracking-tighter">
              {totalOK}
            </p>
          </div>
          <div className="bg-slate-50/50 p-5 md:p-6 rounded-3xl border border-slate-100 hover:shadow-md transition-all flex flex-col min-w-0">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <FaChartBar className="text-amber-400" /> Top Producto
            </h3>
            <p
              className="text-sm md:text-base font-bold text-slate-700 truncate"
              title={stats.topProducto?.nombre || "N/A"}
            >
              {stats.topProducto?.nombre || "Sin datos"}
            </p>
            <p className="text-xs text-slate-400 font-bold mt-1">
              ({stats.topProducto?.total || 0} fabricadas)
            </p>
          </div>
        </div>

        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 px-2 shrink-0">
          <FaHistory className="text-slate-300" /> Actividad Reciente
        </h3>

        {/* EL CONTENEDOR DE LA LISTA: flex-1, overflow-y-auto y min-h-0 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
          <ul className="space-y-3">
            {stats.actividadReciente.length === 0 ? (
              <li className="p-8 text-sm text-slate-400 text-center font-medium bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                No hay actividad registrada en el sistema.
              </li>
            ) : (
              stats.actividadReciente.map((act, i) => {
                const hasScrap = Number(act.cantidad_scrap) > 0;
                return (
                  <motion.li
                    key={act.id || i}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedProduccion(act)}
                    className="p-4 flex justify-between items-center rounded-2xl cursor-pointer bg-white border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group"
                  >
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="font-bold text-sm text-slate-700 group-hover:text-blue-600 transition-colors tracking-tight truncate">
                        {act.nombre}
                      </span>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <FaCalendarAlt size={10} className="text-slate-300" />{" "}
                          {new Date(act.fecha_produccion).toLocaleDateString(
                            "es-AR",
                          )}
                        </span>
                        {hasScrap && (
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-rose-50 text-rose-500 px-2 py-0.5 rounded-lg border border-rose-100 flex items-center gap-1 shrink-0">
                            <FaExclamationTriangle size={10} /> Scrap
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shrink-0">
                      <span className="font-bold text-emerald-600 font-mono">
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

// --- PÁGINA PRINCIPAL (Layout General) ---
export default function OperariosPage({ onNavigate }) {
  const [operarios, setOperarios] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedOperarioId, setSelectedOperarioId] = useState(null);
  const [operarioToDelete, setOperarioToDelete] = useState(null);

  useEffect(() => {
    const cargarOperarios = async () => {
      try {
        setLoading(true);
        const res = await authFetch(API_URL);
        if (!res.ok) throw new Error("No se pudo cargar la lista");
        const data = await res.json();
        setOperarios(data);
        if (data.length > 0 && !selectedOperarioId)
          setSelectedOperarioId(data[0].id);
      } catch (err) {
        toast.error("Error al cargar operarios.");
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
    const toastId = toast.loading("Registrando operario...");

    try {
      const res = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoNombre.trim() }),
      });

      if (res.status === 403) {
        toast.error(
          "Acceso Denegado: No tienes permisos para crear operarios.",
          { id: toastId },
        );
        setIsSaving(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Error al guardar");

      setOperarios([...operarios, data]);
      setNuevoNombre("");
      toast.success("Operario agregado correctamente", { id: toastId });
      setSelectedOperarioId(data.id);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const executeEliminar = async () => {
    if (!operarioToDelete) return;
    const id = operarioToDelete.id;
    setOperarioToDelete(null);
    const toastId = toast.loading("Desactivando operario...");

    try {
      const res = await authFetch(`${API_URL}/${id}`, { method: "DELETE" });

      if (res.status === 403) {
        toast.error("Acceso Denegado: Permisos insuficientes.", {
          id: toastId,
        });
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Error al eliminar");

      const nuevosOperarios = operarios.filter((op) => op.id !== id);
      setOperarios(nuevosOperarios);
      toast.success("Operario desactivado del sistema", { id: toastId });

      if (selectedOperarioId === id)
        setSelectedOperarioId(
          nuevosOperarios.length > 0 ? nuevosOperarios[0].id : null,
        );
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full mx-auto p-4 lg:p-8 bg-[#f8fafc] h-full flex flex-col"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tighter flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <FaUsersCog size={20} />
            </div>
            Panel de Equipo
          </h1>
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-2 ml-14">
            Gestión de Personal y Rendimiento
          </p>
        </div>
      </div>

      {/* EL PADRE TAMBIÉN DEBE TENER min-h-0 PARA PERMITIR QUE EL GRID SE CONTENGA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
        {/* LISTA DE OPERARIOS */}
        <div className="lg:col-span-1 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col overflow-hidden min-h-0">
          <form
            onSubmit={handleAgregar}
            className="p-5 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3 shrink-0"
          >
            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre del operario..."
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-slate-700 placeholder-slate-400 transition-all shadow-sm"
              disabled={isSaving}
            />
            <button
              type="submit"
              disabled={isSaving || !nuevoNombre.trim()}
              className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-200 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none shrink-0"
            >
              {isSaving ? (
                <FaSpinner className="animate-spin" />
              ) : (
                <FaUserPlus />
              )}
            </button>
          </form>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 min-h-0">
            {loading && operarios.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <FaSpinner className="animate-spin inline-block text-2xl" />
              </div>
            ) : (
              <ul className="space-y-1.5">
                <AnimatePresence>
                  {operarios.length === 0 && !loading && (
                    <motion.li
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-6 text-center text-slate-400 font-medium text-sm"
                    >
                      No hay operarios registrados.
                    </motion.li>
                  )}
                  {operarios.map((op) => (
                    <motion.li
                      key={op.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className={`flex justify-between items-center p-4 rounded-2xl cursor-pointer transition-all border ${selectedOperarioId === op.id ? "bg-blue-50/80 border-blue-200 shadow-sm" : "bg-white border-transparent hover:bg-slate-50"}`}
                      onClick={() => setSelectedOperarioId(op.id)}
                    >
                      <div className="flex items-center gap-4 min-w-0 pr-2">
                        <div
                          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border ${selectedOperarioId === op.id ? "bg-blue-100 border-blue-200 text-blue-600" : "bg-slate-100 border-slate-200 text-slate-400"}`}
                        >
                          <FaUser size={12} />
                        </div>
                        <span
                          className={`font-bold text-sm tracking-tight truncate ${selectedOperarioId === op.id ? "text-blue-900" : "text-slate-600"}`}
                        >
                          {op.nombre}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOperarioToDelete(op);
                          }}
                          className={`p-2 rounded-lg transition-colors ${selectedOperarioId === op.id ? "text-rose-400 hover:bg-rose-100" : "text-slate-300 hover:text-rose-500 hover:bg-rose-50"}`}
                          title="Desactivar"
                        >
                          <FaTrash size={12} />
                        </button>
                        {selectedOperarioId === op.id && (
                          <FaChevronRight className="text-blue-400" size={12} />
                        )}
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>

        {/* DETALLE DEL OPERARIO */}
        <div className="lg:col-span-2 h-full flex flex-col min-h-0">
          {" "}
          {/* EL CANDADO ACÁ TAMBIÉN */}
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
                className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-[2rem] border border-slate-100 shadow-sm"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <FaUser className="text-3xl text-slate-300" />
                </div>
                <p className="text-lg font-bold text-slate-600 tracking-tight">
                  Selecciona un miembro del equipo
                </p>
                <p className="text-sm font-medium mt-1">
                  Para visualizar sus métricas de rendimiento y actividad.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Renderizado del Modal de Confirmación Global */}
      <AnimatePresence>
        {operarioToDelete && (
          <ConfirmModal
            isOpen={!!operarioToDelete}
            title="¿Desactivar Miembro?"
            message={`Estás a punto de ocultar a ${operarioToDelete.nombre} del sistema. Sus registros históricos se mantendrán, pero no podrá ser asignado a nuevas tareas.`}
            onConfirm={executeEliminar}
            onCancel={() => setOperarioToDelete(null)}
            confirmText="Sí, desactivar"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
