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
  FaCalendarCheck,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaInfoCircle,
  FaStar,
  FaStopwatch,
  FaMoneyBillWave,
  FaFilePdf,
  FaUsersCog,
  FaPlus,
  FaEdit,
  FaTrash,
  FaGripVertical,
  FaDollarSign,
  FaTag,
  FaFileInvoiceDollar,
  FaSave,
  FaHistory,
  FaPrint,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import { API_BASE_URL, authFetch } from "../utils";

// --- FUNCIÓN AUXILIAR PARA COLOR DE TAGS ---
const getCategoryColor = (catName) => {
  if (!catName) return "bg-slate-100 text-slate-500 border-slate-200";
  const colors = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-teal-50 text-teal-700 border-teal-200",
    "bg-orange-50 text-orange-700 border-orange-200",
    "bg-pink-50 text-pink-700 border-pink-200",
  ];
  const index = catName.length % colors.length;
  return colors[index];
};

// --- COMPONENTES AUXILIARES (DRAG & DROP) ---
function DraggableEmployee({ name, categoryId }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: name, data: { name, categoryId } });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
      }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white hover:bg-slate-50 p-2 rounded mb-1 text-[11px] text-slate-700 flex items-center gap-2 cursor-grab active:cursor-grabbing shadow-sm border border-slate-200 transition-all ${
        isDragging
          ? "opacity-90 ring-2 ring-blue-100 border-blue-300 scale-[1.02]"
          : ""
      }`}
    >
      <FaGripVertical className="text-slate-400" />{" "}
      <span className="truncate font-medium">{name}</span>
    </div>
  );
}

function DroppableCategory({ category, employees, onEdit, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cat-${category.id}`,
    data: { categoryId: category.id },
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col h-56 bg-slate-50 rounded-xl border transition-all shadow-sm overflow-hidden ${
        isOver
          ? "border-blue-400 bg-blue-50 ring-2 ring-blue-50"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="px-3 py-2 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
        <div className="min-w-0">
          <h4
            className="font-bold text-slate-700 text-[11px] truncate uppercase tracking-wider"
            title={category.nombre}
          >
            {category.nombre}
          </h4>
          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
            <FaDollarSign size={10} /> {category.valor_hora} / hr
          </span>
        </div>
        <div className="flex gap-1 ml-2">
          <button
            onClick={() => onEdit(category)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            <FaEdit size={11} />
          </button>
          <button
            onClick={() => onDelete(category.id)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <FaTrash size={11} />
          </button>
        </div>
      </div>
      <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
        {employees.map((emp) => (
          <DraggableEmployee key={emp} name={emp} categoryId={category.id} />
        ))}
        {employees.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-[10px] italic opacity-80 uppercase tracking-widest font-medium">
            <span>Vacío</span>
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200 text-[9px] font-bold uppercase tracking-widest text-slate-500 text-center">
        {employees.length} Operarios
      </div>
    </div>
  );
}

// --- MODALES (COMPACTADOS) ---
function GestionPersonalModal({ onClose, empleadosExcel, onUpdate }) {
  const [categorias, setCategorias] = useState([]);
  const [asignaciones, setAsignaciones] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [editCat, setEditCat] = useState(null);
  const [formCat, setFormCat] = useState({ nombre: "", valor_hora: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [resCat, resPers] = await Promise.all([
        authFetch(`${API_BASE_URL}/rrhh/categorias`),
        authFetch(`${API_BASE_URL}/rrhh/personal`),
      ]);
      const cats = await resCat.json();
      const pers = await resPers.json();
      setCategorias(cats);
      const mapAsign = {};
      pers.forEach((p) => (mapAsign[p.nombre] = p.categoria_id));
      setAsignaciones(mapAsign);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && over.id.toString().startsWith("cat-")) {
      const empName = active.id;
      const catId = Number(over.id.split("-")[1]);
      setAsignaciones((prev) => ({ ...prev, [empName]: catId }));
      try {
        await authFetch(`${API_BASE_URL}/rrhh/personal/asignar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: empName, categoria_id: catId }),
        });
        onUpdate();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSaveCat = async () => {
    if (!formCat.nombre) return;
    try {
      const url = editCat
        ? `${API_BASE_URL}/rrhh/categorias/${editCat.id}`
        : `${API_BASE_URL}/rrhh/categorias`;
      const method = editCat ? "PUT" : "POST";
      await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formCat),
      });
      setFormCat({ nombre: "", valor_hora: "" });
      setEditCat(null);
      loadData();
      onUpdate();
    } catch (e) {
      alert("Error al guardar categoría");
    }
  };

  const handleDeleteCat = async (id) => {
    if (!confirm("¿Eliminar?")) return;
    await authFetch(`${API_BASE_URL}/rrhh/categorias/${id}`, {
      method: "DELETE",
    });
    loadData();
    onUpdate();
  };

  const unassigned = empleadosExcel.filter((name) => !asignaciones[name]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center z-20">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
            <FaUsersCog className="text-blue-500" /> Asignación de Personal
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex gap-3 items-end z-10">
          <div>
            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">
              Nueva Categoría
            </label>
            <input
              className="w-48 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-xs outline-none focus:border-blue-400"
              value={formCat.nombre}
              onChange={(e) =>
                setFormCat({ ...formCat, nombre: e.target.value })
              }
              placeholder="Ej: Oficial Múltiple"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">
              Valor Hora ($)
            </label>
            <input
              type="number"
              className="w-28 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-xs outline-none focus:border-blue-400"
              value={formCat.valor_hora}
              onChange={(e) =>
                setFormCat({ ...formCat, valor_hora: e.target.value })
              }
              placeholder="0.00"
            />
          </div>
          <button
            onClick={handleSaveCat}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-2 transition-all shadow-sm"
          >
            {editCat ? <FaEdit /> : <FaPlus />}{" "}
            {editCat ? "Actualizar" : "Añadir"}
          </button>
          {editCat && (
            <button
              onClick={() => {
                setEditCat(null);
                setFormCat({ nombre: "", valor_hora: "" });
              }}
              className="text-slate-500 hover:text-slate-800 text-[10px] font-bold px-2 py-1.5 underline"
            >
              Cancelar
            </button>
          )}
        </div>

        <DndContext
          onDragStart={(e) => setActiveId(e.active.id)}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex overflow-hidden bg-white">
            <div className="w-56 bg-slate-50 border-r border-slate-200 flex flex-col p-4 shrink-0 shadow-inner z-10">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FaUsers className="text-slate-400" /> Sin Asignar
                </span>
                <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                  {unassigned.length}
                </span>
              </h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div className="flex flex-col gap-1">
                  {unassigned.map((name) => (
                    <DraggableEmployee key={name} name={name} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-[#f8fafc]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                {categorias.map((cat) => (
                  <DroppableCategory
                    key={cat.id}
                    category={cat}
                    employees={empleadosExcel.filter(
                      (name) => asignaciones[name] === cat.id,
                    )}
                    onEdit={(c) => {
                      setEditCat(c);
                      setFormCat({
                        nombre: c.nombre,
                        valor_hora: c.valor_hora,
                      });
                    }}
                    onDelete={handleDeleteCat}
                  />
                ))}
              </div>
            </div>
          </div>
          <DragOverlay>
            {activeId ? (
              <div className="bg-slate-800 p-2 rounded-lg text-white text-[11px] shadow-lg font-bold transform rotate-2 w-48 truncate flex items-center gap-2">
                <FaGripVertical className="opacity-50" /> {activeId}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </motion.div>
    </div>
  );
}

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden relative"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-slate-800 font-bold flex items-center gap-2 text-sm">
            <FaCalendarCheck className="text-red-500" /> Gestionar Feriados
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
          >
            <FaTimes />
          </button>
        </div>
        <div className="p-5">
          <div className="flex justify-between items-center mb-5">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-all"
            >
              <FaChevronLeft size={12} />
            </button>
            <span className="font-bold text-slate-700 uppercase tracking-widest text-xs">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-all"
            >
              <FaChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map((d) => (
              <span
                key={d}
                className="text-[9px] font-bold text-slate-400 uppercase tracking-widest"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {blanks.map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((d) => {
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const isFeriado = feriadosSet.has(dateStr);
              const dayOfWeek = new Date(year, month, d).getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              return (
                <button
                  key={d}
                  onClick={() => onToggleDate(dateStr)}
                  className={`h-8 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center border ${
                    isFeriado
                      ? "bg-red-500 text-white border-red-600 shadow-sm"
                      : isWeekend
                        ? "bg-orange-50 text-orange-600 border-orange-200"
                        : "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-col gap-1.5 text-[9px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-red-500"></span> Feriado
              (Paga 100%)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-orange-100 border border-orange-200"></span>{" "}
              Fin de Semana (Horas Extras)
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function HistorialModal({ onClose, onPrint }) {
  const [cierres, setCierres] = useState([]);
  useEffect(() => {
    authFetch(`${API_BASE_URL}/rrhh/cierres`)
      .then((res) => res.json())
      .then(setCierres)
      .catch(console.error);
  }, []);

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este cierre histórico?")) return;
    try {
      await authFetch(`${API_BASE_URL}/rrhh/cierres/${id}`, {
        method: "DELETE",
      });
      setCierres((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert("Error al eliminar el cierre.");
    }
  };

  const handlePrint = async (id) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/rrhh/cierres/${id}`);
      const data = await res.json();
      onPrint(data.datos_snapshot, data.nombre_periodo);
    } catch (e) {
      alert("Error al generar PDF");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden relative"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-slate-800 font-bold flex items-center gap-2 text-sm">
            <FaHistory className="text-purple-500" /> Historial de Cierres
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
          >
            <FaTimes />
          </button>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {cierres.length === 0 ? (
            <div className="text-center py-8 flex flex-col items-center gap-2">
              <FaHistory className="text-3xl text-slate-200" />
              <p className="text-slate-400 text-xs">
                No hay cierres guardados.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cierres.map((c) => (
                <div
                  key={c.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center hover:border-slate-300 transition-colors"
                >
                  <div>
                    <h4 className="text-slate-700 font-bold text-sm">
                      {c.nombre_periodo}
                    </h4>
                    <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-widest">
                      {new Date(c.fecha_creacion).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest">
                        Liquidado
                      </p>
                      <p className="text-emerald-600 font-bold text-sm">
                        ${Number(c.total_pagado).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handlePrint(c.id)}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-2 rounded-lg border border-slate-200 transition-colors"
                        title="Imprimir Recibos"
                      >
                        <FaPrint size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Eliminar"
                      >
                        <FaTrash size={12} />
                      </button>
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

// --- LÓGICA DE TOLERANCIA MATEMÁTICA ---
const aplicarTolerancia = (fechaObj) => {
  if (!fechaObj) return null;
  const d = new Date(fechaObj.getTime());
  const min = d.getMinutes();

  d.setSeconds(0);
  d.setMilliseconds(0);

  if (min <= 14) {
    d.setMinutes(0);
  } else if (min >= 15 && min <= 44) {
    d.setMinutes(30);
  } else if (min >= 45) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  }
  return d;
};

// --- COMPONENTE PRINCIPAL ---
export default function RRHHPage() {
  const [datosProcesados, setDatosProcesados] = useState([]);
  const [jornadaLaboral, setJornadaLaboral] = useState(9);
  const [feriadosSet, setFeriadosSet] = useState(new Set());
  const [personalMap, setPersonalMap] = useState({});
  const [showFeriadosModal, setShowFeriadosModal] = useState(false);
  const [showGestionModal, setShowGestionModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [filtroOperario, setFiltroOperario] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [rawDataCache, setRawDataCache] = useState(null);

  useEffect(() => {
    cargarFeriados();
    cargarPersonalMap();
  }, []);

  const cargarFeriados = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/feriados`);
      if (res.ok) setFeriadosSet(new Set(await res.json()));
    } catch (e) {
      console.error(e);
    }
  };

  const cargarPersonalMap = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/rrhh/personal`);
      const data = await res.json();
      const map = {};
      data.forEach((p) => {
        map[p.nombre] = {
          categoria: p.categoria_nombre || "Sin Categoría",
          valorHora: Number(p.valor_hora) || 0,
        };
      });
      setPersonalMap(map);
    } catch (e) {
      console.error(e);
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

      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
      let headerRowIndex = 0;
      for (let i = 0; i < aoa.length; i++) {
        if (
          aoa[i].some(
            (cell) =>
              typeof cell === "string" &&
              (cell.includes("Nombre Completo") ||
                cell.includes("Nº de Empleado")),
          )
        ) {
          headerRowIndex = i;
          break;
        }
      }

      const data = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex });
      setRawDataCache(data);
    };
    reader.readAsBinaryString(file);
  };

  useEffect(() => {
    if (rawDataCache) procesarDatos(rawDataCache);
  }, [feriadosSet, jornadaLaboral, rawDataCache, personalMap]);

  const procesarDatos = (rawData) => {
    const porPersona = {};

    rawData.forEach((row) => {
      const nombre =
        row["Nombre Completo"] ||
        row["Nombre"] ||
        row["Name"] ||
        row["Person Name"] ||
        row["nombre"];
      const tiempoStr =
        row["Fecha"] ||
        row["Tiempo"] ||
        row["Time"] ||
        row["tiempo"] ||
        row["Fecha/Hora"];
      const eventoRaw =
        row["Tipo grabación"] ||
        row["Evento de Asistencia"] ||
        row["Estado"] ||
        row["Tipo"] ||
        "Desconocido";

      if (!nombre || !tiempoStr) return;

      let fechaObj;
      if (typeof tiempoStr === "number") {
        const utcDate = new Date((tiempoStr - (25567 + 2)) * 86400 * 1000);
        fechaObj = new Date(
          utcDate.getTime() + utcDate.getTimezoneOffset() * 60000,
        );
      } else {
        const str = String(tiempoStr).trim();
        const partes = str.split(/[- :T/]/);
        if (partes.length >= 5) {
          fechaObj = new Date(
            partes[0],
            partes[1] - 1,
            partes[2],
            partes[3],
            partes[4],
            partes[5] || 0,
          );
        } else {
          fechaObj = new Date(str.replace(" ", "T"));
        }
      }

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
          if ((fichadas[i].fecha - prev.fecha) / (1000 * 60) > 5) {
            fichadasLimpias.push(fichadas[i]);
          }
        }
      }

      let i = 0;
      while (i < fichadasLimpias.length) {
        const registroActual = fichadasLimpias[i];

        if (!registroActual.evento.includes("INGRESO")) {
          i++;
          continue;
        }

        const entrada = registroActual;
        let salida = null;
        let proximoIndice = i + 1;

        if (proximoIndice < fichadasLimpias.length) {
          const posibleSalida = fichadasLimpias[proximoIndice];

          if (posibleSalida.evento.includes("SALIDA")) {
            const diff = (posibleSalida.fecha - entrada.fecha) / 36e5;
            if (diff <= 24) {
              salida = posibleSalida;
              proximoIndice++;
            }
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
          entrada.fecha.getDate(),
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

          const entradaTolerada = aplicarTolerancia(entrada.fecha);
          const salidaTolerada = aplicarTolerancia(salida.fecha);
          horasTotales = (salidaTolerada - entradaTolerada) / 36e5;

          if (dia100) {
            if (horasTotales > jornadaLaboral) {
              hsFeriado100 = jornadaLaboral;
              const rawExtra = horasTotales - jornadaLaboral;
              if (rawExtra > 0) hsExtras100 = rawExtra;
            } else {
              hsFeriado100 = horasTotales;
              hsExtras100 = 0;
            }
          } else if (esFinDeSemana) {
            if (horasTotales > 0) hsExtras = horasTotales;
            hsNormales = 0;
          } else {
            if (horasTotales > jornadaLaboral) {
              hsNormales = jornadaLaboral;
              const rawExtra = horasTotales - jornadaLaboral;
              if (rawExtra > 0) hsExtras = rawExtra;
            } else {
              hsNormales = horasTotales;
              hsExtras = 0;
            }
          }
        } else {
          estado = "INCOMPLETO";
        }

        const personalInfo = personalMap[nombre] || {
          categoria: "",
          valorHora: 0,
        };
        const valorHora = personalInfo.valorHora;
        const liquidacionExtra = hsExtras * (valorHora * 1.5);
        const liquidacionFeriado = hsFeriado100 * (valorHora * 2);
        const liquidacionExtra100 = hsExtras100 * (valorHora * 2);
        const totalLiquidacion =
          liquidacionExtra + liquidacionFeriado + liquidacionExtra100;

        resultados.push({
          id: nombre + entrada.fecha.getTime(),
          nombre,
          categoria: personalInfo.categoria,
          valorHora,
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
          liquidacionExtra,
          liquidacionFeriado,
          liquidacionExtra100,
          totalLiquidacion,
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
      }),
    );
  };

  const listaEmpleados = useMemo(
    () => Array.from(new Set(datosProcesados.map((d) => d.nombre))).sort(),
    [datosProcesados],
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
        totalPesos: acc.totalPesos + curr.totalLiquidacion,
      }),
      { norm: 0, extra: 0, fer100: 0, ex100: 0, totalPesos: 0 },
    );
  }, [datosFiltrados]);

  const limpiarFiltros = () => {
    setFiltroOperario("");
    setFechaInicio("");
    setFechaFin("");
  };
  const formatCurrency = (val) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(val);

  // --- REPORTES PDF ---
  const generarReportePDF = () => {
    try {
      const doc = new jsPDF("l", "mm", "a4");
      const fecha = new Date().toLocaleDateString("es-AR");

      const textDark = [30, 41, 59];
      const textMuted = [100, 116, 139];
      const borderLight = [226, 232, 240];

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 130, 246);
      doc.text("CONOFLEX", 15, 20);

      doc.setFontSize(12);
      doc.setTextColor(...textDark);
      doc.text("REPORTE DE ASISTENCIA Y LIQUIDACIÓN", 55, 20);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textMuted);
      doc.text(`Generado: ${fecha}`, 280, 20, { align: "right" });

      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.2);
      doc.line(15, 25, 282, 25);

      const isSingle = !!filtroOperario;
      const pInfo = isSingle ? personalMap[filtroOperario] : null;
      const valBase = pInfo ? pInfo.valorHora : 0;

      const hNorm = isSingle
        ? `Hs Normales\n(Base: ${formatCurrency(valBase)})`
        : "Hs Normales";
      const hExtra = isSingle
        ? `Hs Extras\n(x1.5: ${formatCurrency(valBase * 1.5)})`
        : "Hs Extras";
      const hFer = isSingle
        ? `Feriado 100%\n(x2: ${formatCurrency(valBase * 2)})`
        : "Feriado 100%";

      autoTable(doc, {
        startY: 30,
        head: [[hNorm, hExtra, hFer, "Extra 100%", "Total a Liquidar ($)"]],
        body: [
          [
            resumen.norm.toFixed(2),
            resumen.extra.toFixed(2),
            resumen.fer100.toFixed(2),
            resumen.ex100.toFixed(2),
            formatCurrency(resumen.totalPesos),
          ],
        ],
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [100, 116, 139],
          fontStyle: "bold",
          halign: "center",
          lineColor: [226, 232, 240],
        },
        bodyStyles: {
          fontStyle: "bold",
          halign: "center",
          textColor: [30, 41, 59],
        },
        columnStyles: { 4: { textColor: [5, 150, 105], fontSize: 9 } },
      });

      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...textMuted);
      doc.text(
        `DETALLE DE MOVIMIENTOS (${datosFiltrados.length} registros)`,
        15,
        finalY,
      );

      const bodyData = datosFiltrados.map((r) => [
        r.nombre,
        r.categoria || "-",
        `${r.fechaVisual} ${r.esFeriado ? "(FER)" : ""}`,
        `${r.entrada} - ${r.salida}`,
        r.hsNormales || "-",
        r.hsExtras || "-",
        r.hsFeriado100 || "-",
        r.hsExtras100 || "-",
        formatCurrency(r.totalLiquidacion),
      ]);

      autoTable(doc, {
        startY: finalY + 3,
        head: [
          [
            "Empleado",
            "Categoría",
            "Fecha",
            "Horario",
            "Norm",
            "Extra",
            "100%",
            "Ex 100%",
            "Total $",
          ],
        ],
        body: bodyData,
        theme: "striped",
        styles: { fontSize: 7.5, cellPadding: 2, valign: "middle" },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [100, 116, 139],
          fontStyle: "bold",
          halign: "center",
          lineColor: [226, 232, 240],
        },
        columnStyles: {
          4: { halign: "center" },
          5: { halign: "center", fontStyle: "bold", textColor: [22, 163, 74] },
          6: { halign: "center", fontStyle: "bold", textColor: [217, 119, 6] },
          7: { halign: "center", fontStyle: "bold", textColor: [225, 29, 72] },
          8: { fontStyle: "bold", halign: "right", textColor: [30, 41, 59] },
        },
      });

      doc.save(`Liquidacion_${fecha.replace(/\//g, "-")}.pdf`);
    } catch (e) {
      alert("Error al generar PDF");
    }
  };

  const generarRecibosPDF = (dataToPrint = datosFiltrados, titulo = null) => {
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const fechaGen = new Date().toLocaleDateString("es-AR");

      const dataNormalizada = dataToPrint.map((r) => ({
        ...r,
        categoria: r.categoria || personalMap[r.nombre]?.categoria || "-",
        valorHora: r.valorHora || personalMap[r.nombre]?.valorHora || 0,
      }));

      const empleados = {};
      dataNormalizada.forEach((row) => {
        if (!empleados[row.nombre]) empleados[row.nombre] = [];
        empleados[row.nombre].push(row);
      });
      const nombres = Object.keys(empleados);

      nombres.forEach((nombre, index) => {
        if (index > 0) doc.addPage();
        const regs = empleados[nombre];
        const info = {
          categoria: regs[0].categoria,
          valorHora: regs[0].valorHora,
        };

        const totalNorm = regs.reduce((a, b) => a + b.hsNormales, 0);
        const totalExtra = regs.reduce((a, b) => a + b.hsExtras, 0);
        const totalFer = regs.reduce((a, b) => a + b.hsFeriado100, 0);
        const totalEx100 = regs.reduce((a, b) => a + b.hsExtras100, 0);
        const totalPlata = regs.reduce((a, b) => a + b.totalLiquidacion, 0);

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(59, 130, 246);
        doc.text("CONOFLEX", 15, 20);

        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text(
          titulo ? `RECIBO HISTÓRICO: ${titulo}` : "LIQUIDACIÓN DE ADICIONALES",
          50,
          20,
        );

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`EMISIÓN: ${fechaGen}`, 195, 20, { align: "right" });

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(15, 24, 195, 24);

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 28, 180, 16, 2, 2, "F");
        doc.roundedRect(15, 28, 180, 16, 2, 2, "S");

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("EMPLEADO:", 20, 34);
        doc.setFont("helvetica", "normal");
        doc.text(nombre.toUpperCase(), 45, 34);

        doc.setFont("helvetica", "bold");
        doc.text("CATEGORÍA:", 20, 40);
        doc.setFont("helvetica", "normal");
        doc.text(info.categoria, 45, 40);

        doc.setFont("helvetica", "bold");
        doc.text("VALOR HORA:", 130, 37);
        doc.setFont("helvetica", "normal");
        doc.text(formatCurrency(info.valorHora), 155, 37);

        const bodyRecibo = regs.map((r) => [
          r.fechaVisual,
          `${r.entrada} - ${r.salida}`,
          r.hsNormales || "-",
          r.hsExtras || "-",
          r.hsFeriado100 || "-",
          r.hsExtras100 || "-",
          formatCurrency(r.totalLiquidacion),
        ]);

        autoTable(doc, {
          startY: 48,
          head: [
            [
              "Fecha",
              "Horario",
              "Norm",
              "Extra",
              "100%",
              "Ex 100%",
              "Subtotal",
            ],
          ],
          body: bodyRecibo,
          theme: "striped",
          styles: {
            fontSize: 7.5,
            cellPadding: 2,
            valign: "middle",
            textColor: [71, 85, 105],
            lineColor: [241, 245, 249],
          },
          headStyles: {
            fillColor: [248, 250, 252],
            textColor: [100, 116, 139],
            fontStyle: "bold",
          },
          columnStyles: {
            6: { halign: "right", fontStyle: "bold", textColor: [30, 41, 59] },
          },
        });

        const finalY = doc.lastAutoTable.finalY + 6;

        autoTable(doc, {
          startY: finalY,
          head: [["Concepto", "Cant.", "Subtotal"]],
          body: [
            ["Horas Normales", totalNorm.toFixed(2), "-"],
            [
              "Extras (50%)",
              totalExtra.toFixed(2),
              formatCurrency(totalExtra * info.valorHora * 1.5),
            ],
            [
              "Feriados (100%)",
              totalFer.toFixed(2),
              formatCurrency(totalFer * info.valorHora * 2),
            ],
            [
              "Extras 100%",
              totalEx100.toFixed(2),
              formatCurrency(totalEx100 * info.valorHora * 2),
            ],
          ],
          theme: "plain",
          styles: { fontSize: 8, cellPadding: 1.5, textColor: [30, 41, 59] },
          headStyles: { fontStyle: "bold", textColor: [100, 116, 139] },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 20, halign: "center" },
            2: { cellWidth: 30, halign: "right" },
          },
          margin: { left: 105 },
        });

        const totalY = doc.lastAutoTable.finalY + 4;
        doc.setFillColor(5, 150, 105);
        doc.roundedRect(105, totalY, 90, 10, 1, 1, "F");
        doc.setTextColor(255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL ADICIONALES", 110, totalY + 7);
        doc.text(formatCurrency(totalPlata), 190, totalY + 7, {
          align: "right",
        });

        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "normal");
        doc.text("Firma Empleado: ________________________", 15, totalY + 7);
      });

      const fName = titulo
        ? `Recibos_${titulo.replace(/\s+/g, "_")}.pdf`
        : `Recibos_Individuales_${fechaGen.replace(/\//g, "-")}.pdf`;
      doc.save(fName);
    } catch (e) {
      alert("Error al generar recibos");
    }
  };

  const handleGuardarCierre = async () => {
    const nombrePeriodo = prompt(
      "Nombre para este cierre (Ej: Marzo 1ra Quincena):",
    );
    if (!nombrePeriodo) return;
    try {
      await authFetch(`${API_BASE_URL}/rrhh/cierres`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_periodo: nombrePeriodo,
          total_pagado: resumen.totalPesos,
          cantidad_empleados: new Set(datosProcesados.map((d) => d.nombre))
            .size,
          datos_snapshot: datosProcesados,
        }),
      });
      alert("¡Cierre guardado en el historial!");
    } catch (e) {
      alert("Error al guardar cierre");
    }
  };

  return (
    <div className="animate-in fade-in space-y-4 pb-10 p-4 md:p-6 min-h-screen bg-[#f4f7f9] font-sans text-slate-800">
      <AnimatePresence>
        {showFeriadosModal && (
          <FeriadosModal
            onClose={() => setShowFeriadosModal(false)}
            feriadosSet={feriadosSet}
            onToggleDate={toggleFeriado}
          />
        )}
        {showGestionModal && (
          <GestionPersonalModal
            onClose={() => setShowGestionModal(false)}
            empleadosExcel={listaEmpleados}
            onUpdate={cargarPersonalMap}
          />
        )}
        {showHistorialModal && (
          <HistorialModal
            onClose={() => setShowHistorialModal(false)}
            onPrint={generarRecibosPDF}
          />
        )}
      </AnimatePresence>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col gap-4 z-10">
        <div className="flex items-center justify-between w-full border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 shadow-sm border border-blue-100">
              <FaUserClock size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-none mb-1 flex items-center gap-2">
                Recursos Humanos
                <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm uppercase tracking-widest">
                  Enterprise
                </span>
              </h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                Control de Asistencia & Liquidación
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-3 w-full items-end xl:items-center justify-between">
          <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-1 shadow-sm">
              <FaSearch className="text-slate-400 mr-2 text-[10px]" />
              <select
                value={filtroOperario}
                onChange={(e) => setFiltroOperario(e.target.value)}
                className="bg-transparent text-slate-700 text-xs font-bold outline-none cursor-pointer w-full md:w-40 appearance-none"
                disabled={datosProcesados.length === 0}
              >
                <option value="">Todos los empleados</option>
                {listaEmpleados.map((emp) => (
                  <option key={emp} value={emp}>
                    {emp}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 shadow-sm">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="bg-transparent text-slate-600 font-bold text-[10px] uppercase px-1 py-1.5 outline-none cursor-pointer"
              />
              <span className="text-slate-300 font-bold text-xs">→</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="bg-transparent text-slate-600 font-bold text-[10px] uppercase px-1 py-1.5 outline-none cursor-pointer"
              />
            </div>
            {(filtroOperario || fechaInicio || fechaFin) && (
              <button
                onClick={limpiarFiltros}
                className="p-2 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-all border border-red-100 shadow-sm"
                title="Limpiar filtros"
              >
                <FaEraser size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center bg-slate-50 border border-slate-200 p-1 rounded-xl shadow-sm gap-1">
            <div className="flex gap-0.5">
              <button
                onClick={() => setShowGestionModal(true)}
                className="px-3 py-1.5 hover:bg-white text-slate-500 hover:text-blue-600 rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
              >
                <FaUsersCog size={12} /> Personal
              </button>
              <button
                onClick={() => setShowFeriadosModal(true)}
                className="px-3 py-1.5 hover:bg-white text-slate-500 hover:text-red-500 rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
              >
                <FaCalendarCheck size={12} /> Feriados
              </button>
            </div>
            <div className="w-px h-4 bg-slate-200 hidden md:block mx-1"></div>
            <div className="flex gap-0.5">
              <button
                onClick={() => setShowHistorialModal(true)}
                className="px-3 py-1.5 hover:bg-white text-slate-500 hover:text-purple-600 rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
              >
                <FaHistory size={12} /> Historial
              </button>
              <button
                onClick={handleGuardarCierre}
                disabled={datosProcesados.length === 0}
                className="px-3 py-1.5 hover:bg-white text-slate-500 hover:text-emerald-600 rounded-lg transition-all shadow-sm disabled:opacity-30 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
              >
                <FaSave size={12} /> Guardar
              </button>
            </div>
            <div className="w-px h-4 bg-slate-200 hidden md:block mx-1"></div>
            <div className="flex gap-0.5">
              <button
                onClick={generarReportePDF}
                disabled={datosProcesados.length === 0}
                className="px-3 py-1.5 hover:bg-white text-slate-500 hover:text-slate-800 rounded-lg transition-all shadow-sm disabled:opacity-30 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
              >
                <FaFilePdf size={12} /> Lista
              </button>
              <button
                onClick={() => generarRecibosPDF()}
                disabled={datosProcesados.length === 0}
                className="px-3 py-1.5 hover:bg-white text-slate-500 hover:text-slate-800 rounded-lg transition-all shadow-sm disabled:opacity-30 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
              >
                <FaFileInvoiceDollar size={12} /> Recibos
              </button>
            </div>
          </div>

          <div>
            <label className="cursor-pointer bg-slate-800 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 shadow transition-all active:scale-95 whitespace-nowrap text-[9px] uppercase tracking-widest">
              <FaUpload size={12} />{" "}
              <span className="hidden md:inline">Importar Fichero</span>
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Hs Normales",
              val: resumen.norm,
              color: "text-slate-700",
              iconColor: "text-slate-300",
              icon: <FaUserClock />,
            },
            {
              label: "Hs Extras",
              val: resumen.extra,
              color: "text-emerald-600",
              iconColor: "text-emerald-100",
              icon: <FaStopwatch />,
            },
            {
              label: "Feriado 100%",
              val: resumen.fer100,
              color: "text-orange-500",
              iconColor: "text-orange-100",
              icon: <FaStar />,
            },
            {
              label: "Extra 100%",
              val: resumen.ex100,
              color: "text-red-500",
              iconColor: "text-red-100",
              icon: <FaFire />,
            },
            {
              label: "Total a Liquidar",
              val: resumen.totalPesos,
              isMoney: true,
              color: "text-blue-600",
              iconColor: "text-blue-100",
              icon: <FaMoneyBillWave />,
            },
          ].map((kpi, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden"
            >
              <div
                className={`absolute top-3 right-3 text-2xl opacity-40 ${kpi.iconColor}`}
              >
                {kpi.icon}
              </div>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mb-1 relative z-10">
                {kpi.label}
              </p>
              <p
                className={`text-xl font-black ${kpi.color} tracking-tight relative z-10 truncate`}
              >
                {kpi.isMoney ? formatCurrency(kpi.val) : kpi.val.toFixed(2)}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm tracking-tight">
              <FaFileExcel className="text-emerald-500" /> Nómina Detallada
            </h3>
          </div>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
            {datosFiltrados.length} Registros
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-white text-slate-400 uppercase text-[9px] font-bold tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-center">Fichada</th>
                <th className="px-4 py-3 text-center">Norm</th>
                <th className="px-4 py-3 text-center text-emerald-500">
                  Extra
                </th>
                <th className="px-4 py-3 text-center text-orange-400">
                  Fer (100%)
                </th>
                <th className="px-4 py-3 text-center text-red-400">Ex 100%</th>
                <th className="px-4 py-3 text-right text-slate-700 bg-slate-50">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datosFiltrados.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-slate-50/50"
                >
                  <td className="px-4 py-2.5 font-bold text-slate-800">
                    <div>{row.nombre}</div>
                    {row.categoria && (
                      <span
                        className={`inline-flex items-center gap-1 mt-1 text-[8px] px-1.5 py-0.5 rounded border uppercase tracking-widest font-black ${getCategoryColor(row.categoria)}`}
                      >
                        <FaTag size={8} /> {row.categoria}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="flex items-center gap-1.5">
                        <FaCalendarAlt className="text-slate-300" />{" "}
                        {row.fechaVisual}
                      </span>
                      {row.esFeriado ? (
                        <span className="text-[8px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-[1px] rounded uppercase font-bold tracking-widest">
                          Feriado
                        </span>
                      ) : row.esFinDeSemana ? (
                        <span className="text-[8px] bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-[1px] rounded uppercase font-bold tracking-widest">
                          {row.nombreDia}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.estado === "INCOMPLETO" ? (
                      <span className="text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100 flex items-center justify-center gap-1 font-bold w-fit mx-auto text-[10px]">
                        <FaExclamationTriangle /> Omitida
                      </span>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5 font-mono font-bold text-slate-500">
                        <span>{row.entrada}</span>
                        <span className="text-slate-300 text-[8px]">▼</span>
                        <span className="flex items-center gap-1">
                          {row.salida}{" "}
                          {row.esNocturno && (
                            <FaMoon className="text-[8px] text-blue-400" />
                          )}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center font-bold text-slate-500 bg-slate-50/30 border-x border-slate-100">
                    {row.hsNormales || "-"}
                  </td>
                  <td className="px-4 py-2.5 text-center font-black text-emerald-600 bg-emerald-50/20 border-r border-slate-100">
                    {row.hsExtras || "-"}
                  </td>
                  <td className="px-4 py-2.5 text-center font-black text-orange-500 bg-orange-50/20 border-r border-slate-100">
                    {row.hsFeriado100 || "-"}
                  </td>
                  <td className="px-4 py-2.5 text-center font-black text-red-500 bg-red-50/20 border-r border-slate-100">
                    {row.hsExtras100 || "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-black text-blue-600 bg-slate-50/50">
                    {formatCurrency(row.totalLiquidacion)}
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
