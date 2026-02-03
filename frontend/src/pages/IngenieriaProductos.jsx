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
  FaFire,
  FaClock,
} from "react-icons/fa";
import { API_BASE_URL, PEDIDOS_API_URL, authFetch } from "../utils.js";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// --- COMPONENTE INPUT FUERA DE LA FUNCIÓN PRINCIPAL ---
const MetricInput = ({ value, onChange, placeholder, className = "" }) => (
  <input
    type="text"
    className={`w-full bg-slate-950 border border-slate-700 text-white rounded px-2 py-1.5 text-center text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder-gray-700 ${className}`}
    value={value || ""}
    onChange={onChange}
    placeholder={placeholder || "-"}
  />
);

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

  // --- GENERAR PDF "SINGLE PAGE" PROLIJO Y AIREADO ---
  const imprimirFichaTecnica = () => {
    if (!data) return;
    const { producto, receta, specs = {}, ultima_version_receta } = data;
    const { tipo_proceso, parametros_maquina: pm } = producto;

    const doc = new jsPDF();
    const azulOscuro = [30, 41, 59];
    const grisClaro = [241, 245, 249];
    const rojoAlerta = [185, 28, 28];

    // --- 1. ENCABEZADO (24mm - Más alto) ---
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

    // --- LEYENDA AUTORIZACIÓN ---
    doc.text("Documento Controlado", 195, 13, { align: "right" });
    doc.setFont("helvetica", "italic");
    doc.text("Autorizado por: Jefe de Producción", 195, 18, { align: "right" });

    let yPos = 34;

    // --- 2. INFO PRODUCTO Y VERSIÓN ---
    doc.setTextColor(0, 0, 0);

    // Columna Izq: Datos Producto
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${producto.nombre}`, 14, yPos);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`CÓDIGO: ${producto.codigo}`, 14, yPos + 6);

    // Columna Der: Versión Receta (Caja Gris con más padding)
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

    // --- 3. SPECS VISUALES (Tabla con más padding) ---
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
      // cellPadding: 3 para dar aire
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

    yPos = doc.lastAutoTable.finalY + 12; // Mucho aire antes del bloque central

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
    doc.rect(colLeftX, yPos, colWidthLeft, 7, "F"); // Header más alto (7mm)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(
      `PARÁMETROS ${tipo_proceso === "INYECCION" ? "INYECCIÓN" : "ROTOMOLDEO"}`,
      colLeftX + 3,
      yPos + 4.5,
    );

    let yMachine = yPos + 8; // Empezamos la tabla más abajo del header

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
        headStyles: { fillColor: [80, 80, 80], fontSize: 8, cellPadding: 2 },
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
      yMachine += 5; // Más espacio entre líneas

      doc.setFont("helvetica", "bold");
      doc.text("CHILLER:", colLeftX, yMachine);
      doc.setFont("helvetica", "normal");
      doc.text(pm.chiller_matriz || "-", colLeftX + 30, yMachine);
      yMachine += 6;

      // --- ARREGLO CUADRADO GRIS: TABLA LIMPIA ---
      // Simplemente una tabla estándar con header normal, sin rectángulos manuales
      autoTable(doc, {
        startY: yMachine,
        head: [["CARGA / SUCCIÓN #5", "Pos", "Pres", "Vel", "P. Atrás"]],
        body: [
          [
            "", // Columna 1 vacía intencional pero sin ocultarla con width 0.1
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
        columnStyles: { 0: { cellWidth: 5, fillColor: [240, 240, 240] } }, // Pequeña columna gris visual
        margin: { left: colLeftX },
        tableWidth: colWidthLeft,
      });
      yMachine = doc.lastAutoTable.finalY;
    } else {
      // --- ROTOMOLDEO (FIX VARIABLES) ---
      // AQUI ESTABA EL ERROR: Usar las claves correctas para etapas 3 y 4
      const rotoData = [
        ["1", pm.t1 || "-", pm.v1m1 || "-", pm.v2m1 || "-", pm.inv1 || "-"],
        ["2", pm.t2 || "-", pm.v1m2 || "-", pm.v2m2 || "-", pm.inv2 || "-"],
        // CORREGIDO: pm.v1m3 y pm.v2m3
        ["3", pm.t3 || "-", pm.v1m3 || "-", pm.v2m3 || "-", pm.inv3 || "-"],
        // CORREGIDO: pm.v1m4 y pm.v2m4
        ["4", pm.t4 || "-", pm.v1m4 || "-", pm.v2m4 || "-", pm.inv4 || "-"],
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
        headStyles: { fillColor: [80, 80, 80], fontSize: 8, cellPadding: 2 },
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
        headStyles: { fillColor: [100, 100, 100], fontSize: 7, cellPadding: 2 },
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

    // DERECHA: RECETA
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
      // Padding 2 para legibilidad
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      margin: { left: colRightX },
      tableWidth: colWidthRight,
    });
    yRecipe = doc.lastAutoTable.finalY;

    // SINCRONIZAR Y (El mayor de los dos bloques + margen grande)
    yPos = Math.max(yMachine, yRecipe) + 12;

    // ============================================================
    //    BLOQUE INFERIOR: PROCEDIMIENTO Y PROBLEMAS
    // ============================================================

    // --- PROCEDIMIENTO ---
    // Si queda poco espacio, forzamos salto
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

    // **INTERLINEADO AMPLIO (1.8)**
    doc.setLineHeightFactor(1.8);

    let textoProcedimiento = "";
    if (tipo_proceso === "INYECCION") {
      textoProcedimiento = `Se separa el material correspondiente con la matriz colocada, bajo supervisión del ENCARGADO DE PLANTA. Se selecciona en la librería el modelo a fabricar (constatando parámetros). Se procede a calentar la Inyectora; la temperatura alcanzará el set-point en el tiempo determinado.\nCualquier problema con el proceso o finalización, acudir al Encargado de Planta. En caso de no encontrarse en ese momento, dejar el artículo identificado y separado correctamente para su posterior análisis y evaluación.`;
    } else {
      textoProcedimiento = `Identificar material indicado por ENCARGADO. En el horno, con matriz colocada y modelo seleccionado, posicionar matriz horizontal (carga). Aplicar desmoldante si requiere. Pesar cantidad declarada en ficha y trasladar. Verter material parejo dentro de la matriz. Colocar respirador limpio. Cerrar tapa y trabas. Repetir proceso.\nCualquier problema con el proceso o finalización, acudir al Encargado de Planta. En caso de no encontrarse en ese momento, dejar el artículo identificado y separado correctamente para su posterior análisis y evaluación.`;
    }

    const splitText = doc.splitTextToSize(textoProcedimiento, 182);
    doc.text(splitText, 14, yPos);

    // Calculamos espacio usado con el interlineado 1.8 (aprox 6mm por linea)
    yPos += splitText.length * 6 + 10;

    doc.setLineHeightFactor(1.15); // Reset a normal

    // --- SOLUCIÓN DE PROBLEMAS ---
    // Si nos pasamos de la hoja, forzamos tope o nueva pag
    if (yPos > 230) {
      // Si hay muy poco espacio, nueva pagina. Si hay algo, ajustamos.
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
    }

    let problemas = [];
    if (tipo_proceso === "INYECCION") {
      problemas = [
        ["Agujereada", "Regulación carga/aire/presión"],
        ["Manchada", "Avisar y esperar limpieza color. Anotar."],
        ["Doblada", "Darle más enfriado"],
        ["Quemada", "Consultar temperaturas"],
      ];
    } else {
      problemas = [
        ["Cruda", "Subir cocinado (max 2 min)"],
        ["Quemada", "Bajar cocinado (max 2 min)"],
        ["Doblada", "Revisar silicona / Temp"],
        ["Incompleta", "Revisar respiradores/cierres"],
      ];
    }

    // Calculamos altura caja generosa
    const problemRowHeight = 12; // Altura de fila grande
    const problemHeaderHeight = 7;
    const problemBoxHeight =
      problemHeaderHeight +
      Math.ceil(problemas.length / 2) * problemRowHeight +
      5;

    // Header Caja
    doc.setFillColor(...rojoAlerta);
    doc.rect(14, yPos, 182, 7, "F");

    // Borde Caja
    doc.setDrawColor(...rojoAlerta);
    doc.setLineWidth(0.5);
    doc.rect(14, yPos, 182, problemBoxHeight);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("SOLUCIÓN DE PROBLEMAS FRECUENTES", 105, yPos + 4.5, {
      align: "center",
    });

    yPos += 14; // Margen interno superior generoso
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);

    // Grid de Problemas con mucho aire vertical
    problemas.forEach(([problema, solucion], i) => {
      const xOffset = i % 2 === 0 ? 20 : 110;
      const yOffset = yPos + Math.floor(i / 2) * problemRowHeight;

      doc.setFont("helvetica", "bold");
      doc.text(`• ${problema}:`, xOffset, yOffset);
      doc.setFont("helvetica", "normal");
      doc.text(`${solucion}`, xOffset, yOffset + 4);
    });

    // Disclaimer final (FUERA DE LA CAJA O AL PIE DE ELLA)
    // Calculamos posición segura debajo de la caja
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
      <div className="bg-slate-800/80 p-5 rounded-xl mt-4 border border-slate-700 shadow-2xl animate-in fade-in">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
              <FaCogs size={20} />
            </div>
            <div>
              <h4 className="text-white font-bold text-base">
                Parámetros de Proceso
              </h4>
              <p className="text-xs text-gray-400">
                Configuración técnica de la maquinaria
              </p>
            </div>
          </div>

          <div className="relative">
            <select
              value={editForm.tipo_proceso}
              onChange={(e) =>
                setEditForm({ ...editForm, tipo_proceso: e.target.value })
              }
              className="appearance-none bg-slate-900 text-white py-2 pl-4 pr-10 rounded-lg border border-slate-600 text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-slate-500 transition-colors"
            >
              <option value="ROTOMOLDEO">Rotomoldeo</option>
              <option value="INYECCION">Inyección</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
              <FaChevronLeft className="-rotate-90 text-xs" />
            </div>
          </div>
        </div>

        {isRot ? (
          /* ==================== ROTOMOLDEO ==================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
              <div className="bg-slate-900 p-2 border-b border-slate-700">
                <h5 className="text-xs font-bold text-gray-400 uppercase text-center tracking-widest">
                  Ciclo de Cocción
                </h5>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-[10px] uppercase">
                    <th className="p-2 font-bold text-left pl-4">Variable</th>
                    <th className="p-2 text-center w-20 bg-slate-800/30">
                      Etapa 1
                    </th>
                    <th className="p-2 text-center w-20">Etapa 2</th>
                    <th className="p-2 text-center w-20 bg-slate-800/30">
                      Etapa 3
                    </th>
                    <th className="p-2 text-center w-20">Etapa 4</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="p-2 pl-4 text-blue-300 font-bold text-xs">
                      Tiempo (min)
                    </td>
                    {[1, 2, 3, 4].map((i) => (
                      <td
                        key={i}
                        className={`p-1.5 ${i % 2 !== 0 ? "bg-slate-800/30" : ""}`}
                      >
                        <MetricInput
                          value={pm[`t${i}`]}
                          onChange={(e) =>
                            handleChange(`t${i}`, e.target.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-2 pl-4 text-gray-400 text-xs">
                      Vel. M1 (%)
                    </td>
                    {[1, 2, 3, 4].map((i) => (
                      <td
                        key={i}
                        className={`p-1.5 ${i % 2 !== 0 ? "bg-slate-800/30" : ""}`}
                      >
                        <MetricInput
                          value={pm[`v1m${i}`]}
                          onChange={(e) =>
                            handleChange(`v1m${i}`, e.target.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-2 pl-4 text-gray-400 text-xs">
                      Vel. M2 (%)
                    </td>
                    {[1, 2, 3, 4].map((i) => (
                      <td
                        key={i}
                        className={`p-1.5 ${i % 2 !== 0 ? "bg-slate-800/30" : ""}`}
                      >
                        <MetricInput
                          value={pm[`v2m${i}`]}
                          onChange={(e) =>
                            handleChange(`v2m${i}`, e.target.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-2 pl-4 text-gray-400 text-xs">
                      Inversión (%)
                    </td>
                    {[1, 2, 3, 4].map((i) => (
                      <td
                        key={i}
                        className={`p-1.5 ${i % 2 !== 0 ? "bg-slate-800/30" : ""}`}
                      >
                        <MetricInput
                          value={pm[`inv${i}`]}
                          onChange={(e) =>
                            handleChange(`inv${i}`, e.target.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <label className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                  <FaFire /> Temperatura Horno
                </label>
                <div className="flex items-center gap-2">
                  <MetricInput
                    value={pm.temp_horno}
                    onChange={(e) => handleChange("temp_horno", e.target.value)}
                    className="text-xl font-bold text-orange-200"
                    placeholder="0"
                  />
                  <span className="text-gray-500 font-bold">°C</span>
                </div>
              </div>

              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                  <FaClock /> Enfriamiento
                </label>
                <div className="flex items-center gap-2 mb-3">
                  <MetricInput
                    value={pm.frio_min}
                    onChange={(e) => handleChange("frio_min", e.target.value)}
                    placeholder="0"
                  />
                  <span className="text-gray-500 text-xs w-10">Min.</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-[9px] text-gray-500 uppercase block mb-1">
                      Inicio Aire
                    </span>
                    <MetricInput
                      value={pm.inicio_aire}
                      onChange={(e) =>
                        handleChange("inicio_aire", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 uppercase block mb-1">
                      Fin Aire
                    </span>
                    <MetricInput
                      value={pm.fin_aire}
                      onChange={(e) => handleChange("fin_aire", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ==================== INYECCIÓN ==================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                <h5 className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                  Perfil de Inyección
                </h5>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                </div>
              </div>
              <div className="p-1">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase">
                      <th className="py-2 w-8">#</th>
                      <th className="py-2 text-blue-300">
                        Posición{" "}
                        <span className="normal-case opacity-50">(mm)</span>
                      </th>
                      <th className="py-2 text-green-300">
                        Presión{" "}
                        <span className="normal-case opacity-50">(bar)</span>
                      </th>
                      <th className="py-2 text-purple-300">
                        Velocidad{" "}
                        <span className="normal-case opacity-50">(%)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <tr key={i} className="group">
                        <td className="p-1 text-center font-bold text-gray-600 text-xs font-mono group-hover:text-white transition-colors">
                          {i}
                        </td>
                        <td className="p-1">
                          <MetricInput
                            value={pm[`pos${i}`]}
                            onChange={(e) =>
                              handleChange(`pos${i}`, e.target.value)
                            }
                            className="border-slate-800 bg-slate-900 group-hover:border-blue-500/50"
                          />
                        </td>
                        <td className="p-1">
                          <MetricInput
                            value={pm[`pres${i}`]}
                            onChange={(e) =>
                              handleChange(`pres${i}`, e.target.value)
                            }
                            className="border-slate-800 bg-slate-900 group-hover:border-green-500/50"
                          />
                        </td>
                        <td className="p-1">
                          <MetricInput
                            value={pm[`vel${i}`]}
                            onChange={(e) =>
                              handleChange(`vel${i}`, e.target.value)
                            }
                            className="border-slate-800 bg-slate-900 group-hover:border-purple-500/50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 text-orange-500">
                  <FaFire size={40} />
                </div>
                <label className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2 block">
                  Temperaturas de Zona
                </label>
                <textarea
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 text-orange-100 rounded p-3 text-sm font-mono focus:border-orange-500 focus:outline-none placeholder-gray-800 resize-none"
                  placeholder="Ej: 180 / 175 / 170 / 165 / 160"
                  value={pm.temperaturas_zonas || ""}
                  onChange={(e) =>
                    handleChange("temperaturas_zonas", e.target.value)
                  }
                />
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-400 uppercase">
                    Chiller Matriz
                  </span>
                  <div className="w-24">
                    <MetricInput
                      value={pm.chiller_matriz}
                      onChange={(e) =>
                        handleChange("chiller_matriz", e.target.value)
                      }
                      placeholder="°C"
                      className="text-right text-blue-200"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg border border-slate-600 overflow-hidden shadow-inner">
                <div className="bg-slate-700 px-3 py-1.5 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    Carga / Succión (Pos #5)
                  </span>
                  <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
                </div>
                <div className="p-3 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase block mb-1">
                      Posición
                    </span>
                    <MetricInput
                      value={pm.carga_pos}
                      onChange={(e) =>
                        handleChange("carga_pos", e.target.value)
                      }
                      className="border-slate-600"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase block mb-1">
                      Presión
                    </span>
                    <MetricInput
                      value={pm.carga_pres}
                      onChange={(e) =>
                        handleChange("carga_pres", e.target.value)
                      }
                      className="border-slate-600"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase block mb-1">
                      Velocidad
                    </span>
                    <MetricInput
                      value={pm.carga_vel}
                      onChange={(e) =>
                        handleChange("carga_vel", e.target.value)
                      }
                      className="border-slate-600"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase block mb-1">
                      P. Atrás
                    </span>
                    <MetricInput
                      value={pm.carga_pres_atras}
                      onChange={(e) =>
                        handleChange("carga_pres_atras", e.target.value)
                      }
                      className="border-slate-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700/50">
          <button
            onClick={() => setIsEditingParams(false)}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveParams}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-transform active:scale-95 text-xs font-bold uppercase tracking-wider"
          >
            <FaSave /> Guardar Parámetros
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
                  className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${producto.tipo_proceso === "INYECCION" ? "bg-orange-900/50 text-orange-200 border-orange-500" : "bg-blue-900/50 text-blue-200 border-blue-500"}`}
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
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === "RECETA" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-500"}`}
                >
                  <FaClipboardList /> Receta
                </button>
                <button
                  onClick={() => setActiveTab("HISTORIAL")}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === "HISTORIAL" ? "text-purple-400 border-b-2 border-purple-400" : "text-gray-500"}`}
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

// ... (El resto del código como Calculadora, Draggable, Droppable y Principal se mantienen IGUAL)
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
      // HEADER CORTO Y SIN SALTOS
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
      // MÁRGENES MÍNIMOS PARA ANCHO TOTAL
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
        // Al quitar los anchos fijos en la mayoría, se adaptarán al 100%
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
        className="bg-slate-800 w-full max-w-6xl rounded-2xl border border-slate-600 shadow-2xl flex flex-col max-h-[95vh]" // Mantiene el diseño ancho en pantalla también
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
          {/* NUEVO: Botón de Historial */}
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

          {/* Botón Ficha Técnica */}
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

// --- COMPONENTE PRINCIPAL ---
export default function IngenieriaProductos() {
  const navigate = useNavigate(); // <--- 2. IMPORTANTE: Inicializamos el hook
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
          {/* COLUMNA IZQUIERDA */}
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
                        {/* BOTÓN HISTORIAL (Hoja de Vida) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Obtenemos el nombre limpio sea Producto o Semielaborado
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

                        {/* BOTÓN FICHA TÉCNICA (Solo Semielaborados) */}
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

          {/* COLUMNA CENTRAL */}
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

          {/* COLUMNA DERECHA */}
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
