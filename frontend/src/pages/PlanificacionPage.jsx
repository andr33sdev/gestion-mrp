import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils.js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Componentes
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";
import PlanCard from "../components/planificacion/PlanCard";
import PlanItemCard from "../components/planificacion/PlanItemCard";
import PlanStats from "../components/planificacion/PlanStats";
import TabButton from "../components/planificacion/TabButton";
import PlanGanttModal from "../components/planificacion/PlanGanttModal";

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
  FaPrint,
  FaIndustry,
  FaFire,
  FaCogs,
  FaCalendarAlt,
} from "react-icons/fa";

export default function PlanificacionPage({ onNavigate }) {
  const [allSemis, setAllSemis] = useState([]);
  const [allMPs, setAllMPs] = useState([]);
  const [recetasMap, setRecetasMap] = useState({});
  const [masterPlanList, setMasterPlanList] = useState([]);

  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [currentPlanNombre, setCurrentPlanNombre] = useState("Nuevo Plan");
  const [currentPlanItems, setCurrentPlanItems] = useState([]);
  const [currentPlanEstado, setCurrentPlanEstado] = useState("ABIERTO");
  const [currentPlanOperarios, setCurrentPlanOperarios] = useState([]);
  const [historialProduccion, setHistorialProduccion] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("items");
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showGanttModal, setShowGanttModal] = useState(false);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    const cargarDatosMaestros = async () => {
      try {
        setLoading(true);
        const [resSemis, resMPs, resRecetas, resPlanes] = await Promise.all([
          authFetch(`${API_BASE_URL}/ingenieria/semielaborados`),
          authFetch(`${API_BASE_URL}/ingenieria/materias-primas`),
          authFetch(`${API_BASE_URL}/ingenieria/recetas-semielaborados/all`),
          authFetch(`${API_BASE_URL}/planificacion`),
        ]);

        if (resSemis.ok) setAllSemis(await resSemis.json());
        if (resMPs.ok) setAllMPs(await resMPs.json());
        if (resRecetas.ok) setRecetasMap(await resRecetas.json());
        if (resPlanes.ok) setMasterPlanList(await resPlanes.json());
      } catch (err) {
        console.error("Error cargando datos:", err);
      } finally {
        setLoading(false);
      }
    };
    cargarDatosMaestros();
  }, []);

  // --- CÁLCULO MRP ---
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

  // --- GENERADOR PDF ---
  const generarPDF = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString("es-AR");
    const hora = new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const totalItems = currentPlanItems.length;
    const totalUnidades = currentPlanItems.reduce(
      (acc, i) => acc + Number(i.cantidad),
      0
    );
    const totalProducido = currentPlanItems.reduce(
      (acc, i) => acc + Number(i.producido),
      0
    );
    const avancePorcentaje =
      totalUnidades > 0
        ? ((totalProducido / totalUnidades) * 100).toFixed(1)
        : "0.0";
    const faltantesMRP = explosion.filter((i) => i.balance < 0).length;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("ORDEN DE PRODUCCIÓN", 14, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Sistema de Gestión - Conoflex Argentina", 14, 26);
    doc.setFontSize(12);
    doc.text(`PLAN: ${currentPlanNombre}`, 200, 20, { align: "right" });
    doc.setFontSize(10);
    doc.text(`ESTADO: ${currentPlanEstado}`, 200, 26, { align: "right" });
    doc.text(`FECHA: ${fecha} ${hora}`, 200, 32, { align: "right" });
    doc.setLineWidth(0.5);
    doc.line(14, 36, 200, 36);
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 40, 186, 16, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("ÍTEMS TOTALES", 30, 45, { align: "center" });
    doc.text(String(totalItems), 30, 52, { align: "center" });
    doc.text("UNIDADES META", 70, 45, { align: "center" });
    doc.text(String(totalUnidades), 70, 52, { align: "center" });
    doc.text("AVANCE REAL", 110, 45, { align: "center" });
    doc.text(`${totalProducido} (${avancePorcentaje}%)`, 110, 52, {
      align: "center",
    });
    doc.text("ALERTAS MRP", 150, 45, { align: "center" });
    doc.text(faltantesMRP > 0 ? `${faltantesMRP} FALTANTES` : "OK", 150, 52, {
      align: "center",
    });

    doc.setFontSize(11);
    doc.text("1. DETALLE DE PRODUCCIÓN", 14, 65);
    const tableBodyItems = currentPlanItems.map((item) => [
      item.semielaborado?.codigo || "-",
      item.semielaborado?.nombre || "Desconocido",
      item.cantidad,
      item.producido,
      item.cantidad - item.producido,
    ]);
    autoTable(doc, {
      startY: 68,
      head: [["CÓDIGO", "PRODUCTO", "META", "HECHO", "PENDIENTE"]],
      body: tableBodyItems,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2, lineColor: 200, lineWidth: 0.1 },
      headStyles: {
        fillColor: [20, 20, 20],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        2: { halign: "right", fontStyle: "bold" },
        3: { halign: "right" },
        4: { halign: "right", fontStyle: "bold" },
      },
    });

    let finalY = doc.lastAutoTable.finalY + 8;
    if (finalY > 270) {
      doc.addPage();
      finalY = 20;
    }
    doc.setFontSize(11);
    doc.text("2. REQUERIMIENTO DE MATERIALES", 14, finalY + 5);
    const tableBodyExplosion = explosion.map((mp) => [
      mp.nombre,
      mp.codigo,
      mp.necesario,
      mp.stock,
      mp.balance < 0 ? `FALTA ${Math.abs(mp.balance)}` : mp.balance,
    ]);
    autoTable(doc, {
      startY: finalY + 8,
      head: [["MATERIA PRIMA", "CÓDIGO", "NECESARIO", "STOCK", "BALANCE"]],
      body: tableBodyExplosion,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: 180 },
      headStyles: {
        fillColor: [230, 230, 230],
        textColor: 0,
        fontStyle: "bold",
        lineWidth: 0.1,
      },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right", fontStyle: "bold" },
      },
      didParseCell: function (data) {
        if (
          data.column.index === 4 &&
          String(data.cell.raw).startsWith("FALTA")
        ) {
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    if (currentPlanOperarios.length > 0) {
      finalY = doc.lastAutoTable.finalY + 8;
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }
      doc.setFontSize(11);
      doc.text("3. RESUMEN DE OPERARIOS", 14, finalY + 5);
      const tableBodyOps = currentPlanOperarios.map((op) => [
        op.nombre,
        op.total_producido,
      ]);
      autoTable(doc, {
        startY: finalY + 8,
        head: [["OPERARIO", "TOTAL PRODUCIDO"]],
        body: tableBodyOps,
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [50, 50, 50], textColor: 255 },
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        margin: { right: 110 },
      });
    }

    finalY = doc.lastAutoTable.finalY;
    const pageHeight = doc.internal.pageSize.height;
    if (finalY + 40 > pageHeight - 20) {
      doc.addPage();
    }
    const signatureY = pageHeight - 35;
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.line(30, signatureY, 90, signatureY);
    doc.setFontSize(8);
    doc.text("PREPARADO POR", 60, signatureY + 5, { align: "center" });
    doc.line(120, signatureY, 180, signatureY);
    doc.text("AUTORIZADO POR", 150, signatureY + 5, { align: "center" });
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Página ${i} de ${pageCount} - Generado el ${fecha} ${hora}`,
        105,
        pageHeight - 10,
        { align: "center" }
      );
    }
    doc.save(`Plan_${currentPlanNombre.replace(/\s+/g, "_")}.pdf`);
  };

  // --- HANDLERS ---
  const handleSelectPlan = async (planId) => {
    if (isSaving) return;
    setLoading(true);
    setSelectedPlanId(planId);
    setActiveTab("items");
    setCurrentPlanOperarios([]);
    setHistorialProduccion([]);
    try {
      const [resPlan, resOperarios, resHistorial] = await Promise.all([
        authFetch(`${API_BASE_URL}/planificacion/${planId}`),
        authFetch(`${API_BASE_URL}/planificacion/${planId}/operarios`),
        authFetch(`${API_BASE_URL}/planificacion/${planId}/historial`),
      ]);
      if (!resPlan.ok) throw new Error("Error al cargar plan");
      const planDetalle = await resPlan.json();
      setCurrentPlanNombre(planDetalle.nombre);

      // Aseguramos formato correcto de items
      const itemsFormateados = planDetalle.items.map((i) => ({
        ...i,
        fecha_inicio_estimada:
          i.fecha_inicio_estimada || new Date().toISOString().split("T")[0],
        ritmo_turno: i.ritmo_turno || 50,
      }));

      setCurrentPlanItems(itemsFormateados);
      setCurrentPlanEstado(planDetalle.estado);

      if (resOperarios.ok) setCurrentPlanOperarios(await resOperarios.json());
      if (resHistorial.ok) setHistorialProduccion(await resHistorial.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const role = sessionStorage.getItem("role");
    if (role !== "GERENCIA") {
      alert("⛔ ACCESO DENEGADO");
      return;
    }
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

  // --- BLOQUEO DE SEGURIDAD: AGREGAR ITEM ---
  const handleAddItem = (semielaborado) => {
    const role = sessionStorage.getItem("role");
    if (role !== "GERENCIA") {
      alert("⛔ ACCESO DENEGADO");
      return;
    }
    const cantidadInput = prompt(
      `Cantidad a fabricar de "${semielaborado.nombre}":`,
      "10"
    );
    if (cantidadInput === null) return;
    const cantidad = Number(cantidadInput);
    if (cantidad && cantidad > 0) {
      setCurrentPlanItems((prev) => {
        const index = prev.findIndex(
          (item) => item.semielaborado.id === semielaborado.id
        );
        if (index !== -1) {
          const nuevosItems = [...prev];
          nuevosItems[index] = {
            ...nuevosItems[index],
            cantidad: nuevosItems[index].cantidad + cantidad,
          };
          return nuevosItems;
        } else {
          // --- AQUÍ AÑADIMOS DEFAULTS PARA GANTT ---
          return [
            ...prev,
            {
              semielaborado,
              cantidad,
              producido: 0,
              plan_item_id: null,
              ritmo_turno: 50,
              fecha_inicio_estimada: new Date().toISOString().split("T")[0],
            },
          ];
        }
      });
    }
  };

  // --- BLOQUEO DE SEGURIDAD: EDITAR ITEM ---
  const handleEditItem = (indexToEdit, newQuantity) => {
    const role = sessionStorage.getItem("role");
    if (role !== "GERENCIA") {
      alert("⛔ ACCESO DENEGADO:\n\nSolo Gerencia puede editar las metas.");
      return;
    }

    setCurrentPlanItems((prev) => {
      const nuevos = [...prev];
      nuevos[indexToEdit] = { ...nuevos[indexToEdit], cantidad: newQuantity };
      return nuevos;
    });
  };

  // --- BLOQUEO DE SEGURIDAD: ELIMINAR ITEM ---
  const handleRemoveItem = (index) => {
    const role = sessionStorage.getItem("role");
    if (role !== "GERENCIA") {
      alert(
        "⛔ ACCESO DENEGADO:\n\nSolo Gerencia puede quitar ítems del plan."
      );
      return;
    }
    setCurrentPlanItems((prev) => prev.filter((_, i) => i !== index));
  };

  // --- FUNCIÓN DE GUARDADO CORREGIDA ---
  const handleSavePlan = async () => {
    const role = sessionStorage.getItem("role");
    if (role !== "GERENCIA") {
      alert("⛔ ACCESO DENEGADO");
      return;
    }
    if (!currentPlanNombre) return;

    await guardarPlanEnBD(currentPlanItems);
  };

  const guardarPlanEnBD = async (itemsAGuardar) => {
    setIsSaving(true);
    try {
      // AQUÍ ESTABA EL PROBLEMA: Enviamos todos los datos necesarios
      const body = {
        nombre: currentPlanNombre,
        items: itemsAGuardar.map((i) => ({
          semielaborado: i.semielaborado,
          cantidad: i.cantidad,
          producido: i.producido,
          plan_item_id: i.plan_item_id,
          ritmo_turno: i.ritmo_turno,
          fecha_inicio_estimada: i.fecha_inicio_estimada,
        })),
      };

      const url =
        selectedPlanId === "NEW"
          ? `${API_BASE_URL}/planificacion`
          : `${API_BASE_URL}/planificacion/${selectedPlanId}`;
      const method = selectedPlanId === "NEW" ? "POST" : "PUT";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        alert("⛔ No tienes permisos.");
        setIsSaving(false);
        return;
      }
      if (!res.ok) throw new Error("Error al guardar");

      const data = await res.json();

      // Recargamos la lista maestra
      const all = await authFetch(`${API_BASE_URL}/planificacion`).then((r) =>
        r.json()
      );
      setMasterPlanList(all);

      if (selectedPlanId === "NEW") {
        setSelectedPlanId(data.planId);
      }

      // Actualizamos estado local
      setCurrentPlanItems(itemsAGuardar);

      // Si venía del Gantt, no mostramos alerta intrusiva, solo log
      console.log("Plan guardado correctamente.");
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- BLOQUEO DE SEGURIDAD: CAMBIAR ESTADO ---
  const handleToggleEstado = async () => {
    const role = sessionStorage.getItem("role");
    if (role !== "GERENCIA") {
      alert("⛔ ACCESO DENEGADO:\n\nSolo Gerencia puede cerrar/abrir planes.");
      return;
    }

    if (selectedPlanId === "NEW") return;
    const estado = currentPlanEstado === "ABIERTO" ? "CERRADO" : "ABIERTO";
    if (confirm("¿Cambiar estado?")) {
      setIsSaving(true);

      const res = await authFetch(
        `${API_BASE_URL}/planificacion/${selectedPlanId}/estado`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado }),
        }
      );

      if (res.status === 403) {
        alert("⛔ Solo Gerencia puede cerrar/abrir planes.");
        setIsSaving(false);
        return;
      }

      setCurrentPlanEstado(estado);
      setMasterPlanList((prev) =>
        prev.map((p) => (p.id === selectedPlanId ? { ...p, estado } : p))
      );
      setIsSaving(false);
    }
  };

  // --- CALLBACK DEL GANTT ---
  const handleUpdateFromGantt = (updatedItems) => {
    // 1. Cerramos modal
    setShowGanttModal(false);
    // 2. Actualizamos estado local y guardamos
    guardarPlanEnBD(updatedItems);
  };

  // --- BLOQUEO DE SEGURIDAD: ELIMINAR PLAN ---
  const handleDeletePlan = async () => {
    const role = sessionStorage.getItem("role");
    if (role !== "GERENCIA") {
      alert("⛔ ACCESO DENEGADO:\n\nSolo Gerencia puede eliminar planes.");
      return;
    }

    if (selectedPlanId === "NEW") {
      setSelectedPlanId(null);
      return;
    }
    if (confirm("¿Eliminar?")) {
      setIsSaving(true);

      const res = await authFetch(
        `${API_BASE_URL}/planificacion/${selectedPlanId}`,
        {
          method: "DELETE",
        }
      );

      if (res.status === 403) {
        alert("⛔ Solo Gerencia puede eliminar planes.");
        setIsSaving(false);
        return;
      }

      setMasterPlanList((prev) => prev.filter((p) => p.id !== selectedPlanId));
      setSelectedPlanId(null);
      setIsSaving(false);
    }
  };

  const isPlanCerrado = currentPlanEstado === "CERRADO";
  const isPlanNuevo = selectedPlanId === "NEW";

  return (
    <>
      <motion.div
        layout
        className="animate-in fade-in duration-500 flex flex-col h-[calc(100vh-140px)] min-h-[700px] gap-6"
      >
        {/* KARDEX */}
        <motion.div className="bg-slate-800 rounded-xl flex flex-col border border-slate-700 shadow-lg overflow-hidden">
          <div className="p-4 bg-slate-800/50 border-b border-slate-700 z-10 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <FaClipboardList className="text-blue-400" /> Planes de
                Producción
              </h2>
              <div className="flex gap-2 ml-4 pl-4 border-l border-slate-600">
                <button
                  onClick={() => onNavigate("/")}
                  className="text-xs bg-slate-700 hover:bg-orange-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <FaFire /> Horno N°2
                </button>
                <button
                  onClick={() => onNavigate("/panel-control")}
                  className="text-xs bg-slate-700 hover:bg-blue-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <FaCogs /> Panel H2
                </button>
              </div>
            </div>

            <motion.button
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

        {/* DETALLE PLAN */}
        <AnimatePresence>
          {selectedPlanId && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-3">
                <input
                  type="text"
                  value={currentPlanNombre}
                  onChange={(e) => setCurrentPlanNombre(e.target.value)}
                  className="w-full md:w-1/3 bg-transparent border-0 border-b-2 border-slate-700 focus:border-blue-500 px-1 py-2 text-xl font-bold text-white focus:outline-none"
                  disabled={isPlanCerrado || isSaving}
                />
                <div className="flex gap-2">
                  <button
                    onClick={generarPDF}
                    disabled={isPlanNuevo}
                    className="px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all disabled:opacity-50"
                  >
                    <FaPrint /> PDF
                  </button>
                  {/* --- BOTÓN NUEVO CRONOGRAMA --- */}
                  <button
                    onClick={() => setShowGanttModal(true)}
                    disabled={isPlanNuevo || currentPlanItems.length === 0}
                    className="px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition-all disabled:opacity-50"
                  >
                    <FaCalendarAlt /> Cronograma
                  </button>
                  {/* Botones Guardar, Eliminar, etc... */}
                  <button
                    onClick={handleToggleEstado}
                    disabled={isSaving || isPlanNuevo}
                    className={`px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 text-white ${
                      isPlanCerrado ? "bg-gray-600" : "bg-green-600"
                    }`}
                  >
                    {isPlanCerrado ? <FaLock /> : <FaLockOpen />}{" "}
                    {isPlanCerrado ? "Cerrado" : "Abierto"}
                  </button>
                  <button
                    onClick={handleDeletePlan}
                    disabled={isSaving || isPlanNuevo}
                    className="px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-red-800 hover:bg-red-700 text-white"
                  >
                    <FaTrash />
                  </button>
                  <button
                    onClick={handleSavePlan}
                    disabled={isPlanCerrado || isSaving}
                    className="px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white"
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

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex border-b border-slate-700 bg-slate-800/50">
                  <TabButton
                    icon={<FaTasks />}
                    label="Items"
                    active={activeTab === "items"}
                    onClick={() => setActiveTab("items")}
                  />
                  <TabButton
                    icon={<FaIndustry />}
                    label="Producción"
                    active={activeTab === "produccion"}
                    onClick={() => setActiveTab("produccion")}
                  />
                  <TabButton
                    icon={<FaFileInvoice />}
                    label="MRP"
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
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  {activeTab === "items" && (
                    <div>
                      <AutoCompleteInput
                        items={allSemis}
                        onSelect={handleAddItem}
                        placeholder="Buscar semielaborado..."
                        disabled={isPlanCerrado || isSaving}
                      />
                      <ul className="space-y-3 mt-6">
                        {currentPlanItems.map((item, i) => (
                          <PlanItemCard
                            key={i}
                            item={item}
                            onRemove={() => handleRemoveItem(i)}
                            onEdit={(qty) => handleEditItem(i, qty)}
                            isPlanCerrado={isPlanCerrado}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                  {activeTab === "produccion" && (
                    <div className="overflow-hidden bg-slate-800/50 border border-slate-700 rounded-xl shadow-xl backdrop-blur-sm">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-xs text-gray-400 uppercase bg-slate-900/60 tracking-wider font-semibold">
                          <tr>
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4">Operario</th>
                            <th className="px-6 py-4">Producto</th>
                            <th className="px-6 py-4 text-right text-emerald-400">
                              OK
                            </th>
                            <th className="px-6 py-4 text-right text-rose-400">
                              Scrap
                            </th>
                            <th className="px-6 py-4">Detalles</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {historialProduccion.map((reg) => (
                            <tr key={reg.id} className="hover:bg-white/5">
                              <td className="px-6 py-4 text-white">
                                {new Date(
                                  reg.fecha_produccion
                                ).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-gray-300">
                                {reg.operario}
                              </td>
                              <td className="px-6 py-4 text-blue-300">
                                {reg.semielaborado}
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-emerald-400">
                                {reg.cantidad}
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-rose-400">
                                {reg.scrap || "-"}
                              </td>
                              <td className="px-6 py-4 text-xs text-gray-500">
                                {reg.motivo}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {activeTab === "mrp" && (
                    <div className="overflow-hidden border border-slate-700 rounded-lg">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 uppercase bg-slate-700">
                          <tr>
                            <th className="px-4 py-3">Materia Prima</th>
                            <th className="px-4 py-3 text-right">Necesario</th>
                            <th className="px-4 py-3 text-right">Stock</th>
                            <th className="px-4 py-3 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {explosion.map((mp) => (
                            <tr key={mp.id} className="hover:bg-slate-700/50">
                              <td className="px-4 py-3 text-white">
                                {mp.nombre}
                              </td>
                              <td className="px-4 py-3 text-right text-yellow-300">
                                {mp.necesario}
                              </td>
                              <td className="px-4 py-3 text-right text-blue-300">
                                {mp.stock}
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-bold ${
                                  mp.balance < 0
                                    ? "text-red-400"
                                    : "text-green-400"
                                }`}
                              >
                                {mp.balance}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
      <AnimatePresence>
        {showGanttModal && (
          <PlanGanttModal
            items={currentPlanItems}
            onClose={() => setShowGanttModal(false)}
            onSaveUpdate={handleUpdateFromGantt}
          />
        )}
      </AnimatePresence>
    </>
  );
}
