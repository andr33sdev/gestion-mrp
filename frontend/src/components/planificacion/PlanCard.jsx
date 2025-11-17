import React from "react";
import { motion } from "framer-motion";
import { FaLock, FaLockOpen } from "react-icons/fa";

export default function PlanCard({ plan, onSelect, isSelected }) {
  return (
    <motion.button
      layout
      animate={{ opacity: 1 }}
      initial={{ opacity: 0 }}
      exit={{ opacity: 0 }}
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl transition-all border-2 ${
        isSelected
          ? "bg-slate-700/50 border-blue-500 shadow-lg"
          : "bg-slate-800 border-slate-700 hover:bg-slate-700/80 hover:border-slate-600"
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold truncate text-white">{plan.nombre}</span>
        {plan.estado === "ABIERTO" ? (
          <div className="flex items-center gap-1 text-xs text-green-400 bg-green-900/50 px-2 py-1 rounded-full">
            <FaLockOpen /> Abierto
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-gray-400 bg-slate-700 px-2 py-1 rounded-full">
            <FaLock /> Cerrado
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        {new Date(plan.fecha_creacion).toLocaleDateString("es-AR")}
      </p>
    </motion.button>
  );
}
