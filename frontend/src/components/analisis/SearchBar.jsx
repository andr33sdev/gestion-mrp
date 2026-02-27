import React from "react";
import { FaUserTie, FaCubes, FaSearch } from "react-icons/fa";

export default function SearchBar({
  busqueda,
  onSearch,
  mostrarSugerencias,
  sugerencias,
  onSelect,
  isCli,
}) {
  return (
    // Agregamos h-full al contenedor principal
    <div className="relative w-full h-full">
      {/* Icono de Lupa centrado perfectamente en el alto */}
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
        <FaSearch className="text-slate-400" size={13} />
      </div>

      {/* Input con h-full y tipografía alineada a los botones */}
      <input
        type="text"
        placeholder={isCli ? "Buscar cliente..." : "Buscar producto..."}
        value={busqueda}
        onChange={(e) => onSearch(e.target.value)}
        className="w-full h-full bg-white text-slate-700 border border-slate-200 rounded-xl pl-10 pr-4 shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all placeholder-slate-400 text-xs font-bold"
      />

      {/* Desplegable de sugerencias ajustado a la paleta slate */}
      {mostrarSugerencias && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
          {sugerencias.length > 0 ? (
            sugerencias.map((s, i) => (
              <div
                key={i}
                onClick={() => onSelect(s)}
                className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-slate-600 hover:text-indigo-600 border-b border-slate-50 last:border-0 flex gap-3 items-center transition-colors text-xs"
              >
                <span className="text-slate-400 bg-slate-100 p-1.5 rounded-md">
                  {isCli ? <FaUserTie size={12} /> : <FaCubes size={12} />}
                </span>
                <span className="font-semibold">{s}</span>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-slate-400 text-xs italic">
              No se encontraron resultados.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
