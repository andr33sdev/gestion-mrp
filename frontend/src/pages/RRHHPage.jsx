import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FaUpload,
  FaUserClock,
  FaFileExcel,
  FaExclamationTriangle,
  FaFire,
  FaSearch,
  FaUsers,
  FaCalendarAlt,
  FaEraser,
  FaMoon,
  FaCheckDouble,
  FaCalendarCheck,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaInfoCircle,
  FaStar,
  FaStopwatch,
  FaMoneyBillWave,
  FaFilePdf,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils";

// --- COMPONENTE: CALENDARIO FERIADOS ---
function FeriadosModal({ onClose, feriadosSet, onToggleDate }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-slate-900/90 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-purple-500 to-blue-500"></div>
        <div className="p-5 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-white font-bold flex items-center gap-3 text-lg">
            <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
              <FaCalendarCheck />
            </div>
            Gestionar Feriados
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={18} />
          </button>
        </div>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-2 hover:bg-white/10 rounded-lg text-white transition-all"
            >
              <FaChevronLeft />
            </button>
            <span className="font-bold text-white uppercase tracking-widest text-sm">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-2 hover:bg-white/10 rounded-lg text-white transition-all"
            >
              <FaChevronRight />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center mb-2">
            {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map((d) => (
              <span
                key={d}
                className="text-[10px] font-bold text-gray-500 uppercase"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {blanks.map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((d) => {
              const dateStr = `${year}-${String(month + 1).padStart(
                2,
                "0"
              )}-${String(d).padStart(2, "0")}`;
              const isFeriado = feriadosSet.has(dateStr);
              const dayOfWeek = new Date(year, month, d).getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              return (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  key={d}
                  onClick={() => onToggleDate(dateStr)}
                  className={`
                    h-9 rounded-lg text-xs font-bold transition-all relative flex items-center justify-center
                    ${
                      isFeriado
                        ? "bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg shadow-red-900/50 ring-1 ring-red-400"
                        : "bg-slate-800/50 text-gray-400 hover:bg-slate-700 hover:text-white"
                    }
                    ${
                      !isFeriado && isWeekend
                        ? "text-orange-400 bg-orange-900/10 border border-orange-500/20"
                        : ""
                    }
                  `}
                >
                  {d}
                </motion.button>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500 bg-white/5 p-3 rounded-lg border border-white/5">
            <FaInfoCircle /> Los días marcados en{" "}
            <span className="text-red-400 font-bold">ROJO</span> pagan al 100%.
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function RRHHPage() {
  const [datosProcesados, setDatosProcesados] = useState([]);
  const [jornadaLaboral, setJornadaLaboral] = useState(9);
  const [feriadosSet, setFeriadosSet] = useState(new Set());
  const [showFeriadosModal, setShowFeriadosModal] = useState(false);

  // Filtros
  const [filtroOperario, setFiltroOperario] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [rawDataCache, setRawDataCache] = useState(null);

  useEffect(() => {
    cargarFeriados();
  }, []);

  const cargarFeriados = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/feriados`);
      if (res.ok) {
        const fechas = await res.json();
        setFeriadosSet(new Set(fechas));
      }
    } catch (e) {
      console.error("Error feriados", e);
    }
  };

  const toggleFeriado = async (fechaStr) => {
    try {
      const newSet = new Set(feriadosSet);
      if (newSet.has(fechaStr)) newSet.delete(fechaStr);
      else newSet.add(fechaStr);
      setFeriadosSet(newSet);
      await authFetch(`${API_BASE_URL}/feriados/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: fechaStr }),
      });
    } catch (e) {
      console.error(e);
      cargarFeriados();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setRawDataCache(data);
    };
    reader.readAsBinaryString(file);
  };

  useEffect(() => {
    if (rawDataCache) procesarDatos(rawDataCache);
  }, [feriadosSet, jornadaLaboral, rawDataCache]);

  const procesarDatos = (rawData) => {
    const porPersona = {};
    rawData.forEach((row) => {
      const nombre =
        row["Nombre"] || row["Name"] || row["Person Name"] || row["nombre"];
      const tiempoStr =
        row["Tiempo"] || row["Time"] || row["tiempo"] || row["Fecha/Hora"];
      const eventoRaw =
        row["Evento de Asistencia"] || row["Estado"] || row["Tipo"] || "";
      if (!nombre || !tiempoStr) return;
      let fechaObj =
        typeof tiempoStr === "number"
          ? new Date((tiempoStr - (25567 + 2)) * 86400 * 1000)
          : new Date(tiempoStr);
      if (!fechaObj || isNaN(fechaObj.getTime())) return;
      if (!porPersona[nombre]) porPersona[nombre] = [];
      porPersona[nombre].push({
        fecha: fechaObj,
        evento: eventoRaw.toString().toUpperCase(),
      });
    });

    const resultados = [];
    Object.keys(porPersona).forEach((nombre) => {
      let fichadas = porPersona[nombre].sort((a, b) => a.fecha - b.fecha);
      const fichadasLimpias = [];
      if (fichadas.length > 0) {
        fichadasLimpias.push(fichadas[0]);
        for (let i = 1; i < fichadas.length; i++) {
          const prev = fichadasLimpias[fichadasLimpias.length - 1];
          if ((fichadas[i].fecha - prev.fecha) / (1000 * 60) > 5)
            fichadasLimpias.push(fichadas[i]);
        }
      }
      fichadas = fichadasLimpias;

      let i = 0;
      while (i < fichadas.length) {
        const entrada = fichadas[i];
        let salida = null;
        let proximoIndice = i + 1;
        if (i + 1 < fichadas.length) {
          const posible = fichadas[i + 1];
          const diff = (posible.fecha - entrada.fecha) / 36e5;
          if (diff < 24) {
            salida = posible;
            proximoIndice = i + 2;
          }
        }

        let horasTotales = 0;
        let hsNormales = 0;
        let hsExtras = 0;
        let hsFeriado100 = 0;
        let hsExtras100 = 0;
        let estado = "OK";
        let esNocturno = false;

        const year = entrada.fecha.getFullYear();
        const month = String(entrada.fecha.getMonth() + 1).padStart(2, "0");
        const day = String(entrada.fecha.getDate()).padStart(2, "0");
        const fechaISO = `${year}-${month}-${day}`;
        const esFeriado = feriadosSet.has(fechaISO);
        const dayOfWeek = entrada.fecha.getDay();
        const esFinDeSemana = dayOfWeek === 0 || dayOfWeek === 6;
        const dia100 = esFeriado;

        const nombreDia = entrada.fecha
          .toLocaleDateString("es-AR", { weekday: "short" })
          .toUpperCase();
        const fechaVisual = entrada.fecha.toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const fechaFiltro = new Date(
          year,
          entrada.fecha.getMonth(),
          entrada.fecha.getDate()
        );
        const entradaStr = entrada.fecha.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        let salidaStr = "--:--";

        if (salida) {
          salidaStr = salida.fecha.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          if (salida.fecha.getDate() !== entrada.fecha.getDate())
            esNocturno = true;
          horasTotales = (salida.fecha - entrada.fecha) / 36e5;

          if (dia100) {
            if (horasTotales > jornadaLaboral) {
              hsFeriado100 = jornadaLaboral;
              const rawExtra = horasTotales - jornadaLaboral;
              if (rawExtra > 0) hsExtras100 = Math.floor(rawExtra * 2) / 2;
            } else {
              hsFeriado100 = horasTotales;
              hsExtras100 = 0;
            }
          } else if (esFinDeSemana) {
            if (horasTotales > 0) hsExtras = Math.floor(horasTotales * 2) / 2;
          } else {
            if (horasTotales > jornadaLaboral) {
              hsNormales = jornadaLaboral;
              const rawExtra = horasTotales - jornadaLaboral;
              if (rawExtra > 0) hsExtras = Math.floor(rawExtra * 2) / 2;
            } else {
              hsNormales = horasTotales;
              hsExtras = 0;
            }
          }
        } else {
          estado = "INCOMPLETO";
        }

        resultados.push({
          id: nombre + entrada.fecha.getTime(),
          nombre,
          fechaVisual,
          nombreDia,
          esFinDeSemana,
          esFeriado,
          fechaFiltro,
          entrada: entradaStr,
          salida: salidaStr,
          hsNormales: Number(hsNormales.toFixed(2)),
          hsExtras: Number(hsExtras.toFixed(2)),
          hsFeriado100: Number(hsFeriado100.toFixed(2)),
          hsExtras100: Number(hsExtras100.toFixed(2)),
          horasTotales: Number(horasTotales.toFixed(2)),
          estado,
          esNocturno,
        });
        i = proximoIndice;
      }
    });

    setDatosProcesados(
      resultados.sort((a, b) => {
        if (a.nombre === b.nombre) return a.fechaFiltro - b.fechaFiltro;
        return a.nombre.localeCompare(b.nombre);
      })
    );
  };

  const listaEmpleados = useMemo(
    () => Array.from(new Set(datosProcesados.map((d) => d.nombre))).sort(),
    [datosProcesados]
  );

  const datosFiltrados = useMemo(() => {
    return datosProcesados.filter((row) => {
      if (filtroOperario && row.nombre !== filtroOperario) return false;
      if (fechaInicio) {
        const [y, m, d] = fechaInicio.split("-");
        if (row.fechaFiltro < new Date(y, m - 1, d)) return false;
      }
      if (fechaFin) {
        const [y, m, d] = fechaFin.split("-");
        if (row.fechaFiltro > new Date(y, m - 1, d)) return false;
      }
      return true;
    });
  }, [datosProcesados, filtroOperario, fechaInicio, fechaFin]);

  const resumen = useMemo(() => {
    return datosFiltrados.reduce(
      (acc, curr) => ({
        norm: acc.norm + curr.hsNormales,
        extra: acc.extra + curr.hsExtras,
        fer100: acc.fer100 + curr.hsFeriado100,
        ex100: acc.ex100 + curr.hsExtras100,
      }),
      { norm: 0, extra: 0, fer100: 0, ex100: 0 }
    );
  }, [datosFiltrados]);

  const limpiarFiltros = () => {
    setFiltroOperario("");
    setFechaInicio("");
    setFechaFin("");
  };

  // --- FUNCIÓN EXPORTAR PDF ---
  const generarReportePDF = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString("es-AR");
    const hora = new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Encabezado
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE ASISTENCIA Y HORAS", 14, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`Generado: ${fecha} ${hora}`, 14, 25);
    doc.text("Gestión MRP - Módulo RRHH", 195, 18, { align: "right" });

    // Tabla de Resumen
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen de Totales", 14, 40);

    autoTable(doc, {
      startY: 42,
      head: [["Hs Normales", "Hs Extras", "Feriado 100%", "Extra 100%"]],
      body: [
        [
          resumen.norm.toFixed(2),
          resumen.extra.toFixed(2),
          resumen.fer100.toFixed(2),
          resumen.ex100.toFixed(2),
        ],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: { fontStyle: "bold", halign: "center" },
      columnStyles: {
        1: { textColor: [16, 185, 129] }, // Emerald
        2: { textColor: [249, 115, 22] }, // Orange
        3: { textColor: [220, 38, 38] }, // Red
      },
    });

    // Tabla Detallada
    doc.text(
      `Detalle de Movimientos (${datosFiltrados.length} registros)`,
      14,
      doc.lastAutoTable.finalY + 15
    );

    const bodyData = datosFiltrados.map((r) => [
      r.nombre,
      `${r.fechaVisual} ${r.esFeriado ? "(FER)" : ""}`,
      `${r.entrada} - ${r.salida}`,
      r.hsNormales || "-",
      r.hsExtras || "-",
      r.hsFeriado100 ? `${r.hsFeriado100} (${r.hsFeriado100 * 2})` : "-",
      r.hsExtras100 ? `${r.hsExtras100} (${r.hsExtras100 * 2})` : "-",
      r.horasTotales,
      r.estado,
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 17,
      head: [
        [
          "Empleado",
          "Fecha",
          "Horario",
          "Norm",
          "Extra",
          "100%",
          "Ex 100%",
          "Total",
          "Estado",
        ],
      ],
      body: bodyData,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 }, // Slate 800
      columnStyles: {
        4: { fontStyle: "bold", textColor: [16, 185, 129] },
        5: { fontStyle: "bold", textColor: [249, 115, 22] },
        6: { fontStyle: "bold", textColor: [220, 38, 38] },
        7: { fontStyle: "bold", halign: "center" },
        8: { fontSize: 7, halign: "center" },
      },
      didParseCell: function (data) {
        if (data.column.index === 8 && data.cell.raw === "INCOMPLETO") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    // Footer con número de página
    const pages = doc.internal.getNumberOfPages();
    for (let j = 1; j <= pages; j++) {
      doc.setPage(j);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${j} de ${pages}`, 105, 290, { align: "center" });
    }

    doc.save(`Nomina_${fecha.replace(/\//g, "-")}.pdf`);
  };

  return (
    <div className="animate-in fade-in space-y-6 pb-20 p-4 md:p-8">
      <AnimatePresence>
        {showFeriadosModal && (
          <FeriadosModal
            onClose={() => setShowFeriadosModal(false)}
            feriadosSet={feriadosSet}
            onToggleDate={toggleFeriado}
          />
        )}
      </AnimatePresence>

      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700/50 shadow-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mt-20 -mr-20"></div>

        <div className="z-10">
          <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-4 tracking-tight">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl shadow-lg">
              <FaUserClock className="text-white text-2xl" />
            </div>
            Gestión RRHH
          </h1>
          <p className="text-gray-400 text-sm mt-2 ml-1 flex items-center gap-2">
            <FaCheckDouble className="text-emerald-500" /> Algoritmo de Turno
            Continuo & Feriados
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto items-end md:items-center z-10">
          <div className="flex flex-col md:flex-row gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-sm w-full md:w-auto shadow-inner">
            <div className="flex items-center bg-slate-950/50 rounded-xl border border-slate-700 px-3 py-1 flex-1">
              <FaSearch className="text-gray-500 mr-2" />
              <select
                value={filtroOperario}
                onChange={(e) => setFiltroOperario(e.target.value)}
                className="bg-transparent text-white text-sm p-2 outline-none cursor-pointer w-full md:w-48 appearance-none font-medium"
                disabled={datosProcesados.length === 0}
              >
                <option value="" className="bg-slate-900">
                  Todos los Empleados
                </option>
                {listaEmpleados.map((emp) => (
                  <option
                    className="bg-slate-900 text-gray-200"
                    key={emp}
                    value={emp}
                  >
                    {emp}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="bg-slate-950/50 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 outline-none cursor-pointer hover:border-slate-500 transition-colors"
              />
              <span className="text-gray-600 font-bold">→</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="bg-slate-950/50 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 outline-none cursor-pointer hover:border-slate-500 transition-colors"
              />
            </div>

            {(filtroOperario || fechaInicio || fechaFin) && (
              <button
                onClick={limpiarFiltros}
                className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/20"
                title="Limpiar filtros"
              >
                <FaEraser />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFeriadosModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-600 transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <FaCalendarCheck className="text-red-400" /> Feriados
            </button>
            <button
              onClick={generarReportePDF}
              disabled={datosProcesados.length === 0}
              className="bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <FaFilePdf /> PDF
            </button>
            <label className="cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all active:scale-95 whitespace-nowrap border border-white/10">
              <FaUpload /> Importar
              <input
                type="file"
                accept=".xls,.xlsx,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>
      </div>

      {datosProcesados.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Hs Normales",
              val: resumen.norm,
              color: "text-white",
              border: "border-slate-600",
              bg: "from-slate-800 to-slate-900",
              icon: <FaUserClock />,
            },
            {
              label: "Hs Extras",
              val: resumen.extra,
              color: "text-emerald-400",
              border: "border-emerald-500/50",
              bg: "from-emerald-900/20 to-slate-900",
              icon: <FaStopwatch />,
            },
            {
              label: "Feriado 100% (Base)",
              val: resumen.fer100,
              color: "text-orange-400",
              border: "border-orange-500/50",
              bg: "from-orange-900/20 to-slate-900",
              icon: <FaStar />,
            },
            {
              label: "Extra 100% (Exceso)",
              val: resumen.ex100,
              color: "text-red-400",
              border: "border-red-500/50",
              bg: "from-red-900/20 to-slate-900",
              icon: <FaMoneyBillWave />,
            },
          ].map((kpi, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-gradient-to-br ${kpi.bg} p-5 rounded-2xl border ${kpi.border} shadow-xl relative overflow-hidden`}
            >
              <div
                className={`absolute top-3 right-3 text-2xl opacity-20 ${kpi.color}`}
              >
                {kpi.icon}
              </div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                {kpi.label}
              </p>
              <p className={`text-3xl font-black ${kpi.color} font-mono`}>
                {kpi.val.toFixed(1)}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-700 bg-slate-800/80 backdrop-blur flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <FaFileExcel className="text-green-500" /> Nómina Detallada
            </h3>
            <div className="hidden md:flex items-center gap-2 text-[10px] text-gray-500 uppercase font-bold bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Live
              Data
            </div>
          </div>
          <span className="text-xs text-gray-400 font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            {datosFiltrados.length} Registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-slate-950 text-gray-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-5">Empleado</th>
                <th className="p-5">Fecha</th>
                <th className="p-5 text-center">Fichada (E / S)</th>
                <th className="p-5 text-center bg-slate-900/50">Normales</th>
                <th className="p-5 text-center bg-emerald-900/10 text-emerald-500">
                  Extras
                </th>
                <th className="p-5 text-center bg-orange-900/10 text-orange-400">
                  100% (Base)
                </th>
                <th className="p-5 text-center bg-red-900/10 text-red-400">
                  Extra 100%
                </th>
                <th className="p-5 text-center text-white">Total Hs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {datosFiltrados.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`transition-all hover:bg-slate-800/60 ${
                    idx % 2 === 0 ? "bg-transparent" : "bg-slate-800/20"
                  }`}
                >
                  <td className="p-5 font-bold text-white">{row.nombre}</td>
                  <td className="p-5 font-mono text-gray-400">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <FaCalendarAlt className="text-slate-600 text-xs" />{" "}
                        {row.fechaVisual}
                      </span>
                      {row.esFeriado && (
                        <span className="text-[9px] w-fit bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold tracking-wide">
                          FERIADO
                        </span>
                      )}
                      {!row.esFeriado && row.esFinDeSemana && (
                        <span className="text-[9px] w-fit bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded font-bold">
                          {row.nombreDia}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-5 text-center text-xs">
                    {row.estado === "INCOMPLETO" ? (
                      <span className="text-red-400 bg-red-900/20 px-3 py-1 rounded-full border border-red-500/20 flex items-center justify-center gap-2 font-bold w-fit mx-auto">
                        <FaExclamationTriangle /> ERROR
                      </span>
                    ) : (
                      <div className="flex flex-col items-center gap-1 font-mono">
                        <span className="text-emerald-400 bg-emerald-900/10 px-2 rounded">
                          {row.entrada}
                        </span>
                        <span className="text-gray-500 text-[10px]">▼</span>
                        <span className="text-blue-300 bg-blue-900/10 px-2 rounded flex items-center gap-1">
                          {row.salida}{" "}
                          {row.esNocturno && (
                            <FaMoon className="text-[9px] text-yellow-400" />
                          )}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-5 text-center font-mono font-bold bg-slate-900/30 border-x border-slate-800/50">
                    {row.hsNormales || "-"}
                  </td>
                  <td className="p-5 text-center font-mono font-bold text-emerald-400 bg-emerald-900/5 border-r border-slate-800/50">
                    {row.hsExtras || "-"}
                  </td>
                  <td className="p-5 text-center font-mono font-bold text-orange-400 bg-orange-900/5 border-r border-slate-800/50">
                    {row.hsFeriado100 ? (
                      <div className="flex flex-col items-center">
                        <span>{row.hsFeriado100}</span>
                        <span className="text-[10px] text-orange-500/60 font-normal">
                          ({row.hsFeriado100 * 2})
                        </span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-5 text-center font-mono font-bold text-red-400 bg-red-900/5 border-r border-slate-800/50">
                    {row.hsExtras100 ? (
                      <div className="flex flex-col items-center">
                        <span>{row.hsExtras100}</span>
                        <span className="text-[10px] text-red-500/60 font-normal">
                          ({row.hsExtras100 * 2})
                        </span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-5 text-center font-black text-white text-lg">
                    {row.horasTotales}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
