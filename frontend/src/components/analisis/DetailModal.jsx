import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FaUserTie,
  FaCubes,
  FaHistory,
  FaChartLine,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaQuestionCircle,
  FaTimes,
  FaClock,
  FaChartPie,
  FaCalendarCheck,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
  AreaChart,
  Area,
} from "recharts";

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

const getDaysAgo = (dateStr) => {
  const d = parseDateStr(dateStr);
  if (!d) return "-";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diffTime = now.getTime() - d.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return `Hace ${diffDays} días`;
};

// --- PORTAL TOOLTIP ---
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

// --- WIDGET TENDENCIA (Para el Modal) ---
const TrendWidgetModal = ({ trend }) => {
  const [tooltipCoords, setTooltipCoords] = useState(null);

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipCoords({ left: rect.left, top: rect.bottom + 5 });
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-2">
      <div
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${
          trend === "CRECIENDO"
            ? "bg-green-50 text-green-700 border-green-200"
            : trend === "CAYENDO"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-gray-50 text-gray-500 border-gray-200"
        }`}
      >
        {trend === "CRECIENDO" && <FaArrowUp size={8} />}
        {trend === "CAYENDO" && <FaArrowDown size={8} />}
        {trend === "ESTABLE" && <FaMinus size={8} />}
        <span className="uppercase tracking-wide">
          {trend === "CRECIENDO"
            ? "Creciendo"
            : trend === "CAYENDO"
              ? "Cayendo"
              : "Estable"}
        </span>
        <div
          className="cursor-help ml-1 relative flex items-center"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setTooltipCoords(null)}
        >
          <FaQuestionCircle className="text-gray-400 hover:text-blue-500 transition-colors" />
        </div>
      </div>
      <PortalTooltip coords={tooltipCoords}>
        <div className="w-56 p-3 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl border border-slate-600 text-center animate-in fade-in zoom-in-95 duration-200">
          <p className="font-bold mb-1 text-gray-200 uppercase">
            Tendencia (2 Meses)
          </p>
          <p className="leading-relaxed text-gray-400">
            Evaluación basada en variaciones de al menos 5% entre los últimos 2
            meses cerrados.
          </p>
        </div>
      </PortalTooltip>
    </div>
  );
};

export default function DetailModal({
  selectedItem,
  isCli,
  modalHistory,
  modalPage,
  setModalPage,
  totalPages,
  historialFilter,
  setHistorialFilter,
  setSelectedItem,
  showCurrentMonth,
  setShowCurrentMonth,
  COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
}) {
  const [resolution, setResolution] = useState("MENSUAL");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // --- LÓGICA DE FECHAS DINÁMICA POR RESOLUCIÓN ---
  useEffect(() => {
    const today = new Date();
    const start = new Date();

    if (resolution === "DIARIA") {
      start.setDate(today.getDate() - 30);
    } else if (resolution === "SEMANAL") {
      start.setDate(today.getDate() - 84);
    } else {
      start.setFullYear(today.getFullYear() - 1);
    }

    setDateRange({
      start: formatDateForInput(start),
      end: formatDateForInput(today),
    });
  }, [resolution]);

  if (!selectedItem) return null;

  // --- 1. FILTRADO ---
  const filteredHistory = useMemo(() => {
    if (!selectedItem.history) return [];
    return selectedItem.history.filter((h) => {
      if (historialFilter === "SIN_ML") return !h.isML;
      if (historialFilter === "SOLO_ML") return h.isML;
      return true;
    });
  }, [selectedItem, historialFilter]);

  // --- 2. CÁLCULOS KPI ---
  const lastActivityDate = selectedItem.last || "-";
  const daysAgo = lastActivityDate !== "-" ? getDaysAgo(lastActivityDate) : "-";
  const totalVolFiltered = filteredHistory.reduce(
    (acc, curr) => acc + curr.cant,
    0,
  );

  let status = "ACTIVO";
  let statusColor = "text-green-600 bg-green-50 border-green-200";
  if (daysAgo.includes("días") && parseInt(daysAgo.split(" ")[1]) > 45) {
    status = "INACTIVO";
    statusColor = "text-red-600 bg-red-50 border-red-200";
  }

  // --- 3. DATOS GRÁFICO (Chart Data) ---
  const chartData = useMemo(() => {
    if (!filteredHistory.length || !dateRange.start || !dateRange.end)
      return [];
    const startObj = new Date(dateRange.start);
    startObj.setHours(0, 0, 0, 0);
    const endObj = new Date(dateRange.end);
    endObj.setHours(23, 59, 59, 999);
    const buckets = {};
    const sourceData = filteredHistory;
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
        const yShort = current.getFullYear().toString().slice(-2);
        label = mName.charAt(0).toUpperCase() + mName.slice(1) + " " + yShort;
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
    result = result.map((item) => ({ mes: item.label, ventas: item.value }));

    if (resolution === "MENSUAL" && !showCurrentMonth) {
      const now = new Date();
      const currentLabel = now.toLocaleDateString("es-AR", { month: "short" });
      const currentYear = now.getFullYear().toString().slice(-2);
      const formattedLabel =
        currentLabel.charAt(0).toUpperCase() +
        currentLabel.slice(1) +
        " " +
        currentYear;
      if (result.length > 0 && result[result.length - 1].mes === formattedLabel)
        result.pop();
    }
    return result;
  }, [filteredHistory, resolution, dateRange, showCurrentMonth]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] h-[85vh] border border-gray-200 flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-white sticky top-0 z-20 shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight">
              {isCli ? (
                <FaUserTie className="text-purple-600" />
              ) : (
                <FaCubes className="text-blue-600" />
              )}
              <span className="truncate max-w-2xl" title={selectedItem.name}>
                {selectedItem.name}
              </span>
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor}`}
              >
                {status}
              </span>
              <p className="text-xs text-gray-500 font-medium">
                Análisis de rendimiento detallado
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedItem(null)}
            className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-gray-50/50">
          {/* COLUMNA IZQUIERDA */}
          <div className="w-full lg:w-1/4 flex flex-col gap-4 p-5 overflow-y-auto custom-scrollbar border-r border-gray-100 bg-white">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Volumen Filtrado
              </h3>
              <p className="text-4xl font-black text-gray-900 tracking-tighter">
                {totalVolFiltered.toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400 mb-3">unidades</p>
              <TrendWidgetModal
                trend={selectedItem?.tendenciaStatus || "ESTABLE"}
              />
            </div>

            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-blue-500 border border-gray-100 shadow-sm">
                    <FaClock />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      Última Actividad
                    </p>
                    <p className="text-sm font-bold text-gray-800">
                      {selectedItem.last || "-"}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
                  {daysAgo}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-green-500 border border-gray-100 shadow-sm">
                    <FaCalendarCheck />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      Promedio Mensual
                    </p>
                    <p className="text-sm font-bold text-gray-800">
                      ~ {selectedItem.promedio3Meses?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-100 p-4 shadow-sm min-h-[200px]">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <FaChartPie /> {isCli ? "Productos Top" : "Mejores Clientes"}
              </h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={selectedItem.pie}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {selectedItem.pie.map((e, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                      }}
                      itemStyle={{ color: "#1f2937" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                {selectedItem.pie.slice(0, 3).map((e, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-[10px] text-gray-600"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      ></span>{" "}
                      <span className="truncate w-24">{e.name}</span>
                    </div>
                    <span className="font-bold">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="flex-1 flex flex-col gap-4 p-5 overflow-hidden">
            {/* 1. GRÁFICO */}
            <div className="h-[35%] bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-2 shrink-0">
                <h3 className="text-gray-800 font-bold text-sm flex items-center gap-2">
                  <FaChartLine className="text-blue-600" /> Evolución
                </h3>
                <div className="flex bg-gray-50 p-0.5 rounded-lg border border-gray-100">
                  {["DIARIA", "SEMANAL", "MENSUAL"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setResolution(t)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${resolution === t ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                    >
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="colorVentasModal"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f3f4f6"
                    />
                    <XAxis
                      dataKey="mes"
                      stroke="#9ca3af"
                      fontSize={10}
                      tickMargin={8}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={10}
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        borderColor: "#e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                        fontSize: "12px",
                      }}
                      itemStyle={{ color: "#2563EB", fontWeight: "bold" }}
                      formatter={(value, name) => [value, "Unidades"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="ventas"
                      name="Unidades"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorVentasModal)"
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. TABLA MOVIMIENTOS */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
              <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                <h3 className="font-bold flex gap-2 text-sm items-center text-gray-700">
                  <FaHistory className="text-gray-400" /> Movimientos
                </h3>
                <div className="flex gap-1 bg-white p-0.5 rounded border border-gray-200">
                  {["TODOS", "SIN_ML", "SOLO_ML"].map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setHistorialFilter(f);
                        setModalPage(1);
                      }}
                      className={`px-2 py-1 text-[9px] font-bold rounded transition-colors ${historialFilter === f ? "bg-slate-800 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                    >
                      {f.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 relative">
                <div className="absolute inset-0 flex flex-col">
                  <div className="flex text-[10px] text-gray-400 bg-white uppercase font-bold border-b border-gray-100 shadow-sm shrink-0">
                    <div className="w-[20%] px-4 py-2">Fecha</div>
                    <div className="w-[50%] px-4 py-2">
                      {isCli ? "Producto" : "Cliente"}
                    </div>
                    <div className="w-[15%] px-4 py-2 text-right">Cant</div>
                    <div className="w-[15%] px-4 py-2 text-right">Ref</div>
                  </div>

                  <div className="flex-1 flex flex-col">
                    {modalHistory.map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 flex items-center hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 min-h-0"
                      >
                        <div className="w-[20%] px-4 font-mono text-gray-500 whitespace-nowrap text-xs flex items-center gap-2">
                          {h.fecha}
                          {h.isML && (
                            <span className="bg-yellow-50 text-yellow-600 border border-yellow-100 px-1 rounded-[3px] text-[8px] font-bold">
                              MELI
                            </span>
                          )}
                        </div>
                        <div
                          className="w-[50%] px-4 font-medium text-gray-800 truncate text-xs"
                          title={h.col}
                        >
                          {h.col}
                        </div>
                        <div className="w-[15%] px-4 text-right font-bold text-blue-600 text-xs">
                          {h.cant}
                        </div>
                        <div className="w-[15%] px-4 text-right font-mono text-gray-400 text-xs">
                          {h.op !== "-" && h.op !== "0" ? `#${h.op}` : "-"}
                        </div>
                      </div>
                    ))}
                    {modalHistory.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs italic">
                        <FaHistory className="text-xl opacity-20 mb-1" /> Sin
                        movimientos con este filtro.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center p-2 border-t border-gray-100 bg-gray-50/50 shrink-0">
                  <button
                    disabled={modalPage === 1}
                    onClick={() => setModalPage((p) => p - 1)}
                    className="px-2 py-1 bg-white border border-gray-200 text-[10px] font-bold rounded hover:bg-gray-50 disabled:opacity-50 text-gray-600"
                  >
                    Ant
                  </button>
                  <span className="text-[10px] text-gray-500 font-medium">
                    Pág {modalPage} / {totalPages}
                  </span>
                  <button
                    disabled={modalPage === totalPages}
                    onClick={() => setModalPage((p) => p + 1)}
                    className="px-2 py-1 bg-white border border-gray-200 text-[10px] font-bold rounded hover:bg-gray-50 disabled:opacity-50 text-gray-600"
                  >
                    Sig
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
