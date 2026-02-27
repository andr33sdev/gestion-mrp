import React, { useEffect, useState, useRef } from "react";
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
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { API_BASE_URL, authFetch } from "../utils";
import Loader from "../components/Loader";
import { getAuthData } from "../auth/authHelper";

import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";

// --- HELPER DE FECHAS ---
const formatearFechaHora = (fechaIso) => {
  if (!fechaIso) return "-";
  try {
    const d = new Date(fechaIso);
    const offsetArg = 3 * 60 * 60 * 1000;
    const fechaArg = new Date(d.getTime() - offsetArg);
    return (
      fechaArg.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) + " hs"
    );
  } catch (e) {
    return fechaIso;
  }
};

// --- COMPONENTE: FILA DE LOGÍSTICA CON MENÚ DE 3 PUNTITOS ---
const LogisticaRow = ({
  req,
  isBoss,
  onOpenDetail,
  onStatusChange,
  onDelete,
  openMenuId,
  setOpenMenuId,
}) => {
  const priorityStyles = {
    ALTA: { bg: "bg-[#ffebee]", text: "text-[#ef5350]" },
    MEDIA: { bg: "bg-[#fff8e1]", text: "text-[#fbc02d]" },
    BAJA: { bg: "bg-[#e3f2fd]", text: "text-[#42a5f5]" },
  };

  const statusStyles = {
    PENDIENTE: {
      bg: "bg-stone-100",
      text: "text-stone-500",
      border: "border-stone-200",
    },
    APROBADO: {
      bg: "bg-[#e3f2fd]",
      text: "text-[#2196f3]",
      border: "border-[#bbdefb]",
    },
    PREPARADO: {
      bg: "bg-indigo-50",
      text: "text-indigo-500",
      border: "border-indigo-100",
    },
  };

  const pStyle = priorityStyles[req.prioridad] || priorityStyles.MEDIA;
  const sStyle = statusStyles[req.estado] || statusStyles.PENDIENTE;

  const leftBorderColor =
    req.estado === "PENDIENTE" && req.prioridad === "ALTA"
      ? "bg-red-400"
      : req.estado === "PENDIENTE"
        ? "bg-stone-300"
        : req.estado === "APROBADO"
          ? "bg-[#42a5f5]"
          : "bg-indigo-400";

  const isOpen = openMenuId === req.id;

  const toggleMenu = (e) => {
    e.stopPropagation();
    setOpenMenuId(isOpen ? null : req.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      onClick={() => onOpenDetail(req, "CHAT")}
      className="relative bg-white rounded-2xl md:rounded-xl p-5 md:py-4 md:px-6 border border-stone-100 shadow-sm hover:shadow-[0_4px_15px_-3px_rgba(0,0,0,0.05)] hover:border-stone-200 transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 cursor-pointer w-full"
    >
      {/* Tira de color lateral ultra fina */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl md:rounded-l-xl transition-colors duration-500 ${leftBorderColor}`}
      />

      {/* 1. Fecha y Prioridad */}
      <div className="w-full md:w-36 shrink-0 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-start pl-2 md:pl-0 pr-6 md:pr-0">
        <div className="flex flex-col md:gap-1.5">
          <span
            className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest w-fit ${pStyle.bg} ${pStyle.text}`}
          >
            {req.prioridad}
          </span>
        </div>
        <span className="text-[10px] font-medium text-stone-400 flex items-center gap-1.5 md:mt-1.5">
          <FaClock size={10} className="text-stone-300" />
          {formatearFechaHora(req.fecha_creacion).split(" ")[0]}{" "}
          <span className="hidden md:inline">
            {formatearFechaHora(req.fecha_creacion).split(" ")[1]}
          </span>
        </span>
      </div>

      {/* 2. Producto y Solicitante */}
      <div className="flex-1 min-w-0 pl-2 md:pl-0 flex flex-col justify-center border-t border-stone-50 md:border-0 pt-3 md:pt-0">
        <h3 className="text-[14px] font-bold text-slate-800 leading-snug truncate group-hover:text-[#2196f3] transition-colors">
          {req.producto}
        </h3>
        <span className="text-[10px] font-medium text-stone-400 flex items-center gap-1.5 mt-1">
          <FaUser size={10} className="text-stone-300 shrink-0" />{" "}
          {req.solicitante}
        </span>
      </div>

      {/* 3. Cantidad */}
      <div className="w-full md:w-28 shrink-0 flex justify-between md:justify-end items-center pl-2 md:pl-0 md:pr-4">
        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 md:hidden">
          Cantidad
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-700 leading-none">
            {req.cantidad}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">
            u.
          </span>
        </div>
      </div>

      {/* 4. Estado */}
      <div className="w-full md:w-36 shrink-0 flex justify-between md:justify-start items-center pl-2 md:pl-4 mt-2 md:mt-0 pt-3 md:pt-0 border-t border-stone-50 md:border-0">
        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 md:hidden">
          Estado Actual
        </span>
        <span
          className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${sStyle.bg} ${sStyle.text} ${sStyle.border}`}
        >
          {req.estado}
        </span>
      </div>

      {/* 5. Acciones (Menú 3 Puntos) */}
      <div
        className="absolute right-4 top-4 md:relative md:right-0 md:top-0 md:w-16 shrink-0 flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={toggleMenu}
          className={`p-2.5 rounded-xl transition-colors ${isOpen ? "bg-stone-100 text-slate-800" : "text-stone-400 hover:text-stone-600 bg-stone-50 md:bg-transparent hover:bg-stone-100"}`}
        >
          <FaEllipsisV size={14} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              {/* Fondo invisible para cerrar al hacer clic afuera */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpenMenuId(null)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-stone-100 z-50 py-2 overflow-hidden"
              >
                <div className="px-4 py-2 border-b border-stone-50 mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                    Acciones Disponibles
                  </span>
                </div>

                {isBoss ? (
                  <>
                    {/* Botones si es Jefe/Gerente */}
                    {req.estado === "PENDIENTE" && (
                      <>
                        <button
                          onClick={(e) => {
                            onStatusChange(e, req.id, "APROBADO");
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-3 text-xs font-bold text-[#2196f3] hover:bg-[#e3f2fd] flex items-center gap-3 transition-colors"
                        >
                          <FaCheckCircle size={14} /> Aprobar Solicitud
                        </button>
                        <button
                          onClick={(e) => {
                            onStatusChange(e, req.id, "RECHAZADO");
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors"
                        >
                          <FaTimes size={14} /> Rechazar Solicitud
                        </button>
                      </>
                    )}

                    {req.estado === "APROBADO" && (
                      <button
                        onClick={(e) => {
                          onStatusChange(e, req.id, "PREPARADO");
                          setOpenMenuId(null);
                        }}
                        className="w-full text-left px-4 py-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-3 transition-colors"
                      >
                        <FaBoxOpen size={14} /> Marcar como Preparado
                      </button>
                    )}

                    {req.estado === "PREPARADO" && (
                      <button
                        onClick={(e) => {
                          onStatusChange(e, req.id, "ENTREGADO");
                          setOpenMenuId(null);
                        }}
                        className="w-full text-left px-4 py-3 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 transition-colors"
                      >
                        <FaCheckDouble size={14} /> Marcar como Entregado
                      </button>
                    )}
                  </>
                ) : (
                  <div className="px-4 py-3 text-xs text-stone-400 font-medium italic">
                    Sin permisos de edición.
                  </div>
                )}

                <div className="h-px bg-stone-100 my-1 mx-2" />

                <button
                  onClick={(e) => {
                    onDelete(e, req.id);
                    setOpenMenuId(null);
                  }}
                  className="w-full text-left px-4 py-3 text-xs font-bold text-stone-500 hover:text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors"
                >
                  <FaTrash size={12} /> Eliminar Registro
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default function LogisticaPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // --- BUSCADOR PREDICTIVO ---
  const [allSemis, setAllSemis] = useState([]);
  const [resetKey, setResetKey] = useState(0);

  // --- ESTADO PARA MENÚ DE 3 PUNTITOS ---
  const [openMenuId, setOpenMenuId] = useState(null);

  // Modales
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Datos Detalle
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [historyTimeline, setHistoryTimeline] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState("CHAT");
  const [loadingData, setLoadingData] = useState(false);

  const chatEndRef = useRef(null);

  // --- EXTRACCIÓN Y VALIDACIÓN DE PERMISOS ---
  const { user } = getAuthData();
  const rolUsuario = user?.rol || "";
  const nombreUsuario = user?.nombre || "Anónimo";

  let currentUser = nombreUsuario;
  // Limpiamos el rol: mayúsculas, sin tildes y sin espacios extra para evitar fallos
  const rolNormalizado = rolUsuario
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Opcional: Alias visuales hardcodeados
  if (rolNormalizado === "GERENCIA") {
    currentUser = "Andrés";
  } else if (rolNormalizado === "OPERARIO" || rolNormalizado === "PANEL") {
    currentUser = "Leonel";
  } else if (rolNormalizado === "DEPOSITO") {
    currentUser = "Mauro";
  }

  // Lista de roles autorizados (¡Asegura incluir al jefe!)
  const isBoss = [
    "GERENCIA",
    "PLANIFICACION",
    "EXPEDICION",
    "DEPOSITO",
    "OPERARIO",
    "PANEL",
    "JEFE PRODUCCION",
  ].includes(rolNormalizado);

  const [form, setForm] = useState({
    producto: "",
    cantidad: "",
    prioridad: "MEDIA",
    notas: "",
  });

  const loadRequests = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/logistica`);
      if (res.ok) setRequests(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
        console.error("Error cargando productos", e);
      }
    };
    loadSemis();

    const interval = setInterval(loadRequests, 10000);
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
    setHistoryTimeline([]);
    setComments([]);

    try {
      const [resHist, resComm] = await Promise.all([
        authFetch(`${API_BASE_URL}/logistica/${req.id}/historial`),
        authFetch(`${API_BASE_URL}/logistica/${req.id}/comentarios`),
      ]);

      let logs = resHist.ok ? await resHist.json() : [];
      let comms = resComm.ok ? await resComm.json() : [];

      const eventoCreacion = {
        id: "genesis",
        accion: "CREADO",
        usuario: req.solicitante || "Sistema",
        detalle: `Solicitud iniciada. Cant: ${req.cantidad}`,
        fecha: req.fecha_creacion,
        esOriginal: true,
      };
      const logsFiltrados = logs.filter((l) => l.accion !== "CREADO");
      setHistoryTimeline(
        [eventoCreacion, ...logsFiltrados].sort(
          (a, b) => new Date(a.fecha) - new Date(b.fecha),
        ),
      );
      setComments(comms);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments, activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producto || !form.cantidad)
      return toast.error("Completa el producto y la cantidad.");

    const toastId = toast.loading("Enviando solicitud...");
    try {
      await authFetch(`${API_BASE_URL}/logistica`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, solicitante: currentUser }),
      });

      setForm({ producto: "", cantidad: "", prioridad: "MEDIA", notas: "" });
      setResetKey((prev) => prev + 1);
      setIsNewModalOpen(false);
      loadRequests();
      setCurrentPage(1);
      toast.success("Solicitud creada", { id: toastId });
    } catch (e) {
      toast.error("Error al crear solicitud", { id: toastId });
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

    if (selectedRequest && selectedRequest.id === id) {
      setTimeout(
        () => loadRequestDetails({ ...selectedRequest, estado: newStatus }),
        500,
      );
    }
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

    const tempId = Date.now();
    const optimisticComment = {
      id: tempId,
      usuario: currentUser,
      mensaje: newComment,
      fecha: new Date().toISOString(),
    };
    setComments([...comments, optimisticComment]);
    setNewComment("");

    await authFetch(
      `${API_BASE_URL}/logistica/${selectedRequest.id}/comentarios`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: currentUser,
          mensaje: optimisticComment.mensaje,
        }),
      },
    );
    loadRequestDetails(selectedRequest);
  };

  // --- LÓGICA DE FILTRADO Y PAGINACIÓN ---
  const closedStatuses = ["ENTREGADO", "FINALIZADO", "RECHAZADO", "ELIMINADO"];
  const activeRequests = requests.filter(
    (r) => !closedStatuses.includes(r.estado),
  );

  const totalPages = Math.ceil(activeRequests.length / itemsPerPage) || 1;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const currentItems = activeRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const getIcon = (acc) => {
    if (acc === "CREADO") return <FaPlus size={10} />;
    if (acc === "APROBADO") return <FaCheckCircle size={10} />;
    if (acc === "PREPARADO") return <FaBoxOpen size={10} />;
    if (acc === "ENTREGADO") return <FaCheckDouble size={10} />;
    if (acc === "COMENTARIO") return <FaComments size={10} />;
    return <FaInfoCircle size={10} />;
  };

  const getStatusColorTable = (estado) => {
    const s = {
      PENDIENTE: "text-stone-500 bg-stone-100 border-stone-200",
      APROBADO: "text-[#2196f3] bg-[#e3f2fd] border-[#bbdefb]",
      PREPARADO: "text-indigo-600 bg-indigo-50 border-indigo-200",
      ENTREGADO: "text-[#43a047] bg-[#e8f5e9] border-[#c8e6c9]",
      FINALIZADO: "text-[#43a047] bg-[#e8f5e9] border-[#c8e6c9]",
      RECHAZADO: "text-red-500 bg-red-50 border-red-200",
    };
    return s[estado] || s.PENDIENTE;
  };

  if (loading && requests.length === 0) {
    return (
      <div className="min-h-full bg-[#fcfbf9] flex flex-col font-sans animate-in fade-in">
        {/* Simulación del Header para que la pantalla no salte */}
        <header className="bg-white border-b border-stone-100 px-6 py-5 md:px-10 md:py-6 shrink-0 z-20">
          <div className="max-w-[1200px] mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-stone-100 animate-pulse" />
              <div className="space-y-2">
                <div className="w-32 h-6 bg-stone-100 rounded-lg animate-pulse" />
                <div className="w-24 h-3 bg-stone-50 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 md:p-8 mt-2 space-y-4">
          {/* Generamos 5 filas de "fantasma" (Skeletons) */}
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-full h-20 bg-white rounded-2xl border border-stone-100 flex items-center px-6 gap-6 overflow-hidden relative"
            >
              {/* Efecto de brillo barriendo la tarjeta */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />

              <div className="w-24 h-4 bg-stone-100 rounded animate-pulse" />
              <div className="flex-1 h-4 bg-stone-100 rounded animate-pulse" />
              <div className="w-16 h-8 bg-stone-50 rounded-xl animate-pulse" />
              <div className="w-24 h-8 bg-stone-100 rounded-xl animate-pulse" />
            </div>
          ))}
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-full bg-[#fcfbf9] flex flex-col font-sans pb-12 animate-in fade-in"
      onClick={() => setOpenMenuId(null)}
    >
      {/* HEADER TRANSLÚCIDO ESTILO LEBANE */}
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-100 px-6 py-5 md:px-10 md:py-6 shrink-0 z-20 sticky top-0">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#e3f2fd] border border-[#bbdefb] flex items-center justify-center text-[#2196f3] shadow-sm shrink-0">
              <FaTruck size={20} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-none mb-1.5">
                Logística Interna
              </h1>
              <p className="text-[11px] font-semibold text-stone-400 tracking-wider uppercase">
                Panel de Movimientos Activos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                setIsDetailModalOpen(true);
                setSelectedRequest(null);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 bg-white hover:bg-stone-50 text-stone-600 border border-stone-200 font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <FaHistory size={12} className="text-stone-400" /> HISTORIAL
            </button>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 bg-[#2196f3] hover:bg-blue-600 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-[0_8px_20px_-6px_rgba(33,150,243,0.4)] transition-all active:scale-95"
            >
              <FaPlus size={10} /> CREAR SOLICITUD
            </button>
          </div>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 md:p-8 mt-2">
        {activeRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white/50 border border-dashed border-stone-200/60 rounded-[2rem]">
            <div className="w-16 h-16 bg-stone-50 text-stone-300 rounded-full flex items-center justify-center mb-4 border border-stone-100">
              <FaCheckCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">
              Bandeja Limpia
            </h3>
            <p className="text-xs font-medium text-stone-400 text-center max-w-xs">
              No hay solicitudes pendientes en curso. Las solicitudes cerradas
              se encuentran en el Historial.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Encabezado de Tabla (Solo Desktop) - Alineado a los anchos del LogisticaRow */}
            <div className="hidden md:flex items-center gap-4 px-6 py-3 text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-2">
              <div className="w-36 pl-1">Prioridad / Fecha</div>
              <div className="flex-1">Producto y Solicitante</div>
              <div className="w-28 text-right pr-6">Cantidad</div>
              <div className="w-36 pl-4">Estado</div>
              <div className="w-16 text-center"></div>{" "}
              {/* Espacio para los 3 puntos */}
            </div>

            {/* Listado de Filas (Row Cards) */}
            <div className="flex flex-col gap-3 md:gap-2.5 pb-8">
              <AnimatePresence mode="popLayout">
                {currentItems.map((req) => (
                  <LogisticaRow
                    key={req.id}
                    req={req}
                    isBoss={isBoss}
                    onOpenDetail={openDetailModal}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Paginación Elegante Lebane */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4 mb-8">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-[#2196f3] disabled:opacity-40 disabled:hover:text-stone-500 disabled:hover:bg-white transition-all shadow-sm"
                >
                  <FaChevronLeft size={10} />
                </button>

                <div className="flex gap-1.5 bg-white border border-stone-200 p-1 rounded-xl shadow-sm">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                        currentPage === i + 1
                          ? "bg-[#e3f2fd] text-[#2196f3]"
                          : "text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-[#2196f3] disabled:opacity-40 disabled:hover:text-stone-500 disabled:hover:bg-white transition-all shadow-sm"
                >
                  <FaChevronRight size={10} />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- MODAL CREAR SOLICITUD (Diseño Limpio y Predictivo) --- */}
      <AnimatePresence>
        {isNewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white w-full max-w-lg rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] flex flex-col relative overflow-visible"
            >
              <div className="p-6 md:p-8 border-b border-stone-100 flex justify-between items-center bg-[#fcfbf9] rounded-t-[2rem]">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2.5 bg-[#e3f2fd] text-[#2196f3] rounded-xl">
                    <FaPlus size={14} />
                  </div>
                  Crear Solicitud
                </h3>
                <button
                  onClick={() => {
                    setIsNewModalOpen(false);
                    setForm({
                      producto: "",
                      cantidad: "",
                      prioridad: "MEDIA",
                      notas: "",
                    });
                    setResetKey((prev) => prev + 1);
                  }}
                  className="text-stone-400 hover:text-slate-800 bg-white border border-stone-200 p-2.5 rounded-full shadow-sm transition-all active:scale-95"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                {/* Buscador Predictivo Premium */}
                <div className="space-y-1.5 relative z-[100]">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 pl-1 block">
                    Producto Semielaborado a mover
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-stone-300 group-focus-within:text-[#2196f3] transition-colors z-10">
                      <FaSearch size={12} />
                    </div>
                    {/* Anulamos el estilo nativo del AutoComplete y le inyectamos el nuestro */}
                    <div className="[&_input]:w-full [&_input]:bg-stone-50 hover:[&_input]:bg-stone-100 [&_input]:border [&_input]:border-transparent [&_input]:rounded-xl [&_input]:py-3.5 [&_input]:pl-11 [&_input]:pr-4 [&_input]:text-sm [&_input]:font-bold [&_input]:text-slate-700 focus-within:[&_input]:border-[#bbdefb] focus-within:[&_input]:bg-white focus-within:[&_input]:ring-4 focus-within:[&_input]:ring-[#e3f2fd] [&_input]:transition-all [&_input]:outline-none">
                      <AutoCompleteInput
                        key={resetKey}
                        items={allSemis}
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
                      Cantidad Total (u.)
                    </label>
                    <input
                      type="number"
                      placeholder="Ej. 150"
                      className="w-full bg-stone-50 hover:bg-stone-100 border border-transparent rounded-xl p-3.5 text-sm font-bold text-slate-700 focus:border-[#bbdefb] focus:bg-white focus:ring-4 focus:ring-[#e3f2fd] outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={form.cantidad}
                      onChange={(e) =>
                        setForm({ ...form, cantidad: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 pl-1 block">
                      Prioridad
                    </label>
                    <select
                      className="w-full bg-stone-50 hover:bg-stone-100 border border-transparent rounded-xl p-3.5 text-sm font-bold text-slate-700 focus:border-[#bbdefb] focus:bg-white focus:ring-4 focus:ring-[#e3f2fd] outline-none transition-all appearance-none cursor-pointer"
                      value={form.prioridad}
                      onChange={(e) =>
                        setForm({ ...form, prioridad: e.target.value })
                      }
                    >
                      <option value="BAJA">Baja - Rutina</option>
                      <option value="MEDIA">Media - Normal</option>
                      <option value="ALTA">Alta - Urgente</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 relative z-10">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-[#2196f3] hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] text-sm"
                  >
                    <FaPaperPlane size={12} /> Solicitar Movimiento
                  </button>
                </div>
              </form>
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
              {/* Header Modal */}
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
                  className="text-stone-400 hover:text-slate-800 bg-white border border-stone-200 p-2.5 rounded-full shadow-sm transition-all"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              {/* Cuerpo Modal (Split View) */}
              <div className="flex flex-1 overflow-hidden flex-col md:flex-row bg-[#fcfbf9]">
                {/* Panel Izquierdo: Lista Completa */}
                <div
                  className={`${selectedRequest ? "hidden md:flex" : "flex"} flex-col w-full md:w-[420px] border-r border-stone-100 bg-white`}
                >
                  <div className="overflow-y-auto custom-scrollbar flex-1 p-4 space-y-2">
                    {requests.map((req) => (
                      <div
                        key={req.id}
                        onClick={() => openDetailModal(req)}
                        className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                          selectedRequest?.id === req.id
                            ? "bg-[#fafaf8] border-blue-200 shadow-sm ring-2 ring-blue-50"
                            : "bg-white border-stone-100 hover:border-stone-300 hover:shadow-sm"
                        }`}
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
                            <FaUser size={9} className="text-stone-300" />{" "}
                            {req.solicitante}
                          </span>
                          <span className="text-xs font-bold text-slate-600 bg-stone-50 px-2.5 py-0.5 rounded-lg border border-stone-100">
                            {req.cantidad} u.
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Panel Derecho: Detalle de Solicitud */}
                <div
                  className={`${!selectedRequest ? "hidden md:flex" : "flex"} flex-1 flex-col relative bg-[#fcfbf9]`}
                >
                  {!selectedRequest ? (
                    <div className="h-full flex flex-col items-center justify-center text-stone-400 p-8 text-center">
                      <div className="w-20 h-20 rounded-full bg-white border border-stone-100 flex items-center justify-center mb-6 shadow-sm">
                        <FaList size={28} className="text-stone-300" />
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
                      {/* Cabecera del Detalle */}
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
                              ({selectedRequest.cantidad} u.)
                            </span>
                          </h4>
                        </div>

                        {/* Pestañas Chat/Auditoría */}
                        <div className="flex bg-stone-50 rounded-xl p-1.5 border border-stone-200 shrink-0">
                          <button
                            onClick={() => setActiveTab("TIMELINE")}
                            className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                              activeTab === "TIMELINE"
                                ? "bg-white text-slate-700 shadow-sm"
                                : "text-stone-400 hover:text-stone-600"
                            }`}
                          >
                            Recorrido
                          </button>
                          <button
                            onClick={() => setActiveTab("CHAT")}
                            className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                              activeTab === "CHAT"
                                ? "bg-white text-[#2196f3] shadow-sm"
                                : "text-stone-400 hover:text-stone-600"
                            }`}
                          >
                            <FaComments size={12} /> Notas
                          </button>
                        </div>
                      </div>

                      {/* Contenido (Timeline o Chat) */}
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
                                    className={`absolute -left-[51px] top-0 h-10 w-10 rounded-full border-4 border-[#fcfbf9] flex items-center justify-center shadow-sm ${
                                      log.esOriginal
                                        ? "bg-[#e3f2fd] text-[#2196f3]"
                                        : "bg-white text-stone-400"
                                    }`}
                                  >
                                    {getIcon(log.accion)}
                                  </div>
                                  <div className="flex flex-col bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">
                                        {log.accion}
                                      </span>
                                      <span className="text-[10px] font-medium text-stone-400 bg-stone-50 px-2.5 py-1 rounded-lg">
                                        {formatearFechaHora(log.fecha)}
                                      </span>
                                    </div>
                                    <p className="text-sm text-stone-600 font-medium leading-relaxed">
                                      {log.detalle}
                                    </p>
                                    <div className="mt-4 pt-4 border-t border-stone-50 flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                      <FaUser
                                        size={10}
                                        className="text-stone-300"
                                      />{" "}
                                      {log.usuario}
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
                                    className="mb-4 opacity-50 text-stone-200"
                                  />
                                  <p className="text-sm font-bold text-stone-400">
                                    Sin anotaciones aún.
                                  </p>
                                  <p className="text-[11px] font-medium mt-1">
                                    Utiliza el chat abajo para dejar directivas
                                    claras a la solicitud.
                                  </p>
                                </div>
                              )}
                              {comments.map((msg, i) => {
                                const isMe = msg.usuario === currentUser;
                                return (
                                  <div
                                    key={i}
                                    className={`flex flex-col ${
                                      isMe ? "items-end" : "items-start"
                                    }`}
                                  >
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1.5 px-2">
                                      {msg.usuario}
                                    </span>
                                    <div
                                      className={`max-w-[85%] px-5 py-3.5 text-sm font-medium shadow-sm ${
                                        isMe
                                          ? "bg-[#2196f3] text-white rounded-[20px] rounded-tr-sm"
                                          : "bg-white border border-stone-200 text-slate-700 rounded-[20px] rounded-tl-sm"
                                      }`}
                                    >
                                      <p className="leading-relaxed">
                                        {msg.mensaje}
                                      </p>
                                    </div>
                                    <span className="text-[9px] font-medium text-stone-400 mt-1.5 px-2">
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

                      {/* Input de Chat Estilo Lebane */}
                      {activeTab === "CHAT" && (
                        <form
                          onSubmit={handleSendComment}
                          className="p-5 bg-white border-t border-stone-100 flex gap-3 shrink-0 relative z-20"
                        >
                          <input
                            className="flex-1 bg-stone-50 border border-transparent focus:border-[#bbdefb] focus:bg-white focus:ring-4 focus:ring-[#e3f2fd] rounded-xl px-5 py-3.5 text-sm font-semibold text-slate-700 outline-none transition-all shadow-sm"
                            placeholder="Escribir una anotación o directiva..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                          />
                          <button
                            type="submit"
                            disabled={!newComment.trim()}
                            className="bg-[#2196f3] hover:bg-blue-700 disabled:bg-stone-100 disabled:text-stone-300 text-white p-4 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center w-14"
                          >
                            <FaPaperPlane size={14} className="ml-[-2px]" />
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
