import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  FaBoxes,
  FaCheckCircle,
  FaHourglassHalf,
  FaUsers,
  FaTimes, // Icono para cerrar
  FaChartPie, // Icono para el título
} from "react-icons/fa";

// --- NUEVO SUB-COMPONENTE: StatCard (para los KPIs) ---
function StatCard({ title, value, icon, colorClass = "text-blue-300" }) {
  return (
    <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
      <div className="flex items-center gap-3">
        <div className={`text-2xl ${colorClass}`}>{icon}</div>
        <h3 className="text-sm font-bold text-gray-400 uppercase">{title}</h3>
      </div>
      <p className={`text-4xl font-extrabold text-white mt-2 ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL (AHORA ES UN MODAL) ---
export default function PlanStats({ items, operarios, onClose }) {
  // 1. Cálculo de KPIs
  const { totalRequerido, totalProducido, totalPendiente, progresoGeneral } =
    useMemo(() => {
      let req = 0;
      let prod = 0;
      items.forEach((item) => {
        req += item.cantidad;
        prod += item.producido;
      });
      const progreso = req > 0 ? (prod / req) * 100 : 0;
      return {
        totalRequerido: req,
        totalProducido: prod,
        totalPendiente: Math.max(0, req - prod), // Aseguramos que no sea negativo
        progresoGeneral: progreso,
      };
    }, [items]);

  // 2. Datos para los gráficos
  const barData = useMemo(
    () =>
      items.map((item) => ({
        name:
          item.semielaborado.nombre.substring(0, 20) +
          (item.semielaborado.nombre.length > 20 ? "..." : ""),
        Pendiente: Math.max(0, item.cantidad - item.producido),
        Producido: item.producido,
      })),
    [items]
  );

  const operarioData = operarios; // Los datos ya vienen listos

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4"
      onClick={onClose} // Cierra al hacer clic en el fondo
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-slate-600 flex flex-col"
        onClick={(e) => e.stopPropagation()} // Evita que el clic en el modal lo cierre
      >
        {/* --- Header del Modal --- */}
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800 sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FaChartPie className="text-blue-400" />
            Estadísticas del Plan
          </h2>
          <button
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-white"
          >
            <FaTimes />
          </button>
        </div>

        {/* --- Contenido del Modal (con scroll) --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="flex flex-col gap-6">
            {/* --- FILA 1: KPI CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Progreso"
                value={`${progresoGeneral.toFixed(0)}%`}
                icon={<FaCheckCircle />}
                colorClass="text-green-400"
              />
              <StatCard
                title="Total Requerido"
                value={totalRequerido}
                icon={<FaBoxes />}
                colorClass="text-blue-300"
              />
              <StatCard
                title="Total Producido"
                value={totalProducido}
                icon={<FaUsers />}
                colorClass="text-white"
              />
              <StatCard
                title="Pendiente"
                value={totalPendiente}
                icon={<FaHourglassHalf />}
                colorClass="text-yellow-400"
              />
            </div>

            {/* --- FILA 2: GRÁFICOS DE BARRAS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* --- GRÁFICO MEJORADO: BARRAS HORIZONTALES --- */}
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 min-h-[300px]">
                <h3 className="text-gray-300 font-bold text-sm mb-4">
                  Producción por Operario
                </h3>
                {operarioData && operarioData.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(150, operarioData.length * 40)} // Altura dinámica
                  >
                    <BarChart
                      data={operarioData}
                      layout="vertical" // <-- BARRAS HORIZONTALES
                      margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#475569"
                        horizontal={false} // Líneas de guía verticales
                      />
                      <XAxis type="number" stroke="#9ca3af" />
                      <YAxis
                        dataKey="nombre" // <-- Nombres en el eje Y
                        type="category"
                        stroke="#9ca3af"
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        width={100}
                        interval={0} // Asegura que se vean todos los nombres
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "none",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="total_producido"
                        name="Unidades"
                        fill="#8b5cf6" // Púrpura
                        radius={[0, 4, 4, 0]} // Barras horizontales
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-40 text-gray-500 text-sm italic">
                    Sin producción registrada por operarios.
                  </div>
                )}
              </div>

              {/* Gráfico 2: Avance por Ítem (También Horizontal) */}
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 min-h-[300px]">
                <h3 className="text-gray-300 font-bold text-sm mb-4">
                  Avance por Ítem
                </h3>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(150, barData.length * 40)} // Altura dinámica
                >
                  <BarChart
                    data={barData}
                    layout="vertical" // <-- BARRAS HORIZONTALES
                    margin={{ top: 0, right: 20, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#475569"
                      horizontal={false} // Líneas de guía verticales
                    />
                    <XAxis type="number" stroke="#9ca3af" />
                    <YAxis
                      dataKey="name" // <-- Nombres en el eje Y
                      type="category"
                      stroke="#9ca3af"
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                      width={100}
                      interval={0} // Asegura que se vean todos los nombres
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "none",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: "15px" }}
                    />
                    <Bar
                      dataKey="Producido"
                      stackId="a"
                      fill="#10B981"
                      radius={[4, 0, 0, 4]} // Barras horizontales
                    />
                    <Bar
                      dataKey="Pendiente"
                      stackId="a"
                      fill="#374151"
                      radius={[0, 4, 4, 0]} // Barras horizontales
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
