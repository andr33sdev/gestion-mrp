import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FaUsers,
  FaCubes,
  FaChartLine,
  FaSpinner,
  FaExclamationTriangle,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaTrophy,
  FaMedal,
  FaListOl,
  FaChartPie,
  FaFilePdf,
  FaBox,
  FaInfoCircle,
  FaCalendarDay,
  FaCalendarWeek,
  FaCalendarAlt,
  FaClock,
  FaEye,
  FaEyeSlash,
  FaMinus,
  FaTimes,
  FaMoneyBillWave,
  FaUserTie,
  FaTag,
  FaChevronDown,
  FaSync,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
  AreaChart,
  Area,
} from "recharts";
import { PEDIDOS_API_URL, API_BASE_URL, authFetch } from "../utils.js";
import SearchBar from "../components/analisis/SearchBar";
import ConsumptionView from "../components/analisis/ConsumptionView";
import DetailModal from "../components/analisis/DetailModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const RECETAS_ALL_URL = `${API_BASE_URL}/ingenieria/recetas/all`;
const STOCK_SEMIS_URL = `${API_BASE_URL}/ingenieria/semielaborados`;
const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

const normalizeKey = (key) => (key || "").trim().toUpperCase();

// --- HELPERS ---
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  if (Object.prototype.toString.call(dateStr) === "[object Date]")
    return isNaN(dateStr) ? null : dateStr;
  const str = String(dateStr).trim();

  if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
    const d = new Date(str);
    if (str.length === 10)
      return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    return isNaN(d) ? null : d;
  }
  if (str.includes("/")) {
    const parts = str.split("/");
    // Soportar fechas cortas como "19/2"
    if (parts.length === 2) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = new Date().getFullYear();
      const d = new Date(year, month, day);
      return isNaN(d) ? null : d;
    }
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      return isNaN(d) ? null : d;
    }
  }
  if (str.match(/^\d+$/)) {
    const val = parseInt(str, 10);
    if (val > 30000 && val < 60000) {
      const fechaBase = new Date(1899, 11, 30);
      const dias = Math.floor(val);
      const ms = (val - dias) * 86400 * 1000;
      return new Date(fechaBase.getTime() + dias * 86400000 + ms);
    }
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

const parseCantidad = (val) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const limpio = val.toString().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(limpio);
  return isNaN(num) ? 0 : num;
};

const formatDateForInput = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// HELPER PARA MONEDA ROBUSTO (Cubre cualquier formato de $ o texto)
const parseCurrency = (val) => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return val;
  let str = String(val).replace(/[^0-9.,-]/g, "");
  if (str.includes(".") && str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const formatCurrency = (num) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatCompactCurrency = (num) => {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}k`;
  return `$${num.toFixed(0)}`;
};

const getWeekNumber = (d) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};

// --- COMPONENTES UI ESTILO LEBANE ---
const RankIcon = ({ index }) => {
  if (index === 0) return <FaTrophy className="text-yellow-500 text-[14px]" />;
  if (index === 1) return <FaMedal className="text-slate-400 text-[14px]" />;
  if (index === 2) return <FaMedal className="text-amber-700 text-[14px]" />;
  return (
    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
      #{index + 1}
    </span>
  );
};

export const TrendWidget = ({ status }) => {
  const isPositive = status === "CRECIENDO";
  const isNegative = status === "CAYENDO";
  const isNeutral = status === "ESTABLE";

  return (
    <div className="flex items-center justify-end">
      <div
        className={`flex items-center justify-center w-6 h-6 rounded-md border shadow-sm ${
          isPositive
            ? "bg-green-50 text-green-700 border-green-200"
            : isNegative
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-gray-50 text-gray-500 border-gray-200"
        }`}
        title={
          isPositive
            ? "Creciendo (últimos 3 meses)"
            : isNegative
              ? "Cayendo (últimos 3 meses)"
              : "Estable"
        }
      >
        {isPositive && <FaArrowUp size={10} />}
        {isNegative && <FaArrowDown size={10} />}
        {isNeutral && <FaMinus size={10} />}
      </div>
    </div>
  );
};

const InfoTooltip = ({ text }) => {
  const [tooltipCoords, setTooltipCoords] = useState(null);
  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipCoords({ left: rect.left, top: rect.bottom + 5 });
  };

  return (
    <>
      <FaInfoCircle
        className="text-slate-400 hover:text-blue-500 cursor-help ml-1"
        size={11}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltipCoords(null)}
      />
      {tooltipCoords &&
        createPortal(
          <div
            className="fixed z-[9999] bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg max-w-[200px]"
            style={{ left: tooltipCoords.left, top: tooltipCoords.top }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
};

const StatCard = ({
  title,
  value,
  subtext,
  trend,
  icon,
  colorClass,
  onClick,
  isClickable,
}) => (
  <div
    onClick={onClick}
    className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-40 ${isClickable ? "cursor-pointer hover:shadow-md hover:border-blue-300 transition-all" : ""}`}
  >
    <div className="flex justify-between items-start">
      <div className={`p-3 rounded-xl ${colorClass.bg} ${colorClass.text}`}>
        {icon}
      </div>
      {trend !== undefined && (
        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border ${trend > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : trend < 0 ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-slate-50 text-slate-500 border-slate-200"}`}
        >
          {trend > 0 ? (
            <FaArrowUp size={9} />
          ) : trend < 0 ? (
            <FaArrowDown size={9} />
          ) : (
            <FaEquals size={9} />
          )}
          {Math.abs(trend)}%
        </span>
      )}
      {isClickable && <FaInfoCircle className="text-slate-300" />}
    </div>
    <div className="mt-auto">
      <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
        {title}
      </h3>
      <div
        className={`${value && value.toString().length > 15 ? "text-xl" : "text-3xl"} font-bold text-slate-800 tracking-tight leading-none truncate`}
        title={value}
      >
        {value}
      </div>
      {subtext && (
        <p className="text-xs text-slate-400 mt-1.5 font-medium truncate">
          {subtext}
        </p>
      )}
    </div>
  </div>
);

const MiniTopCard = ({ title, weeklyData, monthlyData, icon }) => {
  const [mode, setMode] = useState("SEMANA");
  const data = mode === "SEMANA" ? weeklyData : monthlyData;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-40 flex flex-col">
      <div className="flex justify-between items-center mb-3 shrink-0">
        <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
          {icon} {title}
        </h4>
        <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
          <button
            onClick={() => setMode("SEMANA")}
            className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all uppercase tracking-wider ${mode === "SEMANA" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            Semana
          </button>
          <button
            onClick={() => setMode("MES")}
            className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all uppercase tracking-wider ${mode === "MES" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            Mes
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between min-h-0">
        {data.length > 0 ? (
          data.slice(0, 5).map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-[11px] w-full"
            >
              <div className="flex items-center gap-2 overflow-hidden flex-1 pr-2">
                <span
                  className={`font-mono font-bold w-4 shrink-0 text-left ${i === 0 ? "text-yellow-500" : "text-slate-300"}`}
                >
                  #{i + 1}
                </span>
                <span
                  className="font-semibold text-slate-700 truncate uppercase"
                  title={item.name}
                >
                  {item.name}
                </span>
              </div>
              <span className="font-mono font-bold text-slate-800 shrink-0">
                {formatCompactCurrency(item.value)}
              </span>
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">
            Sin movimientos
          </div>
        )}
      </div>
    </div>
  );
};

const TopRecentCard = ({ weeklyData, monthlyData }) => {
  const [mode, setMode] = useState("MONTHLY");
  const data = mode === "WEEKLY" ? weeklyData : monthlyData;
  const title = mode === "WEEKLY" ? "ESTA SEMANA" : "ESTE MES";

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-40 flex flex-col">
      <div className="flex justify-between items-center mb-3 shrink-0">
        <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMode("WEEKLY");
            }}
            className={`px-3 py-1.5 rounded-md text-[9px] font-bold transition-all uppercase tracking-wider ${mode === "WEEKLY" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            Semana
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMode("MONTHLY");
            }}
            className={`px-3 py-1.5 rounded-md text-[9px] font-bold transition-all uppercase tracking-wider ${mode === "MONTHLY" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            Mes
          </button>
        </div>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <FaClock size={10} /> {title}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-between min-h-0">
        {data.length > 0 ? (
          data.slice(0, 5).map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-[11px] w-full"
            >
              <div className="flex items-center gap-2 overflow-hidden flex-1 pr-2">
                <span
                  className={`font-mono font-bold w-4 shrink-0 text-left ${i === 0 ? "text-yellow-500" : "text-slate-300"}`}
                >
                  #{i + 1}
                </span>
                <span
                  className="font-semibold text-slate-700 truncate"
                  title={item[0]}
                >
                  {item[0]}
                </span>
              </div>
              <span className="font-mono font-bold text-slate-800 shrink-0">
                {item[1]}
              </span>
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">
            Sin movimientos
          </div>
        )}
      </div>
    </div>
  );
};

const ParetoModal = ({ isOpen, onClose, data, isCli }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-white">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100 shadow-sm">
              <FaChartPie size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                Concentración Top 20
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Los 20 mejores{" "}
                <strong className="text-slate-700">
                  {isCli ? "clientes" : "productos"}
                </strong>{" "}
                representan el{" "}
                <strong className="text-indigo-600">{data.percentage}%</strong>{" "}
                del volumen total.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-3 rounded-full hover:bg-slate-50"
          >
            <FaTimes size={18} />
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar p-6 bg-[#f8fafc]">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-[10px] uppercase font-bold text-slate-400 tracking-widest bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">#</th>
                  <th className="px-6 py-4">
                    {isCli ? "Cliente" : "Producto"}
                  </th>
                  <th className="px-6 py-4 text-right">Volumen</th>
                  <th className="px-6 py-4 text-right">% Relativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-3.5 text-center font-mono font-bold text-slate-400 text-xs">
                      #{idx + 1}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-slate-800 uppercase text-xs">
                      {item.name}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-black text-indigo-600 text-base">
                      {item.value}
                    </td>
                    <td className="px-6 py-3.5 text-right text-slate-500 font-bold">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                        {item.percent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// VISTA: FINANCIERO (Dashboard Dinámico con Cotización USD)
// ==========================================
const FinancieroView = ({ datosPedidos, datosRecetas, datosStock }) => {
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const [fechaDesde, setFechaDesde] = useState(
    formatDateForInput(primerDiaMes),
  );
  const [fechaHasta, setFechaHasta] = useState(formatDateForInput(hoy));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // NUEVO: Estado del Dólar persistente en el navegador
  const [valorDolar, setValorDolar] = useState(
    () => Number(localStorage.getItem("mrp_valor_dolar")) || 1050,
  );

  const handleDolarChange = (e) => {
    const val = e.target.value;
    setValorDolar(val);
    localStorage.setItem("mrp_valor_dolar", val);
  };

  const {
    facturacionRango,
    costoRango,
    rentabilidadRango,
    margenRango,
    facturacionMensualChart,
    tops,
  } = useMemo(() => {
    let fRango = 0;
    let cRango = 0; // Costo total del rango en ARS

    const dCotizacion = Number(valorDolar) || 1; // Previene divisiones por cero o errores

    const weeklyCliMap = {};
    const weeklyProdMap = {};
    const monthlyCliMap = {};
    const monthlyProdMap = {};
    const globalCliMap = {};

    // 1. MAPEAR COSTOS DE SEMIELABORADOS (EN USD)
    const mapCostosSemis = {};
    if (datosStock) {
      datosStock.forEach((s) => {
        // La Base de Datos ya hizo el trabajo: si tiene receta usa la suma, si no usa costo_usd
        mapCostosSemis[s.id] = Number(s.costo || s.costo_usd || 0);
      });
    }

    // 2. CALCULAR COSTO BASE DE CADA PRODUCTO TERMINADO (EN USD)
    const mapCostoProducto = {};
    if (datosRecetas) {
      Object.keys(datosRecetas).forEach((prodName) => {
        const items = datosRecetas[prodName];
        let costoProd = 0;
        items.forEach((it) => {
          costoProd +=
            Number(it.cantidad) * (mapCostosSemis[it.semielaborado_id] || 0);
        });
        mapCostoProducto[normalizeKey(prodName)] = costoProd;
      });
    }

    let maxDataTime = 0;
    datosPedidos.forEach((r) => {
      const d = parseDate(r.fecha || r.FECHA);
      if (d && d.getTime() > maxDataTime) maxDataTime = d.getTime();
    });

    const anchorDate = maxDataTime > 0 ? new Date(maxDataTime) : new Date();
    anchorDate.setHours(23, 59, 59, 999);
    const currentM = hoy.getMonth();
    const currentY = hoy.getFullYear();

    const startOfWeek = new Date(hoy);
    startOfWeek.setHours(0, 0, 0, 0);
    const day = startOfWeek.getDay();
    const diffToMonday = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diffToMonday);

    const startOfMonth = new Date(currentY, currentM, 1);

    const mapMeses = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentY, currentM - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const mName = d.toLocaleDateString("es-AR", { month: "short" });
      const yShort = d.getFullYear().toString().slice(-2);
      mapMeses[key] = {
        label: `${mName.charAt(0).toUpperCase() + mName.slice(1)} ${yShort}`,
        monto: 0,
        key,
      };
    }

    const dDesde = fechaDesde ? new Date(fechaDesde + "T00:00:00") : null;
    const dHasta = fechaHasta ? new Date(fechaHasta + "T23:59:59") : null;

    datosPedidos.forEach((r) => {
      const estado = (r.estado || r.ESTADO || "").toUpperCase();
      if (estado.includes("CANCELADO")) return;

      const d = parseDate(r.fecha || r.FECHA);
      const punisiva = parseCurrency(
        r.punisiva ||
          r.PUNISIVA ||
          r.precio ||
          r.PRECIO ||
          r.valor ||
          r.VALOR ||
          r.total_linea ||
          0,
      );
      const cantidad = parseCantidad(r.cantidad || r.CANTIDAD || 1);

      const cli = (r.cliente || r.CLIENTE || "Desconocido").trim();
      const prod = (r.modelo || r.MODELO || "Desconocido").trim();

      // CÁLCULO CRÍTICO: Costo (USD) * Cotización * Cantidad Vendida = Costo Final en Pesos
      const costoUnitarioUSD = mapCostoProducto[normalizeKey(prod)] || 0;
      const costoLineaARS = costoUnitarioUSD * dCotizacion * cantidad;

      if (punisiva > 0) {
        globalCliMap[cli] = (globalCliMap[cli] || 0) + punisiva;

        if (d) {
          // Rango de Calendario (Facturación y Costo)
          if ((!dDesde || d >= dDesde) && (!dHasta || d <= dHasta)) {
            fRango += punisiva;
            cRango += costoLineaARS;
          }

          if (d >= startOfWeek) {
            weeklyCliMap[cli] = (weeklyCliMap[cli] || 0) + punisiva;
            weeklyProdMap[prod] = (weeklyProdMap[prod] || 0) + punisiva;
          }
          if (d >= startOfMonth) {
            monthlyCliMap[cli] = (monthlyCliMap[cli] || 0) + punisiva;
            monthlyProdMap[prod] = (monthlyProdMap[prod] || 0) + punisiva;
          }

          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (mapMeses[key]) mapMeses[key].monto += punisiva;
        }
      }
    });

    const getTop5 = (map) =>
      Object.entries(map)
        .map(([n, v]) => ({ name: n, value: v }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    const rentabilidad = fRango - cRango;
    const margen = fRango > 0 ? (rentabilidad / fRango) * 100 : 0;

    return {
      facturacionRango: fRango,
      costoRango: cRango,
      rentabilidadRango: rentabilidad,
      margenRango: margen,
      facturacionMensualChart: Object.values(mapMeses),
      tops: {
        cliSemana: getTop5(weeklyCliMap),
        prodSemana: getTop5(weeklyProdMap),
        cliMes: getTop5(monthlyCliMap),
        prodMes: getTop5(monthlyProdMap),
        cliGlobal: Object.entries(globalCliMap)
          .map(([n, v]) => ({ name: n, value: v }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),
      },
    };
  }, [
    datosPedidos,
    datosRecetas,
    datosStock,
    fechaDesde,
    fechaHasta,
    valorDolar,
  ]);

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in max-w-[1600px] w-full mx-auto min-h-0">
      {/* HEADER DE ALERTAS Y WIDGET DE COTIZACIÓN */}
      <div className="flex justify-between items-center shrink-0 mb-[-12px]">
        <div className="flex-1">
          {facturacionRango === 0 && tops.cliGlobal.length === 0 && (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-3 shadow-sm inline-flex">
              <FaExclamationTriangle className="text-orange-500 text-base shrink-0" />
              No se registran montos en la columna "PUNISIVA".
            </div>
          )}
        </div>

        {/* WIDGET DÓLAR (SaaS Premium) */}
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-emerald-300">
          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-[9px]">
              U$S
            </span>
            Cotización Dólar
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-xs">
              $
            </span>
            <input
              type="number"
              value={valorDolar}
              onChange={handleDolarChange}
              className="w-24 pl-7 pr-2 py-1.5 bg-slate-50 border border-transparent rounded-xl text-sm font-black text-emerald-700 outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* FILA 1: KPIs FINANCIEROS Y TOPS (4 COLUMNAS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 shrink-0 h-40">
        {/* KPI FACTURACIÓN */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-40 relative group hover:border-blue-300 transition-all">
          <div className="flex justify-between items-start">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600 shadow-sm">
              <FaMoneyBillWave size={18} />
            </div>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="text-[10px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm group-hover:border-blue-300"
            >
              <FaCalendarAlt /> FILTRAR
            </button>
          </div>

          {showDatePicker && (
            <div className="absolute top-16 right-5 bg-white border border-slate-200 shadow-xl rounded-xl p-4 z-50 flex flex-col gap-3 w-64 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Rango Personalizado
                </span>
                <FaTimes
                  className="text-slate-400 cursor-pointer hover:text-rose-500"
                  onClick={() => setShowDatePicker(false)}
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                  Desde
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-blue-400 bg-slate-50"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                  Hasta
                </label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-blue-400 bg-slate-50"
                />
              </div>
              <button
                onClick={() => setShowDatePicker(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase py-2.5 rounded-lg mt-1 transition-colors shadow-md"
              >
                Aplicar Filtro
              </button>
            </div>
          )}

          <div className="mt-auto">
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
              Ingresos (Facturación)
            </h3>
            <div
              className="text-3xl font-extrabold text-slate-800 tracking-tight leading-none truncate"
              title={formatCurrency(facturacionRango)}
            >
              {formatCurrency(facturacionRango)}
            </div>
            <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest truncate flex items-center gap-1.5">
              <FaCalendarDay size={10} className="text-blue-400" />
              {fechaDesde && fechaHasta
                ? `DEL ${fechaDesde.split("-").reverse().join("/")} AL ${fechaHasta.split("-").reverse().join("/")}`
                : "HISTÓRICO COMPLETO"}
            </p>
          </div>
        </div>

        {/* KPI RENTABILIDAD */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-40 transition-all hover:border-emerald-300 hover:shadow-md">
          <div className="flex justify-between items-start">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 shadow-sm">
              <FaChartPie size={18} />
            </div>
            {facturacionRango > 0 && (
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border ${margenRango >= 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}
              >
                {margenRango >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                {Math.abs(margenRango).toFixed(1)}% MARGEN
              </span>
            )}
          </div>
          <div className="mt-auto">
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
              Rentabilidad Neta{" "}
              <InfoTooltip text="Ingresos menos costos de fabricación según las recetas configuradas y la cotización actual." />
            </h3>
            <div
              className={`text-3xl font-extrabold tracking-tight leading-none truncate ${rentabilidadRango >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              title={formatCurrency(rentabilidadRango)}
            >
              {formatCurrency(rentabilidadRango)}
            </div>
            <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest truncate flex items-center gap-1.5">
              <FaMinus size={10} className="text-rose-400" /> COSTO TOTAL ARS:{" "}
              {formatCurrency(costoRango)}
            </p>
          </div>
        </div>

        <MiniTopCard
          title="Top Clientes"
          weeklyData={tops.cliSemana}
          monthlyData={tops.cliMes}
          icon={<FaUserTie className="text-blue-500" />}
        />
        <MiniTopCard
          title="Top Productos"
          weeklyData={tops.prodSemana}
          monthlyData={tops.prodMes}
          icon={<FaTag className="text-indigo-500" />}
        />
      </div>

      {/* FILA 2: GRÁFICO Y TOP HISTÓRICO */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-6 min-h-[400px]">
        {/* GRÁFICO (2/3) */}
        <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h3 className="text-slate-800 font-bold text-base flex items-center gap-2">
              <FaChartLine className="text-emerald-500" /> Evolución de
              Facturación ($)
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
              Últimos 12 Meses
            </span>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={facturacionMensualChart}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickMargin={12}
                  minTickGap={20}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  width={45}
                  tickFormatter={(val) => formatCompactCurrency(val)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                  }}
                  itemStyle={{
                    color: "#1e293b",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                  formatter={(value) => [formatCurrency(value), "Facturación"]}
                />
                <Area
                  type="monotone"
                  dataKey="monto"
                  name="Facturación"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorMonto)"
                  activeDot={{ r: 5, strokeWidth: 0, fill: "#10B981" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TOP 10 GLOBAL (1/3) */}
        <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0 h-12">
            <h3 className="text-base font-bold text-slate-700 flex items-center gap-2">
              <FaTrophy className="text-yellow-500" /> Top 10 Clientes
            </h3>
          </div>

          <div className="flex-1 flex flex-col min-h-0 relative">
            <div className="absolute inset-0 flex flex-col">
              <div className="flex bg-white text-slate-500 uppercase font-semibold border-b border-slate-100 text-xs py-2 shrink-0">
                <div className="w-[15%] text-left pl-4">#</div>
                <div className="w-[45%] text-left pl-2">Cliente</div>
                <div className="w-[40%] text-right pr-4">Facturación</div>
              </div>

              <div className="flex-1 flex flex-col">
                {tops.cliGlobal.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">
                    Sin datos registrados
                  </div>
                ) : (
                  tops.cliGlobal.map((item, idx) => {
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex items-center hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 min-h-0"
                      >
                        <div className="w-[15%] text-left pl-4 shrink-0">
                          <RankIcon index={idx} />
                        </div>
                        <div
                          className="w-[45%] text-left font-medium text-slate-700 truncate pr-2 text-xs pl-2 uppercase"
                          title={item.name}
                        >
                          {item.name}
                        </div>
                        <div className="w-[40%] text-right font-mono text-emerald-600 font-bold text-xs pr-4 shrink-0">
                          {formatCompactCurrency(item.value)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- PÁGINA PRINCIPAL ---
export default function AnalisisPedidos() {
  const [datosPedidos, setDatosPedidos] = useState([]);
  const [datosRecetas, setDatosRecetas] = useState({});
  const [datosStock, setDatosStock] = useState([]);
  const [datosProductos, setDatosProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [view, setView] = useState("DASHBOARD");
  const [modoVista, setModoVista] = useState("PRODUCTOS");
  const [busqueda, setBusqueda] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [modalPage, setModalPage] = useState(1);
  const [historialFilter, setHistorialFilter] = useState("TODOS");
  const [incluirMesActual, setIncluirMesActual] = useState(false);
  const [chartResolution, setChartResolution] = useState("MENSUAL");
  const [incluirMesActualModal, setIncluirMesActualModal] = useState(false);
  const [showParetoModal, setShowParetoModal] = useState(false);

  const MODAL_ITEMS_PER_PAGE = 8;

  const cargarDatos = () => {
    setLoading(true);
    setErrorMsg(null);
    const t = Date.now();
    Promise.all([
      authFetch(`${PEDIDOS_API_URL}?t=${t}`).then(async (r) => {
        if (!r.ok) throw new Error(`Error Pedidos (${r.status})`);
        return r.json();
      }),
      authFetch(RECETAS_ALL_URL).then(async (r) => {
        if (!r.ok) throw new Error(`Error Recetas (${r.status})`);
        return r.json();
      }),
      authFetch(STOCK_SEMIS_URL).then(async (r) => {
        if (!r.ok) throw new Error(`Error Stock (${r.status})`);
        return r.json();
      }),
    ])
      .then(([pedidos, recetas, stock]) => {
        setDatosPedidos(pedidos || []);
        setDatosRecetas(recetas || {});
        setDatosStock(stock || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("❌ Error cargando datos:", error);
        setErrorMsg(error.message || "Error de conexión.");
        setLoading(false);
      });
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const analysisData = useMemo(() => {
    if (!datosPedidos || datosPedidos.length === 0) return null;
    const now = new Date();

    const last12Months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = d.toLocaleDateString("es-AR", { month: "short" });
      const yShort = d.getFullYear().toString().slice(-2);
      const label = `${mName.charAt(0).toUpperCase() + mName.slice(1)} ${yShort}`;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      last12Months.push({ label, key, total: 0 });
    }

    const getMonthIndex = (dateObj) => {
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
      return last12Months.findIndex((m) => m.key === key);
    };

    const normalizedRecetas = {};
    Object.keys(datosRecetas).forEach((key) => {
      normalizedRecetas[normalizeKey(key)] = datosRecetas[key];
    });

    const stockMap = {};
    datosStock.forEach((s) => {
      const key = normalizeKey(s.nombre);
      const sumaFila =
        Number(s.stock_planta_26 || 0) +
        Number(s.stock_planta_37 || 0) +
        Number(s.stock_deposito_ayolas || 0) +
        Number(s.stock_deposito_quintana || 0);
      stockMap[key] = Math.max(stockMap[key] || 0, sumaFila);
    });

    const uniqueOrders = new Set(),
      uniqueOpsGlobal = new Set();
    const prodMapY = {},
      cliMapY = {};
    const prodTrendMap = {},
      cliTrendMap = {};
    const activeClients = new Set(),
      allClients = new Set(),
      allModels = new Set();
    const consumoTotalPeriodo = {},
      missingRecipesMap = {};

    const weeklyMap = {};
    const currentMonthMap = {};

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    const day = startOfWeek.getDay();
    const diffToMonday = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diffToMonday);

    datosPedidos.forEach((row) => {
      const d = parseDate(row.fecha || row.FECHA || row.Fecha);
      if (!d) return;

      const idx = getMonthIndex(d);
      const isInWindow = idx !== -1;
      const estado = (row.estado || row.ESTADO || "").toString().toUpperCase();
      if (estado.includes("CANCELADO")) return;

      const cantVendida = parseCantidad(row.cantidad || row.CANTIDAD || 1);
      const prodName = row.modelo || row.MODELO || "Desconocido";
      const cliName = row.cliente || row.CLIENTE || "Desconocido";
      const oc = row.oc_cliente || row.OC || row.oc;
      const op = row.op || row.OP;
      const prodKey = normalizeKey(prodName);
      const cliKey = normalizeKey(cliName);

      const realName = modoVista === "PRODUCTOS" ? prodName : cliName;

      if (d >= startOfMonth) {
        if (!currentMonthMap[realName]) currentMonthMap[realName] = 0;
        currentMonthMap[realName] += cantVendida;
      }
      if (d >= startOfWeek) {
        if (!weeklyMap[realName]) weeklyMap[realName] = 0;
        weeklyMap[realName] += cantVendida;
      }

      if (isInWindow) {
        last12Months[idx].total++;
        if (oc && oc !== "-" && oc !== "0") uniqueOrders.add(oc);
        if (op && op !== "-" && op !== "0") uniqueOpsGlobal.add(op);

        if (cliName !== "Desconocido") {
          allClients.add(cliName);
          activeClients.add(cliName);
          cliMapY[cliKey] = (cliMapY[cliKey] || 0) + cantVendida;
          if (!cliTrendMap[cliKey]) cliTrendMap[cliKey] = Array(12).fill(0);
          cliTrendMap[cliKey][idx] += cantVendida;
        }

        if (prodName !== "Desconocido") {
          allModels.add(prodName);
          prodMapY[prodKey] = (prodMapY[prodKey] || 0) + cantVendida;
          if (!prodTrendMap[prodKey]) prodTrendMap[prodKey] = Array(12).fill(0);
          prodTrendMap[prodKey][idx] += cantVendida;

          const receta = normalizedRecetas[prodKey];
          if (receta && receta.length > 0) {
            receta.forEach((insumo) => {
              const insumoKey = normalizeKey(insumo.nombre);
              if (!consumoTotalPeriodo[insumoKey]) {
                consumoTotalPeriodo[insumoKey] = {
                  name: insumo.nombre,
                  total: 0,
                  months: Array(12).fill(0),
                  usedIn: {},
                  history: [],
                };
              }
              const cantidadConsumida = insumo.cantidad * cantVendida;
              consumoTotalPeriodo[insumoKey].total += cantidadConsumida;
              consumoTotalPeriodo[insumoKey].months[idx] += cantidadConsumida;
              if (!consumoTotalPeriodo[insumoKey].usedIn[prodName])
                consumoTotalPeriodo[insumoKey].usedIn[prodName] = 0;
              consumoTotalPeriodo[insumoKey].usedIn[prodName] +=
                cantidadConsumida;
              consumoTotalPeriodo[insumoKey].history.push({
                fecha: d.toLocaleDateString("es-AR"),
                cant: cantidadConsumida,
              });
            });
          } else {
            const causa = receta ? "Receta Vacía" : "Sin Receta";
            if (!missingRecipesMap[prodKey])
              missingRecipesMap[prodKey] = {
                name: prodName,
                count: 0,
                reason: causa,
              };
            missingRecipesMap[prodKey].count += cantVendida;
          }
        }
      }
    });

    const topWeeklyList = Object.entries(weeklyMap).sort((a, b) => b[1] - a[1]);
    const topMonthlyList = Object.entries(currentMonthMap).sort(
      (a, b) => b[1] - a[1],
    );

    const calculateTrendStatus = (history) => {
      if (!history) return "ESTABLE";
      const m1 = history[9] || 0;
      const m2 = history[10] || 0;

      const isGrowing = (prev, curr) =>
        prev === 0 ? curr > 0 : curr >= prev * 1.05;
      const isFalling = (prev, curr) =>
        prev === 0 ? false : curr <= prev * 0.95;

      if (isGrowing(m1, m2)) return "CRECIENDO";
      if (isFalling(m1, m2)) return "CAYENDO";
      return "ESTABLE";
    };

    const getTop = (map, trendMap, n) =>
      Object.entries(map)
        .map(([name, value]) => ({
          name,
          value,
          trendStatus: calculateTrendStatus(trendMap[name]),
          history: (trendMap[name] || Array(12).fill(0)).slice(0, -1),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, n);

    const calculateTop20Concentration = (map) => {
      const sorted = Object.entries(map)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const total = sorted.reduce((sum, item) => sum + item.value, 0);
      const topItemsRaw = sorted.slice(0, 20);
      const topSum = topItemsRaw.reduce((sum, item) => sum + item.value, 0);
      const percentage = total > 0 ? ((topSum / total) * 100).toFixed(1) : "0";

      const topItems = topItemsRaw.map((item) => ({
        ...item,
        percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0",
      }));

      return { percentage, totalItems: sorted.length, topItems };
    };

    const paretoProd = calculateTop20Concentration(prodMapY);
    const paretoCli = calculateTop20Concentration(cliMapY);
    const topProdY = getTop(prodMapY, prodTrendMap, 10);
    const topCliY = getTop(cliMapY, cliTrendMap, 10);

    const salesByMonth = last12Months.map((m) => ({
      mes: m.label,
      ventas: m.total,
    }));
    const recordMonth = [...salesByMonth].sort(
      (a, b) => b.ventas - a.ventas,
    )[0];

    let criticalItemsCount = 0;
    const consumoData = Object.values(consumoTotalPeriodo)
      .map((data) => {
        const stock = stockMap[normalizeKey(data.name)] || 0;
        const last6Months = data.months.slice(5, 11);
        const total6Months = last6Months.reduce((acc, val) => acc + val, 0);
        const promedioMensual = total6Months / 6;
        const promedioDiario = promedioMensual / 30;
        const diasRestantes =
          promedioDiario > 0 ? stock / promedioDiario : 9999;
        if (diasRestantes < 7) criticalItemsCount++;

        return {
          name: data.name,
          value: data.total,
          stock: stock,
          monthly: promedioMensual.toFixed(0),
          daily: promedioDiario.toFixed(2),
          daysLeft: diasRestantes === 9999 ? "∞" : diasRestantes.toFixed(1),
          daysLeftVal: diasRestantes,
          trend: 0,
          chartData: last12Months.map((m, i) => ({
            mes: m.label,
            consumo: data.months[i] || 0,
          })),
          usedInChart: Object.entries(data.usedIn)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
          history: data.history,
        };
      })
      .sort((a, b) => a.daysLeftVal - b.daysLeftVal);

    const missingData = Object.values(missingRecipesMap).sort(
      (a, b) => b.count - a.count,
    );
    const oneYearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const filteredRaw = datosPedidos.filter((row) => {
      const d = parseDate(row.fecha || row.FECHA || row.Fecha);
      return d && d >= oneYearAgo;
    });

    return {
      salesByMonth,
      totalOrders: uniqueOrders.size,
      totalOps: uniqueOpsGlobal.size,
      recordMonthName: recordMonth?.mes || "-",
      recordMax: recordMonth?.ventas || 1,
      raw: filteredRaw,
      prod: {
        y: topProdY,
        list: Array.from(allModels).sort(),
        pareto: paretoProd,
      },
      cli: {
        y: topCliY,
        active: activeClients.size,
        list: Array.from(allClients).sort(),
        pareto: paretoCli,
      },
      consumo: consumoData,
      criticalItemsCount,
      missingRecipes: missingData,
      momentum: {
        weeklyList: topWeeklyList,
        monthlyList: topMonthlyList,
      },
    };
  }, [datosPedidos, datosRecetas, datosStock, modoVista]);

  const mainChartData = useMemo(() => {
    if (!datosPedidos || datosPedidos.length === 0) return [];
    const now = new Date();
    const buckets = {};
    let labels = [];

    if (chartResolution === "DIARIA") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
        });
        const key = d.toISOString().split("T")[0];
        buckets[key] = 0;
        labels.push({ label, key });
      }
      datosPedidos.forEach((row) => {
        const d = parseDate(row.fecha || row.FECHA);
        if (!d) return;
        const key = d.toISOString().split("T")[0];
        if (
          buckets.hasOwnProperty(key) &&
          !row.estado?.toString().toUpperCase().includes("CANCELADO")
        ) {
          buckets[key] += 1;
        }
      });
    } else if (chartResolution === "SEMANAL") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const weekKey = getWeekNumber(d);
        const label = `Sem ${weekKey.split("-W")[1]}`;
        buckets[weekKey] = 0;
        labels.push({ label, key: weekKey });
      }
      datosPedidos.forEach((row) => {
        const d = parseDate(row.fecha || row.FECHA);
        if (!d) return;
        const key = getWeekNumber(d);
        if (
          buckets.hasOwnProperty(key) &&
          !row.estado?.toString().toUpperCase().includes("CANCELADO")
        ) {
          buckets[key] += 1;
        }
      });
    } else {
      if (!analysisData) return [];
      return incluirMesActual
        ? analysisData.salesByMonth
        : analysisData.salesByMonth.slice(0, -1);
    }
    return labels.map((l) => ({ mes: l.label, ventas: buckets[l.key] }));
  }, [datosPedidos, chartResolution, analysisData, incluirMesActual]);

  const handleSearch = (val) => {
    setBusqueda(val);
    if (val && analysisData) {
      const list =
        modoVista === "PRODUCTOS"
          ? analysisData.prod.list
          : analysisData.cli.list;
      setSugerencias(
        list.filter((i) => i.toLowerCase().includes(val.toLowerCase())),
      );
      setMostrarSugerencias(true);
    } else setMostrarSugerencias(false);
  };

  const selectItem = (name) => {
    setBusqueda("");
    setMostrarSugerencias(false);
    setModalPage(1);
    setHistorialFilter("TODOS");
    const rows = analysisData.raw.filter(
      (r) =>
        (modoVista === "PRODUCTOS"
          ? r.modelo || r.MODELO
          : r.cliente || r.CLIENTE) === name,
    );
    let total = 0;
    const pieMap = {};
    const now = new Date();
    const getMonthIndex = (d) => {
      const diffYears = now.getFullYear() - d.getFullYear();
      const diffMonths = now.getMonth() - d.getMonth();
      return 11 - (diffYears * 12 + diffMonths);
    };

    const aggregatedChart = new Array(12).fill(0);

    const history = rows
      .sort((a, b) => parseDate(b.fecha) - parseDate(a.fecha))
      .map((r) => {
        const cant = parseCantidad(r.cantidad || r.CANTIDAD || 1);
        total += cant;
        const key =
          modoVista === "CLIENTES"
            ? r.modelo || r.MODELO
            : r.cliente || r.CLIENTE;
        pieMap[key] = (pieMap[key] || 0) + cant;
        const d = parseDate(r.fecha || r.FECHA);
        const mIndex = d ? getMonthIndex(d) : -1;

        if (mIndex >= 0 && mIndex < 12) {
          aggregatedChart[mIndex] += cant;
        }

        return {
          fecha: d ? d.toLocaleDateString("es-AR") : "-",
          col: key,
          cant,
          oc: r.oc_cliente || r.OC || "-",
          op: r.op || r.OP || "-",
          isML: (r.detalles || r.DETALLES || "")
            .toString()
            .toLowerCase()
            .includes("mercadolibre"),
          monthIndex: mIndex,
        };
      });

    const last3Closed = aggregatedChart.slice(8, 11);
    const sum3Months = last3Closed.reduce((sum, val) => sum + val, 0);
    const promedio3Meses = Math.round(sum3Months / 3);

    const m1 = aggregatedChart[9];
    const m2 = aggregatedChart[10];

    const isGrowing = (prev, curr) =>
      prev === 0 ? curr > 0 : curr >= prev * 1.05;
    const isFalling = (prev, curr) =>
      prev === 0 ? false : curr <= prev * 0.95;

    let tendenciaStatus = "ESTABLE";

    if (isGrowing(m1, m2)) {
      tendenciaStatus = "CRECIENDO";
    } else if (isFalling(m1, m2)) {
      tendenciaStatus = "CAYENDO";
    }

    setSelectedItem({
      name,
      total,
      pie: Object.entries(pieMap)
        .map(([n, v]) => ({ name: n, value: v }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      history,
      last: history[0]?.fecha,
      salesChart: [],
      promedio3Meses,
      tendenciaStatus,
    });
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-full text-blue-500 text-2xl">
        <FaSpinner className="animate-spin mr-3" />
      </div>
    );
  if (errorMsg)
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-rose-500 p-6">
        <FaExclamationTriangle className="text-5xl mb-4" />
        <h3 className="text-xl font-bold mb-2">Error de Carga</h3>
        <p className="text-slate-600 mb-6 max-w-md">{errorMsg}</p>
        <button
          onClick={cargarDatos}
          className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center gap-2"
        >
          <FaSync /> Reintentar
        </button>
      </div>
    );
  if (!analysisData)
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
        <FaExclamationTriangle className="text-5xl mb-4 opacity-30" />
        <h3 className="text-xl font-bold mb-2">Sin Datos</h3>
        <button
          onClick={cargarDatos}
          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex items-center gap-2"
        >
          <FaSync /> Recargar
        </button>
      </div>
    );

  const isCli = modoVista === "CLIENTES";
  const data = isCli ? analysisData.cli : analysisData.prod;
  const lastMonthData = analysisData.salesByMonth[
    analysisData.salesByMonth.length - 1
  ] || { ventas: 0, mes: "-" };
  const prevMonthData = analysisData.salesByMonth[
    analysisData.salesByMonth.length - 2
  ] || { ventas: 0 };
  const promedioMensual = Math.round(analysisData.totalOps / 12);
  const projectedValue =
    lastMonthData.ventas > 0
      ? Math.round(
          (lastMonthData.ventas / new Date().getDate()) *
            new Date(
              new Date().getFullYear(),
              new Date().getMonth() + 1,
              0,
            ).getDate(),
        )
      : promedioMensual;

  let modalHistory = [],
    totalPages = 0,
    dynamicChartData = [];
  if (selectedItem) {
    const filtered = selectedItem.history.filter((h) =>
      historialFilter === "TODOS"
        ? true
        : historialFilter === "SIN_ML"
          ? !h.isML
          : h.isML,
    );
    totalPages = Math.ceil(filtered.length / MODAL_ITEMS_PER_PAGE);
    modalHistory = filtered.slice(
      (modalPage - 1) * MODAL_ITEMS_PER_PAGE,
      modalPage * MODAL_ITEMS_PER_PAGE,
    );
    const aggregatedChart = new Array(12).fill(0);
    filtered.forEach((h) => {
      if (h.monthIndex >= 0 && h.monthIndex < 12)
        aggregatedChart[h.monthIndex] += h.cant;
    });
    const fullChartData = analysisData.salesByMonth.map((m, i) => ({
      mes: m.mes,
      ventas: aggregatedChart[i],
    }));
    dynamicChartData = incluirMesActualModal
      ? fullChartData
      : fullChartData.slice(0, -1);
  }

  const paretoInfo = data.pareto;

  const generarPDF = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString("es-AR");
    const hora = new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const tipo = isCli ? "CLIENTES" : "PRODUCTOS";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("GESTION MRP", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(`REPORTE DE RENDIMIENTO - ${tipo}`, 105, 27, { align: "center" });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(10);
    let startY = 40;

    doc.setFont("helvetica", "bold");
    doc.text("Desde", 14, startY);
    doc.setFont("helvetica", "normal");
    doc.text("Producción - Gestión MRP", 45, startY);

    doc.setFont("helvetica", "bold");
    doc.text("Para", 14, startY + 7);
    doc.setFont("helvetica", "normal");
    doc.text("Gerencia / Directorio", 45, startY + 7);

    doc.setFont("helvetica", "bold");
    doc.text("Documento", 130, startY);
    doc.setFont("helvetica", "normal");
    doc.text("RPT-REND-01", 160, startY);

    doc.setFont("helvetica", "bold");
    doc.text("Fecha", 130, startY + 7);
    doc.setFont("helvetica", "normal");
    doc.text(fecha, 160, startY + 7);

    doc.setFont("helvetica", "bold");
    doc.text("Hora", 130, startY + 14);
    doc.setFont("helvetica", "normal");
    doc.text(hora, 160, startY + 14);

    doc.setLineWidth(0.2);
    doc.line(14, startY + 22, 196, startY + 22);

    startY += 32;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Resumen Ejecutivo", 14, startY);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, startY + 5, 182, 22, 3, 3, "FD");

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    doc.setFont("helvetica", "bold");
    doc.text("Promedio Mensual:", 20, startY + 14);
    doc.setFont("helvetica", "normal");
    doc.text(`${promedioMensual.toLocaleString()} pedidos`, 55, startY + 14);

    doc.setFont("helvetica", "bold");
    doc.text("Proyección del Mes:", 105, startY + 14);
    doc.setFont("helvetica", "normal");
    doc.text(`~${projectedValue.toLocaleString()} pedidos`, 145, startY + 14);

    doc.setFont("helvetica", "bold");
    doc.text("Concentración T20:", 20, startY + 23);
    doc.setFont("helvetica", "normal");
    doc.text(`${paretoInfo.percentage}% de los pedidos`, 55, startY + 23);

    doc.setFont("helvetica", "bold");
    doc.text("Mes Récord:", 105, startY + 23);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${analysisData.recordMonthName} (${analysisData.recordMax.toLocaleString()} pedidos)`,
      145,
      startY + 23,
    );

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(14, startY + 35, 196, startY + 35);

    startY += 45;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");

    doc.text("Clasificación Histórica (Top 10)", 14, startY);
    doc.text("Evolución Mensual (12 Meses)", 110, startY);

    autoTable(doc, {
      startY: startY + 5,
      head: [["Pos", tipo, "Volumen"]],
      body: data.y
        .slice(0, 10)
        .map((item, index) => [
          `${index + 1}`,
          item.name,
          item.value.toLocaleString(),
        ]),
      theme: "plain",
      headStyles: {
        fontStyle: "bold",
        lineWidth: { top: 0, bottom: 0.2, left: 0, right: 0 },
        lineColor: [0, 0, 0],
      },
      bodyStyles: { textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 10 },
        2: { cellWidth: 25, halign: "right" },
      },
      margin: { right: 110, left: 14 },
    });

    autoTable(doc, {
      startY: startY + 5,
      head: [["Mes", "Pedidos"]],
      body: [...analysisData.salesByMonth]
        .reverse()
        .map((m) => [m.mes, m.ventas.toLocaleString()]),
      theme: "plain",
      headStyles: {
        fontStyle: "bold",
        lineWidth: { top: 0, bottom: 0.2, left: 0, right: 0 },
        lineColor: [0, 0, 0],
      },
      bodyStyles: { textColor: [0, 0, 0] },
      columnStyles: {
        1: { cellWidth: 25, halign: "right" },
      },
      margin: { left: 110, right: 14 },
    });

    let nextY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Rendimiento Reciente (Top 5)", 14, nextY);

    autoTable(doc, {
      startY: nextY + 5,
      head: [["Top 5 del Mes", "Volumen"]],
      body: analysisData.momentum.monthlyList
        .slice(0, 5)
        .map((item, i) => [`#${i + 1} ${item[0]}`, item[1].toLocaleString()]),
      theme: "plain",
      headStyles: {
        fontStyle: "bold",
        lineWidth: { top: 0, bottom: 0.2, left: 0, right: 0 },
        lineColor: [0, 0, 0],
      },
      columnStyles: { 1: { cellWidth: 25, halign: "right" } },
      margin: { right: 110, left: 14 },
    });

    autoTable(doc, {
      startY: nextY + 5,
      head: [["Top 5 de la Semana", "Volumen"]],
      body: analysisData.momentum.weeklyList
        .slice(0, 5)
        .map((item, i) => [`#${i + 1} ${item[0]}`, item[1].toLocaleString()]),
      theme: "plain",
      headStyles: {
        fontStyle: "bold",
        lineWidth: { top: 0, bottom: 0.2, left: 0, right: 0 },
        lineColor: [0, 0, 0],
      },
      columnStyles: { 1: { cellWidth: 25, halign: "right" } },
      margin: { left: 110, right: 14 },
    });

    doc.save(`Reporte_Métricas_${tipo}_${fecha.replace(/\//g, "")}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] text-slate-800 overflow-hidden">
      {/* 1. TOP HEADER */}
      <div className="bg-white border-b border-slate-100 px-8 py-6 flex-none z-10 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Métricas de Negocio
              </h1>
              <div className="flex items-center gap-1.5 bg-emerald-50/80 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-100 text-[10px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Actualizado hoy
              </div>
            </div>
            {/* Tabs sutiles */}
            <div className="flex items-center gap-1 p-1 bg-slate-100/50 rounded-xl w-fit">
              {[
                { id: "DASHBOARD", label: "Productos Terminados" },
                { id: "CONSUMO", label: "Semielaborados" },
                { id: "FINANCIERO", label: "Financiero" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${view === tab.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {view === "DASHBOARD" && (
              <>
                <div className="w-64 h-[38px]">
                  <SearchBar
                    busqueda={busqueda}
                    onSearch={handleSearch}
                    mostrarSugerencias={mostrarSugerencias}
                    sugerencias={sugerencias}
                    onSelect={selectItem}
                    isCli={isCli}
                  />
                </div>

                <button
                  onClick={() => setModoVista(isCli ? "PRODUCTOS" : "CLIENTES")}
                  className="h-[38px] px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:cursor-pointer transition-colors text-xs shadow-sm flex items-center justify-center gap-2"
                >
                  {isCli ? (
                    <FaCubes className="text-slate-400" size={13} />
                  ) : (
                    <FaUsers className="text-slate-400" size={13} />
                  )}
                  {isCli ? "Ver Productos" : "Ver Clientes"}
                </button>

                <button
                  onClick={generarPDF}
                  className="h-[38px] px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-blue-200 hover:cursor-pointer transition-colors text-xs shadow-sm flex items-center justify-center gap-2"
                >
                  <FaFilePdf size={13} /> Reporte
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL ORIGINAL CERO SCROLL */}
      <div className="flex-1 overflow-hidden p-8 flex flex-col gap-8 bg-slate-50/50">
        {view === "FINANCIERO" && (
          <FinancieroView
            datosPedidos={datosPedidos}
            datosRecetas={datosRecetas}
            datosStock={datosStock}
            datosProductos={datosProductos}
          />
        )}

        {view === "DASHBOARD" && (
          <div className="flex flex-col gap-8 h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 shrink-0 h-40">
              <StatCard
                title={isCli ? "Clientes Activos" : "Pedidos Mensuales"}
                value={promedioMensual}
                subtext="Promedio últimos 12 meses"
                trend={5}
                icon={isCli ? <FaUsers size={16} /> : <FaBox size={16} />}
                colorClass={{ bg: "bg-blue-50", text: "text-blue-600" }}
              />

              <TopRecentCard
                weeklyData={analysisData.momentum.weeklyList}
                monthlyData={analysisData.momentum.monthlyList}
              />

              <StatCard
                title="Concentración Top 20"
                value={`${paretoInfo.percentage}%`}
                subtext={`Generado por los 20 mejores`}
                icon={<FaChartPie size={16} />}
                colorClass={{ bg: "bg-indigo-50", text: "text-indigo-600" }}
                onClick={() => setShowParetoModal(true)}
                isClickable={true}
              />

              <StatCard
                title="Líder del Año"
                value={data.y[0]?.name || "-"}
                subtext={`${data.y[0]?.value || 0} acumuladas`}
                icon={<FaTrophy size={16} />}
                colorClass={{ bg: "bg-yellow-50", text: "text-yellow-600" }}
              />
            </div>

            <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-6 min-h-[400px]">
              <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-center mb-6 shrink-0">
                  <h3 className="text-slate-800 font-bold text-base flex items-center gap-2">
                    <FaChartLine className="text-blue-500" /> Evolución de
                    Pedidos
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIncluirMesActual(!incluirMesActual)}
                      className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded-md hover:bg-slate-100"
                    >
                      {incluirMesActual ? <FaEye /> : <FaEyeSlash />}
                    </button>
                    <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                      {["DIARIA", "SEMANAL", "MENSUAL"].map((t) => (
                        <button
                          key={t}
                          onClick={() => setChartResolution(t)}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${chartResolution === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                        >
                          {t === "DIARIA"
                            ? "Día"
                            : t === "SEMANAL"
                              ? "Sem"
                              : "Mes"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={mainChartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
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
                            stopColor="#2563EB"
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor="#2563EB"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="mes"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickMargin={12}
                        minTickGap={30}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                        }}
                        itemStyle={{
                          color: "#1e293b",
                          fontWeight: "bold",
                          fontSize: "12px",
                        }}
                        formatter={(value) => [value, "Pedidos"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="ventas"
                        name="Pedidos"
                        stroke="#2563EB"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorVentas)"
                        activeDot={{ r: 5, strokeWidth: 0, fill: "#2563EB" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="xl:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0 h-12">
                  <h3 className="text-base font-bold text-gray-700 flex items-center gap-2">
                    <FaListOl className="text-blue-600" /> Top 10 Global
                  </h3>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative">
                  <div className="absolute inset-0 flex flex-col">
                    <div className="flex bg-white text-gray-500 uppercase font-semibold border-b border-gray-100 text-xs py-2 shrink-0">
                      <div className="w-[15%] text-left pl-4">#</div>
                      <div className="w-[45%] text-left pl-2">Nombre</div>
                      <div className="w-[20%] text-right pr-2">Vol</div>
                      <div className="w-[20%] text-right pr-4 flex items-center justify-end gap-1">
                        Trend{" "}
                        <InfoTooltip text="Evaluación basada en variaciones del 5% en los últimos 2 meses cerrados." />
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                      {data.y.slice(0, 10).map((item, idx) => (
                        <div
                          key={idx}
                          className="flex-1 flex items-center hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 min-h-0"
                        >
                          <div className="w-[15%] text-left pl-4 shrink-0">
                            <RankIcon index={idx} />
                          </div>
                          <div
                            className="w-[45%] text-left font-medium text-gray-700 truncate pr-2 text-xs pl-2"
                            title={item.name}
                          >
                            {item.name}
                          </div>
                          <div className="w-[20%] text-right font-mono text-indigo-600 font-bold text-xs pr-2">
                            {item.value}
                          </div>
                          <div className="w-[20%] text-right pr-4 shrink-0">
                            <TrendWidget status={item.trendStatus} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "CONSUMO" && <ConsumptionView analysisData={analysisData} />}
      </div>

      {selectedItem && (
        <DetailModal
          selectedItem={selectedItem}
          isCli={isCli}
          dynamicChartData={dynamicChartData}
          modalHistory={modalHistory}
          modalPage={modalPage}
          setModalPage={setModalPage}
          totalPages={totalPages}
          historialFilter={historialFilter}
          setHistorialFilter={setHistorialFilter}
          setSelectedItem={setSelectedItem}
          COLORS={COLORS}
          showCurrentMonth={incluirMesActualModal}
          setShowCurrentMonth={setIncluirMesActualModal}
        />
      )}

      <ParetoModal
        isOpen={showParetoModal}
        onClose={() => setShowParetoModal(false)}
        data={paretoInfo}
        isCli={isCli}
      />
    </div>
  );
}
