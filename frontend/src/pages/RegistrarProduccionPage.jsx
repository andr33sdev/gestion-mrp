import { useEffect, useState } from "react";
import {
  FaPlusCircle,
  FaSpinner,
  FaClipboardList,
  FaBox,
  FaChevronDown,
  FaUser,
  FaCheckCircle,
  FaCalendarAlt,
  FaExchangeAlt,
  FaTimesCircle,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { API_BASE_URL, authFetch } from "../utils.js";

// --- IMPORTAMOS EL COMPONENTE ROBUSTO ---
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";

export default function RegistrarProduccionPage() {
  const [allSemis, setAllSemis] = useState([]);
  const [openPlans, setOpenPlans] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const motivosFalla = [
    "Pieza quemada",
    "Pieza cruda",
    "Material erróneo",
    "Materia prima defectuosa",
    "Matriz fría",
    "Sin respiradero",
    "Sin silicona",
    "Otros",
  ];

  const [selectedOperarioId, setSelectedOperarioId] = useState("");
  const [selectedSemi, setSelectedSemi] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [cantidadOk, setCantidadOk] = useState(0);
  const [cantidadScrap, setCantidadScrap] = useState(0);
  const [motivoScrap, setMotivoScrap] = useState(motivosFalla[0]);
  const [fechaProduccion, setFechaProduccion] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [turno, setTurno] = useState("Diurno");
  const [autoCompleteKey, setAutoCompleteKey] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", msg: "" });

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true);
        const [resSemis, resPlanes, resOperarios] = await Promise.all([
          authFetch(`${API_BASE_URL}/ingenieria/semielaborados`),
          authFetch(`${API_BASE_URL}/planificacion/abiertos`),
          authFetch(`${API_BASE_URL}/operarios`),
        ]);

        if (resSemis.ok) setAllSemis(await resSemis.json());
        if (resPlanes.ok) setOpenPlans(await resPlanes.json());
        if (resOperarios.ok) setOperarios(await resOperarios.json());
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
    setCantidadOk(0);
    setCantidadScrap(0);
    setMotivoScrap(motivosFalla[0]);
    setTurno("Diurno");
    setFechaProduccion(new Date().toISOString().split("T")[0]);
    setAutoCompleteKey(Date.now());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: "", msg: "" });
    const totalProducido = Number(cantidadOk) + Number(cantidadScrap);

    if (
      !selectedOperarioId ||
      !selectedSemi ||
      !selectedPlanId ||
      totalProducido <= 0 ||
      !fechaProduccion
    ) {
      setFeedback({
        type: "error",
        msg: "Complete todos los campos obligatorios y asegure que la cantidad total sea > 0.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/produccion/registrar-a-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            semielaborado_id: selectedSemi.id,
            plan_id: selectedPlanId,
            cantidad_ok: Number(cantidadOk),
            cantidad_scrap: Number(cantidadScrap),
            operario_id: selectedOperarioId,
            motivo_scrap: cantidadScrap > 0 ? motivoScrap : "",
            turno: turno,
            fecha_produccion: fechaProduccion,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Error en el servidor");

      setFeedback({
        type: "success",
        msg: `${data.msg} (Progreso OK: ${data.nuevo_total})`,
      });
      resetForm();
    } catch (err) {
      setFeedback({ type: "error", msg: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-64 text-white text-2xl">
        <FaSpinner className="animate-spin mr-3" /> Cargando datos...
      </div>
    );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex items-center gap-4 mb-6">
        <FaPlusCircle className="text-4xl text-blue-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">
            Registrar Producción
          </h1>
          <p className="text-gray-400">
            Asigna las unidades producidas (OK y Fallas) a un plan y turno.
          </p>
        </div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 md:p-8 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
              <FaUser /> Operario
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
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
              <FaClipboardList /> Asignar al Plan
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
              <FaCalendarAlt /> Fecha de Producción
            </label>
            <input
              type="date"
              value={fechaProduccion}
              onChange={(e) => setFechaProduccion(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:border-blue-500"
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
              <FaExchangeAlt /> Turno
            </label>
            <div className="relative">
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                disabled={isSaving}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg appearance-none focus:outline-none focus:ring-2 focus:border-blue-500"
              >
                <option value="Diurno">Diurno</option>
                <option value="Nocturno">Nocturno</option>
              </select>
              <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
            <FaBox /> Semielaborado Producido
          </label>

          {/* USAMOS EL COMPONENTE IMPORTADO Y ROBUSTO */}
          <AutoCompleteInput
            key={autoCompleteKey}
            items={allSemis}
            onSelect={setSelectedSemi}
            placeholder="Busca el producto por nombre o código..."
            disabled={isSaving}
            initialValue={selectedSemi ? selectedSemi.nombre : ""} // Usamos prop initialValue si tu componente la soporta, o ajusta según tu implementación de AutoCompleteInput
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <label
              htmlFor="ok"
              className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2 text-green-400"
            >
              <FaCheckCircle /> Cantidad OK
            </label>
            <input
              id="ok"
              type="number"
              value={cantidadOk}
              onChange={(e) => setCantidadOk(e.target.value)}
              min="0"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:border-green-500"
              disabled={isSaving}
            />
          </div>
          <div className="md:col-span-2">
            <label
              htmlFor="scrap"
              className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2 text-red-400"
            >
              <FaTimesCircle /> Fallas / Scrap
            </label>
            <div className="grid grid-cols-3 gap-3">
              <input
                id="scrap"
                type="number"
                value={cantidadScrap}
                onChange={(e) => setCantidadScrap(e.target.value)}
                min="0"
                className="col-span-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:border-red-500"
                disabled={isSaving}
              />
              <div className="col-span-2 relative">
                <select
                  value={motivoScrap}
                  onChange={(e) => setMotivoScrap(e.target.value)}
                  disabled={isSaving || cantidadScrap === 0}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-lg appearance-none focus:outline-none focus:ring-2 focus:border-red-500 disabled:opacity-50"
                >
                  {motivosFalla.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
            {Number(cantidadScrap) > 0 && !motivoScrap && (
              <p className="text-red-400 text-xs mt-1">
                Seleccione un motivo para las fallas.
              </p>
            )}
          </div>
        </div>
        <div className="pt-4">
          <button
            type="submit"
            disabled={
              isSaving ||
              !selectedOperarioId ||
              !selectedSemi ||
              !selectedPlanId ||
              Number(cantidadOk) + Number(cantidadScrap) <= 0
            }
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
