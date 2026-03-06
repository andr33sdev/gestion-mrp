import React, { useState, useEffect } from "react";
import {
  FaIndustry,
  FaExclamationTriangle,
  FaFire,
  FaTruck,
  FaSync,
  FaHardHat,
  FaBoxOpen,
  FaClipboardList,
  FaCogs,
  FaPlus,
  FaTimes,
  FaTrash,
  FaCheck,
  FaPowerOff,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils";

// --- ANIMACIONES CSS GLOBALES PARA LAS MÁQUINAS ---
const machineStyles = `
  @keyframes smokeFloat {
    0% { transform: translateY(0) scale(1); opacity: 0.6; }
    100% { transform: translateY(-20px) scale(2); opacity: 0; }
  }
  @keyframes sleepZ {
    0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translate(12px, -24px) scale(1.2); opacity: 0; }
  }
  @keyframes gentleBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1.5px); }
  }
  @keyframes blinkGlow {
    0%, 100% { fill: #f59e0b; opacity: 0.8; }
    50% { fill: #fbbf24; opacity: 1; }
  }
  .animate-smoke-1 { animation: smokeFloat 2s infinite ease-out; }
  .animate-smoke-2 { animation: smokeFloat 2.5s infinite ease-out 0.7s; }
  .animate-smoke-3 { animation: smokeFloat 2.2s infinite ease-out 1.4s; }
  .animate-sleep-1 { animation: sleepZ 3s infinite ease-out; }
  .animate-sleep-2 { animation: sleepZ 3s infinite ease-out 1.5s; }
  .machine-active { animation: gentleBounce 1s infinite ease-in-out; }
`;

// --- COMPONENTE: MÁQUINA ESTILO PIXEL/STARDEW SUTIL ---
const CuteMachine = ({ active }) => (
  <div className="relative w-16 h-16 flex items-end justify-center shrink-0">
    <style>{machineStyles}</style>
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {active ? (
        <>
          <div className="absolute top-2 left-6 w-1.5 h-1.5 bg-slate-300 rounded-full animate-smoke-1 opacity-0"></div>
          <div className="absolute top-3 left-7 w-2 h-2 bg-slate-200 rounded-full animate-smoke-2 opacity-0"></div>
          <div className="absolute top-1 left-5 w-1.5 h-1.5 bg-slate-300 rounded-full animate-smoke-3 opacity-0"></div>
        </>
      ) : (
        <>
          <div className="absolute top-2 left-6 text-[10px] font-bold text-slate-400 animate-sleep-1 opacity-0">
            Z
          </div>
          <div className="absolute top-4 left-8 text-[8px] font-bold text-slate-300 animate-sleep-2 opacity-0">
            z
          </div>
        </>
      )}
    </div>
    <svg
      viewBox="0 0 40 40"
      className={`w-12 h-12 ${active ? "machine-active" : ""}`}
    >
      <rect
        x="14"
        y="6"
        width="6"
        height="8"
        rx="1"
        fill={active ? "#94a3b8" : "#cbd5e1"}
      />
      <rect
        x="12"
        y="4"
        width="10"
        height="3"
        rx="1"
        fill={active ? "#64748b" : "#94a3b8"}
      />
      <rect
        x="4"
        y="14"
        width="32"
        height="24"
        rx="4"
        fill={active ? "#e2e8f0" : "#f1f5f9"}
        stroke={active ? "#94a3b8" : "#cbd5e1"}
        strokeWidth="2"
      />
      <rect
        x="10"
        y="20"
        width="20"
        height="10"
        rx="2"
        fill={active ? "#1e293b" : "#cbd5e1"}
      />
      {active && (
        <rect
          x="12"
          y="22"
          width="16"
          height="6"
          rx="1"
          style={{ animation: "blinkGlow 2s infinite" }}
        />
      )}
      <circle cx="8" cy="18" r="1.5" fill={active ? "#10b981" : "#94a3b8"} />
      <circle cx="32" cy="18" r="1.5" fill={active ? "#ef4444" : "#94a3b8"} />
      <rect x="8" y="38" width="6" height="2" rx="1" fill="#64748b" />
      <rect x="26" y="38" width="6" height="2" rx="1" fill="#64748b" />
    </svg>
  </div>
);

export default function CentroComando() {
  const [data, setData] = useState({
    radar: [],
    pedidosCriticos: [],
    alertasStock: [],
    maquinas: [],
  });
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [showMachineModal, setShowMachineModal] = useState(false);
  const [newMachineName, setNewMachineName] = useState("");
  // Estado temporal para manejar el input de cada máquina antes de guardar
  const [editingMachines, setEditingMachines] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE_URL}/planificacion/cockpit/data`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastUpdate(new Date());

        // Sincronizar el estado de edición con la DB
        const editState = {};
        json.maquinas.forEach((m) => (editState[m.id] = m.semielaborado || ""));
        setEditingMachines(editState);
      }

      // Traer productos para el Datalist
      const resProd = await authFetch(
        `${API_BASE_URL}/ingenieria/semielaborados`,
      );
      if (resProd.ok) setAllProducts(await resProd.json());
    } catch (error) {
      console.error("Error al cargar Cockpit:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 180000);
    return () => clearInterval(interval);
  }, []);

  // --- FUNCIONES CRUD MÁQUINAS ---
  const handleAddMachine = async (e) => {
    e.preventDefault();
    if (!newMachineName.trim()) return;
    try {
      await authFetch(`${API_BASE_URL}/planificacion/maquinas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newMachineName }),
      });
      setNewMachineName("");
      fetchData(); // Recargamos para verla
    } catch (e) {}
  };

  const handleDeleteMachine = async (id) => {
    if (!window.confirm("¿Seguro que querés eliminar esta máquina del parque?"))
      return;
    try {
      await authFetch(`${API_BASE_URL}/planificacion/maquinas/${id}`, {
        method: "DELETE",
      });
      fetchData();
    } catch (e) {}
  };

  const handleUpdateMachine = async (id, semielaborado) => {
    try {
      await authFetch(`${API_BASE_URL}/planificacion/maquinas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semielaborado }),
      });
      fetchData();
    } catch (e) {}
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500 overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 z-10 sticky top-0 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm shrink-0">
              <FaIndustry size={18} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-none">
                Torre de Control
              </h1>
              <p className="text-[11px] font-bold text-slate-400 mt-1.5 tracking-widest uppercase flex items-center gap-2">
                Producción en Vivo{" "}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Act:{" "}
              {lastUpdate.toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              onClick={fetchData}
              className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-white text-slate-500 hover:text-blue-600 rounded-xl transition-all shadow-sm"
            >
              <FaSync className={loading ? "animate-spin" : ""} size={12} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto w-full custom-scrollbar p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* SECCIÓN SUPERIOR: ALERTAS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-[1.5rem] p-5 shadow-sm flex flex-col h-80">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <FaTruck className="text-slate-400" /> Pedidos Sin Stock
              </h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {data.pedidosCriticos.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <FaClipboardList size={20} className="mb-2 opacity-50" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      Al día
                    </p>
                  </div>
                ) : (
                  data.pedidosCriticos.map((p) => (
                    <div
                      key={p.op}
                      className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex justify-between items-center hover:bg-white hover:shadow-sm transition-all group"
                    >
                      <div className="min-w-0 pr-4">
                        <div className="flex gap-2 items-center mb-1">
                          <span className="text-[9px] font-bold bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded">
                            OP #{p.op}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            {p.fecha}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-700 truncate">
                          {p.cliente}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {p.modelo}
                        </p>
                      </div>
                      <div className="text-right shrink-0 bg-white border border-slate-100 px-3 py-1.5 rounded-lg shadow-sm">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                          Cantidad
                        </p>
                        <p className="text-sm font-black text-slate-700 leading-none">
                          {p.cantidad}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[1.5rem] p-5 shadow-sm flex flex-col h-80">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <FaExclamationTriangle className="text-slate-400" /> Faltantes
                MRP (Planes Abiertos)
              </h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {data.alertasStock.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <FaBoxOpen size={20} className="mb-2 opacity-50" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      Balance Positivo
                    </p>
                  </div>
                ) : (
                  data.alertasStock.map((mp, i) => (
                    <div
                      key={i}
                      className="bg-rose-50/30 border border-rose-100/50 rounded-xl p-3 flex justify-between items-center hover:bg-rose-50/50 transition-colors"
                    >
                      <p className="text-xs font-bold text-slate-700 truncate pr-4">
                        {mp.nombre}
                      </p>
                      <div className="text-right shrink-0 bg-white border border-rose-100 px-3 py-1.5 rounded-lg shadow-sm">
                        <p className="text-[8px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">
                          Déficit
                        </p>
                        <p className="text-sm font-black text-rose-600 leading-none">
                          {Number(mp.balance).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN INTERMEDIA: GESTIÓN DE MÁQUINAS (Stardew Style) */}
          <div className="bg-white border border-slate-200 rounded-[1.5rem] p-5 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <FaCogs className="text-slate-400" /> Parque de Máquinas
              </h3>
              <button
                onClick={() => setShowMachineModal(true)}
                className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
              >
                <FaPlus size={10} /> Editar Máquinas
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {data.maquinas.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No hay máquinas registradas en la planta.
                </p>
              ) : (
                data.maquinas.map((mac) => (
                  <div
                    key={mac.id}
                    className="min-w-[200px] max-w-[220px] flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3 hover:bg-white hover:shadow-sm transition-all"
                  >
                    <CuteMachine active={!!mac.semielaborado} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest truncate">
                        {mac.nombre}
                      </p>
                      <p
                        className={`text-[9px] font-medium truncate mt-0.5 ${mac.semielaborado ? "text-blue-600" : "text-slate-400 italic"}`}
                      >
                        {mac.semielaborado || "Dormida"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECCIÓN INFERIOR: RADAR DE PISO DE FÁBRICA */}
          <div className="bg-white border border-slate-200 rounded-[1.5rem] p-5 shadow-sm">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <FaFire className="text-slate-400" /> Radar de Producción (En
                Proceso)
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                {data.radar.length} Tareas Activas
              </span>
            </div>

            {data.radar.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-slate-300">
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  No hay procesos activos
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.radar.map((item) => {
                  const req = Number(item.cantidad) || 1;
                  const prod = Number(item.producido) || 0;
                  const progress = Math.min(
                    100,
                    Math.round((prod / req) * 100),
                  );

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col hover:bg-white hover:shadow-sm transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0 pr-2">
                          <p className="text-[8px] font-bold text-blue-500 uppercase tracking-widest truncate mb-0.5">
                            {item.plan_nombre}
                          </p>
                          <h4 className="text-xs font-bold text-slate-700 truncate leading-tight">
                            {item.producto_nombre}
                          </h4>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                          {item.codigo}
                        </span>
                      </div>

                      <div className="mt-auto">
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            Avance
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            {prod} / {req}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1 }}
                            className={`h-full ${progress >= 100 ? "bg-emerald-400" : "bg-blue-400"}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL FUNCIONAL: GESTIÓN DE MÁQUINAS */}
      <AnimatePresence>
        {showMachineModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[2rem] shadow-xl flex flex-col overflow-hidden max-h-[90vh]"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FaCogs className="text-slate-400" /> Gestión de Parque
                </h3>
                <button
                  onClick={() => setShowMachineModal(false)}
                  className="text-slate-400 hover:text-rose-500 bg-white shadow-sm rounded-full p-1.5 border border-slate-100"
                >
                  <FaTimes size={12} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                {/* 1. CREAR NUEVA MÁQUINA */}
                <form
                  onSubmit={handleAddMachine}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 items-end"
                >
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                      Crear Nueva Máquina
                    </label>
                    <input
                      type="text"
                      required
                      value={newMachineName}
                      onChange={(e) => setNewMachineName(e.target.value)}
                      placeholder="Ej: Inyectora 3..."
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-blue-500 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-all"
                  >
                    <FaPlus /> Agregar
                  </button>
                </form>

                {/* 2. LISTA DE MÁQUINAS Y ASIGNACIÓN */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Máquinas Registradas ({data.maquinas.length})
                  </h4>
                  <div className="space-y-3">
                    {data.maquinas.length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center py-4">
                        No hay máquinas.
                      </p>
                    )}

                    {data.maquinas.map((mac) => (
                      <div
                        key={mac.id}
                        className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-4 hover:shadow-sm transition-all"
                      >
                        {/* Info e Ícono */}
                        <div className="flex items-center gap-3 w-full sm:w-1/3 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-100 pb-3 sm:pb-0">
                          <div className="scale-75 origin-left -my-2">
                            <CuteMachine active={!!mac.semielaborado} />
                          </div>
                          <p className="text-xs font-bold text-slate-700 truncate">
                            {mac.nombre}
                          </p>
                        </div>

                        {/* Asignación de Producto */}
                        <div className="flex-1 w-full flex items-center gap-2">
                          <input
                            list="lista-semis"
                            value={
                              editingMachines[mac.id] !== undefined
                                ? editingMachines[mac.id]
                                : mac.semielaborado || ""
                            }
                            onChange={(e) =>
                              setEditingMachines({
                                ...editingMachines,
                                [mac.id]: e.target.value,
                              })
                            }
                            placeholder="Máquina inactiva. Buscar producto..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-blue-500 outline-none text-blue-900 font-medium"
                          />
                          <datalist id="lista-semis">
                            {allProducts.map((p) => (
                              <option key={p.id} value={p.nombre}>
                                {p.codigo}
                              </option>
                            ))}
                          </datalist>

                          {/* Botones de Acción */}
                          <button
                            onClick={() =>
                              handleUpdateMachine(
                                mac.id,
                                editingMachines[mac.id],
                              )
                            }
                            className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 p-2 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors"
                            title="Guardar Asignación"
                          >
                            <FaCheck />
                          </button>
                          <button
                            onClick={() => {
                              setEditingMachines({
                                ...editingMachines,
                                [mac.id]: "",
                              });
                              handleUpdateMachine(mac.id, "");
                            }}
                            className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 p-2 rounded-lg hover:bg-slate-200 transition-colors"
                            title="Apagar Máquina"
                          >
                            <FaPowerOff />
                          </button>
                          <button
                            onClick={() => handleDeleteMachine(mac.id)}
                            className="text-[10px] text-rose-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors ml-2"
                            title="Eliminar Máquina"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
