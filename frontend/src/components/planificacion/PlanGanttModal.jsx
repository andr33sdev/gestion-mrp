import React, { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  useDraggable,
  useSensors,
  useSensor,
  PointerSensor,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import {
  FaTimes,
  FaCalendarAlt,
  FaEdit,
  FaCheck,
  FaGripVertical,
  FaCut,
  FaExclamationTriangle,
  FaTrashAlt,
  FaFire,
} from "react-icons/fa";

// --- UTILIDADES ---
const parseDate = (str) => {
  if (!str) return new Date();
  const parts = str.split("-");
  // Asegurar que se interpreta como local 00:00
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getDaysArray = (start, end) => {
  const arr = [];
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    arr.push(new Date(dt));
  }
  return arr;
};

// Verifica si la tarea está activa HOY
const isItemActiveToday = (item) => {
  if (!item.fecha_inicio_estimada) return false;
  const ritmo = Number(item.ritmo_turno) || 50;
  const cantidad = Number(item.cantidad) || 0;
  const producido = Number(item.producido) || 0;
  if (producido >= cantidad) return false;

  const turnos = ritmo > 0 ? cantidad / ritmo : 0;
  const diasDuration = Math.ceil(turnos / 2);
  const start = parseDate(item.fecha_inicio_estimada);
  const end = new Date(start);
  end.setDate(end.getDate() + diasDuration);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return today >= start && today < end;
};

// --- MODAL DE EDICIÓN ---
function EditTaskModal({ item, onClose, onSave, onSplit, onMerge }) {
  const [ritmo, setRitmo] = useState(item.ritmo_turno || 50);
  const [fecha, setFecha] = useState(item.fecha_inicio_estimada);
  const [cantidadTotal, setCantidadTotal] = useState(item.cantidad);

  const producido = Number(item.producido) || 0;
  const pendiente = Math.max(0, cantidadTotal - producido);
  const progreso = cantidadTotal > 0 ? (producido / cantidadTotal) * 100 : 0;
  const isRemanente = !item.plan_item_id;

  const handleSave = () =>
    onSave(item.plan_item_id || item.temp_id, {
      ritmo: Number(ritmo),
      fecha,
      cantidad: Number(cantidadTotal),
    });

  const handleSplit = () => {
    if (pendiente <= 0) return alert("Tarea completada, nada que dividir.");
    if (confirm("¿Dividir tarea en dos (Hecho vs Pendiente)?"))
      onSplit(item.plan_item_id || item.temp_id, producido, pendiente);
  };

  const handleMerge = () => {
    if (confirm("¿Unir con tarea anterior?"))
      onMerge(item.plan_item_id || item.temp_id);
  };

  const setToday = () => setFecha(formatDate(new Date()));

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-500 p-6 rounded-xl shadow-2xl z-[150] w-80 animate-in zoom-in-95">
      <div className="flex justify-between items-center border-b border-slate-700 pb-3 mb-4">
        <h4 className="text-white text-lg font-bold">
          {isRemanente ? "Remanente" : "Tarea"}
        </h4>
        <button
          onClick={setToday}
          className="bg-orange-600 hover:bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 shadow-lg transition-all active:scale-95"
        >
          <FaFire className="animate-pulse" /> HOY
        </button>
      </div>
      <div className="space-y-4">
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 relative overflow-hidden">
          <div className="flex justify-between text-xs text-gray-400 mb-1 relative z-10">
            <span>Progreso ({progreso.toFixed(0)}%)</span>
            <span>
              {producido} / {cantidadTotal}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden relative z-10">
            <div
              className="h-full bg-green-500"
              style={{ width: `${Math.min(progreso, 100)}%` }}
            ></div>
          </div>
          {pendiente > 0 && (
            <p className="text-xs text-yellow-400 mt-2 text-center relative z-10">
              Faltan {pendiente} unidades
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">
              Inicio
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">
              Ritmo
            </label>
            <input
              type="number"
              value={ritmo}
              onChange={(e) => setRitmo(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">
            Meta Total
          </label>
          <input
            type="number"
            value={cantidadTotal}
            onChange={(e) => setCantidadTotal(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm font-bold"
          />
        </div>
        <div className="flex gap-2 pt-2 border-t border-slate-700 mt-2">
          {pendiente > 0 && !isRemanente && (
            <button
              onClick={handleSplit}
              className="flex-1 bg-yellow-700 text-white py-2 rounded text-xs font-bold"
            >
              <FaCut className="inline" /> Dividir
            </button>
          )}
          {isRemanente && (
            <button
              onClick={handleMerge}
              className="flex-1 bg-red-700 text-white py-2 rounded text-xs font-bold"
            >
              <FaTrashAlt className="inline" /> Unir
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 bg-green-600 text-white py-2 rounded text-xs font-bold"
          >
            <FaCheck className="inline" /> OK
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full text-xs text-gray-500 hover:text-white mt-1 underline"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// --- GANTT BAR ---
function GanttBar({ item, startDate, colWidth, onDoubleClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `bar-${item.plan_item_id || item.temp_id}`,
      data: { type: "BAR", item },
    });

  const ritmo = Number(item.ritmo_turno) || 50;
  const cantidad = Number(item.cantidad) || 0;
  const turnos = ritmo > 0 ? cantidad / ritmo : 0;
  const diasDuracion = Math.max(0.5, turnos / 2);

  // Posición en pixeles basada en colWidth
  const diffTime =
    parseDate(item.fecha_inicio_estimada).getTime() - startDate.getTime();
  const startDayIndex = diffTime / (1000 * 3600 * 24);

  const leftPx = startDayIndex * colWidth;
  const widthPx = diasDuracion * colWidth;
  const activeNow = isItemActiveToday(item);
  const progress = cantidad > 0 ? (Number(item.producido) / cantidad) * 100 : 0;
  const isNew = !item.plan_item_id;

  // No renderizar si está muy lejos a la izquierda
  if (startDayIndex + diasDuracion < -5) return null;

  const style = {
    transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
    left: `${leftPx}px`,
    width: `${Math.max(widthPx, 20)}px`, // Mínimo 20px
    position: "absolute",
    zIndex: isDragging ? 60 : activeNow ? 50 : 10,
    opacity: isDragging ? 0.9 : 1,
  };

  let bgClass = isNew
    ? "bg-purple-600 border-purple-400"
    : progress >= 100
    ? "bg-green-600 border-green-400"
    : "bg-blue-600 border-blue-400";
  if (activeNow)
    bgClass =
      "bg-orange-600 border-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.6)] ring-1 ring-orange-200";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(item);
      }}
      className={`h-8 top-2 rounded shadow-md border cursor-grab active:cursor-grabbing overflow-hidden group hover:brightness-110 transition-all ${bgClass} min-w-[20px] select-none`}
    >
      <div className="w-full h-full relative">
        <div
          className="absolute top-0 bottom-0 left-0 bg-white/20"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow-md px-1 truncate gap-1">
          {activeNow && <FaFire className="text-yellow-200 animate-pulse" />}{" "}
          {turnos.toFixed(1)}T {isNew && "(R)"}
        </div>
      </div>
    </div>
  );
}

// --- FILA GANTT ---
function SortableRow({ item, startDate, colWidth, onEditItem, index }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.plan_item_id
      ? `row-${item.plan_item_id}`
      : `row-temp-${item.temp_id}`,
    data: { type: "ROW", item },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : 1,
    position: "relative",
  };
  const rowBg = index % 2 === 0 ? "bg-slate-800" : "bg-slate-800/50";
  const activeNow = isItemActiveToday(item);
  const isSplit = !item.plan_item_id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex border-b border-slate-700/50 hover:bg-white/5 transition-colors h-12 ${rowBg} ${
        activeNow ? "bg-orange-900/10" : ""
      }`}
    >
      {/* COLUMNA IZQUIERDA (STICKY) */}
      <div
        className={`w-64 flex-shrink-0 flex items-center border-r border-slate-600 ${rowBg} ${
          activeNow ? "bg-orange-900/10" : ""
        } z-[80] sticky left-0`}
      >
        <div
          {...attributes}
          {...listeners}
          className="w-8 h-full flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-500 hover:text-white"
        >
          <FaGripVertical />
        </div>
        <div className="flex-1 px-2 overflow-hidden">
          <div className="flex items-center gap-1">
            {isSplit && (
              <FaExclamationTriangle
                className="text-[10px] text-purple-400"
                title="Remanente nuevo"
              />
            )}
            {activeNow && (
              <FaFire
                className="text-orange-500 text-xs animate-pulse"
                title="Produciendo Ahora"
              />
            )}
            <p
              className={`font-bold text-xs truncate ${
                activeNow ? "text-orange-200" : "text-white"
              }`}
              title={item.semielaborado.nombre}
            >
              {item.semielaborado.nombre}
            </p>
          </div>
          <div className="text-[10px] text-gray-400 flex justify-between mt-0.5">
            <span>
              {item.producido}/{item.cantidad}
            </span>
            <span className="font-mono text-blue-300">
              {item.ritmo_turno}/t
            </span>
          </div>
        </div>
      </div>

      {/* TIMELINE ROW */}
      <div className="flex-1 relative min-w-0 overflow-hidden">
        <GanttBar
          item={item}
          startDate={startDate}
          colWidth={colWidth}
          onDoubleClick={onEditItem}
        />
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function PlanGanttModal({ items, onClose, onSaveUpdate }) {
  const [localItems, setLocalItems] = useState(
    items.map((i) => ({
      ...i,
      temp_id: i.plan_item_id || Date.now() + Math.random(),
    }))
  );
  const [editingItem, setEditingItem] = useState(null);

  const COL_WIDTH = 60; // Ancho fijo por día en píxeles

  // Calcular rango dinámico de fechas
  const { startDate, daysArray, totalWidth } = useMemo(() => {
    let minTs = new Date().getTime(); // Default hoy
    let maxTs = new Date().getTime() + 14 * 24 * 60 * 60 * 1000; // Default hoy + 14

    if (localItems.length > 0) {
      // Buscar fecha más antigua y más futura
      const startDates = localItems.map((i) =>
        parseDate(i.fecha_inicio_estimada).getTime()
      );
      const endDates = localItems.map((i) => {
        const ritmo = Number(i.ritmo_turno) || 50;
        const dias = Math.ceil(Number(i.cantidad) / ritmo / 2);
        return addDays(parseDate(i.fecha_inicio_estimada), dias).getTime();
      });

      minTs = Math.min(...startDates);
      maxTs = Math.max(...endDates, maxTs); // Asegurar que cubra al menos lo calculado o 14 dias
    }

    const start = new Date(minTs);
    start.setDate(start.getDate() - 2); // Margen izquierdo

    const end = new Date(maxTs);
    end.setDate(end.getDate() + 5); // Margen derecho

    const arr = getDaysArray(start, end);
    return {
      startDate: start,
      daysArray: arr,
      totalWidth: arr.length * COL_WIDTH,
    };
  }, [localItems]); // Recalcular si cambian los items (ej: al arrastrar fuera)

  const todayStr = formatDate(new Date());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event) => {
    const { active, over, delta } = event;
    if (!active) return;
    const type = active.data.current?.type;

    if (type === "ROW" && over && active.id !== over.id) {
      setLocalItems((items) => {
        const oldIndex = items.findIndex(
          (i) =>
            (i.plan_item_id
              ? `row-${i.plan_item_id}`
              : `row-temp-${i.temp_id}`) === active.id
        );
        const newIndex = items.findIndex(
          (i) =>
            (i.plan_item_id
              ? `row-${i.plan_item_id}`
              : `row-temp-${i.temp_id}`) === over.id
        );
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    if (type === "BAR" && Math.round(delta.x / COL_WIDTH) !== 0) {
      const daysMoved = Math.round(delta.x / COL_WIDTH);
      const itemId = active.id.replace("bar-", "");
      setLocalItems((prev) =>
        prev.map((item) => {
          if (
            String(item.plan_item_id) === itemId ||
            String(item.temp_id) === itemId
          ) {
            return {
              ...item,
              fecha_inicio_estimada: formatDate(
                addDays(parseDate(item.fecha_inicio_estimada), daysMoved)
              ),
            };
          }
          return item;
        })
      );
    }
  };

  const handleSaveModal = (id, data) => {
    setLocalItems((prev) =>
      prev.map((i) =>
        (i.plan_item_id || i.temp_id) === (id || editingItem.temp_id)
          ? {
              ...i,
              ritmo_turno: data.ritmo,
              fecha_inicio_estimada: data.fecha,
              cantidad: data.cantidad,
            }
          : i
      )
    );
    setEditingItem(null);
  };

  const handleSplitItem = (id, prod, pend) => {
    setLocalItems((prev) => {
      const idx = prev.findIndex((i) => (i.plan_item_id || i.temp_id) === id);
      if (idx === -1) return prev;
      const orig = prev[idx];
      const nextStart = addDays(parseDate(orig.fecha_inicio_estimada), 1);
      const newItem = {
        ...orig,
        plan_item_id: null,
        temp_id: Date.now(),
        cantidad: pend,
        producido: 0,
        fecha_inicio_estimada: formatDate(nextStart),
      };
      const newPrev = [...prev];
      newPrev[idx] = { ...orig, cantidad: prod };
      newPrev.splice(idx + 1, 0, newItem);
      return newPrev;
    });
    setEditingItem(null);
  };

  const handleMergePrevious = (id) => {
    setLocalItems((prev) => {
      const idx = prev.findIndex((i) => (i.plan_item_id || i.temp_id) === id);
      if (idx <= 0) return prev;
      const curr = prev[idx];
      const pre = prev[idx - 1];
      if (curr.semielaborado.id !== pre.semielaborado.id) return prev;
      const newPrev = [...prev];
      newPrev[idx - 1] = {
        ...pre,
        cantidad: Number(pre.cantidad) + Number(curr.cantidad),
      };
      newPrev.splice(idx, 1);
      return newPrev;
    });
    setEditingItem(null);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-[120] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 w-full max-w-[95vw] h-[90vh] rounded-2xl shadow-2xl border border-slate-600 flex flex-col overflow-hidden relative"
      >
        <div className="p-4 border-b border-slate-700 bg-slate-950 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-bold text-white flex gap-3">
            <FaCalendarAlt className="text-purple-400" /> Cronograma Maestro
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => onSaveUpdate(localItems)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex gap-2"
            >
              <FaEdit /> Guardar Todo
            </button>
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        {/* Scroll Global para la tabla */}
        <div className="flex flex-1 overflow-auto custom-scrollbar relative bg-slate-800">
          <div className="flex flex-col h-full min-w-fit">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {/* HEADER ROW (STICKY TOP) */}
              <div
                className="flex sticky top-0 z-[100] bg-slate-900 border-b border-slate-700 h-10 shadow-md w-full"
                style={{ width: `${256 + totalWidth}px` }}
              >
                <div className="w-64 flex-shrink-0 sticky left-0 z-[110] bg-slate-900 border-r border-slate-700 p-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                  Producto
                </div>
                <div className="flex relative">
                  {daysArray.map((d, i) => (
                    <div
                      key={i}
                      className={`border-r border-slate-700/50 flex items-center justify-center text-[10px] font-bold uppercase flex-col ${
                        formatDate(d) === todayStr ? "bg-blue-500/20" : ""
                      }`}
                      style={{ width: `${COL_WIDTH}px` }}
                    >
                      <span
                        className={`${
                          formatDate(d) === todayStr
                            ? "text-blue-400"
                            : d.getDay() === 0 || d.getDay() === 6
                            ? "text-yellow-600"
                            : "text-gray-500"
                        }`}
                      >
                        {d.getDate()}
                      </span>
                      <span className="opacity-50 text-[9px]">
                        {d.toLocaleDateString("es-AR", { weekday: "narrow" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* BODY ROWS */}
              <div
                className="relative flex-1"
                style={{ width: `${256 + totalWidth}px` }}
              >
                {/* Fondo Grilla */}
                <div className="absolute inset-0 flex pointer-events-none z-[70] ml-64 h-full">
                  {daysArray.map((d, i) => (
                    <div
                      key={i}
                      className={`border-r ${
                        formatDate(d) === todayStr
                          ? "border-blue-500/30 bg-blue-500/5"
                          : "border-white/5"
                      } ${
                        d.getDay() === 0 || d.getDay() === 6 ? "bg-white/5" : ""
                      }`}
                      style={{ width: `${COL_WIDTH}px` }}
                    />
                  ))}
                </div>

                <SortableContext
                  items={localItems.map((i) =>
                    i.plan_item_id
                      ? `row-${i.plan_item_id}`
                      : `row-temp-${i.temp_id}`
                  )}
                  strategy={verticalListSortingStrategy}
                >
                  {localItems.map((item, index) => (
                    <SortableRow
                      key={item.plan_item_id || item.temp_id}
                      item={item}
                      startDate={startDate}
                      colWidth={COL_WIDTH}
                      onEditItem={setEditingItem}
                      index={index}
                    />
                  ))}
                </SortableContext>
              </div>

              <DragOverlay />
            </DndContext>
          </div>
        </div>

        {editingItem && (
          <EditTaskModal
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSave={handleSaveModal}
            onSplit={handleSplitItem}
            onMerge={handleMergePrevious}
          />
        )}
      </motion.div>
    </div>
  );
}
