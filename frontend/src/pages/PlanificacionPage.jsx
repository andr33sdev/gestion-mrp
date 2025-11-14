import { useEffect, useState, useMemo } from "react";
import {
  FaPlus,
  FaTrash,
  FaSpinner,
  FaClipboardList,
  FaSave,
  FaLock,
  FaLockOpen,
  FaExclamationTriangle,
  FaCheckCircle,
  FaShoppingCart,
} from "react-icons/fa";
import { API_BASE_URL } from "../utils.js";

// --- COMPONENTE AUTOCOMPLETAR (Reutilizado) ---
function AutoCompleteInput({ items, onSelect, placeholder, disabled }) {
  const [value, setValue] = useState("");
  const [sugerencias, setSugerencias] = useState([]);

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
    setValue("");
    setSugerencias([]);
    onSelect(semi);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || "Buscar..."}
        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-800"
        disabled={disabled}
      />
      {sugerencias.length > 0 && (
        <div className="absolute z-10 w-full bg-slate-700 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto border border-slate-600">
          {sugerencias.map((s) => (
            <div
              key={s.id}
              onClick={() => handleSelect(s)}
              className="p-3 hover:bg-slate-600 cursor-pointer border-b border-slate-600 last:border-b-0"
            >
              <p className="font-bold text-sm text-white">{s.nombre}</p>
              <p className="text-xs text-gray-400 font-mono">{s.codigo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- PÁGINA PRINCIPAL DE PLANIFICACIÓN ---
export default function PlanificacionPage() {
  // === ESTADOS MAESTROS (Datos de la BD) ===
  const [allSemis, setAllSemis] = useState([]);
  const [allMPs, setAllMPs] = useState([]);
  const [recetasMap, setRecetasMap] = useState({});
  const [masterPlanList, setMasterPlanList] = useState([]); // Lista de planes guardados

  // === ESTADOS DE DETALLE (El plan activo) ===
  const [selectedPlanId, setSelectedPlanId] = useState(null); // 'NEW' o un ID numérico
  const [currentPlanNombre, setCurrentPlanNombre] = useState("Nuevo Plan");
  const [currentPlanItems, setCurrentPlanItems] = useState([]); // {semielaborado, cantidad}
  const [currentPlanEstado, setCurrentPlanEstado] = useState("ABIERTO");

  // === ESTADOS DE UI ===
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- CARGA DE DATOS INICIAL ---
  useEffect(() => {
    // Carga todos los datos maestros al montar
    const cargarDatosMaestros = async () => {
      try {
        const [resSemis, resMPs, resRecetas, resPlanes] = await Promise.all([
          fetch(`${API_BASE_URL}/ingenieria/semielaborados`),
          fetch(`${API_BASE_URL}/ingenieria/materias-primas`),
          fetch(`${API_BASE_URL}/ingenieria/recetas-semielaborados/all`),
          fetch(`${API_BASE_URL}/planificacion`), // Carga los planes guardados
        ]);
        setAllSemis(await resSemis.json());
        setAllMPs(await resMPs.json());
        setRecetasMap(await resRecetas.json());
        setMasterPlanList(await resPlanes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    cargarDatosMaestros();
  }, []);

  // --- LÓGICA DE SELECCIÓN Y CREACIÓN ---

  const handleSelectPlan = async (planId) => {
    if (loading) return;
    setLoading(true);
    setSelectedPlanId(planId);
    try {
      const res = await fetch(`${API_BASE_URL}/planificacion/${planId}`);
      if (!res.ok) throw new Error("No se pudo cargar el plan");
      const planDetalle = await res.json();

      // Seteamos el estado del plan activo
      setCurrentPlanNombre(planDetalle.nombre);
      setCurrentPlanItems(planDetalle.items);
      setCurrentPlanEstado(planDetalle.estado);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedPlanId("NEW"); // Marca especial para "nuevo"
    setCurrentPlanNombre(
      `Nuevo Plan ${new Date().toLocaleDateString("es-AR")}`
    );
    setCurrentPlanItems([]);
    setCurrentPlanEstado("ABIERTO");
  };

  // --- LÓGICA DE CONSTRUCTOR DEL PLAN ---

  const handleAddItem = (semielaborado) => {
    const cantidad = Number(
      prompt(`Cantidad a fabricar de "${semielaborado.nombre}":`, "10")
    );
    if (cantidad && cantidad > 0) {
      setCurrentPlanItems((prev) => [...prev, { semielaborado, cantidad }]);
    }
  };

  const handleRemoveItem = (indexToRemove) => {
    setCurrentPlanItems((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  // --- ACCIONES DE GUARDADO Y ESTADO ---

  const handleSavePlan = async () => {
    if (!currentPlanNombre) return alert("El plan necesita un nombre.");

    setIsSaving(true);
    const planData = {
      nombre: currentPlanNombre,
      items: currentPlanItems,
    };

    try {
      let response;
      if (selectedPlanId === "NEW") {
        // --- CREAR (POST) ---
        response = await fetch(`${API_BASE_URL}/planificacion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(planData),
        });
      } else {
        // --- ACTUALIZAR (PUT) ---
        response = await fetch(
          `${API_BASE_URL}/planificacion/${selectedPlanId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(planData),
          }
        );
      }

      if (!response.ok) throw new Error("Error al guardar en el servidor");
      const result = await response.json();

      // Recargar la lista de planes de la izquierda
      const resPlanes = await fetch(`${API_BASE_URL}/planificacion`);
      setMasterPlanList(await resPlanes.json());

      // Si era nuevo, actualizamos el ID para no crearlo de nuevo
      if (selectedPlanId === "NEW") {
        setSelectedPlanId(result.planId);
      }
      alert("Plan guardado.");
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEstado = async () => {
    if (selectedPlanId === "NEW")
      return alert("Guarda el plan antes de cerrarlo.");

    const nuevoEstado = currentPlanEstado === "ABIERTO" ? "CERRADO" : "ABIERTO";
    if (
      window.confirm(
        `¿Estás seguro que quieres marcar este plan como "${nuevoEstado}"?`
      )
    ) {
      setIsSaving(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/planificacion/${selectedPlanId}/estado`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: nuevoEstado }),
          }
        );
        if (!res.ok) throw new Error("No se pudo actualizar el estado");

        setCurrentPlanEstado(nuevoEstado); // Actualiza UI
        // Actualiza la lista maestra
        setMasterPlanList((prevList) =>
          prevList.map((p) =>
            p.id === selectedPlanId ? { ...p, estado: nuevoEstado } : p
          )
        );
      } catch (err) {
        alert(err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDeletePlan = async () => {
    if (selectedPlanId === "NEW") {
      handleCreateNew(); // Simplemente limpia la vista
    }

    if (
      window.confirm(
        `¿Estás seguro de ELIMINAR el plan "${currentPlanNombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      setIsSaving(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/planificacion/${selectedPlanId}`,
          {
            method: "DELETE",
          }
        );
        if (!res.ok) throw new Error("No se pudo eliminar el plan");

        alert("Plan eliminado.");
        setMasterPlanList((prev) =>
          prev.filter((p) => p.id !== selectedPlanId)
        );
        handleCreateNew(); // Resetea la vista
      } catch (err) {
        alert(err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // --- CÁLCULO DE EXPLOSIÓN (MRP) ---
  const explosion = useMemo(() => {
    const totalNecesario = {};
    currentPlanItems.forEach((item) => {
      const receta = recetasMap[item.semielaborado.id];
      if (receta) {
        receta.forEach((ingrediente) => {
          const mpId = ingrediente.materia_prima_id;
          const qtyNeeded = ingrediente.cantidad * item.cantidad;
          totalNecesario[mpId] = (totalNecesario[mpId] || 0) + qtyNeeded;
        });
      }
    });

    const mpMap = new Map(allMPs.map((mp) => [mp.id, mp]));

    return Object.keys(totalNecesario)
      .map((mpId) => {
        const mpInfo = mpMap.get(Number(mpId));
        if (!mpInfo) return null; // Fallback por si la MP fue borrada

        const necesario = totalNecesario[mpId];
        const stock = mpInfo.stock_actual;
        const balance = stock - necesario;

        return {
          id: mpId,
          nombre: mpInfo.nombre,
          codigo: mpInfo.codigo,
          necesario: necesario.toFixed(2),
          stock: Number(stock).toFixed(2),
          balance: balance.toFixed(2),
        };
      })
      .filter(Boolean) // Filtra nulos
      .sort((a, b) => a.balance - b.balance);
  }, [currentPlanItems, recetasMap, allMPs]);

  if (loading && !selectedPlanId) {
    return (
      <div className="flex justify-center items-center h-64 text-white text-2xl">
        <FaSpinner className="animate-spin mr-3" /> Cargando datos maestros...
      </div>
    );
  }

  const isPlanCerrado = currentPlanEstado === "CERRADO";
  const isPlanNuevo = selectedPlanId === "NEW";

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
      {/* --- COLUMNA 1: MAESTRO (LISTA DE PLANES) --- */}
      <div className="col-span-4 bg-slate-800 rounded-xl flex flex-col border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-800 border-b border-slate-700 z-10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaClipboardList className="text-blue-400" /> Planes Guardados
          </h2>
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
          >
            <FaPlus /> Crear
          </button>
        </div>
        <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {masterPlanList.length === 0 ? (
            <p className="p-4 text-center text-gray-500 text-sm">
              No hay planes guardados.
            </p>
          ) : (
            masterPlanList.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex justify-between items-center ${
                  selectedPlanId === plan.id
                    ? "bg-slate-600 shadow-inner"
                    : "text-gray-300 hover:bg-slate-700/50"
                }`}
              >
                <div>
                  <p className="font-bold">{plan.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(plan.fecha_creacion).toLocaleDateString("es-AR")}
                  </p>
                </div>
                {plan.estado === "ABIERTO" ? (
                  <FaLockOpen className="text-green-400" title="Abierto" />
                ) : (
                  <FaLock className="text-gray-500" title="Cerrado" />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* --- COLUMNA 2: DETALLE (PLAN ACTIVO) --- */}
      <div className="col-span-8 flex flex-col gap-6">
        {!selectedPlanId ? (
          <div className="flex-1 bg-slate-800 rounded-xl border-2 border-dashed border-slate-700 flex justify-center items-center">
            <p className="text-gray-500 text-lg">
              ← Selecciona un plan o crea uno nuevo
            </p>
          </div>
        ) : (
          <>
            {/* --- SECCIÓN CONSTRUCTOR --- */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg">
              {/* Toolbar del Plan */}
              <div className="p-4 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <input
                  type="text"
                  value={currentPlanNombre}
                  onChange={(e) => setCurrentPlanNombre(e.target.value)}
                  className="w-full md:w-1/2 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-xl font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isPlanCerrado || isSaving}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleToggleEstado}
                    disabled={isSaving || isPlanNuevo}
                    className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${
                      isPlanCerrado
                        ? "bg-gray-600 hover:bg-gray-500 text-white"
                        : "bg-green-600 hover:bg-green-500 text-white"
                    } disabled:opacity-50`}
                  >
                    {isPlanCerrado ? <FaLock /> : <FaLockOpen />}{" "}
                    {isPlanCerrado ? "Cerrado" : "Abierto"}
                  </button>
                  <button
                    onClick={handleDeletePlan}
                    disabled={isSaving || isPlanNuevo}
                    className="px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-red-800 hover:bg-red-700 text-white disabled:opacity-50"
                  >
                    <FaTrash />
                  </button>
                  <button
                    onClick={handleSavePlan}
                    disabled={isPlanCerrado || isSaving}
                    className="px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                  >
                    {isSaving ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaSave />
                    )}{" "}
                    Guardar
                  </button>
                </div>
              </div>

              {/* Constructor de Items */}
              <div className="p-4">
                <div className="flex gap-4">
                  <AutoCompleteInput
                    items={allSemis}
                    onSelect={handleAddItem}
                    placeholder="Buscar semielaborado para añadir..."
                    disabled={isPlanCerrado || isSaving}
                  />
                </div>

                {/* Lista de Items del Plan */}
                <div className="overflow-y-auto max-h-[200px] custom-scrollbar pr-2 mt-4">
                  {currentPlanItems.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      Agrega semielaborados al plan.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {currentPlanItems.map((item, index) => (
                        <li
                          key={index}
                          className="bg-slate-700 p-2 rounded-lg flex justify-between items-center group border border-slate-600"
                        >
                          <div>
                            <span className="font-medium text-white">
                              {item.semielaborado.nombre}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-md font-bold text-blue-300">
                              {item.cantidad}
                            </span>
                            {!isPlanCerrado && (
                              <button
                                onClick={() => handleRemoveItem(index)}
                                className="text-gray-500 hover:text-red-400 p-1 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <FaTrash />
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* --- SECCIÓN EXPLOSIÓN DE MATERIALES (MRP) --- */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-6 flex-1">
              <h2 className="text-xl font-bold mb-4">
                Explosión de Materiales (MP)
              </h2>
              <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-400 uppercase bg-slate-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Materia Prima</th>
                      <th className="px-4 py-3 text-right">Necesario</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {explosion.length === 0 ? (
                      <tr>
                        <td
                          colSpan="4"
                          className="p-8 text-center text-gray-500"
                        >
                          El plan está vacío.
                        </td>
                      </tr>
                    ) : (
                      explosion.map((mp) => (
                        <tr key={mp.id} className="hover:bg-slate-700/50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-white">
                              {mp.nombre}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              {mp.codigo}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-yellow-300">
                            {mp.necesario}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-blue-300">
                            {mp.stock}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-bold ${
                              mp.balance < 0 ? "text-red-400" : "text-green-400"
                            }`}
                          >
                            {mp.balance}
                            {mp.balance < 0 && (
                              <FaShoppingCart
                                title="Necesita compra"
                                className="inline ml-2 text-red-500"
                              />
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
