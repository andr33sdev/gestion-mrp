import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaHistory,
  FaUserShield,
  FaCalendarDay,
  FaTag,
  FaImage,
  FaLink,
  FaLayerGroup,
  FaShieldAlt,
  FaPaintRoller,
  FaChevronLeft,
  FaChevronRight,
  FaCalendarAlt,
  FaFilter,
  FaChevronDown,
  FaChevronUp,
  FaPaperPlane,
  FaUserCircle,
  FaFilePdf, // <--- Icono para el botón PDF
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils";
import { jsPDF } from "jspdf"; // <--- Importar jsPDF
import autoTable from "jspdf-autotable"; // <--- Importar autoTable

// --- SUB-COMPONENTE: FILA DE LOG ---
const LogRow = ({ log }) => {
  const [expanded, setExpanded] = useState(false);

  const getTypeStyle = (type) => {
    const map = {
      NUEVO: {
        color: "text-emerald-400",
        border: "border-emerald-500",
        bg: "bg-emerald-500/10",
        label: "Nuevo",
      },
      MODIFICACION: {
        color: "text-blue-400",
        border: "border-blue-500",
        bg: "bg-blue-500/10",
        label: "Modificación",
      },
      RECETA: {
        color: "text-purple-400",
        border: "border-purple-500",
        bg: "bg-purple-500/10",
        label: "Receta",
      },
      OBSOLETO: {
        color: "text-rose-400",
        border: "border-rose-500",
        bg: "bg-rose-500/10",
        label: "Baja",
      },
      AJUSTE_RECETA: {
        color: "text-purple-400",
        border: "border-purple-500",
        bg: "bg-purple-500/10",
        label: "Ajuste",
      },
    };
    return map[type] || map.MODIFICACION;
  };

  const style = getTypeStyle(log.tipo_cambio);
  const dateObj = new Date(log.fecha);
  // Corrección para zonas horarias: asegurarnos de mostrar la fecha correcta
  const fechaVisual = new Date(
    dateObj.getTime() + dateObj.getTimezoneOffset() * 60000,
  );

  const isImg =
    log.adjuntos_url && log.adjuntos_url.match(/\.(jpeg|jpg|gif|png|webp)$/);

  return (
    <div className="group flex gap-4 bg-slate-800/40 hover:bg-slate-800 border-b border-slate-700/50 p-4 transition-colors last:border-0 rounded-lg mb-2">
      <div className="w-14 flex-shrink-0 flex flex-col items-center justify-start pt-1 text-gray-400 border-r border-slate-700/50 pr-4">
        <span className="text-xl font-bold leading-none text-white">
          {fechaVisual.getDate()}
        </span>
        <span className="text-[10px] uppercase font-bold text-blue-400">
          {fechaVisual.toLocaleString("es-AR", { month: "short" })}
        </span>
        <span className="text-[9px] text-gray-600">
          {fechaVisual.getFullYear()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${style.bg} ${style.color} ${style.border} border-opacity-30 bg-opacity-10`}
          >
            {style.label}
          </span>

          {log.lleva_reflectiva && (
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[9px] bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded border border-blue-800 truncate max-w-[150px]">
                {log.tipo_reflectiva}
              </span>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-300 leading-relaxed pr-2">
          <p
            className={`${!expanded ? "line-clamp-2" : ""} whitespace-pre-wrap`}
          >
            {log.descripcion}
          </p>
          {log.descripcion.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-blue-400 hover:text-blue-300 text-[10px] font-bold flex items-center gap-1 mt-1 focus:outline-none"
            >
              {expanded ? (
                <>
                  <FaChevronUp /> Menos
                </>
              ) : (
                <>
                  <FaChevronDown /> Más
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/30">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
              <FaUserCircle className="text-slate-500" /> {log.responsable}
            </span>
            {log.adjuntos_url && (
              <a
                href={log.adjuntos_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 hover:underline"
              >
                {isImg ? <FaImage /> : <FaLink />} Ver Adjunto
              </a>
            )}
          </div>
          {log.notificado_a && (
            <span
              className="text-[9px] text-gray-600 flex items-center gap-1"
              title={log.notificado_a}
            >
              <FaPaperPlane /> Notificado
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default function DetalleProducto() {
  const { nombre } = useParams();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(nombre);

  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [selectedMonth, setSelectedMonth] = useState("ALL");

  useEffect(() => {
    cargarHistorial();
  }, [decodedName]);

  const cargarHistorial = async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/changelog/${encodeURIComponent(decodedName)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setHistorial(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Specs vigentes
  const currentSpecs = useMemo(() => {
    const specLog = historial.find((log) => log.lleva_reflectiva === true);
    if (specLog) {
      return {
        tiene: true,
        reflectiva: specLog.tipo_reflectiva,
        protector: specLog.tipo_protector,
        aplicacion: specLog.tipo_aplicacion,
        fecha: specLog.fecha,
      };
    }
    return { tiene: false };
  }, [historial]);

  // Filtros y Paginación
  const availableMonths = useMemo(() => {
    const months = new Set();
    historial.forEach((log) => {
      const d = new Date(log.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.add(key);
    });
    return Array.from(months).sort().reverse();
  }, [historial]);

  const filteredLogs = useMemo(() => {
    if (selectedMonth === "ALL") return historial;
    return historial.filter((l) => {
      const d = new Date(l.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === selectedMonth;
    });
  }, [historial, selectedMonth]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const currentData = filteredLogs.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  useEffect(() => setPage(1), [selectedMonth]);

  const formatMonthLabel = (key) => {
    const [year, month] = key.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleString("es-AR", { month: "long", year: "numeric" });
  };

  // --- FUNCIÓN DE EXPORTACIÓN PDF ---
  const generarPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // 1. Encabezado "Premium"
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, 45, "F"); // Barra superior oscura

    // Título Producto
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    // Cortar texto si es muy largo
    const title =
      decodedName.length > 35
        ? decodedName.substring(0, 32) + "..."
        : decodedName;
    doc.text(title, 14, 22);

    // Subtítulo
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("HOJA DE VIDA / HISTORIAL TÉCNICO", 14, 30);

    // Fecha Reporte (derecha)
    const fechaImpresion = new Date().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    doc.setFontSize(9);
    doc.text(`Generado: ${fechaImpresion}`, pageWidth - 14, 22, {
      align: "right",
    });
    doc.text("Sistema de Gestión MRP", pageWidth - 14, 30, { align: "right" });

    let yPos = 55;

    // 2. Ficha Técnica Vigente (Si Aplica)
    if (currentSpecs.tiene) {
      // Título Sección
      doc.setTextColor(51, 65, 85); // Slate 700
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("ESPECIFICACIÓN VIGENTE DE REFLECTIVOS", 14, yPos);

      yPos += 5;

      // Recuadro
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.roundedRect(14, yPos, pageWidth - 28, 25, 2, 2, "FD");

      yPos += 10;

      // Datos en columnas
      doc.setFontSize(9);

      // Col 1: Reflectiva
      doc.setTextColor(100, 116, 139); // Label color
      doc.text("REFLECTIVA", 20, yPos);
      doc.setTextColor(15, 23, 42); // Value color
      doc.setFont("helvetica", "bold");
      doc.text(currentSpecs.reflectiva || "-", 20, yPos + 6);

      // Col 2: Protector
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("PROTECTOR", 80, yPos);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text(currentSpecs.protector || "-", 80, yPos + 6);

      // Col 3: Aplicación
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("APLICACIÓN", 140, yPos);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text(currentSpecs.aplicacion || "-", 140, yPos + 6);

      yPos += 25; // Salto para la tabla
    } else {
      // Si no tiene specs, saltamos menos
      yPos += 5;
    }

    // 3. Tabla de Historial (Filtrado actual o todo)
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("BITÁCORA DE CAMBIOS", 14, yPos);
    yPos += 4;

    // Preparar datos para autoTable
    // Usamos 'historial' completo o 'filteredLogs' según prefieras exportar todo o lo que ves
    const dataExport = filteredLogs.length > 0 ? filteredLogs : historial;

    const tableBody = dataExport.map((log) => {
      const d = new Date(log.fecha);
      // Ajuste zona horaria manual para PDF
      const fechaTxt = new Date(
        d.getTime() + d.getTimezoneOffset() * 60000,
      ).toLocaleDateString("es-AR");

      let desc = log.descripcion;
      // Agregar detalles técnicos al texto si existen
      if (log.lleva_reflectiva) {
        desc += `\n[Reflectiva: ${log.tipo_reflectiva} | ${log.tipo_protector || "Sin Prot."}]`;
      }

      return [fechaTxt, log.tipo_cambio, desc, log.responsable];
    });

    autoTable(doc, {
      startY: yPos,
      head: [["FECHA", "TIPO EVENTO", "DETALLE TÉCNICO", "RESPONSABLE"]],
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 4,
        textColor: [71, 85, 105], // Slate 600
        valign: "middle",
        lineWidth: 0.1,
        lineColor: [226, 232, 240],
      },
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: 255,
        fontStyle: "bold",
        halign: "left",
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 25, fontStyle: "bold" }, // Fecha
        1: { cellWidth: 35, fontStyle: "bold" }, // Tipo
        2: { cellWidth: "auto" }, // Detalle
        3: { cellWidth: 35 }, // Responsable
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // Slate 50 very light
      },
      // Hook para colorear el texto de la columna TIPO
      didParseCell: function (data) {
        if (data.section === "body" && data.column.index === 1) {
          const tipo = data.cell.raw;
          if (tipo === "NUEVO") data.cell.styles.textColor = [16, 185, 129]; // Emerald
          if (tipo === "MODIFICACION")
            data.cell.styles.textColor = [59, 130, 246]; // Blue
          if (tipo === "OBSOLETO") data.cell.styles.textColor = [244, 63, 94]; // Rose
          if (tipo === "RECETA" || tipo === "AJUSTE_RECETA")
            data.cell.styles.textColor = [168, 85, 247]; // Purple
        }
      },
    });

    // Numeración de páginas
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, {
        align: "center",
      });
    }

    doc.save(`Ficha_Tecnica_${decodedName.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 px-4 pt-6">
      {/* HEADER DE NAVEGACIÓN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-slate-800 rounded-lg text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <FaArrowLeft />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              {decodedName}
            </h1>
            <p className="text-xs text-gray-400 flex items-center gap-2">
              <FaHistory /> Hoja de Vida / Historial Técnico
            </p>
          </div>
        </div>

        {/* BOTÓN PDF */}
        <button
          onClick={generarPDF}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg transition-all active:scale-95"
        >
          <FaFilePdf /> Exportar PDF
        </button>
      </div>

      {/* --- PANEL DE ESPECIFICACIONES VIGENTES --- */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <FaLayerGroup className="text-9xl text-white" />
        </div>

        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-700/50 pb-2">
          <FaTag /> Especificación Vigente
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {/* Reflectiva */}
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-900/30 rounded text-blue-400">
                <FaLayerGroup />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase">
                Lámina Reflectiva
              </span>
            </div>
            <p className="text-lg font-bold text-white pl-1">
              {currentSpecs.tiene
                ? currentSpecs.reflectiva
                : "No Aplica / Estándar"}
            </p>
          </div>

          {/* Protector */}
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-900/30 rounded text-purple-400">
                <FaShieldAlt />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase">
                Protector
              </span>
            </div>
            <p className="text-lg font-bold text-white pl-1">
              {currentSpecs.tiene ? currentSpecs.protector : "-"}
            </p>
          </div>

          {/* Aplicación */}
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-900/30 rounded text-emerald-400">
                <FaPaintRoller />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase">
                Tipo Aplicación
              </span>
            </div>
            <p className="text-lg font-bold text-white pl-1">
              {currentSpecs.tiene ? currentSpecs.aplicacion : "-"}
            </p>
          </div>
        </div>

        {currentSpecs.tiene && (
          <p className="text-[10px] text-gray-500 mt-4 text-right">
            * Según modificación del{" "}
            {new Date(currentSpecs.fecha).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* --- CONTENIDO PRINCIPAL: FILTROS + LISTA --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* COLUMNA IZQ: FILTROS TIEMPO */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 sticky top-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <FaCalendarAlt /> Filtrar Periodo
            </h4>
            {loading ? (
              <div className="text-gray-600 text-xs">Cargando fechas...</div>
            ) : (
              <ul className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                <li>
                  <button
                    onClick={() => setSelectedMonth("ALL")}
                    className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors ${
                      selectedMonth === "ALL"
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:bg-slate-800"
                    }`}
                  >
                    Historial Completo ({historial.length})
                  </button>
                </li>
                {availableMonths.map((mKey) => (
                  <li key={mKey}>
                    <button
                      onClick={() => setSelectedMonth(mKey)}
                      className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors capitalize ${
                        selectedMonth === mKey
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:bg-slate-800"
                      }`}
                    >
                      {formatMonthLabel(mKey)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* COLUMNA DER: LISTA DE CAMBIOS */}
        <div className="lg:col-span-3 flex flex-col min-h-[500px]">
          <div className="flex-1 space-y-3">
            {loading && (
              <div className="text-center text-gray-500 py-10">
                Cargando bitácora...
              </div>
            )}

            {!loading && currentData.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                <FaFilter className="text-3xl mb-3 opacity-20" />
                <p className="text-sm">No hay registros en este periodo.</p>
              </div>
            )}

            {currentData.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>

          {/* PAGINACIÓN */}
          {!loading && totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-4 py-4 border-t border-slate-800">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 disabled:opacity-50 text-white transition-colors"
              >
                <FaChevronLeft />
              </button>
              <span className="text-sm text-gray-400 font-mono">
                Página <span className="text-white font-bold">{page}</span> de{" "}
                {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 disabled:opacity-50 text-white transition-colors"
              >
                <FaChevronRight />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
