import React from "react";
import { motion } from "framer-motion";
import { FaTrash } from "react-icons/fa";

export default function PlanItemCard({ item, onRemove, isPlanCerrado }) {
  const progPercent =
    item.cantidad > 0 ? (item.producido / item.cantidad) * 100 : 0;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="bg-slate-700 p-4 rounded-lg border border-slate-600 group"
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-white">{item.semielaborado.nombre}</span>
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-blue-300">
            {item.producido} <span className="text-sm text-gray-400">/ {item.cantidad}</span>
          </span>
          {!isPlanCerrado && (
            <button
              onClick={onRemove}
              className="text-gray-500 hover:text-red-400 p-1 transition-colors opacity-0 group-hover:opacity-100"
            >
              <FaTrash />
            </button>
          )}
        </div>
      </div>
      <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
        <motion.div
          className="bg-green-500 h-2.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progPercent}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </motion.li>
  );
}
