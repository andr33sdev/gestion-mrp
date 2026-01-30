import React, { useState, useEffect } from "react";
import {
  FaClipboardCheck,
  FaPlus,
  FaExclamationCircle,
  FaCheck,
  FaTimes,
  FaPaperPlane,
  FaClock,
  FaUser,
  FaBoxOpen,
  FaTrash,
  FaHistory,
  FaExclamationTriangle,
  FaCheckCircle,
  FaArrowRight,
} from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../utils";
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";
import { getAuthData } from "../auth/authHelper";
import { motion, AnimatePresence } from "framer-motion";

// --- SUB-COMPONENTE MODAL HISTORIAL (Mismo de antes, solo estilos menores) ---
function HistorialModal({ ticket, onClose }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/sugerencias/${ticket.id}/historial`)
      .then((res) => res.json())
      .then(setLogs)
      .catch(console.error);
  }, [ticket]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700 bg-slate-950 flex justify-between items-center">
          <h3 className="font-bold text-white flex items-center gap-2">
            <FaHistory className="text-blue-400" /> Auditoría #{ticket.id}
          </h3>
          <button onClick={onClose}>
            <FaTimes className="text-gray-400 hover:text-white" />
          </button>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <p className="text-sm font-bold text-white mb-1">
              {ticket.mp_nombre}
            </p>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Por: {ticket.solicitante}</span>
              <span>
                {new Date(ticket.fecha_creacion).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="relative border-l-2 border-slate-700 ml-3 space-y-6 pl-6 pb-2">
            {logs.map((log, i) => (
              <div key={i} className="relative">
                <div
                  className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    log.accion === "CREADO"
                      ? "bg-blue-500"
                      : log.accion === "APROBADO"
                        ? "bg-green-500"
                        : log.accion === "SOLICITADO"
                          ? "bg-purple-500"
                          : log.accion === "RECHAZADO"
                            ? "bg-red-500"
                            : "bg-gray-500"
                  }`}
                ></div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wide">
                    {new Date(log.fecha).toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-gray-200">
                    {log.accion}
                  </span>
                  <span className="text-xs text-blue-400 font-medium">
                    {log.usuario}
                  </span>
                  {log.detalle && (
                    <div className="text-xs text-gray-400 mt-1 bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      {log.detalle}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- TARJETA DE TICKET REDISEÑADA ---
const TicketCard = ({ item, isGerencia, onAction, onDelete, onHistory }) => {
  const isUrgent = item.prioridad === "URGENTE";
  const statusColors = {
    PENDIENTE: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    APROBADO: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    SOLICITADO: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    RECHAZADO: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const statusBadge = statusColors[item.estado] || statusColors.PENDIENTE;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onHistory(item)}
      className={`group relative bg-slate-800 rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden flex flex-col h-full hover:shadow-2xl hover:border-slate-600 transition-all duration-300 cursor-pointer ${
        isUrgent ? "ring-1 ring-red-500/30" : ""
      }`}
    >
      {/* Barra superior de estado (Glow sutil) */}
      {isUrgent && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse" />
      )}

      {/* CUERPO PRINCIPAL */}
      <div className="p-5 flex-1 flex flex-col gap-4">
        {/* Header: Título y Badge */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            {isUrgent && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-900/20 px-2 py-0.5 rounded-full mb-2">
                <FaExclamationTriangle /> URGENTE
              </span>
            )}
            <h3
              className="font-bold text-white text-lg leading-snug truncate"
              title={item.mp_nombre}
            >
              {item.mp_nombre}
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {item.mp_codigo}
            </p>
          </div>

          <div
            className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider shrink-0 ${statusBadge}`}
          >
            {item.estado}
          </div>
        </div>

        {/* Datos Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
              Sugerido
            </span>
            <span className="text-xl font-bold text-white block">
              {item.cantidad}
            </span>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
              Stock Actual
            </span>
            <span className="text-xl font-bold text-blue-400 block">
              {item.stock_actual || 0}
            </span>
          </div>
        </div>

        {/* Comentarios & Meta */}
        <div className="mt-1">
          {item.comentario ? (
            <p className="text-sm text-slate-300 italic bg-slate-700/20 p-3 rounded-lg border-l-2 border-slate-600">
              "{item.comentario}"
            </p>
          ) : (
            <p className="text-xs text-slate-600 italic px-2">
              Sin comentarios adicionales.
            </p>
          )}

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-slate-700 rounded-full">
                <FaUser size={10} />
              </div>
              <span className="font-medium truncate max-w-[100px]">
                {item.solicitante}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-slate-700 rounded-full">
                <FaClock size={10} />
              </div>
              <span>{new Date(item.fecha_creacion).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER: ACCIONES (SOLO GERENCIA) */}
      {isGerencia && (
        <div
          className="bg-slate-900/80 p-3 border-t border-slate-700/50 backdrop-blur-sm mt-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {item.estado !== "SOLICITADO" ? (
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              {item.estado === "PENDIENTE" ? (
                <>
                  <button
                    onClick={(e) => onAction(e, item.id, "APROBADO")}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-900/20"
                  >
                    <FaCheck /> Aprobar
                  </button>
                  <button
                    onClick={(e) => onAction(e, item.id, "RECHAZADO")}
                    className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white py-2 rounded-lg text-xs font-bold transition-all"
                  >
                    <FaTimes /> Rechazar
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => onAction(e, item.id, "SOLICITADO")}
                  className="col-span-2 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-purple-900/20"
                >
                  <FaPaperPlane /> Marcar Solicitado
                </button>
              )}

              <button
                onClick={(e) => onDelete(e, item.id)}
                className="w-10 flex items-center justify-center bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 border border-slate-700 hover:border-red-500/50 rounded-lg transition-all"
                title="Eliminar"
              >
                <FaTrash />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-purple-400 text-xs font-bold py-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <FaCheckCircle /> Solicitud en Proceso de Compra
            </div>
          )}
        </div>
      )}

      {/* Tooltip Hover "Ver Historial" */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-700 shadow-xl">
          Click para historial
        </span>
      </div>
    </motion.div>
  );
};

export default function SugerenciasPage() {
  const [sugerencias, setSugerencias] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const { role } = getAuthData();
  const isGerencia = role === "GERENCIA";
  const currentUser = sessionStorage.getItem("user") || role || "Usuario";

  const [form, setForm] = useState({
    mp: null,
    cantidad: "",
    prioridad: "NORMAL",
    comentario: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resSug, resMP] = await Promise.all([
        authFetch(`${API_BASE_URL}/sugerencias`),
        authFetch(`${API_BASE_URL}/ingenieria/materias-primas`),
      ]);
      if (resSug.ok) setSugerencias(await resSug.json());
      if (resMP.ok) setMateriasPrimas(await resMP.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.mp || !form.cantidad) return alert("Faltan datos obligatorios");

    try {
      await authFetch(`${API_BASE_URL}/sugerencias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materia_prima_id: form.mp.id,
          cantidad: form.cantidad,
          prioridad: form.prioridad,
          comentario: form.comentario,
          solicitante: currentUser,
        }),
      });
      setShowModal(false);
      setForm({ mp: null, cantidad: "", prioridad: "NORMAL", comentario: "" });
      fetchData();
    } catch (e) {
      alert("Error al enviar sugerencia");
    }
  };

  const handleEstado = async (e, id, nuevoEstado) => {
    e.stopPropagation();
    if (!confirm(`¿Confirmar cambio a: ${nuevoEstado}?`)) return;
    try {
      await authFetch(`${API_BASE_URL}/sugerencias/${id}/estado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado, usuario: currentUser }),
      });
      fetchData();
    } catch (e) {
      alert("Error");
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar este ticket definitivamente?")) return;
    try {
      await authFetch(`${API_BASE_URL}/sugerencias/${id}`, {
        method: "DELETE",
      });
      fetchData();
    } catch (e) {
      alert("Error");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-20 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <FaClipboardCheck className="text-teal-400" /> Buzón de Sugerencias
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Gestiona necesidades y requerimientos de planta en tiempo real.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full md:w-auto bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-teal-900/30 flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <FaPlus /> Nueva Solicitud
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500 mr-3"></div>{" "}
          Cargando tickets...
        </div>
      ) : sugerencias.length === 0 ? (
        <div className="text-center py-24 bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-700">
          <FaBoxOpen className="text-6xl text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl text-gray-400 font-bold">Todo al día</h3>
          <p className="text-gray-500">
            No hay sugerencias pendientes en este momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          <AnimatePresence>
            {sugerencias.map((item) => (
              <TicketCard
                key={item.id}
                item={item}
                isGerencia={isGerencia}
                onAction={handleEstado}
                onDelete={handleDelete}
                onHistory={setSelectedTicket}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* MODAL CREAR */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
            >
              <div className="p-5 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-white font-bold flex items-center gap-2 text-lg">
                  <FaPlus className="text-teal-400" /> Nueva Solicitud
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                >
                  <FaTimes className="text-gray-400 hover:text-white" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1.5 block ml-1">
                    Producto / Insumo
                  </label>
                  <AutoCompleteInput
                    items={materiasPrimas}
                    onSelect={(mp) => setForm({ ...form, mp })}
                    placeholder="Buscar en inventario..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1.5 block ml-1">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-teal-500 outline-none transition-colors"
                      value={form.cantidad}
                      onChange={(e) =>
                        setForm({ ...form, cantidad: e.target.value })
                      }
                      placeholder="Ej: 10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1.5 block ml-1">
                      Prioridad
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-teal-500 outline-none appearance-none transition-colors"
                        value={form.prioridad}
                        onChange={(e) =>
                          setForm({ ...form, prioridad: e.target.value })
                        }
                      >
                        <option value="NORMAL">Normal</option>
                        <option value="URGENTE">🚨 URGENTE</option>
                      </select>
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500">
                        <FaArrowRight className="rotate-90 text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1.5 block ml-1">
                    Comentario (Opcional)
                  </label>
                  <textarea
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white h-24 resize-none focus:border-teal-500 outline-none transition-colors"
                    placeholder="Detalles adicionales, motivo, etc..."
                    value={form.comentario}
                    onChange={(e) =>
                      setForm({ ...form, comentario: e.target.value })
                    }
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2 transition-all active:scale-[0.98]"
                >
                  Enviar Ticket
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL HISTORIAL */}
      <AnimatePresence>
        {selectedTicket && (
          <HistorialModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
