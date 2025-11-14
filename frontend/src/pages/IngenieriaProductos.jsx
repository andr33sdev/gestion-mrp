import { useEffect, useState } from "react";
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
} from "react-icons/fa";
import { API_BASE_URL, PEDIDOS_API_URL } from "../utils.js";

// 1. ÍTEM ARRASTRABLE (Semielaborado)
function DraggableItem({ item, isOverlay }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `source-${item.id}`,
      data: item,
      disabled: isOverlay,
    });

  // FIX: Interpolación manual
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
    "bg-slate-700 border-slate-600 hover:bg-slate-600 cursor-grab hover:border-blue-400/50";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${baseClasses} ${isOverlay ? overlayClasses : normalClasses}`}
    >
      <div className="flex flex-col">
        <p className="font-bold text-sm text-white font-mono">{item.codigo}</p>
        <p className="text-xs text-gray-300 truncate w-40">{item.nombre}</p>
      </div>
      <span
        className={`text-xs px-2 py-1 rounded font-bold ${
          item.stock_actual > 0
            ? "bg-blue-900/50 text-blue-200"
            : "bg-red-900/50 text-red-200"
        }`}
      >
        {item.stock_actual}
      </span>
    </div>
  );
}

// 2. ÁREA DE RECETA (Donde soltamos)
function DroppableArea({ items, onRemove }) {
  const { setNodeRef, isOver } = useDroppable({ id: "receta-droppable" });
  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-xl p-4 transition-all duration-200 overflow-y-auto min-h-[300px] ${
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
          <p className="font-medium">Arrastra semielaborados aquí</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((ing, idx) => (
            <li
              key={idx}
              className="bg-slate-700 p-3 rounded-lg flex justify-between items-center group border border-slate-600 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 h-8 w-8 flex items-center justify-center rounded font-bold text-green-400 border border-slate-600 text-sm">
                  {ing.cantidad}x
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-medium text-sm">
                    {ing.nombre}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {ing.codigo}
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

// 3. COMPONENTE PRINCIPAL DE INGENIERÍA
export default function IngenieriaProductos() {
  const [productos, setProductos] = useState([]);
  const [semielaborados, setSemielaborados] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [ultimaModificacion, setUltimaModificacion] = useState(null);
  const [receta, setReceta] = useState([]);
  const [filtroSemi, setFiltroSemi] = useState("");
  const [filtroProd, setFiltroProd] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);

  useEffect(() => {
    fetch(`${PEDIDOS_API_URL}?t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        const s = new Set();
        data.forEach((r) => {
          if (r.MODELO || r.Modelo) s.add(r.MODELO || r.Modelo);
        });
        setProductos(Array.from(s).sort());
      });
    fetch(`${API_BASE_URL}/ingenieria/semielaborados`)
      .then((r) => r.json())
      .then(setSemielaborados);
  }, []);

  const cargarReceta = async (prod) => {
    setSeleccionado(prod);
    setReceta([]);
    setUltimaModificacion(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/ingenieria/recetas/${encodeURIComponent(prod)}`
      );
      if (res.ok) {
        const data = await res.json();
        setReceta(data.map((d) => ({ ...d, id: d.semielaborado_id })));
        if (data.length > 0 && data[0].fecha_receta)
          setUltimaModificacion(data[0].fecha_receta);
      }
    } catch (e) {}
  };

  const guardar = async () => {
    if (!seleccionado) return;
    await fetch(`${API_BASE_URL}/ingenieria/recetas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        producto_terminado: seleccionado,
        items: receta.map((r) => ({ id: r.id, cantidad: 1 })),
      }),
    });
    setUltimaModificacion(new Date().toLocaleString("es-AR"));
    alert("Receta guardada");
  };

  const syncStock = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/ingenieria/sincronizar-stock`, {
        method: "POST",
      });
      if (!r.ok) throw new Error("Error del servidor");
      const res = await fetch(`${API_BASE_URL}/ingenieria/semielaborados`);
      setSemielaborados(await res.json());
      alert("Stock sincronizado");
    } catch (e) {
      alert("Error sincronizando");
    }
    setLoading(false);
  };

  const handleDragStart = (e) => setActiveDragId(e.active.id);

  const handleDragEnd = (e) => {
    setActiveDragId(null);
    if (e.over && e.over.id === "receta-droppable") {
      const itemId = e.active.id.replace("source-", "");
      const itemData = semielaborados.find((s) => s.id == itemId); // eslint-disable-line
      if (itemData)
        setReceta((prev) => [...prev, { ...itemData, cantidad: 1 }]);
    }
  };

  const prodFiltered =
    filtroProd.length > 0
      ? productos.filter((p) =>
          p.toLowerCase().includes(filtroProd.toLowerCase())
        )
      : productos;
  const semiVisible =
    filtroSemi.length > 0
      ? semielaborados.filter(
          (s) =>
            s.nombre.toLowerCase().includes(filtroSemi.toLowerCase()) ||
            s.codigo.toLowerCase().includes(filtroSemi.toLowerCase())
        )
      : [];
  const activeItemData = activeDragId
    ? semielaborados.find((s) => `source-${s.id}` === activeDragId)
    : null; // eslint-disable-line

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
        <div className="col-span-3 bg-slate-800 rounded-xl flex flex-col border border-slate-700 overflow-hidden shadow-lg">
          <div className="p-4 bg-slate-800 border-b border-slate-700 z-10">
            <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2 text-sm uppercase">
              <FaBoxOpen /> Productos ({productos.length})
            </h3>
            <input
              type="text"
              placeholder="Buscar..."
              value={filtroProd}
              onChange={(e) => setFiltroProd(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {prodFiltered.length === 0 ? (
              <div className="text-center text-gray-500 text-xs mt-4">
                No hay coincidencias
              </div>
            ) : (
              prodFiltered.map((prod, i) => (
                <div
                  key={i}
                  onClick={() => cargarReceta(prod)}
                  className={`px-3 py-2 rounded-lg cursor-pointer text-sm truncate transition-all ${
                    seleccionado === prod
                      ? "bg-blue-600 text-white font-bold shadow"
                      : "text-gray-400 hover:bg-slate-700 hover:text-gray-200"
                  }`}
                >
                  {prod}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="col-span-5 flex flex-col bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden shadow-lg relative">
          <div className="p-5 bg-slate-800 border-b border-slate-700 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FaTools className="text-gray-500" />{" "}
                {seleccionado || "Selecciona un producto"}
              </h2>
              {seleccionado && (
                <p className="text-xs text-gray-400 mt-1">
                  Última mod:{" "}
                  <span className="text-yellow-400">
                    {ultimaModificacion || "Nunca"}
                  </span>
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
          <div className="p-4 flex flex-col overflow-hidden">
            {seleccionado ? (
              <>
                <DroppableArea
                  items={receta}
                  onRemove={(idx) =>
                    setReceta((prev) => prev.filter((_, i) => i !== idx))
                  }
                />
                <div className="mt-2 text-center">
                  <span className="text-xs text-gray-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    {receta.length} componentes
                  </span>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm italic">
                ← Selecciona un producto
              </div>
            )}
          </div>
        </div>
        <div className="col-span-4 bg-slate-800 rounded-xl flex flex-col border border-slate-700 overflow-hidden shadow-lg">
          <div className="p-4 bg-slate-800 border-b border-slate-700 z-10">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-purple-400 font-bold flex items-center gap-2 text-sm uppercase">
                <FaCubes /> Semielaborados
              </h3>
              <button
                onClick={syncStock}
                disabled={loading}
                className="text-[10px] uppercase font-bold tracking-wider bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded border border-slate-600 transition-colors"
              >
                {loading ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  "Sync Drive"
                )}
              </button>
            </div>
            <input
              type="text"
              placeholder="Buscar componente..."
              value={filtroSemi}
              onChange={(e) => setFiltroSemi(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto p-2 bg-slate-800/50 custom-scrollbar">
            {filtroSemi.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-gray-500 text-xs italic">
                Escribe para buscar...
              </div>
            ) : semiVisible.length === 0 ? (
              <div className="text-center text-gray-500 text-xs mt-4">
                No hay coincidencias
              </div>
            ) : (
              semiVisible.map((s) => (
                <DraggableItem key={s.id} item={s} isOverlay={false} />
              ))
            )}
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
