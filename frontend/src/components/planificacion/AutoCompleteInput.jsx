import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSearch } from "react-icons/fa";

export default function AutoCompleteInput({
  items,
  onSelect,
  placeholder,
  disabled,
  initialValue = "",
}) {
  const [value, setValue] = useState(initialValue);
  const [sugerencias, setSugerencias] = useState([]);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e) => {
    const val = e.target.value;
    setValue(val);

    if (val.length > 0) {
      setSugerencias(
        items
          .filter(
            (s) =>
              (s.nombre || "").toLowerCase().includes(val.toLowerCase()) ||
              (s.codigo || "").toLowerCase().includes(val.toLowerCase()),
          )
          .slice(0, 5),
      );
    } else {
      setSugerencias([]);
    }
  };

  const handleSelect = (semi) => {
    setValue("");
    setSugerencias([]);
    onSelect(semi);
  };

  return (
    <div className="relative w-full">
      {/* Contenedor del Input con Lupa (TAMAÑO COMPACTO PARA TABS) */}
      <div className="relative flex items-center">
        <FaSearch className="absolute left-3.5 text-slate-400" size={12} />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder || "Buscar..."}
          className="w-full bg-white border border-slate-200 rounded-full pl-9 pr-4 py-2 text-[10px] font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 shadow-sm hover:border-slate-300 disabled:opacity-50"
          disabled={disabled}
        />
      </div>

      {/* Desplegable de Resultados */}
      <AnimatePresence>
        {sugerencias.length > 0 && isFocused && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] right-0 w-[350px] bg-white rounded-[1.5rem] mt-2 shadow-2xl overflow-hidden border border-slate-100"
          >
            {sugerencias.map((s) => (
              <div
                key={s.id}
                onMouseDown={() => handleSelect(s)}
                className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors group flex justify-between items-center"
              >
                <p className="font-bold text-[11px] text-slate-700 group-hover:text-indigo-600 transition-colors truncate pr-4">
                  {s.nombre || "Sin Nombre"}
                </p>
                <p className="text-[9px] text-slate-400 font-bold font-mono uppercase tracking-widest shrink-0 bg-slate-100 px-2 py-1 rounded-md group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                  {s.codigo || "S/C"}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
