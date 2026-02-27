import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
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
  FaCalculator,
  FaMagic,
  FaChevronLeft,
  FaChevronRight,
  FaFilePdf,
  FaCogs,
  FaPrint,
  FaFire,
  FaClock,
  FaLayerGroup,
  FaImage,
  FaTrashAlt,
  FaPlusCircle,
  FaCalendarCheck,
  FaUserTie,
  FaQuestionCircle,
  FaArrowLeft,
  FaGripVertical,
  FaFolderOpen,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCheck,
  FaEllipsisV,
  FaEdit,
  FaUpload,
  FaSearch,
} from "react-icons/fa";
import { API_BASE_URL, PEDIDOS_API_URL, authFetch } from "../utils.js";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// --- HELPERS ---
const parseDateStr = (str) => {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
};

const formatDateForInput = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekNumber = (d) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};

const getDaysAgo = (dateStr) => {
  const d = parseDateStr(dateStr);
  if (!d) return "-";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffTime = now.getTime() - d.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return `Hace ${diffDays} días`;
};

// HELPER PARA FILTRAR "SIN NOMBRE"
const isValidName = (name) => {
  if (!name) return false;
  const tName = name.trim().toLowerCase();
  return tName !== "" && tName !== "sin nombre";
};

// HELPER DE MONEDA PARA COSTOS
const formatCurrency = (num) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num || 0);
};

// --- COMPONENTE INPUT ESTILIZADO ---
const MetricInput = ({ value, onChange, placeholder, className = "" }) => (
  <input
    type="text"
    className={`w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-center text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder-slate-300 shadow-sm ${className}`}
    value={value || ""}
    onChange={onChange}
    placeholder={placeholder || "-"}
  />
);

// --- COMPONENTE: GESTOR DE VARIANTES ---
function GestorVariantesModal({ producto, onClose, onSave, showToast }) {
  const [variantes, setVariantes] = useState(producto.variantes || []);
  const [nuevaVariante, setNuevaVariante] = useState({
    nombre: "",
    especificaciones: "",
    fotos: ["", "", ""],
  });

  const handleAddFoto = (idx, url) => {
    const f = [...nuevaVariante.fotos];
    f[idx] = url;
    setNuevaVariante({ ...nuevaVariante, fotos: f });
  };

  const agregarVariante = () => {
    if (!nuevaVariante.nombre.trim())
      return showToast("El nombre de la variante es obligatorio.", "error");
    const varianteFinal = {
      ...nuevaVariante,
      id: Date.now(),
      fotos: nuevaVariante.fotos,
    };
    setVariantes([...variantes, varianteFinal]);
    setNuevaVariante({ nombre: "", especificaciones: "", fotos: ["", "", ""] });
    showToast("Variante agregada a la lista local.", "success");
  };

  const borrarVariante = (id) => {
    if (confirm("¿Seguro que deseas eliminar esta variante de terminación?")) {
      setVariantes(variantes.filter((v) => v.id !== id));
      showToast("Variante eliminada.", "success");
    }
  };

  const guardarCambios = () => {
    onSave(producto.id, variantes);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-full max-w-5xl rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FaLayerGroup className="text-blue-500" /> Variantes de
              Terminación
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1 uppercase">
              Configuración para:{" "}
              <span className="text-slate-800 font-bold">
                {producto.nombre}
              </span>{" "}
              ({producto.codigo})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2.5 rounded-full transition-colors border border-transparent hover:border-slate-200 shadow-sm"
          >
            <FaTimes size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#f8fafc]">
          <div className="w-full md:w-1/3 border-r border-slate-200 bg-white p-6 overflow-y-auto custom-scrollbar">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FaClipboardList /> Variantes Definidas ({variantes.length})
            </h4>
            {variantes.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm font-medium bg-slate-50 uppercase">
                No hay variantes configuradas.
                <br />
                Crea una a la derecha.
              </div>
            ) : (
              <div className="space-y-3">
                {variantes.map((v) => (
                  <div
                    key={v.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-start group hover:border-blue-300 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-bold text-slate-800 text-sm truncate uppercase">
                        {v.nombre}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-2 uppercase">
                        {v.especificaciones || "SIN ESPECIFICACIONES."}
                      </div>
                      <div className="mt-3 flex gap-2">
                        {v.fotos &&
                          v.fotos.map((f, i) =>
                            f ? (
                              <div
                                key={i}
                                className="w-10 h-10 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-sm"
                              >
                                <img
                                  src={f}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : null,
                          )}
                      </div>
                    </div>
                    <button
                      onClick={() => borrarVariante(v.id)}
                      className="text-slate-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <FaTrashAlt />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="w-full md:w-2/3 p-8 overflow-y-auto custom-scrollbar">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-5 flex items-center gap-2">
                <FaPlusCircle /> Nueva Definición
              </h4>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Nombre de la Variante
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-transparent rounded-xl p-3.5 text-sm text-slate-800 font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder-slate-400 uppercase"
                    value={nuevaVariante.nombre}
                    onChange={(e) =>
                      setNuevaVariante({
                        ...nuevaVariante,
                        nombre: e.target.value,
                      })
                    }
                    placeholder="EJ: PREMIUM DOBLE CARA..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Especificaciones Técnicas / Instrucción de Armado
                  </label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-50 border border-transparent rounded-xl p-3.5 text-slate-700 text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none resize-none transition-all placeholder-slate-400 uppercase"
                    value={nuevaVariante.especificaciones}
                    onChange={(e) =>
                      setNuevaVariante({
                        ...nuevaVariante,
                        especificaciones: e.target.value,
                      })
                    }
                    placeholder="DESCRIBA DETALLADAMENTE..."
                  />
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex justify-between items-center">
                    <span>Fotos de Referencia (Estándar Visual)</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200">
                      MÁX 3 FOTOS
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="aspect-square bg-white rounded-2xl border border-slate-200 shadow-sm relative flex items-center justify-center overflow-hidden group hover:border-blue-400 transition-colors"
                      >
                        {nuevaVariante.fotos[i] ? (
                          <>
                            <img
                              src={nuevaVariante.fotos[i]}
                              className="w-full h-full object-cover"
                              alt="preview"
                            />
                            <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                              <button
                                onClick={() => handleAddFoto(i, "")}
                                className="text-white bg-red-500 p-3 rounded-full hover:bg-red-600 hover:scale-110 transition-all shadow-lg"
                              >
                                <FaTrashAlt size={14} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              const u = prompt("Pegue la URL de la imagen:");
                              if (u) handleAddFoto(i, u);
                            }}
                            className="text-slate-400 hover:text-blue-500 flex flex-col items-center gap-2 w-full h-full justify-center transition-colors"
                          >
                            <FaImage size={24} />
                            <span className="text-xs font-bold uppercase">
                              Subir URL
                            </span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={agregarVariante}
                    className="bg-white border border-slate-200 hover:bg-slate-50 text-blue-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 text-sm uppercase tracking-wider"
                  >
                    <FaPlus /> Agregar a la Lista
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 rounded-b-3xl shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors rounded-xl hover:bg-slate-50 uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            onClick={guardarCambios}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-blue-200 transition-all flex items-center gap-2 active:scale-95 text-sm uppercase tracking-wider"
          >
            <FaSave /> Guardar Configuración
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- SUB-COMPONENTE: MODAL FICHA TÉCNICA AVANZADO ---
function FichaTecnicaModal({ semiId, onClose, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("RECETA");

  // Extraemos variables del form
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
          tipo_proceso: jsonData.producto?.tipo_proceso || "ROTOMOLDEO",
          parametros_maquina: jsonData.producto?.parametros_maquina || {},
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
      showToast("Datos técnicos actualizados.", "success");
      fetchData();
    } catch (e) {
      showToast("Error al guardar parámetros.", "error");
    }
  };

  const imprimirFichaTecnica = () => {
    if (!data) return;
    const { producto, receta, specs = {}, ultima_version_receta } = data;
    const { tipo_proceso, parametros_maquina: pm } = producto;

    const doc = new jsPDF();
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
    doc.text("Documento Controlado", 195, 13, { align: "right" });
    doc.setFont("helvetica", "italic");
    doc.text("Autorizado por: Jefe de Producción", 195, 18, { align: "right" });

    let yPos = 34;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${producto.nombre.toUpperCase()}`, 14, yPos);
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
      ultima_version_receta?.nombre_version?.toUpperCase() ||
        "ESTÁNDAR / INICIAL",
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
    const colLeftX = 14,
      colRightX = 115,
      colWidthLeft = 95,
      colWidthRight = 80;
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
      yMachine += 5;
      doc.setFont("helvetica", "bold");
      doc.text("CHILLER:", colLeftX, yMachine);
      doc.setFont("helvetica", "normal");
      doc.text(pm.chiller_matriz || "-", colLeftX + 30, yMachine);
      yMachine += 6;
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
          fillColor: [50, 50, 50],
          textColor: 255,
          fontSize: 7,
          halign: "center",
        },
        styles: { fontSize: 8, halign: "center", cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 5, fillColor: [240, 240, 240] } },
        margin: { left: colLeftX },
        tableWidth: colWidthLeft,
      });
      yMachine = doc.lastAutoTable.finalY;
    } else {
      const rotoData = [
        ["1", pm.t1 || "-", pm.v1m1 || "-", pm.v2m1 || "-", pm.inv1 || "-"],
        ["2", pm.t2 || "-", pm.v1m2 || "-", pm.v2m2 || "-", pm.inv2 || "-"],
        ["3", pm.t3 || "-", pm.v1m3 || "-", pm.v2m3 || "-", pm.inv3 || "-"],
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
    doc.setFillColor(...azulOscuro);
    doc.rect(colRightX, startYBlock, colWidthRight, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("INGENIERÍA (RECETA)", colRightX + 3, startYBlock + 4.5);
    let yRecipe = startYBlock + 8;
    const tablaReceta = receta.map((item) => [
      item.nombre.toUpperCase(),
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
        ? `Se separa el material correspondiente con la matriz colocada, bajo supervisión del ENCARGADO DE PLANTA. Se selecciona en la librería el modelo a fabricar...`
        : `Identificar material indicado por ENCARGADO. En el horno, con matriz colocada y modelo seleccionado, posicionar matriz horizontal (carga)...`;
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
    const problemBoxHeight = 7 + Math.ceil(problemas.length / 2) * 12 + 5;
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
      const yOffset = yPos + Math.floor(i / 2) * 12;
      doc.setFont("helvetica", "bold");
      doc.text(`• ${problema}:`, xOffset, yOffset);
      doc.setFont("helvetica", "normal");
      doc.text(`${solucion}`, xOffset, yOffset + 4);
    });
    const footerY = yPos + Math.ceil(problemas.length / 2) * 12 + 10;
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
    showToast("PDF Exportado", "success");
  };

  const renderRecetaTab = () => {
    const { receta, producto, stats } = data;
    const isConfigured =
      Object.keys(producto?.parametros_maquina || {}).length > 0;

    // Cálculos rápidos para los KPIs
    const stockActual = Number(producto?.stock_actual || 0);
    const minimoActual = Number(producto?.alerta_1 || 0);
    const stockStatus =
      stockActual > minimoActual
        ? "Óptimo"
        : stockActual === 0
          ? "Crítico"
          : "Bajo";
    const stockColor =
      stockActual > minimoActual
        ? "text-emerald-600 bg-emerald-50 border-emerald-200"
        : stockActual === 0
          ? "text-rose-600 bg-rose-50 border-rose-200"
          : "text-orange-600 bg-orange-50 border-orange-200";

    return (
      <div className="flex flex-col gap-6 animate-in fade-in">
        {/* FILA 1: KPIs Rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Stock Disponible
            </span>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-black text-slate-800 leading-none">
                {stockActual}
              </span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border shadow-sm mb-1 ${stockColor}`}
              >
                {stockStatus}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
              <div
                className={`h-full ${stockActual > minimoActual ? "bg-emerald-400" : "bg-rose-400"}`}
                style={{
                  width: `${Math.min((stockActual / (minimoActual || 1)) * 100, 100)}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Mínimo Requerido
            </span>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-black text-slate-800 leading-none">
                {minimoActual}
              </span>
              <span className="text-xs font-semibold text-slate-400 mb-0.5">
                unidades
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-4 uppercase tracking-wider flex items-center gap-1">
              <FaHistory /> Según última actualización
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Rendimiento Lote Prom.
            </span>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-black text-blue-600 leading-none">
                {stats?.promedio_lote
                  ? Number(stats.promedio_lote).toFixed(0)
                  : "N/D"}
              </span>
              <span className="text-xs font-semibold text-slate-400 mb-0.5">
                unidades
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-4 uppercase tracking-wider flex items-center gap-1">
              <FaTools /> Total histórico: {stats?.total_historico || 0}
            </p>
          </div>
        </div>

        {/* FILA 2: Receta y Estado de Máquina */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <FaClipboardList className="text-blue-500 text-lg" />
                  <h3 className="font-semibold text-slate-700 text-[11px] uppercase tracking-widest">
                    Componentes de la Receta
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-md border border-slate-200 shadow-sm">
                  {receta.length} Insumos
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <table className="w-full text-left">
                  <thead className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Insumo / Componente</th>
                      <th className="px-4 py-3 text-right">
                        Cantidad Requerida
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {receta.map((i, k) => (
                      <tr
                        key={k}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-800 uppercase text-sm">
                            {i.nombre}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 tracking-widest uppercase mt-1">
                            {i.codigo}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="bg-blue-50 text-blue-700 font-bold font-mono text-sm px-3.5 py-1.5 rounded-lg border border-blue-100 shadow-sm inline-block min-w-[60px] text-center">
                            {Number(i.cantidad).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {receta.length === 0 && (
                      <tr>
                        <td
                          colSpan="2"
                          className="px-6 py-14 text-center text-slate-400 text-[11px] font-semibold uppercase tracking-wider bg-slate-50/30 m-4 rounded-xl border border-dashed border-slate-200"
                        >
                          No hay componentes registrados en la receta activa
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8 flex flex-col items-center text-center justify-center flex-1 relative">
              <div
                className={`w-20 h-20 rounded-2xl mb-5 flex items-center justify-center shadow-inner border ${isConfigured ? "bg-emerald-50 border-emerald-100 text-emerald-500" : "bg-rose-50 border-rose-100 text-rose-500"}`}
              >
                <FaCogs size={36} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-3">
                Estado de Parámetros
              </h4>
              <span
                className={`text-[10px] font-bold px-3 py-1.5 rounded-md uppercase tracking-widest border shadow-sm ${isConfigured ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
              >
                {producto?.tipo_proceso || "ROTOMOLDEO"}
              </span>
              <p className="text-[11px] text-slate-500 font-medium mt-5 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 w-full">
                {isConfigured
                  ? "✅ Los parámetros están listos y configurados para la impresión del PDF técnico."
                  : "⚠️ Faltan configurar los parámetros de máquina para que aparezcan en el PDF."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderParametrosTab = () => {
    const isRot = editForm.tipo_proceso === "ROTOMOLDEO";
    const pm = editForm.parametros_maquina || {};
    const handleChange = (field, val) => {
      setEditForm((prev) => ({
        ...prev,
        parametros_maquina: { ...prev.parametros_maquina, [field]: val },
      }));
    };

    return (
      <div className="flex flex-col gap-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <h4 className="text-slate-700 font-bold text-sm tracking-wide uppercase">
              Tipo de Proceso
            </h4>
            <p className="text-[10px] text-slate-400 font-medium uppercase mt-1 tracking-wider">
              Seleccione la maquinaria a utilizar
            </p>
          </div>
          <div className="relative w-64">
            <select
              value={editForm.tipo_proceso}
              onChange={(e) =>
                setEditForm({ ...editForm, tipo_proceso: e.target.value })
              }
              className="appearance-none w-full bg-slate-50 text-slate-800 py-3 pl-4 pr-10 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer shadow-sm"
            >
              <option value="ROTOMOLDEO">ROTOMOLDEO</option>
              <option value="INYECCION">INYECCIÓN</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
              <FaChevronLeft className="-rotate-90 text-xs" />
            </div>
          </div>
        </div>

        {isRot ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-6 py-5 border-b border-slate-100">
                <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                  Ciclo de Cocción
                </h5>
              </div>
              <div className="p-4">
                <table className="w-full text-sm text-left border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-slate-400 text-[10px] uppercase font-semibold tracking-widest">
                      <th className="p-2 pl-4">Parámetro</th>
                      <th className="p-2 text-center w-24">Etapa 1</th>
                      <th className="p-2 text-center w-24">Etapa 2</th>
                      <th className="p-2 text-center w-24">Etapa 3</th>
                      <th className="p-2 text-center w-24">Etapa 4</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 pl-4 text-blue-600 font-bold text-[11px] uppercase tracking-wider">
                        Tiempo (min)
                      </td>
                      {[1, 2, 3, 4].map((i) => (
                        <td key={i} className="p-1.5">
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
                      <td className="p-2 pl-4 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                        Vel. M1 (%)
                      </td>
                      {[1, 2, 3, 4].map((i) => (
                        <td key={i} className="p-1.5">
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
                      <td className="p-2 pl-4 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                        Vel. M2 (%)
                      </td>
                      {[1, 2, 3, 4].map((i) => (
                        <td key={i} className="p-1.5">
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
                      <td className="p-2 pl-4 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                        Inversión (%)
                      </td>
                      {[1, 2, 3, 4].map((i) => (
                        <td key={i} className="p-1.5">
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
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <label className="text-[10px] font-semibold text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FaFire className="text-base" /> Temperatura Horno
                </label>
                <div className="flex items-center gap-3">
                  <MetricInput
                    value={pm.temp_horno}
                    onChange={(e) => handleChange("temp_horno", e.target.value)}
                    className="text-xl font-bold text-orange-600 border-orange-100 bg-orange-50/50 py-3"
                    placeholder="0"
                  />
                  <span className="text-orange-400 font-bold text-lg">°C</span>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <label className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FaClock className="text-base" /> Enfriamiento
                </label>
                <div className="flex items-center gap-3 mb-5">
                  <MetricInput
                    value={pm.frio_min}
                    onChange={(e) => handleChange("frio_min", e.target.value)}
                    className="text-base font-bold text-blue-700 border-blue-100 bg-blue-50/50"
                    placeholder="0"
                  />
                  <span className="text-blue-400 text-[10px] font-bold uppercase tracking-widest w-10">
                    Min.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-5 border-t border-slate-100">
                  <div>
                    <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest block mb-2">
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
                    <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest block mb-2">
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                  Perfil de Inyección
                </h5>
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-sm"></div>
                </div>
              </div>
              <div className="p-4">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                      <th className="py-2 w-12 text-center">#</th>
                      <th className="py-2 pl-2 text-blue-500">
                        Posición{" "}
                        <span className="normal-case opacity-60 font-medium">
                          (mm)
                        </span>
                      </th>
                      <th className="py-2 pl-2 text-emerald-500">
                        Presión{" "}
                        <span className="normal-case opacity-60 font-medium">
                          (bar)
                        </span>
                      </th>
                      <th className="py-2 pl-2 text-purple-500">
                        Velocidad{" "}
                        <span className="normal-case opacity-60 font-medium">
                          (%)
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <tr key={i} className="group">
                        <td className="p-1.5 text-center font-bold text-slate-400 text-[11px] font-mono">
                          {i}
                        </td>
                        <td className="p-1.5">
                          <MetricInput
                            value={pm[`pos${i}`]}
                            onChange={(e) =>
                              handleChange(`pos${i}`, e.target.value)
                            }
                          />
                        </td>
                        <td className="p-1.5">
                          <MetricInput
                            value={pm[`pres${i}`]}
                            onChange={(e) =>
                              handleChange(`pres${i}`, e.target.value)
                            }
                          />
                        </td>
                        <td className="p-1.5">
                          <MetricInput
                            value={pm[`vel${i}`]}
                            onChange={(e) =>
                              handleChange(`vel${i}`, e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 p-4 opacity-5 text-orange-500 pointer-events-none">
                  <FaFire size={80} />
                </div>
                <label className="text-[10px] font-semibold text-orange-500 uppercase tracking-widest mb-4 block">
                  Temperaturas de Zona
                </label>
                <textarea
                  rows={2}
                  className="w-full bg-orange-50/50 border border-orange-100 text-orange-800 rounded-xl p-4 text-sm font-mono font-bold focus:border-orange-400 focus:ring-4 focus:ring-orange-50 outline-none placeholder-orange-200 resize-none transition-all"
                  placeholder="Ej: 180 / 175 / 170 / 165 / 160"
                  value={pm.temperaturas_zonas || ""}
                  onChange={(e) =>
                    handleChange("temperaturas_zonas", e.target.value)
                  }
                />
                <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest">
                    Chiller Matriz
                  </span>
                  <div className="w-28">
                    <MetricInput
                      value={pm.chiller_matriz}
                      onChange={(e) =>
                        handleChange("chiller_matriz", e.target.value)
                      }
                      placeholder="°C"
                      className="text-right text-blue-700 font-bold border-blue-100 bg-blue-50/50"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                    Carga / Succión (Pos #5)
                  </span>
                  <span className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse shadow-sm"></span>
                </div>
                <div className="p-6 grid grid-cols-2 gap-5 bg-yellow-50/20">
                  <div>
                    <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest block mb-2">
                      Posición
                    </span>
                    <MetricInput
                      value={pm.carga_pos}
                      onChange={(e) =>
                        handleChange("carga_pos", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest block mb-2">
                      Presión
                    </span>
                    <MetricInput
                      value={pm.carga_pres}
                      onChange={(e) =>
                        handleChange("carga_pres", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest block mb-2">
                      Velocidad
                    </span>
                    <MetricInput
                      value={pm.carga_vel}
                      onChange={(e) =>
                        handleChange("carga_vel", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest block mb-2">
                      P. Atrás
                    </span>
                    <MetricInput
                      value={pm.carga_pres_atras}
                      onChange={(e) =>
                        handleChange("carga_pres_atras", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSaveParams}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-200 flex items-center gap-2 transition-all active:scale-95 text-[11px] font-bold uppercase tracking-widest"
          >
            <FaSave /> Guardar Parámetros
          </button>
        </div>
      </div>
    );
  };

  if (!data && loading)
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-[150]">
        <FaSpinner className="animate-spin text-4xl text-white" />
      </div>
    );

  if (!data) return null;

  const { producto } = data;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-[#f8fafc] w-full max-w-5xl h-[85vh] min-h-[700px] rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL FICHA TÉCNICA */}
        <div className="bg-white px-8 pt-8 pb-6 border-b border-slate-100 rounded-t-[2rem]">
          <div className="flex justify-between items-start">
            <div className="flex gap-5 items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 shrink-0">
                <FaBoxOpen size={24} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight uppercase">
                    {producto?.nombre}
                  </h2>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest shadow-sm">
                    FICHA TÉCNICA
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest border shadow-sm ${producto?.tipo_proceso === "INYECCION" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                  >
                    {producto?.tipo_proceso || "ROTOMOLDEO"}
                  </span>
                </div>
                <p className="text-slate-400 font-mono text-xs mt-1 uppercase tracking-wider font-semibold">
                  {producto?.codigo}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={imprimirFichaTecnica}
                className="bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-blue-600 px-5 py-2 rounded-xl flex items-center gap-2 font-bold text-xs transition-all shadow-sm uppercase tracking-wider"
              >
                <FaFilePdf size={14} /> Imprimir PDF
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors bg-white border border-slate-200 shadow-sm"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          {/* TABS ESTILO PASTILLA (PILL) SUTIL Y SIN EFECTOS DE VUELO */}
          <div className="flex gap-3 mt-8 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100 w-max">
            <button
              onClick={() => setActiveTab("RECETA")}
              className={`px-6 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all rounded-lg border ${activeTab === "RECETA" ? "bg-white text-blue-600 shadow-sm border-slate-200/60" : "bg-transparent text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-100/50"}`}
            >
              Resumen y Receta
            </button>
            <button
              onClick={() => setActiveTab("PARAMETROS")}
              className={`px-6 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all rounded-lg border ${activeTab === "PARAMETROS" ? "bg-white text-blue-600 shadow-sm border-slate-200/60" : "bg-transparent text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-100/50"}`}
            >
              Configuración de Máquina
            </button>
          </div>
        </div>

        {/* ÁREA DE CONTENIDO CON SCROLL INTERNO (EVITA QUE EL MODAL CAMBIE DE TAMAÑO) */}
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 relative rounded-b-[2rem]">
          {activeTab === "RECETA" ? renderRecetaTab() : renderParametrosTab()}
        </div>
      </motion.div>
    </div>
  );
}
// --- FIN SUB-COMPONENTE: FICHA TÉCNICA DE PRODUCTO ---

// --- SUB-COMPONENTE: CALCULADORA MÍNIMOS ---
function CalculadoraMinimosModal({ onClose, showToast }) {
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
      showToast("Error cargando sugerencias.", "error");
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
      tableAlt: [248, 250, 252],
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
      item.nombre.toUpperCase(),
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
      alternateRowStyles: { fillColor: colors.tableAlt },
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
          if (val > 0) data.cell.styles.textColor = [220, 38, 38];
          else if (val < 0) data.cell.styles.textColor = [37, 99, 235];
          else data.cell.styles.textColor = [150, 150, 150];
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
    showToast("PDF Exportado correctamente.", "success");
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="bg-white w-full max-w-6xl rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 tracking-tight">
              <FaMagic className="text-blue-600" /> Sugerencias de Stock Mínimo
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Basado en la demanda real de los últimos 6 meses.{" "}
              <span className="text-xs text-orange-600 ml-2 font-bold bg-orange-50 px-2.5 py-1 rounded-md border border-orange-100 uppercase tracking-widest">
                * Analítico. Actualiza tu sistema manualmente.
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!loading && items.length > 0 && (
              <button
                onClick={generarPDFSugerencias}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold shadow-sm transition-all uppercase tracking-wider"
              >
                <FaFilePdf className="text-red-500" /> Exportar PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#f8fafc]">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center h-full">
              <FaSpinner className="animate-spin text-4xl text-blue-500 mb-4" />
              <p className="text-slate-500 font-bold tracking-wider uppercase text-sm">
                Calculando algoritmos...
              </p>
            </div>
          ) : (
            <div className="min-w-full inline-block align-middle p-8">
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 text-[10px] uppercase font-bold tracking-widest border-b border-slate-200">
                    <tr>
                      <th className="p-4">Producto / Semi</th>
                      <th className="p-4 text-center">Stock Actual</th>
                      <th className="p-4 text-center">Mínimo Configurado</th>
                      <th className="p-4 text-center bg-blue-50/50 text-blue-700">
                        Sugerido IA (1 Mes)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="p-4">
                          <div className="font-bold text-slate-800 text-sm uppercase">
                            {item.nombre}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono tracking-widest mt-0.5 uppercase">
                            {item.codigo}
                          </div>
                        </td>
                        <td className="p-4 text-center font-mono text-slate-600 font-bold text-sm">
                          {item.stock_actual}
                        </td>
                        <td className="p-4 text-center font-mono text-slate-400 text-sm">
                          {item.minimo_actual}
                        </td>
                        <td className="p-4 text-center bg-blue-50/10 group-hover:bg-blue-50/40 transition-colors">
                          <span
                            className={`font-bold font-mono px-3 py-1.5 rounded-lg text-sm inline-flex items-center gap-2 ${item.diferencia > 0 ? "bg-rose-50 text-rose-600 border border-rose-200 shadow-sm" : "text-emerald-600 bg-emerald-50 border border-emerald-200 shadow-sm"}`}
                          >
                            {item.sugerido}{" "}
                            <span className="text-[10px] opacity-70">
                              ({item.diferencia > 0 ? "+" : ""}
                              {item.diferencia})
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {!loading && items.length > 0 && (
          <div className="p-5 border-t border-slate-100 bg-white flex justify-between items-center rounded-b-3xl shrink-0">
            <button
              onClick={goToPrev}
              disabled={currentPage === 1}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-2 text-xs font-bold px-5 shadow-sm uppercase tracking-wider"
            >
              <FaChevronLeft /> Anterior
            </button>
            <span className="text-sm text-slate-500 font-medium uppercase tracking-wider">
              Página{" "}
              <span className="text-slate-800 font-bold">{currentPage}</span> de{" "}
              {totalPages}
            </span>
            <button
              onClick={goToNext}
              disabled={currentPage === totalPages}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-2 text-xs font-bold px-5 shadow-sm uppercase tracking-wider"
            >
              Siguiente <FaChevronRight />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// --- NUEVO COMPONENTE: CAJÓN DE RECETAS (HISTORIAL) ---
function CajonRecetasModal({
  item,
  modo,
  onClose,
  onCargarMesaSilencioso,
  showToast,
}) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(null);

  useEffect(() => {
    const ref = modo === "PRODUCTO" ? item : item.id;
    // Cache buster para traer datos frescos siempre
    authFetch(
      `${API_BASE_URL}/ingenieria/historial-recetas?tipo=${modo}&ref=${encodeURIComponent(ref)}&t=${Date.now()}`,
    )
      .then((res) => res.json())
      .then((data) => {
        setHistorial(data || []);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, [item, modo]);

  const closeMenu = () => setMenuAbierto(null);

  const eliminarVersion = async (idVersion) => {
    if (!confirm("¿Seguro que deseas eliminar esta versión del historial?"))
      return;
    try {
      const res = await authFetch(
        `${API_BASE_URL}/ingenieria/historial-recetas/${idVersion}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setHistorial((prev) => prev.filter((v) => v.id !== idVersion));
        showToast("Versión eliminada correctamente.", "success");
      } else throw new Error();
    } catch (e) {
      showToast("Error al eliminar la versión.", "error");
    }
  };

  const renombrarVersion = async (version) => {
    const nuevoNombre = prompt(
      "Nuevo nombre para esta versión:",
      version.nombre_version,
    );
    if (!nuevoNombre || nuevoNombre === version.nombre_version) return;
    try {
      const res = await authFetch(
        `${API_BASE_URL}/ingenieria/historial-recetas/${version.id}/renombrar`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre_version: nuevoNombre }),
        },
      );
      if (res.ok) {
        setHistorial((prev) =>
          prev.map((v) =>
            v.id === version.id ? { ...v, nombre_version: nuevoNombre } : v,
          ),
        );
        showToast("Nombre actualizado.", "success");
      } else throw new Error();
    } catch (e) {
      showToast("Error al renombrar.", "error");
    }
  };

  const fijarComoActiva = async (version) => {
    try {
      const ref_id = modo === "PRODUCTO" ? item : item.id;
      const res = await authFetch(
        `${API_BASE_URL}/ingenieria/historial-recetas/${version.id}/activar`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: modo, ref_id }),
        },
      );
      if (res.ok) {
        setHistorial((prev) =>
          prev.map((v) => ({ ...v, activa: v.id === version.id })),
        );
        showToast(
          `La versión "${version.nombre_version}" se estableció como ACTIVA en la Base de Datos.`,
          "success",
        );
      } else throw new Error();
    } catch (e) {
      showToast("Error al activar. Revisa la base de datos.", "error");
    }
  };

  const hayActiva = historial.some((v) => v.activa);

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white w-full max-w-3xl rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
        onClick={(e) => {
          e.stopPropagation();
          closeMenu();
        }}
      >
        <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3 tracking-tight">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <FaFolderOpen size={18} />
              </div>{" "}
              Cajón de Versiones
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Historial de recetas para:{" "}
              <span className="font-bold text-slate-700 uppercase">
                {modo === "PRODUCTO" ? item : item.nombre}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#f8fafc]"
          onScroll={closeMenu}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40">
              <FaSpinner className="animate-spin text-3xl text-blue-500 mb-2" />
              <p className="text-slate-500 font-bold text-sm mt-3 uppercase tracking-wider">
                Buscando en el archivo...
              </p>
            </div>
          ) : historial.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <div className="bg-white p-5 rounded-full text-slate-300 mb-3 border border-slate-200 shadow-sm">
                <FaFolderOpen size={30} />
              </div>
              <p className="text-slate-500 font-bold uppercase tracking-wider">
                El cajón está vacío.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {!hayActiva && (
                <div className="mb-4 bg-orange-50 border border-orange-200 text-orange-700 p-4 rounded-2xl text-sm font-medium flex items-start gap-3 shadow-sm animate-in fade-in">
                  <FaExclamationTriangle className="mt-0.5 shrink-0 text-orange-500 text-lg" />
                  <div>
                    Aún no hay ninguna versión marcada como <b>Activa</b>.{" "}
                    <br />
                    Haz clic en los tres puntos (
                    <FaEllipsisV className="inline text-orange-400 mx-1" />) de
                    la receta correcta y selecciona "Fijar como Activa" para que
                    el sistema sepa cuál usar.
                  </div>
                </div>
              )}

              {historial.map((version, idx) => (
                <div
                  key={idx}
                  className={`bg-white border rounded-2xl p-5 transition-all ${version.activa ? "border-emerald-400 shadow-[0_4px_20px_rgba(52,211,153,0.15)] ring-1 ring-emerald-400" : "border-slate-200 shadow-sm hover:shadow-md"}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-slate-800 text-lg tracking-tight uppercase">
                          {version.nombre_version ||
                            `Versión #${historial.length - idx}`}
                        </h4>
                        {version.activa && (
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 uppercase tracking-widest shadow-sm animate-in zoom-in">
                            <FaCheckCircle size={12} /> Activa
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-400 font-mono mt-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                        <FaClock /> Guardado el:{" "}
                        {version.fecha || "Fecha desconocida"}
                      </p>
                    </div>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuAbierto(
                            menuAbierto === version.id ? null : version.id,
                          );
                        }}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-xl transition-all"
                      >
                        <FaEllipsisV />
                      </button>

                      {menuAbierto === version.id && (
                        <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          {!version.activa && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                fijarComoActiva(version);
                                setMenuAbierto(null);
                              }}
                              className="w-full text-left px-5 py-3 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors uppercase tracking-wider"
                            >
                              <FaCheckCircle className="text-blue-400 text-sm" />{" "}
                              Fijar como Activa
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCargarMesaSilencioso(version.items);
                              setMenuAbierto(null);
                              onClose();
                              showToast(
                                "Versión cargada en la mesa.",
                                "success",
                              );
                            }}
                            className="w-full text-left px-5 py-3 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors uppercase tracking-wider"
                          >
                            <FaUpload className="text-blue-400 text-sm" />{" "}
                            Cargar en Mesa
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              renombrarVersion(version);
                              setMenuAbierto(null);
                            }}
                            className="w-full text-left px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors uppercase tracking-wider"
                          >
                            <FaEdit className="text-slate-400 text-sm" />{" "}
                            Cambiar Nombre
                          </button>
                          <div className="h-px bg-slate-100 my-1 mx-3"></div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              eliminarVersion(version.id);
                              setMenuAbierto(null);
                            }}
                            className="w-full text-left px-5 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors uppercase tracking-wider"
                          >
                            <FaTrashAlt className="text-rose-400 text-sm" />{" "}
                            Eliminar del Cajón
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Componentes de esta versión:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {version.items &&
                        version.items.map((ing, i) => (
                          <span
                            key={i}
                            className="bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg font-semibold shadow-sm flex items-center transition-all hover:border-slate-300"
                          >
                            <span className="font-bold text-blue-600 mr-2">
                              {ing.cantidad}x
                            </span>
                            <span
                              className="truncate max-w-[200px] uppercase"
                              title={ing.nombre}
                            >
                              {ing.nombre}
                            </span>
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// --- DRAGGABLE ITEM (TARJETA LEBANE ACTUALIZADA CON PRECIO) ---
function DraggableItem({ item, isOverlay, onVerFicha }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `source-${item.id}`, data: item, disabled: isOverlay });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0 : 1,
      }
    : undefined;

  const baseClasses =
    "p-3.5 mb-3 bg-white border rounded-2xl flex justify-between items-center touch-none transition-all duration-200 select-none";
  const overlayClasses =
    "border-blue-400 shadow-2xl scale-105 cursor-grabbing z-[9999]";
  const normalClasses =
    "border-slate-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 cursor-grab group";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${baseClasses} ${isOverlay ? overlayClasses : normalClasses}`}
    >
      <FaGripVertical className="text-slate-200 mr-3 group-hover:text-blue-400 transition-colors shrink-0" />
      <div className="flex flex-col flex-1 min-w-0 mr-3">
        <p className="font-bold text-[10px] text-slate-400 font-mono tracking-widest uppercase mb-0.5">
          {item.codigo || "S/C"}
        </p>
        <p className="text-xs font-bold text-slate-800 truncate w-full uppercase">
          {item.nombre || "SIN NOMBRE"}
        </p>
      </div>

      {/* VALOR UNITARIO */}
      <div className="flex flex-col items-end shrink-0 mr-4">
        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-1">
          Costo Unit.
        </span>
        <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
          {formatCurrency(item.precio || item.costo || 0)}
        </span>
      </div>

      {!isOverlay && (
        <div className="flex gap-1.5 mr-4 opacity-0 group-hover:opacity-100 transition-opacity">
          {onVerFicha && (
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onVerFicha(item);
              }}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100 shadow-sm"
              title="Ver Ficha Técnica"
            >
              <FaEye size={13} />
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col items-end shrink-0">
        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-1">
          Stock
        </span>
        <span
          className={`text-[10px] px-2.5 py-0.5 rounded-md font-bold font-mono border shadow-sm ${item.stock_actual > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
        >
          {item.stock_actual || 0}
        </span>
      </div>
    </div>
  );
}

// --- DROPPABLE AREA (ZONA RECETA COMO CALCULADORA DE COSTOS) ---
function DroppableArea({ items, onRemove, placeholderText, onCantidadChange }) {
  const { setNodeRef, isOver } = useDroppable({ id: "receta-droppable" });

  // Calculamos el costo total de la receta en vivo
  const costoTotal = items.reduce(
    (acc, ing) =>
      acc + Number(ing.precio || ing.costo || 0) * Number(ing.cantidad),
    0,
  );

  return (
    <div className="flex flex-col h-full">
      <div
        ref={setNodeRef}
        className={`border-2 border-dashed rounded-3xl p-5 transition-all duration-300 overflow-y-auto flex-1 ${isOver ? "border-blue-400 bg-blue-50/50 scale-[1.01] shadow-inner" : "border-slate-200 bg-white"}`}
      >
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 select-none">
            <div
              className={`p-6 rounded-3xl mb-5 transition-all ${isOver ? "bg-blue-100 text-blue-600 scale-110 shadow-lg" : "bg-slate-50 shadow-sm border border-slate-100 text-slate-300"}`}
            >
              <FaCubes className="text-4xl" />
            </div>
            <p className="font-bold text-sm text-slate-600 tracking-tight uppercase">
              {placeholderText || "Arrastra componentes aquí"}
            </p>
            <p className="text-xs text-slate-400 font-medium mt-1.5 uppercase tracking-wider">
              Para armar y costear la receta
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((ing, idx) => {
              const subtotal =
                Number(ing.precio || ing.costo || 0) * Number(ing.cantidad);
              return (
                <li
                  key={idx}
                  className="bg-white p-3.5 rounded-2xl flex justify-between items-center group border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="flex items-center gap-4 flex-1 overflow-hidden pr-4">
                    <div
                      onClick={() => onCantidadChange && onCantidadChange(idx)}
                      className="bg-slate-50 min-w-[48px] h-11 flex items-center justify-center rounded-xl font-black text-blue-600 border border-slate-200 text-sm cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors px-2 shadow-sm"
                      title="Clic para editar cantidad"
                    >
                      {ing.cantidad}x
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-slate-400 font-mono font-bold tracking-widest uppercase mb-0.5">
                        {ing.codigo || "S/C"}
                      </span>
                      <span
                        className="text-slate-800 font-bold text-sm tracking-tight uppercase truncate"
                        title={ing.nombre || "SIN NOMBRE"}
                      >
                        {ing.nombre || "SIN NOMBRE"}
                      </span>
                    </div>
                  </div>

                  {/* SECCIÓN DE PRECIOS */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mb-0.5">
                        Unitario
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-500">
                        {formatCurrency(ing.precio || ing.costo || 0)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end w-24">
                      <span className="text-[9px] text-blue-400 font-bold tracking-widest uppercase mb-0.5">
                        Subtotal
                      </span>
                      <span className="text-sm font-mono font-black text-blue-600">
                        {formatCurrency(subtotal)}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemove(idx)}
                      className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-2.5 rounded-xl transition-colors opacity-0 group-hover:opacity-100 border border-transparent hover:border-rose-100 shadow-sm ml-2"
                    >
                      <FaTrashAlt size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* FOOTER CON TOTALES EN VIVO */}
      {items.length > 0 && (
        <div className="mt-4 shrink-0 bg-white border border-slate-200 shadow-sm rounded-3xl p-5 flex justify-between items-center animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg border border-blue-100 shadow-sm">
              {items.length}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Componentes
              <br />
              en receta
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
              Costo Total
              <br />
              Estimado
            </span>
            <span className="text-3xl font-black text-emerald-600 font-mono tracking-tight bg-emerald-50 px-4 py-1.5 rounded-xl border border-emerald-100 shadow-sm">
              {formatCurrency(costoTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- MAIN COMPONENT: INGENIERÍA (LEBANE) ---
export default function IngenieriaProductos() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [productosDB, setProductosDB] = useState([]); // NUEVO ESTADO PARA COSTOS
  const [semielaborados, setSemielaborados] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [modo, setModo] = useState("PRODUCTO");
  const [seleccionado, setSeleccionado] = useState(null);
  const [receta, setReceta] = useState([]);
  const [ultimaModificacion, setUltimaModificacion] = useState(null);
  const [costoImportacion, setCostoImportacion] = useState(""); // NUEVO INPUT DE COSTO
  const [filtroIzq, setFiltroIzq] = useState("");
  const [filtroDer, setFiltroDer] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);

  // Modales
  const [fichaSeleccionada, setFichaSeleccionada] = useState(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [productoParaVariantes, setProductoParaVariantes] = useState(null);
  const [showCajonRecetas, setShowCajonRecetas] = useState(false);

  // SISTEMA DE TOASTS CUSTOM
  const [toasts, setToasts] = useState([]);
  const showToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [resPedidos, resRecetas, resSemis, resMP, resProd] =
          await Promise.all([
            authFetch(`${PEDIDOS_API_URL}?t=${Date.now()}`),
            authFetch(`${API_BASE_URL}/ingenieria/recetas/all`),
            authFetch(`${API_BASE_URL}/ingenieria/semielaborados`),
            authFetch(`${API_BASE_URL}/ingenieria/materias-primas`),
            authFetch(`${API_BASE_URL}/ingenieria/productos`), // NUEVO FETCH
          ]);

        const dataPedidos = await resPedidos.json();
        const dataRecetas = await resRecetas.json();
        const setNombres = new Set();

        if (Array.isArray(dataPedidos)) {
          dataPedidos.forEach((r) => {
            const nombre = r.MODELO || r.Modelo || r.modelo;
            if (isValidName(nombre)) setNombres.add(nombre.toString().trim());
          });
        }
        if (dataRecetas) {
          Object.keys(dataRecetas).forEach((nombre) => {
            if (isValidName(nombre)) setNombres.add(nombre.trim());
          });
        }

        setProductos(Array.from(setNombres).sort());
        if (resSemis.ok) setSemielaborados(await resSemis.json());
        if (resMP.ok) setMateriasPrimas(await resMP.json());
        if (resProd.ok) setProductosDB(await resProd.json());
      } catch (error) {
        showToast("Error cargando base de datos inicial.", "error");
      }
    };
    cargarDatos();
  }, []);

  const cargarReceta = async (item) => {
    setSeleccionado(item);
    setReceta([]);
    setUltimaModificacion(null);
    setCostoImportacion(""); // Reset costo
    setCostoImportacion(modo === "SEMIELABORADO" ? item.costo_usd || "" : "");

    if (modo === "PRODUCTO") {
      const prodDb = productosDB.find((p) => p.nombre === item);
      if (prodDb && Number(prodDb.costo_usd) > 0) {
        setCostoImportacion(prodDb.costo_usd);
      }
    }

    let url =
      modo === "PRODUCTO"
        ? `${API_BASE_URL}/ingenieria/recetas/${encodeURIComponent(item)}`
        : `${API_BASE_URL}/ingenieria/recetas-semielaborados/${item.id}`;

    try {
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setReceta(
          data.map((d) => {
            const matchedItem =
              modo === "PRODUCTO"
                ? semielaborados.find((s) => s.id === d.semielaborado_id)
                : materiasPrimas.find((mp) => mp.id === d.materia_prima_id);
            return {
              ...d,
              cantidad: Number(d.cantidad) || 1,
              id: d.materia_prima_id || d.semielaborado_id,
              codigo: d.codigo || matchedItem?.codigo || "S/C",
              precio:
                matchedItem?.precio || matchedItem?.costo || d.precio || 0,
            };
          }),
        );
        if (data.length > 0 && data[0].fecha_receta)
          setUltimaModificacion(data[0].fecha_receta);
      }
    } catch (e) {
      showToast("Error al cargar la receta actual.", "error");
    }
  };

  const guardarCostoImportacion = async () => {
    if (!seleccionado || modo !== "SEMIELABORADO") return;
    try {
      const res = await authFetch(
        `${API_BASE_URL}/ingenieria/semielaborados/${seleccionado.id}/costo`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ costo_usd: Number(costoImportacion) }),
        },
      );
      if (res.ok) {
        showToast("Costo base/importado guardado.", "success");
        setSemielaborados((prev) =>
          prev.map((s) =>
            s.id === seleccionado.id
              ? {
                  ...s,
                  costo_usd: Number(costoImportacion),
                  costo: Number(costoImportacion),
                }
              : s,
          ),
        );
      } else throw new Error();
    } catch (e) {
      showToast("Error al guardar el costo.", "error");
    }
  };

  const crearNuevoProducto = () => {
    if (modo !== "PRODUCTO" || !filtroIzq.trim()) return;
    const nuevoNombre = filtroIzq.trim().toUpperCase();
    if (!isValidName(nuevoNombre))
      return showToast("Nombre inválido.", "error");

    setProductos((prev) => [...prev, nuevoNombre].sort());
    setSeleccionado(nuevoNombre);
    setReceta([]);
    setUltimaModificacion("Borrador (Nuevo)");
    setCostoImportacion("");
    setFiltroIzq("");
    showToast(
      "Producto creado en local. Configure la receta o el costo directo para confirmar.",
      "success",
    );
  };

  const guardar = async () => {
    if (!seleccionado) return;
    let nombreVersion = null;
    if (modo === "SEMIELABORADO") {
      const sugerencia = `Versión ${new Date().toLocaleDateString("es-AR")}`;
      nombreVersion = prompt(
        "Nombre para identificar esta versión en el Cajón:",
        sugerencia,
      );
      if (nombreVersion === null) return;
    }
    const itemsToSave = receta.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      codigo: r.codigo || "S/C",
      cantidad: r.cantidad,
    }));
    let endpoint =
      modo === "PRODUCTO"
        ? `${API_BASE_URL}/ingenieria/recetas`
        : `${API_BASE_URL}/ingenieria/recetas-semielaborados`;
    let body =
      modo === "PRODUCTO"
        ? { producto_terminado: seleccionado, items: itemsToSave }
        : {
            semielaborado_id: seleccionado.id,
            items: itemsToSave,
            nombre_version: nombreVersion,
          };

    try {
      const r = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => null);
        throw new Error(errData?.msg || "Error en el servidor");
      }
      setUltimaModificacion(new Date().toLocaleString("es-AR"));
      showToast(
        modo === "PRODUCTO"
          ? "Receta guardada exitosamente."
          : "Receta archivada y fijada como Activa.",
        "success",
      );
    } catch (e) {
      showToast(e.message, "error");
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
      showToast("Sincronización de Stock completada con éxito.", "success");
    } catch (e) {
      showToast("Error sincronizando: " + e.message, "error");
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
          `Cantidad de "${itemData.nombre.toUpperCase()}" (${modo === "PRODUCTO" ? "Unidades" : "Kg/Unidad"}):`,
          defaultQty,
        );
        if (cantidadStr === null) return;
        const cantidad = Number(cantidadStr);
        if (isNaN(cantidad) || cantidad <= 0)
          return showToast("La cantidad ingresada no es válida.", "error");
        setReceta((prev) => [...prev, { ...itemData, cantidad: cantidad }]);
      }
    }
  };
  const handleDragStart = (e) => setActiveDragId(e.active.id);

  const handleCantidadChange = (indexToChange) => {
    const item = receta[indexToChange];
    const cantidadStr = prompt(
      `Modificar cantidad de "${item.nombre.toUpperCase()}":`,
      String(item.cantidad),
    );
    if (cantidadStr === null) return;
    const cantidad = Number(cantidadStr);
    if (isNaN(cantidad) || cantidad <= 0)
      return showToast("La cantidad ingresada no es válida.", "error");
    setReceta((prev) =>
      prev.map((r, index) =>
        index === indexToChange ? { ...r, cantidad: cantidad } : r,
      ),
    );
  };

  const handleCargarMesaSilencioso = (itemsViejos) => {
    const itemsAdaptados = itemsViejos.map((d) => {
      const fullItem =
        materiasPrimas.find((mp) => mp.id === (d.materia_prima_id || d.id)) ||
        semielaborados.find((s) => s.id === (d.semielaborado_id || d.id));
      return {
        ...d,
        cantidad: Number(d.cantidad) || 1,
        id: d.materia_prima_id || d.semielaborado_id || d.id,
        codigo: d.codigo || fullItem?.codigo || "S/C",
        precio: fullItem?.precio || fullItem?.costo || d.precio || 0,
      };
    });
    setReceta(itemsAdaptados);
  };

  let listaIzquierdaVisible = [];
  if (modo === "PRODUCTO") {
    listaIzquierdaVisible = productos.filter(
      (p) =>
        isValidName(p) && p.toLowerCase().includes(filtroIzq.toLowerCase()),
    );
  } else {
    listaIzquierdaVisible = semielaborados.filter(
      (s) =>
        isValidName(s.nombre) &&
        ((s.nombre || "").toLowerCase().includes(filtroIzq.toLowerCase()) ||
          (s.codigo || "").toLowerCase().includes(filtroIzq.toLowerCase())),
    );
  }

  const listaDerechaSource =
    modo === "PRODUCTO" ? semielaborados : materiasPrimas;
  const listaDerechaVisible = listaDerechaSource.filter(
    (i) =>
      isValidName(i.nombre) &&
      ((i.nombre || "").toLowerCase().includes(filtroDer.toLowerCase()) ||
        (i.codigo || "").toLowerCase().includes(filtroDer.toLowerCase())),
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
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md font-bold text-sm min-w-[300px] ${t.type === "success" ? "bg-emerald-50/95 border-emerald-200 text-emerald-800" : "bg-rose-50/95 border-rose-200 text-rose-800"}`}
            >
              {t.type === "success" ? (
                <FaCheckCircle className="text-emerald-500 text-xl" />
              ) : (
                <FaExclamationTriangle className="text-rose-500 text-xl" />
              )}
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {fichaSeleccionada && (
          <FichaTecnicaModal
            semiId={fichaSeleccionada.id}
            onClose={() => setFichaSeleccionada(null)}
            showToast={showToast}
          />
        )}
        {showCalculator && (
          <CalculadoraMinimosModal
            onClose={() => setShowCalculator(false)}
            showToast={showToast}
          />
        )}
        {productoParaVariantes && (
          <GestorVariantesModal
            producto={productoParaVariantes}
            onClose={() => setProductoParaVariantes(null)}
            onSave={() => {}}
            showToast={showToast}
          />
        )}
        {showCajonRecetas && seleccionado && modo === "SEMIELABORADO" && (
          <CajonRecetasModal
            item={seleccionado}
            modo={modo}
            onClose={() => setShowCajonRecetas(false)}
            onCargarMesaSilencioso={handleCargarMesaSilencioso}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col h-[calc(100vh-100px)] min-h-[600px] gap-6 animate-in fade-in bg-[#f8fafc] text-slate-800">
        {/* HEADER LIMPIO LEBANE */}
        <div className="bg-white border-b border-slate-200 px-8 py-5 flex-none shadow-[0_2px_10px_rgba(0,0,0,0.02)] z-10 rounded-b-2xl md:rounded-none">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <FaCogs className="text-blue-600" /> Ingeniería de Producto
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-1">
                Define recetas:{" "}
                {modo === "PRODUCTO"
                  ? "Producto Terminado → Semielaborados"
                  : "Semielaborado → Materias Primas"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full sm:w-fit border border-slate-200 shadow-inner">
                <button
                  onClick={() => {
                    setModo("PRODUCTO");
                    setSeleccionado(null);
                    setReceta([]);
                    setCostoImportacion("");
                  }}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${modo === "PRODUCTO" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"}`}
                >
                  <FaBoxOpen size={14} /> Productos
                </button>
                <button
                  onClick={() => {
                    setModo("SEMIELABORADO");
                    setSeleccionado(null);
                    setReceta([]);
                    setCostoImportacion("");
                  }}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${modo === "SEMIELABORADO" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"}`}
                >
                  <FaCubes size={14} /> Semielaborados
                </button>
              </div>
              <div className="hidden sm:block h-8 w-px bg-slate-200 mx-2"></div>
              <div className="flex gap-2 w-full sm:w-auto">
                {modo === "SEMIELABORADO" && (
                  <button
                    onClick={() => setShowCalculator(true)}
                    className="flex-1 sm:flex-none h-[42px] px-5 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all text-xs"
                  >
                    <FaCalculator size={13} /> Mínimos
                  </button>
                )}
                <button
                  onClick={syncStock}
                  disabled={loading}
                  className="flex-1 sm:flex-none h-[42px] px-5 bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all text-xs disabled:opacity-50"
                >
                  {loading ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <FaDatabase size={13} />
                  )}{" "}
                  Sincronizar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3 COLUMNAS IDÉNTICAS EN ESTRUCTURA Y TAMAÑO ESTÉTICO */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-hidden px-8 pb-8">
          {/* COLUMNA 1: LISTA ORIGEN */}
          <div className="col-span-1 md:col-span-3 bg-white rounded-3xl flex flex-col border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-white shrink-0 flex flex-col gap-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-widest">
                {modo === "PRODUCTO" ? (
                  <FaBoxOpen className="text-blue-500 text-lg" />
                ) : (
                  <FaCubes className="text-blue-500 text-lg" />
                )}
                {modo === "PRODUCTO" ? "Productos Term." : "Semielaborados"}
              </h3>
              <div className="relative">
                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar para editar..."
                  value={filtroIzq}
                  onChange={(e) => setFiltroIzq(e.target.value)}
                  className="w-full bg-slate-50 border border-transparent rounded-xl pl-9 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-2 custom-scrollbar flex-1 bg-[#f8fafc]">
              {noCoincideNinguno && (
                <div
                  onClick={crearNuevoProducto}
                  className="p-4 rounded-2xl cursor-pointer text-xs font-bold border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 mb-2 shadow-sm uppercase tracking-wider"
                >
                  <FaPlus /> Crear: "{filtroIzq.toUpperCase()}"
                </div>
              )}

              {listaIzquierdaVisible.length === 0 && !noCoincideNinguno ? (
                <div className="text-center text-slate-400 text-xs font-medium bg-white p-4 rounded-2xl border border-slate-200 border-dashed">
                  Sin coincidencias
                </div>
              ) : (
                listaIzquierdaVisible.map((item, i) => {
                  const key = modo === "PRODUCTO" ? i : item.id;
                  const label = modo === "PRODUCTO" ? item : item.nombre;
                  const codigo = modo === "PRODUCTO" ? null : item.codigo;
                  const isSelected =
                    modo === "PRODUCTO"
                      ? seleccionado === item
                      : seleccionado?.id === item.id;

                  return (
                    <div
                      key={key}
                      className={`p-3.5 rounded-2xl cursor-pointer transition-all duration-200 flex justify-between items-center group border ${isSelected ? "bg-white border-blue-400 text-blue-800 shadow-[0_4px_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-400" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"}`}
                      onClick={() => cargarReceta(item)}
                    >
                      <div className="flex flex-col flex-1 min-w-0 mr-2">
                        {modo === "SEMIELABORADO" && (
                          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase mb-0.5">
                            {codigo || "S/C"}
                          </span>
                        )}
                        <span className="truncate tracking-tight text-sm font-bold uppercase">
                          {label || "SIN NOMBRE"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {modo === "SEMIELABORADO" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductoParaVariantes(item);
                            }}
                            className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors border border-slate-200 hover:border-blue-200"
                            title="Variantes"
                          >
                            <FaLayerGroup size={13} />
                          </button>
                        )}
                        {modo === "SEMIELABORADO" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFichaSeleccionada(item);
                            }}
                            className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors border border-slate-200 hover:border-emerald-200"
                            title="Ficha Técnica"
                          >
                            <FaEye size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMNA 2: RECETA / MESA DE TRABAJO */}
          <div className="col-span-1 md:col-span-5 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
            <div className="p-5 border-b border-slate-100 bg-white shrink-0 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3 truncate tracking-tight">
                    <div className="p-2 bg-blue-50 text-blue-500 rounded-xl">
                      <FaTools size={16} />
                    </div>
                    <span className="truncate" title={nombreSeleccionado}>
                      {seleccionado ? nombreSeleccionado : "Selecciona un ítem"}
                    </span>
                  </h2>
                  {seleccionado && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                        Mesa de Trabajo
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <FaClock />{" "}
                        {ultimaModificacion
                          ? `Última edición: ${ultimaModificacion}`
                          : "Receta Nueva"}
                      </span>
                    </div>
                  )}
                </div>
                {seleccionado && (
                  <button
                    onClick={guardar}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-blue-200 flex items-center gap-2 text-xs transition-transform active:scale-95 shrink-0"
                  >
                    <FaSave size={14} /> Guardar Receta
                  </button>
                )}
              </div>

              {/* INPUT DE COSTO DE IMPORTACIÓN (NUEVO) */}
              {seleccionado && modo === "SEMIELABORADO" && (
                <div className="flex items-center justify-between bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 mt-1">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                    <FaBoxOpen className="text-emerald-500" size={16} /> Costo
                    de Importación (U$S)
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        className="w-24 pl-6 pr-2 py-1.5 text-sm font-black text-emerald-700 bg-white border border-emerald-200 rounded-lg outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all shadow-inner text-right"
                        value={costoImportacion}
                        onChange={(e) => setCostoImportacion(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      onClick={guardarCostoImportacion}
                      className="bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm uppercase tracking-wider"
                    >
                      Fijar Costo
                    </button>
                  </div>
                </div>
              )}

              {seleccionado && modo === "SEMIELABORADO" && (
                <div className="flex flex-col xl:flex-row gap-3">
                  <button
                    onClick={() => setShowCajonRecetas(true)}
                    className="flex-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-blue-700 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <FaFolderOpen size={14} /> Abrir Cajón de Versiones
                  </button>
                  <button
                    onClick={() =>
                      navigate(
                        `/producto/${encodeURIComponent(seleccionado.nombre)}`,
                      )
                    }
                    className="flex-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-emerald-700 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <FaHistory size={13} /> Ver Changelog
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 flex flex-col overflow-hidden flex-1 bg-[#f8fafc]">
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
                  <div className="mt-5 text-center shrink-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white border border-slate-200 px-5 py-2 rounded-xl shadow-sm">
                      Total: {receta.length} componentes
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm font-medium">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 text-slate-300 border border-slate-200 shadow-sm">
                    <FaArrowLeft className="text-2xl" />
                  </div>
                  Selecciona un ítem de la izquierda para abrir la mesa
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA 3: INSUMOS DISPONIBLES */}
          <div className="col-span-1 md:col-span-4 bg-white rounded-3xl flex flex-col border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-white shrink-0 flex flex-col gap-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-widest">
                {modo === "PRODUCTO" ? (
                  <FaCubes className="text-emerald-500 text-lg" />
                ) : (
                  <FaLeaf className="text-emerald-500 text-lg" />
                )}
                {modo === "PRODUCTO"
                  ? "Semielaborados Disp."
                  : "Materias Primas Disp."}
              </h3>
              <div className="relative">
                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar componente..."
                  value={filtroDer}
                  onChange={(e) => setFiltroDer(e.target.value)}
                  className="w-full bg-slate-50 border border-transparent rounded-xl pl-9 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 bg-[#f8fafc] custom-scrollbar flex-1">
              {listaDerechaVisible.length === 0 ? (
                <div className="text-center text-slate-400 text-xs font-bold tracking-widest bg-white p-4 rounded-2xl border border-slate-200 border-dashed">
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
