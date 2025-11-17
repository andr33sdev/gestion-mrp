import React from "react";
import { FaUserTie, FaCubes, FaHistory } from "react-icons/fa";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
} from "recharts";

export default function DetailModal({
  selectedItem,
  isCli,
  dynamicChartData,
  modalHistory,
  modalPage,
  setModalPage,
  totalPages,
  historialFilter,
  setHistorialFilter,
  setSelectedItem,
  COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"],
}) {
  if (!selectedItem) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-slate-600 flex flex-col">
        <div className="p-6 border-b border-slate-700 flex justify-between items-start bg-slate-800 sticky top-0 z-10">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              {isCli ? <FaUserTie /> : <FaCubes />} {selectedItem.name}
            </h2>
          </div>
          <button onClick={() => setSelectedItem(null)} className="text-2xl text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className={`bg-opacity-20 p-5 rounded-xl border text-center ${isCli ? "bg-purple-900 border-purple-800" : "bg-blue-900 border-blue-800"}`}>
              <h3 className="text-xs font-bold mb-2 text-gray-300">Total 2025</h3>
              <p className="text-5xl font-bold text-white">{selectedItem.total}</p>
            </div>
            <div className="bg-slate-700/50 p-5 rounded-xl border border-slate-600 h-64">
              <h3 className="text-xs font-bold mb-2 text-center text-gray-300">{isCli ? "Productos Favoritos" : "Top Clientes"}</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={selectedItem.pie} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                    {selectedItem.pie.map((e, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", color: "#fff" }} itemStyle={{ color: "#fff" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
              <h3 className="text-gray-200 font-bold mb-4 text-sm uppercase">Evolución Mensual</h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dynamicChartData}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="mes" stroke="#94a3b8" interval={0} tick={{ fontSize: 10 }} />
                    <YAxis stroke="#94a3b8" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }} itemStyle={{ color: "#3b82f6" }} />
                    <Line type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: "#3b82f6", stroke: "#fff" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-700/30 p-5 rounded-xl border border-slate-600">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex gap-2 text-sm items-center"><FaHistory className="text-green-400" /> Historial</h3>
                <div className="flex bg-slate-800 rounded p-1">
                  {["TODOS", "SIN_ML", "SOLO_ML"].map((f) => (
                    <button key={f} onClick={() => { setHistorialFilter(f); setModalPage(1); }} className={`px-2 py-1 text-[10px] rounded ${historialFilter === f ? "bg-blue-600" : "text-gray-400"}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-[200px]">
                <table className="w-full text-sm text-left text-gray-300">
                  <thead className="text-xs text-gray-400 bg-slate-700/50">
                    <tr>
                      <th className="p-2">Fecha</th>
                      <th className="p-2">{isCli ? "Producto" : "Cliente"}</th>
                      <th className="p-2">Cant</th>
                      <th className="p-2">OC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalHistory.map((h, i) => (
                      <tr key={i} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="p-2 font-mono text-xs flex gap-2">{h.fecha} {h.isML && (<span className="bg-yellow-500 text-black px-1 rounded text-[9px]">MELI</span>)}</td>
                        <td className="p-2 truncate max-w-[150px]">{h.col}</td>
                        <td className="p-2">{h.cant}</td>
                        <td className="p-2 text-xs">{h.oc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between mt-4">
                <button disabled={modalPage === 1} onClick={() => setModalPage((p) => p - 1)} className="px-3 py-1 bg-slate-600 text-xs rounded disabled:opacity-50">Ant</button>
                <span className="text-xs text-gray-500 mt-1">Página {modalPage} de {totalPages || 1}</span>
                <button disabled={modalPage === totalPages || totalPages === 0} onClick={() => setModalPage((p) => p + 1)} className="px-3 py-1 bg-slate-600 text-xs rounded disabled:opacity-50">Sig</button>
              </div>
            </div>
            <div className="bg-slate-900/30 p-3 rounded text-center text-xs text-gray-400">Último movimiento: <span className="text-white">{selectedItem.last}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
