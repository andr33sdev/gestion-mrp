import React from "react";
import { FaUserTie, FaCubes } from "react-icons/fa";

export default function SearchBar({
  busqueda,
  onSearch,
  mostrarSugerencias,
  sugerencias,
  onSelect,
  isCli,
}) {
  return (
    <div className="relative w-80">
      <input
        type="text"
        placeholder="Buscar..."
        value={busqueda}
        onChange={(e) => onSearch(e.target.value)}
        className="w-full bg-slate-800 text-white border border-slate-600 rounded-full py-2 px-4 focus:ring-2 focus:ring-blue-500"
      />
      {mostrarSugerencias && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto border border-slate-600">
          {sugerencias.map((s, i) => (
            <div
              key={i}
              onClick={() => onSelect(s)}
              className="px-4 py-2 hover:bg-slate-600 cursor-pointer text-white border-b border-slate-600 flex gap-2 items-center"
            >
              {isCli ? <FaUserTie /> : <FaCubes />} {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
