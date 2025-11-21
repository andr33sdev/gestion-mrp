import { useEffect, useState } from "react";
import {
  FaPlus,
  FaTrash,
  FaArrowLeft,
  FaFire,
  FaBoxOpen,
  FaTools,
} from "react-icons/fa";
import { PRODUCCION_API_URL, PEDIDOS_API_URL, authFetch } from "../utils.js";

// Sub-componente de Estación (Estilizado)
function EstacionControlPanel({
  title,
  estacionId,
  productos,
  inputValue,
  onInputChange,
  onAdd,
  onClear,
  color,
  sugerencias,
}) {
  const styles = {
    red: {
      borderTop: "border-t-red-500",
      iconColor: "text-red-500",
      badge: "bg-red-500/20 text-red-200 border-red-500/30",
      btn: "bg-red-600 hover:bg-red-500 ring-red-500",
    },
    blue: {
      borderTop: "border-t-blue-500",
      iconColor: "text-blue-500",
      badge: "bg-blue-500/20 text-blue-200 border-blue-500/30",
      btn: "bg-blue-600 hover:bg-blue-500 ring-blue-500",
    },
  }[color];
  const listId = `list-sugerencias-${estacionId}`;

  return (
    <div
      className={`bg-slate-800 rounded-xl shadow-2xl border border-slate-700 border-t-4 ${styles.borderTop} flex flex-col overflow-hidden`}
    >
      <div className="p-6 border-b border-slate-700 bg-slate-800/50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FaFire className={styles.iconColor} /> {title}
          </h2>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${styles.badge}`}
          >
            {productos.length} ítems
          </span>
        </div>
        <div className="flex gap-2 relative">
          <input
            type="text"
            list={listId}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all placeholder-gray-500"
            placeholder="Escribe o selecciona..."
            style={{
              "--tw-ring-color": color === "red" ? "#ef4444" : "#3b82f6",
            }}
          />
          <datalist id={listId}>
            {sugerencias.map((s, i) => (
              <option key={i} value={s} />
            ))}
          </datalist>
          <button
            onClick={() => onAdd(estacionId, inputValue)}
            disabled={!inputValue}
            className={`px-6 rounded-lg font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${styles.btn}`}
          >
            <FaPlus />
          </button>
        </div>
      </div>
      <div className="p-4 bg-slate-900/30 min-h-[300px]">
        <div className="bg-slate-900 rounded-xl border border-slate-700 h-full overflow-hidden flex flex-col">
          <div className="overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {productos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60 py-10">
                <FaBoxOpen className="text-5xl mb-3" />
                <span className="text-sm">Horno vacío</span>
              </div>
            ) : (
              productos.map((prod, index) => (
                <div
                  key={index}
                  className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-left-2"
                >
                  <div
                    className={`w-2 h-8 rounded-full ${color === "red" ? "bg-red-500" : "bg-blue-500"
                      }`}
                  ></div>
                  <span className="text-gray-200 font-medium text-sm">
                    {prod}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-slate-700 bg-slate-800">
        <button
          onClick={() => onClear(estacionId)}
          disabled={productos.length === 0}
          className="w-full py-3 text-sm font-bold text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
        >
          <FaTrash /> Vaciar Estación
        </button>
      </div>
    </div>
  );
}

// --- Componente Principal del Panel ---
export default function PanelControl({ onNavigate }) {
  const [produccion, setProduccion] = useState({ 1: [], 2: [] });
  const [input1, setInput1] = useState("");
  const [input2, setInput2] = useState("");
  const [sugerencias, setSugerencias] = useState([]);

  const fetchProduccion = async () => {
    const res = await authFetch(PRODUCCION_API_URL);
    setProduccion(await res.json());
  };

  useEffect(() => {
    fetchProduccion();
    authFetch(`${PEDIDOS_API_URL}?t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        const modelos = new Set();
        data.forEach((r) => {
          if (r.MODELO || r.Modelo) modelos.add((r.MODELO || r.Modelo).trim());
        });
        setSugerencias(Array.from(modelos).sort());
      })
      .catch(console.warn);
  }, []);

  const handleAdd = async (estacion_id, producto) => {
    if (!producto) return;
    await authFetch(PRODUCCION_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estacion_id, producto }),
    });
    if (estacion_id === 1) setInput1("");
    else setInput2("");
    fetchProduccion();
  };

  const handleClear = async (id) => {
    if (window.confirm("¿Estás seguro de vaciar la lista de esta estación?")) {
      await authFetch(`${PRODUCCION_API_URL}/${id}`, { method: "DELETE" });
      fetchProduccion();
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/")}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg shadow transition-all active:scale-95 border border-slate-600"
          >
            <FaArrowLeft />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FaTools className="text-gray-500" /> Panel de Control
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Gestión operativa de carga de hornos
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <EstacionControlPanel
          estacionId={1}
          title="Estación 1 (Izquierda)"
          color="red"
          productos={produccion[1] || []}
          inputValue={input1}
          onInputChange={setInput1}
          onAdd={handleAdd}
          onClear={handleClear}
          sugerencias={sugerencias}
        />
        <EstacionControlPanel
          estacionId={2}
          title="Estación 2 (Derecha)"
          color="blue"
          productos={produccion[2] || []}
          inputValue={input2}
          onInputChange={setInput2}
          onAdd={handleAdd}
          onClear={handleClear}
          sugerencias={sugerencias}
        />
      </div>
    </div>
  );
}
