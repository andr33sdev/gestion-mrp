import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils.js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
} from "react-icons/fa";

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

  // ... (Efectos de carga y lógica de MRP se mantienen igual) ...
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

  // --- GENERADOR PDF ORDEN DE PRODUCCIÓN (PROFESIONAL) ---
  const generarPDFOrden = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString("es-AR");
    const hora = new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Colores corporativos
    const azulOscuro = [30, 41, 59];
    const grisClaro = [241, 245, 249];
    const bordeGris = [203, 213, 225];

    // --- 1. ENCABEZADO ---
    doc.setFillColor(...azulOscuro);
    doc.rect(0, 0, 210, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ORDEN DE PRODUCCIÓN", 14, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("PLANIFICACIÓN Y CONTROL", 14, 24);

    // Datos del Plan (Derecha)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`#${currentPlanNombre.toUpperCase()}`, 195, 18, {
      align: "right",
    });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Emisión: ${fecha} - ${hora} hs`, 195, 24, { align: "right" });

    // --- 2. RESUMEN EJECUTIVO (Caja) ---
    let yPos = 40;

    // Totales
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

    // Dibujar caja resumen
    doc.setDrawColor(...bordeGris);
    doc.setFillColor(...grisClaro);
    doc.roundedRect(14, yPos, 182, 18, 2, 2, "FD");

    doc.setTextColor(50);
    doc.setFontSize(9);

    // Columnas de la caja
    const colW = 182 / 4;

    // Items
    doc.setFont("helvetica", "normal");
    doc.text("TOTAL ÍTEMS", 14 + colW * 0.5, yPos + 6, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(String(totalItems), 14 + colW * 0.5, yPos + 12, {
      align: "center",
    });

    // Unidades
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("OBJETIVO (Unid)", 14 + colW * 1.5, yPos + 6, {
      align: "center",
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(String(totalUnidades), 14 + colW * 1.5, yPos + 12, {
      align: "center",
    });

    // Estado
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("ESTADO", 14 + colW * 2.5, yPos + 6, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(currentPlanEstado, 14 + colW * 2.5, yPos + 12, {
      align: "center",
    });

    // Avance
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("AVANCE ACTUAL", 14 + colW * 3.5, yPos + 6, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${pctAvance}%`, 14 + colW * 3.5, yPos + 12, { align: "center" });

    yPos += 28;

    // --- 3. DETALLE DE PRODUCCIÓN (TABLA PRINCIPAL) ---
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text("1. DETALLE DE PRODUCCIÓN", 14, yPos);
    yPos += 2;

    const tableData = currentPlanItems.map((i) => [
      i.semielaborado.codigo,
      i.semielaborado.nombre,
      i.cantidad,
      "", // Espacio para anotar REAL
      "", // Espacio para LOTE/OBS
      `${i.producido} (${((i.producido / i.cantidad) * 100).toFixed(0)}%)`, // Info sistema
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
        3: { width: 25 }, // Columna vacía para escribir
        4: { width: 35 }, // Columna vacía para escribir
        5: { width: 25, halign: "right", fontSize: 8, textColor: 100 },
      },
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // --- 4. MATERIALES NECESARIOS (MRP - KITTING) ---
    // Chequeamos si entra en la hoja
    if (yPos + 40 > 280) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text("2. MATERIALES REQUERIDOS (PREPARACIÓN)", 14, yPos);

    // Usamos la variable 'explosion' que ya calcula el MRP
    const mrpData = explosion.map((m) => [
      m.nombre,
      m.necesario, // Cantidad total necesaria para el plan
      m.stock, // Stock actual sistema
      "", // Checkbox manual
    ]);

    autoTable(doc, {
      startY: yPos + 4,
      head: [["INSUMO / MATERIA PRIMA", "CANT. TOTAL", "STOCK DISP.", "CHECK"]],
      body: mrpData,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 }, // Slate 600
      columnStyles: {
        0: { width: 90 },
        1: { width: 30, halign: "right", fontStyle: "bold" },
        2: { width: 30, halign: "right" },
        3: { width: 20 }, // Para tildar
      },
    });

    yPos = doc.lastAutoTable.finalY + 20;

    // --- 5. PIE DE PÁGINA (FIRMAS) ---
    if (yPos + 30 > 280) {
      doc.addPage();
      yPos = 40;
    }

    doc.setDrawColor(150);
    doc.setLineWidth(0.5);

    // Firma 1
    doc.line(30, yPos, 80, yPos);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("RESPONSABLE PRODUCCIÓN", 55, yPos + 5, { align: "center" });

    // Firma 2
    doc.line(130, yPos, 180, yPos);
    doc.text("GERENCIA / CALIDAD", 155, yPos + 5, { align: "center" });

    // Disclaimer final
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

  // --- GENERADOR PDF MASIVO (FICHAS TÉCNICAS) ---
  const generarFichasMasivas = async () => {
    if (currentPlanItems.length === 0) return alert("El plan está vacío.");
    if (
      !confirm(`¿Generar book técnico con ${currentPlanItems.length} fichas?`)
    )
      return;

    setGeneratingPDF(true);

    try {
      // 1. Obtener datos de TODOS los productos del plan en paralelo
      const promises = currentPlanItems.map((item) =>
        authFetch(`${API_BASE_URL}/ingenieria/ficha/${item.semielaborado.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      );

      const resultados = await Promise.all(promises);
      const doc = new jsPDF();

      // 2. Iterar y dibujar cada página
      resultados.forEach((data, index) => {
        if (!data) return; // Saltar si falló la carga de alguno

        // Si no es el primero, nueva página
        if (index > 0) doc.addPage();

        const { producto, receta, specs = {}, ultima_version_receta } = data;
        const { tipo_proceso, parametros_maquina: pm = {} } = producto;

        // --- AQUÍ VA LA LÓGICA DE DIBUJO DE FICHA (COPIADA Y ADAPTADA) ---
        const azulOscuro = [30, 41, 59];
        const grisClaro = [241, 245, 249];
        const rojoAlerta = [185, 28, 28];

        // 1. ENCABEZADO
        doc.setFillColor(...azulOscuro);
        doc.rect(0, 0, 210, 22, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("FICHA TÉCNICA DE PRODUCCIÓN", 14, 10);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`PROCESO: ${tipo_proceso || "ROTOMOLDEO"}`, 14, 16);

        const fechaImpresion = new Date().toLocaleDateString("es-AR");
        doc.setFontSize(8);
        doc.text(`Impreso: ${fechaImpresion}`, 195, 10, { align: "right" });
        doc.text(`Plan: ${currentPlanNombre}`, 195, 16, { align: "right" }); // <--- Agregamos nombre del plan

        let yPos = 30;

        // 2. INFO PRODUCTO
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`${producto.nombre}`, 14, yPos);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`CÓDIGO: ${producto.codigo}`, 14, yPos + 5);

        doc.setDrawColor(200);
        doc.setFillColor(...grisClaro);
        doc.roundedRect(120, yPos - 6, 75, 14, 1, 1, "FD");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("RECETA VIGENTE:", 123, yPos - 1);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(
          ultima_version_receta?.nombre_version || "Estándar / Inicial",
          123,
          yPos + 4,
        );

        yPos += 12;

        // 3. SPECS
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
            cellPadding: 2,
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
        yPos = doc.lastAutoTable.finalY + 8;

        // 4. BLOQUE CENTRAL (2 COLUMNAS)
        const colLeftX = 14;
        const colRightX = 115;
        const colWidthLeft = 95;
        const colWidthRight = 80;
        const startYBlock = yPos;

        // IZQUIERDA: MÁQUINA
        doc.setFillColor(...azulOscuro);
        doc.rect(colLeftX, yPos, colWidthLeft, 6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text(
          `PARÁMETROS ${
            tipo_proceso === "INYECCION" ? "INYECCIÓN" : "ROTOMOLDEO"
          }`,
          colLeftX + 2,
          yPos + 4,
        );
        let yMachine = yPos + 7;

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
              cellPadding: 1,
            },
            styles: { fontSize: 8, halign: "center", cellPadding: 1 },
            margin: { left: colLeftX },
            tableWidth: colWidthLeft,
          });
          yMachine = doc.lastAutoTable.finalY + 4;

          doc.setFontSize(8);
          doc.setTextColor(0);
          doc.setFont("helvetica", "bold");
          doc.text("TEMPERATURAS:", colLeftX, yMachine);
          doc.setFont("helvetica", "normal");
          doc.text(pm.temperaturas_zonas || "-", colLeftX + 30, yMachine);
          yMachine += 4;
          doc.setFont("helvetica", "bold");
          doc.text("CHILLER:", colLeftX, yMachine);
          doc.setFont("helvetica", "normal");
          doc.text(pm.chiller_matriz || "-", colLeftX + 30, yMachine);
          yMachine += 5;

          autoTable(doc, {
            startY: yMachine,
            head: [["CARGA / SUCCIÓN #5", "Pos", "Pres", "Vel", "P. Atrás"]],
            body: [
              [
                "",
                pm.carga_pos || "-",
                pm.carga_pres || "-",
                pm.carga_vel || "-",
                pm.carga_pres_atras || "-",
              ],
            ],
            theme: "grid",
            headStyles: {
              fontStyle: "bold",
              fillColor: [220, 220, 220],
              textColor: 0,
              fontSize: 7,
              halign: "center",
            },
            styles: { fontSize: 7, halign: "center", cellPadding: 1 },
            columnStyles: { 0: { cellWidth: 0.1 } },
            margin: { left: colLeftX },
            tableWidth: colWidthLeft,
          });
          yMachine = doc.lastAutoTable.finalY;
        } else {
          const rotoData = [
            ["1", pm.t1 || "-", pm.v1m1 || "-", pm.v1m2 || "-", pm.inv1 || "-"],
            ["2", pm.t2 || "-", pm.v2m1 || "-", pm.v2m2 || "-", pm.inv2 || "-"],
            ["3", pm.t3 || "-", pm.v3m1 || "-", pm.v3m2 || "-", pm.inv3 || "-"],
            ["4", pm.t4 || "-", pm.v4m1 || "-", pm.v4m2 || "-", pm.inv4 || "-"],
          ];
          autoTable(doc, {
            startY: yMachine,
            head: [["Etapa", "T (minutos)", "V1 %", "V2 %", "Inv %"]],
            body: rotoData,
            theme: "striped",
            headStyles: {
              fillColor: [80, 80, 80],
              fontSize: 7,
              cellPadding: 1,
            },
            styles: { fontSize: 8, halign: "center", cellPadding: 1.5 },
            margin: { left: colLeftX },
            tableWidth: colWidthLeft,
          });
          yMachine = doc.lastAutoTable.finalY + 3;
          autoTable(doc, {
            startY: yMachine,
            head: [["ENFRIAMIENTO (minutos)", "TEMP. HORNO"]],
            body: [[pm.frio_min || "-", (pm.temp_horno || "-") + " °C"]],
            theme: "grid",
            headStyles: {
              fillColor: [100, 100, 100],
              fontSize: 7,
              cellPadding: 1,
            },
            styles: { fontSize: 8, halign: "center" },
            margin: { left: colLeftX },
            tableWidth: colWidthLeft,
          });
          yMachine = doc.lastAutoTable.finalY;
        }

        // DERECHA: RECETA
        doc.setFillColor(...azulOscuro);
        doc.rect(colRightX, startYBlock, colWidthRight, 6, "F");
        doc.setTextColor(255, 255, 255);
        doc.text("INGENIERÍA (RECETA)", colRightX + 2, startYBlock + 4);
        let yRecipe = startYBlock + 7;
        const tablaReceta = receta.map((item) => [
          item.nombre,
          `${Number(item.cantidad).toFixed(2)}`, // 2 DECIMALES
        ]);
        autoTable(doc, {
          startY: yRecipe,
          head: [["INSUMO", "CANTIDAD"]],
          body: tablaReceta,
          theme: "striped",
          styles: { fontSize: 8, cellPadding: 1.5 },
          headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
          columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
          margin: { left: colRightX },
          tableWidth: colWidthRight,
        });
        yRecipe = doc.lastAutoTable.finalY;

        yPos = Math.max(yMachine, yRecipe) + 8;

        // 5. PROCEDIMIENTO
        doc.setFillColor(...azulOscuro);
        doc.rect(14, yPos, 182, 6, "F");
        doc.setTextColor(255, 255, 255);
        doc.text("PROCEDIMIENTO OPERATIVO ESTÁNDAR", 16, yPos + 4);
        yPos += 10;

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setLineHeightFactor(1.6); // Interlineado
        let textoProcedimiento =
          tipo_proceso === "INYECCION"
            ? `Se separa el material correspondiente con la matriz colocada, bajo supervisión del ENCARGADO. Se selecciona en la librería el modelo a fabricar. Se procede a calentar la Inyectora; la temperatura alcanzará el set-point en el tiempo determinado.\nCualquier problema con el proceso, acudir al Encargado. Si no se encuentra, dejar el artículo identificado y separado correctamente para su posterior análisis.`
            : `Identificar material indicado por ENCARGADO. En el horno, con matriz colocada y modelo seleccionado, posicionar matriz horizontal (carga). Aplicar desmoldante si requiere. Pesar cantidad declarada en ficha y trasladar. Verter material parejo dentro de la matriz. Colocar respirador limpio. Cerrar tapa y trabas. Repetir proceso.\nCualquier problema, acudir al Encargado. Si no está, dejar el artículo identificado y separado para análisis.`;

        const splitText = doc.splitTextToSize(textoProcedimiento, 182);
        doc.text(splitText, 14, yPos);
        yPos += splitText.length * 4.5 + 8;
        doc.setLineHeightFactor(1.15); // Reset

        // 6. PROBLEMAS
        if (yPos > 240) yPos = 240;
        let problemas =
          tipo_proceso === "INYECCION"
            ? [
                ["Agujereada", "Regulación de carga, aire y presión"],
                ["Manchada", "Avisar y esperar limpieza color. Anotar."],
                ["Doblada", "Darle más enfriado"],
                ["Quemada", "Consultar temperaturas"],
              ]
            : [
                ["Cruda", "Subir tiempo cocinado (máx 2 min)"],
                ["Quemada", "Bajar tiempo cocinado (máx 2 min)"],
                ["Doblada", "Revisar silicona / Exceso temp"],
                ["Incompleta", "Revisar respiradores y cierres"],
              ];

        const problemRowHeight = 9;
        const problemHeaderHeight = 10;
        const problemBoxHeight =
          problemHeaderHeight +
          Math.ceil(problemas.length / 2) * problemRowHeight +
          4;

        doc.setFillColor(...rojoAlerta);
        doc.rect(14, yPos, 182, 6, "F");
        doc.setDrawColor(...rojoAlerta);
        doc.setLineWidth(0.5);
        doc.rect(14, yPos, 182, problemBoxHeight);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("SOLUCIÓN DE PROBLEMAS FRECUENTES", 105, yPos + 4, {
          align: "center",
        });

        yPos += 11;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        problemas.forEach(([problema, solucion], i) => {
          const xOffset = i % 2 === 0 ? 20 : 110;
          const yOffset = yPos + Math.floor(i / 2) * problemRowHeight;
          doc.setFont("helvetica", "bold");
          doc.text(`• ${problema}:`, xOffset, yOffset);
          doc.setFont("helvetica", "normal");
          doc.text(`${solucion}`, xOffset, yOffset + 3.5);
        });

        // Disclaimer
        yPos += Math.ceil(problemas.length / 2) * problemRowHeight + 6;
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100);
        doc.text(
          "En todos los casos consultar previamente con un superior.",
          105,
          yPos,
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

  // ... (Resto de los handlers se mantienen igual) ...
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
    if (!hasRole("GERENCIA")) return alert("⛔ ACCESO DENEGADO");
    setCurrentPlanItems((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], cantidad: qty };
      return n;
    });
  };
  const handleRemoveItem = (idx) => {
    if (!hasRole("GERENCIA")) return alert("⛔ ACCESO DENEGADO");
    setCurrentPlanItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePlan = async () => {
    const role = sessionStorage.getItem("role");
    if (role !== "GERENCIA") return alert("⛔ ACCESO DENEGADO");
    if (!currentPlanNombre) return;
    await guardarPlanEnBD(currentPlanItems);
  };

  const guardarPlanEnBD = async (itemsAGuardar) => {
    setIsSaving(true);
    try {
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
      const all = await authFetch(`${API_BASE_URL}/planificacion`).then((r) =>
        r.json(),
      );
      setMasterPlanList(all);
      if (selectedPlanId === "NEW") setSelectedPlanId(data.planId);
      setCurrentPlanItems(itemsAGuardar);
      console.log("Plan guardado.");
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEstado = async () => {
    if (!hasRole("GERENCIA")) return alert("⛔ Solo Gerencia.");
    if (selectedPlanId === "NEW") return;
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

  const handleUpdateFromGantt = (u) => {
    setShowGanttModal(false);
    guardarPlanEnBD(u);
  };

  const handleDeletePlan = async () => {
    if (!hasRole("GERENCIA")) return alert("⛔ Solo Gerencia.");
    if (selectedPlanId === "NEW") {
      setSelectedPlanId(null);
      return;
    }
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

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "-";
    const str = String(fechaStr).trim();
    if (str.includes("/")) return str.split(" ")[0];
    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      return d.toLocaleDateString("es-AR", { timeZone: "UTC" });
    } catch (e) {
      return str;
    }
  };

  const handleForceSync = async () => {
    if (
      confirm(
        "¿Forzar actualización desde el Excel? Esto puede tardar unos segundos.",
      )
    ) {
      setLoadingPending(true);
      try {
        await authFetch(`${API_BASE_URL}/planificacion/sincronizar-ya`, {
          method: "POST",
        });
        setTimeout(() => loadPendingOrders(), 2000);
      } catch (e) {
        alert("Error sincronizando");
        setLoadingPending(false);
      }
    }
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
                <FaCalendarAlt />
                <span className="hidden sm:inline">Cronograma</span>
                <span className="sm:hidden">Gantt</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowPendingDrawer(true)}
                className="flex-1 md:flex-none bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <FaExclamationTriangle className="animate-pulse" />
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
                  {/* --- BOTÓN NUEVO: FICHAS TÉCNICAS (BOOK) --- */}
                  <button
                    onClick={generarFichasMasivas}
                    disabled={isPlanNuevo || generatingPDF}
                    className="px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white shadow-lg transition-all disabled:opacity-50 border border-slate-600"
                  >
                    {generatingPDF ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaBook className="text-yellow-500" />
                    )}
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
                    className={`px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 text-white ${
                      isPlanCerrado ? "bg-gray-600" : "bg-green-600"
                    }`}
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

              {/* CONTENIDO TABS */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex border-b border-slate-700 bg-slate-800/50 overflow-x-auto">
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
                          let statusText = "PENDIENTE";
                          let statusColor = "bg-gray-600";
                          let cardBorder = "border-gray-600";
                          let bgGradient = "from-gray-800/50 to-gray-900/50";
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
                                    className={`text-2xl font-mono font-bold ${
                                      isDone
                                        ? "text-green-400"
                                        : "text-blue-400"
                                    }`}
                                  >
                                    {item.producido}
                                  </span>
                                </div>
                              </div>
                              <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                <div
                                  className={`absolute top-0 left-0 h-full transition-all duration-700 ease-out ${
                                    isDone ? "bg-green-500" : "bg-blue-500"
                                  }`}
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
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* --- DRAWER DESLIZANTE DE PEDIDOS PENDIENTES --- */}
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
                  {/* BOTÓN NUEVO DE REFRESCAR */}
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
    </>
  );
}
