import { useEffect, useState, useRef } from "react";
import {
  FaPlus,
  FaSpinner,
  FaClipboardList,
  FaBoxOpen,
  FaUser,
  FaCalendarAlt,
  FaExchangeAlt,
  FaTrash,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSave,
  FaSearch,
  FaListUl,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils.js";
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";

// --- SUB-COMPONENTE: TARJETA DE ITEM EN LISTA (RESPONSIVE) ---
const ProductionItemCard = ({ item, index, onUpdate, onRemove }) => {
  const hasScrap = item.cantidadScrap > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`relative p-5 rounded-2xl border-l-4 shadow-lg transition-all group ${
        hasScrap
          ? "bg-slate-800 border-red-500 shadow-red-900/10"
          : "bg-slate-800 border-green-500 shadow-green-900/10"
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="pr-10">
          <h4 className="font-bold text-white text-lg leading-tight tracking-tight">
            {item.nombre}
          </h4>
          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-gray-400 border border-slate-700">
            {item.codigo}
          </span>
        </div>
        <button
          onClick={() => onRemove(index)}
          className="absolute top-4 right-4 text-slate-600 hover:text-red-400 p-2 rounded-full hover:bg-slate-700/50 transition-colors"
          title="Quitar de la lista"
        >
          <FaTrash />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* INPUT OK */}
        <div className="bg-slate-900/80 p-3 rounded-xl border border-green-500/20 focus-within:border-green-500/50 transition-colors">
          <label className="block text-[10px] uppercase font-bold text-green-400 mb-1 flex items-center gap-1.5">
            <FaCheckCircle /> Cantidad OK
          </label>
          <input
            type="number"
            min="0"
            className="w-full bg-transparent text-2xl font-bold text-white outline-none placeholder-slate-700"
            placeholder="0"
            value={item.cantidadOk}
            onChange={(e) =>
              onUpdate(index, "cantidadOk", Number(e.target.value))
            }
            onFocus={(e) => e.target.select()}
          />
        </div>

        {/* INPUT SCRAP */}
        <div className="bg-slate-900/80 p-3 rounded-xl border border-red-500/20 focus-within:border-red-500/50 transition-colors">
          <label className="block text-[10px] uppercase font-bold text-red-400 mb-1 flex items-center gap-1.5">
            <FaExclamationTriangle /> Fallas
          </label>
          <input
            type="number"
            min="0"
            className="w-full bg-transparent text-2xl font-bold text-white outline-none placeholder-slate-700"
            placeholder="0"
            value={item.cantidadScrap}
            onChange={(e) =>
              onUpdate(index, "cantidadScrap", Number(e.target.value))
            }
            onFocus={(e) => e.target.select()}
          />
        </div>
      </div>

      {/* MOTIVO SCRAP (Solo visible si hay scrap) */}
      <AnimatePresence>
        {hasScrap && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-3"
          >
            <select
              className="w-full bg-red-900/10 border border-red-500/30 text-red-200 text-sm rounded-lg p-2.5 outline-none focus:border-red-500 cursor-pointer"
              value={item.motivoScrap}
              onChange={(e) => onUpdate(index, "motivoScrap", e.target.value)}
            >
              <option value="">-- Seleccionar Motivo de Falla --</option>
              <option value="Pieza quemada">Pieza quemada</option>
              <option value="Pieza cruda">Pieza cruda</option>
              <option value="Material erróneo">Material erróneo</option>
              <option value="Materia prima defectuosa">
                Materia prima defectuosa
              </option>
              <option value="Matriz fría">Matriz fría</option>
              <option value="Sin respiradero">Sin respiradero</option>
              <option value="Sin silicona">Sin silicona</option>
              <option value="Otros">Otros</option>
            </select>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function RegistrarProduccionPage() {
  // --- ESTADOS GLOBALES ---
  const [openPlans, setOpenPlans] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [planProducts, setPlanProducts] = useState([]); // Productos DEL PLAN seleccionado

  // --- ESTADOS DEL FORMULARIO (CONTEXTO) ---
  const [contexto, setContexto] = useState({
    operarioId: "",
    planId: "",
    fecha: new Date().toISOString().split("T")[0],
    turno: "Diurno",
  });

  // --- ESTADOS DE CARGA (ITEMS) ---
  const [items, setItems] = useState([]);
  const [productToAdd, setProductToAdd] = useState(null); // Objeto completo del producto
  const [resetKey, setResetKey] = useState(0); // Para limpiar el input

  const [loading, setLoading] = useState(true);
  const [loadingPlanItems, setLoadingPlanItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- 1. CARGA INICIAL ---
  useEffect(() => {
    const initData = async () => {
      try {
        const [resPlanes, resOps] = await Promise.all([
          authFetch(`${API_BASE_URL}/planificacion/abiertos`),
          authFetch(`${API_BASE_URL}/operarios`),
        ]);
        if (resPlanes.ok) setOpenPlans(await resPlanes.json());
        if (resOps.ok) setOperarios(await resOps.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // --- 2. CARGAR PRODUCTOS AL SELECCIONAR PLAN ---
  useEffect(() => {
    if (!contexto.planId) {
      setPlanProducts([]);
      return;
    }
    const fetchPlanItems = async () => {
      setLoadingPlanItems(true);
      try {
        const res = await authFetch(
          `${API_BASE_URL}/planificacion/${contexto.planId}`,
        );
        if (res.ok) {
          const data = await res.json();
          const productosDisponibles = data.items.map((i) => ({
            id: i.semielaborado.id,
            nombre: i.semielaborado.nombre,
            codigo: i.semielaborado.codigo,
            plan_item_id: i.id,
          }));
          setPlanProducts(productosDisponibles);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPlanItems(false);
      }
    };
    fetchPlanItems();
  }, [contexto.planId]);

  // --- HANDLERS ---

  const handleContextChange = (field, value) => {
    setContexto((prev) => ({ ...prev, [field]: value }));
    if (field === "planId") {
      setItems([]);
      setProductToAdd(null);
      setResetKey((prev) => prev + 1); // Limpiar buscador
    }
  };

  const handleAddProduct = () => {
    if (!productToAdd) return;

    // Evitar duplicados visuales en la lista de carga
    if (items.some((i) => i.semiId === productToAdd.id)) {
      alert(
        "Este producto ya está en la lista. Puedes editar su cantidad abajo.",
      );
      return;
    }

    setItems((prev) => [
      {
        semiId: productToAdd.id,
        nombre: productToAdd.nombre,
        codigo: productToAdd.codigo,
        cantidadOk: "",
        cantidadScrap: "",
        motivoScrap: "",
      },
      ...prev,
    ]);

    // Limpiar selección
    setProductToAdd(null);
    setResetKey((prev) => prev + 1); // Forzar reset del input
  };

  const handleUpdateItem = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    if (
      !contexto.operarioId ||
      !contexto.planId ||
      !contexto.fecha ||
      items.length === 0
    ) {
      return alert(
        "Faltan datos obligatorios (Operario, Plan, Fecha o Productos).",
      );
    }

    const validItems = items.filter(
      (i) => Number(i.cantidadOk) > 0 || Number(i.cantidadScrap) > 0,
    );

    if (validItems.length === 0)
      return alert("Ingresa cantidades en al menos un producto.");

    const scrapInvalido = validItems.some(
      (i) => Number(i.cantidadScrap) > 0 && !i.motivoScrap,
    );
    if (scrapInvalido)
      return alert("Por favor indica el motivo para los productos con fallas.");

    if (!confirm(`¿Confirmar registro de ${validItems.length} producciones?`))
      return;

    setIsSaving(true);
    try {
      const promises = validItems.map((item) =>
        authFetch(`${API_BASE_URL}/produccion/registrar-a-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_id: contexto.planId,
            semielaborado_id: item.semiId,
            operario_id: contexto.operarioId,
            fecha_produccion: contexto.fecha,
            turno: contexto.turno,
            cantidad_ok: Number(item.cantidadOk) || 0,
            cantidad_scrap: Number(item.cantidadScrap) || 0,
            motivo_scrap: item.motivoScrap,
          }),
        }),
      );

      await Promise.all(promises);

      alert("✅ Producción registrada exitosamente.");
      setItems([]);
    } catch (e) {
      alert("Hubo un error al guardar. Verifica la conexión.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-64 text-white text-xl">
        <FaSpinner className="animate-spin mr-3" /> Cargando...
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto pb-32 px-4 pt-6 animate-in fade-in">
      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <FaClipboardList className="text-green-500" /> Registrar Producción
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Mesa de entrada rápida de producción diaria.
          </p>
        </div>
      </div>

      {/* 1. SECCIÓN DE CONTEXTO */}
      <div className="bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700 mb-8">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2 tracking-wider">
          <FaUser /> Configuración del Turno
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* OPERARIO */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 ml-1">
              Operario
            </label>
            <div className="relative">
              <select
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-sm focus:border-green-500 outline-none appearance-none"
                value={contexto.operarioId}
                onChange={(e) =>
                  handleContextChange("operarioId", e.target.value)
                }
              >
                <option value="">Seleccionar...</option>
                {operarios.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nombre}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                ▼
              </div>
            </div>
          </div>

          {/* PLAN */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 ml-1">
              Plan Activo
            </label>
            <div className="relative">
              <select
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-sm focus:border-green-500 outline-none appearance-none"
                value={contexto.planId}
                onChange={(e) => handleContextChange("planId", e.target.value)}
              >
                <option value="">Seleccionar Plan...</option>
                {openPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                ▼
              </div>
            </div>
          </div>

          {/* FECHA */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 ml-1">
              Fecha
            </label>
            <div className="relative">
              <input
                type="date"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-sm focus:border-green-500 outline-none"
                value={contexto.fecha}
                onChange={(e) => handleContextChange("fecha", e.target.value)}
              />
              <FaCalendarAlt className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* TURNO */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 ml-1">
              Turno
            </label>
            <div className="relative">
              <select
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-sm focus:border-green-500 outline-none appearance-none"
                value={contexto.turno}
                onChange={(e) => handleContextChange("turno", e.target.value)}
              >
                <option value="Diurno">Diurno</option>
                <option value="Nocturno">Nocturno</option>
              </select>
              <FaExchangeAlt className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE BÚSQUEDA Y AGREGADO (SOLO SI HAY PLAN) */}
      <AnimatePresence>
        {contexto.planId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase flex items-center gap-2 pl-1">
              <FaBoxOpen /> Agregar Producto del Plan
              {loadingPlanItems && (
                <FaSpinner className="animate-spin text-green-500" />
              )}
            </label>

            <div className="flex flex-col md:flex-row gap-3 items-stretch bg-slate-800 p-2 rounded-2xl border border-slate-700 shadow-md">
              {/* INPUT BUSCADOR */}
              <div className="flex-1 relative z-20">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none z-10 text-lg">
                  <FaSearch />
                </div>
                <AutoCompleteInput
                  key={resetKey} // Clave para forzar reset al agregar
                  items={planProducts}
                  onSelect={(item) => setProductToAdd(item)}
                  placeholder="Escribe para filtrar productos del plan..."
                  disabled={loadingPlanItems}
                />
              </div>

              {/* BOTÓN AGREGAR */}
              <button
                onClick={handleAddProduct}
                disabled={!productToAdd}
                className="md:w-40 bg-green-600 hover:bg-green-500 text-white font-bold py-3 md:py-0 px-6 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <FaPlus /> Agregar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. LISTA DE CARGA (GRID DE TARJETAS) */}
      <div className="space-y-4">
        {items.length === 0 ? (
          contexto.planId && (
            <div className="text-center py-16 text-gray-500 bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-700/50 flex flex-col items-center gap-3">
              <FaListUl className="text-4xl opacity-20" />
              <p>Lista de carga vacía. Busca y agrega productos arriba.</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {items.map((item, index) => (
                <ProductionItemCard
                  key={`${item.semiId}-${index}`}
                  item={item}
                  index={index}
                  onUpdate={handleUpdateItem}
                  onRemove={handleRemoveItem}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 4. BOTÓN FLOTANTE / FIJO DE GUARDADO */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-0 right-0 px-4 flex justify-center z-50 pointer-events-none"
          >
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold py-4 px-12 rounded-full shadow-2xl shadow-blue-900/40 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:scale-100 border-2 border-blue-400/20"
            >
              {isSaving ? <FaSpinner className="animate-spin" /> : <FaSave />}
              {isSaving
                ? "Guardando..."
                : `Registrar ${items.length} Productos`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
