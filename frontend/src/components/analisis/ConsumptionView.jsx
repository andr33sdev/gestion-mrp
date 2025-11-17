import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
} from "recharts";

export default function ConsumptionView({ analysisData }) {
  if (!analysisData) return null;
  return (
    <div className="animate-in fade-in duration-500">
      <h1 className="text-4xl font-bold mb-2">Consumo de Insumos (2025)</h1>
      <p className="text-gray-400 mb-8">
        Demanda total de semielaborados basada en los pedidos vendidos
        (Explosión de Materiales).
      </p>

      <div className="bg-slate-800 p-6 rounded-xl shadow-lg h-[600px]">
        <h3 className="text-xl font-bold mb-4 text-gray-200">Ranking de Semielaborados</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={analysisData.consumo} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid strokeOpacity={0.1} horizontal vertical={false} />
            <XAxis type="number" stroke="#94a3b8" />
            <YAxis dataKey="name" type="category" stroke="#94a3b8" width={150} style={{ fontSize: "10px" }} />
            <Tooltip contentStyle={{ backgroundColor: "#1e293b" }} />
            <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
              {analysisData.consumo.map((e, i) => (
                <Cell key={i} fill={i < 5 ? "#c084fc" : "#581c87"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
