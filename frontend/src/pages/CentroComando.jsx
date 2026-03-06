import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  FaIndustry,
  FaExclamationTriangle,
  FaFire,
  FaTruck,
  FaSync,
  FaBoxOpen,
  FaClipboardList,
  FaCogs,
  FaPlus,
  FaTimes,
  FaTrash,
  FaCheckCircle,
  FaPowerOff,
  FaBoxes,
  FaHammer,
  FaTools,
  FaFileInvoice,
  FaSave,
  FaSearch,
  FaChevronDown,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils";
import toast from "react-hot-toast";

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
  
  /* Scrollbar estético para el dropdown */
  .custom-dropdown-scroll::-webkit-scrollbar { width: 6px; }
  .custom-dropdown-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-dropdown-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .custom-dropdown-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
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

// HELPER: Normaliza textos
const normalizeString = (str) => {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
};

// --- COMPONENTE BUSCADOR ELEGANTE ---
const CustomSelect = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  // Cerrar al clickear afuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtrar opciones (CON PROTECCIÓN ANTI-NULL)
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((opt) => {
      const nombre = opt.nombre || ""; // Si es null, usa texto vacío
      const codigo = opt.codigo || ""; // Si es null, usa texto vacío
      return (
        nombre.toLowerCase().includes(term) ||
        codigo.toLowerCase().includes(term)
      );
    });
  }, [options, searchTerm]);

  // Mostrar el nombre seleccionado cuando está cerrado
  const displayValue = useMemo(() => {
    if (isOpen) return searchTerm;
    const selected = options.find((opt) => opt.nombre === value);
    return selected
      ? `${selected.codigo ? selected.codigo + " - " : ""}${selected.nombre || ""}`
      : "";
  }, [value, isOpen, searchTerm, options]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className={`flex items-center w-full bg-slate-50 border ${isOpen ? "border-blue-400 ring-2 ring-blue-50" : "border-slate-200 hover:border-slate-300"} rounded-xl px-3 py-2.5 transition-all cursor-text`}
        onClick={() => setIsOpen(true)}
      >
        <FaSearch
          className={`mr-2.5 text-xs ${isOpen ? "text-blue-500" : "text-slate-400"}`}
        />
        <input
          type="text"
          className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400 placeholder:font-medium"
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm(""); // Limpiar al enfocar para buscar de nuevo
          }}
        />
        <FaChevronDown
          className={`ml-2 text-[10px] text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[999] top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] overflow-hidden"
          >
            <div className="max-h-[220px] overflow-y-auto custom-dropdown-scroll p-1.5">
              {filteredOptions.length === 0 ? (
                <div className="p-3 text-center text-xs font-medium text-slate-400">
                  No se encontraron resultados
                </div>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.nombre || "");
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex flex-col gap-0.5 ${value === opt.nombre ? "bg-blue-50/80" : "hover:bg-slate-50"}`}
                  >
                    <span
                      className={`font-bold ${value === opt.nombre ? "text-blue-700" : "text-slate-700"}`}
                    >
                      {opt.nombre || "SIN NOMBRE"}
                    </span>
                    {opt.codigo && (
                      <span
                        className={`text-[9px] font-mono font-medium ${value === opt.nombre ? "text-blue-500" : "text-slate-400"}`}
                      >
                        {opt.codigo}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function CentroComando() {
  const [data, setData] = useState({
    radar: [],
    pedidosCriticos: [],
    alertasStock: [],
    maquinas: [],
    tareasArmado: [],
    pedidosHistorial: [],
  });

  const [allProducts, setAllProducts] = useState([]);
  const [recetasProductos, setRecetasProductos] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Estado para Crear Máquinas
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [newMachineName, setNewMachineName] = useState("");

  // Estados del Modal Individual de Máquinas
  const [selectedMaquina, setSelectedMaquina] = useState(null);
  const [machineConfigs, setMachineConfigs] = useState([]);
  const [showDetailsIdx, setShowDetailsIdx] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE_URL}/planificacion/cockpit/data`);
      if (res.ok) {
        setData(await res.json());
        setLastUpdate(new Date());
      }
      const resProd = await authFetch(
        `${API_BASE_URL}/ingenieria/semielaborados`,
      );
      if (resProd.ok) setAllProducts(await resProd.json());
      const resRecetas = await authFetch(
        `${API_BASE_URL}/ingenieria/recetas/all`,
      );
      if (resRecetas.ok) setRecetasProductos(await resRecetas.json());
    } catch (error) {
      console.error("Error al cargar Cockpit:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const kpis = {
    produciendo: data.radar.length,
    pedidosFaltantes: data.pedidosCriticos.length,
    insumosCriticos: data.alertasStock.length,
    armadoPendiente: data.tareasArmado.length,
  };

  // --- HELPER FUNCIONES: LÓGICA DE EXPLOSIÓN Y FILTRADO INVERSO ---
  const getProductosCompatibles = useCallback(
    (semiName) => {
      if (!semiName) return [];
      const semiSelected = allProducts.find((p) => p.nombre === semiName);
      if (!semiSelected) return [];

      const semiIdStr = String(semiSelected.id);
      const compatibles = [];

      Object.entries(recetasProductos).forEach(
        ([prodTerminado, ingredientes]) => {
          if (Array.isArray(ingredientes)) {
            const usaSemi = ingredientes.some(
              (ing) =>
                String(ing.semielaborado_id) === semiIdStr ||
                String(ing.id) === semiIdStr,
            );
            if (usaSemi) compatibles.push(normalizeString(prodTerminado));
          }
        },
      );
      return compatibles;
    },
    [allProducts, recetasProductos],
  );

  const getOpcionesPedidos = useCallback(
    (semiName) => {
      if (!semiName) return [];

      const dosMesesAtras = new Date();
      dosMesesAtras.setMonth(dosMesesAtras.getMonth() - 2);

      const compatibles = getProductosCompatibles(semiName);
      const semiSelected = allProducts.find((p) => p.nombre === semiName);
      const semiNorm = normalizeString(semiName);
      const codNorm = normalizeString(semiSelected?.codigo);

      const filtrados = data.pedidosHistorial.filter((p) => {
        const detalles = (p.detalles || "").toLowerCase();
        const cliente = (p.cliente || "").toLowerCase();
        if (
          detalles.includes("mercadolibre") ||
          detalles.includes("mercado libre") ||
          cliente.includes("mercadolibre")
        )
          return false;

        const estado = (p.estado || "").toLowerCase();
        if (
          estado.includes("entregado") ||
          estado.includes("despachado") ||
          estado.includes("anulado")
        )
          return false;

        if (p.fecha) {
          let datePedido = new Date(p.fecha);
          if (isNaN(datePedido.getTime())) {
            const parts = p.fecha.includes("/")
              ? p.fecha.split("/")
              : p.fecha.split("-");
            if (parts.length === 3) {
              let year = parseInt(parts[2]);
              if (year < 100) year += 2000;
              let month = parseInt(parts[1]) - 1;
              let day = parseInt(parts[0]);
              if (parts[0].length === 4) {
                year = parseInt(parts[0]);
                day = parseInt(parts[2]);
              }
              datePedido = new Date(year, month, day);
            }
          }
          // if (!isNaN(datePedido.getTime()) && datePedido < dosMesesAtras) return false;
        }

        const modNorm = normalizeString(p.modelo);
        const usaReceta = compatibles.some(
          (pc) => modNorm.includes(pc) || pc.includes(modNorm),
        );
        const coincidenciaDirecta =
          modNorm.includes(semiNorm) ||
          semiNorm.includes(modNorm) ||
          (codNorm && modNorm.includes(codNorm));

        return usaReceta || coincidenciaDirecta;
      });

      const unicos = [];
      const map = new Set();
      filtrados.forEach((p) => {
        const key = `${p.op}-${p.cliente}`;
        if (!map.has(key)) {
          map.add(key);
          unicos.push(p);
        }
      });

      return unicos;
    },
    [data.pedidosHistorial, getProductosCompatibles, allProducts],
  );

  const getDetallesDelPedido = useCallback(
    (pedidosGuardados) => {
      if (!pedidosGuardados || pedidosGuardados.length === 0) return [];
      return data.pedidosHistorial.filter((p) =>
        pedidosGuardados.some(
          (ep) => ep.op === p.op && ep.cliente === p.cliente,
        ),
      );
    },
    [data.pedidosHistorial],
  );

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
      setShowAddMachineModal(false);
      fetchData();
    } catch (e) {}
  };

  const handleDeleteMachine = async (id) => {
    if (!window.confirm("¿Seguro que querés eliminar esta máquina del parque?"))
      return;
    try {
      await authFetch(`${API_BASE_URL}/planificacion/maquinas/${id}`, {
        method: "DELETE",
      });
      setSelectedMaquina(null);
      fetchData();
    } catch (e) {}
  };

  const guardarConfiguracionMaquina = async () => {
    try {
      const validConfigs = machineConfigs.filter(
        (c) => c.semielaborado.trim() !== "",
      );
      const res = await authFetch(
        `${API_BASE_URL}/planificacion/maquinas/${selectedMaquina.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ configuracion: validConfigs }),
        },
      );
      if (res.ok) {
        toast.success(`Máquina ${selectedMaquina.nombre} actualizada`);
        setSelectedMaquina(null);
        fetchData();
      }
    } catch (e) {
      toast.error("Error al guardar");
    }
  };

  const abrirModalMaquina = (maq) => {
    setSelectedMaquina(maq);
    let conf = [];
    if (maq.configuracion) {
      conf =
        typeof maq.configuracion === "string"
          ? JSON.parse(maq.configuracion)
          : maq.configuracion;
    } else if (maq.semielaborado) {
      const ops = maq.op ? maq.op.split(", ") : [];
      const clientes = maq.cliente ? maq.cliente.split(", ") : [];
      conf = [
        {
          semielaborado: maq.semielaborado,
          destino: maq.destino || "STOCK",
          pedidos: ops.map((op, i) => ({ op, cliente: clientes[i] || "" })),
        },
      ];
    }

    if (conf.length === 0)
      conf = [{ semielaborado: "", destino: "STOCK", pedidos: [] }];
    setMachineConfigs(conf);
    setShowDetailsIdx({});
  };

  const updateConfig = (idx, field, value) => {
    const newConfigs = [...machineConfigs];
    newConfigs[idx][field] = value;
    if (field === "semielaborado") newConfigs[idx].pedidos = [];
    setMachineConfigs(newConfigs);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500 overflow-hidden">
      {/* HEADER */}
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
          {/* ROW 1: KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-slate-200 p-4 rounded-[1.5rem] shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center text-xl shrink-0">
                <FaCogs />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                  En Máquina
                </p>
                <p className="text-2xl font-bold text-slate-800 leading-none">
                  {kpis.produciendo}
                </p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-[1.5rem] shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center text-xl shrink-0">
                <FaExclamationTriangle />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                  Sin Stock (OP)
                </p>
                <p className="text-2xl font-bold text-rose-600 leading-none">
                  {kpis.pedidosFaltantes}
                </p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-[1.5rem] shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center text-xl shrink-0">
                <FaBoxes />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                  Falta MRP
                </p>
                <p className="text-2xl font-bold text-amber-600 leading-none">
                  {kpis.insumosCriticos}
                </p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-[1.5rem] shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl shrink-0">
                <FaHammer />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                  Armado Pend.
                </p>
                <p className="text-2xl font-bold text-emerald-600 leading-none">
                  {kpis.armadoPendiente}
                </p>
              </div>
            </div>
          </div>

          {/* ROW 2: PARQUE DE MÁQUINAS & PENDIENTES DE ARMADO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* MÁQUINAS */}
            <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 flex flex-col">
              <div className="flex justify-between items-center mb-5 shrink-0">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <FaIndustry className="text-blue-500" /> Parque de Máquinas
                </h3>
                <button
                  onClick={() => setShowAddMachineModal(true)}
                  className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                >
                  <FaPlus size={10} /> Agregar
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                {data.maquinas.map((m) => {
                  const confs = m.configuracion
                    ? typeof m.configuracion === "string"
                      ? JSON.parse(m.configuracion)
                      : m.configuracion
                    : [];
                  if (confs.length === 0 && m.semielaborado)
                    confs.push({
                      semielaborado: m.semielaborado,
                      destino: m.destino,
                      pedidos: [],
                    });
                  const isActive = confs.length > 0;

                  return (
                    <div
                      key={m.id}
                      onClick={() => abrirModalMaquina(m)}
                      className="relative bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-center items-center cursor-pointer hover:border-blue-400 hover:shadow-md transition-all duration-300 group min-h-[140px] hover:z-[100]"
                    >
                      {/* GLOBITO DE DIÁLOGO FLOTANTE */}
                      {isActive && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max min-w-[220px] max-w-[280px] bg-slate-800 rounded-2xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[999] pointer-events-none shadow-2xl">
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-slate-800"></div>
                          <div className="flex flex-col gap-3">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700 pb-2">
                              Produciendo ({confs.length})
                            </span>
                            {confs.map((c, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center gap-4"
                              >
                                <span className="text-[11px] font-bold text-white leading-tight">
                                  {c.semielaborado}
                                </span>
                                <span
                                  className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded shrink-0 ${c.destino === "PEDIDO" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"}`}
                                >
                                  {c.destino === "PEDIDO"
                                    ? c.pedidos?.length > 0
                                      ? `${c.pedidos.length} OP`
                                      : "S/OP"
                                    : "STOCK"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                        <span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-1 rounded-md uppercase text-slate-500 truncate max-w-[80%] shadow-sm">
                          {m.nombre}
                        </span>
                        <div
                          className={`w-2.5 h-2.5 rounded-full shadow-sm shrink-0 ${isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-300"}`}
                        ></div>
                      </div>

                      {isActive ? (
                        <div className="transition-transform duration-300 transform group-hover:scale-110">
                          <CuteMachine active={true} />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-slate-300 group-hover:text-blue-400 transition-colors">
                          <FaPowerOff size={20} className="mb-2" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">
                            Apagada
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ARMADO PENDIENTE */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 flex flex-col h-[500px]">
              <div className="p-5 border-b border-slate-50 shrink-0">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <FaHammer className="text-orange-500" /> Tareas de Armado
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/50">
                {data.tareasArmado.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <FaCheckCircle
                      size={24}
                      className="mb-2 opacity-50 text-emerald-400"
                    />
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      Todo al día
                    </p>
                  </div>
                ) : (
                  data.tareasArmado.map((t, idx) => {
                    const percent =
                      t.meta > 0 ? (t.realizado / t.meta) * 100 : 0;
                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-orange-300 transition-colors"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                        <div className="flex justify-between items-start mb-2 pl-2">
                          <div className="min-w-0 pr-2">
                            <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-0.5 truncate">
                              {t.plan_nombre}
                            </p>
                            <p
                              className="text-xs font-bold text-slate-800 truncate"
                              title={t.titulo}
                            >
                              {t.titulo}
                            </p>
                          </div>
                        </div>
                        <div className="pl-2 mt-3 flex items-end justify-between">
                          <div className="flex-1 mr-4">
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-500"
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-lg font-bold text-slate-700 leading-none">
                              {t.realizado}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 ml-1">
                              / {t.meta}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ROW 3: RADAR DE CELDAS Y PEDIDOS CRÍTICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-[1.5rem] p-5 shadow-sm flex flex-col h-80">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <FaTruck className="text-rose-400" /> OP's Sin Stock
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
                      className="bg-rose-50/20 border border-rose-100 rounded-xl p-3 flex justify-between items-center hover:bg-rose-50/50 transition-all"
                    >
                      <div className="min-w-0 pr-4">
                        <div className="flex gap-2 items-center mb-1">
                          <span className="text-[9px] font-bold bg-white border border-rose-200 text-rose-500 px-1.5 py-0.5 rounded">
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
                      <div className="text-right shrink-0 bg-white border border-rose-100 px-3 py-1.5 rounded-lg shadow-sm">
                        <p className="text-[8px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">
                          Falta
                        </p>
                        <p className="text-sm font-black text-rose-600 leading-none">
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
                <FaFire className="text-blue-400" /> Progreso de Celdas (Planes
                Activos)
              </h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                {data.radar.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      Planta Inactiva
                    </p>
                  </div>
                ) : (
                  data.radar.map((item) => {
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
                              className={`h-full ${progress >= 100 ? "bg-emerald-400" : "bg-blue-400"}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CREAR NUEVA MÁQUINA */}
      <AnimatePresence>
        {showAddMachineModal && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={() => setShowAddMachineModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Nueva Máquina
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Agregue un equipo nuevo al parque de la planta.
              </p>
              <form onSubmit={handleAddMachine}>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  placeholder="Ej: Inyectora 4, Horno B..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 outline-none mb-6"
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddMachineModal(false)}
                    className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg"
                  >
                    Agregar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CONFIGURACIÓN MÚLTIPLE DE MÁQUINA */}
      <AnimatePresence>
        {selectedMaquina && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedMaquina(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 text-blue-600 p-3 rounded-2xl">
                    <FaTools size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                      Asignación Múltiple
                    </p>
                    <h2 className="text-xl font-bold text-slate-800 leading-none">
                      {selectedMaquina.nombre}
                    </h2>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteMachine(selectedMaquina.id)}
                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
                    title="Eliminar Máquina"
                  >
                    <FaTrash size={14} />
                  </button>
                  <button
                    onClick={() => setSelectedMaquina(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-full shadow-sm border border-slate-200"
                  >
                    <FaTimes size={14} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                {machineConfigs.map((config, index) => {
                  const options = getOpcionesPedidos(config.semielaborado);
                  const detalles = getDetallesDelPedido(config.pedidos);

                  return (
                    <div
                      key={index}
                      className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm mb-4 relative animate-in fade-in"
                    >
                      <button
                        onClick={() =>
                          setMachineConfigs(
                            machineConfigs.filter((_, i) => i !== index),
                          )
                        }
                        className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors p-1 bg-slate-50 rounded"
                        title="Quitar este semielaborado de la máquina"
                      >
                        <FaTrash size={12} />
                      </button>

                      <div className="mb-4 pr-8">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                          Semielaborado {index + 1}
                        </label>
                        {/* BUSCADOR ELEGANTE EN LUGAR DEL SELECT */}
                        <CustomSelect
                          options={allProducts}
                          value={config.semielaborado}
                          onChange={(val) =>
                            updateConfig(index, "semielaborado", val)
                          }
                          placeholder="Buscar semielaborado..."
                        />
                      </div>

                      {config.semielaborado && (
                        <div className="pt-4 border-t border-slate-100">
                          <div className="flex gap-3 mb-4">
                            <button
                              onClick={() =>
                                updateConfig(index, "destino", "STOCK")
                              }
                              className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${config.destino === "STOCK" ? "bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm" : "bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100"}`}
                            >
                              <FaBoxOpen size={12} /> Para Stock
                            </button>
                            <button
                              onClick={() =>
                                updateConfig(index, "destino", "PEDIDO")
                              }
                              className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${config.destino === "PEDIDO" ? "bg-blue-50 text-blue-600 border-blue-200 shadow-sm" : "bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100"}`}
                            >
                              <FaClipboardList size={12} /> Para Pedido
                            </button>
                          </div>

                          {config.destino === "PEDIDO" && (
                            <div className="animate-in slide-in-from-top-2 space-y-3 bg-blue-50/30 p-4 rounded-xl border border-blue-50">
                              <select
                                className="w-full bg-white border border-blue-200 rounded-xl p-2.5 text-xs font-bold text-blue-800 outline-none shadow-sm cursor-pointer"
                                value=""
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const [op, cli] = e.target.value.split("|");
                                  const actuales = config.pedidos || [];
                                  if (
                                    !actuales.find(
                                      (p) => p.op === op && p.cliente === cli,
                                    )
                                  ) {
                                    updateConfig(index, "pedidos", [
                                      ...actuales,
                                      { op, cliente: cli },
                                    ]);
                                  }
                                }}
                              >
                                <option value="">
                                  + Vincular a OP/Pedido...
                                </option>
                                {options.map((p, i) => (
                                  <option
                                    key={i}
                                    value={`${p.op}|${p.cliente}`}
                                  >
                                    OP: {p.op || "S/OP"} | {p.cliente}
                                  </option>
                                ))}
                              </select>

                              {config.pedidos?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {config.pedidos.map((ped, pIdx) => (
                                    <div
                                      key={pIdx}
                                      className="bg-blue-600 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm"
                                    >
                                      OP: {ped.op} | {ped.cliente}
                                      <button
                                        onClick={() =>
                                          updateConfig(
                                            index,
                                            "pedidos",
                                            config.pedidos.filter(
                                              (_, i) => i !== pIdx,
                                            ),
                                          )
                                        }
                                        className="text-blue-200 hover:text-white"
                                      >
                                        <FaTimes size={10} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {config.pedidos?.length > 0 &&
                                detalles.length > 0 && (
                                  <div className="mt-3">
                                    <button
                                      onClick={() =>
                                        setShowDetailsIdx({
                                          ...showDetailsIdx,
                                          [index]: !showDetailsIdx[index],
                                        })
                                      }
                                      className="text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:text-blue-600 flex items-center gap-1.5 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200"
                                    >
                                      <FaFileInvoice />{" "}
                                      {showDetailsIdx[index]
                                        ? "Ocultar"
                                        : "Ver"}{" "}
                                      Consolidado ({config.pedidos.length} OP)
                                    </button>

                                    {showDetailsIdx[index] && (
                                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-2 shadow-inner">
                                        <div className="max-h-40 overflow-y-auto custom-scrollbar">
                                          <table className="w-full text-left">
                                            <tbody className="divide-y divide-slate-100">
                                              {detalles.map((dp, dIdx) => {
                                                const pcCompatible =
                                                  getProductosCompatibles(
                                                    config.semielaborado,
                                                  );
                                                const modNorm = normalizeString(
                                                  dp.modelo,
                                                );
                                                const semiNorm =
                                                  normalizeString(
                                                    config.semielaborado,
                                                  );
                                                const codNorm = normalizeString(
                                                  allProducts.find(
                                                    (p) =>
                                                      p.nombre ===
                                                      config.semielaborado,
                                                  )?.codigo,
                                                );
                                                const isMatch =
                                                  pcCompatible.some(
                                                    (pc) =>
                                                      modNorm.includes(pc) ||
                                                      pc.includes(modNorm),
                                                  ) ||
                                                  modNorm.includes(semiNorm) ||
                                                  semiNorm.includes(modNorm) ||
                                                  (codNorm &&
                                                    modNorm.includes(codNorm));

                                                return (
                                                  <tr
                                                    key={`${dIdx}`}
                                                    className={`transition-colors ${isMatch ? "bg-blue-50/50" : "hover:bg-slate-50"}`}
                                                  >
                                                    <td className="p-2 px-3">
                                                      <p
                                                        className={`text-[10px] font-bold leading-tight ${isMatch ? "text-blue-700" : "text-slate-700"}`}
                                                      >
                                                        {dp.modelo}{" "}
                                                        {isMatch && (
                                                          <span className="ml-2 inline-block w-1 h-1 bg-blue-500 rounded-full animate-pulse"></span>
                                                        )}
                                                      </p>
                                                      <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest">
                                                        <span className="text-slate-600">
                                                          OP: {dp.op}
                                                        </span>{" "}
                                                        • {dp.fecha} •{" "}
                                                        {dp.estado.toUpperCase()}
                                                      </p>
                                                    </td>
                                                    <td className="p-2 px-3 text-right shrink-0">
                                                      <span
                                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${isMatch ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                                                      >
                                                        {dp.cantidad} u.
                                                      </span>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={() =>
                    setMachineConfigs([
                      ...machineConfigs,
                      { semielaborado: "", destino: "STOCK", pedidos: [] },
                    ])
                  }
                  className="w-full border-2 border-dashed border-slate-200 rounded-[1.5rem] py-4 flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  <FaPlus className="mb-1" size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Añadir otro semielaborado a la tirada
                  </span>
                </button>
              </div>

              <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setSelectedMaquina(null)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarConfiguracionMaquina}
                  className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2 active:scale-95"
                >
                  <FaSave /> Confirmar Ajustes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
