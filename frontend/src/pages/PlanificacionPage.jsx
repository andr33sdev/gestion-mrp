import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils.js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { hasRole } from "../auth/authHelper";
import toast from "react-hot-toast";
import SignatureCanvas from "react-signature-canvas";

// Componentes
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";
import PlanCard from "../components/planificacion/PlanCard";
import PlanStats from "../components/planificacion/PlanStats";

import {
  FaClipboardList,
  FaPlus,
  FaSpinner,
  FaSave,
  FaLock,
  FaLockOpen,
  FaTrash,
  FaTasks,
  FaFileInvoice,
  FaPrint,
  FaIndustry,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimes,
  FaSync,
  FaBook,
  FaHammer,
  FaImages,
  FaChevronLeft,
  FaUndo,
  FaPlay,
  FaStickyNote,
  FaBox,
  FaCogs,
  FaEllipsisV,
  FaPaperPlane,
  FaEdit,
  FaFolderOpen,
  FaArrowRight,
  FaCalendarAlt,
} from "react-icons/fa";

// --- MODAL: ASIGNACIÓN TAREA ---
function VisualTaskModal({ allSemis, onClose, onSave }) {
  const [selectedSemiId, setSelectedSemiId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const selectedSemi = allSemis.find(
    (s) => String(s.id) === String(selectedSemiId),
  );
  const variantesDisponibles = selectedSemi?.variantes || [];
  const selectedVariant = variantesDisponibles.find(
    (v) => String(v.id) === String(selectedVariantId),
  );

  const handleSubmit = () => {
    if (!selectedSemi || !selectedVariant || !cantidad)
      return alert("Completa los campos.");
    onSave({
      titulo: `${selectedSemi.nombre} - ${selectedVariant.nombre}`,
      producto_origen: selectedSemi.nombre,
      codigo_origen: selectedSemi.codigo,
      variante: selectedVariant.nombre,
      instrucciones: selectedVariant.especificaciones,
      fotos: selectedVariant.fotos,
      meta: Number(cantidad),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-700 flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <FaHammer size={18} />
            </div>{" "}
            Asignar Terminación
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-rose-500 transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <select
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:border-blue-500 outline-none transition-all cursor-pointer"
            value={selectedSemiId}
            onChange={(e) => {
              setSelectedSemiId(e.target.value);
              setSelectedVariantId("");
            }}
          >
            <option value="">Seleccione producto base...</option>
            {allSemis.map((s) => (
              <option key={s.id} value={s.id}>
                {s.codigo} - {s.nombre}
              </option>
            ))}
          </select>
          {selectedSemiId && (
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:border-blue-500 outline-none animate-in slide-in-from-top-2 cursor-pointer"
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
            >
              <option value="">Seleccione variante...</option>
              {variantesDisponibles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          )}
          <input
            type="number"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-2xl font-bold text-slate-700 outline-none transition-all"
            placeholder="Cantidad"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            disabled={!selectedVariant}
          />
        </div>
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={handleSubmit}
            disabled={!selectedVariant || !cantidad}
            className="px-8 py-3 bg-slate-700 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-600 active:scale-95 transition-all"
          >
            Confirmar Tarea
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- FUNCIÓN EXPORTAR PDF ---
const generarOrdenTerminacionPDF = (task) => {
  const doc = new jsPDF();
  const grisFuerte = [51, 65, 85]; // slate-700
  doc.setFillColor(...grisFuerte);
  doc.rect(0, 0, 210, 25, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ORDEN DE TERMINACIÓN / ARMADO", 14, 12);
  doc.setFontSize(10);
  doc.text(
    `PLANTA DE TERMINACIÓN - ${new Date().toLocaleDateString("es-AR")}`,
    14,
    19,
  );
  doc.setTextColor(0);
  doc.text(task.titulo, 14, 40);
  doc.text(`PRODUCTO: ${task.producto_origen} (${task.codigo_origen})`, 14, 50);
  doc.text(`VARIANTE: ${task.variante} | META: ${task.meta}`, 14, 56);
  doc.setFillColor(245, 245, 245);
  doc.rect(14, 65, 182, 40, "F");
  doc.text("INSTRUCCIONES:", 18, 73);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(task.instrucciones || "N/A", 174), 18, 80);
  (task.fotos || []).forEach((f, i) => {
    if (f) {
      try {
        doc.addImage(f, "JPEG", 14 + i * 65, 125, 60, 60);
        doc.rect(14 + i * 65, 125, 60, 60);
      } catch (e) {}
    }
  });
  doc.save(`OT_${task.titulo.replace(/\s+/g, "_")}.pdf`);
};

// --- COMPONENTE PRINCIPAL ---
export default function PlanificacionPage({ onNavigate }) {
  const [allSemis, setAllSemis] = useState([]);
  const [allMPs, setAllMPs] = useState([]);
  const [recetasMap, setRecetasMap] = useState({});
  const [masterPlanList, setMasterPlanList] = useState([]);
  const [showPendingDrawer, setShowPendingDrawer] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [currentPlanNombre, setCurrentPlanNombre] = useState("");
  const [currentPlanItems, setCurrentPlanItems] = useState([]);
  const [currentPlanEstado, setCurrentPlanEstado] = useState("ABIERTO");
  const [currentPlanOperarios, setCurrentPlanOperarios] = useState([]);
  const [historialProduccion, setHistorialProduccion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("items");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [mobileKanbanTab, setMobileKanbanTab] = useState("PENDIENTE");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [manualTasks, setManualTasks] = useState([]);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Estados Ficha Lateral y Comentarios
  const [itemEnFicha, setItemEnFicha] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  const [openMenuIdx, setOpenMenuIdx] = useState(null);
  const [editingComentarioId, setEditingComentarioId] = useState(null);
  const [editComentarioText, setEditComentarioText] = useState("");

  // --- NUEVOS ESTADOS PARA FIRMAS Y CONTROL DE CAMBIOS ---
  const [originalPlanItems, setOriginalPlanItems] = useState([]);
  const [savedPlanItems, setSavedPlanItems] = useState([]);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pdfTypeToGenerate, setPdfTypeToGenerate] = useState(null); // "ORIGINAL" o "CAMBIOS"
  const [signerName, setSignerName] = useState("");
  const sigCanvas = useRef({});

  const isPlanCerrado = currentPlanEstado === "CERRADO";
  const isPlanNuevo = selectedPlanId === "NEW";

  // 👇 Ahora es Admin si es de GERENCIA "O" si es JEFE PRODUCCIÓN
  const esAdmin = hasRole("GERENCIA") || hasRole("JEFE PRODUCCIÓN");

  // --- DETECCIÓN DE CAMBIOS EN EL PLAN ---
  const planChanges = useMemo(() => {
    if (!originalPlanItems || selectedPlanId === "NEW")
      return {
        hasChanges: false,
        added: [],
        modified: [],
        deleted: [],
        unchanged: [],
      };

    let hasChanges = false;
    const added = [];
    const modified = [];
    const deleted = [];
    const unchanged = [];

    // Revisar agregados y modificados
    currentPlanItems.forEach((curr) => {
      const orig = originalPlanItems.find(
        (o) => o.semielaborado.id === curr.semielaborado.id,
      );
      if (!orig) {
        added.push(curr);
        hasChanges = true;
      } else if (orig.cantidad !== curr.cantidad) {
        modified.push({ ...curr, oldCantidad: orig.cantidad });
        hasChanges = true;
      } else {
        unchanged.push(curr);
      }
    });

    // Revisar eliminados
    originalPlanItems.forEach((orig) => {
      const exists = currentPlanItems.find(
        (c) => c.semielaborado.id === orig.semielaborado.id,
      );
      if (!exists) {
        deleted.push(orig);
        hasChanges = true;
      }
    });

    return { hasChanges, added, modified, deleted, unchanged };
  }, [currentPlanItems, originalPlanItems, selectedPlanId]);

  const hasChangesToSave =
    selectedPlanId === "NEW" ||
    JSON.stringify(currentPlanItems) !== JSON.stringify(savedPlanItems);

  const explosion = useMemo(() => {
    const totalNecesario = {};
    currentPlanItems.forEach((item) => {
      const pendiente = item.cantidad - item.producido;
      if (pendiente <= 0) return;
      const receta = recetasMap[item.semielaborado.id];
      if (receta)
        receta.forEach((ing) => {
          const mpId = ing.materia_prima_id;
          totalNecesario[mpId] =
            (totalNecesario[mpId] || 0) + ing.cantidad * pendiente;
        });
    });
    const mpMap = new Map(allMPs.map((mp) => [mp.id, mp]));
    return Object.keys(totalNecesario)
      .map((id) => {
        const mp = mpMap.get(Number(id));
        if (!mp) return null;
        const balance = mp.stock_actual - totalNecesario[id];
        return {
          id,
          nombre: mp.nombre,
          codigo: mp.codigo,
          necesario: totalNecesario[id].toFixed(2),
          stock: Number(mp.stock_actual).toFixed(2),
          balance: balance.toFixed(2),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.balance - b.balance);
  }, [currentPlanItems, recetasMap, allMPs]);

  // Precargar el nombre del usuario logueado
  useEffect(() => {
    try {
      const userStorage = localStorage.getItem("mrp_user");
      if (userStorage) setSignerName(JSON.parse(userStorage).nombre);
    } catch (e) {}
  }, []);

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
      } finally {
        setLoading(false);
      }
    };
    cargarDatosMaestros();
  }, []);

  // Cargar comentarios
  useEffect(() => {
    const idReal = itemEnFicha?.plan_item_id || itemEnFicha?.id;
    if (idReal) {
      authFetch(`${API_BASE_URL}/planificacion/item/${idReal}/comentarios`)
        .then((res) => res.json())
        .then((data) => setComentarios(data))
        .catch(() => setComentarios([]));
    } else {
      setComentarios([]);
    }
  }, [itemEnFicha]);

  const guardarComentario = async () => {
    if (!nuevoComentario.trim()) return;
    const idReal = itemEnFicha?.plan_item_id || itemEnFicha?.id;
    if (!idReal) return;

    setGuardandoNotas(true);
    try {
      let usuarioLocal = "Operador";
      try {
        const userStorage = localStorage.getItem("mrp_user");
        if (userStorage) {
          const userData = JSON.parse(userStorage);
          usuarioLocal = userData.nombre || "Operador";
        }
      } catch (e) {}

      await authFetch(
        `${API_BASE_URL}/planificacion/item/${idReal}/comentarios`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: nuevoComentario,
            usuario: usuarioLocal,
          }),
        },
      );
      setNuevoComentario("");
      const res = await authFetch(
        `${API_BASE_URL}/planificacion/item/${idReal}/comentarios`,
      );
      if (res.ok) setComentarios(await res.json());
    } finally {
      setGuardandoNotas(false);
    }
  };

  const handleDeleteComentario = async (comentarioId) => {
    if (!confirm("¿Eliminar esta nota?")) return;
    const idReal = itemEnFicha?.plan_item_id || itemEnFicha?.id;
    try {
      await authFetch(
        `${API_BASE_URL}/planificacion/item/${idReal}/comentarios/${comentarioId}`,
        { method: "DELETE" },
      );
      setComentarios((prev) => prev.filter((c) => c.id !== comentarioId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateComentario = async (comentarioId) => {
    if (!editComentarioText.trim()) return;
    const idReal = itemEnFicha?.plan_item_id || itemEnFicha?.id;
    try {
      await authFetch(
        `${API_BASE_URL}/planificacion/item/${idReal}/comentarios/${comentarioId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: editComentarioText }),
        },
      );
      setComentarios((prev) =>
        prev.map((c) =>
          c.id === comentarioId ? { ...c, texto: editComentarioText } : c,
        ),
      );
      setEditingComentarioId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const loadPendingOrders = async () => {
    setLoadingPending(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/planificacion/sin-stock`);
      if (res.ok) setPendingOrders(await res.json());
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (showPendingDrawer) loadPendingOrders();
  }, [showPendingDrawer]);

  const handleSelectPlan = async (planId, preserveOriginals = false) => {
    setLoading(true);
    setSelectedPlanId(planId);
    setActiveTab("items");
    try {
      const [resP, resO, resH] = await Promise.all([
        authFetch(`${API_BASE_URL}/planificacion/${planId}`),
        authFetch(`${API_BASE_URL}/planificacion/${planId}/operarios`),
        authFetch(`${API_BASE_URL}/planificacion/${planId}/historial`),
      ]);
      if (resP.ok) {
        const data = await resP.json();
        setCurrentPlanNombre(data.nombre);
        setCurrentPlanEstado(data.estado);
        const mappedItems = data.items.map((i) => ({
          ...i,
          estado_kanban: i.estado || i.estado_kanban || "PENDIENTE",
        }));
        setCurrentPlanItems(mappedItems);

        // Actualizamos la copia de "Guardados"
        setSavedPlanItems(JSON.parse(JSON.stringify(mappedItems)));

        // Solo sobrescribimos la "Foto Original" si es la primera vez que abrimos el plan
        if (!preserveOriginals) {
          setOriginalPlanItems(JSON.parse(JSON.stringify(mappedItems)));
        }
      }
      if (resO.ok) setCurrentPlanOperarios(await resO.json());
      if (resH.ok) setHistorialProduccion(await resH.json());
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    // 👇 Validamos usando la variable esAdmin que ya incluye al Jefe de Producción
    if (!esAdmin) {
      return toast.error("No tenés permisos para crear planes.");
    }

    setSelectedPlanId("NEW");
    setCurrentPlanNombre(
      `Nuevo Plan ${new Date().toLocaleDateString("es-AR")}`,
    );
    setCurrentPlanItems([]);
    setCurrentPlanEstado("ABIERTO");
    setActiveTab("items");
  };

  const handleAddItem = (s) => {
    const qty = prompt(`Cantidad para ${s.nombre}:`, "10");
    if (qty) {
      setCurrentPlanItems((prev) => {
        const idx = prev.findIndex((item) => item.semielaborado.id === s.id);
        if (idx !== -1) {
          const nuevos = [...prev];
          nuevos[idx].cantidad += Number(qty);
          return nuevos;
        }
        return [
          ...prev,
          {
            semielaborado: s,
            cantidad: Number(qty),
            producido: 0,
            estado_kanban: "PENDIENTE",
          },
        ];
      });
    }
  };

  const handleUpdateItemStatus = async (idx, nuevoEstado) => {
    const n = [...currentPlanItems];
    const item = n[idx];

    const estadoLabel = {
      PENDIENTE: "a Pendiente",
      PROCESO: "a Producción",
      FINALIZADO: "a Finalizado",
    };

    item.estado_kanban = nuevoEstado;
    setCurrentPlanItems(n);
    setSavedPlanItems(JSON.parse(JSON.stringify(n)));
    toast.success(
      `${item.semielaborado.codigo} movido ${estadoLabel[nuevoEstado] || ""}`,
    );

    // 👇 AUTO-GUARDADO SILENCIOSO EN BASE DE DATOS
    if (selectedPlanId !== "NEW") {
      try {
        await authFetch(`${API_BASE_URL}/planificacion/${selectedPlanId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: currentPlanNombre, items: n }),
        });
      } catch (error) {
        console.error("Error auto-guardando kanban", error);
      }
    }
  };

  const handleEditItem = (idx, qty) => {
    const n = [...currentPlanItems];
    const oldQty = n[idx].cantidad;
    n[idx].cantidad = qty;
    setCurrentPlanItems(n);
    // 👇 Toast simple de confirmación
    toast.success(`Meta actualizada: de ${oldQty} a ${qty}`);
  };

  const handleRemoveItem = (idx) => {
    setCurrentPlanItems((p) => p.filter((_, i) => i !== idx));
  };

  const handleSavePlan = async () => {
    if (!currentPlanNombre.trim())
      return toast.error("El plan necesita un nombre");
    // Usamos toast.promise para que muestre "Guardando..." y luego éxito o error automáticamente
    setIsSaving(true);
    const savePromise = new Promise(async (resolve, reject) => {
      try {
        const body = { nombre: currentPlanNombre, items: currentPlanItems };
        const isNew = selectedPlanId === "NEW";
        const url = isNew
          ? `${API_BASE_URL}/planificacion`
          : `${API_BASE_URL}/planificacion/${selectedPlanId}`;

        const res = await authFetch(url, {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          setMasterPlanList(
            await authFetch(`${API_BASE_URL}/planificacion`).then((r) =>
              r.json(),
            ),
          );
          if (!isNew) {
            // 👇 Le pasamos "true" para que recargue sin borrar el historial original
            await handleSelectPlan(selectedPlanId, true);
          }
          resolve(); // Éxito
        } else {
          reject(); // Error del servidor
        }
      } catch (e) {
        reject(e); // Error de red
      } finally {
        setIsSaving(false);
      }
    });

    toast.promise(savePromise, {
      loading: "Guardando plan...",
      success: "Plan guardado correctamente",
      error: "Error al guardar el plan",
    });
  };

  const handleToggleEstado = async () => {
    if (!hasRole("GERENCIA")) return alert("⛔");
    const estado = currentPlanEstado === "ABIERTO" ? "CERRADO" : "ABIERTO";
    if (confirm("¿Cambiar estado?")) {
      await authFetch(
        `${API_BASE_URL}/planificacion/${selectedPlanId}/estado`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado }),
        },
      );
      setCurrentPlanEstado(estado);
      setMasterPlanList((prev) =>
        prev.map((p) => (p.id === selectedPlanId ? { ...p, estado } : p)),
      );
    }
  };

  const handleDeletePlan = async () => {
    if (!hasRole("GERENCIA")) return alert("⛔");
    if (confirm("¿Borrar plan?")) {
      await authFetch(`${API_BASE_URL}/planificacion/${selectedPlanId}`, {
        method: "DELETE",
      });
      setMasterPlanList((prev) => prev.filter((p) => p.id !== selectedPlanId));
      setSelectedPlanId(null);
    }
  };

  const handleForceSync = async () => {
    if (confirm("¿Forzar actualización con Excel?")) {
      setLoadingPending(true);
      await authFetch(`${API_BASE_URL}/planificacion/sincronizar-ya`, {
        method: "POST",
      });
      setTimeout(() => loadPendingOrders(), 2000);
    }
  };

  // Abre el modal pidiendo la firma según el tipo de PDF
  const handleRequestPDF = (type) => {
    setPdfTypeToGenerate(type);
    setShowSignatureModal(true);
  };

  const handleConfirmSignature = () => {
    const isCanvasEmpty = sigCanvas.current.isEmpty();

    // 👇 CAMBIO ACÁ: Usamos getCanvas() en lugar de getTrimmedCanvas()
    const sigData = isCanvasEmpty
      ? null
      : sigCanvas.current.getCanvas().toDataURL("image/png");

    if (pdfTypeToGenerate === "ORIGINAL") generarPDFOrden(sigData, signerName);
    if (pdfTypeToGenerate === "CAMBIOS") generarPDFCambios(sigData, signerName);

    setShowSignatureModal(false);
  };

  // --- GENERADOR PLANILLA ORIGINAL CON FIRMA ---
  const generarPDFOrden = async (sigData, nombreFirma) => {
    const itemsPendientes = currentPlanItems.filter(
      (i) => i.estado_kanban !== "FINALIZADO",
    );
    if (itemsPendientes.length === 0)
      return toast("No hay pendientes para la planilla.", { icon: "🎉" });

    toast.loading("Generando planilla...", { id: "pdfPlanilla" });
    const doc = new jsPDF();
    const slate700 = [51, 65, 85];
    const slate500 = [100, 116, 139];
    const slate50 = [248, 250, 252];
    const slate200 = [226, 232, 240];

    doc.setFillColor(...slate50);
    doc.rect(0, 0, 210, 30, "F");
    doc.setDrawColor(...slate200);
    doc.setLineWidth(0.5);
    doc.line(0, 30, 210, 30);
    doc.setTextColor(...slate700);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PLAN DE PRODUCCIÓN", 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...slate500);
    doc.text(`Plan: ${currentPlanNombre}`, 14, 22);

    autoTable(doc, {
      startY: 40,
      head: [["CÓDIGO", "PRODUCTO", "OBJETIVO"]],
      body: itemsPendientes.map((i) => [
        i.semielaborado.codigo,
        i.semielaborado.nombre,
        i.cantidad,
      ]),
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: 4,
        textColor: slate700,
        lineColor: slate200,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: slate50,
        textColor: slate500,
        fontSize: 9,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 35 },
        1: { cellWidth: "auto" },
        2: { halign: "right", cellWidth: 30 },
      },
    });

    let finalY = doc.lastAutoTable.finalY + 15;

    // BLOQUE DE FIRMA
    if (sigData) {
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }
      doc.addImage(sigData, "PNG", 14, finalY, 40, 20);
      doc.setDrawColor(100, 116, 139);
      doc.line(14, finalY + 22, 65, finalY + 22);
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(nombreFirma || "Responsable", 14, finalY + 28);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Firma Electrónica Autorizada", 14, finalY + 32);
    }

    doc.save(`Plan_${currentPlanNombre.replace(/\s+/g, "_")}.pdf`);
    toast.dismiss("pdfPlanilla");
    toast.success("Planilla descargada");
  };

  // --- GENERADOR PLANILLA DE CAMBIOS CON FIRMA ---
  const generarPDFCambios = async (sigData, nombreFirma) => {
    toast.loading("Generando actualización...", { id: "pdfCambios" });
    const doc = new jsPDF();
    const slate700 = [51, 65, 85];
    const slate500 = [100, 116, 139];
    const slate50 = [248, 250, 252];
    const slate200 = [226, 232, 240];

    doc.setFillColor(...slate50);
    doc.rect(0, 0, 210, 30, "F");
    doc.setDrawColor(...slate200);
    doc.setLineWidth(0.5);
    doc.line(0, 30, 210, 30);
    doc.setTextColor(...slate700);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PLAN DE PRODUCCIÓN - ACTUALIZACIÓN", 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...slate500);
    doc.text(`Plan: ${currentPlanNombre}`, 14, 22);
    doc.text(
      `Modificado el: ${new Date().toLocaleDateString("es-AR")}`,
      14,
      27,
    );

    const bodyData = [];
    planChanges.unchanged.forEach((i) =>
      bodyData.push([
        i.semielaborado.codigo,
        i.semielaborado.nombre,
        i.cantidad,
        "",
      ]),
    );
    planChanges.modified.forEach((i) =>
      bodyData.push([
        i.semielaborado.codigo,
        i.semielaborado.nombre,
        `${i.oldCantidad} -> ${i.cantidad}`,
        "MODIFICADA",
      ]),
    );
    planChanges.added.forEach((i) =>
      bodyData.push([
        i.semielaborado.codigo,
        i.semielaborado.nombre,
        i.cantidad,
        "AGREGADO",
      ]),
    );

    autoTable(doc, {
      startY: 40,
      head: [["CÓDIGO", "PRODUCTO", "OBJETIVO", "ESTADO"]],
      body: bodyData,
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: 4,
        textColor: slate700,
        lineColor: slate200,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: slate50,
        textColor: slate500,
        fontSize: 9,
        fontStyle: "bold",
      },
      didParseCell: function (data) {
        // Pinta de verde el texto AGREGADO y naranja el MODIFICADA
        if (data.section === "body" && data.column.index === 3) {
          if (data.cell.raw === "AGREGADO")
            data.cell.styles.textColor = [16, 185, 129];
          if (data.cell.raw === "MODIFICADA")
            data.cell.styles.textColor = [245, 158, 11];
        }
      },
    });

    let finalY = doc.lastAutoTable.finalY + 15;

    // ÍTEMS ELIMINADOS (Se listan abajo)
    if (planChanges.deleted.length > 0) {
      if (finalY > 260) {
        doc.addPage();
        finalY = 20;
      }
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("ÍTEMS ELIMINADOS DEL PLAN:", 14, finalY);
      finalY += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      planChanges.deleted.forEach((d) => {
        doc.text(
          `• ${d.semielaborado.codigo} - ${d.semielaborado.nombre} (Meta anterior: ${d.cantidad})`,
          14,
          finalY,
        );
        finalY += 5;
      });
      finalY += 10;
    }

    // BLOQUE DE FIRMA
    if (sigData) {
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }
      doc.addImage(sigData, "PNG", 14, finalY, 40, 20);
      doc.setDrawColor(100, 116, 139);
      doc.line(14, finalY + 22, 65, finalY + 22);
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(nombreFirma || "Responsable", 14, finalY + 28);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Firma Electrónica Autorizada", 14, finalY + 32);
    }

    doc.save(`Cambios_Plan_${currentPlanNombre.replace(/\s+/g, "_")}.pdf`);
    toast.dismiss("pdfCambios");
    toast.success("PDF de Cambios generado");
    setOriginalPlanItems(JSON.parse(JSON.stringify(currentPlanItems)));
  };

  // --- KANBAN COLUMN RENDER ---
  const renderKanbanColumn = (title, status, color) => {
    const items = currentPlanItems.filter(
      (i) => (i.estado_kanban || "PENDIENTE") === status,
    );

    return (
      <div className="flex flex-col h-full bg-slate-50/40 rounded-[2rem] border border-slate-100 min-h-0 relative">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white/40 rounded-t-[2rem] shrink-0">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${color}`}></span>
            {title}
          </h3>
          <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-lg border border-slate-100 text-slate-400">
            {items.length}
          </span>
        </div>

        {openMenuIdx !== null && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpenMenuIdx(null)}
          />
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {items.map((item, i) => {
            const realIdx = currentPlanItems.findIndex((orig) => orig === item);
            const isDone = item.producido >= item.cantidad;

            // 👇 NUEVO: Detecta si la tarjeta es una de las últimas dos de la columna
            const isNearBottom = items.length > 2 && i >= items.length - 2;

            return (
              <motion.div
                layout
                key={item.id || i}
                className={`bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all group flex items-center justify-between relative ${openMenuIdx === realIdx ? "z-[60]" : "z-10"}`}
              >
                <div
                  className="flex-1 min-w-0 pr-3 cursor-pointer"
                  onClick={() => setItemEnFicha(item)}
                >
                  <h4 className="text-xs font-bold text-slate-700 truncate leading-tight group-hover:text-blue-600 transition-colors">
                    {item.semielaborado.nombre}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-widest">
                      {item.semielaborado.codigo}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isDone ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"}`}
                    >
                      {item.producido} / {item.cantidad}
                    </span>
                  </div>
                </div>

                {esAdmin && (
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuIdx(
                          openMenuIdx === realIdx ? null : realIdx,
                        );
                      }}
                      className="p-2 text-slate-300 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-all"
                    >
                      <FaEllipsisV size={12} />
                    </button>

                    <AnimatePresence>
                      {openMenuIdx === realIdx && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.1 }}
                          // 👇 NUEVO: Si está al fondo usa "bottom-full", si no, usa "top-full"
                          className={`absolute right-0 w-44 bg-white border border-slate-100 shadow-xl rounded-xl overflow-hidden py-1 z-[70] ${isNearBottom ? "bottom-full mb-1 origin-bottom-right" : "top-full mt-1 origin-top-right"}`}
                        >
                          <div className="px-3 py-1.5 border-b border-slate-50 mb-1">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                              Estado
                            </span>
                          </div>
                          {status === "PENDIENTE" && (
                            <button
                              onClick={() => {
                                handleUpdateItemStatus(realIdx, "PROCESO");
                                setOpenMenuIdx(null);
                              }}
                              className="w-full text-left px-4 py-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                            >
                              <FaPlay size={8} /> Pasar a Produciendo
                            </button>
                          )}
                          {status === "PROCESO" && (
                            <>
                              <button
                                onClick={() => {
                                  handleUpdateItemStatus(realIdx, "FINALIZADO");
                                  setOpenMenuIdx(null);
                                }}
                                className="w-full text-left px-4 py-2 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                              >
                                <FaCheckCircle size={10} /> Marcar Terminado
                              </button>
                              <button
                                onClick={() => {
                                  handleUpdateItemStatus(realIdx, "PENDIENTE");
                                  setOpenMenuIdx(null);
                                }}
                                className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                              >
                                <FaUndo size={8} /> Devolver a Cola
                              </button>
                            </>
                          )}
                          {status === "FINALIZADO" && (
                            <button
                              onClick={() => {
                                handleUpdateItemStatus(realIdx, "PROCESO");
                                setOpenMenuIdx(null);
                              }}
                              className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                            >
                              <FaUndo size={8} /> Reabrir a Produciendo
                            </button>
                          )}
                          {!isPlanCerrado && (
                            <>
                              <div className="px-3 py-1.5 border-b border-t border-slate-50 my-1">
                                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                                  Acciones
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setOpenMenuIdx(null);
                                  const n = prompt(
                                    "Nueva Meta:",
                                    item.cantidad,
                                  );
                                  if (n) handleEditItem(realIdx, Number(n));
                                }}
                                className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                              >
                                <FaEdit size={10} /> Editar Meta
                              </button>
                              <button
                                onClick={() => {
                                  handleRemoveItem(realIdx);
                                  setOpenMenuIdx(null);
                                }}
                                className="w-full text-left px-4 py-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                              >
                                <FaTrash size={10} /> Eliminar del Plan
                              </button>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- GENERADOR PDF MASIVO (BOOK TÉCNICO CON TOASTS) ---
  const generarFichasMasivas = async () => {
    if (currentPlanItems.length === 0)
      return toast.error("El plan está vacío.");
    if (
      !confirm(`¿Generar book técnico con ${currentPlanItems.length} fichas?`)
    )
      return;

    setGeneratingPDF(true);

    const pdfPromise = new Promise(async (resolve, reject) => {
      try {
        const promises = currentPlanItems.map((item) =>
          authFetch(`${API_BASE_URL}/ingenieria/ficha/${item.semielaborado.id}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        );
        const resultados = await Promise.all(promises);
        const doc = new jsPDF();

        resultados.forEach((data, index) => {
          if (!data) return;
          if (index > 0) doc.addPage();

          const { producto, receta, specs = {}, ultima_version_receta } = data;
          const { tipo_proceso, parametros_maquina: pm = {} } = producto;
          const azulOscuro = [30, 41, 59];
          const grisClaro = [241, 245, 249];
          const rojoAlerta = [185, 28, 28];

          doc.setFillColor(...azulOscuro);
          doc.rect(0, 0, 210, 24, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.text("FICHA TÉCNICA DE PRODUCCIÓN", 14, 11);
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.text(`PROCESO: ${tipo_proceso || "ROTOMOLDEO"}`, 14, 18);
          const fechaImpresion = new Date().toLocaleDateString("es-AR");
          doc.setFontSize(8);
          doc.text(`Impreso: ${fechaImpresion}`, 195, 8, { align: "right" });
          doc.text(`Plan: ${currentPlanNombre}`, 195, 13, { align: "right" });
          doc.setFont("helvetica", "italic");
          doc.text("Autorizado por: Jefe de Producción", 195, 18, {
            align: "right",
          });

          let yPos = 34;
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(`${producto.nombre}`, 14, yPos);
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.text(`CÓDIGO: ${producto.codigo}`, 14, yPos + 6);
          doc.setDrawColor(200);
          doc.setFillColor(...grisClaro);
          doc.roundedRect(120, yPos - 6, 75, 14, 1, 1, "FD");
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text("RECETA VIGENTE:", 124, yPos);
          doc.setTextColor(0);
          doc.setFont("helvetica", "bold");
          doc.text(
            ultima_version_receta?.nombre_version || "Estándar / Inicial",
            124,
            yPos + 5,
          );
          yPos += 16;

          const specsData = [
            [
              `REFLECTIVA: ${specs.tipo_reflectiva || "N/A"}`,
              `PROTECTOR: ${specs.tipo_protector || "N/A"}`,
              `APLICACIÓN: ${specs.tipo_aplicacion || "N/A"}`,
            ],
          ];
          autoTable(doc, {
            startY: yPos,
            body: specsData,
            theme: "plain",
            styles: {
              fontSize: 8,
              cellPadding: 3,
              fontStyle: "bold",
              textColor: [50, 50, 50],
              halign: "center",
            },
            columnStyles: {
              0: { fillColor: [230, 230, 230], cellWidth: 60 },
              1: { fillColor: [230, 230, 230], cellWidth: 60 },
              2: { fillColor: [230, 230, 230], cellWidth: "auto" },
            },
            margin: { left: 14, right: 14 },
          });
          yPos = doc.lastAutoTable.finalY + 12;

          const colLeftX = 14;
          const colRightX = 115;
          const colWidthLeft = 95;
          const colWidthRight = 80;
          const startYBlock = yPos;
          doc.setFillColor(...azulOscuro);
          doc.rect(colLeftX, yPos, colWidthLeft, 7, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(9);
          doc.text(
            `PARÁMETROS ${tipo_proceso === "INYECCION" ? "INYECCIÓN" : "ROTOMOLDEO"}`,
            colLeftX + 3,
            yPos + 4.5,
          );
          let yMachine = yPos + 8;

          if (tipo_proceso === "INYECCION") {
            const inyData = [
              ["#1", pm.pos1 || "-", pm.pres1 || "-", pm.vel1 || "-"],
              ["#2", pm.pos2 || "-", pm.pres2 || "-", pm.vel2 || "-"],
              ["#3", pm.pos3 || "-", pm.pres3 || "-", pm.vel3 || "-"],
              ["#4", pm.pos4 || "-", pm.pres4 || "-", pm.vel4 || "-"],
              ["#5", pm.pos5 || "-", pm.pres5 || "-", pm.vel5 || "-"],
              ["#6", pm.pos6 || "-", pm.pres6 || "-", pm.vel6 || "-"],
            ];
            autoTable(doc, {
              startY: yMachine,
              head: [["#", "Pos", "Pres", "Vel"]],
              body: inyData,
              theme: "grid",
              headStyles: {
                fillColor: [80, 80, 80],
                fontSize: 8,
                cellPadding: 2,
              },
              styles: { fontSize: 8, halign: "center", cellPadding: 2 },
              margin: { left: colLeftX },
              tableWidth: colWidthLeft,
            });
            yMachine = doc.lastAutoTable.finalY + 6;
            doc.setFontSize(8);
            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            doc.text("TEMPERATURAS:", colLeftX, yMachine);
            doc.setFont("helvetica", "normal");
            doc.text(pm.temperaturas_zonas || "-", colLeftX + 30, yMachine);
            yMachine += 5;
            doc.setFont("helvetica", "bold");
            doc.text("CHILLER:", colLeftX, yMachine);
            doc.setFont("helvetica", "normal");
            doc.text(pm.chiller_matriz || "-", colLeftX + 30, yMachine);
            yMachine += 6;

            autoTable(doc, {
              startY: yMachine + 6,
              head: [["Posición", "Presión", "Velocidad", "P. Atrás"]],
              body: [
                [
                  pm.carga_pos || "-",
                  pm.carga_pres || "-",
                  pm.carga_vel || "-",
                  pm.carga_pres_atras || "-",
                ],
              ],
              theme: "grid",
              headStyles: {
                fontStyle: "bold",
                fillColor: [50, 50, 50],
                textColor: 255,
                fontSize: 7,
                halign: "center",
              },
              styles: { fontSize: 8, halign: "center", cellPadding: 2 },
              margin: { left: colLeftX },
              tableWidth: colWidthLeft,
            });
            yMachine = doc.lastAutoTable.finalY;
          } else {
            const rotoData = [
              [
                "1",
                pm.t1 || "-",
                pm.v1m1 || "-",
                pm.v2m1 || "-",
                pm.inv1 || "-",
              ],
              [
                "2",
                pm.t2 || "-",
                pm.v1m2 || "-",
                pm.v2m2 || "-",
                pm.inv2 || "-",
              ],
              [
                "3",
                pm.t3 || "-",
                pm.v1m3 || "-",
                pm.v2m3 || "-",
                pm.inv3 || "-",
              ],
              [
                "4",
                pm.t4 || "-",
                pm.v1m4 || "-",
                pm.v2m4 || "-",
                pm.inv4 || "-",
              ],
            ];

            const tiempoCocinado =
              (Number(pm.t1) || 0) +
              (Number(pm.t2) || 0) +
              (Number(pm.t3) || 0) +
              (Number(pm.t4) || 0);
            const tiempoEnfriado = Number(pm.frio_min) || 0;
            const tiempoCiclo = tiempoCocinado + tiempoEnfriado;

            autoTable(doc, {
              startY: yMachine,
              head: [["Etapa", "T (min)", "V1 %", "V2 %", "Inv %"]],
              body: rotoData,
              theme: "striped",
              headStyles: {
                fillColor: [80, 80, 80],
                fontSize: 8,
                cellPadding: 2,
              },
              styles: { fontSize: 8, halign: "center", cellPadding: 2 },
              margin: { left: colLeftX },
              tableWidth: colWidthLeft,
            });
            yMachine = doc.lastAutoTable.finalY + 4;
            autoTable(doc, {
              startY: yMachine,
              head: [
                [
                  "ENFRIAMIENTO",
                  "TEMP. HORNO",
                  "T. COCINADO",
                  "T. CICLO TOTAL",
                ],
              ],
              body: [
                [
                  pm.frio_min ? `${pm.frio_min} min` : "-",
                  (pm.temp_horno || "-") + " °C",
                  `${tiempoCocinado} min`,
                  `${tiempoCiclo} min`,
                ],
              ],
              theme: "grid",
              headStyles: {
                fillColor: [100, 100, 100],
                fontSize: 7,
                cellPadding: 2,
              },
              styles: {
                fontSize: 8,
                halign: "center",
                fontStyle: "bold",
                cellPadding: 2,
              },
              margin: { left: colLeftX },
              tableWidth: colWidthLeft,
            });
            yMachine = doc.lastAutoTable.finalY;
          }

          doc.setFillColor(...azulOscuro);
          doc.rect(colRightX, startYBlock, colWidthRight, 7, "F");
          doc.setTextColor(255, 255, 255);
          doc.text("INGENIERÍA (RECETA)", colRightX + 3, startYBlock + 4.5);
          let yRecipe = startYBlock + 8;
          const tablaReceta = receta.map((item) => [
            item.nombre,
            `${Number(item.cantidad).toFixed(2)}`,
          ]);
          autoTable(doc, {
            startY: yRecipe,
            head: [["INSUMO", "CANTIDAD"]],
            body: tablaReceta,
            theme: "striped",
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
            columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
            margin: { left: colRightX },
            tableWidth: colWidthRight,
          });
          yRecipe = doc.lastAutoTable.finalY;

          yPos = Math.max(yMachine, yRecipe) + 12;

          if (yPos > 190) {
            doc.addPage();
            yPos = 20;
          }
          doc.setFillColor(...azulOscuro);
          doc.rect(14, yPos, 182, 7, "F");
          doc.setTextColor(255, 255, 255);
          doc.text("PROCEDIMIENTO OPERATIVO ESTÁNDAR", 16, yPos + 4.5);
          yPos += 12;

          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setLineHeightFactor(1.8);
          let textoProcedimiento =
            tipo_proceso === "INYECCION"
              ? `Se separa el material correspondiente con la matriz colocada, bajo supervisión del ENCARGADO DE PLANTA. Se selecciona en la librería el modelo a fabricar (constatando parámetros). Se procede a calentar la Inyectora; la temperatura alcanzará el set-point en el tiempo determinado.\nCualquier problema con el proceso o finalización, acudir al Encargado de Planta. En caso de no encontrarse en ese momento, dejar el artículo identificado y separado correctamente para su posterior análisis y evaluación.`
              : `Identificar material indicado por ENCARGADO. En el horno, con matriz colocada y modelo seleccionado, posicionar matriz horizontal (carga). Aplicar desmoldante si requiere. Pesar cantidad declarada en ficha y trasladar. Verter material parejo dentro de la matriz. Colocar respirador limpio. Cerrar tapa y trabas. Repetir proceso.\nCualquier problema con el proceso o finalización, acudir al Encargado de Planta. En caso de no encontrarse en ese momento, dejar el artículo identificado y separado correctamente para su posterior análisis y evaluación.`;

          const splitText = doc.splitTextToSize(textoProcedimiento, 182);
          doc.text(splitText, 14, yPos);
          yPos += splitText.length * 6 + 10;
          doc.setLineHeightFactor(1.15);

          if (yPos > 230) {
            if (yPos > 250) {
              doc.addPage();
              yPos = 20;
            }
          }
          let problemas =
            tipo_proceso === "INYECCION"
              ? [
                  ["Agujereada", "Regulación carga/aire/presión"],
                  ["Manchada", "Avisar y esperar limpieza color. Anotar."],
                  ["Doblada", "Darle más enfriado"],
                  ["Quemada", "Consultar temperaturas"],
                ]
              : [
                  ["Cruda", "Subir cocinado (max 2 min)"],
                  ["Quemada", "Bajar cocinado (max 2 min)"],
                  ["Doblada", "Revisar silicona / Temp"],
                  ["Incompleta", "Revisar respiradores/cierres"],
                ];

          const problemRowHeight = 12;
          const problemHeaderHeight = 7;
          const problemBoxHeight =
            problemHeaderHeight +
            Math.ceil(problemas.length / 2) * problemRowHeight +
            5;

          doc.setFillColor(...rojoAlerta);
          doc.rect(14, yPos, 182, 7, "F");
          doc.setDrawColor(...rojoAlerta);
          doc.setLineWidth(0.5);
          doc.rect(14, yPos, 182, problemBoxHeight);
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text("SOLUCIÓN DE PROBLEMAS FRECUENTES", 105, yPos + 4.5, {
            align: "center",
          });

          yPos += 14;
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(8);
          problemas.forEach(([problema, solucion], i) => {
            const xOffset = i % 2 === 0 ? 20 : 110;
            const yOffset = yPos + Math.floor(i / 2) * problemRowHeight;
            doc.setFont("helvetica", "bold");
            doc.text(`• ${problema}:`, xOffset, yOffset);
            doc.setFont("helvetica", "normal");
            doc.text(`${solucion}`, xOffset, yOffset + 4);
          });

          const footerY =
            yPos + Math.ceil(problemas.length / 2) * problemRowHeight + 10;
          doc.setFontSize(7);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(100);
          doc.text(
            "En todos los casos consultar previamente con un superior.",
            105,
            footerY,
            { align: "center" },
          );
        });

        doc.save(`BOOK_TECNICO_${currentPlanNombre.replace(/\s+/g, "_")}.pdf`);
        resolve();
      } catch (e) {
        console.error(e);
        reject(e);
      } finally {
        setGeneratingPDF(false);
      }
    });

    toast.promise(pdfPromise, {
      loading: "Generando Book Técnico (puede demorar)...",
      success: "Book Técnico descargado",
      error: "Error al generar el PDF. Revisa la consola.",
    });
  };

  return (
    <>
      <div className="flex flex-col h-full animate-in fade-in overflow-hidden bg-transparent">
        {/* BREADCRUMB */}
        <div className="flex items-center justify-between px-6 py-3 bg-transparent shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>App</span> <FaChevronLeft className="rotate-180 text-[7px]" />
            <button
              onClick={() => setSelectedPlanId(null)}
              className="hover:text-blue-600 transition-colors"
            >
              Planificación
            </button>
            {selectedPlanId && (
              <>
                <FaChevronLeft className="rotate-180 text-[7px]" />
                <span className="text-blue-600 font-bold truncate max-w-[150px] md:max-w-[300px]">
                  {currentPlanNombre}
                </span>
              </>
            )}
          </div>
        </div>

        {/* KARDEX DE PLANES */}
        {!selectedPlanId && (
          <div className="flex-1 flex flex-col overflow-y-auto bg-[#fafafa] custom-scrollbar animate-in fade-in shadow-inner border-t border-slate-100">
            {/* HEADER TRANSLÚCIDO */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-5 md:px-10 md:py-6 shrink-0 z-20 sticky top-0">
              <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shadow-sm shrink-0">
                    <FaClipboardList size={18} />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight leading-none">
                      Planes Maestros
                    </h1>
                    <p className="text-[11px] font-medium text-slate-400 mt-1.5 tracking-wide uppercase">
                      Gestión Central de Producción
                    </p>
                  </div>
                </div>

                {/* Botón solo visible para Admins */}
                {esAdmin && (
                  <button
                    onClick={handleCreateNew}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-6 py-2.5 rounded-full shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition-all active:scale-95"
                  >
                    <FaPlus size={12} /> Nuevo Plan
                  </button>
                )}
              </div>
            </header>

            {/* GRILLA DE PLANES */}
            <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 mt-2">
              {masterPlanList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/50 border border-dashed border-slate-200/60 rounded-[2rem]">
                  <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                    <FaFolderOpen size={24} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-600 mb-1">
                    No hay planes activos
                  </h3>
                  <p className="text-sm text-slate-400 text-center max-w-xs">
                    Creá un nuevo plan maestro para comenzar a registrar la
                    producción de la planta.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 pb-12">
                  {masterPlanList.map((plan) => {
                    const isAbierto = plan.estado === "ABIERTO";

                    return (
                      <div
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan.id)}
                        className="bg-white rounded-[1.5rem] p-6 border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)] transition-all duration-300 group cursor-pointer relative overflow-hidden flex flex-col h-full min-h-[160px]"
                      >
                        {/* Línea superior indicadora de estado */}
                        <div
                          className={`absolute top-0 left-0 w-full h-1.5 transition-colors ${isAbierto ? "bg-emerald-400" : "bg-slate-200"}`}
                        />

                        <div className="flex justify-between items-start mb-5">
                          <div
                            className={`p-2.5 rounded-xl transition-colors ${isAbierto ? "bg-emerald-50 text-emerald-500 group-hover:bg-emerald-100" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"}`}
                          >
                            <FaFolderOpen size={18} />
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                              isAbierto
                                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                : "bg-slate-50 text-slate-500 border-slate-200"
                            }`}
                          >
                            {!isAbierto && <FaLock size={8} />}
                            {plan.estado}
                          </span>
                        </div>

                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors leading-tight">
                            {plan.nombre}
                          </h3>
                          <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                            <FaCalendarAlt className="text-slate-300" />
                            {/* Fecha formateada elegantemente */}
                            {new Date(
                              plan.fecha_creacion ||
                                plan.created_at ||
                                new Date(),
                            ).toLocaleDateString("es-AR")}
                          </p>
                        </div>

                        {/* Botón inferior sutil */}
                        <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-slate-400 group-hover:text-blue-600 transition-colors">
                          <span className="text-[11px] font-semibold uppercase tracking-widest">
                            Abrir Plan
                          </span>
                          <FaArrowRight
                            size={12}
                            className="transform group-hover:translate-x-1 transition-transform"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </main>
          </div>
        )}

        {/* DETALLE DEL PLAN EXPANDIDO */}
        {selectedPlanId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 bg-white border border-slate-100 shadow-2xl flex flex-col overflow-hidden min-h-0"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <input
                type="text"
                value={currentPlanNombre}
                onChange={(e) => setCurrentPlanNombre(e.target.value)}
                className="text-xl font-bold text-slate-700 outline-none flex-1 placeholder:text-slate-300"
                disabled={isPlanCerrado}
                placeholder="Nombre del Plan..."
              />
              <div className="flex gap-2 items-center relative z-20">
                {/* BOTÓN GUARDAR (Solo visible para Admins) */}
                {esAdmin && (
                  <button
                    onClick={handleSavePlan}
                    disabled={isSaving || isPlanCerrado || !hasChangesToSave}
                    className={`px-5 py-2 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 ${
                      !hasChangesToSave
                        ? "bg-slate-300 shadow-none cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                    }`}
                  >
                    {isSaving ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaSave />
                    )}
                    Guardar
                  </button>
                )}

                {/* BOTÓN DE ACCIONES (Solo visible para Admins) */}
                {esAdmin && (
                  <div className="relative">
                    <button
                      onClick={() => setShowActionMenu(!showActionMenu)}
                      className="px-4 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                      Acciones{" "}
                      <FaChevronLeft
                        className={`rotate-[-90deg] text-[8px] transition-transform ${showActionMenu ? "rotate-[90deg]" : ""}`}
                      />
                    </button>
                    <AnimatePresence>
                      {showActionMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowActionMenu(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden py-2"
                          >
                            <div className="px-4 py-2 border-b border-slate-50 mb-1">
                              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                                Documentos
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                handleRequestPDF("ORIGINAL");
                                setShowActionMenu(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                            >
                              <FaPrint className="text-slate-400" /> Plan
                              Original (PDF)
                            </button>

                            <button
                              onClick={() => {
                                handleRequestPDF("CAMBIOS");
                                setShowActionMenu(false);
                              }}
                              disabled={!planChanges.hasChanges}
                              className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-3 ${planChanges.hasChanges ? "text-blue-600 hover:bg-blue-50" : "text-slate-300 bg-slate-50/50 cursor-not-allowed"}`}
                            >
                              <FaPrint
                                className={
                                  planChanges.hasChanges
                                    ? "text-blue-400"
                                    : "text-slate-200"
                                }
                              />{" "}
                              Imprimir Cambios (PDF)
                              {planChanges.hasChanges && (
                                <span className="ml-auto bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest">
                                  Nuevo
                                </span>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                generarFichasMasivas();
                                setShowActionMenu(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                            >
                              <FaBook className="text-slate-400" /> Book Técnico
                              (PDF)
                            </button>

                            <div className="px-4 py-2 border-b border-t border-slate-50 my-1">
                              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                                Gestión
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                handleToggleEstado();
                                setShowActionMenu(false);
                              }}
                              disabled={isPlanNuevo}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                            >
                              {isPlanCerrado ? (
                                <>
                                  <FaLockOpen className="text-emerald-500" />{" "}
                                  Reabrir Plan
                                </>
                              ) : (
                                <>
                                  <FaLock className="text-amber-500" /> Cerrar
                                  Plan
                                </>
                              )}
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* BOTÓN CERRAR PLAN (La crucecita sí queda para todos) */}
                <button
                  onClick={() => setSelectedPlanId(null)}
                  className="p-2 ml-1 bg-slate-50 text-slate-400 rounded-xl hover:text-rose-500 transition-all border border-transparent hover:border-rose-100"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* PESTAÑAS (GRILLA MOBILE, FILA EN DESKTOP) */}
            <div className="px-2 md:px-6 mb-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between shrink-0">
              <div className="grid grid-cols-4 w-full md:flex md:w-auto md:gap-8 border-b md:border-b-0 border-slate-100">
                {[
                  { id: "items", label: "Kanban", icon: <FaTasks size={14} /> },
                  {
                    id: "manual",
                    label: "Armado",
                    icon: <FaHammer size={14} />,
                  },
                  {
                    id: "produccion",
                    label: "Historial",
                    icon: <FaIndustry size={14} />,
                  },
                  {
                    id: "mrp",
                    label: "Insumos",
                    icon: <FaFileInvoice size={14} />,
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`py-3 md:py-4 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 border-b-2 transition-all shrink-0 ${activeTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-500"}`}
                  >
                    {t.icon}{" "}
                    <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-center leading-tight">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="w-72 hidden md:block py-2">
                {activeTab === "items" && (
                  <AutoCompleteInput
                    items={allSemis}
                    onSelect={handleAddItem}
                    placeholder="Buscar y añadir producto..."
                    disabled={isPlanCerrado || !esAdmin}
                  />
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white min-h-0">
              {/* TAB 1: KANBAN */}
              {activeTab === "items" && (
                <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-500">
                  <div className="md:hidden w-full mb-4 shrink-0">
                    <AutoCompleteInput
                      items={allSemis}
                      onSelect={handleAddItem}
                      placeholder="Buscar y añadir..."
                      disabled={isPlanCerrado || !esAdmin}
                    />
                  </div>
                  <div className="md:hidden flex bg-slate-50 p-1.5 rounded-2xl mb-4 shrink-0">
                    {[
                      {
                        id: "PENDIENTE",
                        label: "Pendiente",
                        color: "text-slate-500",
                      },
                      {
                        id: "PROCESO",
                        label: "Produciendo",
                        color: "text-blue-600",
                      },
                      {
                        id: "FINALIZADO",
                        label: "Listo",
                        color: "text-emerald-600",
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setMobileKanbanTab(tab.id)}
                        className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest rounded-xl transition-all ${mobileKanbanTab === tab.id ? `bg-white shadow-sm ${tab.color}` : "text-slate-400"}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 flex flex-col md:grid md:grid-cols-3 gap-6 min-h-0">
                    <div
                      className={`flex-1 min-h-0 ${mobileKanbanTab === "PENDIENTE" ? "flex" : "hidden"} md:flex flex-col`}
                    >
                      {renderKanbanColumn(
                        "Pendiente",
                        "PENDIENTE",
                        "bg-slate-300",
                      )}
                    </div>
                    <div
                      className={`flex-1 min-h-0 ${mobileKanbanTab === "PROCESO" ? "flex" : "hidden"} md:flex flex-col`}
                    >
                      {renderKanbanColumn(
                        "Produciendo",
                        "PROCESO",
                        "bg-blue-500 animate-pulse",
                      )}
                    </div>
                    <div
                      className={`flex-1 min-h-0 ${mobileKanbanTab === "FINALIZADO" ? "flex" : "hidden"} md:flex flex-col`}
                    >
                      {renderKanbanColumn(
                        "Completado",
                        "FINALIZADO",
                        "bg-emerald-500",
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MANUAL */}
              {activeTab === "manual" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto animate-in slide-in-from-bottom-4">
                  {manualTasks.map((task) => {
                    const p =
                      task.meta > 0 ? (task.realizado / task.meta) * 100 : 0;
                    const done = task.realizado >= task.meta;
                    return (
                      <div
                        key={task.id}
                        className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/40 flex flex-col group transition-transform hover:-translate-y-1"
                      >
                        <div className="h-36 bg-slate-200 relative overflow-hidden">
                          {task.fotos[0] ? (
                            <img
                              src={task.fotos[0]}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              alt="Ref"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <FaImages size={32} />
                            </div>
                          )}
                          <div
                            className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-lg ${done ? "bg-emerald-500 text-white" : "bg-white text-orange-600"}`}
                          >
                            {done ? "Listo" : "Manual"}
                          </div>
                        </div>
                        <div className="p-6 flex-1 flex flex-col">
                          <h4 className="text-base font-bold text-slate-700 mb-2 leading-tight">
                            {task.titulo}
                          </h4>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mb-5 leading-relaxed italic">
                            {task.instrucciones}
                          </p>
                          <div className="mt-auto">
                            <div className="flex justify-between items-end mb-3">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mb-1">
                                  Realizado
                                </span>
                                <span className="text-xl font-bold text-slate-700 leading-none">
                                  {task.realizado}{" "}
                                  <span className="text-[10px] text-slate-400">
                                    / {task.meta}
                                  </span>
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    generarOrdenTerminacionPDF(task)
                                  }
                                  className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-700 hover:text-white transition-all"
                                >
                                  <FaPrint size={12} />
                                </button>
                                <button className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all">
                                  Cargar
                                </button>
                              </div>
                            </div>
                            <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-1000 ${done ? "bg-emerald-500" : "bg-orange-500"}`}
                                style={{ width: `${Math.min(100, p)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-8 hover:bg-slate-50 transition-all text-slate-400 group min-h-[200px]"
                  >
                    <FaHammer
                      size={32}
                      className="mb-4 group-hover:text-orange-500 transition-colors"
                    />
                    <span className="font-bold text-[10px] uppercase tracking-widest text-center">
                      Nueva Tarea
                    </span>
                  </button>
                </div>
              )}

              {/* TAB 3: HISTORIAL */}
              {activeTab === "produccion" && (
                <div className="w-full border border-slate-100 overflow-hidden shadow-xl bg-white animate-in slide-in-from-bottom-4">
                  <table className="w-full text-left table-fixed">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] md:text-[12px] font-bold tracking-widest">
                      <tr>
                        <th className="px-2 py-3 md:px-6 md:py-5 w-[15%] md:w-auto">
                          Fecha
                        </th>
                        <th className="px-2 py-3 md:px-6 md:py-5 w-[30%] md:w-auto">
                          Operario
                        </th>
                        <th className="px-2 py-3 md:px-6 md:py-5 w-[45%] md:w-auto">
                          Producto
                        </th>
                        <th className="px-2 py-3 md:px-6 md:py-5 w-[10%] md:w-auto text-right">
                          OK
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {historialProduccion.map((reg) => (
                        <tr
                          key={reg.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          {/* Fecha */}
                          <td className="px-2 py-3 md:px-6 md:py-4 text-[8px] md:text-xs font-bold text-slate-400 truncate">
                            {new Date(
                              reg.fecha_produccion,
                            ).toLocaleDateString()}
                          </td>

                          {/* Operario */}
                          <td className="px-2 py-3 md:px-6 md:py-4 flex items-center gap-1.5 md:gap-3">
                            <div className="w-5 h-5 md:w-7 md:h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[7px] md:text-[9px] font-bold shrink-0">
                              {reg.operario.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-[9px] md:text-xs font-bold text-slate-700 truncate">
                              {reg.operario}
                            </span>
                          </td>

                          {/* Producto */}
                          <td className="px-2 py-3 md:px-6 md:py-4 text-[9px] md:text-xs font-bold text-slate-600 leading-tight">
                            <div className="line-clamp-2 md:line-clamp-none">
                              {reg.semielaborado}
                            </div>
                          </td>

                          {/* Cantidad (OK) */}
                          <td className="px-2 py-3 md:px-6 md:py-4 text-right font-black text-emerald-500 text-xs md:text-xs">
                            {reg.cantidad}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: MRP */}
              {activeTab === "mrp" && (
                <div className="w-full border border-slate-100 overflow-hidden shadow-xl bg-white animate-in slide-in-from-bottom-4">
                  <div className="p-6 border-b border-slate-50 bg-slate-50/20 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-700">
                      Explosión
                    </h3>
                    <span className="text-[9px] font-bold text-slate-400 uppercase bg-white px-3 py-1.5 rounded-xl border shadow-sm">
                      Stock Real
                    </span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b bg-slate-50/50">
                        <th className="px-6 py-4 text-[9px] font-bold uppercase text-slate-400">
                          Insumo
                        </th>
                        <th className="px-6 py-4 text-right text-[9px] font-bold uppercase text-slate-400">
                          Req.
                        </th>
                        <th className="px-6 py-4 text-right text-[9px] font-bold uppercase text-slate-400">
                          Saldo
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {explosion.map((mp) => (
                        <tr key={mp.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-700">
                              {mp.nombre}
                            </p>
                            <p className="text-[8px] font-bold text-slate-300 font-mono mt-0.5">
                              {mp.codigo}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-bold text-slate-600">
                            {mp.necesario}
                          </td>
                          <td
                            className={`px-6 py-4 text-right text-sm font-bold ${mp.balance < 0 ? "text-rose-500" : "text-emerald-500"}`}
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
          </motion.div>
        )}
      </div>

      {/* FICHA LATERAL */}
      <AnimatePresence>
        {itemEnFicha && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9990]"
              onClick={() => setItemEnFicha(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30 }}
              className="fixed top-0 right-0 bottom-0 w-full md:w-[450px] bg-slate-50 shadow-2xl border-l border-slate-200 z-[9999] flex flex-col"
            >
              <div className="bg-white px-8 py-6 border-b border-slate-200 shrink-0 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                    <FaBox size={20} />
                  </div>
                  <div>
                    <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Ficha Técnica
                    </h2>
                    <h1 className="text-lg font-bold text-slate-700 truncate max-w-[250px] leading-none">
                      {itemEnFicha.semielaborado.nombre}
                    </h1>
                  </div>
                </div>
                <button
                  onClick={() => setItemEnFicha(null)}
                  className="text-slate-400 hover:text-rose-500 bg-slate-50 p-3 rounded-full transition-colors"
                >
                  <FaTimes size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar flex flex-col">
                <div className="bg-white rounded-[2rem] border border-slate-100 p-5 shadow-sm shrink-0">
                  <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <FaCogs className="text-blue-500" /> Datos Técnicos
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[8px] font-bold text-slate-400 uppercase mb-1 tracking-widest">
                        Código
                      </p>
                      <p className="text-xs font-bold text-slate-700">
                        {itemEnFicha.semielaborado.codigo}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[8px] font-bold text-slate-400 uppercase mb-1 tracking-widest">
                        Carga Real
                      </p>
                      <p className="text-xs font-bold text-emerald-600">
                        {itemEnFicha.producido} / {itemEnFicha.cantidad}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col flex-1 min-h-[300px]">
                  <div className="p-5 border-b border-slate-50 shrink-0">
                    <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      <FaStickyNote className="text-amber-500" /> Hilo de Notas
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50/30">
                    {comentarios.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <FaStickyNote size={24} className="mb-2 opacity-50" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">
                          No hay notas aún
                        </p>
                      </div>
                    ) : (
                      comentarios.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-2 group relative"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">
                                {c.usuario}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 ml-2">
                                {new Date(c.fecha).toLocaleString("es-AR", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingComentarioId(c.id);
                                  setEditComentarioText(c.texto);
                                }}
                                className="text-slate-300 hover:text-blue-500 transition-colors"
                                title="Editar"
                              >
                                <FaEdit size={10} />
                              </button>
                              <button
                                onClick={() => handleDeleteComentario(c.id)}
                                className="text-slate-300 hover:text-rose-500 transition-colors"
                                title="Eliminar"
                              >
                                <FaTrash size={10} />
                              </button>
                            </div>
                          </div>
                          {editingComentarioId === c.id ? (
                            <div className="mt-2 animate-in fade-in">
                              <textarea
                                value={editComentarioText}
                                onChange={(e) =>
                                  setEditComentarioText(e.target.value)
                                }
                                className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-blue-100 rounded-xl p-3 outline-none resize-none focus:border-blue-500 transition-colors"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  onClick={() => setEditingComentarioId(null)}
                                  className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => handleUpdateComentario(c.id)}
                                  className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-colors"
                                >
                                  Guardar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                              {c.texto}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 border-t border-slate-100 bg-white shrink-0 relative rounded-b-[2rem]">
                    <textarea
                      value={nuevoComentario}
                      onChange={(e) => setNuevoComentario(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          guardarComentario();
                        }
                      }}
                      placeholder="Escribe una nota (Enter para enviar)..."
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-transparent rounded-xl pl-4 pr-12 py-4 outline-none resize-none focus:border-blue-500 focus:bg-white transition-all h-[52px]"
                    />
                    <button
                      onClick={guardarComentario}
                      disabled={!nuevoComentario.trim() || guardandoNotas}
                      className="absolute right-5 top-5 p-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center"
                    >
                      {guardandoNotas ? (
                        <FaSpinner className="animate-spin" size={10} />
                      ) : (
                        <FaPaperPlane size={10} className="ml-[-1px]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPendingDrawer && (
          <>
            <div
              className="fixed inset-0 bg-slate-900/60 z-[60] backdrop-blur-sm"
              onClick={() => setShowPendingDrawer(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30 }}
              className="fixed inset-y-0 right-0 z-[70] w-full md:w-[500px] bg-white shadow-2xl flex flex-col border-l border-slate-100 rounded-l-[3.5rem]"
            >
              <div className="p-10 border-b flex justify-between items-center bg-slate-50/50">
                <h3 className="text-2xl font-bold text-slate-700 tracking-tight flex items-center gap-3">
                  <FaExclamationTriangle className="text-rose-500" /> Sin Stock
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleForceSync}
                    className="p-4 bg-white text-blue-600 rounded-[1.5rem] border shadow-sm hover:bg-blue-50 transition-all"
                  >
                    <FaSync
                      className={loadingPending ? "animate-spin" : ""}
                      size={18}
                    />
                  </button>
                  <button
                    onClick={() => setShowPendingDrawer(false)}
                    className="p-4 bg-white text-slate-400 rounded-[1.5rem] border shadow-sm hover:text-rose-500 transition-all"
                  >
                    <FaTimes size={18} />
                  </button>
                </div>
              </div>
              <div className="p-10 space-y-5 overflow-y-auto custom-scrollbar">
                {pendingOrders.map((p, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={i}
                    className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-xl flex justify-between items-center group hover:border-rose-200 transition-all"
                  >
                    <div className="min-w-0 pr-4">
                      <h4 className="text-base font-bold text-slate-700 truncate leading-none mb-2">
                        {p.modelo}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {p.cliente}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[9px] font-bold text-slate-300 uppercase mb-1 tracking-widest">
                        Falta
                      </p>
                      <p className="text-2xl font-bold text-rose-500 leading-none">
                        {p.cantidad}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStatsModal && (
          <PlanStats
            items={currentPlanItems}
            operarios={currentPlanOperarios}
            onClose={() => setShowStatsModal(false)}
          />
        )}
      </AnimatePresence>

      {/* MODAL DE FIRMA */}
      <AnimatePresence>
        {showSignatureModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full"
            >
              <h3 className="text-xl font-bold text-slate-700 mb-2">
                Firma de Autorización
              </h3>
              <p className="text-xs font-bold text-slate-400 mb-6">
                Por favor, dibuje su firma para adjuntar al documento oficial.
              </p>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl mb-4 bg-slate-50 overflow-hidden">
                <SignatureCanvas
                  ref={sigCanvas}
                  penColor="#1e293b"
                  canvasProps={{ className: "w-full h-40 cursor-crosshair" }}
                />
              </div>

              <div className="flex justify-end mb-6">
                <button
                  onClick={() => sigCanvas.current.clear()}
                  className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors"
                >
                  Limpiar Firma
                </button>
              </div>

              <div className="mb-8">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
                  Aclaración / Nombre
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 focus:border-blue-500 outline-none"
                  placeholder="Nombre del responsable..."
                />
              </div>

              <div className="flex justify-between gap-4">
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="px-6 py-3 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmSignature}
                  className="flex-1 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors py-3"
                >
                  Aplicar y Descargar PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
