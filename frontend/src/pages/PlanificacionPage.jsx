import { useEffect, useState, useMemo } from "react";
import {
  FaPlus,
  FaTrash,
  FaSpinner,
  FaClipboardList,
  FaSave,
  FaLock,
  FaLockOpen,
  FaShoppingCart,
  FaChartPie,
  FaTasks,
  FaFileInvoice,
  FaCaretRight,
} from "react-icons/fa";
// 1. Importar Framer Motion
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { API_BASE_URL } from "../utils.js";

// --- COMPONENTE AUTOCOMPLETAR (Sin cambios) ---
function AutoCompleteInput({ items, onSelect, placeholder, disabled }) {
  const [value, setValue] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const handleChange = (e) => {
    const val = e.target.value;
    setValue(val);
    if (val.length > 0) {
      setSugerencias(
        items
          .filter(
            (s) =>
              s.nombre.toLowerCase().includes(val.toLowerCase()) ||
              s.codigo.toLowerCase().includes(val.toLowerCase())
          )
          .slice(0, 5)
      );
    } else {
      setSugerencias([]);
    }
  };
  const handleSelect = (semi) => {
    setValue("");
    setSugerencias([]);
    onSelect(semi);
  };
  return (
    <div className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || "Buscar..."}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-transparent focus:border-blue-500 transition-all disabled:bg-slate-800"
        disabled={disabled}
      />
      {sugerencias.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 w-full bg-slate-700 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto border border-slate-600"
        >
          {sugerencias.map((s) => (
            <div
              key={s.id}
              onClick={() => handleSelect(s)}
              className="p-3 hover:bg-slate-600 cursor-pointer border-b border-slate-600 last:border-b-0"
            >
              <p className="font-bold text-sm text-white">{s.nombre}</p>
              <p className="text-xs text-gray-400 font-mono">{s.codigo}</p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// --- NUEVO COMPONENTE: TARJETA DE PLAN (KARDEX) ---
function PlanCard({ plan, onSelect, isSelected }) {
  return (
    <motion.button
      layout
      animate={{ opacity: 1 }}
      initial={{ opacity: 0 }}
      exit={{ opacity: 0 }}
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl transition-all border-2 ${
        isSelected
          ? "bg-slate-700/50 border-blue-500 shadow-lg"
          : "bg-slate-800 border-slate-700 hover:bg-slate-700/80 hover:border-slate-600"
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold truncate text-white">{plan.nombre}</span>
        {plan.estado === "ABIERTO" ? (
          <div className="flex items-center gap-1 text-xs text-green-400 bg-green-900/50 px-2 py-1 rounded-full">
            <FaLockOpen /> Abierto
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-gray-400 bg-slate-700 px-2 py-1 rounded-full">
            <FaLock /> Cerrado
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        {new Date(plan.fecha_creacion).toLocaleDateString("es-AR")}
      </p>
    </motion.button>
  );
}

// --- NUEVO COMPONENTE: ITEM DE LA LISTA DEL PLAN ---
function PlanItemCard({ item, onRemove, isPlanCerrado }) {
  const progPercent =
    item.cantidad > 0 ? (item.producido / item.cantidad) * 100 : 0;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="bg-slate-700 p-4 rounded-lg border border-slate-600 group"
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-white">
          {item.semielaborado.nombre}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-blue-300">
            {item.producido}{" "}
            <span className="text-sm text-gray-400">/ {item.cantidad}</span>
          </span>
          {!isPlanCerrado && (
            <button
              onClick={onRemove}
              className="text-gray-500 hover:text-red-400 p-1 transition-colors opacity-0 group-hover:opacity-100"
            >
              <FaTrash />
            </button>
          )}
        </div>
      </div>
      {/* Barra de Progreso */}
      <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
        <motion.div
          className="bg-green-500 h-2.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progPercent}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </motion.li>
  );
}

// --- NUEVO COMPONENTE: GRÁFICOS DEL PLAN ---
function PlanStats({ items }) {
  const { totalRequerido, totalProducido, progresoGeneral, pieData } =
    useMemo(() => {
      let req = 0;
      let prod = 0;
      items.forEach((item) => {
        req += item.cantidad;
        prod += item.producido;
      });
      const progreso = req > 0 ? (prod / req) * 100 : 0;
      const pie = [
        { name: "Producido", value: prod },
        { name: "Pendiente", value: req - prod },
      ];
      return {
        totalRequerido: req,
        totalProducido: prod,
        progresoGeneral: progreso,
        pieData: pie,
      };
    }, [items]);

  const COLORS = ["#10B981", "#374151"]; // Verde y Gris
  const barData = items.map((item) => ({
    name: item.semielaborado.nombre.substring(0, 15) + "...",
    Pendiente: item.cantidad - item.producido,
    Producido: item.producido,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Gráfico de Dona (Progreso Total) */}
      <div className="lg:col-span-1 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
        <h3 className="text-gray-300 font-bold text-sm mb-2 text-center">
          Progreso General
        </h3>
        <div className="w-full h-48 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "none" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-3xl font-bold text-white">
              {progresoGeneral.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="text-center mt-2">
          <p className="text-sm text-gray-400">
            Producido:{" "}
            <span className="font-bold text-green-400">{totalProducido}</span>
          </p>
          <p className="text-sm text-gray-400">
            Requerido:{" "}
            <span className="font-bold text-white">{totalRequerido}</span>
          </p>
        </div>
      </div>

      {/* Gráfico de Barras (Progreso por Item) */}
      <div className="lg:col-span-2 bg-slate-900/50 p-4 rounded-xl border border-slate-700 min-h-[260px]">
        <h3 className="text-gray-300 font-bold text-sm mb-4">
          Avance por Ítem (Pendiente vs Producido)
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={barData}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 20, bottom: 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#475569"
              horizontal={false}
            />
            <XAxis type="number" stroke="#9ca3af" />
            <YAxis
              dataKey="name"
              type="category"
              stroke="#9ca3af"
              fontSize={10}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#1f2937", border: "none" }}
            />
            <Bar
              dataKey="Producido"
              stackId="a"
              fill="#10B981"
              radius={[4, 0, 0, 4]}
            />
            <Bar
              dataKey="Pendiente"
              stackId="a"
              fill="#374151"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- COMPONENTE BOTÓN DE PESTAÑA ---
function TabButton({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 transition-all ${
        active
          ? "border-blue-500 text-white"
          : "border-transparent text-gray-500 hover:text-gray-300"
      }`}
    >
      {icon} {label}
    </button>
  );
}

// --- PÁGINA PRINCIPAL DE PLANIFICACIÓN ---
export default function PlanificacionPage() {
  // === ESTADOS MAESTROS (Datos de la BD) ===
  const [allSemis, setAllSemis] = useState([]);
  const [allMPs, setAllMPs] = useState([]);
  const [recetasMap, setRecetasMap] = useState({});
  const [masterPlanList, setMasterPlanList] = useState([]);

  // === ESTADOS DE DETALLE (El plan activo) ===
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [currentPlanNombre, setCurrentPlanNombre] = useState("Nuevo Plan");
  const [currentPlanItems, setCurrentPlanItems] = useState([]);
  const [currentPlanEstado, setCurrentPlanEstado] = useState("ABIERTO");

  // === ESTADOS DE UI ===
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("items");

  // --- LÓGICA DE DATOS (Sin cambios) ---
  useEffect(() => {
    const cargarDatosMaestros = async () => {
      try {
        setLoading(true);
        const [resSemis, resMPs, resRecetas, resPlanes] = await Promise.all([
          fetch(`${API_BASE_URL}/ingenieria/semielaborados`),
          fetch(`${API_BASE_URL}/ingenieria/materias-primas`),
          fetch(`${API_BASE_URL}/ingenieria/recetas-semielaborados/all`),
          fetch(`${API_BASE_URL}/planificacion`),
        ]);
        setAllSemis(await resSemis.json());
        setAllMPs(await resMPs.json());
        setRecetasMap(await resRecetas.json());
        setMasterPlanList(await resPlanes.json());
      } catch (err) {
        console.error("Error cargando datos maestros:", err);
      } finally {
        setLoading(false);
      }
    };
    cargarDatosMaestros();
  }, []);

  const handleSelectPlan = async (planId) => {
    if (isSaving) return;
    setLoading(true);
    setSelectedPlanId(planId);
    setActiveTab("items");
    try {
      const res = await fetch(`${API_BASE_URL}/planificacion/${planId}`);
      if (!res.ok) throw new Error("No se pudo cargar el plan");
      const planDetalle = await res.json();
      setCurrentPlanNombre(planDetalle.nombre);
      setCurrentPlanItems(planDetalle.items);
      setCurrentPlanEstado(planDetalle.estado);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    if (isSaving) return;
    setSelectedPlanId("NEW");
    setCurrentPlanNombre(
      `Nuevo Plan ${new Date().toLocaleDateString("es-AR")}`
    );
    setCurrentPlanItems([]);
    setCurrentPlanEstado("ABIERTO");
    setActiveTab("items");
  };

  const handleAddItem = (semielaborado) => {
    const cantidad = Number(
      prompt(`Cantidad a fabricar de "${semielaborado.nombre}":`, "10")
    );
    if (cantidad && cantidad > 0) {
      setCurrentPlanItems((prev) => [
        ...prev,
        {
          semielaborado,
          cantidad,
          producido: 0,
          plan_item_id: null,
        },
      ]);
    }
  };

  const handleRemoveItem = (indexToRemove) => {
    setCurrentPlanItems((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleSavePlan = async () => {
    if (!currentPlanNombre) return alert("El plan necesita un nombre.");
    setIsSaving(true);
    const planData = {
      nombre: currentPlanNombre,
      items: currentPlanItems.map((item) => ({
        semielaborado: item.semielaborado,
        cantidad: item.cantidad,
        producido: item.producido,
        plan_item_id: item.plan_item_id,
      })),
    };
    try {
      let response;
      if (selectedPlanId === "NEW") {
        response = await fetch(`${API_BASE_URL}/planificacion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(planData),
        });
      } else {
        response = await fetch(
          `${API_BASE_URL}/planificacion/${selectedPlanId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(planData),
          }
        );
      }
      if (!response.ok) throw new Error("Error al guardar en el servidor");
      const result = await response.json();
      const resPlanes = await fetch(`${API_BASE_URL}/planificacion`);
      setMasterPlanList(await resPlanes.json());
      if (selectedPlanId === "NEW") {
        setSelectedPlanId(result.planId);
      }
      alert("Plan guardado.");
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEstado = async () => {
    if (selectedPlanId === "NEW")
      return alert("Guarda el plan antes de cerrarlo.");
    const nuevoEstado = currentPlanEstado === "ABIERTO" ? "CERRADO" : "ABIERTO";
    if (
      window.confirm(
        `¿Estás seguro que quieres marcar este plan como "${nuevoEstado}"?`
      )
    ) {
      setIsSaving(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/planificacion/${selectedPlanId}/estado`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: nuevoEstado }),
          }
        );
        if (!res.ok) throw new Error("No se pudo actualizar el estado");
        setCurrentPlanEstado(nuevoEstado);
        setMasterPlanList((prevList) =>
          prevList.map((p) =>
            p.id === selectedPlanId ? { ...p, estado: nuevoEstado } : p
          )
        );
      } catch (err) {
        alert(err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDeletePlan = async () => {
    if (selectedPlanId === "NEW") {
      setSelectedPlanId(null); // Simplemente des-selecciona
      return;
    }
    if (
      window.confirm(
        `¿Estás seguro de ELIMINAR el plan "${currentPlanNombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      setIsSaving(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/planificacion/${selectedPlanId}`,
          {
            method: "DELETE",
          }
        );
        if (!res.ok) throw new Error("No se pudo eliminar el plan");
        alert("Plan eliminado.");
        setMasterPlanList((prev) =>
          prev.filter((p) => p.id !== selectedPlanId)
        );
        setSelectedPlanId(null);
      } catch (err) {
        alert(err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const explosion = useMemo(() => {
    const totalNecesario = {};
    currentPlanItems.forEach((item) => {
      const cantidadPendiente = item.cantidad - item.producido;
      if (cantidadPendiente <= 0) return;
      const receta = recetasMap[item.semielaborado.id];
      if (receta) {
        receta.forEach((ingrediente) => {
          const mpId = ingrediente.materia_prima_id;
          const qtyNeeded = ingrediente.cantidad * cantidadPendiente;
          totalNecesario[mpId] = (totalNecesario[mpId] || 0) + qtyNeeded;
        });
      }
    });
    const mpMap = new Map(allMPs.map((mp) => [mp.id, mp]));
    return Object.keys(totalNecesario)
      .map((mpId) => {
        const mpInfo = mpMap.get(Number(mpId));
        if (!mpInfo) return null;
        const necesario = totalNecesario[mpId];
        const stock = mpInfo.stock_actual;
        const balance = stock - necesario;
        return {
          id: mpId,
          nombre: mpInfo.nombre,
          codigo: mpInfo.codigo,
          necesario: necesario.toFixed(2),
          stock: Number(stock).toFixed(2),
          balance: balance.toFixed(2),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.balance - b.balance);
  }, [currentPlanItems, recetasMap, allMPs]);
  // --- FIN LÓGICA DE DATOS ---

  const isPlanCerrado = currentPlanEstado === "CERRADO";
  const isPlanNuevo = selectedPlanId === "NEW";

  // --- RENDERIZADO ---
  return (
    <motion.div
      layout
      className="animate-in fade-in duration-500 flex flex-col h-[calc(100vh-140px)] min-h-[700px] gap-6"
    >
      {/* --- SECCIÓN 1: KARDEX DE PLANES (ARRIBA) --- */}
      <motion.div
        layout
        className="bg-slate-800 rounded-xl flex flex-col border border-slate-700 shadow-lg overflow-hidden"
      >
        <div className="p-4 bg-slate-800/50 border-b border-slate-700 z-10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <FaClipboardList className="text-blue-400" /> Planes de Producción
          </h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg"
          >
            <FaPlus /> Crear Plan
          </motion.button>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          {loading && masterPlanList.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <FaSpinner className="animate-spin inline mr-2" /> Cargando...
            </div>
          ) : (
            <div className="flex p-4 space-x-4 min-w-max">
              <AnimatePresence>
                {masterPlanList.length === 0 && (
                  <p className="p-4 text-center text-gray-500 text-sm">
                    No hay planes guardados. ¡Crea uno!
                  </p>
                )}
                {masterPlanList.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onSelect={() => handleSelectPlan(plan.id)}
                    isSelected={selectedPlanId === plan.id}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      {/* --- SECCIÓN 2: DETALLE DEL PLAN (ABAJO) --- */}
      <AnimatePresence>
        {!selectedPlanId ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-700 flex justify-center items-center"
          >
            <p className="text-gray-500 text-lg font-medium">
              ← Selecciona un plan o crea uno nuevo para ver el detalle
            </p>
          </motion.div>
        ) : (
          <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col overflow-hidden"
          >
            {/* Toolbar del Plan Activo */}
            <div className="p-4 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-3">
              <input
                type="text"
                value={currentPlanNombre}
                onChange={(e) => setCurrentPlanNombre(e.target.value)}
                className="w-full md:w-1/3 bg-transparent border-0 border-b-2 border-slate-700 focus:border-blue-500 px-1 py-2 text-xl font-bold text-white focus:outline-none focus:ring-0 transition-all"
                disabled={isPlanCerrado || isSaving}
              />
              <div className="flex gap-2 flex-wrap justify-end">
                <button
                  onClick={handleToggleEstado}
                  disabled={isSaving || isPlanNuevo}
                  className={`px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                    isPlanCerrado
                      ? "bg-gray-600 hover:bg-gray-500 text-white"
                      : "bg-green-600 hover:bg-green-500 text-white"
                  } disabled:opacity-50`}
                >
                  {isPlanCerrado ? <FaLock /> : <FaLockOpen />}{" "}
                  {isPlanCerrado ? "Cerrado" : "Abierto"}
                </button>
                <button
                  onClick={handleDeletePlan}
                  disabled={isSaving || isPlanNuevo}
                  className="px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-red-800 hover:bg-red-700 text-white transition-all disabled:opacity-50"
                >
                  <FaTrash />
                </button>
                <button
                  onClick={handleSavePlan}
                  disabled={isPlanCerrado || isSaving}
                  className="px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <FaSave />
                  )}{" "}
                  Guardar
                </button>
              </div>
            </div>

            {/* Contenedor de Pestañas */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex border-b border-slate-700 bg-slate-800/50">
                <TabButton
                  icon={<FaTasks />}
                  label="Items del Plan"
                  active={activeTab === "items"}
                  onClick={() => setActiveTab("items")}
                />
                <TabButton
                  icon={<FaChartPie />}
                  label="Estadísticas"
                  active={activeTab === "stats"}
                  onClick={() => setActiveTab("stats")}
                />
                <TabButton
                  icon={<FaFileInvoice />}
                  label="Explosión (MRP)"
                  active={activeTab === "mrp"}
                  onClick={() => setActiveTab("mrp")}
                />
              </div>

              {/* Contenido de Pestañas (con scroll) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <AnimatePresence mode="wait">
                  {/* Pestaña 1: Items del Plan */}
                  {activeTab === "items" && (
                    <motion.div
                      key="items"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <AutoCompleteInput
                        items={allSemis}
                        onSelect={handleAddItem}
                        placeholder="Buscar semielaborado para añadir..."
                        disabled={isPlanCerrado || isSaving}
                      />
                      <div className="mt-6">
                        <AnimatePresence>
                          {currentPlanItems.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">
                              Agrega semielaborados al plan.
                            </p>
                          ) : (
                            <ul className="space-y-3">
                              {currentPlanItems.map((item, index) => (
                                <PlanItemCard
                                  key={item.semielaborado.id + index} // Clave más robusta
                                  item={item}
                                  onRemove={() => handleRemoveItem(index)}
                                  isPlanCerrado={isPlanCerrado}
                                />
                              ))}
                            </ul>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}

                  {/* Pestaña 2: Estadísticas */}
                  {activeTab === "stats" && (
                    <motion.div
                      key="stats"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <PlanStats items={currentPlanItems} />
                    </motion.div>
                  )}

                  {/* Pestaña 3: Explosión (MRP) */}
                  {activeTab === "mrp" && (
                    <motion.div
                      key="mrp"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <h3 className="text-gray-300 font-bold text-sm mb-4">
                        Materiales necesarios para completar lo{" "}
                        <span className="text-yellow-400">PENDIENTE</span> del
                        plan:
                      </h3>
                      <div className="overflow-hidden border border-slate-700 rounded-lg">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-400 uppercase bg-slate-700">
                            <tr>
                              <th className="px-4 py-3">Materia Prima</th>
                              <th className="px-4 py-3 text-right">
                                Necesario
                              </th>
                              <th className="px-4 py-3 text-right">Stock</th>
                              <th className="px-4 py-3 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {explosion.length === 0 ? (
                              <tr>
                                <td
                                  colSpan="4"
                                  className="p-8 text-center text-gray-500"
                                >
                                  {currentPlanItems.length > 0
                                    ? "¡Plan completado o sin recetas!"
                                    : "El plan está vacío."}
                                </td>
                              </tr>
                            ) : (
                              explosion.map((mp) => (
                                <tr
                                  key={mp.id}
                                  className="hover:bg-slate-700/50"
                                >
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-white">
                                      {mp.nombre}
                                    </p>
                                    <p className="text-xs text-gray-400 font-mono">
                                      {mp.codigo}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-yellow-300">
                                    {mp.necesario}
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-blue-300">
                                    {mp.stock}
                                  </td>
                                  <td
                                    className={`px-4 py-3 text-right font-mono font-bold ${
                                      mp.balance < 0
                                        ? "text-red-400"
                                        : "text-green-400"
                                    }`}
                                  >
                                    {mp.balance}
                                    {mp.balance < 0 && (
                                      <FaShoppingCart
                                        title="Necesita compra"
                                        className="inline ml-2 text-red-500"
                                      />
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
