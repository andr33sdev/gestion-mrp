import { useEffect, useState } from "react";
import {
  FaUsersCog,
  FaUserPlus,
  FaTrash,
  FaSpinner,
  FaUser,
  FaChartBar,
  FaBoxOpen,
  FaHistory,
  FaChevronRight,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../utils";

const API_URL = `${API_BASE_URL}/operarios`;

// --- Componente de Detalle de Estadísticas ---
function OperarioDetalle({ operarioId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!operarioId) return;

    const fetchStats = async () => {
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
    };

    fetchStats();
  }, [operarioId]);

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

  return (
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

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600">
          <h3 className="text-sm font-bold text-gray-400">Unidades Totales</h3>
          <p className="text-4xl font-bold text-blue-300">
            {stats.totalUnidades}
          </p>
        </div>
        <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600">
          <h3 className="text-sm font-bold text-gray-400">Producto Top</h3>
          <p
            className="text-2xl font-bold text-white truncate"
            title={stats.topProducto?.nombre || "N/A"}
          >
            {stats.topProducto?.nombre || "N/A"}
          </p>
          <p className="text-sm text-gray-400">
            ({stats.topProducto?.total || 0} unidades)
          </p>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <FaHistory /> Actividad Reciente
      </h3>
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/50 p-3 rounded-lg border border-slate-700">
        <ul className="divide-y divide-slate-700">
          {stats.actividadReciente.length === 0 ? (
            <li className="p-3 text-sm text-gray-500 text-center">
              Sin actividad reciente.
            </li>
          ) : (
            stats.actividadReciente.map((act, i) => (
              <li key={i} className="p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-white">{act.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(act.fecha_produccion).toLocaleString("es-AR")}
                  </p>
                </div>
                <span className="font-bold text-lg text-blue-300">
                  +{act.cantidad}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </motion.div>
  );
}

// --- Página Principal (Master/Detail) ---
export default function OperariosPage() {
  const [operarios, setOperarios] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", msg: "" });

  // --- NUEVO ESTADO ---
  const [selectedOperarioId, setSelectedOperarioId] = useState(null);

  useEffect(() => {
    const cargarOperarios = async () => {
      try {
        setLoading(true);
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("No se pudo cargar la lista");
        const data = await res.json();
        setOperarios(data);
        // Seleccionar el primer operario por defecto
        if (data.length > 0) {
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
      setSelectedOperarioId(data.id); // Seleccionar el nuevo
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

      setOperarios(operarios.filter((op) => op.id !== id));
      setFeedback({ type: "success", msg: data.msg });
      // Si el operario eliminado era el seleccionado, des-seleccionar
      if (selectedOperarioId === id) {
        setSelectedOperarioId(operarios.length > 1 ? operarios[0].id : null);
      }
    } catch (err) {
      setFeedback({ type: "error", msg: err.message });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto" // <-- Ampliado
    >
      <div className="flex items-center gap-4 mb-6">
        <FaUsersCog className="text-4xl text-purple-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">Panel de Operarios</h1>
          <p className="text-gray-400">
            Administra operarios y consulta sus métricas de producción.
          </p>
        </div>
      </div>

      {/* Layout de 2 Columnas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
        {/* --- COLUMNA IZQUIERDA: LISTA Y FORMULARIO --- */}
        <div className="md:col-span-1 bg-slate-800 border border-slate-700 rounded-xl shadow-lg flex flex-col overflow-hidden">
          {/* Formulario para añadir */}
          <form
            onSubmit={handleAgregar}
            className="p-4 border-b border-slate-700 flex items-center gap-2"
          >
            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nuevo Operario..."
              className="flex-grow bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:border-blue-500"
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

          {/* Feedback */}
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

          {/* Lista de Operarios */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-10 text-center text-gray-500">
                <FaSpinner className="animate-spin inline-block" />
              </div>
            ) : (
              <ul className="divide-y divide-slate-700">
                <AnimatePresence>
                  {operarios.length === 0 && (
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
                      exit={{
                        opacity: 0,
                        x: 50,
                        transition: { duration: 0.2 },
                      }}
                      className={`flex justify-between items-center p-4 cursor-pointer transition-colors ${
                        selectedOperarioId === op.id
                          ? "bg-blue-600/30"
                          : "hover:bg-slate-700/50"
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
                      <div className="flex items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Evitar que el clic seleccione al operario
                            handleEliminar(op.id);
                          }}
                          className="text-gray-600 hover:text-red-400 p-2 transition-colors"
                          title="Desactivar Operario"
                        >
                          <FaTrash />
                        </button>
                        {selectedOperarioId === op.id && (
                          <FaChevronRight className="text-blue-400" />
                        )}
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>

        {/* --- COLUMNA DERECHA: DETALLE Y MÉTRICAS --- */}
        <div className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
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
                <FaUser className="text-6xl mb-4" />
                <p className="text-lg">Selecciona un operario</p>
                <p className="text-sm">para ver sus estadísticas.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
