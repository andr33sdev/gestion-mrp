import { useEffect, useState } from "react";
import {
  FaSpinner,
  FaExchangeAlt,
  FaTrash,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSave,
  FaBoxOpen,
  FaListUl,
  FaUserCog,
  FaChevronDown,
  FaClipboardCheck,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { API_BASE_URL, authFetch } from "../utils.js";
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";

// --- SUB-COMPONENTE: TARJETA DE ITEM (DISEÑO SUTIL Y DELICADO) ---
const ProductionItemCard = ({ item, index, onUpdate, onRemove }) => {
  const hasScrap = item.cantidadScrap > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] transition-all duration-300 group"
    >
      {/* Indicador de estado lateral (minimalista) */}
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-2xl transition-colors duration-300 ${
          hasScrap ? "bg-rose-400" : "bg-emerald-400"
        }`}
      />

      {/* Cabecera de la tarjeta */}
      <div className="flex justify-between items-start mb-5 pl-2">
        <div className="pr-6">
          <h4 className="font-semibold text-slate-700 text-sm leading-snug mb-1.5">
            {item.nombre}
          </h4>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-50 border border-slate-100 text-slate-400">
            {item.codigo}
          </span>
        </div>
        <button
          onClick={() => onRemove(index)}
          className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-all duration-200 shrink-0"
          title="Eliminar"
        >
          <FaTrash size={13} />
        </button>
      </div>

      {/* Inputs Numéricos */}
      <div className="grid grid-cols-2 gap-3 pl-2">
        {/* Cantidad OK */}
        <div className="bg-slate-50/50 hover:bg-slate-50 rounded-xl p-3 border border-slate-100/60 focus-within:border-emerald-200 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-50 transition-all duration-200">
          <label className="flex items-center gap-1.5 text-[9px] uppercase font-semibold tracking-wider text-slate-400 mb-1">
            <FaCheckCircle size={10} className="text-emerald-400" /> Producido
          </label>
          <input
            type="number"
            min="0"
            className="w-full bg-transparent text-2xl font-medium text-slate-700 outline-none placeholder-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="0"
            value={item.cantidadOk}
            onChange={(e) =>
              onUpdate(index, "cantidadOk", Number(e.target.value))
            }
            onFocus={(e) => e.target.select()}
          />
        </div>

        {/* Cantidad Scrap */}
        <div className="bg-slate-50/50 hover:bg-slate-50 rounded-xl p-3 border border-slate-100/60 focus-within:border-rose-200 focus-within:bg-white focus-within:ring-4 focus-within:ring-rose-50 transition-all duration-200">
          <label className="flex items-center gap-1.5 text-[9px] uppercase font-semibold tracking-wider text-slate-400 mb-1">
            <FaExclamationTriangle size={10} className="text-rose-400" /> Fallas
          </label>
          <input
            type="number"
            min="0"
            className="w-full bg-transparent text-2xl font-medium text-slate-700 outline-none placeholder-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="0"
            value={item.cantidadScrap}
            onChange={(e) =>
              onUpdate(index, "cantidadScrap", Number(e.target.value))
            }
            onFocus={(e) => e.target.select()}
          />
        </div>
      </div>

      {/* Select de Motivo de Scrap */}
      <AnimatePresence>
        {hasScrap && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-3 pl-2"
          >
            <div className="relative pt-1">
              <select
                className="w-full bg-white border border-rose-100 text-rose-600 text-xs font-medium rounded-xl px-3 py-2.5 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 appearance-none cursor-pointer transition-all"
                value={item.motivoScrap}
                onChange={(e) => onUpdate(index, "motivoScrap", e.target.value)}
              >
                <option value="">Seleccionar motivo...</option>
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
              <FaChevronDown className="absolute right-3 top-[60%] -translate-y-1/2 text-rose-300 pointer-events-none text-[10px]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function RegistrarProduccionPage() {
  const [openPlans, setOpenPlans] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [planProducts, setPlanProducts] = useState([]);

  const [contexto, setContexto] = useState({
    operarioId: "",
    planId: "",
    fecha: new Date().toISOString().split("T")[0],
    turno: "Diurno",
  });

  const [items, setItems] = useState([]);
  const [resetKey, setResetKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingPlanItems, setLoadingPlanItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
        toast.error("Error al cargar datos iniciales");
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

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
        toast.error("Error al cargar productos del plan");
      } finally {
        setLoadingPlanItems(false);
      }
    };
    fetchPlanItems();
  }, [contexto.planId]);

  const handleContextChange = (field, value) => {
    setContexto((prev) => ({ ...prev, [field]: value }));
    if (field === "planId") {
      setItems([]);
      setResetKey((prev) => prev + 1);
    }
  };

  const handleSelectProduct = (selectedItem) => {
    if (!selectedItem) return;

    if (items.some((i) => i.semiId === selectedItem.id)) {
      toast.error("Este producto ya está en la lista.");
      setResetKey((prev) => prev + 1);
      return;
    }

    setItems((prev) => [
      {
        semiId: selectedItem.id,
        nombre: selectedItem.nombre,
        codigo: selectedItem.codigo,
        cantidadOk: "",
        cantidadScrap: "",
        motivoScrap: "",
      },
      ...prev,
    ]);

    setResetKey((prev) => prev + 1);
    toast.success("Producto listo para carga", {
      icon: "✨",
      style: { borderRadius: "12px", fontSize: "13px" },
    });
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
      return toast.error("Por favor, completa los datos del turno.");
    }

    const validItems = items.filter(
      (i) => Number(i.cantidadOk) > 0 || Number(i.cantidadScrap) > 0,
    );
    if (validItems.length === 0)
      return toast.error("Ingresá cantidades en al menos un producto.");

    const scrapInvalido = validItems.some(
      (i) => Number(i.cantidadScrap) > 0 && !i.motivoScrap,
    );
    if (scrapInvalido)
      return toast.error("Falta indicar el motivo de las fallas.");

    setIsSaving(true);

    const savePromise = new Promise(async (resolve, reject) => {
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
        setItems([]);
        resolve();
      } catch (e) {
        reject();
      } finally {
        setIsSaving(false);
      }
    });

    toast.promise(
      savePromise,
      {
        loading: "Procesando registros...",
        success: "Producción guardada correctamente",
        error: "Ocurrió un error al guardar.",
      },
      { style: { borderRadius: "12px", fontSize: "13px" } },
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#fafafa] text-slate-400">
        <FaSpinner className="animate-spin text-2xl mb-4 opacity-50" />
      </div>
    );
  }

  return (
    // Le quitamos el pb-32 fijo que tenía antes
    <div className="min-h-full bg-[#fafafa] flex flex-col font-sans">
      {/* HEADER TRANSLÚCIDO Y AIREADO */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-5 md:px-10 md:py-6 shrink-0 z-20 sticky top-0">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm shrink-0">
            <FaClipboardCheck size={18} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight leading-none">
              Registrar Producción
            </h1>
            <p className="text-[11px] font-medium text-slate-400 mt-1.5 tracking-wide hidden sm:block">
              Ingreso diario de partes y piezas
            </p>
          </div>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 flex flex-col gap-6 md:gap-8 mt-2">
        {/* SECCIÓN 1: CONFIGURACIÓN DEL TURNO */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="border-b border-slate-50 px-6 py-4 flex items-center gap-2.5">
            <FaUserCog className="text-slate-300" size={14} />
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Datos del Turno
            </h2>
          </div>

          <div className="p-5 md:p-7 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[10px] font-medium text-slate-400 mb-2 ml-1">
                Operario
              </label>
              <div className="relative">
                <select
                  className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all appearance-none"
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
                <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-[10px]" />
              </div>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-[10px] font-medium text-slate-400 mb-2 ml-1">
                Plan Activo
              </label>
              <div className="relative">
                <select
                  className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all appearance-none"
                  value={contexto.planId}
                  onChange={(e) =>
                    handleContextChange("planId", e.target.value)
                  }
                >
                  <option value="">Seleccionar plan...</option>
                  {openPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-[10px]" />
              </div>
            </div>

            <div className="col-span-1">
              <label className="block text-[10px] font-medium text-slate-400 mb-2 ml-1">
                Fecha
              </label>
              <div className="relative">
                <input
                  type="date"
                  className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-xl px-3 md:px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all [&::-webkit-calendar-picker-indicator]:opacity-40"
                  value={contexto.fecha}
                  onChange={(e) => handleContextChange("fecha", e.target.value)}
                />
              </div>
            </div>

            <div className="col-span-1">
              <label className="block text-[10px] font-medium text-slate-400 mb-2 ml-1">
                Turno
              </label>
              <div className="relative">
                <select
                  className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-xl px-3 md:px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all appearance-none"
                  value={contexto.turno}
                  onChange={(e) => handleContextChange("turno", e.target.value)}
                >
                  <option value="Diurno">Diurno</option>
                  <option value="Nocturno">Nocturno</option>
                </select>
                <FaExchangeAlt className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-[10px] rotate-90" />
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: BUSCADOR Y LISTA */}
        <AnimatePresence>
          {contexto.planId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-5 mt-2"
            >
              {/* BUSCADOR (Minimalista y flotante) */}
              <div className="relative z-[60]">
                <div className="w-full relative z-50">
                  <AutoCompleteInput
                    key={resetKey}
                    items={planProducts}
                    onSelect={handleSelectProduct}
                    placeholder="Buscar producto para agregar..."
                    disabled={loadingPlanItems}
                  />
                </div>
              </div>

              {/* Grilla de Tarjetas */}
              <div>
                {items.length === 0 ? (
                  <div className="border border-dashed border-slate-200/60 bg-white/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center mt-2">
                    <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                      <FaBoxOpen size={18} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-1">
                      Carga vacía
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                      Utilizá el buscador de arriba para seleccionar los
                      productos a registrar.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* 👇 NUEVO: ESPACIADOR INVISIBLE PARA SCROLL */}
        {/* Esto empuja el fondo hacia abajo para que la última tarjeta nunca quede tapada */}
        {items.length > 0 && <div className="h-28 shrink-0" />}
      </main>

      {/* 👇 NUEVO: FAB DOCK CON DEGRADADO */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            // El bg-gradient genera el esfumado perfecto con el fondo de la app
            className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-6 md:pb-8 pt-20 bg-gradient-to-t from-[#fafafa] via-[#fafafa]/95 to-transparent pointer-events-none"
          >
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              // Diseño ultra estético: rounded-2xl en mobile, rounded-full en PC, borde fino e iluminado
              className="pointer-events-auto w-full md:w-auto max-w-sm bg-slate-800 hover:bg-slate-900 text-white font-medium text-[13px] md:text-sm py-4 px-8 rounded-2xl md:rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.3)] border border-slate-700/50 flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0 backdrop-blur-md"
            >
              {isSaving ? (
                <FaSpinner className="animate-spin text-slate-400" size={16} />
              ) : (
                <FaSave className="text-emerald-400" size={16} />
              )}
              {isSaving
                ? "Procesando..."
                : `Guardar Registros (${items.length})`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
