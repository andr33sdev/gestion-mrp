import React, { useState, useEffect, useRef } from "react";

export default function AutoCompleteInput({
  items,
  value,
  onChange,
  onSelect,
  placeholder,
  className,
}) {
  const [isOpen, setIsOpen] = useState(false);
  // ESTADO HÍBRIDO: Maneja su propio texto si el padre no se lo pasa
  const [internalValue, setInternalValue] = useState(value || "");
  const wrapperRef = useRef(null);

  // Sincroniza si el módulo padre decide cambiar el texto desde afuera
  useEffect(() => {
    setInternalValue(value || "");
  }, [value]);

  // Cierra el menú al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtro blindado contra valores nulos
  const filteredItems = items.filter((item) => {
    const nombreSeguro = item?.nombre || "";
    const codigoSeguro = item?.codigo || "";
    const busquedaSegura = (internalValue || "").toLowerCase();

    return (
      nombreSeguro.toLowerCase().includes(busquedaSegura) ||
      codigoSeguro.toLowerCase().includes(busquedaSegura)
    );
  });

  // ESTÉTICA: Clases por defecto si el módulo padre no le pasa un diseño específico
  const defaultInputClass =
    "w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all";

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        className={className || defaultInputClass}
        value={internalValue}
        onChange={(e) => {
          setInternalValue(e.target.value); // Actualiza la vista inmediatamente
          if (onChange) onChange(e.target.value); // Le avisa al padre (Logística)
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />

      {isOpen && filteredItems.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
          {filteredItems.map((item, index) => (
            <li
              key={index}
              onClick={() => {
                const nombreItem = item?.nombre || "";
                if (onSelect) onSelect(item); // Le avisa al padre (Planificación)
                if (onChange) onChange(nombreItem);

                setInternalValue(nombreItem); // Ancla el texto en el input
                setIsOpen(false);
              }}
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center text-sm transition-colors border-b border-slate-50 last:border-0"
            >
              <span className="font-bold text-slate-700 truncate pr-2">
                {item?.nombre || "Sin Nombre"}
              </span>
              <span className="text-[10px] font-bold text-[#2196f3] bg-[#e3f2fd] px-2 py-1 rounded-md shrink-0 border border-blue-100">
                {item?.codigo || "S/C"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
