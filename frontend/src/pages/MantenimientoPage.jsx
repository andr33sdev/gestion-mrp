import React, { useEffect, useState } from "react";
import {
  FaTools,
  FaExclamationCircle,
  FaCheckCircle,
  FaRunning,
  FaPlus,
  FaClock,
  FaUserMd,
  FaTrash,
  FaTimes,
  FaStickyNote,
  FaUser,
} from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../utils";
import { motion, AnimatePresence } from "framer-motion";
import Loader from "../components/Loader";

// --- HELPERS ---
const getTimeDifference = (start, end) => {
  if (!start) return 0;
  const startTime = new Date(start);
  const endTime = end ? new Date(end) : new Date();
  const diffMs = endTime - startTime;
  return Math.max(0, Math.floor(diffMs / 60000));
};

const formatDuration = (minutes) => {
  if (isNaN(minutes) || minutes < 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

// --- COMPONENTES INTERNOS (EXTRAÍDOS PARA RENDIMIENTO) ---

// 1. Tarjeta de Ticket (Ahora recibe 'now' y se actualiza en vivo)
const TicketCard = ({ t, now, onClick, onAttend, onSolve }) => {
  const priorityColor =
    t.prioridad === "ALTA"
      ? "border-l-red-500"
      : t.prioridad === "MEDIA"
      ? "border-l-amber-500"
      : "border-l-blue-500";

  let tiempoRespuesta = 0;
  let tiempoReparacion = 0;

  // Cálculo en vivo usando la prop 'now'
  if (t.estado === "PENDIENTE") {
    tiempoRespuesta = getTimeDifference(t.fecha_creacion, now);
  } else {
    tiempoRespuesta = getTimeDifference(
      t.fecha_creacion,
      t.fecha_inicio_revision
    );
  }

  if (t.estado === "EN_REVISION") {
    tiempoReparacion = getTimeDifference(t.fecha_inicio_revision, now);
  } else if (t.estado === "SOLUCIONADO") {
    tiempoReparacion = getTimeDifference(
      t.fecha_inicio_revision,
      t.fecha_solucion
    );
  }

  return (
    <div
      onClick={() => onClick(t)}
      className={`bg-slate-800 rounded-lg p-3 border-l-4 ${priorityColor} shadow-md mb-3 flex flex-col gap-2 cursor-pointer hover:bg-slate-700 transition-colors group relative`}
    >
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {t.maquina}
        </span>
        <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-gray-500">
          {new Date(t.fecha_creacion).toLocaleDateString()}
        </span>
      </div>

      <div>
        <h4 className="font-bold text-white leading-tight">{t.titulo}</h4>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <FaUser size={8} /> {t.creado_por || "Anónimo"}
        </p>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between items-center text-xs font-mono">
        <div className="flex flex-col">
          <span className="text-[9px] text-gray-500 uppercase">Respuesta</span>
          {/* Aquí usamos el valor calculado dinámicamente */}
          <span
            className={`font-bold ${
              t.estado === "PENDIENTE"
                ? "text-blue-400 animate-pulse"
                : "text-gray-400"
            }`}
          >
            {formatDuration(tiempoRespuesta)}
          </span>
        </div>
        {(t.estado === "EN_REVISION" || t.estado === "SOLUCIONADO") && (
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-gray-500 uppercase">
              Reparación
            </span>
            <span
              className={`font-bold ${
                t.estado === "EN_REVISION"
                  ? "text-amber-400 animate-pulse"
                  : "text-green-400"
              }`}
            >
              {formatDuration(tiempoReparacion)}
            </span>
          </div>
        )}
      </div>

      <div
        className="mt-2 pt-2 border-t border-slate-700/50 flex gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {t.estado === "PENDIENTE" && (
          <button
            onClick={() => onAttend(t.id)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2"
          >
            <FaUserMd /> Atender
          </button>
        )}
        {t.estado === "EN_REVISION" && (
          <button
            onClick={() => onSolve(t)}
            className="w-full bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2"
          >
            <FaCheckCircle /> Solucionar
          </button>
        )}
      </div>
    </div>
  );
};

// --- MODALES (Igual que antes, resumidos aquí) ---
const ReportModal = ({ isOpen, onClose, onSave }) => {
  const [form, setForm] = useState({
    maquina: "Horno 1",
    titulo: "",
    descripcion: "",
    prioridad: "MEDIA",
    tipo: "CORRECTIVO",
    creado_por: "",
  });
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-slate-800 p-6 rounded-2xl w-full max-w-md border border-slate-600 shadow-2xl"
      >
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FaExclamationCircle className="text-red-500" /> Reportar Falla
        </h3>
        <div className="space-y-3">
          <select
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
            value={form.maquina}
            onChange={(e) => setForm({ ...form, maquina: e.target.value })}
          >
            <option>Horno 1</option>
            <option>Horno 2</option>
            <option>Horno 3</option>
            <option>Inyectora</option>
            <option>Extrusora 1</option>
            <option>Extrusora 2</option>
            <option>Extrusora 3</option>
            <option>Infraestructura</option>
          </select>
          <input
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
            placeholder="Título corto"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            autoFocus
          />
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white h-24"
            placeholder="Descripción..."
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
          <input
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
            placeholder="Tu Nombre (Opcional)"
            value={form.creado_por}
            onChange={(e) => setForm({ ...form, creado_por: e.target.value })}
          />
          <div className="flex gap-2">
            <select
              className="w-1/2 bg-slate-900 border border-slate-700 rounded p-2 text-white"
              value={form.prioridad}
              onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
            >
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
            </select>
            <select
              className="w-1/2 bg-slate-900 border border-slate-700 rounded p-2 text-white"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="CORRECTIVO">Rotura</option>
              <option value="PREVENTIVO">Mantenimiento</option>
            </select>
          </div>
          <button
            onClick={() => onSave(form)}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg"
          >
            Enviar Reporte
          </button>
          <button onClick={onClose} className="w-full text-gray-400 py-2">
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SolveModal = ({ ticket, onClose, onSolve }) => {
  const [notas, setNotas] = useState("");
  if (!ticket) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-md border border-slate-600">
        <h3 className="text-xl font-bold text-white mb-2">Cerrar Ticket</h3>
        <textarea
          className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white h-32 mb-4 text-sm"
          placeholder="Solución..."
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          autoFocus
        />
        <button
          onClick={() => onSolve(ticket.id, notas)}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg"
        >
          Guardar
        </button>
        <button onClick={onClose} className="w-full text-gray-400 py-2 mt-2">
          Cancelar
        </button>
      </div>
    </div>
  );
};

const DetailModal = ({ ticket, onClose, onDelete }) => {
  if (!ticket) return null;
  const tResp = ticket.minutos_respuesta_calc
    ? Math.round(ticket.minutos_respuesta_calc)
    : 0;
  const tRep = ticket.minutos_reparacion_calc
    ? Math.round(ticket.minutos_reparacion_calc)
    : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-slate-800 w-full max-w-lg rounded-2xl border border-slate-600 shadow-2xl p-6 space-y-4"
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">
              {ticket.maquina}
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">
              {ticket.titulo}
            </h2>
          </div>
          <button onClick={onClose}>
            <FaTimes className="text-gray-400" />
          </button>
        </div>
        <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-700">
          <p className="text-sm text-gray-300 whitespace-pre-wrap">
            {ticket.descripcion}
          </p>
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
            <FaUser /> Reportado por:{" "}
            <span className="text-gray-300 font-bold">
              {ticket.creado_por || "Anónimo"}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 p-3 rounded border border-slate-700">
            <p className="text-[10px] text-gray-500 uppercase">
              Tiempo Respuesta
            </p>
            <p className="text-xl font-bold text-blue-400">
              {formatDuration(tResp)}
            </p>
          </div>
          <div className="bg-slate-900 p-3 rounded border border-slate-700">
            <p className="text-[10px] text-gray-500 uppercase">
              Tiempo Reparación
            </p>
            <p className="text-xl font-bold text-green-400">
              {formatDuration(tRep)}
            </p>
          </div>
        </div>
        {ticket.estado === "SOLUCIONADO" && (
          <div className="bg-green-900/10 p-3 rounded-lg border border-green-900/30">
            <h4 className="text-xs font-bold text-green-400 mb-1">
              Solución Técnica
            </h4>
            <p className="text-sm text-green-100/80 font-mono">
              {ticket.solucion_notas}
            </p>
            <p className="text-[10px] text-green-500/50 mt-2 text-right">
              Técnico: {ticket.asignado_a}
            </p>
          </div>
        )}
        <div className="pt-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={() => onDelete(ticket.id)}
            className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2 hover:bg-red-900/20 px-3 py-2 rounded transition-colors"
          >
            <FaTrash /> Eliminar Reporte
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function MantenimientoPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [solveTarget, setSolveTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [mttrResponse, setMttrResponse] = useState(0);
  const [mttrRepair, setMttrRepair] = useState(0);

  // RELOJ MAESTRO PARA ACTUALIZAR TARJETAS
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Actualiza el estado 'now' cada 30 segundos
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const loadTickets = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/mantenimiento`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
        const solved = data.filter((t) => t.estado === "SOLUCIONADO");
        if (solved.length > 0) {
          const avgResp =
            solved.reduce(
              (acc, t) => acc + (t.minutos_respuesta_calc || 0),
              0
            ) / solved.length;
          const avgRep =
            solved.reduce(
              (acc, t) => acc + (t.minutos_reparacion_calc || 0),
              0
            ) / solved.length;
          setMttrResponse(Math.round(avgResp));
          setMttrRepair(Math.round(avgRep));
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleCreate = async (form) => {
    setIsReportOpen(false);
    const reporter = form.creado_por.trim() || "Anónimo";
    await authFetch(`${API_BASE_URL}/mantenimiento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, creado_por: reporter }),
    });
    loadTickets();
  };

  const handleAttend = async (id) => {
    if (!confirm("¿Comenzar a revisar esta falla?")) return;
    await authFetch(`${API_BASE_URL}/mantenimiento/${id}/estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nuevo_estado: "EN_REVISION",
        tecnico: "Técnico de Turno",
      }),
    });
    loadTickets();
  };

  const handleSolve = async (id, notas) => {
    setSolveTarget(null);
    await authFetch(`${API_BASE_URL}/mantenimiento/${id}/estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nuevo_estado: "SOLUCIONADO", notas }),
    });
    loadTickets();
  };

  const handleDelete = async (id) => {
    if (!confirm("¡Cuidado! ¿Estás seguro de eliminar este ticket?")) return;
    await authFetch(`${API_BASE_URL}/mantenimiento/${id}`, {
      method: "DELETE",
    });
    setDetailTarget(null);
    loadTickets();
  };

  if (loading) return <Loader />;

  return (
    <div className="animate-in fade-in space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FaTools className="text-orange-500" /> Gestión de Mantenimiento
          </h2>
          <p className="text-xs text-gray-400">Sistema de Tickets</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center px-4 border-r border-slate-600">
            <p className="text-[10px] text-gray-400 uppercase">
              Tiempo Respuesta
            </p>
            <p className="text-xl font-bold text-blue-400">
              {formatDuration(mttrResponse)}
            </p>
          </div>
          <div className="text-center px-4">
            <p className="text-[10px] text-gray-400 uppercase">
              Tiempo Reparación
            </p>
            <p className="text-xl font-bold text-green-400">
              {formatDuration(mttrRepair)}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsReportOpen(true)}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all"
        >
          <FaPlus /> Reportar Falla
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
        <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800 flex flex-col h-full">
          <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
            <FaExclamationCircle /> Pendientes
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {tickets
              .filter((t) => t.estado === "PENDIENTE")
              .map((t) => (
                <TicketCard
                  key={t.id}
                  t={t}
                  now={now}
                  onClick={setDetailTarget}
                  onAttend={handleAttend}
                />
              ))}
          </div>
        </div>
        <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800 flex flex-col h-full">
          <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
            <FaRunning /> En Taller
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {tickets
              .filter((t) => t.estado === "EN_REVISION")
              .map((t) => (
                <TicketCard
                  key={t.id}
                  t={t}
                  now={now}
                  onClick={setDetailTarget}
                  onSolve={setSolveTarget}
                />
              ))}
          </div>
        </div>
        <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800 flex flex-col h-full">
          <h3 className="text-green-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
            <FaCheckCircle /> Historial
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar opacity-70 hover:opacity-100 transition-opacity">
            {tickets
              .filter((t) => t.estado === "SOLUCIONADO")
              .map((t) => (
                <TicketCard
                  key={t.id}
                  t={t}
                  now={now}
                  onClick={setDetailTarget}
                />
              ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isReportOpen && (
          <ReportModal
            isOpen={isReportOpen}
            onClose={() => setIsReportOpen(false)}
            onSave={handleCreate}
          />
        )}
        {solveTarget && (
          <SolveModal
            ticket={solveTarget}
            onClose={() => setSolveTarget(null)}
            onSolve={handleSolve}
          />
        )}
        {detailTarget && (
          <DetailModal
            ticket={detailTarget}
            onClose={() => setDetailTarget(null)}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
