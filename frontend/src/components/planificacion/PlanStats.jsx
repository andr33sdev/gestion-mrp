import React from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  FaTimes,
  FaChartPie,
  FaTrophy,
  FaLayerGroup,
  FaPercentage,
} from "react-icons/fa";

export default function PlanStats({ items, operarios, onClose }) {
  // --- 1. CÁLCULOS GLOBALES ---
  const totalMeta = items.reduce((acc, i) => acc + Number(i.cantidad), 0);
  const totalHecho = items.reduce((acc, i) => acc + Number(i.producido), 0);
  const porcentajeGlobal =
    totalMeta > 0 ? ((totalHecho / totalMeta) * 100).toFixed(1) : 0;

  // --- 2. PREPARACIÓN DATOS GRÁFICO BARRAS (AVANCE) ---
  const dataAvance = items.map((i) => {
    const hecho = Number(i.producido);
    const meta = Number(i.cantidad);
    const falta = Math.max(0, meta - hecho);
    const pct = meta > 0 ? (hecho / meta) * 100 : 0;

    return {
      name: i.semielaborado.nombre,
      codigo: i.semielaborado.codigo,
      Hecho: hecho,
      Falta: falta,
      Meta: meta,
      pct: pct,
      isComplete: hecho >= meta,
    };
  });

  // --- 3. PREPARACIÓN DATOS OPERARIOS (TORTA) ---
  const dataOperarios = operarios.map((op) => ({
    name: op.nombre,
    value: Number(op.total_producido),
  }));

  const COLORS_PIE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-900 w-full max-w-5xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* HEADER */}
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaChartPie className="text-purple-500" /> Estadísticas del Plan
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {/* --- SECCIÓN 1: KPIs GLOBALES (TARJETAS) --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex items-center gap-4">
              <div className="p-3 bg-blue-900/30 rounded-lg text-blue-400">
                <FaLayerGroup size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">
                  Meta Total
                </p>
                <p className="text-2xl font-bold text-white">{totalMeta}</p>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex items-center gap-4">
              <div className="p-3 bg-green-900/30 rounded-lg text-green-400">
                <FaTrophy size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">
                  Producido
                </p>
                <p className="text-2xl font-bold text-white">{totalHecho}</p>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex items-center gap-4">
              <div className="p-3 bg-purple-900/30 rounded-lg text-purple-400">
                <FaPercentage size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">
                  Avance Global
                </p>
                <p className="text-2xl font-bold text-white">
                  {porcentajeGlobal}%
                </p>
              </div>
            </div>
          </div>

          {/* --- SECCIÓN 2: GRÁFICO VISUAL DE BARRAS APILADAS --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUMNA IZQUIERDA: AVANCE POR ÍTEM (El que querías mejorar) */}
            <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg flex flex-col h-[400px]">
              <h3 className="text-lg font-bold text-white mb-4">
                Avance por Ítem
              </h3>

              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={dataAvance}
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    horizontal={false}
                  />

                  {/* Eje Y con Nombres Claros */}
                  <YAxis
                    dataKey="codigo"
                    type="category"
                    width={80}
                    tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold" }}
                    axisLine={false}
                    tickLine={false}
                  />

                  {/* Eje X Oculto para limpieza */}
                  <XAxis type="number" hide />

                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "#fff" }}
                    formatter={(value, name) => [
                      value,
                      name === "Hecho" ? "Producido" : "Pendiente",
                    ]}
                  />

                  {/* BARRA 1: LO HECHO (Verde si completo, Azul si en proceso) */}
                  <Bar
                    dataKey="Hecho"
                    stackId="a"
                    radius={[4, 0, 0, 4]}
                    barSize={24}
                  >
                    {dataAvance.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isComplete ? "#22c55e" : "#3b82f6"}
                      />
                    ))}
                  </Bar>

                  {/* BARRA 2: LO QUE FALTA (Gris oscuro para dar efecto de fondo) */}
                  <Bar
                    dataKey="Falta"
                    stackId="a"
                    fill="#1e293b"
                    radius={[0, 4, 4, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* COLUMNA DERECHA: RENDIMIENTO OPERARIOS */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg flex flex-col h-[400px]">
              <h3 className="text-lg font-bold text-white mb-2">
                Rendimiento Operarios
              </h3>
              {dataOperarios.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataOperarios}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {dataOperarios.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS_PIE[index % COLORS_PIE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm italic">
                  Sin datos de producción aún.
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
