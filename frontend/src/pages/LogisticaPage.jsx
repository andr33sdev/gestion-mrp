import React, { useEffect, useState, useRef } from "react";
import {
  FaTruck,
  FaPlus,
  FaCheckCircle,
  FaClock,
  FaBoxOpen,
  FaUser,
  FaTrash,
  FaHistory,
  FaList,
  FaInfoCircle,
  FaCheckDouble,
  FaPaperPlane,
  FaComments,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils";
import Loader from "../components/Loader";
import { getAuthData } from "../auth/authHelper";

// --- HELPER DE FECHAS UTC-3 ---
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

// --- COMPONENTES VISUALES ---
const PriorityBadge = ({ priority }) => {
  const colors = {
    ALTA: "bg-red-500 text-white animate-pulse",
    MEDIA: "bg-amber-500 text-black",
    BAJA: "bg-blue-500 text-white",
  };
  return (
    <span
      className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
        colors[priority] || colors.MEDIA
      }`}
    >
      {priority}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    PENDIENTE: "bg-gray-700 text-gray-300 border-gray-600",
    APROBADO: "bg-blue-900/30 text-blue-400 border-blue-600",
    PREPARADO: "bg-purple-900/30 text-purple-400 border-purple-600",
    FINALIZADO: "bg-green-900/30 text-green-400 border-green-600",
    RECHAZADO: "bg-red-900/30 text-red-400 border-red-600",
    ELIMINADO: "bg-slate-800 text-gray-600 border-gray-700 line-through",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
        styles[status] || styles.PENDIENTE
      }`}
    >
      {status}
    </span>
  );
};

export default function LogisticaPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const { role, username } = getAuthData();

  // --- PERSONALIZACIÓN DE NOMBRES ---
  let currentUser = username;
  const rolNormalizado = role ? role.toUpperCase() : "";

  if (rolNormalizado === "GERENCIA") {
    currentUser = "Andrés";
  } else if (rolNormalizado === "OPERARIO" || rolNormalizado === "PANEL") {
    currentUser = "Leonel";
  } else if (rolNormalizado === "DEPOSITO" || rolNormalizado === "DEPÓSITO") {
    currentUser = "Mauro";
  } else {
    currentUser = currentUser || role || "Anónimo";
  }
  // -----------------------------------

  // --- PERMISOS ---
  const isBoss = [
    "GERENCIA",
    "PLANIFICACION",
    "EXPEDICION",
    "DEPOSITO",
    "DEPÓSITO",
    "OPERARIO",
    "PANEL",
  ].includes(rolNormalizado);

  // Mantenemos "notas" en el estado pero ya no lo mostramos en el form
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
          (a, b) => new Date(a.fecha) - new Date(b.fecha)
        )
      );

      setComments(comms);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments, activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producto || !form.cantidad) return alert("Faltan datos");
    setLoading(true);

    await authFetch(`${API_BASE_URL}/logistica`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, solicitante: currentUser }),
    });
    setForm({ producto: "", cantidad: "", prioridad: "MEDIA", notas: "" });
    setIsNewModalOpen(false);
    loadRequests();
  };

  const handleStatusChange = async (e, id, newStatus) => {
    e.stopPropagation();
    if (!confirm(`¿Cambiar estado a ${newStatus}?`)) return;

    await authFetch(`${API_BASE_URL}/logistica/${id}/estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: newStatus, usuario: currentUser }),
    });
    loadRequests();
    if (selectedRequest && selectedRequest.id === id) {
      setTimeout(
        () => loadRequestDetails({ ...selectedRequest, estado: newStatus }),
        500
      );
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar solicitud?")) return;
    await authFetch(`${API_BASE_URL}/logistica/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: currentUser }),
    });
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
      }
    );
    loadRequestDetails(selectedRequest);
  };

  const activeRequests = requests.filter(
    (r) =>
      r.estado !== "ENTREGADO" &&
      r.estado !== "RECHAZADO" &&
      r.estado !== "ELIMINADO"
  );

  const getIcon = (acc) => {
    if (acc === "CREADO") return <FaPlus size={10} />;
    if (acc === "APROBADO") return <FaCheckCircle size={10} />;
    if (acc === "PREPARADO") return <FaBoxOpen size={10} />;
    if (acc === "ENTREGADO") return <FaCheckDouble size={10} />;
    if (acc === "COMENTARIO") return <FaComments size={10} />;
    return <FaInfoCircle size={10} />;
  };

  if (loading && requests.length === 0) return <Loader />;

  return (
    <div className="animate-in fade-in pb-24">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg mb-6 sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FaTruck className="text-orange-500" /> Logística Interna
          </h1>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              setIsDetailModalOpen(true);
              setSelectedRequest(null);
            }}
            className="bg-slate-700 hover:bg-slate-600 text-gray-300 px-4 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg flex-1 md:flex-none justify-center"
          >
            <FaHistory /> <span className="hidden md:inline">HISTORIAL</span>
          </button>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg active:scale-95 flex-1 md:flex-none justify-center"
          >
            <FaPlus /> NUEVA
          </button>
        </div>
      </div>

      {/* GRID ACTIVO */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeRequests.map((req) => (
          <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key={req.id}
            onClick={() => openDetailModal(req, "CHAT")}
            className={`bg-slate-800 rounded-xl p-4 border-l-4 shadow-md flex flex-col gap-2 relative group cursor-pointer hover:bg-slate-750 transition-colors
            ${
              req.estado === "PENDIENTE"
                ? req.prioridad === "ALTA"
                  ? "border-red-500"
                  : "border-blue-500"
                : req.estado === "PREPARADO"
                ? "border-purple-500"
                : "border-green-500"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <PriorityBadge priority={req.prioridad} />
                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <FaClock size={10} />{" "}
                    {formatearFechaHora(req.fecha_creacion).split(" ")[0]}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {req.producto}
                </h3>
              </div>
              <div className="text-right">
                <span className="block text-2xl font-mono font-bold text-white">
                  {req.cantidad}
                </span>
                <span className="text-[10px] text-gray-500 uppercase">
                  Unidades
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 mt-1 border-t border-slate-700/50 pt-2">
              <span className="flex items-center gap-1">
                <FaUser /> {req.solicitante || "Anónimo"}
              </span>
              <StatusBadge status={req.estado} />
            </div>

            <div className="mt-3 flex gap-2">
              {/* BOTONES DE ACCIÓN */}
              {req.estado === "PENDIENTE" && isBoss && (
                <>
                  <button
                    onClick={(e) => handleStatusChange(e, req.id, "APROBADO")}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-xs font-bold"
                  >
                    APROBAR
                  </button>
                  <button
                    onClick={(e) => handleStatusChange(e, req.id, "RECHAZADO")}
                    className="flex-1 bg-slate-700 hover:bg-red-900 text-gray-300 hover:text-white py-2 rounded text-xs font-bold"
                  >
                    RECHAZAR
                  </button>
                </>
              )}

              {req.estado === "APROBADO" && isBoss && (
                <button
                  onClick={(e) => handleStatusChange(e, req.id, "PREPARADO")}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-2"
                >
                  <FaBoxOpen /> LISTO PARA DESPACHAR
                </button>
              )}

              {req.estado === "PREPARADO" && isBoss && (
                <button
                  onClick={(e) => handleStatusChange(e, req.id, "ENTREGADO")}
                  className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-2"
                >
                  <FaCheckDouble /> ENTREGADO
                </button>
              )}

              <button
                onClick={(e) => handleDelete(e, req.id)}
                className="p-2 text-gray-600 hover:text-red-500 ml-auto z-10"
              >
                <FaTrash />
              </button>
            </div>
          </motion.div>
        ))}
        {activeRequests.length === 0 && (
          <div className="col-span-full py-10 text-center text-gray-500">
            Sin solicitudes pendientes.
          </div>
        )}
      </div>

      {/* --- MODAL NUEVA SOLICITUD (SIMPLIFICADO) --- */}
      <AnimatePresence>
        {isNewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-slate-800 w-full md:max-w-md rounded-t-2xl md:rounded-2xl border border-slate-600 shadow-2xl"
            >
              <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                {/* Título Cambiado */}
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FaPlus className="text-orange-500" /> Solicitar
                </h3>
                <button
                  onClick={() => setIsNewModalOpen(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  &times;
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold">
                    Producto
                  </label>
                  <input
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white mt-1"
                    value={form.producto}
                    onChange={(e) =>
                      setForm({ ...form, producto: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Cant.
                    </label>
                    <input
                      type="number"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white mt-1"
                      value={form.cantidad}
                      onChange={(e) =>
                        setForm({ ...form, cantidad: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Prioridad
                    </label>
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white mt-1"
                      value={form.prioridad}
                      onChange={(e) =>
                        setForm({ ...form, prioridad: e.target.value })
                      }
                    >
                      <option value="BAJA">Baja</option>
                      <option value="MEDIA">Media</option>
                      <option value="ALTA">Alta</option>
                    </select>
                  </div>
                </div>
                {/* CAMPO NOTAS ELIMINADO VISUALMENTE */}
                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl mt-2"
                >
                  ENVIAR SOLICITUD
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL DETALLE --- */}
      <AnimatePresence>
        {isDetailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-4">
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 w-full max-w-5xl h-[90vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <FaList className="text-blue-500" /> Panel Global
                </h3>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedRequest(null);
                  }}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
                <div
                  className={`${
                    selectedRequest ? "hidden md:block" : "block"
                  } flex-1 overflow-y-auto custom-scrollbar border-r border-slate-700 bg-slate-900/50`}
                >
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead className="bg-slate-800 text-gray-400 sticky top-0 uppercase text-xs z-10">
                      <tr>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Producto</th>
                        <th className="p-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {requests.map((req) => (
                        <tr
                          key={req.id}
                          onClick={() => openDetailModal(req)}
                          className={`cursor-pointer transition-colors ${
                            selectedRequest?.id === req.id
                              ? "bg-blue-900/20"
                              : "hover:bg-slate-800"
                          }`}
                        >
                          <td className="p-3 text-xs whitespace-nowrap text-gray-400">
                            {
                              formatearFechaHora(req.fecha_creacion).split(
                                " "
                              )[0]
                            }
                            <br />
                            <span className="opacity-50">
                              {
                                formatearFechaHora(req.fecha_creacion).split(
                                  " "
                                )[1]
                              }
                            </span>
                          </td>
                          <td className="p-3 font-medium text-white">
                            {req.producto}
                            <span className="block text-gray-500 text-[10px]">
                              {req.cantidad} u. • {req.solicitante}
                            </span>
                          </td>
                          <td className="p-3">
                            <StatusBadge status={req.estado} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  className={`${
                    !selectedRequest ? "hidden md:flex" : "flex"
                  } w-full md:w-5/12 bg-slate-800 flex-col border-t md:border-t-0 border-slate-700`}
                >
                  {!selectedRequest ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6">
                      <FaHistory className="text-4xl mb-3 opacity-30" />
                      <p>Selecciona una solicitud.</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center shadow-md z-10">
                        <div>
                          <button
                            onClick={() => setSelectedRequest(null)}
                            className="md:hidden text-gray-400 text-xs mb-1"
                          >
                            ← Volver
                          </button>
                          <h4 className="text-white font-bold text-lg leading-none">
                            Solicitud #{selectedRequest.id}
                          </h4>
                          <p className="text-xs text-orange-400 mt-1">
                            {selectedRequest.producto} (
                            {selectedRequest.cantidad})
                          </p>
                        </div>
                        <div className="flex bg-slate-900 rounded p-1">
                          <button
                            onClick={() => setActiveTab("TIMELINE")}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                              activeTab === "TIMELINE"
                                ? "bg-blue-600 text-white"
                                : "text-gray-400"
                            }`}
                          >
                            AUDITORÍA
                          </button>
                          <button
                            onClick={() => setActiveTab("CHAT")}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                              activeTab === "CHAT"
                                ? "bg-green-600 text-white"
                                : "text-gray-400"
                            }`}
                          >
                            CHAT
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-slate-900/30">
                        {loadingData ? (
                          <div className="flex justify-center p-10">
                            <Loader />
                          </div>
                        ) : activeTab === "TIMELINE" ? (
                          <div className="p-6">
                            <div className="relative border-l-2 border-slate-600 ml-3 space-y-8 pl-6">
                              {historyTimeline.map((log, i) => (
                                <div key={i} className="relative">
                                  <div
                                    className={`absolute -left-[33px] top-0 h-8 w-8 rounded-full border-4 border-slate-800 flex items-center justify-center ${
                                      log.esOriginal
                                        ? "bg-orange-500 text-white"
                                        : "bg-slate-700 text-gray-300"
                                    }`}
                                  >
                                    {getIcon(log.accion)}
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex justify-between">
                                      <span className="text-xs font-bold text-blue-400">
                                        {log.accion}
                                      </span>
                                      <span className="text-[10px] text-gray-500">
                                        {formatearFechaHora(log.fecha)}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-200 mt-1">
                                      {log.detalle}
                                    </p>
                                    <span className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                      <FaUser /> {log.usuario}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col h-full">
                            <div className="flex-1 p-4 space-y-3">
                              {comments.length === 0 && (
                                <p className="text-center text-gray-500 text-xs mt-10">
                                  No hay comentarios aún. ¡Inicia la
                                  conversación!
                                </p>
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
                                    <span className="text-[10px] text-gray-400 mb-0.5 px-1 font-bold">
                                      {msg.usuario}
                                    </span>
                                    <div
                                      className={`max-w-[85%] p-3 rounded-xl text-sm shadow-md ${
                                        isMe
                                          ? "bg-green-700 text-white rounded-tr-none"
                                          : "bg-slate-700 text-gray-200 rounded-tl-none"
                                      }`}
                                    >
                                      <p>{msg.mensaje}</p>
                                    </div>
                                    <span className="text-[9px] text-gray-600 mt-0.5 px-1">
                                      {
                                        formatearFechaHora(msg.fecha).split(
                                          " "
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
                          className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2"
                        >
                          <input
                            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-green-500 outline-none"
                            placeholder="Escribe un comentario..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                          />
                          <button
                            type="submit"
                            className="bg-green-600 hover:bg-green-500 text-white p-3 rounded-lg"
                          >
                            <FaPaperPlane />
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
