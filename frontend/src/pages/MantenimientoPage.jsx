import React, { useState, useEffect, useMemo } from "react";
import {
  FaWrench,
  FaPlus,
  FaTimes,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaCogs,
  FaFire,
  FaTools,
  FaSave,
  FaUndo,
  FaChevronDown,
  FaChevronUp,
  FaSearch,
  FaBoxOpen,
  FaPause,
  FaFilter,
  FaCalendarAlt,
  FaStickyNote,
  FaHistory,
} from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../utils.js";
import { getAuthData } from "../auth/authHelper.js";

const MAQUINAS_DISPONIBLES = [
  "HORNO 1",
  "HORNO 2",
  "HORNO 3",
  "INYECTORA",
  "EXTRUSORA 1",
  "EXTRUSORA 3",
  "EXTRUSORA 4",
  "INFRAESTRUCTURA",
];

export default function MantenimientoPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [activeTab, setActiveTab] = useState("PENDIENTES");

  // MODALES
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEquiposOpen, setModalEquiposOpen] = useState(false); // NUEVO: Modal de Directorio

  const [expandedId, setExpandedId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filtroMaquina, setFiltroMaquina] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [formData, setFormData] = useState({
    maquina: "",
    titulo: "",
    descripcion: "",
    prioridad: "MEDIA",
    tipo: "CORRECTIVO",
  });
  const [estadoPrompt, setEstadoPrompt] = useState({
    open: false,
    ticketId: null,
    nuevoEstado: "",
    titulo: "",
    nota: "",
  });

  const [fichaMaquina, setFichaMaquina] = useState(null);
  const [notasMaquina, setNotasMaquina] = useState("");
  const [guardandoNotas, setGuardandoNotas] = useState(false);

  const { user } = getAuthData();

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const cargarTickets = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/mantenimiento`);
      if (res.ok) setTickets(await res.json());
    } catch (error) {
      showToast("Error al cargar tickets", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTickets();
  }, []);

  useEffect(() => {
    if (fichaMaquina) {
      setNotasMaquina("Cargando...");
      authFetch(`${API_BASE_URL}/mantenimiento/maquina/${fichaMaquina}`)
        .then((res) => res.json())
        .then((data) => setNotasMaquina(data.notas || ""))
        .catch(() => setNotasMaquina(""));
    }
  }, [fichaMaquina]);

  const guardarNotasMaquina = async () => {
    setGuardandoNotas(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/mantenimiento/maquina/${fichaMaquina}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notas: notasMaquina }),
        },
      );
      if (res.ok) showToast("Notas del equipo guardadas.");
    } catch (e) {
      showToast("Error al guardar notas", "error");
    } finally {
      setGuardandoNotas(false);
    }
  };

  const toggleExpand = (id) =>
    setExpandedId((prevId) => (prevId === id ? null : id));

  const crearTicket = async (e) => {
    e.preventDefault();
    if (!formData.maquina || !formData.descripcion || !formData.titulo)
      return showToast("Completá todos los campos", "error");

    try {
      const res = await authFetch(`${API_BASE_URL}/mantenimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          creado_por: user?.nombre || "Usuario",
          asignado_a: "Técnico de Turno",
        }),
      });
      if (res.ok) {
        showToast("Ticket reportado exitosamente.");
        setModalOpen(false);
        setFormData({
          maquina: "",
          titulo: "",
          descripcion: "",
          prioridad: "MEDIA",
          tipo: "CORRECTIVO",
        });
        cargarTickets();
        setActiveTab("PENDIENTES");
      } else throw new Error();
    } catch (e) {
      showToast("Error al crear el ticket", "error");
    }
  };

  const cambiarEstado = async (id, nuevoEstado, notaStr = "") => {
    try {
      const bodyData = {
        estado: nuevoEstado,
        resuelto_por: nuevoEstado === "SOLUCIONADO" ? user?.nombre : null,
      };

      if (nuevoEstado === "SOLUCIONADO") {
        bodyData.fecha_solucion = new Date().toISOString();
        if (notaStr) bodyData.solucion_notas = notaStr;
      }
      if (nuevoEstado === "EN_REVISION") {
        bodyData.fecha_inicio_revision = new Date().toISOString();
        if (notaStr) bodyData.notas_revision = notaStr;
      }

      const res = await authFetch(
        `${API_BASE_URL}/mantenimiento/${id}/estado`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyData),
        },
      );
      if (res.ok) {
        cargarTickets();
        setExpandedId(null);
        if (window.innerWidth < 1024) {
          if (nuevoEstado === "EN_REVISION") setActiveTab("REVISION");
          if (nuevoEstado === "SOLUCIONADO") setActiveTab("SOLUCIONADO");
        }
      } else throw new Error();
    } catch (e) {
      showToast("Error al actualizar", "error");
    }
  };

  const abrirPrompt = (id, nuevoEstado, titulo) => {
    setEstadoPrompt({
      open: true,
      ticketId: id,
      nuevoEstado,
      titulo,
      nota: "",
    });
  };

  const eliminarTicket = async (id) => {
    if (!window.confirm("¿Eliminar este registro permanentemente?")) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/mantenimiento/${id}`, {
        method: "DELETE",
      });
      if (res.ok) cargarTickets();
    } catch (e) {
      showToast("Error al eliminar", "error");
    }
  };

  const limpiarFiltros = () => {
    setSearchTerm("");
    setFiltroMaquina("");
    setFechaDesde("");
    setFechaHasta("");
  };

  const kpis = useMemo(() => {
    const term = searchTerm.toLowerCase();

    const filtrados = tickets.filter((t) => {
      const coincideTexto =
        t.maquina.toLowerCase().includes(term) ||
        t.titulo.toLowerCase().includes(term) ||
        (t.descripcion && t.descripcion.toLowerCase().includes(term)) ||
        (t.creado_por && t.creado_por.toLowerCase().includes(term));
      if (!coincideTexto) return false;
      if (filtroMaquina && t.maquina !== filtroMaquina) return false;

      if (fechaDesde) {
        const fDesde = new Date(fechaDesde);
        fDesde.setHours(0, 0, 0, 0);
        const fTicket = new Date(t.fecha_creacion);
        if (fTicket < fDesde) return false;
      }
      if (fechaHasta) {
        const fHasta = new Date(fechaHasta);
        fHasta.setHours(23, 59, 59, 999);
        const fTicket = new Date(t.fecha_creacion);
        if (fTicket > fHasta) return false;
      }

      return true;
    });

    const pendientes = filtrados.filter(
      (t) => t.estado === "PENDIENTE" || !t.estado,
    );
    const enRevision = filtrados.filter((t) => t.estado === "EN_REVISION");
    const resueltosAll = filtrados.filter((t) => t.estado === "SOLUCIONADO");

    const LIMITE = 5;
    const isSearching =
      searchTerm.trim() !== "" ||
      filtroMaquina !== "" ||
      fechaDesde !== "" ||
      fechaHasta !== "";
    const resueltosToShow = isSearching
      ? resueltosAll
      : resueltosAll.slice(0, LIMITE);
    const hiddenCount = isSearching
      ? 0
      : Math.max(0, resueltosAll.length - LIMITE);

    return {
      pendientes,
      enRevision,
      resueltos: resueltosToShow,
      hiddenCount,
      totalResueltos: resueltosAll.length,
      isSearching,
    };
  }, [tickets, searchTerm, filtroMaquina, fechaDesde, fechaHasta]);

  const PrioridadBadge = ({ prioridad }) => {
    const config = {
      ALTA: {
        color: "bg-rose-50 text-rose-600 border-rose-100",
        icon: <FaFire />,
      },
      MEDIA: {
        color: "bg-orange-50 text-orange-600 border-orange-100",
        icon: <FaExclamationTriangle />,
      },
      BAJA: {
        color: "bg-emerald-50 text-emerald-600 border-emerald-100",
        icon: <FaCheckCircle />,
      },
    };
    const { color, icon } = config[prioridad] || config.MEDIA;
    return (
      <span
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border shrink-0 ${color}`}
      >
        {icon} {prioridad}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 mx-auto max-w-[1600px] animate-in fade-in flex flex-col relative bg-transparent h-[calc(100vh-60px)] md:h-[calc(100vh-80px)] overflow-hidden">
      {toast && (
        <div
          className={`fixed top-16 md:top-20 right-4 md:right-8 z-[99999] px-5 py-3 rounded-2xl shadow-xl font-bold text-sm flex items-center gap-3 transition-all animate-in slide-in-from-right-8 ${toast.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}
        >
          {toast.type === "success" ? (
            <FaCheckCircle size={18} />
          ) : (
            <FaExclamationTriangle size={18} />
          )}
          {toast.msg}
        </div>
      )}

      {/* --- ENCABEZADO --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0 mb-4">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-3 bg-slate-800 text-white rounded-xl shadow-md">
              <FaWrench size={18} className="md:w-5 md:h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">
                Mantenimiento
              </h1>
              <p className="hidden md:block text-slate-500 font-medium text-xs mt-0.5">
                Control de maquinaria interactivo.
              </p>
            </div>
          </div>
          {/* BOTONES MOBILE */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setModalEquiposOpen(true)}
              className="flex items-center justify-center bg-white text-slate-700 border border-slate-200 w-9 h-9 rounded-lg shadow-sm active:scale-95 transition-all"
            >
              <FaCogs />
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center justify-center bg-slate-800 text-white w-9 h-9 rounded-lg shadow-sm active:scale-95 transition-all"
            >
              <FaPlus />
            </button>
          </div>
        </div>

        {/* BOTONES DESKTOP */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setModalEquiposOpen(true)}
            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 text-xs font-bold px-4 py-3 rounded-xl shadow-sm hover:bg-slate-50 transition-all shrink-0"
          >
            <FaCogs /> Equipos
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-slate-800 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-md hover:bg-slate-700 transition-all shrink-0"
          >
            <FaPlus /> Reportar Falla
          </button>
        </div>
      </div>

      {/* --- BARRA DE FILTROS --- */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-2.5 mb-4 shrink-0 shadow-sm flex flex-col xl:flex-row gap-2.5 items-center z-10">
        <div className="relative w-full xl:w-1/3">
          <FaSearch
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            size={12}
          />
          <input
            type="text"
            placeholder="Buscar por palabra clave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-all"
          />
        </div>

        <div className="relative w-full xl:w-1/4">
          <FaFilter
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            size={12}
          />
          <select
            value={filtroMaquina}
            onChange={(e) => setFiltroMaquina(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-all appearance-none cursor-pointer"
          >
            <option value="">Todas las máquinas</option>
            {MAQUINAS_DISPONIBLES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full xl:flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
          <FaCalendarAlt className="text-slate-400 shrink-0" size={12} />
          <div className="flex flex-1 items-center gap-2">
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
            />
            <span className="text-slate-300 font-bold">-</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
            />
          </div>
        </div>

        {kpis.isSearching && (
          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors w-full xl:w-auto justify-center shrink-0"
          >
            <FaTimes size={10} /> Limpiar
          </button>
        )}
      </div>

      {/* PESTAÑAS MOBILE */}
      <div className="lg:hidden flex bg-slate-100 p-1 rounded-lg mb-3 shrink-0">
        <button
          onClick={() => setActiveTab("PENDIENTES")}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${activeTab === "PENDIENTES" ? "bg-white shadow-sm text-rose-600" : "text-slate-500"}`}
        >
          En Espera{" "}
          <span className="bg-slate-50 px-1.5 rounded text-slate-400">
            {kpis.pendientes.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("REVISION")}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${activeTab === "REVISION" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"}`}
        >
          Reparando{" "}
          <span className="bg-slate-50 px-1.5 rounded text-slate-400">
            {kpis.enRevision.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("SOLUCIONADO")}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${activeTab === "SOLUCIONADO" ? "bg-white shadow-sm text-emerald-600" : "text-slate-500"}`}
        >
          Listos{" "}
          <span className="bg-slate-50 px-1.5 rounded text-slate-400">
            {kpis.totalResueltos}
          </span>
        </button>
      </div>

      {/* TABLERO KANBAN DE 3 COLUMNAS */}
      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-3 gap-6 pb-2">
        {/* COLUMNA 1: PENDIENTES */}
        <div
          className={`${activeTab === "PENDIENTES" ? "flex" : "hidden lg:flex"} flex-col bg-slate-50/30 lg:bg-transparent rounded-2xl h-full min-h-0`}
        >
          <div className="hidden lg:flex pb-2 shrink-0 items-center justify-between border-b border-slate-200/50 mb-3">
            <h2 className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              En Espera
            </h2>
            <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-500 px-2 rounded shadow-sm">
              {kpis.pendientes.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 pr-1 md:pr-2 custom-scrollbar">
            {kpis.pendientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200/80 rounded-2xl bg-slate-50/50 opacity-80 mt-2">
                <FaClock size={16} className="text-slate-300 mb-2" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {kpis.isSearching ? "Sin coincidencias" : "Sin reportes"}
                </span>
              </div>
            ) : (
              kpis.pendientes.map((t) => {
                const isExpanded = expandedId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleExpand(t.id)}
                    className={`bg-white rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${isExpanded ? "border-rose-200 shadow-md ring-2 ring-rose-50" : "border-slate-100 shadow-sm hover:border-rose-100 hover:shadow-md"}`}
                  >
                    <div className="p-3.5 flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFichaMaquina(t.maquina);
                            }}
                            className="text-[10px] font-black text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-1.5 py-0.5 rounded transition-colors uppercase tracking-widest flex items-center gap-1 -ml-1.5"
                            title="Ver ficha del equipo"
                          >
                            <FaCogs /> {t.maquina}
                          </button>
                          <span className="text-[8px] font-bold text-slate-300">
                            •{" "}
                            {t.fecha_creacion
                              ? new Date(t.fecha_creacion).toLocaleDateString()
                              : "Hoy"}
                          </span>
                        </div>
                        <h3
                          className={`text-xs font-bold text-slate-700 leading-tight ${isExpanded ? "" : "truncate"}`}
                        >
                          {t.titulo}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <PrioridadBadge prioridad={t.prioridad} />
                        <div className="text-slate-300">
                          {isExpanded ? (
                            <FaChevronUp size={10} />
                          ) : (
                            <FaChevronDown size={10} />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 mb-3">
                          <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                            {t.descripcion}
                          </p>
                        </div>
                        <div className="flex justify-between items-end">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                              Reportado por
                            </span>
                            <span className="text-[10px] font-bold text-slate-600">
                              {t.creado_por || "Usuario"}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {user?.rol === "GERENCIA" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  eliminarTicket(t.id);
                                }}
                                className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                              >
                                <FaTimes size={12} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirPrompt(
                                  t.id,
                                  "EN_REVISION",
                                  "¿Querés agregar notas iniciales?",
                                );
                              }}
                              className="text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                            >
                              <FaTools /> Reparar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMNA 2: EN REVISIÓN */}
        <div
          className={`${activeTab === "REVISION" ? "flex" : "hidden lg:flex"} flex-col bg-slate-50/30 lg:bg-transparent rounded-2xl h-full min-h-0`}
        >
          <div className="hidden lg:flex pb-2 shrink-0 items-center justify-between border-b border-slate-200/50 mb-3">
            <h2 className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              En Revisión
            </h2>
            <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-500 px-2 rounded shadow-sm">
              {kpis.enRevision.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 pr-1 md:pr-2 custom-scrollbar">
            {kpis.enRevision.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200/80 rounded-2xl bg-slate-50/50 opacity-80 mt-2">
                <FaTools size={16} className="text-slate-300 mb-2" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {kpis.isSearching ? "Sin coincidencias" : "Taller Libre"}
                </span>
              </div>
            ) : (
              kpis.enRevision.map((t) => {
                const isExpanded = expandedId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleExpand(t.id)}
                    className={`bg-white rounded-xl border-l-4 border-l-blue-400 border border-y-slate-100 border-r-slate-100 transition-all duration-200 cursor-pointer overflow-hidden ${isExpanded ? "shadow-md" : "shadow-sm hover:shadow-md"}`}
                  >
                    <div className="p-3 flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFichaMaquina(t.maquina);
                            }}
                            className="text-[10px] font-black text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors uppercase tracking-widest flex items-center gap-1 -ml-1.5"
                            title="Ver ficha del equipo"
                          >
                            <FaCogs className="animate-pulse" /> {t.maquina}
                          </button>
                        </div>
                        <h3
                          className={`text-xs font-bold text-slate-700 leading-tight ${isExpanded ? "" : "truncate"}`}
                        >
                          {t.titulo}
                        </h3>
                      </div>
                      <div className="text-slate-300 shrink-0">
                        {isExpanded ? (
                          <FaChevronUp size={10} />
                        ) : (
                          <FaChevronDown size={10} />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 mb-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                            Falla Reportada
                          </span>
                          <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                            {t.descripcion}
                          </p>
                        </div>
                        {t.notas_revision && (
                          <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 mb-3">
                            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block mb-0.5">
                              Diagnóstico
                            </span>
                            <p className="text-[10px] font-medium text-slate-600 italic">
                              {t.notas_revision}
                            </p>
                          </div>
                        )}
                        <div className="flex justify-between items-end mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cambiarEstado(t.id, "PENDIENTE");
                            }}
                            className="text-[9px] font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 transition-colors"
                          >
                            <FaPause size={9} /> Pausar
                          </button>
                          <div className="flex gap-2">
                            {user?.rol === "GERENCIA" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  eliminarTicket(t.id);
                                }}
                                className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                              >
                                <FaTimes size={12} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirPrompt(
                                  t.id,
                                  "SOLUCIONADO",
                                  "Detalle de la reparación",
                                );
                              }}
                              className="text-[10px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                            >
                              <FaCheckCircle /> Finalizar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMNA 3: SOLUCIONADOS */}
        <div
          className={`${activeTab === "SOLUCIONADO" ? "flex" : "hidden lg:flex"} flex-col bg-slate-50/30 lg:bg-transparent rounded-2xl h-full min-h-0`}
        >
          <div className="hidden lg:flex pb-2 shrink-0 items-center justify-between border-b border-slate-200/50 mb-3">
            <h2 className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Historial
            </h2>
            <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-500 px-2 rounded shadow-sm">
              {kpis.totalResueltos}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 pr-1 md:pr-2 custom-scrollbar">
            {kpis.resueltos.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200/60 rounded-2xl bg-transparent opacity-60 mt-2">
                <FaBoxOpen size={16} className="text-slate-300 mb-2" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {kpis.isSearching ? "Sin coincidencias" : "Sin Historial"}
                </span>
              </div>
            ) : (
              kpis.resueltos.map((t) => {
                const isExpanded = expandedId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleExpand(t.id)}
                    className={`bg-white/60 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden opacity-80 hover:opacity-100 ${isExpanded ? "border-emerald-200 shadow-sm bg-white" : "border-slate-100 shadow-sm"}`}
                  >
                    <div className="p-3 flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <FaCheckCircle
                            className="text-emerald-400 shrink-0"
                            size={10}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFichaMaquina(t.maquina);
                            }}
                            className="text-[9px] font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest truncate hover:bg-slate-100 px-1 rounded transition-colors -ml-1"
                            title="Ver ficha del equipo"
                          >
                            {t.maquina}
                          </button>
                        </div>
                        <h3 className="text-[11px] font-bold text-slate-600 truncate">
                          {t.titulo}
                        </h3>
                      </div>
                      <div className="text-slate-300 shrink-0">
                        {isExpanded ? (
                          <FaChevronUp size={10} />
                        ) : (
                          <FaChevronDown size={10} />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 animate-in slide-in-from-top-2 fade-in duration-200">
                        {t.descripcion && (
                          <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 mb-2.5">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                              Falla Reportada
                            </span>
                            <p className="text-[10px] font-medium text-slate-600 leading-relaxed">
                              {t.descripcion}
                            </p>
                          </div>
                        )}
                        {(t.notas_revision || t.solucion_notas) && (
                          <div className="mb-3 space-y-2.5 pl-2 border-l-2 border-emerald-200">
                            {t.notas_revision && (
                              <div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                                  Diagnóstico Inicial
                                </span>
                                <p className="text-[10px] font-medium text-slate-500 italic leading-relaxed">
                                  {t.notas_revision}
                                </p>
                              </div>
                            )}
                            {t.solucion_notas && (
                              <div>
                                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block">
                                  Solución Aplicada
                                </span>
                                <p className="text-[10px] font-medium text-slate-600 italic leading-relaxed">
                                  {t.solucion_notas}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex justify-between items-end border-t border-slate-100/50 pt-2 mt-2">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                              Resuelto por
                            </span>
                            <span className="text-[9px] font-bold text-slate-500">
                              {t.resuelto_por || "Técnico"} •{" "}
                              {t.fecha_solucion
                                ? new Date(
                                    t.fecha_solucion,
                                  ).toLocaleDateString()
                                : ""}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {user?.rol === "GERENCIA" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  eliminarTicket(t.id);
                                }}
                                className="text-slate-300 hover:text-rose-500 p-1 rounded hover:bg-rose-50"
                              >
                                <FaTimes size={10} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cambiarEstado(t.id, "EN_REVISION");
                              }}
                              className="text-[9px] font-bold text-slate-400 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 transition-colors"
                            >
                              <FaUndo size={9} /> Reabrir
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {kpis.hiddenCount > 0 && !kpis.isSearching && (
              <div className="py-4 flex justify-center">
                <div className="bg-slate-100/80 border border-slate-200 px-4 py-2 rounded-full flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    + {kpis.hiddenCount} tickets anteriores
                  </span>
                  <span className="text-[9px] font-medium text-slate-400 mt-0.5 flex items-center gap-1">
                    <FaSearch size={8} /> Usá el buscador
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- DIRECTORIO DE EQUIPOS (MODAL NUEVO) --- */}
      {modalEquiposOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in">
          <div className="bg-white w-full md:max-w-md md:rounded-[2rem] rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95 max-h-[90vh] flex flex-col border border-slate-100">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div>
                <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
                  Directorio de Equipos
                </h2>
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                  Seleccioná una máquina para ver su ficha
                </p>
              </div>
              <button
                onClick={() => setModalEquiposOpen(false)}
                className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-full p-2 transition-colors"
              >
                <FaTimes size={12} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar bg-slate-50/30">
              <div className="grid grid-cols-2 gap-3">
                {MAQUINAS_DISPONIBLES.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setFichaMaquina(m);
                      setModalEquiposOpen(false);
                    }}
                    className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center gap-2.5 hover:border-blue-300 hover:shadow-md transition-all group active:scale-95"
                  >
                    <FaCogs
                      className="text-slate-300 group-hover:text-blue-500 transition-colors"
                      size={24}
                    />
                    <span className="text-[10px] font-bold text-slate-600 text-center uppercase tracking-widest leading-tight">
                      {m}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- FICHA DE MÁQUINA (PANEL LATERAL TIPO APP) --- */}
      {fichaMaquina && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99990] animate-in fade-in"
            onClick={() => setFichaMaquina(null)}
          ></div>

          <div className="fixed top-0 right-0 bottom-0 w-full md:w-[450px] bg-[#F8FAFC] shadow-2xl border-l border-slate-200 z-[99999] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="bg-white px-6 py-5 border-b border-slate-200 shrink-0 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 border border-blue-100">
                  <FaCogs size={20} />
                </div>
                <div>
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                    Ficha de Equipo
                  </h2>
                  <h1 className="text-xl font-extrabold text-slate-800 leading-none">
                    {fichaMaquina}
                  </h1>
                </div>
              </div>
              <button
                onClick={() => setFichaMaquina(null)}
                className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-full p-2.5 transition-colors"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative">
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-3">
                  <FaStickyNote className="text-amber-500" /> Notas y
                  Recordatorios
                </h3>
                <textarea
                  value={notasMaquina}
                  onChange={(e) => setNotasMaquina(e.target.value)}
                  placeholder="Anotá acá reemplazos futuros, códigos de repuestos, advertencias..."
                  className="w-full text-xs font-medium text-slate-600 bg-amber-50/30 border border-amber-100/50 rounded-xl px-4 py-3 outline-none focus:bg-amber-50 focus:border-amber-300 transition-all resize-none min-h-[120px] custom-scrollbar"
                ></textarea>
                <button
                  onClick={guardarNotasMaquina}
                  disabled={guardandoNotas || notasMaquina === "Cargando..."}
                  className="mt-3 w-full py-2.5 rounded-xl text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  <FaSave /> {guardandoNotas ? "Guardando..." : "Guardar Notas"}
                </button>
              </div>

              <div>
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4 px-1">
                  <FaHistory className="text-blue-500" /> Últimas intervenciones
                </h3>
                <div className="space-y-3">
                  {tickets
                    .filter((t) => t.maquina === fichaMaquina)
                    .slice(0, 10)
                    .map((t) => (
                      <div
                        key={t.id}
                        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1.5"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-slate-700 line-clamp-1">
                            {t.titulo}
                          </h4>
                          <span
                            className={`text-[8px] font-black px-2 py-0.5 rounded uppercase shrink-0 ${t.estado === "SOLUCIONADO" ? "bg-emerald-50 text-emerald-600" : t.estado === "EN_REVISION" ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"}`}
                          >
                            {t.estado === "SOLUCIONADO"
                              ? "Listo"
                              : t.estado === "EN_REVISION"
                                ? "Reparando"
                                : "Espera"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2">
                          {t.solucion_notas || t.descripcion}
                        </p>
                        <span className="text-[9px] font-bold text-slate-400 mt-1">
                          {t.fecha_creacion
                            ? new Date(t.fecha_creacion).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                    ))}
                  {tickets.filter((t) => t.maquina === fichaMaquina).length ===
                    0 && (
                    <p className="text-[11px] text-slate-400 italic text-center py-4">
                      Sin registros previos.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- MODAL PARA DEJAR NOTAS DE ESTADO --- */}
      {estadoPrompt.open && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-sm font-extrabold text-slate-800">
                {estadoPrompt.titulo}
              </h2>
              <button
                onClick={() =>
                  setEstadoPrompt({ ...estadoPrompt, open: false })
                }
                className="text-slate-400 hover:text-rose-500"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-5">
              <textarea
                autoFocus
                rows="3"
                placeholder="Escribí los detalles acá (opcional)..."
                value={estadoPrompt.nota}
                onChange={(e) =>
                  setEstadoPrompt({ ...estadoPrompt, nota: e.target.value })
                }
                className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all shadow-sm resize-none custom-scrollbar"
              ></textarea>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() =>
                    setEstadoPrompt({ ...estadoPrompt, open: false })
                  }
                  className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    cambiarEstado(
                      estadoPrompt.ticketId,
                      estadoPrompt.nuevoEstado,
                      estadoPrompt.nota,
                    );
                    setEstadoPrompt({ ...estadoPrompt, open: false });
                  }}
                  className="flex-1 py-2.5 rounded-xl text-[10px] font-bold text-white bg-blue-600 border border-blue-700 hover:bg-blue-700 flex justify-center items-center gap-1.5 shadow-md"
                >
                  <FaSave size={12} /> Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL NUEVO TICKET --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in">
          <div className="bg-white w-full md:max-w-md md:rounded-[2rem] rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95 max-h-[90vh] flex flex-col border border-slate-100">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div>
                <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
                  Nuevo Reporte
                </h2>
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                  Ingresá los datos de la falla
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-full p-2 transition-colors"
              >
                <FaTimes size={12} />
              </button>
            </div>

            <form
              onSubmit={crearTicket}
              className="p-5 space-y-4 overflow-y-auto custom-scrollbar bg-slate-50/30"
            >
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Máquina o Sector
                </label>
                <select
                  required
                  autoFocus
                  value={formData.maquina}
                  onChange={(e) =>
                    setFormData({ ...formData, maquina: e.target.value })
                  }
                  className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 transition-all shadow-sm appearance-none cursor-pointer"
                >
                  <option value="" disabled>
                    Seleccionar equipo...
                  </option>
                  {MAQUINAS_DISPONIBLES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Problema Principal
                </label>
                <input
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={(e) =>
                    setFormData({ ...formData, titulo: e.target.value })
                  }
                  className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 transition-all shadow-sm"
                  placeholder="Ej: Motor recalentando"
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Descripción
                </label>
                <textarea
                  required
                  rows="3"
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                  className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 transition-all shadow-sm resize-none custom-scrollbar"
                ></textarea>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    Urgencia
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {["BAJA", "MEDIA", "ALTA"].map((nivel) => (
                      <button
                        key={nivel}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, prioridad: nivel })
                        }
                        className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${formData.prioridad === nivel ? (nivel === "ALTA" ? "bg-rose-50 border-rose-200 text-rose-700" : nivel === "MEDIA" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-emerald-50 border-emerald-200 text-emerald-700") : "bg-white border-slate-200 text-slate-500"}`}
                      >
                        {nivel}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    Tipo
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {["CORRECTIVO", "PREVENTIVO"].map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setFormData({ ...formData, tipo: tipo })}
                        className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${formData.tipo === tipo ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-500"}`}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 pb-2 md:pb-0 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold text-white bg-blue-600 border border-blue-700 hover:bg-blue-700 active:scale-95 transition-all flex justify-center items-center gap-1.5"
                >
                  <FaSave size={12} /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
