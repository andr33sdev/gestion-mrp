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
  FaPlus,
  FaRecycle,
  FaLeaf,
} from "react-icons/fa";
import { API_BASE_URL, PEDIDOS_API_URL } from "../utils.js";

// --- 1. ÍTEM ARRASTRABLE (Componente / Materia Prima) ---
function DraggableItem({ item, isOverlay }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `source-${item.id}`,
      data: item,
      disabled: isOverlay,
    });

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

// --- 2. ÁREA DE RECETA (Donde soltamos) ---
// *** NUEVO: AÑADIDO 'onCantidadChange' ***
function DroppableArea({ items, onRemove, placeholderText, onCantidadChange }) {
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
                {/* *** NUEVO: onClick y cursor-pointer *** */}
                <div
                  onClick={() => onCantidadChange && onCantidadChange(idx)}
                  className="bg-slate-800 h-8 w-8 flex items-center justify-center rounded font-bold text-green-400 border border-slate-600 text-sm cursor-pointer hover:bg-slate-700 transition-colors"
                  title="Clic para editar cantidad"
                >
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

// --- 3. COMPONENTE PRINCIPAL ---
export default function IngenieriaProductos() {
  // ESTADOS DE DATOS
  const [productos, setProductos] = useState([]); // Lista strings
  const [semielaborados, setSemielaborados] = useState([]); // Lista objetos
  const [materiasPrimas, setMateriasPrimas] = useState([]); // Lista objetos

  // ESTADOS DE INTERFAZ
  const [modo, setModo] = useState("PRODUCTO"); // "PRODUCTO" o "SEMIELABORADO"
  const [seleccionado, setSeleccionado] = useState(null); // String (Prod) u Objeto (Semi)
  const [receta, setReceta] = useState([]); // Items en la receta actual
  const [ultimaModificacion, setUltimaModificacion] = useState(null);

  // FILTROS
  const [filtroIzq, setFiltroIzq] = useState(""); // Filtro lista izquierda (lo que edito)
  const [filtroDer, setFiltroDer] = useState(""); // Filtro lista derecha (ingredientes)

  const [loading, setLoading] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);

  // --- 1. CARGA INICIAL DE TODO ---
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // A. Cargar Productos (Fusionando Excel + BD)
        const [resPedidos, resRecetas] = await Promise.all([
          fetch(`${PEDIDOS_API_URL}?t=${Date.now()}`),
          fetch(`${API_BASE_URL}/ingenieria/recetas/all`),
        ]);
        const dataPedidos = await resPedidos.json();
        const dataRecetas = await resRecetas.json();

        const setNombres = new Set();
        dataPedidos.forEach((r) => {
          const nombre = r.MODELO || r.Modelo;
          if (nombre) setNombres.add(nombre.trim());
        });
        Object.keys(dataRecetas).forEach((nombre) => {
          if (nombre) setNombres.add(nombre.trim());
        });
        setProductos(Array.from(setNombres).sort());

        // B. Cargar Semielaborados
        const resSemis = await fetch(
          `${API_BASE_URL}/ingenieria/semielaborados`
        );
        setSemielaborados(await resSemis.json());

        // C. Cargar Materias Primas
        const resMP = await fetch(`${API_BASE_URL}/ingenieria/materias-primas`);
        setMateriasPrimas(await resMP.json());
      } catch (error) {
        console.error("Error cargando datos iniciales:", error);
      }
    };
    cargarDatos();
  }, []);

  // --- 2. SELECCIONAR Y CARGAR RECETA ---
  const cargarReceta = async (item) => {
    setSeleccionado(item);
    setReceta([]);
    setUltimaModificacion(null);

    let url = "";
    if (modo === "PRODUCTO") {
      url = `${API_BASE_URL}/ingenieria/recetas/${encodeURIComponent(item)}`;
    } else {
      url = `${API_BASE_URL}/ingenieria/recetas-semielaborados/${item.id}`;
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReceta(
          data.map((d) => ({
            ...d,
            // *** La cantidad AHORA VIENE DE LA BD ***
            cantidad: Number(d.cantidad) || 1,
            id: modo === "PRODUCTO" ? d.semielaborado_id : d.materia_prima_id,
          }))
        );

        if (data.length > 0 && data[0].fecha_receta) {
          setUltimaModificacion(data[0].fecha_receta);
        }
      }
    } catch (e) {
      console.error("Error cargando receta", e);
    }
  };

  // --- 3. CREAR PRODUCTO NUEVO (Solo modo Producto) ---
  const crearNuevoProducto = () => {
    if (modo !== "PRODUCTO" || !filtroIzq.trim()) return;
    const nuevoNombre = filtroIzq.trim().toUpperCase();
    setProductos((prev) => [...prev, nuevoNombre].sort());
    setSeleccionado(nuevoNombre);
    setReceta([]);
    setUltimaModificacion("Borrador (Nuevo)");
    setFiltroIzq("");
  };

  // --- 4. GUARDAR ---
  // *** CORREGIDO: Ahora envía la cantidad correcta ***
  const guardar = async () => {
    if (!seleccionado) return;

    let endpoint = "";
    let body = {};

    // Mapea la receta real, incluyendo su cantidad
    const itemsToSave = receta.map((r) => ({
      id: r.id,
      cantidad: r.cantidad,
    }));

    if (modo === "PRODUCTO") {
      endpoint = `${API_BASE_URL}/ingenieria/recetas`;
      body = {
        producto_terminado: seleccionado, // Es un string
        items: itemsToSave, // <--- CORREGIDO
      };
    } else {
      endpoint = `${API_BASE_URL}/ingenieria/recetas-semielaborados`;
      body = {
        semielaborado_id: seleccionado.id, // Es un objeto
        items: itemsToSave, // <--- CORREGIDO
      };
    }

    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Error en servidor");

      setUltimaModificacion(new Date().toLocaleString("es-AR"));
      alert("Receta guardada correctamente");
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };

  // --- 5. SINCRONIZAR STOCK (Dual) ---
  const syncStock = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      if (modo === "PRODUCTO") {
        endpoint = `${API_BASE_URL}/ingenieria/sincronizar-stock`; // Sync Semis
      } else {
        endpoint = `${API_BASE_URL}/ingenieria/sincronizar-mp`; // Sync MP
      }

      const r = await fetch(endpoint, { method: "POST" });
      if (!r.ok) throw new Error("Error del servidor");

      // Refrescar la lista correspondiente
      if (modo === "PRODUCTO") {
        const res = await fetch(`${API_BASE_URL}/ingenieria/semielaborados`);
        setSemielaborados(await res.json());
      } else {
        const res = await fetch(`${API_BASE_URL}/ingenieria/materias-primas`);
        setMateriasPrimas(await res.json());
      }
      alert(
        `Sincronización de ${
          modo === "PRODUCTO" ? "Semielaborados" : "Materia Prima"
        } completada.`
      );
    } catch (e) {
      alert("Error sincronizando: " + e.message);
    }
    setLoading(false);
  };

  // --- 6. DRAG & DROP HANDLERS ---

  // *** NUEVO: Pregunta la cantidad al arrastrar ***
  const handleDragEnd = (e) => {
    setActiveDragId(null);
    if (e.over && e.over.id === "receta-droppable") {
      const itemId = e.active.id.replace("source-", "");
      const listaOrigen = modo === "PRODUCTO" ? semielaborados : materiasPrimas;
      const itemData = listaOrigen.find((s) => s.id == itemId); // eslint-disable-line

      if (itemData) {
        // PREGUNTAR CANTIDAD
        const defaultQty = modo === "PRODUCTO" ? "1" : "1.0";
        const cantidadStr = prompt(
          `Ingrese la cantidad de "${itemData.nombre}":`,
          defaultQty
        );

        if (cantidadStr === null) return; // Cancelado

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

  // *** NUEVO: Handler para editar cantidad ***
  const handleCantidadChange = (indexToChange) => {
    const item = receta[indexToChange];
    const defaultQty = String(item.cantidad);
    const cantidadStr = prompt(
      `Modificar cantidad de "${item.nombre}":`,
      defaultQty
    );

    if (cantidadStr === null) return; // Cancelado

    const cantidad = Number(cantidadStr);
    if (isNaN(cantidad) || cantidad <= 0) {
      alert("Cantidad no válida.");
      return;
    }

    // Actualizar el estado
    setReceta((prev) =>
      prev.map((r, index) =>
        index === indexToChange ? { ...r, cantidad: cantidad } : r
      )
    );
  };

  // --- 7. PREPARAR LISTAS VISUALES (Lógica de "escribir para ver") ---

  // Columna Izquierda (Buscador de lo que voy a editar)
  let listaIzquierdaVisible = [];
  if (filtroIzq.trim() === "") {
    listaIzquierdaVisible = [];
  } else if (modo === "PRODUCTO") {
    listaIzquierdaVisible = productos.filter((p) =>
      p.toLowerCase().includes(filtroIzq.toLowerCase())
    );
  } else {
    listaIzquierdaVisible = semielaborados.filter(
      (s) =>
        s.nombre.toLowerCase().includes(filtroIzq.toLowerCase()) ||
        s.codigo.toLowerCase().includes(filtroIzq.toLowerCase())
    );
  }

  // Columna Derecha (Ingredientes disponibles)
  const listaDerechaSource =
    modo === "PRODUCTO" ? semielaborados : materiasPrimas;
  const listaDerechaVisible =
    filtroDer.trim() === ""
      ? []
      : listaDerechaSource.filter(
          (i) =>
            i.nombre.toLowerCase().includes(filtroDer.toLowerCase()) ||
            i.codigo.toLowerCase().includes(filtroDer.toLowerCase())
        );

  const activeItemData = activeDragId
    ? listaDerechaSource.find((s) => `source-${s.id}` === activeDragId)
    : null;

  const noCoincideNinguno =
    modo === "PRODUCTO" &&
    filtroIzq.length > 0 &&
    !productos.some((p) => p.toLowerCase() === filtroIzq.toLowerCase());

  const nombreSeleccionado =
    modo === "PRODUCTO"
      ? seleccionado || "Selecciona un producto"
      : seleccionado?.nombre || "Selecciona un Semielaborado";

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* --- HEADER: SWITCH DE MODO --- */}
      <div className="flex justify-center mb-6 bg-slate-800/50 p-2 rounded-2xl gap-4 border border-slate-700 w-fit mx-auto">
        <button
          onClick={() => {
            setModo("PRODUCTO");
            setSeleccionado(null);
            setReceta([]);
            setFiltroIzq("");
            setFiltroDer("");
          }}
          className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
            modo === "PRODUCTO"
              ? "bg-blue-600 text-white shadow-lg scale-105"
              : "text-gray-400 hover:bg-slate-700"
          }`}
        >
          <FaBoxOpen /> PRODUCTOS
        </button>
        <button
          onClick={() => {
            setModo("SEMIELABORADO");
            setSeleccionado(null);
            setReceta([]);
            setFiltroIzq("");
            setFiltroDer("");
          }}
          className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
            modo === "SEMIELABORADO"
              ? "bg-purple-600 text-white shadow-lg scale-105"
              : "text-gray-400 hover:bg-slate-700"
          }`}
        >
          <FaRecycle /> SEMIELABORADOS
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        {/* --- COLUMNA 1: BUSCADOR (IZQUIERDA) --- */}
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
              placeholder="Buscar..."
              value={filtroIzq}
              onChange={(e) => setFiltroIzq(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {/* Mensaje de ayuda o lista */}
            {filtroIzq.trim() === "" ? (
              <div className="h-32 flex items-center justify-center text-gray-500 text-xs italic opacity-50">
                Escribe para buscar...
              </div>
            ) : (
              <>
                {/* Botón Crear Producto */}
                {noCoincideNinguno && (
                  <div
                    onClick={crearNuevoProducto}
                    className="px-3 py-3 rounded-lg cursor-pointer text-sm border border-dashed border-green-500 text-green-400 hover:bg-green-900/20 hover:text-green-300 transition-all flex items-center gap-2 animate-in fade-in"
                  >
                    <FaPlus /> Crear: "{filtroIzq.toUpperCase()}"
                  </div>
                )}

                {/* Lista */}
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
                        onClick={() => cargarReceta(item)}
                        className={`px-3 py-2 rounded-lg cursor-pointer text-sm truncate transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white font-bold shadow"
                            : "text-gray-400 hover:bg-slate-700 hover:text-gray-200"
                        }`}
                      >
                        {label}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>

        {/* --- COLUMNA 2: EDITOR DE RECETA (CENTRO) --- */}
        <div className="col-span-5 flex flex-col bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden shadow-lg relative">
          <div className="p-5 bg-slate-800 border-b border-slate-700 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FaTools className="text-gray-500" /> {nombreSeleccionado}
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
          <div className="p-4 flex flex-col overflow-hidden flex-1">
            {seleccionado ? (
              <>
                <DroppableArea
                  items={receta}
                  onRemove={(idx) =>
                    setReceta((prev) => prev.filter((_, i) => i !== idx))
                  }
                  onCantidadChange={handleCantidadChange} // <-- Pasamos el handler
                  placeholderText={
                    modo === "PRODUCTO"
                      ? "Arrastra Semielaborados"
                      : "Arrastra Materias Primas"
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
                ← Selecciona un ítem de la izquierda
              </div>
            )}
          </div>
        </div>

        {/* --- COLUMNA 3: INGREDIENTES DISPONIBLES (DERECHA) --- */}
        <div className="col-span-4 bg-slate-800 rounded-xl flex flex-col border border-slate-700 overflow-hidden shadow-lg">
          <div className="p-4 bg-slate-800 border-b border-slate-700 z-10">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-purple-400 font-bold flex items-center gap-2 text-sm uppercase">
                {modo === "PRODUCTO" ? <FaRecycle /> : <FaLeaf />}
                {modo === "PRODUCTO" ? "Semielaborados" : "Materias Primas"}
              </h3>
              <button
                onClick={syncStock}
                disabled={loading}
                className="text-[10px] uppercase font-bold tracking-wider bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded border border-slate-600 transition-colors flex items-center gap-1"
              >
                {loading ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <FaDatabase />
                )}{" "}
                Sync Drive
              </button>
            </div>
            <input
              type="text"
              placeholder="Buscar componente..."
              value={filtroDer}
              onChange={(e) => setFiltroDer(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <div className="overflow-y-auto p-2 bg-slate-800/50 custom-scrollbar flex-1">
            {/* Mensaje de ayuda o lista */}
            {filtroDer.trim() === "" ? (
              <div className="h-32 flex items-center justify-center text-gray-500 text-xs italic opacity-50">
                Busca componentes...
              </div>
            ) : listaDerechaVisible.length === 0 ? (
              <div className="text-center text-gray-500 text-xs mt-4">
                No hay coincidencias
              </div>
            ) : (
              listaDerechaVisible.map((s) => (
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
