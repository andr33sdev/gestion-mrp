import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  FaTruck,
  FaPlus,
  FaClock,
  FaUser,
  FaTrash,
  FaHistory,
  FaList,
  FaInfoCircle,
  FaCheckDouble,
  FaPaperPlane,
  FaComments,
  FaTimes,
  FaBoxOpen,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaEllipsisV,
  FaEdit,
  FaClipboardCheck,
  FaSpinner,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { API_BASE_URL, authFetch } from "../utils";
import Loader from "../components/Loader";
import { getAuthData } from "../auth/authHelper";
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";

// =========================================================================
// --- HELPERS GLOBALES ---
// =========================================================================
const formatearFechaHora = (fechaIso) => {
  if (!fechaIso) return "-";
  try {
    const normalized = fechaIso.replace(" ", "T");
    const d = new Date(normalized);
    const corr3Horas = 3 * 60 * 60 * 1000;
    const fechaCorregida = new Date(d.getTime() - corr3Horas);

    const dia = String(fechaCorregida.getDate()).padStart(2, "0");
    const mes = String(fechaCorregida.getMonth() + 1).padStart(2, "0");
    const anio = String(fechaCorregida.getFullYear()).slice(-2);
    const hora = String(fechaCorregida.getHours()).padStart(2, "0");
    const minuto = String(fechaCorregida.getMinutes()).padStart(2, "0");

    return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
  } catch (e) {
    return fechaIso;
  }
};

const calcularDiasPreparado = (req) => {
  if (!req || req.estado !== "PREPARADO") return "-";

  // 🔥 SOLUCIÓN: Eliminado fecha_actualizacion para evitar reseteos por entregas parciales
  const fechaOrigen = req.fecha_preparado || req.fecha_creacion;
  if (!fechaOrigen) return "-";
  try {
    const normalized = fechaOrigen.replace(" ", "T");
    const fechaPrep = new Date(normalized);
    const ahora = new Date();

    const diffMs = ahora.getTime() - fechaPrep.getTime();
    if (diffMs <= 0) return "0d y 0h";

    const totalHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const dias = Math.floor(totalHoras / 24);
    const horas = totalHoras % 24;

    return `${dias}d y ${horas}h`;
  } catch (e) {
    return "-";
  }
};

const getIcon = (acc) => {
  if (acc === "CREADO") return <FaPlus size={10} />;
  if (acc === "APROBADO") return <FaCheckCircle size={10} />;
  if (acc === "PREPARADO") return <FaBoxOpen size={10} />;
  if (acc === "ENTREGADO" || acc === "ENTREGA")
    return <FaCheckDouble size={10} />;
  return <FaInfoCircle size={10} />;
};

const getStatusColorTable = (estado) => {
  const s = {
    PENDIENTE: "text-amber-500 bg-amber-50 border-amber-100",
    APROBADO: "text-blue-500 bg-blue-50 border-blue-100",
    PREPARADO: "text-indigo-600 bg-indigo-50 border-indigo-200",
    ENTREGADO: "text-emerald-600 bg-emerald-50 border-emerald-100",
    RECHAZADO: "text-rose-500 bg-rose-50 border-rose-100",
  };
  return s[estado] || s.PENDIENTE;
};

// =========================================================================
// --- COMPONENTE: FILA DE LOGÍSTICA COMPACTA Y SIMÉTRICA ---
// =========================================================================
const LogisticaRow = ({
  req,
  canDelete,
  currentUser,
  esJefeLogistica,
  onOpenDetail,
  onStatusChange,
  onDelete,
  onEdit,
  onEntregaClick,
  openMenuId,
  setOpenMenuId,
}) => {
  const priorityStyles = {
    ALTA: "bg-rose-50 text-rose-500 border-rose-100",
    MEDIA: "bg-amber-50 text-amber-600 border-amber-100",
    BAJA: "bg-slate-50 text-slate-500 border-slate-200",
  };

  const isOpen = openMenuId === req.id;
  const porEntregar = req.solicitado - (req.entregado || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      /* 🔥 SOLUCIÓN: z-50 dinámico y overflow-visible garantizan superposición limpia sobre las filas de abajo */
      className={`relative bg-white rounded-2xl md:rounded-none p-5 md:p-0 border border-stone-100 md:border-b md:border-stone-200/50 shadow-sm md:shadow-none hover:bg-stone-50/60 transition-all duration-200 w-full overflow-visible ${isOpen ? "z-50" : "z-10"}`}
    >
      {/* Indicador de Estado Lateral Izquierdo (Móvil) */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 md:hidden ${req.estado === "APROBADO" ? "bg-blue-500" : req.prioridad === "ALTA" ? "bg-rose-500" : "bg-amber-400"}`}
      />

      {/* 📱 VISTA CELULARES */}
      <div
        className="block md:hidden p-5 pl-4"
        onClick={() => onOpenDetail(req, "CHAT")}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-2 items-center">
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-semibold tracking-wide border ${priorityStyles[req.prioridad]}`}
            >
              {req.prioridad}
            </span>
            <span className="text-[10px] font-bold text-stone-400">
              {formatearFechaHora(req.fecha_creacion)} hs
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${getStatusColorTable(req.estado)}`}
          >
            {req.estado}
          </span>
        </div>

        <h3 className="text-xs font-semibold text-slate-800 mb-1 leading-tight">
          {req.producto}
        </h3>
        <p className="text-[10px] font-bold text-stone-400 mb-4 flex items-center gap-1">
          <FaUser size={8} /> {req.solicitante}
        </p>

        <div className="grid grid-cols-4 gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100 text-center">
          <div>
            <p className="text-[8px] font-bold text-stone-400 uppercase">
              Sol.
            </p>
            <p className="text-xs font-bold text-slate-700">
              {req.solicitado} u.
            </p>
          </div>
          <div>
            <p className="text-[8px] font-bold text-stone-400 uppercase">
              Ent.
            </p>
            <p className="text-xs font-bold text-emerald-600">
              {req.entregado || 0} u.
            </p>
          </div>
          <div>
            <p className="text-[8px] font-bold text-stone-400 uppercase">
              Por Ent.
            </p>
            <p className="text-xs font-semibold text-rose-600">{porEntregar} u.</p>
          </div>
          <div>
            <p className="text-[8px] font-bold text-stone-400 uppercase">
              Días Prep.
            </p>
            <p className="text-[9px] font-bold text-indigo-600 truncate">
              {calcularDiasPreparado(req)}
            </p>
          </div>
        </div>

        <div
          className="absolute right-3 top-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setOpenMenuId(isOpen ? null : req.id)}
            className="p-2 text-stone-400 hover:text-stone-600 bg-stone-50 rounded-lg border border-stone-100"
          >
            <FaEllipsisV size={11} />
          </button>
        </div>
      </div>

      {/* 🖥️ VISTA TABULAR PROFESIONAL: TABLETS Y DESKTOP */}
      <div
        className="hidden md:grid grid-cols-12 items-center gap-2 py-2 px-6 pl-5 text-xs text-slate-600 font-semibold cursor-pointer"
        onClick={() => onOpenDetail(req, "CHAT")}
      >
        {/* Fecha y Prioridad */}
        <div className="col-span-2 flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
            {formatearFechaHora(req.fecha_creacion)} hs
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[8px] font-semibold tracking-wide border w-fit shrink-0 ${priorityStyles[req.prioridad] || priorityStyles.MEDIA}`}
          >
            {req.prioridad}
          </span>
        </div>

        {/* Artículo y Solicitante */}
        <div className="col-span-3 min-w-0 pr-4">
          <h3
            className="font-bold text-slate-800 truncate"
            title={req.producto}
          >
            {req.producto}
          </h3>
          <p className="text-[10px] text-stone-400 font-medium truncate flex items-center gap-1 mt-0.5">
            <FaUser size={8} className="text-stone-300" />
            {req.solicitante}
          </p>
        </div>

        {/* Columnas Numéricas Fijas Simétricas */}
        <div className="col-span-1 text-right font-extrabold text-slate-700 pr-2">
          {req.solicitado} u.
        </div>
        <div className="col-span-1 text-right font-extrabold text-emerald-600 pr-2">
          {req.entregado || 0} u.
        </div>
        <div className="col-span-1 text-right font-semibold text-rose-600 pr-2">
          {porEntregar} u.
        </div>

        {/* Días Prepared */}
        <div className="col-span-1 text-right font-bold text-indigo-500 pr-2 truncate">
          {calcularDiasPreparado(req)}
        </div>

        {/* Estado */}
        <div className="col-span-1 text-center">
          <span
            className={`px-2 py-0.5 rounded-md text-[9px] font-semibold tracking-wide border inline-block w-fit ${getStatusColorTable(req.estado)}`}
          >
            {req.estado}
          </span>
        </div>

        {/* Auditoría */}
        <div className="col-span-1 text-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(req, "TIMELINE");
            }}
            className="text-stone-400 hover:text-slate-800 p-1 rounded-lg transition-colors cursor-pointer"
            title="Ver auditoría"
          >
            <FaHistory size={12} />
          </button>
        </div>

        {/* Acciones */}
        <div
          className="col-span-1 text-right relative pr-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setOpenMenuId(isOpen ? null : req.id)}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition-colors cursor-pointer"
          >
            <FaEllipsisV size={12} />
          </button>
        </div>
      </div>

      {/* MENÚ FLOTANTE ACCIONES RAPIDAS */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpenMenuId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.1 }}
              className="absolute right-4 top-12 md:right-6 md:top-8 w-48 bg-white border border-stone-200 rounded-xl shadow-xl z-50 py-1.5 text-left overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {req.solicitante === currentUser && (
                <button
                  onClick={() => {
                    onEdit(req);
                    setOpenMenuId(null);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50 flex items-center gap-2 cursor-pointer"
                >
                  <FaEdit size={13} /> Editar Solicitud
                </button>
              )}
              {esJefeLogistica && (
                <button
                  onClick={() => {
                    onEntregaClick(req);
                    setOpenMenuId(null);
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
                >
                  <FaClipboardCheck size={13} /> Registrar Entrega
                </button>
              )}
              <div className="h-px bg-stone-100 my-1" />
              {req.estado === "PENDIENTE" && (
                <button
                  onClick={(e) => onStatusChange(e, req.id, "APROBADO")}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-blue-500 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
                >
                  <FaCheckCircle size={13} /> Aprobar Solicitud
                </button>
              )}
              {req.estado !== "PREPARADO" && (
                <button
                  onClick={(e) => onStatusChange(e, req.id, "PREPARADO")}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-indigo-500 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer"
                >
                  <FaBoxOpen size={13} /> Marcar Preparado
                </button>
              )}
              {req.estado === "PENDIENTE" && (
                <button
                  onClick={(e) => onStatusChange(e, req.id, "RECHAZADO")}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                >
                  <FaTimes size={13} /> Rechazar Orden
                </button>
              )}
              {canDelete && (
                <button
                  onClick={(e) => onDelete(e, req.id)}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-stone-400 hover:text-red-500 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                >
                  <FaTrash size={12} /> Eliminar Registro
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function LogisticaPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [filterTerm, setFilterTerm] = useState("");
  const [allSemis, setAllSemis] = useState([]);
  const [resetKey, setResetKey] = useState(0);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPromptEntregaOpen, setIsPromptEntregaOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [historyTimeline, setHistoryTimeline] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState("CHAT");
  const [loadingData, setLoadingData] = useState(false);
  const [entregaInput, setEntregaInput] = useState("");

  const chatEndRef = useRef(null);
  const { user } = getAuthData();
  const rolNormalizado = (user?.rol || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  let currentUser = user?.nombre || "Usuario";
  if (rolNormalizado.includes("GERENCIA")) currentUser = "Andrés";
  else if (
    rolNormalizado.includes("OPERARIO") ||
    rolNormalizado.includes("PANEL") ||
    rolNormalizado.includes("PLANTAS")
  )
    currentUser = "Leonel";
  else if (
    rolNormalizado.includes("DEPOSITO") ||
    rolNormalizado.includes("EXPEDICION")
  )
    currentUser = "Mauro";

  const canDelete =
    ["GERENCIA", "JEFE PRODUCCION", "JEFE PRODUCCIÓN"].includes(
      rolNormalizado,
    ) ||
    rolNormalizado.includes("GERENCIA") ||
    rolNormalizado.includes("PRODUCCION");
  const esJefeLogistica =
    ["GERENCIA", "JEFE PRODUCCION", "JEFE PRODUCCIÓN"].includes(
      rolNormalizado,
    ) ||
    rolNormalizado.includes("GERENCIA") ||
    rolNormalizado.includes("PRODUCCION");

  const [form, setForm] = useState({
    producto: "",
    solicitado: "",
    prioridad: "MEDIA",
    notas: "",
  });

  const loadRequests = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/logistica`);
      if (res.ok) setRequests(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
    const loadSemis = async () => {
      try {
        const res = await authFetch(
          `${API_BASE_URL}/ingenieria/semielaborados`,
        );
        if (res.ok) setAllSemis(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    loadSemis();
    const interval = setInterval(loadRequests, 12000);
    return () => clearInterval(interval);
  }, []);

  const openDetailModal = (req, tab = "TIMELINE") => {
    setSelectedRequest(req);
    setActiveTab(tab);
    setIsDetailModalOpen(true);
    loadRequestDetails(req);
  };

  const loadRequestDetails = async (req) => {
    setLoadingData(true);
    try {
      const [resHist, resComm] = await Promise.all([
        authFetch(`${API_BASE_URL}/logistica/${req.id}/historial`),
        authFetch(`${API_BASE_URL}/logistica/${req.id}/comentarios`),
      ]);
      let logs = resHist.ok ? await resHist.json() : [];
      let comms = resComm.ok ? await resComm.json() : [];

      const ev = {
        id: "genesis",
        accion: "CREADO",
        usuario: req.solicitante || "Sistema",
        detalle: `Solicitud iniciada. Solicitado: ${req.solicitado} u.`,
        fecha: req.fecha_creacion,
        esOriginal: true,
      };
      setHistoryTimeline(
        [ev, ...logs.filter((l) => l.accion !== "CREADO")].sort(
          (a, b) => new Date(a.fecha) - new Date(b.fecha),
        ),
      );
      setComments(comms);
    } catch (e) {
      console.error(e);
    }
    setLoadingData(false);
  };

  const handleOpenEditModal = (req) => {
    setEditingRequest(req);
    setForm({
      producto: req.producto,
      solicitado: req.solicitado,
      prioridad: req.prioridad,
      notas: req.notes || "",
    });
    setIsNewModalOpen(true);
  };

  const handleOpenEntregaModal = (req) => {
    setSelectedRequest(req);
    setEntregaInput(req.entregado || "0");
    setIsPromptEntregaOpen(true);
  };

  const ejecutarEntregaUnitario = async () => {
    if (!entregaInput || isNaN(entregaInput))
      return toast.error("Ingresa una cantidad válida");
    if (parseInt(entregaInput) > selectedRequest.solicitado)
      return toast.error(
        "La cantidad entregada no puede superar la solicitada",
      );

    setSubmitting(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/logistica/${selectedRequest.id}/entregado`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entregado: entregaInput,
            usuario: currentUser,
          }),
        },
      );
      if (res.ok) {
        toast.success("Despacho registrado correctamente");
        setIsPromptEntregaOpen(false);
        loadRequests();
      }
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producto || !form.solicitado)
      return toast.error("Completa el producto y la cantidad solicitada.");

    const toastId = toast.loading(
      editingRequest ? "Guardando cambios..." : "Enviando solicitud...",
    );
    try {
      const url = editingRequest
        ? `${API_BASE_URL}/logistica/${editingRequest.id}`
        : `${API_BASE_URL}/logistica`;
      await authFetch(url, {
        method: editingRequest ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          usuario: currentUser,
          solicitante: editingRequest
            ? editingRequest.solicitante
            : currentUser,
        }),
      });

      setForm({ producto: "", solicitado: "", prioridad: "MEDIA", notas: "" });
      setEditingRequest(null);
      setResetKey((p) => p + 1);
      setIsNewModalOpen(false);
      loadRequests();
      toast.success(
        editingRequest ? "Solicitud modificada" : "Solicitud creada",
        { id: toastId },
      );
    } catch (e) {
      toast.error("Error al procesar", { id: toastId });
    }
  };

  const handleStatusChange = async (e, id, newStatus) => {
    if (e) e.stopPropagation();
    await authFetch(`${API_BASE_URL}/logistica/${id}/estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: newStatus, usuario: currentUser }),
    });
    toast.success(`Estado actualizado a ${newStatus}`);
    loadRequests();
  };

  const handleDelete = async (e, id) => {
    if (e) e.stopPropagation();
    if (!confirm("¿Eliminar solicitud definitivamente?")) return;
    await authFetch(`${API_BASE_URL}/logistica/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: currentUser }),
    });
    toast.success("Solicitud eliminada");
    loadRequests();
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setNewComment("");
    await authFetch(
      `${API_BASE_URL}/logistica/${selectedRequest.id}/comentarios`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: currentUser, mensaje: newComment }),
      },
    );
    loadRequestDetails(selectedRequest);
  };

  const activeRequests = useMemo(() => {
    return requests.filter(
      (r) =>
        ["PENDIENTE", "APROBADO", "PREPARADO"].includes(r.estado) &&
        r.producto.toLowerCase().includes(filterTerm.toLowerCase()),
    );
  }, [requests, filterTerm]);

  const totalPages = Math.ceil(activeRequests.length / itemsPerPage) || 1;
  const currentItems = activeRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div
      className="min-h-full bg-[#fcfbf9] p-4 md:p-8 flex flex-col font-sans animate-in fade-in pb-16"
      onClick={() => setOpenMenuId(null)}
    >
      {/* HEADER DE ACCIONES MAESTRO */}
      <header className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 mb-6 shrink-0 md:pr-12">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 border border-blue-700 flex items-center justify-center text-white shadow-md shrink-0">
            <FaTruck size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight leading-none mb-1">
              Logística Interna
            </h1>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
              Panel de Movimientos Activos en Planta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setIsDetailModalOpen(true);
              setSelectedRequest(null);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 bg-white hover:bg-stone-50 text-stone-600 border border-stone-200 font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <FaHistory size={12} className="text-stone-400" /> HISTORIAL GENERAL
          </button>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <FaPlus size={10} /> CREAR SOLICITUD
          </button>
        </div>
      </header>

      {/* BUSCADOR DE ENTRADAS LOCAL */}
      <div className="relative mb-4 max-w-md shrink-0">
        <FaSearch className="absolute left-4 top-4 text-stone-300" size={13} />
        <input
          type="text"
          placeholder="Filtrar tabla por semielaborado..."
          className="w-full bg-white border border-stone-200 rounded-xl py-3.5 pl-11 pr-4 text-xs font-bold outline-none shadow-sm"
          value={filterTerm}
          onChange={(e) => {
            setFilterTerm(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* CONTENEDOR DE TABLA CONTINUO */}
      {/* 🔥 SOLUCIÓN: overflow-visible habilitado para que los menús flotantes se desplieguen sin recortes */}
      <div className="bg-white border border-stone-100 rounded-3xl overflow-visible shadow-sm flex flex-col h-auto shrink-0">
        {loading ? (
          <div className="p-16 flex items-center justify-center">
            <Loader />
          </div>
        ) : currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <FaClipboardList size={32} className="mb-2 opacity-60" />
            <p className="text-xs font-bold">
              No se registran solicitudes de transporte en este bloque
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col">
            {/* Encabezado Superior con Grid Sincronizado */}
            <div className="hidden md:grid grid-cols-12 items-center gap-2 px-6 py-2.5 text-[9px] font-semibold uppercase tracking-widest text-stone-400 border-b border-stone-100 bg-stone-50/70 rounded-t-3xl">
              <div className="col-span-2">Fecha / Prioridad</div>
              <div className="col-span-3">Artículo / Solicitante</div>
              <div className="col-span-1 text-right pr-2">Solicitado</div>
              <div className="col-span-1 text-right pr-2">Entregado</div>
              <div className="col-span-1 text-right pr-2">Por Entregar</div>
              <div className="col-span-1 text-right pr-2">Días Preparado</div>
              <div className="col-span-1 text-center">Estado</div>
              <div className="col-span-1 text-center">Auditoría</div>
              <div className="col-span-1 text-right pr-2">Acción</div>
            </div>

            {/* Listado de Filas Continuo */}
            <div className="flex flex-col md:divide-y md:divide-stone-100/70 gap-3 md:gap-0 p-2 md:p-0">
              <AnimatePresence mode="popLayout">
                {currentItems.map((req) => (
                  <LogisticaRow
                    key={req.id}
                    req={req}
                    canDelete={canDelete}
                    currentUser={currentUser}
                    esJefeLogistica={esJefeLogistica}
                    onOpenDetail={openDetailModal}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                    onEdit={handleOpenEditModal}
                    onEntregaClick={handleOpenEntregaModal}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* PAGINACIÓN */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-stone-100 bg-stone-50/50 flex justify-center items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-2 border rounded-lg bg-white disabled:opacity-40 cursor-pointer"
            >
              <FaChevronLeft size={10} />
            </button>
            <span className="text-xs font-bold text-stone-500">
              Página {currentPage} de {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 border rounded-lg bg-white disabled:opacity-40 cursor-pointer"
            >
              <FaChevronRight size={10} />
            </button>
          </div>
        )}
      </div>

      {/* --- MODAL CREAR O EDITAR --- */}
      <AnimatePresence>
        {isNewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl flex flex-col relative overflow-visible"
            >
              <div className="p-6 md:p-8 border-b border-stone-100 flex justify-between items-center bg-[#fcfbf9] rounded-t-[2rem]">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2.5 bg-[#e3f2fd] text-[#2196f3] rounded-xl">
                    {editingRequest ? (
                      <FaEdit size={14} />
                    ) : (
                      <FaPlus size={14} />
                    )}
                  </div>
                  {editingRequest ? "Editar Solicitud" : "Crear Solicitud"}
                </h3>
                <button
                  onClick={() => {
                    setIsNewModalOpen(false);
                    setEditingRequest(null);
                    setForm({
                      producto: "",
                      solicitado: "",
                      prioridad: "MEDIA",
                      notas: "",
                    });
                    setResetKey((p) => p + 1);
                  }}
                  className="text-stone-400 hover:text-slate-800 bg-white border border-stone-200 p-2.5 rounded-full shadow-sm cursor-pointer"
                >
                  <FaTimes size={14} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                <div className="space-y-1.5 relative z-[100]">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 pl-1 block">
                    Producto Semielaborado a mover
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-stone-300 z-10">
                      <FaSearch size={12} />
                    </div>
                    <div className="[&_input]:w-full [&_input]:bg-stone-50 hover:[&_input]:bg-stone-100 [&_input]:border [&_input]:border-transparent [&_input]:rounded-xl [&_input]:py-3.5 [&_input]:pl-11 [&_input]:pr-4 [&_input]:text-sm [&_input]:font-bold focus-within:[&_input]:border-[#bbdefb] focus-within:[&_input]:bg-white focus-within:[&_input]:ring-4 focus-within:[&_input]:ring-[#e3f2fd] [&_input]:transition-all [&_input]:outline-none">
                      <AutoCompleteInput
                        key={resetKey}
                        items={allSemis}
                        value={form.producto}
                        onChange={(val) => setForm({ ...form, producto: val })}
                        onSelect={(item) =>
                          setForm({ ...form, producto: item.nombre })
                        }
                        placeholder="Buscar por nombre o código..."
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5 relative z-10">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 pl-1 block">
                      Cantidad Solicitada (u.)
                    </label>
                    <input
                      type="number"
                      placeholder="Ej. 150"
                      className="w-full bg-stone-50 border border-transparent rounded-xl p-3.5 text-sm font-bold focus:border-[#bbdefb] focus:bg-white focus:ring-4 focus:ring-[#e3f2fd] outline-none transition-all"
                      value={form.solicitado}
                      onChange={(e) =>
                        setForm({ ...form, solicitado: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 pl-1 block">
                      Prioridad
                    </label>
                    <select
                      className="w-full bg-stone-50 border border-transparent rounded-xl p-3.5 text-sm font-bold focus:border-[#bbdefb] focus:bg-white focus:ring-4 focus:ring-[#e3f2fd] outline-none transition-all cursor-pointer appearance-none"
                      value={form.prioridad}
                      onChange={(e) =>
                        setForm({ ...form, prioridad: e.target.value })
                      }
                    >
                      <option value="BAJA">Baja - Rutina</option>{" "}
                      <option value="MEDIA">Media - Normal</option>{" "}
                      <option value="ALTA">Alta - Urgente</option>
                    </select>
                  </div>
                </div>
                <div className="pt-2 relative z-10">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-[#2196f3] text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 text-sm cursor-pointer"
                  >
                    <FaPaperPlane size={12} />
                    {editingRequest
                      ? "Guardar Cambios"
                      : "Solicitar Movimiento"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL PROMPT: REGISTRAR UNIDADES ENTREGADAS --- */}
      <AnimatePresence>
        {isPromptEntregaOpen && selectedRequest && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 border border-stone-100"
            >
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                Despacho / Entrega Logística
              </h3>
              <p className="text-[11px] font-semibold text-stone-400 leading-relaxed mb-4">
                Registra la cantidad física acumulada que ya fue entregada de
                esta orden. La diferencia por entregar se recalculará
                automáticamente.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-semibold uppercase text-stone-400 block mb-1">
                    Unidades Totales Entregadas
                  </label>
                  <input
                    type="number"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs font-bold outline-none"
                    value={entregaInput}
                    onChange={(e) => setEntregaInput(e.target.value)}
                    placeholder="Cantidad..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setIsPromptEntregaOpen(false)}
                    className="flex-1 bg-stone-100 text-slate-600 font-bold text-xs py-3 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={ejecutarEntregaUnitario}
                    className="flex-1 bg-emerald-500 text-white font-semibold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      "Confirmar Entrega"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL HISTORIAL GLOBAL / DETALLE --- */}
      <AnimatePresence>
        {isDetailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-[1200px] h-[85vh] md:h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-stone-100"
            >
              <div className="p-6 border-b border-stone-100 bg-[#fcfbf9] flex justify-between items-center shrink-0">
                <h3 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2.5 bg-white border border-stone-200 text-stone-600 rounded-xl shadow-sm">
                    <FaHistory size={16} />
                  </div>
                  Historial y Auditoría
                </h3>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedRequest(null);
                  }}
                  className="text-stone-400 hover:text-slate-800 bg-white border border-stone-200 p-2.5 rounded-full shadow-sm cursor-pointer"
                >
                  <FaTimes size={14} />
                </button>
              </div>
              <div className="flex flex-1 overflow-hidden flex-col md:flex-row bg-[#fcfbf9]">
                <div
                  className={`${selectedRequest ? "hidden md:flex" : "flex"} flex-col w-full md:w-[420px] border-r border-stone-100 bg-white`}
                >
                  <div className="overflow-y-auto custom-scrollbar flex-1 p-4 space-y-2">
                    {requests.map((req) => (
                      <div
                        key={req.id}
                        onClick={() => openDetailModal(req)}
                        className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedRequest?.id === req.id ? "bg-[#fafaf8] border-blue-200 shadow-sm ring-2 ring-blue-50" : "bg-white border-stone-100 hover:border-stone-300"}`}
                      >
                        <div className="flex justify-between items-start mb-2.5">
                          <span className="text-[10px] text-stone-400 font-bold flex items-center gap-1.5">
                            <FaClock size={9} />{" "}
                            {formatearFechaHora(req.fecha_creacion)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border ${getStatusColorTable(req.estado)}`}
                          >
                            {req.estado}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-700 truncate leading-snug">
                          {req.producto}
                        </h4>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[10px] font-medium text-stone-400 flex items-center gap-1.5">
                            <FaUser size={9} /> {req.solicitante}
                          </span>
                          <span className="text-xs font-bold text-slate-600 bg-stone-50 px-2.5 py-0.5 rounded-lg border border-stone-100">
                            {req.solicitado} u.
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className={`${!selectedRequest ? "hidden md:flex" : "flex"} flex-1 flex-col relative bg-[#fcfbf9]`}
                >
                  {!selectedRequest ? (
                    <div className="h-full flex flex-col items-center justify-center text-stone-400 p-8 text-center">
                      <div className="w-20 h-20 rounded-full bg-white border border-stone-100 flex items-center justify-center mb-6 shadow-sm">
                        <FaList size={28} />
                      </div>
                      <h3 className="text-base font-bold text-slate-600">
                        Historial General
                      </h3>
                      <p className="text-sm font-medium text-stone-400 mt-2 max-w-[250px]">
                        Selecciona una solicitud de la lista para ver su
                        recorrido completo y notas de seguimiento.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="p-6 md:p-8 border-b border-stone-100 bg-white flex flex-col md:flex-row justify-between md:items-center gap-5 shrink-0 z-10 shadow-sm">
                        <div>
                          <button
                            onClick={() => setSelectedRequest(null)}
                            className="md:hidden text-[#2196f3] text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"
                          >
                            <FaChevronLeft size={8} /> Volver a la lista
                          </button>
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                              ID: {selectedRequest.id}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border ${getStatusColorTable(selectedRequest.estado)}`}
                            >
                              {selectedRequest.estado}
                            </span>
                          </div>
                          <h4 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">
                            {selectedRequest.producto}{" "}
                            <span className="text-[#2196f3]">
                              ({selectedRequest.solicitado} u.)
                            </span>
                          </h4>
                        </div>
                        <div className="flex bg-stone-50 rounded-xl p-1.5 border border-stone-200 shrink-0">
                          <button
                            onClick={() => setActiveTab("TIMELINE")}
                            className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === "TIMELINE" ? "bg-white text-slate-700 shadow-sm" : "text-stone-400 hover:text-stone-600"}`}
                          >
                            Recorrido
                          </button>
                          <button
                            onClick={() => setActiveTab("CHAT")}
                            className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === "CHAT" ? "bg-white text-[#2196f3] shadow-sm" : "text-stone-400 hover:text-stone-600"}`}
                          >
                            <FaComments size={12} /> Notas
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                        {loadingData ? (
                          <div className="flex justify-center items-center h-full">
                            <Loader />
                          </div>
                        ) : activeTab === "TIMELINE" ? (
                          <div className="p-8 md:p-12">
                            <div className="relative border-l-2 border-stone-200 ml-6 space-y-10 pl-10">
                              {historyTimeline.map((log, i) => (
                                <div key={i} className="relative">
                                  <div
                                    className={`absolute -left-[51px] top-0 h-10 w-10 rounded-full border-4 border-[#fcfbf9] flex items-center justify-center shadow-sm ${log.esOriginal ? "bg-[#e3f2fd] text-[#2196f3]" : "bg-white text-stone-400"}`}
                                  >
                                    {getIcon(log.accion)}
                                  </div>
                                  <div className="flex flex-col bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">
                                        {log.accion}
                                      </span>
                                      <span className="text-[10px] font-medium text-stone-400 bg-stone-50/75 px-2.5 py-1 rounded-lg">
                                        {formatearFechaHora(log.fecha)} hs
                                      </span>
                                    </div>
                                    <p className="text-sm text-stone-600 font-medium leading-relaxed">
                                      {log.detalle}
                                    </p>
                                    <div className="mt-4 pt-4 border-t border-stone-50 flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                      <FaUser size={10} /> {log.usuario}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col h-full">
                            <div className="flex-1 p-6 md:p-8 space-y-6">
                              {comments.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-stone-300">
                                  <FaComments
                                    size={32}
                                    className="mb-4 opacity-50"
                                  />
                                  <p className="text-sm font-bold text-stone-400">
                                    Sin anotaciones aún.
                                  </p>
                                </div>
                              )}
                              {comments.map((msg, i) => {
                                const isMe = msg.usuario === currentUser;
                                return (
                                  <div
                                    key={i}
                                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                                  >
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1.5 px-2">
                                      {msg.usuario}
                                    </span>
                                    <div
                                      className={`max-w-[85%] px-5 py-3.5 text-sm font-medium shadow-sm ${isMe ? "bg-[#2196f3] text-white rounded-[20px] rounded-tr-sm" : "bg-white border border-stone-200 text-slate-700 rounded-[20px] rounded-tl-sm"}`}
                                    >
                                      <p className="leading-relaxed">
                                        {msg.mensaje}
                                      </p>
                                    </div>
                                    <span className="text-[9px] font-medium text-stone-400 mt-1.5 px-2">
                                      <FaClock
                                        size={8}
                                        className="inline mr-1 text-stone-300"
                                      />
                                      {
                                        formatearFechaHora(msg.fecha).split(
                                          " ",
                                        )[1]
                                      }{" "}
                                      hs
                                    </span>
                                  </div>
                                );
                              })}
                              <div ref={chatEndRef} />
                            </div>
                          </div>
                        )}
                      </div>

                      {activeTab === "CHAT" && (
                        <form
                          onSubmit={handleSendComment}
                          className="p-5 bg-white border-t border-stone-100 flex gap-3 shrink-0 relative z-20"
                        >
                          <input
                            className="flex-1 bg-stone-50 border border-transparent focus:border-[#bbdefb] focus:bg-white focus:ring-4 focus:ring-[#e3f2fd] rounded-xl px-5 py-3.5 text-sm font-semibold text-slate-700 outline-none shadow-sm"
                            placeholder="Escribir una anotación o directiva..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                          />
                          <button
                            type="submit"
                            disabled={!newComment.trim()}
                            className="bg-[#2196f3] text-white p-4 rounded-xl shadow-md flex items-center justify-center w-14 cursor-pointer"
                          >
                            <FaPaperPlane size={14} />
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
