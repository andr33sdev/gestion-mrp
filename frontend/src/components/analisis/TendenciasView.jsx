import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  FaFire,
  FaChartLine,
  FaAnchor,
  FaRocket,
  FaSpinner,
  FaArrowUp,
  FaArrowDown,
  FaSnowflake,
  FaGem,
  FaCalendarDay,
  FaExpandAlt,
  FaTimes,
  FaInfoCircle,
  FaFilePdf,
} from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../../utils";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- COMPONENTES AUXILIARES ---

// Mini gráfico para celdas
const Sparkline = ({ data, color, id }) => (
  <div className="h-10 w-24">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data.map((v, i) => ({ val: v, i }))}>
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="val"
          stroke={color}
          fill={`url(#grad-${id})`}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

// Tooltip de ayuda
const InfoTooltip = ({ text }) => (
  <div className="group relative inline-block ml-2 cursor-help">
    <FaInfoCircle className="text-gray-500 hover:text-blue-400 text-xs" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-gray-300 text-[10px] rounded shadow-xl border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
      {text}
    </div>
  </div>
);

// Modal de Lista Completa
const ListModal = ({ title, data, type, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 w-full max-w-4xl h-[80vh] rounded-2xl border border-slate-600 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700 bg-slate-900 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            {type === "fire" && <FaFire className="text-orange-500" />}
            {type === "rocket" && <FaRocket className="text-orange-400" />}
            {type === "stable" && <FaAnchor className="text-blue-400" />}
            {type === "cold" && <FaSnowflake className="text-cyan-400" />}
            {title}{" "}
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({data.length} items)
            </span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <FaTimes size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="text-xs text-gray-500 uppercase bg-slate-800 sticky top-0 z-10">
              <tr>
                <th className="p-3 border-b border-slate-700">#</th>
                <th className="p-3 border-b border-slate-700">Modelo</th>
                <th className="p-3 border-b border-slate-700 text-center">
                  Indicador
                </th>
                <th className="p-3 border-b border-slate-700 text-center">
                  Evolución
                </th>
                <th className="p-3 border-b border-slate-700 text-right">
                  Último Valor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.map((p, i) => (
                <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                  <td className="p-3 text-gray-500 font-mono">{i + 1}</td>
                  <td className="p-3 font-bold text-white">{p.modelo}</td>
                  <td className="p-3 text-center">
                    {type === "fire" && (
                      <span className="text-green-400 text-xs font-bold bg-green-900/20 px-2 py-1 rounded">
                        +{p.pendiente.toFixed(1)} Tendencia
                      </span>
                    )}
                    {type === "rocket" && (
                      <span className="text-orange-400 text-xs font-bold bg-orange-900/20 px-2 py-1 rounded">
                        +{p.crecimiento}% Semanal
                      </span>
                    )}
                    {type === "stable" && (
                      <span className="text-blue-400 text-xs font-bold bg-blue-900/20 px-2 py-1 rounded">
                        CV {p.estabilidad.toFixed(2)}
                      </span>
                    )}
                    {type === "cold" && (
                      <span className="text-red-400 text-xs font-bold bg-red-900/20 px-2 py-1 rounded">
                        {p.pendiente.toFixed(1)} Caída
                      </span>
                    )}
                  </td>
                  <td className="p-3 flex justify-center">
                    <Sparkline
                      data={p.historia || []}
                      color={
                        type === "cold"
                          ? "#06b6d4"
                          : type === "stable"
                          ? "#3b82f6"
                          : "#f97316"
                      }
                      id={`modal-${type}-${i}`}
                    />
                  </td>
                  <td className="p-3 text-right font-mono text-gray-300">
                    {type === "rocket"
                      ? `${p.actual} u. (4 sem)`
                      : `${p.ultimo_valor || 0} u. (mes)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default function TendenciasView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/analisis/tendencias`);
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Función para generar PDF del Dashboard
  const generarReportePDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString("es-AR");

    // Encabezado
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE TENDENCIAS DE VENTA", 14, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generado: ${fecha}`, 150, 16);

    // KPIS
    doc.setTextColor(0, 0, 0);
    doc.text(`Proyección Global: ${data.proyeccion_global} u.`, 14, 35);
    doc.text(`MercadoLibre Share: ${data.ml_share}%`, 14, 40);
    doc.text(
      `Progreso Mes: ${data.mtd?.progreso_porcentaje}% vs mes anterior`,
      14,
      45
    );

    // Tablas resumidas
    const generarTabla = (titulo, datos, yStart) => {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(titulo, 14, yStart);
      const body = datos
        .slice(0, 10)
        .map((d) => [d.modelo, d.ultimo_valor || d.actual]);
      autoTable(doc, {
        startY: yStart + 2,
        head: [["Modelo", "Último Valor"]],
        body: body,
        theme: "striped",
        styles: { fontSize: 9 },
        margin: { left: 14 },
      });
      return doc.lastAutoTable.finalY + 10;
    };

    let y = 55;
    if (data.on_fire?.length > 0)
      y = generarTabla("Crecimiento Sostenido (Top 10)", data.on_fire, y);
    if (data.cooling_down?.length > 0)
      y = generarTabla("Productos en Enfriamiento", data.cooling_down, y);
    if (data.estables?.length > 0)
      y = generarTabla("Productos Estables", data.estables, y);

    doc.save(`Tendencias_${fecha.replace(/\//g, "-")}.pdf`);
  };

  if (loading)
    return (
      <div className="p-20 flex justify-center text-blue-500">
        <FaSpinner className="animate-spin text-4xl" />
      </div>
    );
  if (!data)
    return (
      <div className="p-10 text-center text-gray-400">Cargando análisis...</div>
    );

  // Destructuring seguro (Evita pantallas blancas si falla backend)
  const {
    on_fire = [],
    estables = [],
    aceleracion = [],
    cooling_down = [],
    grafico_global = [],
    proyeccion_global = 0,
    ml_share = 0,
    mtd = {
      actual: 0,
      anterior_mismo_dia: 0,
      anterior_total: 0,
      progreso_porcentaje: 0,
    },
  } = data;

  // Helpers de renderizado para las cards
  const renderHeader = (title, icon, colorText, type, tooltip) => (
    <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <div
          className={`p-2 rounded-lg bg-${colorText}-500/10 text-${colorText}-400`}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-white font-bold text-sm flex items-center">
            {title} <InfoTooltip text={tooltip} />
          </h3>
        </div>
      </div>
      <button
        onClick={() => setModalOpen(type)}
        className="text-xs flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
      >
        Ver todo <FaExpandAlt />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      {/* BARRA SUPERIOR: TÍTULO Y EXPORTAR */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <FaChartLine className="text-blue-500" /> Centro de Inteligencia
        </h2>
        <button
          onClick={generarReportePDF}
          className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-600 transition-colors"
        >
          <FaFilePdf className="text-red-500" /> Reporte PDF
        </button>
      </div>

      {/* 1. KPIs GLOBALES (TERMÓMETRO + ML) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Termómetro MTD */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden group">
          <div className="flex flex-col justify-between h-full gap-4">
            <div>
              <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
                <FaCalendarDay /> Progreso Mensual (MTD)
              </h3>
              <div className="text-4xl font-extrabold text-white flex items-baseline gap-3">
                {mtd.actual}{" "}
                <span className="text-lg font-normal text-gray-500">
                  unidades
                </span>
                <span
                  className={`text-sm px-2 py-1 rounded-full font-bold flex items-center gap-1 ${
                    mtd.progreso_porcentaje >= 0
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {mtd.progreso_porcentaje > 0 ? "+" : ""}
                  {mtd.progreso_porcentaje}%
                  {mtd.progreso_porcentaje >= 0 ? (
                    <FaArrowUp size={10} />
                  ) : (
                    <FaArrowDown size={10} />
                  )}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Vs mes anterior al mismo día ({mtd.anterior_mismo_dia} u.)
              </p>
            </div>
            <div className="w-full">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Hoy ({new Date().getDate()})</span>
                <span>Objetivo Mes Pasado ({mtd.anterior_total})</span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden relative">
                <div
                  className="absolute top-0 left-0 h-full bg-slate-600/50 pattern-diagonal-lines"
                  style={{
                    width: `${Math.min(
                      (mtd.anterior_mismo_dia / mtd.anterior_total) * 100,
                      100
                    )}%`,
                  }}
                ></div>
                <div
                  className={`h-full transition-all duration-1000 ${
                    mtd.progreso_porcentaje >= 0
                      ? "bg-blue-500"
                      : "bg-yellow-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      (mtd.actual / mtd.anterior_total) * 100,
                      100
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* MercadoLibre Share y Proyección */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl flex flex-col justify-center">
            <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">
              MercadoLibre
            </h3>
            <div className="text-3xl font-extrabold text-yellow-400 flex items-center gap-2">
              {ml_share}% <FaRocket className="text-2xl opacity-50" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Dependencia de venta online
            </p>
          </div>
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl flex flex-col justify-center">
            <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">
              Proyección Total
            </h3>
            <div className="text-3xl font-extrabold text-blue-400">
              {proyeccion_global} u.
            </div>
            <p className="text-xs text-gray-500 mt-1">Estimado cierre de mes</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* A. CRECIMIENTO SOSTENIDO */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col h-full">
          {renderHeader(
            "Crecimiento Sostenido",
            <FaChartLine />,
            "green",
            "fire",
            "Productos con pendiente de venta positiva y constante en los últimos 6 meses (excluyendo mes actual)."
          )}
          <div className="flex-1 p-2">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-700/30">
                {on_fire.slice(0, 5).map((p, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="py-3 pl-2">
                      <div
                        className="font-bold text-white text-sm truncate w-28"
                        title={p.modelo}
                      >
                        {p.modelo}
                      </div>
                      <div className="text-xs text-green-400 flex items-center gap-1">
                        <FaArrowUp size={8} /> Trend +{p.pendiente.toFixed(1)}
                      </div>
                    </td>
                    <td className="py-3 flex justify-center">
                      <Sparkline
                        data={p.historia}
                        color="#22c55e"
                        id={`g-${i}`}
                      />
                    </td>
                    <td className="py-3 text-right pr-2">
                      <div className="font-mono text-white font-bold">
                        {p.ultimo_valor}
                      </div>
                      <div className="text-[9px] text-gray-500">Último Mes</div>
                    </td>
                  </tr>
                ))}
                {on_fire.length === 0 && (
                  <tr>
                    <td
                      colSpan="3"
                      className="text-center py-8 text-gray-500 text-xs"
                    >
                      Sin tendencias alcistas claras.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* B. ACELERACIÓN */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col h-full">
          {renderHeader(
            "Explosión Reciente",
            <FaRocket />,
            "orange",
            "rocket",
            "Productos que aumentaron su venta >20% en las últimas 4 semanas comparado con las 4 anteriores."
          )}
          <div className="flex-1 p-2">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-700/30">
                {aceleracion.slice(0, 5).map((p, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="py-3 pl-2">
                      <div
                        className="font-bold text-white text-sm truncate w-28"
                        title={p.modelo}
                      >
                        {p.modelo}
                      </div>
                      <div className="text-xs text-orange-400 font-bold">
                        +{p.crecimiento}%
                      </div>
                    </td>
                    <td className="py-3 flex justify-center">
                      <Sparkline
                        data={p.historia}
                        color="#f97316"
                        id={`a-${i}`}
                      />
                    </td>
                    <td className="py-3 text-right pr-2">
                      <div className="font-mono text-white font-bold">
                        {p.actual}
                      </div>
                      <div className="text-[9px] text-gray-500">4 Semanas</div>
                    </td>
                  </tr>
                ))}
                {aceleracion.length === 0 && (
                  <tr>
                    <td
                      colSpan="3"
                      className="text-center py-8 text-gray-500 text-xs"
                    >
                      Demanda estable sin picos recientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* C. ESTABLES */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col h-full">
          {renderHeader(
            "Venta Estable",
            <FaAnchor />,
            "blue",
            "stable",
            "Productos con bajo coeficiente de variación (CV). Ventas constantes y predecibles."
          )}
          <div className="flex-1 p-2">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-700/30">
                {estables.slice(0, 5).map((p, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="py-3 pl-2">
                      <div
                        className="font-bold text-gray-300 text-sm truncate w-28"
                        title={p.modelo}
                      >
                        {p.modelo}
                      </div>
                      <div className="text-xs text-blue-400">
                        CV {p.estabilidad.toFixed(2)}
                      </div>
                    </td>
                    <td className="py-3 flex justify-center">
                      <Sparkline
                        data={p.historia}
                        color="#3b82f6"
                        id={`s-${i}`}
                      />
                    </td>
                    <td className="py-3 text-right pr-2">
                      <div className="font-mono text-white font-bold">
                        ~{(p.total / 6).toFixed(0)}
                      </div>
                      <div className="text-[9px] text-gray-500">Prom/Mes</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. COOLING DOWN (REDISEÑADO) */}
      {cooling_down.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <FaSnowflake className="text-cyan-400" /> Productos en
              Enfriamiento{" "}
              <InfoTooltip text="Productos con pendiente negativa sostenida. Ventas cayendo mes a mes." />
            </h3>
            <button
              onClick={() => setModalOpen("cold")}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
              Ver todos <FaExpandAlt />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cooling_down.slice(0, 6).map((p, i) => {
              const maxVal = Math.max(...p.historia);
              const currentVal = p.ultimo_mes_cerrado || 0;
              const dropPercent =
                maxVal > 0
                  ? Math.round(((maxVal - currentVal) / maxVal) * 100)
                  : 0;

              return (
                <div
                  key={i}
                  className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 flex items-center justify-between hover:border-cyan-500/30 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div
                      className="text-sm font-bold text-gray-300 truncate"
                      title={p.modelo}
                    >
                      {p.modelo}
                    </div>
                    <div className="text-xs text-cyan-500 flex items-center gap-1 mt-1">
                      <FaArrowDown size={10} /> Pendiente{" "}
                      {p.pendiente.toFixed(1)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end w-24">
                    <div className="flex gap-1 h-8 items-end">
                      {p.historia.slice(-6).map((h, idx) => (
                        <div
                          key={idx}
                          className={`w-1.5 rounded-t-sm ${
                            idx === 5 ? "bg-cyan-500" : "bg-slate-600"
                          }`}
                          style={{
                            height: `${Math.max(10, (h / maxVal) * 100)}%`,
                          }}
                        ></div>
                      ))}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      -{dropPercent}% vs pico
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. GRÁFICO GLOBAL */}
      <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg h-[350px]">
        <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
          <FaChartLine /> Evolución de Ventas (12 Meses)
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={grafico_global}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorML" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#facc15" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="mes_nombre"
              stroke="#64748b"
              fontSize={12}
              tickMargin={10}
            />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                borderColor: "#475569",
                color: "#fff",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "20px" }} />
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={false}
            />
            <Area
              type="monotone"
              dataKey="total"
              name="Venta Total"
              stroke="#8b5cf6"
              strokeWidth={3}
              fill="url(#colorTotal)"
            />
            <Area
              type="monotone"
              dataKey="ml"
              name="MercadoLibre"
              stroke="#facc15"
              strokeWidth={3}
              fill="url(#colorML)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <ListModal
            title={
              modalOpen === "fire"
                ? "Crecimiento Sostenido"
                : modalOpen === "rocket"
                ? "Aceleración Reciente"
                : modalOpen === "stable"
                ? "Venta Estable"
                : "En Enfriamiento"
            }
            type={modalOpen}
            data={
              modalOpen === "fire"
                ? on_fire
                : modalOpen === "rocket"
                ? aceleracion
                : modalOpen === "stable"
                ? estables
                : cooling_down
            }
            onClose={() => setModalOpen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
