import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReactToPrint } from "react-to-print";
import { PlanPdf } from "../components/planificacion/PlanPdf"; // asegúrate del import correcto
import { API_BASE_URL } from "../utils.js";

// Componentes existentes
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";
import PlanCard from "../components/planificacion/PlanCard";
import PlanItemCard from "../components/planificacion/PlanItemCard";
import PlanStats from "../components/planificacion/PlanStats";
import TabButton from "../components/planificacion/TabButton";

import {
  FaClipboardList,
  FaPlus,
  FaSpinner,
  FaSave,
  FaLock,
  FaLockOpen,
  FaTrash,
  FaTasks,
  FaChartPie,
  FaFileInvoice,
  FaShoppingCart,
  FaPrint,
  FaIndustry, // Nuevo icono para producción
} from "react-icons/fa";

export default function PlanificacionPage() {
  // === ESTADOS MAESTROS ===
  const [allSemis, setAllSemis] = useState([]);
  const [allMPs, setAllMPs] = useState([]);
  const [recetasMap, setRecetasMap] = useState({});
  const [masterPlanList, setMasterPlanList] = useState([]);

  // === ESTADOS DE DETALLE ===
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [currentPlanNombre, setCurrentPlanNombre] = useState("Nuevo Plan");
  const [currentPlanItems, setCurrentPlanItems] = useState([]);
  const [currentPlanEstado, setCurrentPlanEstado] = useState("ABIERTO");
  const [currentPlanOperarios, setCurrentPlanOperarios] = useState([]);
  const [historialProduccion, setHistorialProduccion] = useState([]); // <--- NUEVO ESTADO

  // === ESTADOS DE UI ===
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("items");
  const [showStatsModal, setShowStatsModal] = useState(false);

  // === REFERENCIAS PARA IMPRESIÓN ===
  const componentRef = useRef(null);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current, // <--- ESTA ES LA CLAVE
    documentTitle: `Plan_${currentPlanNombre.replace(/\s+/g, "_")}`,
  });

  // --- LÓGICA DE DATOS ---
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
    setCurrentPlanOperarios([]);
    setHistorialProduccion([]); // Limpiar historial

    try {
      // Cargamos Plan, Operarios y Historial a la vez
      const [resPlan, resOperarios, resHistorial] = await Promise.all([
        fetch(`${API_BASE_URL}/planificacion/${planId}`),
        fetch(`${API_BASE_URL}/planificacion/${planId}/operarios`),
        fetch(`${API_BASE_URL}/planificacion/${planId}/historial`), // <--- NUEVA LLAMADA
      ]);

      if (!resPlan.ok) throw new Error("No se pudo cargar el plan");
      const planDetalle = await resPlan.json();
      setCurrentPlanNombre(planDetalle.nombre);
      setCurrentPlanItems(planDetalle.items);
      setCurrentPlanEstado(planDetalle.estado);

      if (resOperarios.ok) {
        setCurrentPlanOperarios(await resOperarios.json());
      }
      if (resHistorial.ok) {
        setHistorialProduccion(await resHistorial.json());
      }
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
    setCurrentPlanOperarios([]);
    setHistorialProduccion([]);
    setActiveTab("items");
  };

  const handleAddItem = (semielaborado) => {
    const cantidad = Number(
      prompt(`Cantidad a fabricar de "${semielaborado.nombre}":`, "10")
    );
    if (cantidad && cantidad > 0) {
      setCurrentPlanItems((prev) => [
        ...prev,
        { semielaborado, cantidad, producido: 0, plan_item_id: null },
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
      setSelectedPlanId(null);
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
          { method: "DELETE" }
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

  const isPlanCerrado = currentPlanEstado === "CERRADO";
  const isPlanNuevo = selectedPlanId === "NEW";

  return (
    <>
      <motion.div
        layout
        className="animate-in fade-in duration-500 flex flex-col h-[calc(100vh-140px)] min-h-[700px] gap-6"
      >
        {/* --- SECCIÓN 1: KARDEX DE PLANES --- */}
        <motion.div className="bg-slate-800 rounded-xl flex flex-col border border-slate-700 shadow-lg overflow-hidden">
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

        {/* --- SECCIÓN 2: DETALLE DEL PLAN --- */}
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
              {/* Toolbar */}
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
                    onClick={() => {
                      if (!selectedPlanId || isPlanNuevo) {
                        alert("No hay plan listo para imprimir");
                        return;
                      }
                      if (!componentRef.current) {
                        alert("El contenido para imprimir no está disponible. Esperá y volvé a intentar.");
                        console.warn("[PRINT] componentRef vacío:", componentRef.current);
                        return;
                      }
                      handlePrint();
                    }}
                    disabled={!selectedPlanId || isPlanNuevo}
                    className="px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white transition-all disabled:opacity-50"
                  >
                    <FaPrint /> PDF
                  </button>
                  <button
                    onClick={handleToggleEstado}
                    disabled={isSaving || isPlanNuevo}
                    className={`px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                      isPlanCerrado
                        ? "bg-gray-600 hover:bg-gray-500"
                        : "bg-green-600 hover:bg-green-500"
                    } text-white disabled:opacity-50`}
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

              {/* Tabs */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex border-b border-slate-700 bg-slate-800/50">
                  <TabButton
                    icon={<FaTasks />}
                    label="Items del Plan"
                    active={activeTab === "items"}
                    onClick={() => setActiveTab("items")}
                  />
                  {/* PESTAÑA PRODUCCIÓN RECUPERADA */}
                  <TabButton
                    icon={<FaIndustry />}
                    label="Producción"
                    active={activeTab === "produccion"}
                    onClick={() => setActiveTab("produccion")}
                  />
                  <TabButton
                    icon={<FaFileInvoice />}
                    label="Explosión (MRP)"
                    active={activeTab === "mrp"}
                    onClick={() => setActiveTab("mrp")}
                  />
                  <TabButton
                    icon={<FaChartPie />}
                    label="Estadísticas"
                    active={showStatsModal}
                    onClick={() => setShowStatsModal(true)}
                  />
                </div>

                {/* Contenido de Tabs */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  <AnimatePresence mode="wait">
                    {/* TAB 1: Items */}
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
                          <ul className="space-y-3">
                            {currentPlanItems.map((item, index) => (
                              <PlanItemCard
                                key={item.semielaborado.id + "_" + index}
                                item={item}
                                onRemove={() => handleRemoveItem(index)}
                                isPlanCerrado={isPlanCerrado}
                              />
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}

                    {/* TAB 2: PRODUCCIÓN (RECUPERADA) */}
                    {activeTab === "produccion" && (
                      <motion.div
                        key="produccion"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <FaIndustry className="text-blue-400" /> Historial
                            de Producción
                          </h3>
                          <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-slate-800 rounded border border-slate-700">
                            {historialProduccion.length} registros
                          </span>
                        </div>

                        <div className="overflow-hidden bg-slate-800/40 border border-slate-700/50 rounded-xl shadow-xl backdrop-blur-sm">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead className="text-xs text-gray-400 uppercase bg-slate-900/50 tracking-wider font-semibold">
                              <tr>
                                <th className="px-6 py-4 font-medium">
                                  Fecha / Hora
                                </th>
                                <th className="px-6 py-4 font-medium">
                                  Operario
                                </th>
                                <th className="px-6 py-4 font-medium">
                                  Producto
                                </th>
                                <th className="px-6 py-4 text-center font-medium text-emerald-400">
                                  OK
                                </th>
                                <th className="px-6 py-4 text-center font-medium text-rose-400">
                                  Scrap
                                </th>
                                <th className="px-6 py-4 font-medium">
                                  Observaciones
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                              {historialProduccion.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan="6"
                                    className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2"
                                  >
                                    <FaIndustry className="text-4xl opacity-20 mb-2" />
                                    <span className="text-lg font-medium">
                                      Sin actividad registrada
                                    </span>
                                    <span className="text-sm opacity-70">
                                      Aún no se ha cargado producción para este
                                      plan.
                                    </span>
                                  </td>
                                </tr>
                              ) : (
                                historialProduccion.map((reg) => (
                                  <tr
                                    key={reg.id}
                                    className="group hover:bg-white/5 transition-colors duration-200"
                                  >
                                    {/* FECHA */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex flex-col">
                                        <span className="text-white font-medium">
                                          {new Date(
                                            reg.fecha_produccion
                                          ).toLocaleDateString("es-AR")}
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono">
                                          {new Date(
                                            reg.fecha_produccion
                                          ).toLocaleTimeString("es-AR", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                      </div>
                                    </td>

                                    {/* OPERARIO */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-300 group-hover:text-white transition-colors">
                                          {reg.operario}
                                        </span>
                                      </div>
                                    </td>

                                    {/* PRODUCTO */}
                                    <td className="px-6 py-4">
                                      <span
                                        className="text-blue-300 font-medium block truncate max-w-[200px]"
                                        title={reg.semielaborado}
                                      >
                                        {reg.semielaborado}
                                      </span>
                                    </td>

                                    {/* CANTIDAD OK (BADGE VERDE) */}
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shadow-sm min-w-[50px]">
                                        {reg.cantidad}
                                      </span>
                                    </td>

                                    {/* CANTIDAD SCRAP (BADGE ROJO O GRIS) */}
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                      {Number(reg.scrap) > 0 ? (
                                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold shadow-sm min-w-[40px] animate-pulse">
                                          {reg.scrap}
                                        </span>
                                      ) : (
                                        <span className="text-gray-600">-</span>
                                      )}
                                    </td>

                                    {/* MOTIVO */}
                                    <td className="px-6 py-4">
                                      {Number(reg.scrap) > 0 ? (
                                        <div className="flex items-center gap-1 text-rose-300 text-xs bg-rose-900/20 px-2 py-1 rounded border border-rose-900/30 w-fit">
                                          <span className="font-semibold">
                                            Falla:
                                          </span>{" "}
                                          {reg.motivo}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-600 italic">
                                          Sin novedades
                                        </span>
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

                    {/* TAB 3: MRP */}
                    {activeTab === "mrp" && (
                      <motion.div
                        key="mrp"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        <h3 className="text-gray-300 font-bold text-sm mb-4">
                          Materiales necesarios para completar lo{" "}
                          <span className="text-yellow-400">PENDIENTE</span>:
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
                                <th className="px-4 py-3 text-right">
                                  Balance
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                              {explosion.map((mp) => (
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
                                      <FaShoppingCart className="inline ml-2 text-red-500" />
                                    )}
                                  </td>
                                </tr>
                              ))}
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

      <AnimatePresence>
        {showStatsModal && (
          <PlanStats
            items={currentPlanItems}
            operarios={currentPlanOperarios}
            onClose={() => setShowStatsModal(false)}
          />
        )}
      </AnimatePresence>

      {/* COMPONENTE OCULTO CORRECTAMENTE (Ahora con position absolute y coordenadas negativas) */}
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "210mm",
          background: "#fff",
        }}
      >
        <PlanPdf
          ref={componentRef}
          plan={{ nombre: currentPlanNombre }}
          items={currentPlanItems}
          explosion={explosion}
        />
      </div>
    </>
  );
}
