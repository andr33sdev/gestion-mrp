import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export default function PlanStats({ items }) {
  const { totalRequerido, totalProducido, progresoGeneral, pieData } =
    useMemo(() => {
      let req = 0;
      let prod = 0;
      items.forEach((item) => {
        req += item.cantidad;
        prod += item.producido;
      });
      const progreso = req > 0 ? (prod / req) * 100 : 0;
      const pie = [
        { name: "Producido", value: prod },
        { name: "Pendiente", value: req - prod },
      ];
      return {
        totalRequerido: req,
        totalProducido: prod,
        progresoGeneral: progreso,
        pieData: pie,
      };
    }, [items]);

  const COLORS = ["#10B981", "#374151"]; // Verde y Gris
  const barData = items.map((item) => ({
    name: item.semielaborado.nombre.substring(0, 15) + "...",
    Pendiente: item.cantidad - item.producido,
    Producido: item.producido,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
        <h3 className="text-gray-300 font-bold text-sm mb-2 text-center">Progreso General</h3>
        <div className="w-full h-48 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-3xl font-bold text-white">{progresoGeneral.toFixed(0)}%</span>
          </div>
        </div>
        <div className="text-center mt-2">
          <p className="text-sm text-gray-400">Producido: <span className="font-bold text-green-400">{totalProducido}</span></p>
          <p className="text-sm text-gray-400">Requerido: <span className="font-bold text-white">{totalRequerido}</span></p>
        </div>
      </div>

      <div className="lg:col-span-2 bg-slate-900/50 p-4 rounded-xl border border-slate-700 min-h-[260px]">
        <h3 className="text-gray-300 font-bold text-sm mb-4">Avance por Ítem (Pendiente vs Producido)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" horizontal={false} />
            <XAxis type="number" stroke="#9ca3af" />
            <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={10} axisLine={false} tickLine={false} width={100} />
            <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none" }} />
            <Bar dataKey="Producido" stackId="a" fill="#10B981" radius={[4, 0, 0, 4]} />
            <Bar dataKey="Pendiente" stackId="a" fill="#374151" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
