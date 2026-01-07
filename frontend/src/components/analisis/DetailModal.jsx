import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FaUserTie,
  FaCubes,
  FaHistory,
  FaChartLine,
  FaEye,
  FaEyeSlash,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaQuestionCircle,
  FaCalendarDay,
  FaCalendarWeek,
  FaCalendarAlt,
  FaCalendar,
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
  AreaChart, // Cambiamos LineChart por AreaChart
  Area, // Cambiamos Line por Area
} from "recharts";

// --- HELPERS DE FECHA ---
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
    document.body
  );
};

// --- WIDGET DE TENDENCIA ---
const TrendWidgetModal = ({ trend }) => {
  const [tooltipCoords, setTooltipCoords] = useState(null);

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipCoords({
      left: rect.left + rect.width / 2,
      top: rect.top,
    });
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-3">
      <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-600/50 shadow-sm">
        {trend === "up" && <FaArrowUp className="text-green-400 text-xs" />}
        {trend === "down" && <FaArrowDown className="text-red-400 text-xs" />}
        {trend === "neutral" && (
          <FaMinus className="text-gray-400 text-[10px]" />
        )}

        <span
          className={`text-xs font-bold uppercase tracking-wide ${
            trend === "up"
              ? "text-green-400"
              : trend === "down"
              ? "text-red-400"
              : "text-gray-400"
          }`}
        >
          {trend === "up"
            ? "Acelerando"
            : trend === "down"
            ? "Frenando"
            : "Estable"}
        </span>

        <div
          className="cursor-help ml-1 relative flex items-center"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setTooltipCoords(null)}
        >
          <FaQuestionCircle className="text-slate-500 text-xs hover:text-blue-400 transition-colors" />
        </div>
      </div>

      <PortalTooltip coords={tooltipCoords}>
        <div className="w-48 p-3 bg-black/95 text-white text-[10px] rounded-lg shadow-2xl border border-slate-700 text-center animate-in fade-in zoom-in-95 duration-200">
          <p className="font-bold mb-1 text-gray-200 uppercase">
            Momentum Reciente
          </p>
          <p className="leading-relaxed text-gray-400">
            Comparativa calculada sobre los datos visualizados en el gráfico
            actual.
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-700"></div>
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
  COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"],
}) {
  const [resolution, setResolution] = useState("MENSUAL");

  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  });

  useEffect(() => {
    const today = new Date();
    const start = new Date(2025, 0, 1);

    setDateRange({
      start: formatDateForInput(start),
      end: formatDateForInput(today),
    });
  }, []);

  if (!selectedItem) return null;

  const chartData = useMemo(() => {
    if (!selectedItem.history || !dateRange.start || !dateRange.end) return [];

    const startObj = new Date(dateRange.start);
    startObj.setHours(0, 0, 0, 0);
    const endObj = new Date(dateRange.end);
    endObj.setHours(23, 59, 59, 999);

    const buckets = {};
    const sourceData = selectedItem.history;

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

      if (!buckets[key]) {
        buckets[key] = { label, value: 0, sortKey };
      }
    }

    sourceData.forEach((h) => {
      const d = parseDateStr(h.fecha);
      if (d && d >= startObj && d <= endObj) {
        let key = "";
        if (resolution === "DIARIA") {
          key = d.toISOString().split("T")[0];
        } else if (resolution === "SEMANAL") {
          key = getWeekNumber(d);
        } else {
          key = `${d.getFullYear()}-${d.getMonth()}`;
        }

        if (buckets[key]) {
          buckets[key].value += h.cant;
        }
      }
    });

    let result = Object.values(buckets).sort((a, b) => a.sortKey - b.sortKey);
    result = result.map((item) => ({ mes: item.label, ventas: item.value }));

    if (resolution === "MENSUAL" && !showCurrentMonth) {
      const now = new Date();
      const currentLabel = now.toLocaleDateString("es-AR", { month: "short" });
      const formattedLabel =
        currentLabel.charAt(0).toUpperCase() + currentLabel.slice(1);

      if (
        result.length > 0 &&
        result[result.length - 1].mes === formattedLabel
      ) {
        result.pop();
      }
    }

    return result;
  }, [selectedItem, resolution, dateRange, showCurrentMonth]);

  const calculatedTrend = useMemo(() => {
    const data = chartData;
    if (data.length < 2) return "neutral";
    const half = Math.floor(data.length / 2);
    const firstHalf =
      data.slice(0, half).reduce((a, b) => a + b.ventas, 0) / half;
    const secondHalf =
      data.slice(half).reduce((a, b) => a + b.ventas, 0) / (data.length - half);

    if (firstHalf === 0) return secondHalf > 0 ? "up" : "neutral";
    const diff = (secondHalf - firstHalf) / firstHalf;

    if (diff > 0.1) return "up";
    if (diff < -0.1) return "down";
    return "neutral";
  }, [chartData]);

  const handleDateChange = (type, val) => {
    setDateRange((prev) => ({ ...prev, [type]: val }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-[90vw] max-h-[95vh] overflow-y-auto border border-slate-600 flex flex-col">
        {/* HEADER */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-start bg-slate-800 sticky top-0 z-20 shadow-lg">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              {isCli ? (
                <FaUserTie className="text-purple-400" />
              ) : (
                <FaCubes className="text-blue-400" />
              )}
              <span className="truncate max-w-2xl" title={selectedItem.name}>
                {selectedItem.name}
              </span>
            </h2>
            <p className="text-sm text-gray-400 mt-1 pl-1">
              Análisis detallado de rendimiento
            </p>
          </div>
          <button
            onClick={() => setSelectedItem(null)}
            className="text-gray-400 hover:text-white bg-slate-700/30 hover:bg-slate-700 rounded-full w-10 h-10 flex items-center justify-center transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* COLUMNA IZQUIERDA (KPIs) */}
          <div className="lg:col-span-1 space-y-6">
            <div
              className={`bg-opacity-20 p-6 rounded-xl border text-center relative overflow-hidden group ${
                isCli
                  ? "bg-purple-900 border-purple-800"
                  : "bg-blue-900 border-blue-800"
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
              <h3 className="text-xs font-bold mb-2 text-gray-300 uppercase tracking-wider">
                Total Acumulado (Rango)
              </h3>
              <p className="text-5xl font-black text-white tracking-tight drop-shadow-sm">
                {chartData.reduce((acc, curr) => acc + curr.ventas, 0)}
              </p>

              <TrendWidgetModal trend={calculatedTrend} />
            </div>

            <div className="bg-slate-700/30 p-5 rounded-xl border border-slate-600 h-auto flex flex-col shadow-inner">
              <h3 className="text-xs font-bold mb-4 text-center text-gray-300 uppercase tracking-wider">
                {isCli ? "Productos Favoritos" : "Top Clientes"}
              </h3>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={selectedItem.pie}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
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
                        backgroundColor: "#1e293b",
                        color: "#fff",
                        borderRadius: "8px",
                        border: "1px solid #334155",
                        fontSize: "12px",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 flex flex-col gap-2 px-2">
                {selectedItem.pie.map((e, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-[11px] text-gray-300 border-b border-white/5 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      ></span>
                      <span className="truncate max-w-[140px]" title={e.name}>
                        {e.name}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-gray-400">
                      {e.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA (GRÁFICO + TABLA) */}
          <div className="lg:col-span-3 space-y-6">
            {/* CONTROLES Y GRÁFICO */}
            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
                <h3 className="text-gray-200 font-bold text-sm uppercase flex items-center gap-2">
                  <FaChartLine className="text-blue-400" /> Evolución de Ventas
                </h3>

                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600/50">
                  <button
                    onClick={() => setResolution("DIARIA")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                      resolution === "DIARIA"
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <FaCalendarDay /> Diario
                  </button>
                  <button
                    onClick={() => setResolution("SEMANAL")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                      resolution === "SEMANAL"
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <FaCalendarWeek /> Semanal
                  </button>
                  <button
                    onClick={() => setResolution("MENSUAL")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                      resolution === "MENSUAL"
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <FaCalendarAlt /> Mensual
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
                      onChange={(e) =>
                        handleDateChange("start", e.target.value)
                      }
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

                {resolution === "MENSUAL" && setShowCurrentMonth && (
                  <button
                    onClick={() => setShowCurrentMonth(!showCurrentMonth)}
                    className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-bold transition-all border ${
                      showCurrentMonth
                        ? "bg-blue-600/20 text-blue-300 border-blue-500/50"
                        : "bg-slate-800 text-gray-500 border-slate-600"
                    }`}
                  >
                    {showCurrentMonth ? <FaEye /> : <FaEyeSlash />}
                    {showCurrentMonth ? "Mes Actual: ON" : "Mes Actual: OFF"}
                  </button>
                )}
              </div>

              <div className="h-72 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {/* CAMBIO: Usamos AreaChart en lugar de LineChart para que se vea más "lleno" y lindo */}
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="colorVentas"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.4}
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
                        strokeOpacity={0.1}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="mes"
                        stroke="#94a3b8"
                        // Si es diario, aumentamos el gap para que no se amontonen
                        minTickGap={resolution === "DIARIA" ? 30 : 15}
                        tick={{ fontSize: 10 }}
                        tickMargin={10}
                        axisLine={false}
                        tickLine={false}
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
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                        itemStyle={{ color: "#3b82f6" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="ventas"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorVentas)"
                        // CAMBIO ESTÉTICO: Ocultamos los puntos en vista diaria para evitar "ruido"
                        // Solo mostramos el punto activo al hacer hover
                        dot={
                          resolution === "DIARIA"
                            ? false
                            : {
                                r: 4,
                                fill: "#1e293b",
                                stroke: "#3b82f6",
                                strokeWidth: 2,
                              }
                        }
                        activeDot={{ r: 6, fill: "#fff", stroke: "#3b82f6" }}
                        animationDuration={500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm">
                    <FaChartLine className="text-4xl mb-2 opacity-20" />
                    No hay datos en el rango seleccionado.
                  </div>
                )}
              </div>
            </div>

            {/* TABLA HISTORIAL */}
            <div className="bg-slate-700/30 p-5 rounded-xl border border-slate-600">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex gap-2 text-sm items-center text-white">
                  <FaHistory className="text-green-400" /> Historial de
                  Movimientos
                </h3>
                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                  {["TODOS", "SIN_ML", "SOLO_ML"].map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setHistorialFilter(f);
                        setModalPage(1);
                      }}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${
                        historialFilter === f
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-400 hover:text-white hover:bg-slate-700"
                      }`}
                    >
                      {f.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-[220px]">
                <table className="w-full text-sm text-left text-gray-300">
                  <thead className="text-xs text-gray-400 bg-slate-800/50 uppercase">
                    <tr>
                      <th className="p-3 rounded-l-lg">Fecha</th>
                      <th className="p-3">{isCli ? "Producto" : "Cliente"}</th>
                      <th className="p-3 text-right">Cant</th>
                      <th className="p-3 text-right rounded-r-lg">Ref (OP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {modalHistory.map((h, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-700/40 transition-colors"
                      >
                        <td className="p-3 font-mono text-xs flex gap-2 items-center">
                          <span className="text-gray-300">{h.fecha}</span>
                          {h.isML && (
                            <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              MELI
                            </span>
                          )}
                        </td>
                        <td
                          className="p-3 truncate max-w-[250px] font-medium text-white"
                          title={h.col}
                        >
                          {h.col}
                        </td>
                        <td className="p-3 text-right font-bold text-green-400">
                          {h.cant}
                        </td>
                        <td className="p-3 text-right text-xs font-mono text-blue-400 font-bold">
                          {h.op !== "-" && h.op !== "0" ? (
                            `#${h.op}`
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {modalHistory.length === 0 && (
                  <div className="py-12 text-center text-gray-500 text-xs italic flex flex-col items-center gap-2">
                    <FaHistory className="text-2xl opacity-20" />
                    No hay movimientos con este filtro.
                  </div>
                )}
              </div>

              {/* PAGINACIÓN */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-600/50">
                  <button
                    disabled={modalPage === 1}
                    onClick={() => setModalPage((p) => p - 1)}
                    className="px-3 py-1 bg-slate-800 border border-slate-600 text-xs rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-gray-400">
                    Página{" "}
                    <span className="text-white font-bold">{modalPage}</span> de{" "}
                    {totalPages}
                  </span>
                  <button
                    disabled={modalPage === totalPages || totalPages === 0}
                    onClick={() => setModalPage((p) => p + 1)}
                    className="px-3 py-1 bg-slate-800 border border-slate-600 text-xs rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900/40 p-3 rounded-lg text-center text-xs text-gray-500 border border-slate-800 flex justify-center gap-2">
              <span>Último movimiento registrado:</span>
              <span className="text-white font-mono font-bold">
                {selectedItem.last}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
