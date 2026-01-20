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
  if (!catName) return "bg-slate-800 text-gray-400 border-slate-700";
  const colors = [
    "bg-blue-100 text-blue-800 border-blue-200",
    "bg-purple-100 text-purple-800 border-purple-200",
    "bg-teal-100 text-teal-800 border-teal-200",
    "bg-orange-100 text-orange-800 border-orange-200",
    "bg-pink-100 text-pink-800 border-pink-200",
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
      className={`bg-slate-700 hover:bg-slate-600 p-1.5 rounded mb-1 text-xs text-white flex items-center gap-2 cursor-grab active:cursor-grabbing shadow-sm border border-slate-600 ${
        isDragging ? "opacity-50 ring-2 ring-blue-500" : ""
      }`}
    >
      <FaGripVertical className="text-slate-500" />{" "}
      <span className="truncate">{name}</span>
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
      className={`flex flex-col h-64 bg-slate-800 rounded-lg border-2 transition-all shadow-md overflow-hidden ${
        isOver
          ? "border-blue-500 bg-blue-900/10 ring-2 ring-blue-500/50"
          : "border-slate-700 hover:border-slate-600"
      }`}
    >
      <div className="px-3 py-2 border-b border-slate-700 bg-slate-900 flex justify-between items-center shrink-0">
        <div className="min-w-0">
          <h4
            className="font-bold text-white text-xs truncate uppercase"
            title={category.nombre}
          >
            {category.nombre}
          </h4>
          <span className="text-[10px] text-green-400 font-mono flex items-center gap-1">
            <FaDollarSign size={8} /> {category.valor_hora}
          </span>
        </div>
        <div className="flex gap-1 ml-2">
          <button
            onClick={() => onEdit(category)}
            className="p-1 text-gray-500 hover:text-blue-400 hover:bg-slate-800 rounded"
          >
            <FaEdit size={10} />
          </button>
          <button
            onClick={() => onDelete(category.id)}
            className="p-1 text-gray-500 hover:text-red-400 hover:bg-slate-800 rounded"
          >
            <FaTrash size={10} />
          </button>
        </div>
      </div>
      <div className="p-2 overflow-y-auto custom-scrollbar flex-1 bg-slate-800/50">
        {employees.map((emp) => (
          <DraggableEmployee key={emp} name={emp} categoryId={category.id} />
        ))}
        {employees.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 text-[10px] italic opacity-60">
            <span>Arrastra aquí</span>
          </div>
        )}
      </div>
      <div className="px-2 py-1 bg-slate-900/50 border-t border-slate-700 text-[9px] text-gray-500 text-center">
        {employees.length} Operarios
      </div>
    </div>
  );
}

// --- MODAL GESTION PERSONAL ---
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
      alert("Error");
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-7xl h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <FaUsersCog className="text-blue-500" /> Asignación de Personal
          </h2>
          <button onClick={onClose}>
            <FaTimes className="text-gray-400 hover:text-white" />
          </button>
        </div>
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex gap-3 items-end shadow-sm z-10">
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">
              Categoría
            </label>
            <input
              className="block w-48 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
              value={formCat.nombre}
              onChange={(e) =>
                setFormCat({ ...formCat, nombre: e.target.value })
              }
              placeholder="Ej: Oficial"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">
              Valor ($)
            </label>
            <input
              type="number"
              className="block w-28 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
              value={formCat.valor_hora}
              onChange={(e) =>
                setFormCat({ ...formCat, valor_hora: e.target.value })
              }
              placeholder="0.00"
            />
          </div>
          <button
            onClick={handleSaveCat}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg h-[38px]"
          >
            {editCat ? <FaEdit /> : <FaPlus />} {editCat ? "Guardar" : "Crear"}
          </button>
          {editCat && (
            <button
              onClick={() => {
                setEditCat(null);
                setFormCat({ nombre: "", valor_hora: "" });
              }}
              className="text-gray-500 hover:text-white underline text-xs h-[38px] flex items-center"
            >
              Cancelar
            </button>
          )}
        </div>
        <DndContext
          onDragStart={(e) => setActiveId(e.active.id)}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex overflow-hidden bg-slate-950">
            <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 shrink-0 shadow-xl z-10">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center justify-between">
                <span>
                  <FaUsers className="inline mr-2" /> Sin Categoría
                </span>
                <span className="bg-slate-800 px-2 py-0.5 rounded text-white">
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
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
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
              <div className="bg-blue-600 p-2 rounded-lg text-white text-xs shadow-2xl font-bold border border-white/20 transform rotate-2 cursor-grabbing w-48 truncate flex items-center gap-2">
                <FaGripVertical /> {activeId}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </motion.div>
    </div>
  );
}

// --- MODAL CALENDARIO ---
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
            </div>{" "}
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
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const isFeriado = feriadosSet.has(dateStr);
              const dayOfWeek = new Date(year, month, d).getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              return (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  key={d}
                  onClick={() => onToggleDate(dateStr)}
                  className={`h-9 rounded-lg text-xs font-bold transition-all relative flex items-center justify-center ${
                    isFeriado
                      ? "bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg shadow-red-900/50 ring-1 ring-red-400"
                      : "bg-slate-800/50 text-gray-400 hover:bg-slate-700 hover:text-white"
                  } ${
                    !isFeriado && isWeekend
                      ? "text-orange-400 bg-orange-900/10 border border-orange-500/20"
                      : ""
                  }`}
                >
                  {d}
                </motion.button>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500 bg-white/5 p-3 rounded-lg border border-white/5">
            <FaInfoCircle /> Rojo = Feriado (100%). Naranja = Fin de Semana
            (Extra).
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- MODAL HISTORIAL ---
function HistorialModal({ onClose, onPrint }) {
  const [cierres, setCierres] = useState([]);
  useEffect(() => {
    authFetch(`${API_BASE_URL}/rrhh/cierres`)
      .then((res) => res.json())
      .then(setCierres)
      .catch(console.error);
  }, []);

  const handleDelete = async (id) => {
    if (
      !confirm(
        "¿Estás seguro de que deseas eliminar este cierre? Esta acción no se puede deshacer.",
      )
    )
      return;
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
      alert("Error");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative"
      >
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
          <h3 className="text-white font-bold flex items-center gap-3 text-lg">
            <FaHistory className="text-purple-500" /> Historial de Cierres
          </h3>
          <button onClick={onClose}>
            <FaTimes className="text-gray-400 hover:text-white" />
          </button>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {cierres.length === 0 ? (
            <p className="text-center text-gray-500 italic">
              No hay cierres guardados.
            </p>
          ) : (
            <div className="space-y-3">
              {cierres.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center hover:bg-slate-750 transition-colors"
                >
                  <div>
                    <h4 className="text-white font-bold">{c.nombre_periodo}</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Guardado:{" "}
                      {new Date(c.fecha_creacion).toLocaleDateString()} | Total:{" "}
                      <span className="text-emerald-400 font-bold">
                        ${Number(c.total_pagado).toLocaleString()}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrint(c.id)}
                      className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg text-sm flex items-center gap-2 shadow transition-colors"
                    >
                      <FaPrint /> Recibos
                    </button>
                    {/* BOTÓN ELIMINAR ACTUALIZADO CON TEXTO */}
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-lg text-sm flex items-center gap-2 shadow transition-colors"
                      title="Eliminar Cierre"
                    >
                      <FaTrash /> Eliminar
                    </button>
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
      const data = XLSX.utils.sheet_to_json(ws);
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
            const rawExtra = horasTotales;
            if (rawExtra > 0) hsExtras = Math.floor(rawExtra * 2) / 2;
            hsNormales = 0;
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
    const doc = new jsPDF("l", "mm", "a4");
    const fecha = new Date().toLocaleDateString("es-AR");
    const hora = new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE ASISTENCIA Y LIQUIDACIÓN", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`Generado: ${fecha} ${hora}`, 14, 25);
    doc.text("Gestión MRP - Módulo RRHH", 280, 18, { align: "right" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen de Totales", 14, 40);

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
      startY: 42,
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
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: { fontStyle: "bold", halign: "center" },
      columnStyles: {
        4: { fontStyle: "bold", fontSize: 11, textColor: [30, 41, 59] },
      },
    });

    doc.text(
      `Detalle de Movimientos (${datosFiltrados.length} registros)`,
      14,
      doc.lastAutoTable.finalY + 15,
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
      startY: doc.lastAutoTable.finalY + 17,
      head: [
        [
          "Empleado",
          "Cat",
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
      styles: { fontSize: 8, cellPadding: 2, valign: "middle" },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        halign: "center",
      },
      columnStyles: {
        4: { halign: "center" },
        5: { halign: "center", fontStyle: "bold", textColor: [22, 163, 74] },
        6: { halign: "center", fontStyle: "bold", textColor: [234, 88, 12] },
        7: { halign: "center", fontStyle: "bold", textColor: [220, 38, 38] },
        8: { fontStyle: "bold", halign: "right", fontSize: 9 },
      },
    });
    doc.save(`Liquidacion_${fecha.replace(/\//g, "-")}.pdf`);
  };

  const generarRecibosPDF = (dataToPrint = datosFiltrados, titulo = null) => {
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

      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 25, "F");
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255);
      doc.text(
        titulo
          ? `RECIBO HISTÓRICO: ${titulo}`
          : "DETALLE DE LIQUIDACIÓN PROVISORIA",
        10,
        16,
      );
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(`FECHA EMISIÓN: ${fechaGen}`, 195, 16, { align: "right" });

      doc.setDrawColor(200);
      doc.setFillColor(248, 250, 252);
      doc.rect(10, 35, 190, 20, "F");
      doc.rect(10, 35, 190, 20, "S");
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("EMPLEADO:", 15, 42);
      doc.setFont("helvetica", "normal");
      doc.text(nombre.toUpperCase(), 45, 42);
      doc.setFont("helvetica", "bold");
      doc.text("CATEGORÍA:", 15, 50);
      doc.setFont("helvetica", "normal");
      doc.text(info.categoria, 45, 50);
      doc.setFont("helvetica", "bold");
      doc.text("VALOR HORA:", 120, 50);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(info.valorHora), 150, 50);

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
        startY: 65,
        head: [
          ["Fecha", "Horario", "Norm", "Extra", "100%", "Ex 100%", "Total"],
        ],
        body: bodyRecibo,
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 2, valign: "middle" },
        headStyles: { fillColor: [51, 65, 85], textColor: 255 },
        columnStyles: { 6: { halign: "right", fontStyle: "bold" } },
      });

      const finalY = doc.lastAutoTable.finalY + 10;
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
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: 30, halign: "right" },
        },
        margin: { left: 110 },
      });

      const totalY = doc.lastAutoTable.finalY + 5;
      doc.setFillColor(30, 41, 59);
      doc.rect(110, totalY, 90, 10, "F");
      doc.setTextColor(255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL A PERCIBIR", 115, totalY + 7);
      doc.text(formatCurrency(totalPlata), 195, totalY + 7, { align: "right" });
    });
    const fName = titulo
      ? `Recibos_${titulo.replace(/\s+/g, "_")}.pdf`
      : `Recibos_Individuales_${fechaGen.replace(/\//g, "-")}.pdf`;
    doc.save(fName);
  };

  const handleGuardarCierre = async () => {
    const nombrePeriodo = prompt(
      "Nombre para este cierre (Ej: Enero 1ra Quincena):",
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
      alert("¡Cierre guardado exitosamente!");
    } catch (e) {
      alert("Error al guardar cierre");
    }
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

      {/* HEADER PRINCIPAL */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 rounded-2xl border border-slate-700/50 shadow-2xl relative overflow-hidden flex flex-col gap-4">
        {/* Glow de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mt-20 -mr-20"></div>

        {/* FILA 1: TÍTULO COMPACTO */}
        <div className="z-10 flex items-center justify-between w-full border-b border-white/5 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-lg shadow-sm">
              <FaUserClock className="text-white text-sm" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide uppercase">
                Gestión RRHH
              </h1>
              <p className="text-[10px] text-gray-400 font-mono">
                Control de Asistencia & Liquidación
              </p>
            </div>
          </div>
        </div>

        {/* FILA 2: CONTROLES & TOOLBAR - ESTRUCTURA IZQUIERDA | CENTRO | DERECHA */}
        <div className="flex flex-col xl:flex-row gap-4 w-full items-end xl:items-center justify-between z-10">
          {/* 1. IZQUIERDA: FILTROS (Buscador y Fechas) */}
          <div className="flex flex-col md:flex-row gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10 backdrop-blur-sm shadow-inner w-full xl:w-auto">
            <div className="flex items-center bg-slate-950/50 rounded-lg border border-slate-700 px-3 py-1 flex-1">
              <FaSearch className="text-gray-500 mr-2" />
              <select
                value={filtroOperario}
                onChange={(e) => setFiltroOperario(e.target.value)}
                className="bg-transparent text-white text-xs p-1.5 outline-none cursor-pointer w-full md:w-40 appearance-none font-medium"
                disabled={datosProcesados.length === 0}
              >
                <option value="" className="bg-slate-900">
                  Todos
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
                className="bg-slate-950/50 border border-slate-700 text-white text-[10px] rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:border-slate-500 transition-colors"
              />
              <span className="text-gray-600 font-bold">→</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="bg-slate-950/50 border border-slate-700 text-white text-[10px] rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:border-slate-500 transition-colors"
              />
            </div>
            {(filtroOperario || fechaInicio || fechaFin) && (
              <button
                onClick={limpiarFiltros}
                className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all border border-red-500/20"
                title="Limpiar filtros"
              >
                <FaEraser />
              </button>
            )}
          </div>

          {/* 2. CENTRO: BOTONES DE ACCIÓN (Grupo central) */}
          <div className="flex items-center bg-slate-900/80 backdrop-blur-sm border border-slate-700 p-1.5 rounded-xl shadow-lg gap-3">
            <div className="flex gap-1">
              <button
                onClick={() => setShowGestionModal(true)}
                className="px-3 py-2 hover:bg-slate-800 text-slate-300 hover:text-blue-400 rounded-lg transition-colors flex items-center gap-2 text-[10px] font-bold uppercase"
              >
                <FaUsersCog className="text-sm" /> Personal
              </button>
              <button
                onClick={() => setShowFeriadosModal(true)}
                className="px-3 py-2 hover:bg-slate-800 text-slate-300 hover:text-red-400 rounded-lg transition-colors flex items-center gap-2 text-[10px] font-bold uppercase"
              >
                <FaCalendarCheck className="text-sm" /> Feriados
              </button>
            </div>
            <div className="w-px h-6 bg-slate-700 hidden md:block"></div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowHistorialModal(true)}
                className="px-3 py-2 hover:bg-slate-800 text-slate-300 hover:text-purple-400 rounded-lg transition-colors flex items-center gap-2 text-[10px] font-bold uppercase"
              >
                <FaHistory className="text-sm" /> Historial
              </button>
              <button
                onClick={handleGuardarCierre}
                disabled={datosProcesados.length === 0}
                className="px-3 py-2 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors disabled:opacity-30 flex items-center gap-2 text-[10px] font-bold uppercase"
              >
                <FaSave className="text-sm" /> Guardar
              </button>
            </div>
            <div className="w-px h-6 bg-slate-700 hidden md:block"></div>
            <div className="flex gap-1">
              <button
                onClick={generarReportePDF}
                disabled={datosProcesados.length === 0}
                className="px-3 py-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-30 flex items-center gap-2 text-[10px] font-bold uppercase"
              >
                <FaFilePdf className="text-sm" /> Lista
              </button>
              <button
                onClick={() => generarRecibosPDF()}
                disabled={datosProcesados.length === 0}
                className="px-3 py-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-30 flex items-center gap-2 text-[10px] font-bold uppercase"
              >
                <FaFileInvoiceDollar className="text-sm" /> Recibos
              </button>
            </div>
          </div>

          {/* 3. DERECHA: BOTÓN IMPORTAR (Separado) */}
          <div>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all active:scale-95 whitespace-nowrap border border-white/10 text-[10px] uppercase">
              <FaUpload /> <span className="hidden md:inline">Importar</span>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              label: "Feriado 100%",
              val: resumen.fer100,
              color: "text-orange-400",
              border: "border-orange-500/50",
              bg: "from-orange-900/20 to-slate-900",
              icon: <FaStar />,
            },
            {
              label: "Extra 100%",
              val: resumen.ex100,
              color: "text-red-400",
              border: "border-red-500/50",
              bg: "from-red-900/20 to-slate-900",
              icon: <FaFire />,
            },
            {
              label: "Total Liquidación",
              val: resumen.totalPesos,
              isMoney: true,
              color: "text-blue-300",
              border: "border-blue-500/50",
              bg: "from-blue-900/30 to-slate-900",
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
              <p
                className={`text-2xl md:text-3xl font-black ${kpi.color} font-mono truncate`}
              >
                {kpi.isMoney ? formatCurrency(kpi.val) : kpi.val.toFixed(2)}
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
                  Hs Extras
                </th>
                <th className="p-5 text-center bg-orange-900/10 text-orange-400">
                  100% (Base)
                </th>
                <th className="p-5 text-center bg-red-900/10 text-red-400">
                  Extra 100%
                </th>
                <th className="p-5 text-right text-white bg-blue-900/20">
                  Liquidación
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {datosFiltrados.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`transition-all hover:bg-slate-800/60 ${idx % 2 === 0 ? "bg-transparent" : "bg-slate-800/20"}`}
                >
                  <td className="p-5 font-bold text-white">
                    <div>{row.nombre}</div>
                    {row.categoria && (
                      <span
                        className={`inline-flex items-center gap-1 mt-1 text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider font-bold ${getCategoryColor(row.categoria)}`}
                      >
                        <FaTag size={8} /> {row.categoria}
                      </span>
                    )}
                  </td>
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
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-5 text-center font-mono font-bold text-red-400 bg-red-900/5 border-r border-slate-800/50">
                    {row.hsExtras100 ? (
                      <div className="flex flex-col items-center">
                        <span>{row.hsExtras100}</span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-5 text-right font-black text-white bg-blue-900/10 border-l border-blue-500/20 text-sm">
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
