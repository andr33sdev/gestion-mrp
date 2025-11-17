import { useEffect, useState } from "react";
import {
  FaPlusCircle,
  FaSpinner,
  FaSearch,
  FaClipboardList,
  FaBox,
  FaChevronDown,
  FaUser,
} from "react-icons/fa"; // <-- FaUser AÑADIDO
import { motion } from "framer-motion";
import { API_BASE_URL } from "../utils.js";

// Componente reutilizado de PlanificacionPage (para buscar semielaborados)
function AutoCompleteInput({
  items,
  onSelect,
  placeholder,
  disabled,
  initialValue = "",
}) {
  const [value, setValue] = useState(initialValue);
  const [sugerencias, setSugerencias] = useState([]);

  // Sincronizar si el valor inicial se limpia desde fuera
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e) => {
    const val = e.target.value;
    setValue(val);
    if (val.length > 0) {
      setSugerencias(
        items
          .filter(
            (s) =>
              s.nombre.toLowerCase().includes(val.toLowerCase()) ||
              s.codigo.toLowerCase().includes(val.toLowerCase())
          )
          .slice(0, 5)
      );
    } else {
      setSugerencias([]);
    }
  };

  const handleSelect = (semi) => {
    setValue(semi.nombre); // Dejamos el nombre puesto
    setSugerencias([]);
    onSelect(semi); // Pasamos el objeto completo
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={() => setTimeout(() => setSugerencias([]), 150)}
          placeholder={placeholder || "Buscar..."}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-transparent focus:border-blue-500 transition-all disabled:bg-slate-800"
          disabled={disabled}
        />
        <FaSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>
      {sugerencias.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 w-full bg-slate-700 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto border border-slate-600"
        >
          {sugerencias.map((s) => (
            <div
              key={s.id}
              onMouseDown={() => handleSelect(s)} // Usar onMouseDown para que se dispare antes que el onBlur
              className="p-3 hover:bg-slate-600 cursor-pointer border-b border-slate-600 last:border-b-0"
            >
              <p className="font-bold text-sm text-white">{s.nombre}</p>
              <p className="text-xs text-gray-400 font-mono">{s.codigo}</p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function RegistrarProduccionPage() {
  // Datos maestros
  const [allSemis, setAllSemis] = useState([]);
  const [openPlans, setOpenPlans] = useState([]);
  const [operarios, setOperarios] = useState([]); // <-- NUEVO

  // Estado del formulario
  const [selectedOperarioId, setSelectedOperarioId] = useState(""); // <-- NUEVO
  const [selectedSemi, setSelectedSemi] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [autoCompleteKey, setAutoCompleteKey] = useState(Date.now()); // Para forzar reseteo

  // Estado de UI
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", msg: "" });

  // Carga inicial de datos (semielaborados, planes abiertos y OPERARIOS)
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true);
        const [resSemis, resPlanes, resOperarios] = await Promise.all([
          fetch(`${API_BASE_URL}/ingenieria/semielaborados`),
          fetch(`${API_BASE_URL}/planificacion/abiertos`),
          fetch(`${API_BASE_URL}/operarios`), // <-- NUEVO
        ]);
        setAllSemis(await resSemis.json());
        setOpenPlans(await resPlanes.json());
        setOperarios(await resOperarios.json()); // <-- NUEVO
      } catch (err) {
        setFeedback({ type: "error", msg: "Error al cargar datos. Recargue." });
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  const resetForm = () => {
    setSelectedSemi(null);
    setSelectedPlanId("");
    setCantidad(1);
    setAutoCompleteKey(Date.now()); // Resetea el AutoComplete
    // NO reseteamos el operario, asumiendo que el mismo operario carga varias cosas
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: "", msg: "" });

    // --- VALIDACIÓN MODIFICADA ---
    if (!selectedOperarioId || !selectedSemi || !selectedPlanId || !cantidad) {
      setFeedback({ type: "error", msg: "Complete todos los campos." });
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch(`${API_BASE_URL}/produccion/registrar-a-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semielaborado_id: selectedSemi.id,
          plan_id: selectedPlanId,
          cantidad: Number(cantidad),
          operario_id: selectedOperarioId, // <-- NUEVO
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.msg || "Error en el servidor");
      }

      setFeedback({
        type: "success",
        msg: `${data.msg} (Progreso: ${data.nuevo_total})`,
      });
      resetForm(); // Limpia el formulario para la próxima carga
    } catch (err) {
      setFeedback({ type: "error", msg: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-white text-2xl">
        <FaSpinner className="animate-spin mr-3" /> Cargando datos...
      </div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <div className="flex items-center gap-4 mb-6">
        <FaPlusCircle className="text-4xl text-blue-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">
            Registrar Producción
          </h1>
          <p className="text-gray-400">
            Carga la producción y asígnala a un plan de trabajo abierto.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 md:p-8 space-y-6"
      >
        {/* --- PASO 1: QUIÉN ERES --- */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
            <FaUser /> 1. Operario
          </label>
          <div className="relative">
            <select
              value={selectedOperarioId}
              onChange={(e) => setSelectedOperarioId(e.target.value)}
              disabled={isSaving || operarios.length === 0}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg appearance-none focus:outline-none focus:ring-2 focus:border-blue-500"
            >
              <option value="" disabled>
                {operarios.length === 0
                  ? "No hay operarios cargados"
                  : "Selecciona tu nombre..."}
              </option>
              {operarios.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.nombre}
                </option>
              ))}
            </select>
            <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* --- PASO 2: QUÉ PRODUJISTE --- */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
            <FaBox /> 2. Semielaborado Producido
          </label>
          <AutoCompleteInput
            key={autoCompleteKey} // Para forzar reseteo
            items={allSemis}
            onSelect={setSelectedSemi}
            placeholder="Busca el producto por nombre o código..."
            disabled={isSaving}
            initialValue={selectedSemi ? selectedSemi.nombre : ""}
          />
        </div>

        {/* --- PASO 3: QUÉ PLAN AFECTA --- */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
            <FaClipboardList /> 3. Asignar al Plan
          </label>
          <div className="relative">
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              disabled={isSaving || openPlans.length === 0}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg appearance-none focus:outline-none focus:ring-2 focus:border-blue-500"
            >
              <option value="" disabled>
                {openPlans.length === 0
                  ? "No hay planes abiertos"
                  : "Selecciona un plan..."}
              </option>
              {openPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.nombre}
                </option>
              ))}
            </select>
            <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* --- PASO 4: CUÁNTO --- */}
        <div>
          <label
            htmlFor="cantidad"
            className="block text-sm font-bold text-gray-300 mb-2"
          >
            4. Cantidad
          </label>
          <input
            id="cantidad"
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            min="1"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:border-blue-500"
            disabled={isSaving}
          />
        </div>

        {/* --- BOTÓN Y FEEDBACK --- */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={
              isSaving ||
              !selectedOperarioId ||
              !selectedSemi ||
              !selectedPlanId ||
              cantidad <= 0
            } // <-- VALIDACIÓN MODIFICADA
            className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg text-lg flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <FaSpinner className="animate-spin" />
            ) : (
              <FaPlusCircle />
            )}
            {isSaving ? "Registrando..." : "Registrar Producción"}
          </button>
        </div>

        {feedback.msg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-center p-3 rounded-lg border ${
              feedback.type === "success"
                ? "bg-green-900/50 border-green-700 text-green-300"
                : "bg-red-900/50 border-red-700 text-red-300"
            }`}
          >
            {feedback.msg}
          </motion.div>
        )}
      </form>
    </motion.div>
  );
}
