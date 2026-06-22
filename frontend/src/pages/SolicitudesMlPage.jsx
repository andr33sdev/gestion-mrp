import React, { useEffect, useState } from "react";
import {
  FaPlus,
  FaCheckCircle,
  FaTimesCircle,
  FaArchive,
  FaHistory,
  FaSearch,
  FaTimes,
  FaBox,
  FaUser,
  FaClipboardList,
  FaChevronLeft,
  FaChevronRight,
  FaEllipsisV,
  FaEdit,
  FaSpinner,
  FaBell, // 🔥 NUEVO: Icono para activar notificaciones push
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { API_BASE_URL, authFetch } from "../utils";
import { getAuthData } from "../auth/authHelper";
import Loader from "../components/Loader";

// =========================================================================
// --- HELPERS GLOBALES ---
// =========================================================================

// Helper para convertir la clave pública VAPID de Base64 a Uint8Array para el navegador
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const formatearFechaHoraML = (fechaIso) => {
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

    return `${dia}/${mes}/${anio} ${hora}:${minuto} hs`;
  } catch (e) {
    return fechaIso;
  }
};

export default function SolicitudesMlPage() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [catalogoMl, setCatalogoMl] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false); // Escudo definitivo contra el doble clic
  const [activeTab, setActiveTab] = useState("ACTIVAS"); // "ACTIVAS" o "ARCHIVADAS"

  // Buscador de Tabla e Items por página
  const [filterTerm, setFilterTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estado para controlar qué menú de 3 puntos está abierto
  const [openMenuId, setOpenMenuId] = useState(null);

  // Modales
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPromptQtyModalOpen, setIsPromptQtyModalOpen] = useState(false);
  const [selectedSol, setSelectedSol] = useState(null);
  const [historialLogs, setHistorialLogs] = useState([]);

  // Formularios
  const [form, setForm] = useState({
    articulo_nombre: "",
    cantidad_actual: "",
    cantidad_sugerida: "",
  });
  const [suggestedSearch, setSuggestedSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [cantidadAprobadaInput, setCantidadAprobadaInput] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editQty, setEditQty] = useState("");

  // Control de Permisos Estrictos
  const { user } = getAuthData();
  const nombreUsuario = user?.nombre || "Usuario";
  const rolNormalizado = (user?.rol || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  let currentUser = nombreUsuario;
  if (rolNormalizado === "GERENCIA") currentUser = "Andrés";
  else if (rolNormalizado === "OPERARIO" || rolNormalizado === "PANEL")
    currentUser = "Leonel";
  else if (
    rolNormalizado === "DEPOSITO" ||
    rolNormalizado === "ENC. EXPEDICION"
  )
    currentUser = "Mauro";

  const isExpedicion = [
    "DEPOSITO",
    "ENC. EXPEDICION",
    "GERENCIA",
    "JEFE PRODUCCION",
  ].includes(rolNormalizado);

  const loadSolicitudes = async (tab = activeTab) => {
    setLoading(true);
    try {
      const isArchived = tab === "ARCHIVADAS";
      const res = await authFetch(
        `${API_BASE_URL}/solicitudes-ml?archivada=${isArchived}`,
      );
      if (res.ok) setSolicitudes(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadCatalogo = async () => {
    try {
      const res = await authFetch(
        `${API_BASE_URL}/solicitudes-ml/productos-ml`,
      );
      if (res.ok) setCatalogoMl(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSolicitudes();
    loadCatalogo();
  }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setOpenMenuId(null);
  };

  // 🔥 NUEVO: Función para suscribir el navegador/celular actual a las Alertas Push Web
  const suscribirNotificacionesPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return toast.error(
        "Este dispositivo o navegador no soporta alertas push nativas.",
      );
    }

    const toastId = toast.loading("Sincronizando dispositivo...");
    try {
      // 1. Asegurar el registro del Service Worker en la raíz pública
      const registration = await navigator.serviceWorker.register("/sw.js");

      // 2. Solicitar los permisos nativos al sistema operativo móvil/escritorio
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        return toast.error("Permiso denegado por el usuario o sistema.", {
          id: toastId,
        });
      }

      // 3. RECUERDA GENERAR UNA LLAVE REAL CON: npx web-push generate-vapid-keys
      // Coloca la clave generada aquí (debe empezar con la letra B)
      const publicVapidKey =
        import.meta.env.VITE_PUBLIC_VAPID_KEY ||
        "BFsgiKUGqpfGkqvdW1ygK_2qit9YB1YHO-k0RcYGrTBBv1VZjrxlcPb47c3wP7CulkDfZz2Vz1UlnsJT6PvhZCw";

      if (publicVapidKey.startsWith("REPLACE_")) {
        return toast.error(
          "Debes generar y configurar tu clave VAPID pública real primero.",
          { id: toastId },
        );
      }

      // 4. Forzar la limpieza de cualquier suscripción vieja antes de pedir la nueva
      const subExistente = await registration.pushManager.getSubscription();
      if (subExistente) {
        await subExistente.unsubscribe(); // Desuscripción limpia
      }

      // Ahora sí, forzar la suscripción push criptográfica del dispositivo
      const suscripcion = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      // 5. Almacenar el canal push en la tabla de la Base de Datos
      const res = await authFetch(`${API_BASE_URL}/solicitudes-ml/suscribir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suscripcion, usuario: currentUser }),
      });

      if (res.ok) {
        toast.success("¡Alertas Push activadas en este dispositivo!", {
          id: toastId,
        });
      } else {
        toast.error("Error al registrar canal en el servidor.", {
          id: toastId,
        });
      }
    } catch (err) {
      console.error(err);
      // 🔥 CAMBIO TEMPORAL: Ver el error real en pantalla
      const mensajeError = err?.message || JSON.stringify(err) || String(err);
      toast.error(`Fallo: ${mensajeError}`, { id: toastId, duration: 6000 });
    }
  };

  // --- CRUD HANDLERS ---
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.articulo_nombre || !form.cantidad_actual)
      return toast.error("Completa el artículo y stock actual");

    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/solicitudes-ml`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, solicitante: currentUser }),
      });
      if (res.ok) {
        toast.success("Solicitud enviada a Expedición");
        setIsNewModalOpen(false);
        setForm({
          articulo_nombre: "",
          cantidad_actual: "",
          cantidad_sugerida: "",
        });
        setSuggestedSearch("");
        loadSolicitudes();
      }
    } catch (e) {
      toast.error("Error al procesar");
    }
    setSubmitting(false);
  };

  const handleAtenderClick = (sol, estado) => {
    setOpenMenuId(null);
    if (estado === "APROBADA") {
      setSelectedSol(sol);
      setCantidadAprobadaInput(sol.cantidad_sugerida || "");
      setIsPromptQtyModalOpen(true);
    } else {
      ejecutarDictamen(sol.id, "RECHAZADA", null);
    }
  };

  const ejecutarDictamen = async (id, estado, qty) => {
    const finalQty = estado === "APROBADA" ? qty : null;
    if (estado === "APROBADA" && !finalQty)
      return toast.error("Especifica la cantidad aprobada final");

    setSubmitting(true); // Se congela el botón al instante para evitar el doble registro en la auditoría
    try {
      const res = await authFetch(
        `${API_BASE_URL}/solicitudes-ml/${id}/atender`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado,
            cantidad_aprobada: finalQty,
            aprobador: currentUser,
          }),
        },
      );
      if (res.ok) {
        toast.success(`Solicitud marcada como ${estado}`);
        setIsPromptQtyModalOpen(false);
        loadSolicitudes();
      }
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const handleSaveEditQty = async (id) => {
    try {
      const res = await authFetch(
        `${API_BASE_URL}/solicitudes-ml/${id}/editar`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cantidad_sugerida: editQty,
            usuario: currentUser,
          }),
        },
      );
      if (res.ok) {
        toast.success("Sugerencia de stock corregida");
        setEditingId(null);
        loadSolicitudes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleArchivar = async (id) => {
    setOpenMenuId(null);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/solicitudes-ml/${id}/archivar`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuario: currentUser }),
        },
      );
      if (res.ok) {
        toast.success("Enviado al historial archivado");
        loadSolicitudes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAuditoria = async (sol) => {
    setSelectedSol(sol);
    setIsHistoryModalOpen(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/solicitudes-ml/${sol.id}/historial`,
      );
      if (res.ok) setHistorialLogs(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const filteredItems = solicitudes.filter((s) =>
    s.articulo_nombre.toLowerCase().includes(filterTerm.toLowerCase()),
  );
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const currentItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const filteredSuggestions = catalogoMl.filter((p) =>
    p.toLowerCase().includes(suggestedSearch.toLowerCase()),
  );

  return (
    <div
      className="min-h-full bg-[#fcfbf9] p-4 md:p-8 flex flex-col font-sans animate-in fade-in pb-16"
      onClick={() => setOpenMenuId(null)}
    >
      {/* HEADER PRINCIPAL */}
      <header className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0 pr-24">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
            <FaBox size={18} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">
              Abastecimiento MercadoLibre
            </h1>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
              Sincronización y Validación de Stock en Canales Digitales
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* 🔥 Botón para enlazar alertas Push nativas del celular o escritorio actual */}
          <button
            onClick={suscribirNotificacionesPush}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 font-bold text-xs px-5 py-3.5 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Activar notificaciones push en este dispositivo"
          >
            <FaBell className="text-amber-500 animate-pulse" size={12} />{" "}
            ACTIVAR ALERTAS
          </button>

          {(!isExpedicion ||
            ["GERENCIA", "JEFE PRODUCCION"].includes(rolNormalizado)) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsNewModalOpen(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-3.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FaPlus size={10} /> CREAR SOLICITUD
            </button>
          )}
        </div>
      </header>

      {/* PESTAÑAS DE CONTROL */}
      <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-200 w-fit mb-4 shrink-0">
        <button
          onClick={() => handleTabChange("ACTIVAS")}
          className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${activeTab === "ACTIVAS" ? "bg-white text-slate-800 shadow-sm" : "text-stone-400 hover:text-stone-600"}`}
        >
          Solicitudes Activas
        </button>
        <button
          onClick={() => handleTabChange("ARCHIVADAS")}
          className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${activeTab === "ARCHIVADAS" ? "bg-white text-slate-800 shadow-sm" : "text-stone-400 hover:text-stone-600"}`}
        >
          Historial Archivado
        </button>
      </div>

      {/* BUSCADOR DE TABLA LOCAL */}
      <div className="relative mb-4 max-w-md shrink-0">
        <FaSearch className="absolute left-4 top-4 text-stone-300" size={13} />
        <input
          type="text"
          placeholder="Filtrar tabla en tiempo real..."
          className="w-full bg-white border border-stone-200 rounded-xl py-3.5 pl-11 pr-4 text-xs font-bold outline-none shadow-sm"
          value={filterTerm}
          onChange={(e) => {
            setFilterTerm(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* TABLA PRINCIPAL DE CONTROLES */}
      <div className="flex-1 bg-white border border-stone-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader />
          </div>
        ) : currentItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-stone-400">
            <FaClipboardList size={32} className="mb-2 opacity-60" />
            <p className="text-xs font-bold">
              No se registran solicitudes en este bloque
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-100 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                  <th className="p-4 pl-6 w-40">Fecha y Hora</th>
                  <th className="p-4">Artículo</th>
                  <th className="p-4">Stock Actual</th>
                  <th className="p-4">Sugerido ML</th>
                  <th className="p-4">Cant. Aprobada</th>
                  <th className="p-4">Aprobó</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-center">Auditoría</th>
                  <th className="p-4 pr-6 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="text-xs font-semibold text-slate-600 divide-y divide-stone-50">
                {currentItems.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-stone-50/40 transition-colors"
                  >
                    <td className="p-4 pl-6 font-bold text-slate-400 whitespace-nowrap">
                      {formatearFechaHoraML(s.fecha_creacion)}
                    </td>
                    <td className="p-4 font-bold text-slate-800 max-w-xs truncate">
                      {s.articulo_nombre}
                    </td>
                    <td className="p-4 font-extrabold text-slate-500">
                      {s.cantidad_actual} u.
                    </td>
                    <td className="p-4">
                      {editingId === s.id ? (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            className="border border-stone-200 p-1 w-20 rounded font-bold"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                          />
                          <button
                            onClick={() => handleSaveEditQty(s.id)}
                            className="bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-bold"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <span className="font-extrabold text-amber-600">
                          {s.cantidad_sugerida
                            ? `${s.cantidad_sugerida} u.`
                            : "-"}
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-blue-600">
                      {s.cantidad_aprobada ? `${s.cantidad_aprobada} u.` : "-"}
                    </td>
                    <td className="p-4 font-bold text-slate-500">
                      {s.aprobador || "-"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-md text-[9px] font-semibold tracking-wide border ${s.estado === "APROBADA" ? "bg-emerald-50 border-emerald-100 text-emerald-600" : s.estado === "RECHAZADA" ? "bg-rose-50 border-rose-100 text-rose-500" : "bg-amber-50 border-amber-100 text-amber-600"}`}
                      >
                        {s.estado}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAuditoria(s);
                        }}
                        className="text-stone-400 hover:text-slate-800 p-2 rounded-lg transition-colors cursor-pointer"
                        title="Ver historial de cambios"
                      >
                        <FaHistory size={14} />
                      </button>
                    </td>

                    {/* MENÚ DE 3 PUNTOS PREMIUM */}
                    <td className="p-4 pr-6 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === s.id ? null : s.id);
                        }}
                        className="p-2 text-stone-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <FaEllipsisV size={13} />
                      </button>

                      <AnimatePresence>
                        {openMenuId === s.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -5 }}
                            className="absolute right-6 top-10 w-44 bg-white border border-stone-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isExpedicion && s.estado === "PENDIENTE" && (
                              <>
                                <button
                                  disabled={submitting}
                                  onClick={() =>
                                    handleAtenderClick(s, "APROBADA")
                                  }
                                  className="w-full px-4 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 disabled:opacity-40"
                                >
                                  <FaCheckCircle /> Aprobar Cambio
                                </button>
                                <button
                                  disabled={submitting}
                                  onClick={() =>
                                    handleAtenderClick(s, "RECHAZADA")
                                  }
                                  className="w-full px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2 disabled:opacity-40"
                                >
                                  <FaTimesCircle /> Rechazar Cambio
                                </button>
                              </>
                            )}

                            {(!isExpedicion ||
                              ["GERENCIA", "JEFE PRODUCCION"].includes(
                                rolNormalizado,
                              )) &&
                              s.estado === "PENDIENTE" && (
                                <button
                                  onClick={() => {
                                    setEditingId(s.id);
                                    setEditQty(s.cantidad_sugerida || "");
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                >
                                  <FaEdit /> Editar Cantidad
                                </button>
                              )}

                            {(!isExpedicion ||
                              ["GERENCIA", "JEFE PRODUCCION"].includes(
                                rolNormalizado,
                              )) &&
                              (s.estado === "APROBADA" ||
                                s.estado === "RECHAZADA") &&
                              activeTab === "ACTIVAS" && (
                                <button
                                  onClick={() => handleArchivar(s.id)}
                                  className="w-full px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50 flex items-center gap-2"
                                >
                                  <FaArchive /> Mudar a Archivo
                                </button>
                              )}

                            {s.estado !== "PENDIENTE" &&
                              activeTab === "ARCHIVADAS" && (
                                <div className="px-4 py-2 text-[10px] font-bold text-stone-400 uppercase">
                                  Sin acciones
                                </div>
                              )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINADOR */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex justify-center items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-2 border rounded-lg bg-white disabled:opacity-40"
            >
              <FaChevronLeft size={10} />
            </button>
            <span className="text-xs font-bold text-stone-500">
              Página {currentPage} de {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-2 border rounded-lg bg-white disabled:opacity-40"
            >
              <FaChevronRight size={10} />
            </button>
          </div>
        )}
      </div>

      {/* --- MODAL 1: CREAR SOLICITUD --- */}
      <AnimatePresence>
        {isNewModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-6 md:p-8 relative overflow-visible"
            >
              <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <FaBox className="text-[#2196f3]" /> Solicitar Incremento de
                Stock
              </h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="relative">
                  <label className="text-[9px] font-semibold uppercase text-stone-400 tracking-wider block mb-1">
                    Artículo MercadoLibre
                  </label>
                  <input
                    type="text"
                    placeholder="Escribe para filtrar catálogo..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs font-bold outline-none"
                    value={suggestedSearch}
                    onChange={(e) => {
                      setSuggestedSearch(e.target.value);
                      setShowDropdown(true);
                      setForm({ ...form, articulo_nombre: e.target.value });
                    }}
                    onFocus={() => setShowDropdown(true)}
                  />
                  {showDropdown && suggestedSearch.length > 0 && (
                    <div className="absolute left-0 right-0 bg-white border border-stone-200 mt-1 max-h-40 overflow-y-auto rounded-xl shadow-lg z-[210] custom-scrollbar text-xs font-bold">
                      {filteredSuggestions.slice(0, 8).map((item, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setForm({ ...form, articulo_nombre: item });
                            setSuggestedSearch(item);
                            setShowDropdown(false);
                          }}
                          className="p-3 hover:bg-stone-50 cursor-pointer text-slate-700"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-stone-400 tracking-wider block mb-1">
                      Stock Actual Canales
                    </label>
                    <input
                      type="number"
                      placeholder="Ej: 2"
                      className="w-full bg-stone-50 border border-transparent rounded-xl p-3.5 text-xs font-bold outline-none shadow-inner"
                      value={form.cantidad_actual}
                      onChange={(e) =>
                        setForm({ ...form, cantidad_actual: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-stone-400 tracking-wider block mb-1">
                      Sugerencia Sube a (Opcional)
                    </label>
                    <input
                      type="number"
                      placeholder="Ej: 50"
                      className="w-full bg-stone-50 border border-transparent rounded-xl p-3.5 text-xs font-bold outline-none shadow-inner"
                      value={form.cantidad_sugerida}
                      onChange={(e) =>
                        setForm({ ...form, cantidad_sugerida: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setIsNewModalOpen(false);
                      setSuggestedSearch("");
                    }}
                    className="flex-1 bg-stone-100 text-slate-600 font-bold text-xs py-3.5 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 text-white font-semibold text-xs py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      "Enviar Pedido"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: CANTIDAD APROBADA (CON ESCUDO REFORZADO ANTI-DUPLICADOS) --- */}
      <AnimatePresence>
        {isPromptQtyModalOpen && selectedSol && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 border border-stone-100"
            >
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                Confirmación de Stock
              </h3>
              <p className="text-[11px] font-semibold text-stone-400 leading-relaxed mb-4">
                Ingresa la cantidad final que fue physically validada y aprobada
                para subir a los canales de MercadoLibre.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-semibold uppercase text-stone-400 block mb-1">
                    Unidades Autorizadas
                  </label>
                  <input
                    type="number"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs font-bold outline-none"
                    value={cantidadAprobadaInput}
                    onChange={(e) => setCantidadAprobadaInput(e.target.value)}
                    placeholder="Cantidad aprobada..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setIsPromptQtyModalOpen(false)}
                    className="flex-1 bg-stone-100 text-slate-600 font-bold text-xs py-3 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      ejecutarDictamen(
                        selectedSol.id,
                        "APROBADA",
                        cantidadAprobadaInput,
                      )
                    }
                    className="flex-1 bg-emerald-500 text-white font-semibold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      "Aprobar Stock"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 3: AUDITORÍA E HISTORIAL --- */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedSol && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-6 md:p-8 flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center border-b border-stone-100 pb-3 mb-4">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FaHistory className="text-slate-400" /> Trazabilidad e
                  Historial
                </h3>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="text-stone-400 hover:text-slate-700"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 text-xs">
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 mb-2">
                  <p className="font-bold text-slate-700 mb-1">
                    Artículo Auditado:
                  </p>
                  <p className="font-semibold text-stone-500">
                    {selectedSol.articulo_nombre}
                  </p>
                </div>
                {historialLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm"
                  >
                    <div className="flex justify-between text-[9px] text-stone-400 font-semibold uppercase mb-1">
                      <span className="flex items-center gap-1">
                        <FaUser /> @{log.usuario}
                      </span>
                      <span>{formatearFechaHoraML(log.fecha)}</span>
                    </div>
                    <p className="font-semibold text-slate-600 leading-normal">
                      {log.cambio}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
