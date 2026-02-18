import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils.js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

import { hasRole } from "../auth/authHelper";

// Componentes
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";
import PlanCard from "../components/planificacion/PlanCard";
import PlanStats from "../components/planificacion/PlanStats";
import TabButton from "../components/planificacion/TabButton";
import PlanGanttModal from "../components/planificacion/PlanGanttModal";
import ProductionMatrixModal from "../components/planificacion/ProductionMatrixModal";

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
  FaEdit,
  FaCheckCircle,
  FaBoxOpen,
  FaExclamationTriangle,
  FaUser,
  FaTimes,
  FaClock,
  FaSync,
  FaFilePdf,
  FaBook,
  FaHammer,
  FaCamera,
  FaImages,
  FaCheckDouble,
  FaChevronLeft, // Importante para el select
} from "react-icons/fa";

// --- NUEVO MODAL: SELECCIÓN ESTRUCTURADA DE TAREA ---
function VisualTaskModal({ allSemis, onClose, onSave }) {
  const [selectedSemiId, setSelectedSemiId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [cantidad, setCantidad] = useState("");

  // Buscamos el objeto completo para acceder a sus variantes
  const selectedSemi = allSemis.find(
    (s) => String(s.id) === String(selectedSemiId),
  );

  // Las variantes vendrían del backend en el objeto semielaborado. Si no hay, array vacío.
  // IMPORTANTE: Asegúrate que el endpoint /semielaborados traiga la columna 'variantes'
  const variantesDisponibles = selectedSemi?.variantes || [];

  const selectedVariant = variantesDisponibles.find(
    (v) => String(v.id) === String(selectedVariantId),
  );

  const handleSubmit = () => {
    if (!selectedSemi || !selectedVariant || !cantidad)
      return alert("Por favor complete todos los campos.");

    // Construimos la tarea "congelando" la info actual de la variante para que quede registrada
    const nuevaTarea = {
      titulo: `${selectedSemi.nombre} - ${selectedVariant.nombre}`,
      producto_origen: selectedSemi.nombre,
      codigo_origen: selectedSemi.codigo,
      variante: selectedVariant.nombre,
      instrucciones: selectedVariant.especificaciones,
      fotos: selectedVariant.fotos, // Array de URLs
      meta: Number(cantidad),
    };

    onSave(nuevaTarea);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-slate-800 w-full max-w-xl rounded-xl border border-slate-600 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700 bg-slate-900 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FaHammer className="text-orange-500" /> Asignar Terminación
          </h3>
          <button onClick={onClose}>
            <FaTimes className="text-gray-400 hover:text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. PRODUCTO BASE */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">
              1. Producto Semielaborado
            </label>
            <div className="relative">
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded p-3 text-white appearance-none focus:border-orange-500 outline-none cursor-pointer"
                value={selectedSemiId}
                onChange={(e) => {
                  setSelectedSemiId(e.target.value);
                  setSelectedVariantId("");
                }}
              >
                <option value="">Seleccione un producto...</option>
                {allSemis.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.codigo} - {s.nombre}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                <FaChevronLeft className="-rotate-90 text-xs" />
              </div>
            </div>
          </div>

          {/* 2. VARIANTE (O AVISO DE ERROR) */}
          <AnimatePresence mode="wait">
            {selectedSemiId && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">
                  2. Variante de Armado
                </label>

                {variantesDisponibles.length > 0 ? (
                  <div className="relative">
                    <select
                      className="w-full bg-slate-700 border border-slate-600 rounded p-3 text-white appearance-none focus:border-orange-500 outline-none cursor-pointer"
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
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                      <FaChevronLeft className="-rotate-90 text-xs" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg flex items-start gap-3">
                    <FaExclamationTriangle className="text-red-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-red-200 text-sm font-bold">
                        Sin variantes definidas.
                      </p>
                      <p className="text-red-300/70 text-xs mt-1">
                        Este producto no tiene configuraciones de armado en
                        Ingeniería. Debes crearlas allí primero.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3. PREVIEW DE DATOS (READ ONLY) */}
          {selectedVariant && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex gap-4"
            >
              <div className="w-24 h-24 bg-black rounded-lg border border-slate-600 overflow-hidden flex-shrink-0 relative">
                {selectedVariant.fotos && selectedVariant.fotos[0] ? (
                  <img
                    src={selectedVariant.fotos[0]}
                    className="w-full h-full object-cover"
                    alt="ref"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 text-xs text-center p-2">
                    <FaImages size={20} />
                    <span className="mt-1">Sin Foto</span>
                  </div>
                )}
                {/* Indicador si hay más fotos */}
                {(selectedVariant.fotos || []).length > 1 && (
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                    +{selectedVariant.fotos.length - 1}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                  <FaCheckDouble className="text-green-500" /> Especificación
                  Estándar
                </h5>
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 overflow-hidden text-ellipsis">
                  {selectedVariant.especificaciones ||
                    "Sin especificaciones detalladas."}
                </p>
              </div>
            </motion.div>
          )}

          {/* 4. CANTIDAD */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">
              3. Cantidad a Realizar
            </label>
            <input
              type="number"
              className="w-full bg-slate-700 border border-slate-600 rounded p-3 text-white font-mono text-xl focus:border-orange-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Ej: 300"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              disabled={!selectedVariant}
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white font-bold text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedVariant || !cantidad}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95"
          >
            <FaSave /> Confirmar Tarea
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- FUNCIÓN EXPORTAR PDF ORDEN DE TERMINACIÓN (INDIVIDUAL) ---
const generarOrdenTerminacionPDF = (task) => {
  const doc = new jsPDF();
  const azulOscuro = [30, 41, 59];

  // Encabezado
  doc.setFillColor(...azulOscuro);
  doc.rect(0, 0, 210, 25, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ORDEN DE TERMINACIÓN / ARMADO", 14, 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `PLANTA DE TERMINACIÓN - ${new Date().toLocaleDateString("es-AR")}`,
    14,
    19,
  );

  // Datos Tarea
  doc.setTextColor(0);
  let yPos = 40;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(task.titulo, 14, yPos); // Título grande

  yPos += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `PRODUCTO BASE: ${task.producto_origen} (${task.codigo_origen})`,
    14,
    yPos,
  );
  yPos += 6;
  doc.text(`VARIANTE APLICADA: ${task.variante}`, 14, yPos);
  yPos += 6;
  doc.text(`CANTIDAD OBJETIVO: ${task.meta} unidades`, 14, yPos);

  yPos += 15;

  // Instrucciones
  doc.setFillColor(240, 240, 240);
  doc.setDrawColor(200);
  doc.rect(14, yPos, 182, 40, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50);
  doc.text("INSTRUCCIONES TÉCNICAS ESTÁNDAR:", 18, yPos + 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  const splitText = doc.splitTextToSize(
    task.instrucciones || "Sin instrucciones específicas.",
    174,
  );
  doc.text(splitText, 18, yPos + 15);

  yPos += 50;

  // Fotos
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("REFERENCIAS VISUALES (ESTÁNDAR):", 14, yPos);
  yPos += 5;

  const fotos = task.fotos || [];
  fotos.forEach((fotoUrl, i) => {
    if (fotoUrl) {
      const x = 14 + i * 65;
      try {
        // Intentamos dibujar la imagen. Si es URL externa puede fallar por CORS en navegador
        // En producción real, estas imágenes deberían ser base64 o venir del mismo dominio
        doc.addImage(fotoUrl, "JPEG", x, yPos, 60, 60);
        doc.setDrawColor(0);
        doc.rect(x, yPos, 60, 60); // Borde
      } catch (e) {
        // Fallback si falla la imagen
        doc.setFillColor(200);
        doc.rect(x, yPos, 60, 60, "F");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("IMAGEN DE REFERENCIA", x + 30, yPos + 30, {
          align: "center",
        });
      }
    }
  });

  // Pie de Control
  const pieY = 240;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(14, pieY, 182, 35);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("CONTROL DE CALIDAD FINAL Y CIERRE:", 18, pieY + 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("CANTIDAD TERMINADA OK: ______________", 18, pieY + 20);
  doc.text("SCRAP / RECHAZO: ______________", 110, pieY + 20);

  doc.text(
    "FIRMA RESPONSABLE: ____________________________________",
    18,
    pieY + 30,
  );

  doc.save(`OT_Manual_${task.titulo.replace(/\s+/g, "_")}.pdf`);
};

// --- COMPONENTE PRINCIPAL ---
export default function PlanificacionPage({ onNavigate }) {
  const [allSemis, setAllSemis] = useState([]);
  const [allMPs, setAllMPs] = useState([]);
  const [recetasMap, setRecetasMap] = useState({});
  const [masterPlanList, setMasterPlanList] = useState([]);

  // --- ESTADOS PARA PEDIDOS PENDIENTES ---
  const [showPendingDrawer, setShowPendingDrawer] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [currentPlanNombre, setCurrentPlanNombre] = useState("Nuevo Plan");
  const [currentPlanItems, setCurrentPlanItems] = useState([]);
  const [currentPlanEstado, setCurrentPlanEstado] = useState("ABIERTO");
  const [currentPlanOperarios, setCurrentPlanOperarios] = useState([]);
  const [historialProduccion, setHistorialProduccion] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [activeTab, setActiveTab] = useState("items");
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showGanttModal, setShowGanttModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);

  // Estados para Tareas Manuales (Terminación)
  const [manualTasks, setManualTasks] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // ... (Efectos de carga) ...
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

  const loadPendingOrders = async () => {
    setLoadingPending(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/planificacion/sin-stock`);
      if (res.ok) {
        const data = await res.json();
        setPendingOrders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (showPendingDrawer) loadPendingOrders();
  }, [showPendingDrawer]);

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

  // --- 1. GENERADOR PDF ORDEN DE PRODUCCIÓN CON QR ---
  const generarPDFOrden = async () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString("es-AR");
    const hora = new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const azulOscuro = [30, 41, 59];
    const grisClaro = [241, 245, 249];
    const bordeGris = [203, 213, 225];

    // URL dinámica para el QR
    const urlPlan = `${window.location.origin}/planificacion/${selectedPlanId}`;
    let qrDataUrl = null;
    try {
      qrDataUrl = await QRCode.toDataURL(urlPlan, {
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
    } catch (err) {
      console.error("Error QR", err);
    }

    // Header
    doc.setFillColor(...azulOscuro);
    doc.rect(0, 0, 210, 30, "F");

    // Dibujar QR
    if (qrDataUrl) {
      doc.setFillColor(255, 255, 255);
      doc.rect(176, 2, 26, 26, "F");
      doc.addImage(qrDataUrl, "PNG", 177, 3, 24, 24);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ORDEN DE PRODUCCIÓN", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("PLANIFICACIÓN Y CONTROL", 14, 24);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`#${currentPlanNombre.toUpperCase()}`, 170, 18, {
      align: "right",
    });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Emisión: ${fecha} - ${hora} hs`, 170, 24, { align: "right" });

    let yPos = 40;
    const totalItems = currentPlanItems.length;
    const totalUnidades = currentPlanItems.reduce(
      (acc, i) => acc + Number(i.cantidad),
      0,
    );
    const totalAvance = currentPlanItems.reduce(
      (acc, i) => acc + Number(i.producido),
      0,
    );
    const pctAvance =
      totalUnidades > 0 ? Math.round((totalAvance / totalUnidades) * 100) : 0;

    doc.setDrawColor(...bordeGris);
    doc.setFillColor(...grisClaro);
    doc.roundedRect(14, yPos, 182, 18, 2, 2, "FD");
    doc.setTextColor(50);
    doc.setFontSize(9);
    const colW = 182 / 4;
    doc.setFont("helvetica", "normal");
    doc.text("TOTAL ÍTEMS", 14 + colW * 0.5, yPos + 6, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(String(totalItems), 14 + colW * 0.5, yPos + 12, {
      align: "center",
    });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("OBJETIVO (Unid)", 14 + colW * 1.5, yPos + 6, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(String(totalUnidades), 14 + colW * 1.5, yPos + 12, {
      align: "center",
    });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("ESTADO", 14 + colW * 2.5, yPos + 6, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(currentPlanEstado, 14 + colW * 2.5, yPos + 12, {
      align: "center",
    });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("AVANCE ACTUAL", 14 + colW * 3.5, yPos + 6, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${pctAvance}%`, 14 + colW * 3.5, yPos + 12, { align: "center" });
    yPos += 28;

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text("1. DETALLE DE PRODUCCIÓN", 14, yPos);
    yPos += 2;
    const tableData = currentPlanItems.map((i) => [
      i.semielaborado.codigo,
      i.semielaborado.nombre,
      i.cantidad,
      "",
      "",
      `${i.producido} (${((i.producido / i.cantidad) * 100).toFixed(0)}%)`,
    ]);
    autoTable(doc, {
      startY: yPos + 2,
      head: [
        [
          "CÓDIGO",
          "PRODUCTO",
          "META",
          "REAL (Manual)",
          "OBSERVACIONES / LOTE",
          "SISTEMA",
        ],
      ],
      body: tableData,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: "middle",
        lineColor: [200, 200, 200],
      },
      headStyles: {
        fillColor: azulOscuro,
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { width: 25, fontStyle: "bold" },
        1: { width: 55 },
        2: { width: 15, halign: "center", fontStyle: "bold" },
        3: { width: 25 },
        4: { width: 35 },
        5: { width: 25, halign: "right", fontSize: 8, textColor: 100 },
      },
    });
    yPos = doc.lastAutoTable.finalY + 15;

    if (yPos + 40 > 280) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text("2. MATERIALES REQUERIDOS (PREPARACIÓN)", 14, yPos);
    const mrpData = explosion.map((m) => [m.nombre, m.necesario, m.stock, ""]);
    autoTable(doc, {
      startY: yPos + 4,
      head: [["INSUMO / MATERIA PRIMA", "CANT. TOTAL", "STOCK DISP.", "CHECK"]],
      body: mrpData,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 },
      columnStyles: {
        0: { width: 90 },
        1: { width: 30, halign: "right", fontStyle: "bold" },
        2: { width: 30, halign: "right" },
        3: { width: 20 },
      },
    });
    yPos = doc.lastAutoTable.finalY + 20;

    if (yPos + 30 > 280) {
      doc.addPage();
      yPos = 40;
    }

    // Pie de página con control de desvío
    doc.setDrawColor(150);
    doc.setLineWidth(0.5);

    // Caja de Control de Desvíos
    doc.setFillColor(245, 245, 245);
    doc.rect(14, yPos - 10, 182, 15, "FD");
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text("CIERRE DE ORDEN - CONTROL DE DESVÍOS:", 16, yPos - 5);
    doc.text("¿Exceso > 10%?  [  ] SI   [  ] NO", 16, yPos + 1);
    doc.text(
      "Justificación: ___________________________________________________",
      80,
      yPos + 1,
    );

    // Firmas
    yPos += 15;
    doc.line(30, yPos, 80, yPos);
    doc.setFont("helvetica", "normal");
    doc.text("RESPONSABLE PRODUCCIÓN", 55, yPos + 5, { align: "center" });
    doc.line(130, yPos, 180, yPos);
    doc.text("GERENCIA / CALIDAD", 155, yPos + 5, { align: "center" });

    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      "Este documento es una orden oficial de trabajo. Cualquier desviación debe ser reportada inmediatamente.",
      105,
      285,
      { align: "center" },
    );
    doc.save(`Orden_Produccion_${currentPlanNombre.replace(/\s+/g, "_")}.pdf`);
  };

  // --- 2. GENERADOR PLANILLA DE CONTROL (AUDITORÍA) ---
  const generarPlanillaControl = async () => {
    if (currentPlanItems.length === 0) return alert("El plan está vacío.");
    setGeneratingPDF(true);

    try {
      const promises = currentPlanItems.map((item) =>
        authFetch(`${API_BASE_URL}/ingenieria/ficha/${item.semielaborado.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      );

      const resultados = await Promise.all(promises);
      const doc = new jsPDF("l", "mm", "a4"); // Horizontal
      const fecha = new Date().toLocaleDateString("es-AR");
      const colAzulHeader = [30, 41, 59];

      // Encabezado
      doc.setFillColor(...colAzulHeader);
      doc.rect(0, 0, 297, 25, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("PLANILLA DE VERIFICACIÓN DE PROCESO", 14, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("CONTROL DE PARÁMETROS CRÍTICOS Y CALIDAD EN LÍNEA", 14, 19);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`PLAN: #${currentPlanNombre}`, 283, 12, { align: "right" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha de Control: ${fecha}`, 283, 19, { align: "right" });

      let tableRows = [];
      resultados.forEach((data, index) => {
        if (!data) return;
        const itemPlan = currentPlanItems[index];
        const { producto } = data;
        const { tipo_proceso, parametros_maquina: pm = {} } = producto;

        let parametrosTeoricos = "";
        if (tipo_proceso === "INYECCION") {
          const temps = pm.temperaturas_zonas
            ? pm.temperaturas_zonas.split("/")[0]
            : "?";
          parametrosTeoricos = `Proc: INYECCIÓN\nTemp Z1: ${temps}°C\nPresión #1: ${pm.pres1 || "-"} bar`;
        } else {
          const tCocinado =
            (Number(pm.t1) || 0) +
            (Number(pm.t2) || 0) +
            (Number(pm.t3) || 0) +
            (Number(pm.t4) || 0);
          parametrosTeoricos = `Proc: ROTOMOLDEO\nTemp Horno: ${pm.temp_horno || "-"}°C\nT. Cocinado: ${tCocinado} min`;
        }

        tableRows.push([
          itemPlan.semielaborado.codigo,
          itemPlan.semielaborado.nombre,
          parametrosTeoricos,
          "",
          "",
          "",
          "",
          "",
        ]);
      });

      autoTable(doc, {
        startY: 35,
        head: [
          [
            "CÓDIGO",
            "PRODUCTO",
            "PARÁMETROS ESTÁNDAR (TEÓRICO)",
            "HORA",
            "LECTURA REAL (MÁQUINA)",
            "CANT. LOTE",
            "DESVÍO?",
            "FIRMA SUP.",
          ],
        ],
        body: tableRows,
        theme: "grid",
        styles: {
          fontSize: 9,
          valign: "middle",
          cellPadding: 3,
          lineColor: [150, 150, 150],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [50, 50, 50],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { width: 25, fontStyle: "bold" },
          1: { width: 50 },
          2: {
            width: 50,
            fontSize: 8,
            fontStyle: "italic",
            textColor: [80, 80, 80],
            fillColor: [245, 245, 245],
          },
          3: { width: 20 },
          4: { width: 40 },
          5: { width: 20 },
          6: { width: 20 },
          7: { width: 30 },
        },
        bodyStyles: { minCellHeight: 15 },
      });

      const finalY = doc.lastAutoTable.finalY + 15;
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.rect(14, finalY, 180, 20);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text("OBSERVACIONES DEL AUDITOR / SUPERVISOR:", 16, finalY + 5);
      doc.line(210, finalY + 15, 280, finalY + 15);
      doc.text("FIRMA RESPONSABLE CALIDAD", 245, finalY + 20, {
        align: "center",
      });
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(
        "Documento generado para Auditoría Interna - Control de correspondencia Proceso/Estándar.",
        148,
        195,
        { align: "center" },
      );

      doc.save(
        `Planilla_Control_${currentPlanNombre.replace(/\s+/g, "_")}.pdf`,
      );
    } catch (e) {
      console.error(e);
      alert("Error generando planilla.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  // --- 3. GENERADOR PDF MASIVO (BOOK TÉCNICO CORREGIDO) ---
  const generarFichasMasivas = async () => {
    if (currentPlanItems.length === 0) return alert("El plan está vacío.");
    if (
      !confirm(`¿Generar book técnico con ${currentPlanItems.length} fichas?`)
    )
      return;
    setGeneratingPDF(true);

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

          // TABLA LIMPIA CARGA SUCCION
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
          // CORREGIDO VARIABLES ROTOMOLDEO
          const rotoData = [
            ["1", pm.t1 || "-", pm.v1m1 || "-", pm.v2m1 || "-", pm.inv1 || "-"],
            ["2", pm.t2 || "-", pm.v1m2 || "-", pm.v2m2 || "-", pm.inv2 || "-"],
            ["3", pm.t3 || "-", pm.v1m3 || "-", pm.v2m3 || "-", pm.inv3 || "-"], // <-- Corregido
            ["4", pm.t4 || "-", pm.v1m4 || "-", pm.v2m4 || "-", pm.inv4 || "-"], // <-- Corregido
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
              ["ENFRIAMIENTO", "TEMP. HORNO", "T. COCINADO", "T. CICLO TOTAL"],
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
        ]); // 2 Decimales
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

        // 5. PROCEDIMIENTO
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

        // 6. PROBLEMAS
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

        // Disclaimer
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
      }); // FIN FOR EACH

      doc.save(`BOOK_TECNICO_${currentPlanNombre.replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Hubo un error generando las fichas. Revisa la consola.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  // --- HANDLERS TAREAS MANUALES ---
  const handleSaveTask = (newTask) => {
    // Idealmente aquí se haría el POST al backend para guardar la tarea
    // Para esta versión, guardamos en estado local del plan
    const taskWithId = { ...newTask, id: Date.now(), realizado: 0 };
    setManualTasks([...manualTasks, taskWithId]);
    setShowTaskModal(false);
  };

  const handleReportTask = (taskId) => {
    const task = manualTasks.find((t) => t.id === taskId);
    if (!task) return;
    const realizadoStr = prompt(
      `Cantidad realizada para "${task.titulo}":`,
      task.realizado,
    );
    if (realizadoStr === null) return;
    const realizado = Number(realizadoStr);

    // Aquí se haría el PUT al backend
    setManualTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, realizado } : t)),
    );
  };

  // ... (Resto de handlers de items, guardar, etc. se mantienen) ...
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
    if (!hasRole("GERENCIA")) return alert("⛔ ACCESO DENEGADO");
    setSelectedPlanId("NEW");
    setCurrentPlanNombre(
      `Nuevo Plan ${new Date().toLocaleDateString("es-AR")}`,
    );
    setCurrentPlanItems([]);
    setCurrentPlanEstado("ABIERTO");
    setCurrentPlanOperarios([]);
    setHistorialProduccion([]);
    setActiveTab("items");
  };

  const handleAddItem = (semielaborado) => {
    if (!hasRole("GERENCIA")) return alert("⛔ ACCESO DENEGADO");
    const cantidadInput = prompt(
      `Cantidad a fabricar de "${semielaborado.nombre}":`,
      "10",
    );
    if (!cantidadInput) return;
    const cantidad = Number(cantidadInput);
    if (cantidad > 0) {
      setCurrentPlanItems((prev) => {
        const index = prev.findIndex(
          (item) => item.semielaborado.id === semielaborado.id,
        );
        if (index !== -1) {
          const nuevos = [...prev];
          nuevos[index] = {
            ...nuevos[index],
            cantidad: nuevos[index].cantidad + cantidad,
          };
          return nuevos;
        } else {
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

  const handleEditItem = (idx, qty) => {
    if (!hasRole("GERENCIA")) return alert("⛔");
    setCurrentPlanItems((p) => {
      const n = [...p];
      n[idx].cantidad = qty;
      return n;
    });
  };
  const handleRemoveItem = (idx) => {
    if (!hasRole("GERENCIA")) return alert("⛔");
    setCurrentPlanItems((p) => p.filter((_, i) => i !== idx));
  };

  const handleSavePlan = async () => {
    const role = sessionStorage.getItem("role");
    if (role !== "GERENCIA") return alert("⛔");
    if (!currentPlanNombre) return;
    setIsSaving(true);
    try {
      const body = {
        nombre: currentPlanNombre,
        items: currentPlanItems.map((i) => ({
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
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setMasterPlanList(
        await authFetch(`${API_BASE_URL}/planificacion`).then((r) => r.json()),
      );
      if (selectedPlanId === "NEW") setSelectedPlanId(data.planId);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEstado = async () => {
    if (!hasRole("GERENCIA")) return alert("⛔");
    const estado = currentPlanEstado === "ABIERTO" ? "CERRADO" : "ABIERTO";
    if (confirm("¿Cambiar estado?")) {
      setIsSaving(true);
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
      setIsSaving(false);
    }
  };
  const handleDeletePlan = async () => {
    if (!hasRole("GERENCIA")) return alert("⛔");
    if (confirm("¿Eliminar?")) {
      setIsSaving(true);
      await authFetch(`${API_BASE_URL}/planificacion/${selectedPlanId}`, {
        method: "DELETE",
      });
      setMasterPlanList((prev) => prev.filter((p) => p.id !== selectedPlanId));
      setSelectedPlanId(null);
      setIsSaving(false);
    }
  };
  const isPlanCerrado = currentPlanEstado === "CERRADO";
  const isPlanNuevo = selectedPlanId === "NEW";
  const formatearFecha = (d) => {
    if (!d) return "-";
    const str = String(d).trim();

    // 1. SI TIENE BARRAS ("/"): Es formato Excel (ej: "11/2/26")
    // Lo devolvemos directo o cortamos la hora si la tuviera.
    // NO usamos new Date() aquí para evitar que lo invierta a formato USA.
    if (str.includes("/")) {
      return str.split(" ")[0];
    }

    // 2. SI ES ISO (Guiones "-"): Es formato Base de Datos (ej: "2026-02-11")
    // Aquí sí usamos new Date() con UTC para formatearlo bien.
    try {
      return new Date(str).toLocaleDateString("es-AR", { timeZone: "UTC" });
    } catch {
      return str;
    }
  };
  const handleForceSync = async () => {
    if (confirm("¿Forzar actualización?")) {
      setLoadingPending(true);
      await authFetch(`${API_BASE_URL}/planificacion/sincronizar-ya`, {
        method: "POST",
      });
      setTimeout(() => loadPendingOrders(), 2000);
    }
  };
  const handleUpdateFromGantt = (u) => {
    setShowGanttModal(false);
    setCurrentPlanItems(u);
    handleSavePlan();
  };

  return (
    <>
      <motion.div
        layout
        className="animate-in fade-in duration-500 flex flex-col h-[calc(100vh-140px)] min-h-[700px] gap-6 relative"
      >
        {/* KARDEX */}
        <motion.div className="bg-slate-800 rounded-xl flex flex-col border border-slate-700 shadow-lg overflow-hidden">
          <div className="p-4 bg-slate-800/50 border-b border-slate-700 z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <FaClipboardList className="text-blue-400" /> Planes de
                Producción
              </h2>
              <div className="flex gap-2 w-full md:w-auto md:ml-4 md:pl-4 md:border-l md:border-slate-600 justify-start md:justify-start">
                <button
                  onClick={() => onNavigate("/")}
                  className="text-xs bg-slate-700 hover:bg-orange-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <FaFire /> <span className="hidden sm:inline">Horno N°2</span>
                </button>
                <button
                  onClick={() => onNavigate("/panel-control")}
                  className="text-xs bg-slate-700 hover:bg-blue-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <FaCogs /> <span className="hidden sm:inline">Panel H2</span>
                </button>
              </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <motion.button
                onClick={() => setShowMatrixModal(true)}
                className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-colors border border-purple-500/50"
              >
                <FaCalendarAlt />{" "}
                <span className="hidden sm:inline">Cronograma</span>
                <span className="sm:hidden">Gantt</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowPendingDrawer(true)}
                className="flex-1 md:flex-none bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <FaExclamationTriangle className="animate-pulse" />{" "}
                <span className="hidden sm:inline">Pedidos Sin Stock</span>
                <span className="sm:hidden">Sin Stock</span>
              </motion.button>
              <motion.button
                onClick={handleCreateNew}
                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <FaPlus /> Crear Plan
              </motion.button>
            </div>
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
              <div className="p-4 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <input
                  type="text"
                  value={currentPlanNombre}
                  onChange={(e) => setCurrentPlanNombre(e.target.value)}
                  className="w-full md:w-1/3 bg-transparent border-0 border-b-2 border-slate-700 focus:border-blue-500 px-1 py-2 text-xl font-bold text-white focus:outline-none"
                  disabled={isPlanCerrado || isSaving}
                />
                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                  {/* BOTÓN "SURPRISE" PARA EL AUDITOR */}
                  <button
                    onClick={generarPlanillaControl}
                    disabled={isPlanNuevo || generatingPDF}
                    className="px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-black shadow-lg transition-all disabled:opacity-50"
                    title="Generar planilla para ronda de control"
                  >
                    <FaCheckCircle />{" "}
                    <span className="hidden sm:inline">Planilla Control</span>
                  </button>

                  <button
                    onClick={generarFichasMasivas}
                    disabled={isPlanNuevo || generatingPDF}
                    className="px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white shadow-lg transition-all disabled:opacity-50 border border-slate-600"
                  >
                    {generatingPDF ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaBook className="text-yellow-500" />
                    )}{" "}
                    <span className="hidden sm:inline">Fichas Téc.</span>
                  </button>
                  <button
                    onClick={generarPDFOrden}
                    disabled={isPlanNuevo}
                    className="px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all disabled:opacity-50"
                  >
                    <FaPrint />{" "}
                    <span className="hidden sm:inline">PDF Orden</span>
                  </button>
                  <button
                    onClick={() => setShowGanttModal(true)}
                    disabled={isPlanNuevo || currentPlanItems.length === 0}
                    className="px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition-all disabled:opacity-50"
                  >
                    <FaCalendarAlt />{" "}
                    <span className="hidden sm:inline">Cronograma</span>
                  </button>
                  <button
                    onClick={handleToggleEstado}
                    disabled={isSaving || isPlanNuevo}
                    className={`px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 text-white ${isPlanCerrado ? "bg-gray-600" : "bg-green-600"}`}
                  >
                    {isPlanCerrado ? <FaLock /> : <FaLockOpen />}{" "}
                    <span className="hidden sm:inline">
                      {isPlanCerrado ? "Cerrado" : "Abierto"}
                    </span>
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
                    <span className="hidden sm:inline">Guardar</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex border-b border-slate-700 bg-slate-800/50 overflow-x-auto">
                  <TabButton
                    icon={<FaTasks />}
                    label="Producción (Máquina)"
                    active={activeTab === "items"}
                    onClick={() => setActiveTab("items")}
                  />
                  <TabButton
                    icon={<FaHammer />}
                    label="Terminación (Manual)"
                    active={activeTab === "manual"}
                    onClick={() => setActiveTab("manual")}
                  />
                  <TabButton
                    icon={<FaIndustry />}
                    label="Historial"
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

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                  {activeTab === "items" && (
                    <div>
                      <AutoCompleteInput
                        items={allSemis}
                        onSelect={handleAddItem}
                        placeholder="Buscar semielaborado..."
                        disabled={isPlanCerrado || isSaving}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                        {currentPlanItems.map((item, i) => {
                          const percent =
                            item.cantidad > 0
                              ? (item.producido / item.cantidad) * 100
                              : 0;
                          const isDone = item.producido >= item.cantidad;
                          let statusText = "PENDIENTE",
                            statusColor = "bg-gray-600",
                            cardBorder = "border-gray-600",
                            bgGradient = "from-gray-800/50 to-gray-900/50";
                          if (percent > 0 && percent < 100) {
                            statusText = "EN CURSO";
                            statusColor = "bg-blue-600";
                            cardBorder = "border-blue-600";
                            bgGradient = "from-blue-900/20 to-slate-900/50";
                          } else if (isDone) {
                            statusText = "COMPLETO";
                            statusColor = "bg-green-600";
                            cardBorder = "border-green-600";
                            bgGradient = "from-green-900/20 to-slate-900/50";
                          }
                          return (
                            <motion.div
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              key={i}
                              className={`relative rounded-xl border-t-4 ${cardBorder} bg-gradient-to-br ${bgGradient} shadow-lg p-4 flex flex-col justify-between overflow-hidden group`}
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div className="min-w-0 pr-2">
                                  <h4
                                    className="font-bold text-white text-base truncate leading-tight"
                                    title={item.semielaborado.nombre}
                                  >
                                    {item.semielaborado.nombre}
                                  </h4>
                                  <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                                    {item.semielaborado.codigo}
                                  </span>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span
                                    className={`text-[9px] font-bold text-white px-2 py-0.5 rounded-full ${statusColor} shadow-sm tracking-wide`}
                                  >
                                    {statusText}
                                  </span>
                                  {!isPlanCerrado && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => {
                                          const newQty = prompt(
                                            "Nueva meta:",
                                            item.cantidad,
                                          );
                                          if (newQty && !isNaN(newQty))
                                            handleEditItem(i, Number(newQty));
                                        }}
                                        className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                                      >
                                        <FaEdit size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleRemoveItem(i)}
                                        className="text-gray-400 hover:text-red-400 transition-colors p-1"
                                      >
                                        <FaTrash size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-end justify-between mt-2 mb-3">
                                <div className="flex flex-col">
                                  <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">
                                    Meta
                                  </span>
                                  <span className="text-2xl font-mono font-bold text-white">
                                    {item.cantidad}
                                  </span>
                                </div>
                                <div className="h-8 w-px bg-slate-700 mx-2 mb-1"></div>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">
                                    Real
                                  </span>
                                  <span
                                    className={`text-2xl font-mono font-bold ${isDone ? "text-green-400" : "text-blue-400"}`}
                                  >
                                    {item.producido}
                                  </span>
                                </div>
                              </div>
                              <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                <div
                                  className={`absolute top-0 left-0 h-full transition-all duration-700 ease-out ${isDone ? "bg-green-500" : "bg-blue-500"}`}
                                  style={{
                                    width: `${Math.min(100, percent)}%`,
                                  }}
                                />
                              </div>
                              <div className="text-right mt-1">
                                <span className="text-[10px] font-bold text-gray-400">
                                  {percent.toFixed(0)}% Completado
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                        {currentPlanItems.length === 0 && (
                          <div className="col-span-full h-40 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                            <FaBoxOpen size={32} className="mb-2 opacity-50" />
                            <p className="text-sm font-medium">
                              Plan vacío. Agrega ítems arriba.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "manual" && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-white font-bold text-lg">
                          Órdenes de Trabajo Manual
                        </h3>
                        <button
                          onClick={() => setShowTaskModal(true)}
                          className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold shadow flex items-center gap-2 text-sm"
                        >
                          <FaPlus /> Nueva Tarea
                        </button>
                      </div>
                      {manualTasks.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                          <FaHammer size={40} className="mb-4 opacity-20" />
                          <p>
                            No hay tareas de terminación cargadas para este
                            plan.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {manualTasks.map((task) => {
                            const percent =
                              task.meta > 0
                                ? (task.realizado / task.meta) * 100
                                : 0;
                            const isDone = task.realizado >= task.meta;
                            return (
                              <div
                                key={task.id}
                                className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col"
                              >
                                <div className="h-40 bg-slate-800 relative group">
                                  {task.fotos[0] ? (
                                    <img
                                      src={task.fotos[0]}
                                      className="w-full h-full object-cover"
                                      alt="Ref"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                                      <FaImages size={30} />
                                    </div>
                                  )}
                                  <div className="absolute bottom-2 right-2 flex gap-1">
                                    {task.fotos.slice(1).map(
                                      (f, idx) =>
                                        f && (
                                          <div
                                            key={idx}
                                            className="w-8 h-8 rounded border border-white overflow-hidden shadow-lg"
                                          >
                                            <img
                                              src={f}
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        ),
                                    )}
                                  </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                  <h4 className="text-white font-bold text-lg mb-1">
                                    {task.titulo}
                                  </h4>
                                  <p className="text-gray-400 text-xs line-clamp-2 mb-4 h-8">
                                    {task.instrucciones}
                                  </p>
                                  <div className="mt-auto">
                                    <div className="flex justify-between items-end mb-1">
                                      <span className="text-xs font-bold text-gray-500 uppercase">
                                        Progreso
                                      </span>
                                      <span
                                        className={`text-xl font-mono font-bold ${isDone ? "text-green-400" : "text-orange-400"}`}
                                      >
                                        {task.realizado}{" "}
                                        <span className="text-sm text-gray-500">
                                          / {task.meta}
                                        </span>
                                      </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
                                      <div
                                        className={`h-full ${isDone ? "bg-green-500" : "bg-orange-500"} transition-all duration-500`}
                                        style={{
                                          width: `${Math.min(percent, 100)}%`,
                                        }}
                                      ></div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() =>
                                          generarOrdenTerminacionPDF(task)
                                        }
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                                      >
                                        <FaPrint /> OT PDF
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleReportTask(task.id)
                                        }
                                        className="flex-1 bg-green-700 hover:bg-green-600 border border-green-500 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                                      >
                                        <FaCheckDouble /> Avance
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "produccion" && (
                    <div className="overflow-hidden bg-slate-800/50 border border-slate-700 rounded-xl shadow-xl backdrop-blur-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse min-w-[600px]">
                          <thead className="text-xs text-gray-400 uppercase bg-slate-900/60 tracking-wider font-semibold">
                            <tr>
                              <th className="px-4 md:px-6 py-4">Fecha</th>
                              <th className="px-4 md:px-6 py-4">Operario</th>
                              <th className="px-4 md:px-6 py-4">Producto</th>
                              <th className="px-4 md:px-6 py-4 text-right text-emerald-400">
                                OK
                              </th>
                              <th className="px-4 md:px-6 py-4 text-right text-rose-400">
                                Scrap
                              </th>
                              <th className="px-4 md:px-6 py-4">Detalles</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/50">
                            {historialProduccion.map((reg) => (
                              <tr key={reg.id} className="hover:bg-white/5">
                                <td className="px-4 md:px-6 py-4 text-white">
                                  {new Date(
                                    reg.fecha_produccion,
                                  ).toLocaleDateString()}
                                </td>
                                <td className="px-4 md:px-6 py-4 text-gray-300">
                                  {reg.operario}
                                </td>
                                <td className="px-4 md:px-6 py-4 text-blue-300">
                                  {reg.semielaborado}
                                </td>
                                <td className="px-4 md:px-6 py-4 text-right font-bold text-emerald-400">
                                  {reg.cantidad}
                                </td>
                                <td className="px-4 md:px-6 py-4 text-right font-bold text-rose-400">
                                  {reg.scrap || "-"}
                                </td>
                                <td className="px-4 md:px-6 py-4 text-xs text-gray-500">
                                  {reg.motivo}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {activeTab === "mrp" && (
                    <div className="overflow-hidden border border-slate-700 rounded-lg">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left min-w-[500px]">
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
                                  className={`px-4 py-3 text-right font-bold ${mp.balance < 0 ? "text-red-400" : "text-green-400"}`}
                                >
                                  {mp.balance}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showPendingDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPendingDrawer(false)}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[70] w-full md:w-[450px] bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col"
            >
              <div className="p-5 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FaExclamationTriangle className="text-red-500" /> Pedidos
                    Sin Stock
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Revisión rápida de urgencias
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleForceSync}
                    className="text-blue-400 hover:text-white bg-slate-700 hover:bg-blue-600 p-2 rounded-full transition-colors"
                    title="Sincronizar ahora con Excel"
                  >
                    <FaSync className={loadingPending ? "animate-spin" : ""} />
                  </button>
                  <button
                    onClick={() => setShowPendingDrawer(false)}
                    className="text-gray-400 hover:text-white bg-slate-700 p-2 rounded-full transition-colors"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-slate-900/50">
                {loadingPending ? (
                  <div className="flex items-center justify-center h-40 text-gray-400">
                    <FaSpinner className="animate-spin text-2xl" />
                  </div>
                ) : pendingOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-slate-800 rounded-xl">
                    <FaCheckCircle className="text-4xl text-green-500/20 mb-4" />
                    <p>No hay pedidos marcados "Sin Stock"</p>
                  </div>
                ) : (
                  pendingOrders.map((pedido, i) => (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={i}
                      className="bg-slate-800 rounded-xl p-4 border-l-4 border-red-500 shadow-md relative overflow-hidden group hover:bg-slate-750 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-white text-base leading-tight">
                            {pedido.modelo || pedido.MODELO}
                          </h4>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                            <FaUser className="text-blue-400" size={10} />{" "}
                            {pedido.cliente || pedido.CLIENTE}
                          </p>
                        </div>
                        <span className="bg-red-900/40 text-red-300 text-[10px] font-bold px-2 py-1 rounded border border-red-800/50">
                          SIN STOCK
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50 mt-2">
                        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                          <FaClock size={10} />{" "}
                          {formatearFecha(pedido.fecha || pedido.FECHA)}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-500 uppercase mr-2">
                            Cantidad
                          </span>
                          <span className="text-lg font-bold text-white font-mono">
                            {pedido.cantidad || pedido.CANTIDAD}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
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
      <AnimatePresence>
        {showGanttModal && (
          <PlanGanttModal
            items={currentPlanItems}
            onClose={() => setShowGanttModal(false)}
            onSaveUpdate={handleUpdateFromGantt}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showMatrixModal && (
          <ProductionMatrixModal
            orders={pendingOrders}
            allSemis={allSemis}
            onClose={() => setShowMatrixModal(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTaskModal && (
          <VisualTaskModal
            allSemis={allSemis}
            onClose={() => setShowTaskModal(false)}
            onSave={handleSaveTask}
          />
        )}
      </AnimatePresence>
    </>
  );
}
