import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
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
  FaClipboardList,
  FaExclamationCircle,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaQuestionCircle,
  FaEye,
  FaEyeSlash,
  FaCalendarDay,
  FaCalendarWeek,
  FaCalendarAlt,
  FaCalendar,
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
  AreaChart,
  Area,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"];

// --- HELPERS (Copiados de DetailModal para que funcione autónomo) ---
const parseDateStr = (str) => {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
};

const formatDateForInput = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekNumber = (d) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};

const PortalTooltip = ({ coords, children }) => {
  if (!coords) return null;
  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: coords.left,
        top: coords.top,
        transform: "translateX(-50%) translateY(-100%) translateY(-8px)",
      }}
    >
      {children}
    </div>,
    document.body,
  );
};

// --- BADGE ---
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

// --- WIDGET TENDENCIA ---
const TrendIcon = ({ trend }) => {
  const [tooltipCoords, setTooltipCoords] = useState(null);

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipCoords({ left: rect.left + rect.width / 2, top: rect.top });
  };

  return (
    <div className="flex items-center gap-1 justify-center">
      {trend === "up" && <FaArrowUp className="text-green-400 text-xs" />}
      {trend === "down" && <FaArrowDown className="text-red-400 text-xs" />}
      {trend === "neutral" && <FaMinus className="text-gray-600 text-[10px]" />}

      <div
        className="cursor-help ml-1"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltipCoords(null)}
      >
        <FaQuestionCircle className="text-slate-600 text-[10px] hover:text-slate-400 transition-colors" />
      </div>

      <PortalTooltip coords={tooltipCoords}>
        <div className="w-40 p-2 bg-black/95 text-white text-[10px] rounded-lg text-center border border-slate-700 shadow-xl animate-in fade-in zoom-in-95 duration-150">
          <p className="font-bold mb-1 text-gray-300">Momentum (2 meses):</p>
          {trend === "up" && (
            <span className="text-green-400 font-bold block">
              Acelerando (+10%)
            </span>
          )}
          {trend === "down" && (
            <span className="text-red-400 font-bold block">
              Frenando (-10%)
            </span>
          )}
          {trend === "neutral" && (
            <span className="text-gray-400 block">Estable</span>
          )}
          <p className="mt-1 text-[9px] text-gray-500 border-t border-gray-800 pt-1">
            Vs. promedio 6 meses
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-700"></div>
        </div>
      </PortalTooltip>
    </div>
  );
};

function MissingRecipesModal({ items, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[120] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-600 flex flex-col overflow-hidden max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700 bg-slate-900 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FaBug className="text-red-400" /> Productos sin Receta
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
          >
            <FaTimes />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl hover:bg-slate-700/50 border border-transparent hover:border-slate-600 mb-1 flex justify-between items-center"
            >
              <div>
                <p className="font-bold text-white text-sm">{item.name}</p>
                <p className="text-xs text-red-300">{item.reason}</p>
              </div>
              <span className="text-xs font-mono font-bold text-gray-500 bg-slate-900 px-2 py-1 rounded">
                {item.count} ventas
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function SuggestionsModal({ items, onClose, onSelect }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[120] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-600 flex flex-col overflow-hidden max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700 bg-slate-900 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FaLightbulb className="text-yellow-400" /> Sugerencias de
              Reposición
            </h3>
            <p className="text-xs text-gray-400">
              Basado en consumo reciente y stock bajo
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {items.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No hay sugerencias críticas por el momento.
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="group p-3 rounded-xl hover:bg-slate-700/50 cursor-pointer transition-all border border-transparent hover:border-slate-600 mb-1"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-white text-sm group-hover:text-blue-300 transition-colors">
                      {item.name}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded border border-red-800/50">
                        Stock: {item.stock}
                      </span>
                      <span className="text-[10px] bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800/50">
                        Consumo: ~{item.monthly}/mes
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-yellow-400 block">
                      {item.daysLeft} días
                    </span>
                    <span className="text-[9px] text-gray-500 uppercase">
                      Cobertura
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

// --- MODAL DETALLE AVANZADO (SEMIELABORADOS) ---
function SemiDetailModal({ item, onClose }) {
  const [resolution, setResolution] = useState("MENSUAL");
  const [showCurrentMonth, setShowCurrentMonth] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  useEffect(() => {
    const today = new Date();
    const start = new Date(2025, 0, 1);
    setDateRange({
      start: formatDateForInput(start),
      end: formatDateForInput(today),
    });
  }, []);

  if (!item) return null;

  // --- LÓGICA DE DATOS (Igual a DetailModal) ---
  const chartData = useMemo(() => {
    if (!item.history || !dateRange.start || !dateRange.end) return [];

    const startObj = new Date(dateRange.start);
    startObj.setHours(0, 0, 0, 0);
    const endObj = new Date(dateRange.end);
    endObj.setHours(23, 59, 59, 999);

    const buckets = {};
    const sourceData = item.history;

    let current = new Date(startObj);
    while (current <= endObj) {
      let key = "";
      let label = "";
      let sortKey = current.getTime();

      if (resolution === "DIARIA") {
        key = current.toISOString().split("T")[0];
        label = current.toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
        });
        current.setDate(current.getDate() + 1);
      } else if (resolution === "SEMANAL") {
        key = getWeekNumber(current);
        label = `S${key.split("-W")[1]}`;
        current.setDate(current.getDate() + 7);
      } else {
        key = `${current.getFullYear()}-${current.getMonth()}`;
        const mName = current.toLocaleDateString("es-AR", { month: "short" });
        label = mName.charAt(0).toUpperCase() + mName.slice(1);
        current.setMonth(current.getMonth() + 1);
      }
      if (!buckets[key]) buckets[key] = { label, value: 0, sortKey };
    }

    sourceData.forEach((h) => {
      const d = parseDateStr(h.fecha);
      if (d && d >= startObj && d <= endObj) {
        let key = "";
        if (resolution === "DIARIA") key = d.toISOString().split("T")[0];
        else if (resolution === "SEMANAL") key = getWeekNumber(d);
        else key = `${d.getFullYear()}-${d.getMonth()}`;

        if (buckets[key]) buckets[key].value += h.cant;
      }
    });

    let result = Object.values(buckets).sort((a, b) => a.sortKey - b.sortKey);
    result = result.map((it) => ({ mes: it.label, consumo: it.value })); // Usamos 'consumo' key

    if (resolution === "MENSUAL" && !showCurrentMonth) {
      const now = new Date();
      const currentLabel = now.toLocaleDateString("es-AR", { month: "short" });
      const formattedLabel =
        currentLabel.charAt(0).toUpperCase() + currentLabel.slice(1);
      if (result.length > 0 && result[result.length - 1].mes === formattedLabel)
        result.pop();
    }
    return result;
  }, [item, resolution, dateRange, showCurrentMonth]);

  const handleDateChange = (type, val) =>
    setDateRange((prev) => ({ ...prev, [type]: val }));

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[110] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-[90vw] border border-slate-600 flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <FaBoxOpen className="text-blue-400" /> {item.name}
            </h2>
            <p className="text-sm text-gray-400 font-mono mt-1">
              Análisis detallado de consumo
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar">
          {/* KPI CARDS IZQUIERDA */}
          <div className="lg:col-span-1 space-y-4">
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
                Consumo Total (Rango)
              </p>
              <p className="text-3xl font-extrabold text-white">
                {chartData.reduce((a, b) => a + b.consumo, 0)}
              </p>
            </div>
            <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-600/50 text-center flex flex-col justify-center items-center">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wide mb-2">
                Cobertura
              </p>
              <DaysLeftBadge days={item.daysLeft} val={item.daysLeftVal} />
            </div>

            {/* TOP PRODUCTOS (TORTA) */}
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 shadow-inner">
              <h3 className="text-gray-200 font-bold mb-2 text-xs uppercase text-center tracking-wider">
                Top Productos
              </h3>
              <div className="h-40 w-full">
                {item.usedInChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={item.usedInChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
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
                          fontSize: "10px",
                        }}
                        itemStyle={{ color: "#fff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs italic">
                    Sin datos
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* GRAFICO PRINCIPAL DERECHA */}
          <div className="lg:col-span-3 bg-slate-900/50 p-5 rounded-xl border border-slate-700 shadow-inner">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
              <h3 className="text-gray-200 font-bold mb-6 text-sm uppercase flex items-center gap-2 tracking-wider">
                <FaChartArea className="text-blue-500" /> Evolución de Consumo
              </h3>
              <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600/50">
                <button
                  onClick={() => setResolution("DIARIA")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    resolution === "DIARIA"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <FaCalendarDay />
                </button>
                <button
                  onClick={() => setResolution("SEMANAL")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    resolution === "SEMANAL"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <FaCalendarWeek />
                </button>
                <button
                  onClick={() => setResolution("MENSUAL")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    resolution === "MENSUAL"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <FaCalendarAlt />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 mb-4">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <FaCalendar className="text-slate-500" />
                  <span className="text-xs font-bold uppercase">Desde:</span>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => handleDateChange("start", e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase">Hasta:</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => handleDateChange("end", e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              {resolution === "MENSUAL" && (
                <button
                  onClick={() => setShowCurrentMonth(!showCurrentMonth)}
                  className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-bold transition-all border ${
                    showCurrentMonth
                      ? "bg-blue-600/20 text-blue-300 border-blue-500/50"
                      : "bg-slate-800 text-gray-500 border-slate-600"
                  }`}
                >
                  {showCurrentMonth ? <FaEye /> : <FaEyeSlash />}{" "}
                  {showCurrentMonth ? "Mes Actual: ON" : "Mes Actual: OFF"}
                </button>
              )}
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="colorConsumo"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    strokeOpacity={0.1}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="mes"
                    stroke="#94a3b8"
                    interval={resolution === "DIARIA" ? "preserveStartEnd" : 0}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={20}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    allowDecimals={false}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                    }}
                    itemStyle={{ color: "#60a5fa" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="consumo"
                    name="Unidades"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorConsumo)"
                    dot={
                      resolution === "DIARIA"
                        ? false
                        : {
                            r: 3,
                            fill: "#1e293b",
                            stroke: "#3b82f6",
                            strokeWidth: 2,
                          }
                    }
                    activeDot={{ r: 6 }}
                    animationDuration={500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function ConsumptionView({ analysisData }) {
  if (!analysisData) return null;
  const { consumo, missingRecipes, daysAnalyzed } = analysisData;
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMissingModal, setShowMissingModal] = useState(false);

  const toggleSelection = (itemName) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemName)) newSet.delete(itemName);
    else newSet.add(itemName);
    setSelectedItems(newSet);
  };

  const suggestedItems = useMemo(() => {
    return consumo
      .filter((item) => item.daysLeftVal < 30 && parseFloat(item.monthly) > 0)
      .sort((a, b) => parseFloat(b.monthly) - parseFloat(a.monthly))
      .slice(0, 20);
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
        {showMissingModal && (
          <MissingRecipesModal
            items={missingRecipes}
            onClose={() => setShowMissingModal(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Planificación de Stock
          </h1>
          <p className="text-base text-gray-400">
            Cálculo basado en los últimos <strong>{daysAnalyzed} días</strong>.{" "}
            <span className="ml-3 text-sm italic text-blue-400 opacity-80">
              * Haz clic en una fila para ver el detalle gráfico.
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowMissingModal(true)}
            className={`group relative px-5 py-3 font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 border ${
              missingRecipes.length > 0
                ? "bg-slate-800 border-red-500 text-red-400 hover:bg-red-900/20"
                : "bg-slate-800 border-slate-600 text-gray-400 opacity-50 cursor-not-allowed"
            }`}
            disabled={missingRecipes.length === 0}
          >
            <FaClipboardList
              className={missingRecipes.length > 0 ? "text-lg" : ""}
            />
            <span>Sin Receta</span>
            {missingRecipes.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                {missingRecipes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSuggestions(true)}
            className="group relative px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/30 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-3 border border-white/10"
          >
            <FaLightbulb className="text-yellow-300 text-lg animate-pulse" />
            <span>Sugerencias</span>
            {suggestedItems.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full border-2 border-gray-900 shadow-sm">
                {suggestedItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

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
                      Mensual (6M)
                    </th>
                    <th className="px-6 py-4 text-center">Trend</th>
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
                        {item.monthly}{" "}
                        <span className="text-[10px] font-normal text-gray-500 ml-1">
                          u/m
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <TrendIcon trend={item.trend} />
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
