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
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

// --- HELPERS ---
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

// --- BADGE (Estilo Lebane) ---
function DaysLeftBadge({ days, val }) {
  const baseClass =
    "px-3 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1.5 w-fit mx-auto";

  if (val > 365 || days === "∞") {
    return (
      <span className={`${baseClass} bg-blue-50 text-blue-600 border-blue-200`}>
        +1 Año
      </span>
    );
  }
  if (val > 30) {
    return (
      <span
        className={`${baseClass} bg-green-50 text-green-600 border-green-200`}
      >
        <FaCheckCircle /> {days} días
      </span>
    );
  }
  if (val > 7) {
    return (
      <span
        className={`${baseClass} bg-yellow-50 text-yellow-700 border-yellow-200`}
      >
        <FaHourglassHalf /> {days} días
      </span>
    );
  }
  return (
    <span
      className={`${baseClass} bg-red-50 text-red-600 border-red-200 animate-pulse`}
    >
      <FaExclamationTriangle /> {days} días
    </span>
  );
}

// --- WIDGET TENDENCIA CON TEXTO ---
const TrendIcon = ({ trend }) => {
  return (
    <div className="flex items-center gap-1 justify-center">
      <div
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
          trend === "up"
            ? "bg-green-50 text-green-700 border-green-200"
            : trend === "down"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-gray-50 text-gray-500 border-gray-200"
        }`}
      >
        {trend === "up" && <FaArrowUp size={8} />}
        {trend === "down" && <FaArrowDown size={8} />}
        {trend === "neutral" && <FaMinus size={8} />}

        <span>
          {trend === "up" ? "Sube" : trend === "down" ? "Baja" : "Estable"}
        </span>
      </div>
    </div>
  );
};

// --- MODALES ---
function MissingRecipesModal({ items, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[120] p-4 animate-in fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col overflow-hidden max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <FaBug />
            </div>
            Productos sin Receta
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FaTimes />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl hover:bg-gray-50 border-b border-gray-50 last:border-0 flex justify-between items-center"
            >
              <div>
                <p className="font-bold text-gray-800 text-sm">{item.name}</p>
                <p className="text-xs text-red-500 font-medium">
                  {item.reason}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200">
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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[120] p-4 animate-in fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col overflow-hidden max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
              <FaLightbulb />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Sugerencias</h3>
              <p className="text-xs text-gray-500">
                Reposición crítica detectada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {items.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm italic">
              Todo bajo control.
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="group p-3 rounded-xl hover:bg-blue-50 cursor-pointer transition-all border border-transparent hover:border-blue-100 mb-1"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">
                      {item.name}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold">
                        Stock: {item.stock}
                      </span>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-bold">
                        ~{item.monthly}/mes
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-red-500 block">
                      {item.daysLeft} días
                    </span>
                    <span className="text-[9px] text-gray-400 uppercase font-bold">
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
      let key = "",
        label = "",
        sortKey = current.getTime();
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
    result = result.map((it) => ({ mes: it.label, consumo: it.value }));
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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[110] p-4 animate-in fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[90vw] border border-gray-200 flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <FaBoxOpen className="text-blue-600" /> {item.name}
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Análisis detallado de consumo
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
          >
            <FaTimes size={18} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar bg-white">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1">
                Stock Actual
              </p>
              <p className="text-3xl font-extrabold text-blue-600">
                {item.stock}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1">
                Consumo Total
              </p>
              <p className="text-3xl font-extrabold text-gray-800">
                {chartData.reduce((a, b) => a + b.consumo, 0)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center flex flex-col justify-center items-center">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-2">
                Cobertura
              </p>
              <DaysLeftBadge days={item.daysLeft} val={item.daysLeftVal} />
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
              <h3 className="text-gray-800 font-bold text-sm uppercase flex items-center gap-2 tracking-wider">
                <FaChartArea className="text-blue-500" /> Evolución
              </h3>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {["DIARIA", "SEMANAL", "MENSUAL"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setResolution(t)}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${resolution === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    {t === "DIARIA" ? (
                      <FaCalendarDay />
                    ) : t === "SEMANAL" ? (
                      <FaCalendarWeek />
                    ) : (
                      <FaCalendarAlt />
                    )}
                  </button>
                ))}
              </div>
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
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    strokeOpacity={0.1}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="mes"
                    stroke="#9CA3AF"
                    fontSize={11}
                    tickMargin={10}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="consumo"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorConsumo)"
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

// --- COMPONENTE PRINCIPAL ---
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

  const criticalCount = consumo.filter((i) => i.daysLeftVal <= 7).length;
  const warningCount = consumo.filter(
    (i) => i.daysLeftVal > 7 && i.daysLeftVal <= 30,
  ).length;
  const safeCount = consumo.filter((i) => i.daysLeftVal > 30).length;

  return (
    <div className="flex flex-col h-full overflow-hidden pb-0 pr-2">
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

      {/* 1. KPIs ROW */}
      <div className="flex gap-4 shrink-0 mb-4">
        <div className="flex-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-lg text-red-600">
            <FaExclamationTriangle size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">
              Críticos (&lt;7d)
            </p>
            <p className="text-2xl font-extrabold text-gray-900">
              {criticalCount}
            </p>
          </div>
        </div>
        <div className="flex-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600">
            <FaHourglassHalf size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">
              Alerta (7-30d)
            </p>
            <p className="text-2xl font-extrabold text-gray-900">
              {warningCount}
            </p>
          </div>
        </div>
        <div className="flex-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-lg text-green-600">
            <FaCheckCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">
              Saludable
            </p>
            <p className="text-2xl font-extrabold text-gray-900">{safeCount}</p>
          </div>
        </div>
      </div>

      {/* 2. TOOLBAR */}
      <div className="flex justify-between items-center mb-4 shrink-0 gap-4">
        <div className="relative flex-1 max-w-lg">
          <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
          <input
            type="text"
            placeholder="Buscar insumo para analizar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-blue-500 shadow-sm placeholder-gray-400"
          />
          {searchTerm && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl z-50 border border-gray-100 overflow-hidden">
              {suggestions.map((item, i) => (
                <div
                  key={i}
                  onClick={() => {
                    toggleSelection(item.name);
                    setSearchTerm("");
                  }}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 border-b border-gray-50 last:border-0 text-sm flex justify-between"
                >
                  <span className="font-bold">{item.name}</span>
                  <span className="text-xs text-gray-400">
                    Stock: {item.stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMissingModal(true)}
            disabled={missingRecipes.length === 0}
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <FaBug className="text-red-500" /> Sin Receta
            {missingRecipes.length > 0 && (
              <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                {missingRecipes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSuggestions(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            <FaLightbulb className="text-yellow-300" /> Sugerencias IA
          </button>
        </div>
      </div>

      {/* 3. TABLA PRINCIPAL (Flex-1 para llenar espacio) */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-0">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <FaListUl className="text-blue-500" /> Lista de Seguimiento
          </h3>
          <button
            onClick={() => setSelectedItems(new Set())}
            className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
          >
            <FaTrashAlt /> Limpiar
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
            {tableRows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                <FaClipboardList className="text-6xl mb-4 text-gray-300" />
                <p className="text-sm font-medium">Lista vacía.</p>
                <p className="text-xs">
                  Usa el buscador o las sugerencias para agregar ítems.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-600 table-fixed">
                <thead className="bg-white text-gray-500 uppercase text-xs font-bold tracking-wider sticky top-0 z-10 border-b border-gray-100 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 w-[5%] text-center bg-white">#</th>
                    <th className="px-3 py-3 w-[40%] bg-white">Insumo</th>
                    <th className="px-3 py-3 w-[15%] text-right bg-white">
                      Stock
                    </th>
                    <th className="px-3 py-3 w-[15%] text-right bg-white">
                      Consumo (Mes)
                    </th>
                    <th className="px-3 py-3 w-[12%] text-center bg-white">
                      Tendencia
                    </th>
                    <th className="px-3 py-3 w-[13%] text-center bg-white">
                      Cobertura
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tableRows.map((item, index) => (
                    <tr
                      key={index}
                      onClick={() => setSelectedDetailItem(item)}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                    >
                      <td
                        className="px-3 py-4 text-center text-gray-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(item.name);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={true}
                          readOnly
                          className="cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td
                        className="px-3 py-4 font-bold text-gray-800 group-hover:text-blue-600 truncate"
                        title={item.name}
                      >
                        {item.name}
                      </td>
                      <td className="px-3 py-4 text-right font-mono font-bold text-gray-700">
                        {item.stock}
                      </td>
                      <td className="px-3 py-4 text-right font-mono text-gray-500">
                        ~{item.monthly}
                      </td>
                      <td className="px-3 py-4 text-center">
                        <TrendIcon trend={item.trend} />
                      </td>
                      <td className="px-3 py-4 text-center">
                        <DaysLeftBadge
                          days={item.daysLeft}
                          val={item.daysLeftVal}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
