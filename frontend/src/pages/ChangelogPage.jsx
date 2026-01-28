import React, { useState, useEffect, useMemo } from "react";
import {
  FaHistory,
  FaPlus,
  FaPaperPlane,
  FaSearch,
  FaTag,
  FaImage,
  FaLink,
  FaLayerGroup,
  FaFlask,
  FaExchangeAlt,
  FaBan,
  FaCalendarAlt,
  FaUserCircle,
  FaFilter,
  FaChevronDown,
  FaChevronUp,
  FaChevronLeft,
  FaChevronRight,
  FaFilePdf,
  FaTimes,
  FaTrash, // <--- Icono Eliminar
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils";
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// --- SUB-COMPONENTE: FILA DE LOG COMPACTA ---
const LogRow = ({ log, configTipo, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const style = configTipo[log.tipo_cambio] || configTipo.MODIFICACION;
  const dateObj = new Date(log.fecha);

  // Ajuste visual de fecha para compensar zona horaria
  const fechaVisual = new Date(
    dateObj.getTime() + dateObj.getTimezoneOffset() * 60000,
  );

  const isImg =
    log.adjuntos_url && log.adjuntos_url.match(/\.(jpeg|jpg|gif|png|webp)$/);

  return (
    <div className="group flex gap-4 bg-slate-800/40 hover:bg-slate-800 border-b border-slate-700/50 p-4 transition-colors last:border-0 rounded-lg mb-2 relative">
      {/* 1. FECHA (COLUMNA IZQ) */}
      <div className="w-16 flex-shrink-0 flex flex-col items-center justify-start pt-1 text-gray-400 border-r border-slate-700/50 pr-4">
        <span className="text-2xl font-bold leading-none text-white">
          {fechaVisual.getDate()}
        </span>
        <span className="text-[10px] uppercase font-bold text-blue-400">
          {fechaVisual.toLocaleString("es-AR", { month: "short" })}
        </span>
        <span className="text-[9px] text-gray-600">
          {fechaVisual.getFullYear()}
        </span>
      </div>

      {/* 2. CONTENIDO PRINCIPAL */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2 pr-8">
          {/* TIPO */}
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${style.bg} ${style.color} ${style.border} border-opacity-30 bg-opacity-10`}
          >
            {style.icon} {style.label}
          </span>

          {/* PRODUCTO */}
          <h3
            className="text-base font-bold text-white truncate"
            title={log.producto}
          >
            {log.producto}
          </h3>

          {/* TAGS REFLECTIVOS */}
          {log.lleva_reflectiva && (
            <div className="flex items-center gap-1 ml-auto">
              <span
                className="text-[9px] bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded border border-blue-800"
                title={`Reflectiva: ${log.tipo_reflectiva}`}
              >
                {log.tipo_reflectiva}
              </span>
              <span
                className="text-[9px] bg-slate-700 text-gray-400 px-2 py-0.5 rounded border border-slate-600 hidden sm:inline-block"
                title={`Protector: ${log.tipo_protector}`}
              >
                {log.tipo_protector}
              </span>
            </div>
          )}
        </div>

        {/* DESCRIPCIÓN */}
        <div className="text-sm text-gray-300 leading-relaxed pr-2">
          <p
            className={`${!expanded ? "line-clamp-2" : ""} whitespace-pre-wrap`}
          >
            {log.descripcion}
          </p>
          {log.descripcion.length > 150 && (
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

        {/* FOOTER DE FILA */}
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

          <div className="flex items-center gap-3">
            {log.notificado_a && (
              <span
                className="text-[9px] text-gray-600 flex items-center gap-1"
                title={log.notificado_a}
              >
                <FaPaperPlane /> Enviado
              </span>
            )}
          </div>
        </div>
      </div>

      {/* BOTÓN ELIMINAR (SOLO VISIBLE AL HACER HOVER EN LA FILA) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(log.id);
        }}
        className="absolute top-3 right-3 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 rounded hover:bg-slate-700/50"
        title="Eliminar este registro"
      >
        <FaTrash size={12} />
      </button>
    </div>
  );
};

export default function ChangelogPage() {
  const [logs, setLogs] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Estados Filtro/Pag
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("TODOS");
  const [selectedMonth, setSelectedMonth] = useState("ALL");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // Formulario
  const [form, setForm] = useState({
    producto: "",
    tipo_cambio: "MODIFICACION",
    descripcion: "",
    responsable: "Ingeniería",
    emails_notificacion: "gerencia@tuempresa.com",
    fecha_manual: new Date().toISOString().split("T")[0],
    adjuntos_url: "",
    lleva_reflectiva: false,
    tipo_reflectiva: "Reflectiva China",
    tipo_protector: "Protector Chino",
    tipo_aplicacion: "Completa",
  });

  const configTipo = {
    NUEVO: {
      color: "text-emerald-400",
      border: "border-emerald-500",
      bg: "bg-emerald-500/10",
      icon: <FaPlus size={10} />,
      label: "Nuevo",
    },
    MODIFICACION: {
      color: "text-blue-400",
      border: "border-blue-500",
      bg: "bg-blue-500/10",
      icon: <FaExchangeAlt size={10} />,
      label: "Mod",
    },
    RECETA: {
      color: "text-purple-400",
      border: "border-purple-500",
      bg: "bg-purple-500/10",
      icon: <FaFlask size={10} />,
      label: "Receta",
    },
    OBSOLETO: {
      color: "text-rose-400",
      border: "border-rose-500",
      bg: "bg-rose-500/10",
      icon: <FaBan size={10} />,
      label: "Baja",
    },
    AJUSTE_RECETA: {
      color: "text-purple-400",
      border: "border-purple-500",
      bg: "bg-purple-500/10",
      icon: <FaFlask size={10} />,
      label: "Ajuste",
    },
  };

  useEffect(() => {
    fetchLogs();
    fetchProductos();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/changelog`);
      if (res.ok) setLogs(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchProductos = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/ingenieria/semielaborados`);
      if (res.ok) setAllProducts(await res.json());
    } catch (e) {}
  };

  // --- FUNCIÓN ELIMINAR ---
  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.",
      )
    )
      return;

    try {
      const res = await authFetch(`${API_BASE_URL}/changelog/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Actualizamos estado local para feedback instantáneo
        setLogs((prev) => prev.filter((l) => l.id !== id));
      } else {
        alert("Error al eliminar el registro.");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión.");
    }
  };

  // --- FILTROS ---
  const availableMonths = useMemo(() => {
    const months = new Set();
    logs.forEach((log) => {
      const d = new Date(log.fecha);
      const dVisual = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
      const key = `${dVisual.getFullYear()}-${String(dVisual.getMonth() + 1).padStart(2, "0")}`;
      months.add(key);
    });
    return Array.from(months).sort().reverse();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const d = new Date(l.fecha);
      const dLocal = new Date(d.getTime() + d.getTimezoneOffset() * 60000);

      const matchesSearch =
        l.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType =
        filterType === "TODOS" || l.tipo_cambio === filterType;

      let matchesDate = true;
      if (selectedMonth !== "ALL") {
        const logMonthKey = `${dLocal.getFullYear()}-${String(dLocal.getMonth() + 1).padStart(2, "0")}`;
        matchesDate = logMonthKey === selectedMonth;
      }
      if (dateRange.start && dateRange.end) {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59);
        matchesDate = dLocal >= start && dLocal <= end;
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [logs, searchTerm, filterType, selectedMonth, dateRange]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const currentData = filteredLogs.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterType, selectedMonth, dateRange]);

  // --- GUARDAR ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producto || !form.descripcion || !form.responsable)
      return alert("Completa los datos.");

    const dataToSend = { ...form };
    if (!form.lleva_reflectiva) {
      dataToSend.tipo_reflectiva = null;
      dataToSend.tipo_protector = null;
      dataToSend.tipo_aplicacion = null;
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/changelog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      if (res.ok) {
        alert("Guardado OK.");
        setShowModal(false);
        fetchLogs();
        setForm({
          ...form,
          descripcion: "",
          producto: "",
          adjuntos_url: "",
          lleva_reflectiva: false,
          tipo_protector: "Protector Chino",
        });
      }
    } catch (e) {
      alert("Error al guardar");
    }
  };

  const handleMonthSelect = (mKey) => {
    setSelectedMonth(mKey);
    setDateRange({ start: "", end: "" });
  };

  const formatMonthLabel = (key) => {
    const [year, month] = key.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleString("es-AR", { month: "long", year: "numeric" });
  };

  // --- EXPORTAR PDF ---
  const generarReportePDF = () => {
    if (filteredLogs.length === 0)
      return alert("No hay datos para exportar con los filtros actuales.");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    const grupos = {};
    filteredLogs.forEach((log) => {
      if (!grupos[log.producto]) grupos[log.producto] = [];
      grupos[log.producto].push(log);
    });

    const gruposOrdenados = Object.entries(grupos).sort((a, b) => {
      const logA = a[1][0];
      const logB = b[1][0];
      const dateA = new Date(logA.fecha);
      const dateB = new Date(logB.fecha);
      return dateB - dateA;
    });

    // Encabezado
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("REPORTE DE CAMBIOS DE INGENIERÍA", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);

    let rangoTexto = "Historial Completo";
    if (dateRange.start && dateRange.end) {
      rangoTexto = `Desde: ${new Date(dateRange.start).toLocaleDateString()} - Hasta: ${new Date(dateRange.end).toLocaleDateString()}`;
    } else if (selectedMonth !== "ALL") {
      rangoTexto = `Periodo: ${formatMonthLabel(selectedMonth)}`;
    }
    doc.text(rangoTexto, 14, 28);
    doc.text(
      `Generado: ${new Date().toLocaleDateString()}`,
      pageWidth - 14,
      28,
      { align: "right" },
    );

    let yPos = 50;

    gruposOrdenados.forEach(([producto, logsGrupo]) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(241, 245, 249);
      doc.rect(14, yPos - 6, pageWidth - 28, 10, "F");

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(producto, 16, yPos);

      yPos += 5;

      const tableBody = logsGrupo.map((log) => {
        const d = new Date(log.fecha);
        const fechaTxt = new Date(
          d.getTime() + d.getTimezoneOffset() * 60000,
        ).toLocaleDateString("es-AR");
        let desc = log.descripcion;
        if (log.lleva_reflectiva) {
          desc += `\n[Reflectiva: ${log.tipo_reflectiva} | ${log.tipo_protector || "-"}]`;
        }
        return [fechaTxt, log.tipo_cambio, desc, log.responsable];
      });

      autoTable(doc, {
        startY: yPos,
        head: [["FECHA", "TIPO", "DETALLE", "AUTORIZÓ"]],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3, textColor: [71, 85, 105] },
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 25, fontStyle: "bold" },
          1: { cellWidth: 30, fontStyle: "bold" },
          2: { cellWidth: "auto" },
          3: { cellWidth: 30 },
        },
        margin: { top: 10, bottom: 20 },
        didDrawPage: function (data) {
          yPos = data.cursor.y + 15;
        },
      });

      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" },
      );
    }

    doc.save(
      `Reporte_Ingenieria_${new Date().toISOString().split("T")[0]}.pdf`,
    );
  };

  return (
    <div className="max-w-7xl mx-auto pb-10 animate-in fade-in duration-500 px-4 pt-6">
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <FaHistory className="text-blue-500" /> Historial de Cambios
        </h1>
        <div className="flex gap-3">
          <button
            onClick={generarReportePDF}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all"
            title="Exportar reporte de lo que ves en pantalla"
          >
            <FaFilePdf /> Exportar PDF
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all"
          >
            <FaPlus /> Registrar Cambio
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="relative">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar producto..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {["TODOS", "MODIFICACION", "NUEVO", "RECETA"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded text-[10px] font-bold border w-full text-left transition-all ${
                  filterType === type
                    ? "bg-slate-700 text-white border-slate-500"
                    : "bg-slate-900/50 text-gray-500 border-slate-800 hover:border-slate-700"
                }`}
              >
                {type === "TODOS"
                  ? "Todos los tipos"
                  : configTipo[type]?.label || type}
              </button>
            ))}
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <FaCalendarAlt /> Periodo
            </h4>
            <ul className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-1">
              <li>
                <button
                  onClick={() => handleMonthSelect("ALL")}
                  className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors ${
                    selectedMonth === "ALL" && !dateRange.start
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:bg-slate-800"
                  }`}
                >
                  Todo el Historial
                </button>
              </li>
              {availableMonths.map((mKey) => (
                <li key={mKey}>
                  <button
                    onClick={() => handleMonthSelect(mKey)}
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

            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-[10px] text-gray-500 mb-2 uppercase font-bold">
                Rango Personalizado
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] text-white"
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start: e.target.value })
                  }
                />
                <input
                  type="date"
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] text-white"
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col h-full min-h-[600px]">
          <div className="flex-1 space-y-3">
            {loading && (
              <div className="text-center text-gray-500 py-10">
                Cargando bitácora...
              </div>
            )}

            {!loading && currentData.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                <FaFilter className="text-4xl mb-3 opacity-20" />
                <p>No se encontraron registros en este periodo.</p>
              </div>
            )}

            {currentData.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                configTipo={configTipo}
                onDelete={handleDelete} // <--- Pasando la función eliminar
              />
            ))}
          </div>

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

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 w-full max-w-lg rounded-xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                <h3 className="text-white text-sm font-bold flex items-center gap-2 uppercase tracking-wide">
                  <FaTag className="text-blue-500" /> Nuevo Registro
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                      Producto
                    </label>
                    <AutoCompleteInput
                      items={allProducts}
                      onSelect={(item) =>
                        setForm({ ...form, producto: item.nombre })
                      }
                      initialValue={form.producto}
                      placeholder="Seleccionar..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                        Tipo
                      </label>
                      <select
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-xs"
                        value={form.tipo_cambio}
                        onChange={(e) =>
                          setForm({ ...form, tipo_cambio: e.target.value })
                        }
                      >
                        <option value="MODIFICACION">Modificación</option>
                        <option value="NUEVO">Lanzamiento</option>
                        <option value="AJUSTE_RECETA">Ajuste Receta</option>
                        <option value="OBSOLETO">Baja</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                        Fecha
                      </label>
                      <input
                        type="date"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-2 text-white text-xs"
                        value={form.fecha_manual}
                        onChange={(e) =>
                          setForm({ ...form, fecha_manual: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                      Autoriza
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs font-bold"
                      placeholder="Nombre..."
                      value={form.responsable}
                      onChange={(e) =>
                        setForm({ ...form, responsable: e.target.value })
                      }
                    />
                  </div>

                  <div className="bg-slate-800/30 p-3 rounded border border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="checkReflectiva"
                        className="rounded bg-slate-700 border-slate-600 text-blue-600"
                        checked={form.lleva_reflectiva}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            lleva_reflectiva: e.target.checked,
                          })
                        }
                      />
                      <label
                        htmlFor="checkReflectiva"
                        className="text-xs font-bold text-gray-300 cursor-pointer"
                      >
                        Lleva Reflectiva
                      </label>
                    </div>
                    {form.lleva_reflectiva && (
                      <div className="grid grid-cols-1 gap-2 pl-4 border-l border-slate-600">
                        <select
                          className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs"
                          value={form.tipo_reflectiva}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              tipo_reflectiva: e.target.value,
                            })
                          }
                        >
                          <option value="Reflectiva China">
                            Reflectiva China
                          </option>
                          <option value="Reflectiva Avery">
                            Reflectiva Avery
                          </option>
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Lógica de Sin Protector */}
                          <select
                            className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs"
                            value={form.tipo_protector}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newApp =
                                val === "Sin Protector"
                                  ? "No Aplica"
                                  : form.tipo_aplicacion === "No Aplica"
                                    ? "Completa"
                                    : form.tipo_aplicacion;
                              setForm({
                                ...form,
                                tipo_protector: val,
                                tipo_aplicacion: newApp,
                              });
                            }}
                          >
                            <option value="Protector Chino">Prot. Chino</option>
                            <option value="Protector Orajet">
                              Prot. Orajet
                            </option>
                            <option value="Sin Protector">Sin Protector</option>
                          </select>
                          <select
                            className={`w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs ${form.tipo_protector === "Sin Protector" ? "opacity-50 cursor-not-allowed" : ""}`}
                            value={form.tipo_aplicacion}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                tipo_aplicacion: e.target.value,
                              })
                            }
                            disabled={form.tipo_protector === "Sin Protector"}
                          >
                            <option value="Completa">Completa</option>
                            <option value="Solo en la unión">Solo unión</option>
                            <option value="No Aplica">No Aplica</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                      Descripción
                    </label>
                    <textarea
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-xs h-20 resize-none"
                      placeholder="Detalles técnicos..."
                      value={form.descripcion}
                      onChange={(e) =>
                        setForm({ ...form, descripcion: e.target.value })
                      }
                    ></textarea>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block flex items-center gap-1">
                      <FaLink /> Adjunto (URL)
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white text-xs"
                      placeholder="https://..."
                      value={form.adjuntos_url}
                      onChange={(e) =>
                        setForm({ ...form, adjuntos_url: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                      Email Notificación
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white text-xs"
                      placeholder="emails..."
                      value={form.emails_notificacion}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          emails_notificacion: e.target.value,
                        })
                      }
                    />
                  </div>
                </form>
              </div>

              <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl shrink-0">
                <button
                  onClick={handleSubmit}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg flex justify-center items-center gap-2 text-sm"
                >
                  <FaPaperPlane /> Guardar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
