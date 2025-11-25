import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function AutoCompleteInput({
  items,
  onSelect,
  placeholder,
  disabled,
  initialValue = "",
}) {
  // Inicializamos con el valor que viene de afuera (si existe)
  const [value, setValue] = useState(initialValue);
  const [sugerencias, setSugerencias] = useState([]);

  // Si el valor inicial cambia (ej: al limpiar formulario), actualizamos el input
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
              (s.codigo || "").toLowerCase().includes(val.toLowerCase())
          )
          .slice(0, 5)
      );
    } else {
      setSugerencias([]);
    }
  };

  const handleSelect = (semi) => {
    // --- CORRECCIÓN: Mostrar el nombre seleccionado ---
    setValue(semi.nombre || semi.codigo || "");
    setSugerencias([]);
    onSelect(semi);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || "Buscar..."}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-transparent focus:border-blue-500 transition-all disabled:bg-slate-800 disabled:text-gray-500"
        disabled={disabled}
      />
      {sugerencias.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 w-full bg-slate-700 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto border border-slate-600"
        >
          {sugerencias.map((s) => (
            <div
              key={s.id}
              onMouseDown={() => handleSelect(s)} // Usamos onMouseDown para evitar conflictos con el blur
              className="p-3 hover:bg-slate-600 cursor-pointer border-b border-slate-600 last:border-b-0"
            >
              <p className="font-bold text-sm text-white">
                {s.nombre || "Sin Nombre"}
              </p>
              <p className="text-xs text-gray-400 font-mono">
                {s.codigo || "S/C"}
              </p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
