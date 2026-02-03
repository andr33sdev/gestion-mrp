import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  FaBoxOpen,
  FaCubes,
  FaDatabase,
  FaSave,
  FaSpinner,
  FaTools,
  FaTrash,
  FaPlus,
  FaRecycle,
  FaLeaf,
  FaEye,
  FaHistory,
  FaTimes,
  FaClipboardList,
  FaArchive,
  FaCheckDouble,
  FaArrowLeft,
  FaCalculator,
  FaMagic,
  FaChevronLeft,
  FaChevronRight,
  FaFilePdf,
  FaCogs,
  FaPrint,
} from "react-icons/fa";
import { API_BASE_URL, PEDIDOS_API_URL, authFetch } from "../utils.js";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// --- SUB-COMPONENTE: MODAL FICHA TÉCNICA AVANZADO ---
function FichaTecnicaModal({ semiId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("RECETA");

  // Estado para Edición de Parámetros
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [editForm, setEditForm] = useState({
    tipo_proceso: "ROTOMOLDEO",
    parametros_maquina: {},
  });

  const fetchData = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/ingenieria/ficha/${semiId}`);
      if (res.ok) {
        const jsonData = await res.json();
        setData(jsonData);
        setEditForm({
          tipo_proceso: jsonData.producto.tipo_proceso || "ROTOMOLDEO",
          parametros_maquina: jsonData.producto.parametros_maquina || {},
        });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [semiId]);

  const handleSaveParams = async () => {
    try {
      await authFetch(
        `${API_BASE_URL}/ingenieria/semielaborados/${semiId}/tecnica`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        },
      );
      alert("Datos técnicos actualizados.");
      setIsEditingParams(false);
      fetchData();
    } catch (e) {
      alert("Error al guardar");
    }
  };

  // --- GENERAR PDF "SINGLE PAGE" BALANCEADO ---
  const imprimirFichaTecnica = () => {
    if (!data) return;
    const { producto, receta, specs = {}, ultima_version_receta } = data;
    const { tipo_proceso, parametros_maquina: pm } = producto;

    const doc = new jsPDF();
    const azulOscuro = [30, 41, 59];
    const grisClaro = [241, 245, 249];
    const rojoAlerta = [185, 28, 28];

    // --- 1. ENCABEZADO (22mm) ---
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
    doc.text("Documento Controlado", 195, 16, { align: "right" });

    let yPos = 30;

    // --- 2. INFO PRODUCTO Y VERSIÓN (Fila Superior) ---
    doc.setTextColor(0, 0, 0);

    // Columna Izq: Datos Producto
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${producto.nombre}`, 14, yPos);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`CÓDIGO: ${producto.codigo}`, 14, yPos + 5);

    // Columna Der: Versión Receta (Caja Gris)
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

    // --- 3. SPECS VISUALES (Barra completa) ---
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

    // ============================================================
    //    BLOQUE CENTRAL: 2 COLUMNAS (MÁQUINA vs RECETA)
    // ============================================================

    const colLeftX = 14;
    const colRightX = 115;
    const colWidthLeft = 95;
    const colWidthRight = 80;

    const startYBlock = yPos;

    // --- COLUMNA IZQUIERDA: PARÁMETROS MÁQUINA ---
    doc.setFillColor(...azulOscuro);
    doc.rect(colLeftX, yPos, colWidthLeft, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(
      `PARÁMETROS ${tipo_proceso === "INYECCION" ? "INYECCIÓN" : "ROTOMOLDEO"}`,
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
        headStyles: { fillColor: [80, 80, 80], fontSize: 8, cellPadding: 1 },
        styles: { fontSize: 8, halign: "center", cellPadding: 1 },
        margin: { left: colLeftX },
        tableWidth: colWidthLeft,
      });

      yMachine = doc.lastAutoTable.finalY + 4;

      // Datos extra Inyeccion
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

      // Carga Succión
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
        styles: {
          fontSize: 7,
          halign: "center",
          cellPadding: 1,
        },
        columnStyles: { 0: { cellWidth: 0.1 } },
        margin: { left: colLeftX },
        tableWidth: colWidthLeft,
      });
      yMachine = doc.lastAutoTable.finalY;
    } else {
      // --- ROTOMOLDEO ---
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
        headStyles: { fillColor: [80, 80, 80], fontSize: 8, cellPadding: 1 },
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
          fontSize: 8,
          cellPadding: 1,
        },
        styles: { fontSize: 8, halign: "center" },
        margin: { left: colLeftX },
        tableWidth: colWidthLeft,
      });
      yMachine = doc.lastAutoTable.finalY;
    }

    // --- COLUMNA DERECHA: RECETA (INGENIERÍA) ---
    doc.setFillColor(...azulOscuro);
    doc.rect(colRightX, startYBlock, colWidthRight, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("INGENIERÍA (RECETA)", colRightX + 2, startYBlock + 4);

    let yRecipe = startYBlock + 7;

    const tablaReceta = receta.map((item) => [
      item.nombre,
      `${Number(item.cantidad).toFixed(2)}`, // <--- CAMBIO AQUÍ: 2 DECIMALES
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

    // --- SINCRONIZAR Y ---
    yPos = Math.max(yMachine, yRecipe) + 8;

    // ============================================================
    //    BLOQUE INFERIOR: PROCEDIMIENTO Y PROBLEMAS
    // ============================================================

    // --- PROCEDIMIENTO ---
    if (yPos > 210) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(...azulOscuro);
    doc.rect(14, yPos, 182, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("PROCEDIMIENTO OPERATIVO ESTÁNDAR", 16, yPos + 4);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setLineHeightFactor(1.6); // Interlineado para más aire

    let textoProcedimiento = "";
    if (tipo_proceso === "INYECCION") {
      textoProcedimiento = `Se separa el material correspondiente con la matriz colocada, bajo supervisión del ENCARGADO. Se selecciona en la librería el modelo a fabricar. Se procede a calentar la Inyectora; la temperatura alcanzará el set-point en el tiempo determinado.\nCualquier problema con el proceso, acudir al Encargado. Si no se encuentra, dejar el artículo identificado y separado correctamente para su posterior análisis.`;
    } else {
      textoProcedimiento = `Identificar material indicado por ENCARGADO. En el horno, con matriz colocada y modelo seleccionado, posicionar matriz horizontal (carga). Aplicar desmoldante si requiere. Pesar cantidad declarada en ficha y trasladar. Verter material parejo dentro de la matriz. Colocar respirador limpio. Cerrar tapa y trabas. Repetir proceso.\nCualquier problema, acudir al Encargado. Si no está, dejar el artículo identificado y separado para análisis.`;
    }

    const splitText = doc.splitTextToSize(textoProcedimiento, 182);
    doc.text(splitText, 14, yPos);

    yPos += splitText.length * 4.5 + 8; // Ajuste espaciado
    doc.setLineHeightFactor(1.15); // Reset interlineado

    // --- SOLUCIÓN DE PROBLEMAS ---
    if (yPos > 240) yPos = 240;

    let problemas = [];
    if (tipo_proceso === "INYECCION") {
      problemas = [
        ["Agujereada", "Regulación de carga, aire y presión"],
        ["Manchada", "Avisar y esperar limpieza color. Anotar."],
        ["Doblada", "Darle más enfriado"],
        ["Quemada", "Consultar temperaturas"],
      ];
    } else {
      problemas = [
        ["Cruda", "Subir tiempo cocinado (máx 2 min)"],
        ["Quemada", "Bajar tiempo cocinado (máx 2 min)"],
        ["Doblada", "Revisar silicona / Exceso temp"],
        ["Incompleta", "Revisar respiradores y cierres"],
      ];
    }

    // Calcular altura caja
    const problemRowHeight = 9;
    const problemHeaderHeight = 10;
    const problemBoxHeight =
      problemHeaderHeight +
      Math.ceil(problemas.length / 2) * problemRowHeight +
      4;

    // Caja
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

    // Grid problemas
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

    doc.save(`Ficha_${producto.nombre.replace(/\s+/g, "_")}.pdf`);
  };

  // --- RENDER FORMULARIO DE EDICIÓN ---
  const renderEditForm = () => {
    const isRot = editForm.tipo_proceso === "ROTOMOLDEO";
    const pm = editForm.parametros_maquina || {};

    const handleChange = (field, val) => {
      setEditForm((prev) => ({
        ...prev,
        parametros_maquina: { ...prev.parametros_maquina, [field]: val },
      }));
    };

    return (
      <div className="bg-slate-700 p-4 rounded-lg mt-4 animate-in fade-in">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-white font-bold flex items-center gap-2">
            <FaCogs /> Configuración de Máquina
          </h4>
          <select
            value={editForm.tipo_proceso}
            onChange={(e) =>
              setEditForm({ ...editForm, tipo_proceso: e.target.value })
            }
            className="bg-slate-900 text-white p-1 rounded border border-slate-600 text-sm"
          >
            <option value="ROTOMOLDEO">ROTOMOLDEO</option>
            <option value="INYECCION">INYECCIÓN</option>
          </select>
        </div>

        {isRot ? (
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div className="font-bold text-gray-400">Parámetro</div>
            <div className="text-center text-gray-400">Etapa 1</div>
            <div className="text-center text-gray-400">Etapa 2</div>
            <div className="text-center text-gray-400">Etapa 3</div>
            <div className="text-center text-gray-400">Etapa 4</div>

            <div className="text-gray-300 py-1">Tiempo (minutos)</div>
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.t1 || ""}
              onChange={(e) => handleChange("t1", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.t2 || ""}
              onChange={(e) => handleChange("t2", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.t3 || ""}
              onChange={(e) => handleChange("t3", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.t4 || ""}
              onChange={(e) => handleChange("t4", e.target.value)}
            />

            <div className="text-gray-300 py-1">Vel M1 (%)</div>
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.v1m1 || ""}
              onChange={(e) => handleChange("v1m1", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.v2m1 || ""}
              onChange={(e) => handleChange("v2m1", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.v3m1 || ""}
              onChange={(e) => handleChange("v3m1", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.v4m1 || ""}
              onChange={(e) => handleChange("v4m1", e.target.value)}
            />

            <div className="text-gray-300 py-1">Vel M2 (%)</div>
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.v1m2 || ""}
              onChange={(e) => handleChange("v1m2", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.v2m2 || ""}
              onChange={(e) => handleChange("v2m2", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.v3m2 || ""}
              onChange={(e) => handleChange("v3m2", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.v4m2 || ""}
              onChange={(e) => handleChange("v4m2", e.target.value)}
            />

            <div className="text-gray-300 py-1">Inversión (%)</div>
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.inv1 || ""}
              onChange={(e) => handleChange("inv1", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.inv2 || ""}
              onChange={(e) => handleChange("inv2", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.inv3 || ""}
              onChange={(e) => handleChange("inv3", e.target.value)}
            />
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1 text-center"
              placeholder="-"
              value={pm.inv4 || ""}
              onChange={(e) => handleChange("inv4", e.target.value)}
            />

            <div className="col-span-5 border-t border-slate-600 my-2"></div>
            <div className="text-gray-300">Temp Horno (°C)</div>
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1"
              placeholder="Ej: 300"
              value={pm.temp_horno || ""}
              onChange={(e) => handleChange("temp_horno", e.target.value)}
            />
            <div className="text-gray-300">Frío (minutos)</div>
            <input
              type="text"
              className="bg-slate-900 text-white rounded p-1"
              placeholder="Ej: 18"
              value={pm.frio_min || ""}
              onChange={(e) => handleChange("frio_min", e.target.value)}
            />
            <div className="text-gray-300">Aire (Inicio/Fin)</div>
            <div className="flex gap-1">
              <input
                type="text"
                className="bg-slate-900 text-white rounded p-1 w-1/2"
                placeholder="Ini"
                value={pm.inicio_aire || ""}
                onChange={(e) => handleChange("inicio_aire", e.target.value)}
              />
              <input
                type="text"
                className="bg-slate-900 text-white rounded p-1 w-1/2"
                placeholder="Fin"
                value={pm.fin_aire || ""}
                onChange={(e) => handleChange("fin_aire", e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-7 gap-1 text-center items-center">
              <div className="font-bold text-gray-400">#</div>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="text-gray-400">
                  #{i}
                </div>
              ))}

              <div className="text-gray-300 text-left">Posición</div>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <input
                  key={i}
                  type="text"
                  className="bg-slate-900 text-white rounded p-1 text-center"
                  value={pm[`pos${i}`] || ""}
                  onChange={(e) => handleChange(`pos${i}`, e.target.value)}
                />
              ))}

              <div className="text-gray-300 text-left">Presión</div>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <input
                  key={i}
                  type="text"
                  className="bg-slate-900 text-white rounded p-1 text-center"
                  value={pm[`pres${i}`] || ""}
                  onChange={(e) => handleChange(`pres${i}`, e.target.value)}
                />
              ))}

              <div className="text-gray-300 text-left">Velocidad</div>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <input
                  key={i}
                  type="text"
                  className="bg-slate-900 text-white rounded p-1 text-center"
                  value={pm[`vel${i}`] || ""}
                  onChange={(e) => handleChange(`vel${i}`, e.target.value)}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-600 pt-3">
              <div>
                <label className="text-gray-400 block mb-1">
                  Temperaturas (separar con /)
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900 text-white rounded p-2"
                  placeholder="182 / 171 / 177..."
                  value={pm.temperaturas_zonas || ""}
                  onChange={(e) =>
                    handleChange("temperaturas_zonas", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">
                  Chiller Matriz
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900 text-white rounded p-2"
                  placeholder="Sin datos..."
                  value={pm.chiller_matriz || ""}
                  onChange={(e) =>
                    handleChange("chiller_matriz", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="bg-slate-800 p-2 rounded border border-slate-600">
              <label className="text-purple-400 font-bold block mb-2">
                Carga con Succión (Posición #5)
              </label>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="text"
                  className="bg-slate-900 text-white rounded p-1"
                  placeholder="Pos"
                  value={pm.carga_pos || ""}
                  onChange={(e) => handleChange("carga_pos", e.target.value)}
                />
                <input
                  type="text"
                  className="bg-slate-900 text-white rounded p-1"
                  placeholder="Pres"
                  value={pm.carga_pres || ""}
                  onChange={(e) => handleChange("carga_pres", e.target.value)}
                />
                <input
                  type="text"
                  className="bg-slate-900 text-white rounded p-1"
                  placeholder="Vel"
                  value={pm.carga_vel || ""}
                  onChange={(e) => handleChange("carga_vel", e.target.value)}
                />
                <input
                  type="text"
                  className="bg-slate-900 text-white rounded p-1"
                  placeholder="P. Atrás"
                  value={pm.carga_pres_atras || ""}
                  onChange={(e) =>
                    handleChange("carga_pres_atras", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setIsEditingParams(false)}
            className="px-3 py-1 text-gray-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveParams}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    );
  };

  if (!data && loading)
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80">
        <FaSpinner className="animate-spin text-4xl text-white" />
      </div>
    );
  if (!data) return null;

  const { producto, receta, historial, stats, versiones, specs = {} } = data;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 w-full max-w-4xl rounded-2xl border border-slate-600 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-6 bg-slate-900 border-b border-slate-700 flex justify-between items-start">
          <div className="flex gap-4">
            <div className="bg-blue-600/20 p-4 rounded-xl text-blue-400 border border-blue-500/30">
              <FaBoxOpen className="text-3xl" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">
                  {producto.nombre}
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${
                    producto.tipo_proceso === "INYECCION"
                      ? "bg-orange-900/50 text-orange-200 border-orange-500"
                      : "bg-blue-900/50 text-blue-200 border-blue-500"
                  }`}
                >
                  {producto.tipo_proceso || "ROTOMOLDEO"}
                </span>
              </div>
              <p className="text-gray-400 font-mono text-sm">
                {producto.codigo}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditingParams(!isEditingParams)}
              className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg flex items-center gap-2 font-bold text-sm transition-colors border border-slate-500"
              title="Configurar Parámetros de Máquina"
            >
              <FaCogs /> {isEditingParams ? "Cerrar Config" : "Configurar"}
            </button>
            <button
              onClick={imprimirFichaTecnica}
              className="bg-blue-700 hover:bg-blue-600 text-white p-3 rounded-lg flex items-center gap-2 font-bold text-sm transition-colors shadow-lg"
            >
              <FaPrint /> Imprimir PDF
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-3 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-800">
          {isEditingParams ? (
            renderEditForm()
          ) : (
            <>
              {/* TABS (SOLO SI NO ESTÁ EDITANDO) */}
              <div className="flex border-b border-slate-700 bg-slate-800/50 mb-4">
                <button
                  onClick={() => setActiveTab("RECETA")}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${
                    activeTab === "RECETA"
                      ? "text-blue-400 border-b-2 border-blue-400"
                      : "text-gray-500"
                  }`}
                >
                  <FaClipboardList /> Receta
                </button>
                <button
                  onClick={() => setActiveTab("HISTORIAL")}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${
                    activeTab === "HISTORIAL"
                      ? "text-purple-400 border-b-2 border-purple-400"
                      : "text-gray-500"
                  }`}
                >
                  <FaHistory /> Producción
                </button>
              </div>

              {activeTab === "RECETA" && (
                <table className="w-full text-left text-sm border-collapse mb-6">
                  <thead className="text-gray-400 border-b border-slate-700 text-xs uppercase">
                    <tr>
                      <th>Material</th>
                      <th className="text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {receta.map((i, k) => (
                      <tr key={k} className="hover:bg-slate-700/30">
                        <td className="py-2 text-white">
                          {i.nombre}{" "}
                          <span className="text-xs text-gray-500">
                            {i.codigo}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono text-yellow-300">
                          {Number(i.cantidad).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* VISTA RÁPIDA DE PARÁMETROS CARGADOS */}
              <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">
                  Resumen Técnico ({producto.tipo_proceso || "ROTOMOLDEO"})
                </h5>
                <p className="text-sm text-gray-300 italic">
                  {Object.keys(producto.parametros_maquina || {}).length > 0
                    ? "Parámetros de máquina configurados. Listos para imprimir en PDF."
                    : "⚠️ No hay parámetros de máquina configurados. El PDF saldrá vacío en esa sección."}
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ... (El resto del código del componente principal y auxiliares se mantiene igual)

function CalculadoraMinimosModal({ onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const cargarSugerencias = async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/ingenieria/sugerencias-stock-minimo`,
      );
      if (res.ok) setItems(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargarSugerencias();
  }, []);

  const generarPDFSugerencias = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString("es-AR");
    const hora = new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const colors = {
      header: [30, 41, 59],
      accent: [59, 130, 246],
      text: [255, 255, 255],
      tableHead: [71, 85, 105],
      tableAlt: [241, 245, 249],
    };

    doc.setFillColor(...colors.header);
    doc.rect(0, 0, 210, 40, "F");

    doc.setDrawColor(...colors.accent);
    doc.setLineWidth(1);
    doc.line(0, 40, 210, 40);

    doc.setTextColor(...colors.text);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE SUGERENCIAS DE STOCK MIN", 105, 20, {
      align: "center",
    });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("ANÁLISIS DE DEMANDA Y REPOSICIÓN", 105, 28, { align: "center" });

    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`FECHA: ${fecha} ${hora}`, 14, 35);
    doc.text(`BASE CÁLCULO: ÚLTIMOS 6 MESES`, 196, 35, { align: "right" });

    const tableBody = items.map((item) => [
      item.codigo,
      item.nombre,
      item.stock_actual,
      item.minimo_actual,
      item.sugerido,
      item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia,
    ]);

    autoTable(doc, {
      startY: 45,
      head: [
        [
          "CÓDIGO",
          "PRODUCTO",
          "STOCK ACTUAL",
          "MÍN. ACTUAL",
          "SUGERIDO",
          "AJUSTE",
        ],
      ],
      body: tableBody,
      theme: "striped",
      margin: { left: 5, right: 5 },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: "middle",
        lineColor: [200, 200, 200],
      },
      headStyles: {
        fillColor: colors.header,
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
        lineWidth: 0,
      },
      alternateRowStyles: {
        fillColor: colors.tableAlt,
      },
      columnStyles: {
        0: { fontStyle: "bold" },
        2: { halign: "center", fontStyle: "bold", textColor: [30, 58, 138] },
        3: { halign: "center", textColor: [100, 116, 139] },
        4: { halign: "center", fontStyle: "bold", textColor: [21, 128, 61] },
        5: { halign: "center", fontStyle: "bold" },
      },
      didParseCell: function (data) {
        if (data.column.index === 5) {
          const val = parseInt(data.cell.raw);
          if (val > 0) {
            data.cell.styles.textColor = [220, 38, 38];
          } else if (val < 0) {
            data.cell.styles.textColor = [37, 99, 235];
          } else {
            data.cell.styles.textColor = [150, 150, 150];
          }
        }
      },
    });

    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(100);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `Página ${i} de ${pageCount} — Generado automáticamente por Sistema de Gestión MRP`,
        105,
        290,
        { align: "center" },
      );
    }

    doc.save(`Sugerencias_Stock_${fecha.replace(/\//g, "-")}.pdf`);
  };

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const currentItems = items.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const goToPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800 w-full max-w-6xl rounded-2xl border border-slate-600 shadow-2xl flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-700 bg-slate-900 flex justify-between items-center rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FaMagic className="text-purple-400" /> Sugerencias de Stock
              Mínimo
            </h2>
            <p className="text-sm text-gray-400">
              Basado en la demanda real de los últimos 6 meses.
              <span className="block text-xs text-yellow-500 mt-1">
                * Actualiza estos valores en tu Excel y sincroniza para aplicar.
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!loading && items.length > 0 && (
              <button
                onClick={generarPDFSugerencias}
                className="flex items-center gap-2 px-3 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-bold shadow-lg transition-colors"
              >
                <FaFilePdf /> Exportar PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 hover:bg-slate-700 rounded-full transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-slate-800">
          {loading ? (
            <div className="p-10 text-center">
              <FaSpinner className="animate-spin text-3xl text-blue-500 mx-auto mb-2" />{" "}
              Calculando estadísticas...
            </div>
          ) : (
            <div className="min-w-full inline-block align-middle">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-700 text-gray-300 sticky top-0 z-10 text-xs uppercase shadow-sm">
                  <tr>
                    <th className="p-3">Producto</th>
                    <th className="p-3 text-center text-blue-300">
                      Stock Actual
                    </th>
                    <th className="p-3 text-center text-gray-400">
                      Mín. Actual
                    </th>
                    <th className="p-3 text-center text-yellow-300">
                      Sugerido (1 Mes)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {currentItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-700/40 transition-colors"
                    >
                      <td className="p-3">
                        <div className="font-bold text-white">
                          {item.nombre}
                        </div>
                        <div className="text-xs text-gray-500 font-mono bg-slate-900/50 px-1 rounded w-fit">
                          {item.codigo}
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono text-blue-300 font-bold">
                        {item.stock_actual}
                      </td>
                      <td className="p-3 text-center font-mono text-gray-500">
                        {item.minimo_actual}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`font-bold font-mono px-3 py-1 rounded ${
                            item.diferencia > 0
                              ? "bg-red-900/30 text-red-300 border border-red-900/50"
                              : "text-green-400"
                          }`}
                        >
                          {item.sugerido}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && items.length > 0 && (
          <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-between items-center rounded-b-2xl">
            <button
              onClick={goToPrev}
              disabled={currentPage === 1}
              className="p-2 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm font-bold px-4"
            >
              <FaChevronLeft /> Anterior
            </button>
            <span className="text-sm text-gray-400">
              Página <span className="text-white font-bold">{currentPage}</span>{" "}
              de {totalPages}
            </span>
            <button
              onClick={goToNext}
              disabled={currentPage === totalPages}
              className="p-2 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm font-bold px-4"
            >
              Siguiente <FaChevronRight />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function DraggableItem({ item, isOverlay, onVerFicha, onVerHistorial }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `source-${item.id}`, data: item, disabled: isOverlay });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0 : 1,
      }
    : undefined;
  const baseClasses =
    "p-3 mb-2 rounded border flex justify-between items-center touch-none transition-colors select-none";
  const overlayClasses =
    "bg-slate-600 border-blue-400 shadow-2xl scale-105 cursor-grabbing z-[9999]";
  const normalClasses =
    "bg-slate-700 border-slate-600 hover:bg-slate-600 cursor-grab hover:border-blue-400/50 group";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${baseClasses} ${isOverlay ? overlayClasses : normalClasses}`}
    >
      <div className="flex flex-col flex-1 min-w-0 mr-2">
        <p className="font-bold text-sm text-white font-mono">
          {item.codigo || "S/C"}
        </p>
        <p className="text-xs text-gray-300 truncate w-full">
          {item.nombre || "Sin Nombre"}
        </p>
      </div>

      {!isOverlay && (
        <div className="flex gap-1 mr-2">
          {onVerHistorial && (
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onVerHistorial(item);
              }}
              className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors"
              title="Ver Historial de Cambios"
            >
              <FaHistory />
            </button>
          )}

          {onVerFicha && (
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onVerFicha(item);
              }}
              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
              title="Ver Ficha Técnica"
            >
              <FaEye />
            </button>
          )}
        </div>
      )}

      <span
        className={`text-xs px-2 py-1 rounded font-bold ${
          item.stock_actual > 0
            ? "bg-blue-900/50 text-blue-200"
            : "bg-red-900/50 text-red-200"
        }`}
      >
        {item.stock_actual || 0}
      </span>
    </div>
  );
}

function DroppableArea({ items, onRemove, placeholderText, onCantidadChange }) {
  const { setNodeRef, isOver } = useDroppable({ id: "receta-droppable" });
  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-xl p-4 transition-all duration-200 overflow-y-auto min-h-[300px] flex-1 ${
        isOver
          ? "border-green-500 bg-green-900/10"
          : "border-slate-600 bg-slate-800/30"
      }`}
    >
      {items.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 select-none">
          <FaCubes
            className={`text-5xl mb-4 transition-transform ${
              isOver ? "scale-110 text-green-500" : "opacity-20"
            }`}
          />
          <p className="font-medium">
            {placeholderText || "Arrastra componentes aquí"}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((ing, idx) => (
            <li
              key={idx}
              className="bg-slate-700 p-3 rounded-lg flex justify-between items-center group border border-slate-600 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex items-center gap-3">
                <div
                  onClick={() => onCantidadChange && onCantidadChange(idx)}
                  className="bg-slate-800 h-8 w-8 flex items-center justify-center rounded font-bold text-green-400 border border-slate-600 text-sm cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Clic para editar cantidad"
                >
                  {ing.cantidad}x
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-medium text-sm">
                    {ing.nombre || "Sin Nombre"}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {ing.codigo || "S/C"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onRemove(idx)}
                className="text-gray-500 hover:text-red-400 p-2 transition-colors"
              >
                <FaTrash />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function IngenieriaProductos() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [semielaborados, setSemielaborados] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [modo, setModo] = useState("PRODUCTO");
  const [seleccionado, setSeleccionado] = useState(null);
  const [receta, setReceta] = useState([]);
  const [ultimaModificacion, setUltimaModificacion] = useState(null);
  const [filtroIzq, setFiltroIzq] = useState("");
  const [filtroDer, setFiltroDer] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);
  const [fichaSeleccionada, setFichaSeleccionada] = useState(null);
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [resPedidos, resRecetas, resSemis, resMP] = await Promise.all([
          authFetch(`${PEDIDOS_API_URL}?t=${Date.now()}`),
          authFetch(`${API_BASE_URL}/ingenieria/recetas/all`),
          authFetch(`${API_BASE_URL}/ingenieria/semielaborados`),
          authFetch(`${API_BASE_URL}/ingenieria/materias-primas`),
        ]);

        const dataPedidos = await resPedidos.json();
        const dataRecetas = await resRecetas.json();
        const setNombres = new Set();
        if (Array.isArray(dataPedidos)) {
          dataPedidos.forEach((r) => {
            const nombre = r.MODELO || r.Modelo || r.modelo;
            if (nombre) setNombres.add(nombre.toString().trim());
          });
        }
        if (dataRecetas) {
          Object.keys(dataRecetas).forEach((nombre) => {
            if (nombre) setNombres.add(nombre.trim());
          });
        }
        setProductos(Array.from(setNombres).sort());

        if (resSemis.ok) setSemielaborados(await resSemis.json());
        if (resMP.ok) setMateriasPrimas(await resMP.json());
      } catch (error) {
        console.error("❌ Error cargando datos iniciales:", error);
      }
    };
    cargarDatos();
  }, []);

  const cargarReceta = async (item) => {
    setSeleccionado(item);
    setReceta([]);
    setUltimaModificacion(null);

    let url = "";
    if (modo === "PRODUCTO")
      url = `${API_BASE_URL}/ingenieria/recetas/${encodeURIComponent(item)}`;
    else url = `${API_BASE_URL}/ingenieria/recetas-semielaborados/${item.id}`;

    try {
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setReceta(
          data.map((d) => ({
            ...d,
            cantidad: Number(d.cantidad) || 1,
            id: d.materia_prima_id || d.semielaborado_id,
          })),
        );
        if (data.length > 0 && data[0].fecha_receta)
          setUltimaModificacion(data[0].fecha_receta);
      }
    } catch (e) {
      console.error("Error cargando receta", e);
    }
  };

  const crearNuevoProducto = () => {
    if (modo !== "PRODUCTO" || !filtroIzq.trim()) return;
    const nuevoNombre = filtroIzq.trim().toUpperCase();
    setProductos((prev) => [...prev, nuevoNombre].sort());
    setSeleccionado(nuevoNombre);
    setReceta([]);
    setUltimaModificacion("Borrador (Nuevo)");
    setFiltroIzq("");
  };

  const guardar = async () => {
    if (!seleccionado) return;

    let nombreVersion = null;
    let endpoint = "";
    let body = {};
    const itemsToSave = receta.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      cantidad: r.cantidad,
    }));

    if (modo === "PRODUCTO") {
      endpoint = `${API_BASE_URL}/ingenieria/recetas`;
      body = { producto_terminado: seleccionado, items: itemsToSave };
    } else {
      const sugerencia = `Versión ${new Date().toLocaleDateString("es-AR")}`;
      nombreVersion = prompt(
        "Nombre para guardar esta receta en el historial:",
        sugerencia,
      );
      if (nombreVersion === null) return;

      endpoint = `${API_BASE_URL}/ingenieria/recetas-semielaborados`;
      body = {
        semielaborado_id: seleccionado.id,
        items: itemsToSave,
        nombre_version: nombreVersion,
      };
    }

    try {
      const r = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Error en servidor");
      setUltimaModificacion(new Date().toLocaleString("es-AR"));
      alert(
        modo === "PRODUCTO"
          ? "Receta guardada."
          : "✅ Receta guardada y archivada correctamente.",
      );
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };

  const syncStock = async () => {
    setLoading(true);
    try {
      const endpoint =
        modo === "PRODUCTO"
          ? `${API_BASE_URL}/ingenieria/sincronizar-stock`
          : `${API_BASE_URL}/ingenieria/sincronizar-mp`;

      const r = await authFetch(endpoint, { method: "POST" });
      if (!r.ok) throw new Error("Error del servidor");

      if (modo === "PRODUCTO") {
        const res = await authFetch(
          `${API_BASE_URL}/ingenieria/semielaborados`,
        );
        setSemielaborados(await res.json());
      } else {
        const res = await authFetch(
          `${API_BASE_URL}/ingenieria/materias-primas`,
        );
        setMateriasPrimas(await res.json());
      }
      alert(`Sincronización completada.`);
    } catch (e) {
      alert("Error sincronizando: " + e.message);
    }
    setLoading(false);
  };

  const handleDragEnd = (e) => {
    setActiveDragId(null);
    if (e.over && e.over.id === "receta-droppable") {
      const itemId = e.active.id.replace("source-", "");
      const listaOrigen = modo === "PRODUCTO" ? semielaborados : materiasPrimas;
      const itemData = listaOrigen.find((s) => s.id == itemId);

      if (itemData) {
        const defaultQty = modo === "PRODUCTO" ? "1" : "1.0";
        const cantidadStr = prompt(
          `Cantidad de "${itemData.nombre}" (${
            modo === "PRODUCTO" ? "Unidades" : "Kg/Unidad"
          }):`,
          defaultQty,
        );
        if (cantidadStr === null) return;
        const cantidad = Number(cantidadStr);
        if (isNaN(cantidad) || cantidad <= 0) {
          alert("Cantidad no válida.");
          return;
        }
        setReceta((prev) => [...prev, { ...itemData, cantidad: cantidad }]);
      }
    }
  };
  const handleDragStart = (e) => setActiveDragId(e.active.id);

  const handleCantidadChange = (indexToChange) => {
    const item = receta[indexToChange];
    const cantidadStr = prompt(
      `Modificar cantidad de "${item.nombre}":`,
      String(item.cantidad),
    );
    if (cantidadStr === null) return;
    const cantidad = Number(cantidadStr);
    if (isNaN(cantidad) || cantidad <= 0) return;
    setReceta((prev) =>
      prev.map((r, index) =>
        index === indexToChange ? { ...r, cantidad: cantidad } : r,
      ),
    );
  };

  let listaIzquierdaVisible = [];
  if (modo === "PRODUCTO") {
    listaIzquierdaVisible = productos.filter((p) =>
      (p || "").toLowerCase().includes(filtroIzq.toLowerCase()),
    );
  } else {
    listaIzquierdaVisible = semielaborados.filter(
      (s) =>
        (s.nombre || "").toLowerCase().includes(filtroIzq.toLowerCase()) ||
        (s.codigo || "").toLowerCase().includes(filtroIzq.toLowerCase()),
    );
  }

  const listaDerechaSource =
    modo === "PRODUCTO" ? semielaborados : materiasPrimas;
  const listaDerechaVisible = listaDerechaSource.filter(
    (i) =>
      (i.nombre || "").toLowerCase().includes(filtroDer.toLowerCase()) ||
      (i.codigo || "").toLowerCase().includes(filtroDer.toLowerCase()),
  );

  const activeItemData = activeDragId
    ? listaDerechaSource.find((s) => `source-${s.id}` === activeDragId)
    : null;

  const noCoincideNinguno =
    modo === "PRODUCTO" &&
    filtroIzq.length > 0 &&
    listaIzquierdaVisible.length === 0;
  const nombreSeleccionado =
    modo === "PRODUCTO"
      ? seleccionado
      : seleccionado?.nombre || "Selecciona un ítem";

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <AnimatePresence>
        {fichaSeleccionada && (
          <FichaTecnicaModal
            semiId={fichaSeleccionada.id}
            onClose={() => setFichaSeleccionada(null)}
          />
        )}
        {showCalculator && (
          <CalculadoraMinimosModal onClose={() => setShowCalculator(false)} />
        )}
      </AnimatePresence>

      <div className="flex flex-col h-[calc(100vh-100px)] min-h-[600px] gap-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <FaCogs className="text-gray-400" /> Ingeniería de Producto
            </h1>
            <p className="text-gray-400 text-sm">
              Define recetas:{" "}
              {modo === "PRODUCTO"
                ? "Producto Terminado → Semielaborados"
                : "Semielaborado → Materias Primas"}
            </p>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-600">
            <button
              onClick={() => {
                setModo("PRODUCTO");
                setSeleccionado(null);
                setReceta([]);
              }}
              className={`px-4 py-2 rounded-md font-bold flex items-center gap-2 transition-all ${
                modo === "PRODUCTO"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FaBoxOpen /> Productos
            </button>
            <button
              onClick={() => {
                setModo("SEMIELABORADO");
                setSeleccionado(null);
                setReceta([]);
              }}
              className={`px-4 py-2 rounded-md font-bold flex items-center gap-2 transition-all ${
                modo === "SEMIELABORADO"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FaRecycle /> Semielaborados
            </button>
          </div>

          <div className="flex gap-3">
            {modo === "SEMIELABORADO" && (
              <button
                onClick={() => setShowCalculator(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold flex items-center gap-2 shadow transition-all active:scale-95"
              >
                <FaCalculator /> Calc. Mínimos
              </button>
            )}
            <button
              onClick={syncStock}
              disabled={loading}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex items-center gap-2 shadow transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <FaSpinner className="animate-spin" />
              ) : (
                <FaDatabase />
              )}{" "}
              Sync
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
          <div className="col-span-3 bg-slate-800 rounded-xl flex flex-col border border-slate-700 overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-800 border-b border-slate-700 z-10">
              <h3
                className={`${
                  modo === "PRODUCTO" ? "text-blue-400" : "text-purple-400"
                } font-bold mb-2 flex items-center gap-2 text-sm uppercase`}
              >
                {modo === "PRODUCTO" ? <FaBoxOpen /> : <FaRecycle />}
                {modo === "PRODUCTO" ? "Productos Term." : "Semielaborados"}
              </h3>
              <input
                type="text"
                placeholder="Buscar para editar..."
                value={filtroIzq}
                onChange={(e) => setFiltroIzq(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-white"
              />
            </div>
            <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar flex-1">
              {noCoincideNinguno && (
                <div
                  onClick={crearNuevoProducto}
                  className="px-3 py-3 rounded-lg cursor-pointer text-sm border border-dashed border-green-500 text-green-400 hover:bg-green-900/20 hover:text-green-300 transition-all flex items-center gap-2 animate-in fade-in"
                >
                  <FaPlus /> Crear: "{filtroIzq.toUpperCase()}"
                </div>
              )}

              {listaIzquierdaVisible.length === 0 && !noCoincideNinguno ? (
                <div className="text-center text-gray-500 text-xs mt-4">
                  Sin coincidencias
                </div>
              ) : (
                listaIzquierdaVisible.map((item, i) => {
                  const key = modo === "PRODUCTO" ? i : item.id;
                  const label = modo === "PRODUCTO" ? item : item.nombre;
                  const isSelected =
                    modo === "PRODUCTO"
                      ? seleccionado === item
                      : seleccionado?.id === item.id;

                  return (
                    <div
                      key={key}
                      className={`px-3 py-3 rounded-lg cursor-pointer text-sm transition-all flex justify-between items-center group ${
                        isSelected
                          ? "bg-blue-600 text-white font-bold shadow"
                          : "text-gray-400 hover:bg-slate-700 hover:text-gray-200"
                      }`}
                      onClick={() => cargarReceta(item)}
                    >
                      <span className="truncate flex-1 mr-2">
                        {label || "Sin Nombre"}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const nombreParaUrl =
                              modo === "PRODUCTO" ? item : item.nombre;
                            navigate(
                              `/producto/${encodeURIComponent(nombreParaUrl)}`,
                            );
                          }}
                          className={`p-1.5 rounded hover:bg-white/20 transition-colors ${
                            isSelected
                              ? "text-white"
                              : "text-gray-500 hover:text-purple-400"
                          }`}
                          title="Ver Historial de Cambios"
                        >
                          <FaHistory />
                        </button>

                        {modo === "SEMIELABORADO" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFichaSeleccionada(item);
                            }}
                            className={`p-1.5 rounded hover:bg-white/20 transition-colors ${
                              isSelected
                                ? "text-white"
                                : "text-gray-500 hover:text-white"
                            }`}
                            title="Ver Ficha Técnica"
                          >
                            <FaEye />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="col-span-5 flex flex-col bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden shadow-lg relative">
            <div className="p-5 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FaTools className="text-gray-500" /> {nombreSeleccionado}
                </h2>
                {seleccionado && (
                  <p className="text-xs text-gray-400 mt-1">
                    {ultimaModificacion
                      ? `Última mod: ${ultimaModificacion}`
                      : "Sin receta definida"}
                  </p>
                )}
              </div>
              {seleccionado && (
                <button
                  onClick={guardar}
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 text-sm transition-transform active:scale-95"
                >
                  <FaSave /> Guardar
                </button>
              )}
            </div>
            <div className="p-4 flex flex-col overflow-hidden flex-1">
              {seleccionado ? (
                <>
                  <DroppableArea
                    items={receta}
                    onRemove={(idx) =>
                      setReceta((prev) => prev.filter((_, i) => i !== idx))
                    }
                    onCantidadChange={handleCantidadChange}
                    placeholderText={
                      modo === "PRODUCTO"
                        ? "Arrastra Semielaborados aquí"
                        : "Arrastra Materias Primas aquí"
                    }
                  />
                  <div className="mt-2 text-center">
                    <span className="text-xs text-gray-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                      {receta.length} componentes
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 text-sm italic opacity-50">
                  <FaArrowLeft className="text-3xl mb-2" />
                  Selecciona un ítem de la izquierda para editar su receta
                </div>
              )}
            </div>
          </div>

          <div className="col-span-4 bg-slate-800 rounded-xl flex flex-col border border-slate-700 overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-800 border-b border-slate-700 z-10">
              <h3
                className={`${
                  modo === "PRODUCTO" ? "text-purple-400" : "text-green-400"
                } font-bold mb-2 flex items-center gap-2 text-sm uppercase`}
              >
                {modo === "PRODUCTO" ? <FaRecycle /> : <FaLeaf />}
                {modo === "PRODUCTO"
                  ? "Semielaborados Disp."
                  : "Materias Primas Disp."}
              </h3>
              <input
                type="text"
                placeholder="Buscar componente..."
                value={filtroDer}
                onChange={(e) => setFiltroDer(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 text-white"
              />
            </div>
            <div className="overflow-y-auto p-2 bg-slate-800/50 custom-scrollbar flex-1">
              {listaDerechaVisible.length === 0 ? (
                <div className="text-center text-gray-500 text-xs mt-4">
                  Sin resultados
                </div>
              ) : (
                listaDerechaVisible.map((s) => (
                  <DraggableItem
                    key={s.id}
                    item={s}
                    isOverlay={false}
                    onVerFicha={
                      modo === "PRODUCTO" ? setFichaSeleccionada : null
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeItemData ? (
          <DraggableItem item={activeItemData} isOverlay={true} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
