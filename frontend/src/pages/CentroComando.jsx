import React, { useEffect, useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  FaFire,
  FaIndustry,
  FaSyringe,
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaTrash,
  FaPen,
  FaBoxOpen,
  FaMinus,
  FaPlus,
  FaFilePdf,
  FaSync,
  FaTimes,
  FaLayerGroup,
  FaLink,
  FaClock,
  FaCompressArrowsAlt,
  FaBalanceScale,
  FaExclamationTriangle,
} from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../utils";
import Loader from "../components/Loader";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, AnimatePresence } from "framer-motion";

// --- CONFIGURACIÓN DE PLANTA ---
const ESTRUCTURA_PLANTA = [
  { id: "HORNO 1", tipo: "horno", brazos: ["Estación 1", "Estación 2"] },
  { id: "HORNO 2", tipo: "horno", brazos: ["Estación 1", "Estación 2"] },
  { id: "HORNO 3", tipo: "horno", brazos: ["Estación 1", "Estación 2"] },
  { id: "INYECTORA", tipo: "inyectora", brazos: ["Estación Única"] },
  { id: "EXTRUSORA 1", tipo: "extrusora", brazos: ["Estación Única"] },
  { id: "EXTRUSORA 2", tipo: "extrusora", brazos: ["Estación Única"] },
  { id: "EXTRUSORA 3", tipo: "extrusora", brazos: ["Estación Única"] },
];

// --- HELPER: CALCULAR CICLOS DE UN ARRAY DE ITEMS ---
const calcularCiclosTotal = (items) => {
  // Agrupamos por grupo_id para calcular paralelos
  const grupos = {};
  items.forEach((i) => {
    const gid = i.grupo_id || `temp-${i.id}`;
    if (!grupos[gid]) grupos[gid] = [];
    grupos[gid].push(i);
  });

  let total = 0;
  Object.values(grupos).forEach((grupoItems) => {
    const maxCicloGrupo = Math.max(
      ...grupoItems.map((i) =>
        Math.ceil(i.cantidad / (i.unidades_por_ciclo || 1))
      )
    );
    total += maxCicloGrupo;
  });
  return total;
};

// --- 1. MODAL CON INTELIGENCIA DE BALANCEO ---
const ScheduleModal = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  product,
  targetInfo,
  existingGroups,
  currentLoad,
}) => {
  const [cantidad, setCantidad] = useState(initialData?.cantidad || 50);
  const [piezasCiclo, setPiezasCiclo] = useState(
    initialData?.unidades_por_ciclo || 1
  );
  const [grupoSeleccionado, setGrupoSeleccionado] = useState("NEW");

  if (!isOpen) return null;

  const ciclosPropios = Math.ceil(cantidad / piezasCiclo);

  // Cálculos para el balanceo
  const ciclosActualesEnTarget = currentLoad[targetInfo.brazo] || 0;
  const ciclosSimulados =
    grupoSeleccionado === "NEW"
      ? ciclosActualesEnTarget + ciclosPropios
      : ciclosActualesEnTarget; // Si conecta, asumimos que no suma (simplificación visual)

  // Buscamos el brazo "hermano" para comparar
  const brazoHermano = Object.keys(currentLoad).find(
    (b) => b !== targetInfo.brazo
  );
  const ciclosHermano = currentLoad[brazoHermano] || 0;
  const diferencia = ciclosSimulados - ciclosHermano;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(
      cantidad,
      piezasCiclo,
      grupoSeleccionado === "NEW" ? null : Number(grupoSeleccionado)
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-800 border border-slate-600 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="bg-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-white font-bold flex items-center gap-2">
            <FaLayerGroup className="text-blue-400" /> Cargar Molde
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Header Contexto */}
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2 border-b border-slate-700 pb-2">
            <span>
              Máquina: <b className="text-white">{targetInfo?.maquina}</b>
            </span>
            <span>
              Fecha: <b className="text-white">{targetInfo?.fecha}</b>
            </span>
          </div>

          {/* MONITOR DE BALANCEO EN VIVO */}
          {Object.keys(currentLoad).length > 1 && (
            <div className="bg-slate-900 rounded-xl p-3 border border-slate-700 mb-2">
              <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-2 flex items-center gap-2">
                <FaBalanceScale /> Balanceo de Brazos
              </h4>
              <div className="space-y-2">
                {/* Brazo Actual (Target) */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-blue-400 font-bold flex items-center gap-1">
                    {targetInfo.brazo} (Este)
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(ciclosSimulados, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-white">
                      {ciclosActualesEnTarget} ➔{" "}
                      <span className="text-green-400 font-bold">
                        {ciclosSimulados}
                      </span>
                    </span>
                  </div>
                </div>
                {/* Brazo Hermano */}
                {brazoHermano && (
                  <div className="flex justify-between items-center text-xs opacity-70">
                    <span className="text-gray-400 font-bold">
                      {brazoHermano}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-500"
                          style={{ width: `${Math.min(ciclosHermano, 100)}%` }}
                        ></div>
                      </div>
                      <span className="font-mono text-white">
                        {ciclosHermano}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {/* Veredicto */}
              <div
                className={`mt-2 text-center text-xs font-bold py-1 rounded border ${
                  Math.abs(diferencia) < 3
                    ? "bg-green-900/20 text-green-400 border-green-500/20"
                    : "bg-orange-900/20 text-orange-400 border-orange-500/20"
                }`}
              >
                {Math.abs(diferencia) < 3
                  ? "✅ Carga Balanceada"
                  : diferencia > 0
                  ? `⚠ Te pasas por ${diferencia} ciclos respecto al otro brazo.`
                  : `ℹ Aún faltan ${Math.abs(diferencia)} ciclos para igualar.`}
              </div>
            </div>
          )}

          <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
            <p className="text-white font-bold text-lg truncate">
              {product?.nombre}
            </p>
            <p className="text-xs text-blue-300 font-mono">{product?.codigo}</p>
          </div>

          {/* SELECTOR CONEXIÓN */}
          {existingGroups && existingGroups.length > 0 && (
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
              <label className="text-xs text-gray-400 font-bold mb-2 block flex items-center gap-2">
                <FaLink /> Estrategia
              </label>
              <select
                className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded p-2 focus:border-blue-500 outline-none"
                value={grupoSeleccionado}
                onChange={(e) => setGrupoSeleccionado(e.target.value)}
              >
                <option value="NEW">➕ Nuevo Montaje (Sumar)</option>
                {existingGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    🔗 Conectar con {g.nombres.join(", ")}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 font-bold mb-1 block">
                Cantidad Total
              </label>
              <input
                type="number"
                min="1"
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-center font-bold focus:border-blue-500 outline-none"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold mb-1 block">
                Pzas x Ciclo
              </label>
              <input
                type="number"
                min="1"
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-center font-bold focus:border-blue-500 outline-none"
                value={piezasCiclo}
                onChange={(e) => setPiezasCiclo(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-blue-900/10 border border-blue-500/20 p-3 rounded-xl mt-2">
            <span className="text-sm text-blue-200 font-bold">
              Ciclos de este molde:
            </span>
            <span className="text-2xl text-blue-400 font-extrabold flex items-center gap-2">
              {ciclosPropios} <FaSync className="text-sm opacity-50" />
            </span>
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl mt-2 transition-colors"
          >
            Confirmar Carga
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// --- COMPONENTES VISUALES ---
function DraggableProduct({ product, isOverlay }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `prod-${product.id}`,
    data: { type: "PRODUCT", product },
    disabled: isOverlay,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-2 mb-2 bg-slate-800 rounded border border-slate-700 flex justify-between items-center cursor-grab hover:bg-slate-700 hover:border-blue-500 transition-all select-none shadow-sm group ${
        isDragging
          ? "opacity-50 border-blue-500 scale-105 shadow-xl cursor-grabbing"
          : ""
      }`}
    >
      <div className="truncate pr-2">
        <div className="text-gray-200 font-bold text-xs truncate w-32">
          {product.nombre}
        </div>
        <div className="text-[10px] text-gray-500 font-mono group-hover:text-gray-400">
          {product.codigo}
        </div>
      </div>
      <div className="text-[10px] bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-blue-400 font-bold font-mono">
        {product.stock_actual}
      </div>
    </div>
  );
}

function PlannedItem({ item, onDelete, onEdit }) {
  const ciclos = Math.ceil(item.cantidad / (item.unidades_por_ciclo || 1));
  return (
    <div
      className="flex items-center justify-between bg-slate-700/40 hover:bg-slate-700 border-b border-slate-600/30 last:border-0 pl-1.5 pr-1 py-1 transition-colors cursor-pointer group"
      onClick={() => onEdit(item)}
    >
      <div className="flex flex-col min-w-0 mr-1 w-full">
        <div className="flex justify-between items-center">
          <span
            className="text-xs font-bold text-gray-200 truncate leading-tight w-24"
            title={item.nombre}
          >
            {item.nombre}
          </span>
          <div className="opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="text-gray-500 hover:text-red-400 p-0.5"
            >
              <FaTrash size={10} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-blue-300 font-mono">
            {item.cantidad}u
          </span>
          <span
            className="text-[10px] text-orange-300 font-bold flex items-center gap-0.5 ml-auto"
            title="Ciclos"
          >
            <FaSync size={8} /> {ciclos}
          </span>
        </div>
      </div>
    </div>
  );
}

function MontageGroup({ items, onDeleteItem, onEditItem }) {
  const ciclosItems = items.map((i) =>
    Math.ceil(i.cantidad / (i.unidades_por_ciclo || 1))
  );
  const ciclosGrupo = Math.max(...ciclosItems);
  return (
    <div className="bg-slate-800 rounded border border-slate-600 mb-1 overflow-hidden shadow-sm">
      <div className="bg-slate-900/80 px-2 py-0.5 flex justify-between items-center border-b border-slate-700/50">
        <span className="text-[9px] text-gray-500 uppercase flex items-center gap-1">
          <FaLink size={8} /> Grupo
        </span>
        <span className="text-[10px] font-bold text-orange-400 flex items-center gap-1">
          <FaClock size={8} /> {ciclosGrupo}c
        </span>
      </div>
      <div>
        {items.map((item) => (
          <PlannedItem
            key={item.id}
            item={item}
            onDelete={onDeleteItem}
            onEdit={onEditItem}
          />
        ))}
      </div>
    </div>
  );
}

// --- CELDA DE LA GRILLA (CON ALERTA DE DESBALANCE) ---
function DroppableCell({
  date,
  machine,
  arm,
  items,
  loadBalance,
  isCollapsed,
  onDeleteItem,
  onEditItem,
}) {
  const cellId = `cell|${machine}|${arm}|${date}`;
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { date, machine, arm, items },
  });
  const dayNumber = date.split("-")[2];

  if (isCollapsed) return null;

  // Calculamos ciclos locales
  const ciclosLocales = calcularCiclosTotal(items);

  // Verificamos Desbalance con el "Hermano"
  let alertaDesbalance = null;
  if (loadBalance) {
    const ciclosHermano =
      Object.values(loadBalance).find((v) => v.brazo !== arm)?.ciclos || 0;
    // Solo mostramos alerta si somos el brazo "corto" y la diferencia es significativa (> 10%)
    const diferencia = ciclosHermano - ciclosLocales;
    if (diferencia > 2) {
      // Tolerancia de 2 ciclos
      alertaDesbalance = (
        <div
          className="absolute top-0 right-0 -mt-1 -mr-1 z-10"
          title={`¡Ineficiente! Este brazo tiene ${diferencia} ciclos menos que el otro.`}
        >
          <div className="bg-rose-500 text-white text-[8px] font-bold px-1 rounded shadow-md border border-rose-400 flex items-center gap-0.5 animate-pulse">
            <FaExclamationTriangle size={8} /> -{diferencia}
          </div>
        </div>
      );
    }
  }

  // Agrupar items para renderizado
  const grupos = {};
  items.forEach((item) => {
    const gId = item.grupo_id || `temp-${item.id}`;
    if (!grupos[gId]) grupos[gId] = [];
    grupos[gId].push(item);
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] h-full border-r border-b border-slate-800/80 transition-colors relative flex flex-col ${
        isOver ? "bg-blue-900/20" : ""
      }`}
    >
      {/* ALERTA VISUAL FLOTANTE */}
      {alertaDesbalance}

      <div className="flex justify-between items-center px-2 py-1 bg-slate-900/30">
        <span className="text-[10px] text-gray-600 font-bold select-none">
          {dayNumber}
        </span>
        {ciclosLocales > 0 && (
          <span
            className={`text-[10px] font-bold px-1.5 rounded border flex items-center gap-1 ${
              alertaDesbalance
                ? "text-rose-300 bg-rose-900/20 border-rose-500/20"
                : "text-emerald-400 bg-emerald-900/20 border-emerald-500/10"
            }`}
          >
            <FaLayerGroup size={8} /> {ciclosLocales}
          </span>
        )}
      </div>
      <div className="flex-1 p-1 flex flex-col gap-1">
        {Object.values(grupos).map((grupoItems, idx) => (
          <MontageGroup
            key={idx}
            items={grupoItems}
            onDeleteItem={onDeleteItem}
            onEditItem={onEditItem}
          />
        ))}
      </div>
      {isOver && (
        <div className="absolute inset-0 border-2 border-blue-500/50 border-dashed bg-blue-500/5 pointer-events-none z-10"></div>
      )}
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---

export default function CentroComando() {
  const [productos, setProductos] = useState([]);
  const [programacion, setProgramacion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [weekStart, setWeekStart] = useState(new Date());
  const [activeDrag, setActiveDrag] = useState(null);
  const [collapsedMachines, setCollapsedMachines] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const getMachineIcon = (tipo) => {
    switch (tipo) {
      case "horno":
        return <FaFire className="text-orange-500" />;
      case "inyectora":
        return <FaSyringe className="text-purple-500" />;
      default:
        return <FaIndustry className="text-blue-500" />;
    }
  };

  const getWeekDays = (start) => {
    const days = [];
    const current = new Date(start);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  };

  const weekDays = getWeekDays(weekStart);

  const cargarDatos = async () => {
    try {
      const [resProd, resProg] = await Promise.all([
        authFetch(`${API_BASE_URL}/ingenieria/semielaborados`),
        authFetch(
          `${API_BASE_URL}/produccion/programacion?start=${weekDays[0]}&end=${weekDays[6]}`
        ),
      ]);
      if (resProd.ok) setProductos(await resProd.json());
      if (resProg.ok) setProgramacion(await resProg.json());
      setLoading(false);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [weekStart]);

  const handleDragStart = (e) => {
    const prodId = e.active.id.replace("prod-", "");
    const prod = productos.find((p) => String(p.id) === prodId);
    setActiveDrag(prod);
  };

  const handleDragEnd = (e) => {
    setActiveDrag(null);
    const { over, active } = e;
    if (!over) return;

    const [_, maquina, brazo, fecha] = over.id.split("|");
    const prodId = active.id.replace("prod-", "");
    const prod = productos.find((p) => String(p.id) === prodId);

    // Preparar datos de balanceo para el Modal
    const itemsInMachineDay = programacion.filter(
      (p) => p.fecha.startsWith(fecha) && p.maquina === maquina
    );
    const currentLoad = {};
    ESTRUCTURA_PLANTA.find((m) => m.id === maquina)?.brazos.forEach((b) => {
      const itemsBrazo = itemsInMachineDay.filter((i) => i.brazo === b);
      currentLoad[b] = calcularCiclosTotal(itemsBrazo);
    });

    // Grupos en el target
    const itemsInTarget = itemsInMachineDay.filter((i) => i.brazo === brazo);
    const groupsMap = {};
    itemsInTarget.forEach((i) => {
      if (!groupsMap[i.grupo_id])
        groupsMap[i.grupo_id] = { id: i.grupo_id, nombres: [] };
      groupsMap[i.grupo_id].nombres.push(i.nombre);
    });

    setModalConfig({
      mode: "create",
      product: prod,
      target: { fecha, maquina, brazo, prodId },
      initialData: { cantidad: 50, unidades_por_ciclo: 1 },
      existingGroups: Object.values(groupsMap),
      currentLoad, // Pasamos la carga actual al modal
    });
    setModalOpen(true);
  };

  const handleEditClick = (item) => {
    // Para editar, calculamos carga simulada
    const itemsInMachineDay = programacion.filter(
      (p) => p.fecha.startsWith(item.fecha) && p.maquina === item.maquina
    );
    const currentLoad = {};
    ESTRUCTURA_PLANTA.find((m) => m.id === item.maquina)?.brazos.forEach(
      (b) => {
        const itemsBrazo = itemsInMachineDay.filter((i) => i.brazo === b);
        currentLoad[b] = calcularCiclosTotal(itemsBrazo);
      }
    );

    setModalConfig({
      mode: "edit",
      product: { nombre: item.nombre, codigo: item.codigo },
      target: {
        id: item.id,
        maquina: item.maquina,
        brazo: item.brazo,
        fecha: item.fecha,
      }, // Necesitamos fecha para display
      initialData: {
        cantidad: item.cantidad,
        unidades_por_ciclo: item.unidades_por_ciclo,
      },
      currentLoad,
    });
    setModalOpen(true);
  };

  const handleSaveModal = async (cantidad, piezasCiclo, grupoId) => {
    setModalOpen(false);
    try {
      if (modalConfig.mode === "create") {
        const { fecha, maquina, brazo, prodId } = modalConfig.target;
        await authFetch(`${API_BASE_URL}/produccion/programacion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fecha,
            maquina,
            brazo,
            semielaborado_id: prodId,
            cantidad,
            unidades_por_ciclo: piezasCiclo,
            grupo_id: grupoId,
          }),
        });
      } else {
        await authFetch(
          `${API_BASE_URL}/produccion/programacion/${modalConfig.target.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cantidad, unidades_por_ciclo: piezasCiclo }),
          }
        );
      }
      cargarDatos();
    } catch (error) {
      alert("Error al guardar");
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm("¿Quitar?")) return;
    await authFetch(`${API_BASE_URL}/produccion/programacion/${id}`, {
      method: "DELETE",
    });
    cargarDatos();
  };

  const toggleMachine = (id) => {
    setCollapsedMachines((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const exportPDF = () => {
    const doc = new jsPDF("landscape");
    const title = `Planificación: ${new Date(weekDays[0]).toLocaleDateString(
      "es-AR"
    )} al ${new Date(weekDays[6]).toLocaleDateString("es-AR")}`;
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    const head = [
      [
        "Estación",
        ...weekDays.map((d) =>
          new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
            weekday: "short",
            day: "2-digit",
          })
        ),
      ],
    ];
    const body = [];
    ESTRUCTURA_PLANTA.forEach((mq) => {
      body.push([
        {
          content: mq.id,
          colSpan: 8,
          styles: {
            fillColor: [40, 50, 70],
            fontStyle: "bold",
            textColor: 255,
          },
        },
      ]);
      mq.brazos.forEach((brazo) => {
        const row = [brazo];
        weekDays.forEach((day) => {
          const items = programacion.filter(
            (p) =>
              p.fecha.startsWith(day) &&
              p.maquina === mq.id &&
              p.brazo === brazo
          );
          if (items.length > 0) {
            const ciclos = calcularCiclosTotal(items);
            const itemsTxt = items
              .map((i) => `${i.nombre} (${i.cantidad})`)
              .join("\n");
            row.push(`${itemsTxt}\n--\n[${ciclos} ciclos]`);
          } else {
            row.push("-");
          }
        });
        body.push(row);
      });
    });
    autoTable(doc, {
      head,
      body,
      startY: 20,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 25, fillColor: [240, 240, 240] },
      },
    });
    doc.save(`Planificacion.pdf`);
  };

  if (loading)
    return (
      <div className="p-20">
        <Loader text="Cargando..." size="lg" />
      </div>
    );

  const filteredProducts =
    search.trim().length >= 2
      ? productos.filter(
          (p) =>
            (p.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
            (p.codigo || "").toLowerCase().includes(search.toLowerCase())
        )
      : [];

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-[calc(100vh-9rem)] gap-0 bg-slate-950 overflow-hidden animate-in fade-in rounded-xl border border-slate-800 shadow-2xl relative">
        <AnimatePresence>
          {modalOpen && (
            <ScheduleModal
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              onSave={handleSaveModal}
              initialData={modalConfig?.initialData}
              product={modalConfig?.product}
              targetInfo={modalConfig?.target}
              existingGroups={modalConfig?.existingGroups}
              currentLoad={modalConfig?.currentLoad}
            />
          )}
        </AnimatePresence>

        <motion.div
          initial={false}
          animate={{ width: sidebarOpen ? 288 : 48 }}
          className="bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-xl transition-all duration-300 relative"
        >
          <div className="p-3 border-b border-slate-800 flex justify-between items-center h-16">
            {sidebarOpen && (
              <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider">
                Catálogo
              </h3>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-slate-800"
            >
              {sidebarOpen ? <FaChevronLeft /> : <FaChevronRight />}
            </button>
          </div>
          {sidebarOpen ? (
            <>
              <div className="px-3 pb-3 border-b border-slate-800">
                <div className="relative group mt-2">
                  <FaSearch className="absolute left-3 top-3 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-slate-900/50">
                {search.trim().length < 2 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2 mt-10">
                    <FaBoxOpen className="text-4xl opacity-20" />
                    <p className="text-xs text-center px-6">
                      Escribe para buscar.
                    </p>
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <DraggableProduct
                      key={p.id}
                      product={p}
                      isOverlay={false}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center pt-10 gap-4 text-gray-500">
              <span className="text-xs font-bold uppercase tracking-widest -rotate-90 whitespace-nowrap origin-center">
                CATÁLOGO
              </span>
            </div>
          )}
        </motion.div>

        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 shadow-sm z-30 h-16">
            <div className="flex items-center gap-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Centro de Comando
              </h2>
              <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                <button
                  onClick={() =>
                    setWeekStart(
                      new Date(weekStart.setDate(weekStart.getDate() - 7))
                    )
                  }
                  className="p-2 hover:bg-slate-700 rounded text-gray-400 hover:text-white"
                >
                  <FaChevronLeft />
                </button>
                <span className="px-4 text-sm font-mono font-bold text-white w-32 text-center">
                  {new Date(weekDays[0]).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
                <button
                  onClick={() =>
                    setWeekStart(
                      new Date(weekStart.setDate(weekStart.getDate() + 7))
                    )
                  }
                  className="p-2 hover:bg-slate-700 rounded text-gray-400 hover:text-white"
                >
                  <FaChevronRight />
                </button>
              </div>
            </div>
            <button
              onClick={exportPDF}
              className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-600"
            >
              <FaFilePdf className="text-red-500" /> Exportar
            </button>
          </div>

          <div className="flex-1 overflow-auto no-scrollbar relative bg-slate-950">
            <div className="grid grid-cols-[130px_repeat(7,minmax(110px,1fr))] min-w-full">
              <div className="sticky top-0 z-20 bg-slate-900 border-b border-r border-slate-800 h-10 flex items-center justify-center font-bold text-gray-500 text-[10px] uppercase tracking-widest shadow-md">
                Máquina
              </div>
              {weekDays.map((dateStr) => {
                const d = new Date(dateStr + "T12:00:00");
                const esHoy = new Date().toDateString() === d.toDateString();
                return (
                  <div
                    key={dateStr}
                    className={`sticky top-0 z-20 border-b border-r border-slate-800 h-10 flex flex-col items-center justify-center shadow-md ${
                      esHoy
                        ? "bg-blue-900/30 text-blue-200 border-b-blue-500"
                        : "bg-slate-900 text-gray-400"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {d.toLocaleDateString("es-AR", { weekday: "short" })}
                    </span>
                    <span className="text-xs font-bold leading-none mt-0.5">
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}

              {ESTRUCTURA_PLANTA.map((mq) => {
                const isCollapsed = collapsedMachines[mq.id];
                return (
                  <React.Fragment key={mq.id}>
                    <div className="col-span-8 bg-slate-800/80 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <span className="opacity-70">
                          {getMachineIcon(mq.tipo)}
                        </span>{" "}
                        {mq.id}
                      </div>
                      <button
                        onClick={() => toggleMachine(mq.id)}
                        className="text-gray-400 hover:text-white p-0.5 border border-gray-600 rounded bg-slate-900"
                      >
                        {isCollapsed ? (
                          <FaPlus size={10} />
                        ) : (
                          <FaMinus size={10} />
                        )}
                      </button>
                    </div>
                    {!isCollapsed &&
                      mq.brazos.map((brazo) => (
                        <React.Fragment key={`${mq.id}-${brazo}`}>
                          <div className="sticky left-0 z-10 bg-slate-900/50 border-b border-r border-slate-800 py-4 flex items-center justify-start pl-8 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wide leading-tight">
                              {brazo}
                            </span>
                          </div>
                          {weekDays.map((dateStr) => {
                            // CALCULAR BALANCEO EN VIVO PARA ESTA CELDA
                            const itemsInMachineDay = programacion.filter(
                              (p) =>
                                p.fecha.startsWith(dateStr) &&
                                p.maquina === mq.id
                            );
                            const loadBalance = {};
                            // Solo calculamos si la máquina tiene múltiples brazos (es Horno)
                            if (mq.brazos.length > 1) {
                              mq.brazos.forEach((b) => {
                                const itemsB = itemsInMachineDay.filter(
                                  (i) => i.brazo === b
                                );
                                loadBalance[b] = {
                                  cycles: calcularCiclosTotal(itemsB),
                                  brazo: b,
                                }; // Estructura para helper
                              });
                            }

                            // Adaptar estructura simple para el helper del componente
                            const loadBalanceSimple = {};
                            Object.values(loadBalance).forEach(
                              (v) =>
                                (loadBalanceSimple[v.brazo] = {
                                  ciclos: v.cycles,
                                  brazo: v.brazo,
                                })
                            );

                            return (
                              <DroppableCell
                                key={`${mq.id}-${brazo}-${dateStr}`}
                                date={dateStr}
                                machine={mq.id}
                                arm={brazo}
                                items={programacion.filter(
                                  (p) =>
                                    p.fecha.startsWith(dateStr) &&
                                    p.maquina === mq.id &&
                                    p.brazo === brazo
                                )}
                                loadBalance={
                                  mq.brazos.length > 1
                                    ? loadBalanceSimple
                                    : null
                                }
                                onDeleteItem={handleDeleteItem}
                                onEditItem={handleEditClick}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeDrag ? (
          <div className="opacity-90 scale-105 rotate-2 cursor-grabbing">
            <DraggableProduct product={activeDrag} isOverlay={true} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
