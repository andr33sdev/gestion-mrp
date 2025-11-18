import React, { useState, useMemo } from "react";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaHourglassHalf,
  FaBug,
  FaSearch,
  FaTimes,
  FaTrashAlt,
  FaListUl,
  FaChartArea,
  FaBoxOpen,
  FaLightbulb,
  FaFireAlt,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"];

// --- BADGE DE DÍAS ---
function DaysLeftBadge({ days, val }) {
  const baseClass =
    "px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 w-fit mx-auto shadow-sm";

  if (val > 365 || days === "∞") {
    return (
      <span
        className={`${baseClass} bg-blue-900/40 text-blue-200 border-blue-700`}
      >
        +1 Año
      </span>
    );
  }
  if (val > 30) {
    return (
      <span
        className={`${baseClass} bg-green-900/40 text-green-200 border-green-700`}
      >
        <FaCheckCircle /> {days} días
      </span>
    );
  }
  if (val > 7) {
    return (
      <span
        className={`${baseClass} bg-yellow-900/40 text-yellow-200 border-yellow-700`}
      >
        <FaHourglassHalf /> {days} días
      </span>
    );
  }
  return (
    <span
      className={`${baseClass} bg-red-900/40 text-red-200 border-red-700 animate-pulse`}
    >
      <FaExclamationTriangle /> {days} días
    </span>
  );
}

// --- MODAL DE SUGERENCIAS (IA) ---
function SuggestionsModal({ items, onClose, onSelect }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[120] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        // SE AUMENTÓ EL ANCHO A max-w-5xl
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl border border-purple-500/50 flex flex-col overflow-hidden max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <FaLightbulb className="text-yellow-400" /> Sugerencias de
              Reposición
            </h2>
            <p className="text-sm text-gray-300 mt-2 max-w-lg">
              {/* Texto actualizado a 30 días */}
              Estos son los semielaborados de <strong>Mayor Venta</strong> que
              tienen una cobertura <strong>menor a 30 días</strong>.
              <span className="block text-xs text-purple-300 mt-1 font-medium">
                Prioridad: Alta rotación con riesgo de stock.
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar p-0">
          {items.length === 0 ? (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
              <FaCheckCircle className="text-5xl mb-4 text-green-500/50" />
              <p className="text-lg font-medium text-gray-300">
                ¡Todo bajo control!
              </p>
              <p className="text-sm">
                No hay insumos de alta rotación con stock crítico (menos de 30
                días).
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-slate-700/50 text-gray-400 uppercase text-xs font-bold tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-3">Semielaborado</th>
                  <th className="px-6 py-3 text-right text-yellow-400">
                    <FaFireAlt className="inline mr-1" /> Venta Mensual
                  </th>
                  <th className="px-6 py-3 text-right">Stock Actual</th>
                  <th className="px-6 py-3 text-center">Cobertura</th>
                  <th className="px-6 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {items.map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-700/30 transition-colors group"
                  >
                    <td className="px-6 py-4 font-medium text-white">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-yellow-100">
                      {item.monthly} u/m
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-blue-300">
                      {item.stock}
                    </td>
                    <td className="px-6 py-4 flex justify-center">
                      <DaysLeftBadge
                        days={item.daysLeft}
                        val={item.daysLeftVal}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => {
                          onSelect(item);
                          onClose();
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded shadow transition-all active:scale-95 whitespace-nowrap"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 text-center">
          <p className="text-xs text-gray-500">
            Basado en el consumo promedio de los últimos 6 meses.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// --- MODAL DE DETALLE (Se mantiene igual) ---
function SemiDetailModal({ item, onClose }) {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[110] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-600 flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <FaBoxOpen className="text-blue-400" /> {item.name}
            </h2>
            <p className="text-sm text-gray-400 font-mono mt-1">
              Análisis detallado de consumo 2025
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar">
          {/* GRÁFICO DE LÍNEA */}
          <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700 shadow-inner">
            <h3 className="text-gray-200 font-bold mb-6 text-sm uppercase flex items-center gap-2 tracking-wider">
              <FaChartArea className="text-blue-500" /> Evolución Mensual
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={item.chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    strokeOpacity={0.1}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="mes"
                    stroke="#94a3b8"
                    interval={0}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    itemStyle={{ color: "#60a5fa" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="consumo"
                    name="Unidades"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "#1e293b",
                      stroke: "#3b82f6",
                      strokeWidth: 2,
                    }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO DE TORTA */}
          <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700 shadow-inner">
            <h3 className="text-gray-200 font-bold mb-6 text-sm uppercase flex items-center gap-2 tracking-wider">
              <FaListUl className="text-purple-500" /> Top 5 Productos
            </h3>
            <div className="h-64 w-full">
              {item.usedInChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={item.usedInChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={4}
                      stroke="none"
                    >
                      {item.usedInChart.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        borderRadius: "8px",
                        border: "1px solid #334155",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      wrapperStyle={{ fontSize: "11px", color: "#cbd5e1" }}
                      iconSize={10}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
                  Sin datos de uso
                </div>
              )}
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="col-span-1 lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-600/50 text-center">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wide mb-1">
                Stock Actual
              </p>
              <p className="text-3xl font-extrabold text-blue-400">
                {item.stock}
              </p>
            </div>
            <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-600/50 text-center">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wide mb-1">
                Consumo Total
              </p>
              <p className="text-3xl font-extrabold text-white">{item.value}</p>
            </div>
            <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-600/50 text-center">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wide mb-1">
                Prom. Mensual (6M)
              </p>
              <p className="text-3xl font-extrabold text-yellow-400">
                {item.monthly}
              </p>
            </div>
            <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-600/50 text-center flex flex-col justify-center items-center">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wide mb-2">
                Cobertura
              </p>
              <DaysLeftBadge days={item.daysLeft} val={item.daysLeftVal} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function ConsumptionView({ analysisData }) {
  if (!analysisData) return null;

  const { consumo, missingRecipes, rawTotalRows, daysAnalyzed } = analysisData;
  const hasConsumption = consumo && consumo.length > 0;

  // --- ESTADOS ---
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const toggleSelection = (itemName) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemName)) newSet.delete(itemName);
    else newSet.add(itemName);
    setSelectedItems(newSet);
  };

  // --- LÓGICA DE SUGERENCIAS (IA) ---
  // Modificado a 30 días
  const suggestedItems = useMemo(() => {
    return consumo
      .filter((item) => item.daysLeftVal < 30 && parseFloat(item.monthly) > 0)
      .sort((a, b) => parseFloat(b.monthly) - parseFloat(a.monthly))
      .slice(0, 10);
  }, [consumo]);

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return consumo
      .filter((item) => item.name.toLowerCase().includes(term))
      .slice(0, 10);
  }, [consumo, searchTerm]);

  const tableRows = useMemo(() => {
    return consumo.filter((item) => selectedItems.has(item.name));
  }, [consumo, selectedItems]);

  return (
    <div className="animate-in fade-in duration-500 pb-24 relative">
      {/* MODALES */}
      <AnimatePresence>
        {selectedDetailItem && (
          <SemiDetailModal
            item={selectedDetailItem}
            onClose={() => setSelectedDetailItem(null)}
          />
        )}
        {showSuggestions && (
          <SuggestionsModal
            items={suggestedItems}
            onClose={() => setShowSuggestions(false)}
            onSelect={(item) => {
              toggleSelection(item.name);
              setSelectedDetailItem(item);
            }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Planificación de Stock
          </h1>
          <p className="text-base text-gray-400">
            Cálculo basado en los últimos <strong>{daysAnalyzed} días</strong>.
            <span className="ml-3 text-sm italic text-blue-400 opacity-80">
              * Haz clic en una fila para ver el detalle gráfico.
            </span>
          </p>
        </div>

        {/* BOTÓN SUGERENCIAS */}
        <button
          onClick={() => setShowSuggestions(true)}
          className="group relative px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/30 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-3 border border-white/10"
        >
          <FaLightbulb className="text-yellow-300 text-lg animate-pulse" />
          <span>Sugerencias IA</span>
          {suggestedItems.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full border-2 border-gray-900 shadow-sm">
              {suggestedItems.length}
            </span>
          )}
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="relative mb-8 max-w-2xl">
        <div className="relative group">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors text-lg" />
          <input
            type="text"
            placeholder="Buscar semielaborado para analizar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl py-3.5 pl-12 pr-10 text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg transition-all placeholder-gray-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <FaTimes size={16} />
            </button>
          )}
        </div>

        {/* SUGERENCIAS */}
        {searchTerm && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar">
            {suggestions.length === 0 ? (
              <div className="p-4 text-gray-500 text-center text-sm italic">
                No se encontraron insumos.
              </div>
            ) : (
              suggestions.map((item) => {
                const isSelected = selectedItems.has(item.name);
                return (
                  <div
                    key={item.name}
                    onClick={() => toggleSelection(item.name)}
                    className={`px-4 py-3 flex items-center gap-4 cursor-pointer border-b border-slate-700/50 last:border-0 hover:bg-slate-700 transition-colors ${
                      isSelected ? "bg-blue-900/20" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-5 h-5 rounded border-gray-500 text-blue-600 focus:ring-blue-500 bg-gray-700 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-base ${
                          isSelected
                            ? "text-blue-300 font-bold"
                            : "text-white font-medium"
                        }`}
                      >
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Stock actual:{" "}
                        <span className="text-gray-300">{item.stock}</span>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden min-h-[300px] flex flex-col">
        {tableRows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-12 opacity-60">
            <FaListUl className="text-5xl mb-4" />
            <p className="text-lg font-medium">Lista de seguimiento vacía</p>
            <p className="text-sm mt-1">
              Usa el buscador o el botón de{" "}
              <span className="text-blue-400 font-bold">Sugerencias IA</span>.
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center px-6 py-4 bg-slate-700/30 border-b border-slate-700">
              <h3 className="text-white font-bold flex items-center gap-3 text-base">
                <FaListUl className="text-blue-400" /> Insumos Seleccionados{" "}
                <span className="bg-slate-600 text-white text-xs px-2 py-1 rounded-full">
                  {tableRows.length}
                </span>
              </h3>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="text-xs flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 px-4 py-2 rounded-lg transition-all font-medium"
              >
                <FaTrashAlt /> Limpiar Todo
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-slate-700/50 text-gray-400 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4 w-12 text-center">#</th>
                    <th className="px-6 py-4">Semielaborado</th>
                    <th className="px-6 py-4 text-right">Stock</th>
                    <th className="px-6 py-4 text-right">Consumo '25</th>
                    <th className="px-6 py-4 text-right bg-slate-600/10">
                      Diario (6M)
                    </th>
                    <th className="px-6 py-4 text-right bg-slate-600/10">
                      Mensual (6M)
                    </th>
                    <th className="px-6 py-4 text-center">Cobertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-sm">
                  {tableRows.map((item, index) => (
                    <tr
                      key={index}
                      onClick={() => setSelectedDetailItem(item)}
                      className="hover:bg-slate-700/40 transition-colors group cursor-pointer"
                    >
                      <td
                        className="px-6 py-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => toggleSelection(item.name)}
                          className="w-4 h-4 rounded border-gray-500 text-blue-600 bg-gray-700 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                          title="Quitar de la lista"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-white group-hover:text-blue-300 transition-colors">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-blue-300 font-bold">
                        {item.stock}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-400">
                        {item.value}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-yellow-100/90 bg-slate-600/5 font-bold">
                        {item.daily}{" "}
                        <span className="text-[10px] font-normal text-gray-500 ml-1">
                          u/d
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-yellow-100/90 bg-slate-600/5 font-bold">
                        {item.monthly}{" "}
                        <span className="text-[10px] font-normal text-gray-500 ml-1">
                          u/m
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <DaysLeftBadge
                          days={item.daysLeft}
                          val={item.daysLeftVal}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Panel Diagnóstico */}
      {missingRecipes.length > 0 && (
        <div className="mt-8 bg-slate-900/40 border border-slate-700/50 rounded-xl p-4 flex justify-between items-center max-w-3xl mx-auto">
          <div className="flex items-center gap-3 text-yellow-600/90 text-sm">
            <FaBug className="text-lg" />
            <span className="font-medium">
              Diagnóstico del sistema: Se detectaron{" "}
              <span className="font-bold text-yellow-500">
                {missingRecipes.length}
              </span>{" "}
              productos vendidos sin receta configurada.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
