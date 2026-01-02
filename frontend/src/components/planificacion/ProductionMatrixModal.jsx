import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTimes,
  FaSave,
  FaCalendarAlt,
  FaPlus,
  FaTrash,
  FaMapMarkerAlt,
  FaCommentDots,
  FaEraser,
  FaLock,
  FaPen,
} from "react-icons/fa";
import AutoCompleteInput from "./AutoCompleteInput";

// Componentes simples de bandera
const FlagArg = () => <span className="text-lg mr-1">🇦🇷</span>;
const FlagPy = () => <span className="text-lg mr-1">🇵🇾</span>;

export default function ProductionMatrixModal({ allSemis, onClose }) {
  // 1. GENERAMOS 30 DÍAS
  const daysArray = useMemo(() => {
    const arr = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  // 2. ESTADO DE PLANTA ACTIVA
  const [activePlant, setActivePlant] = useState("ARG");

  // 3. MODO DE INTERACCIÓN (DATA = Escribir, BLOCK = Comentar)
  const [interactionMode, setInteractionMode] = useState("DATA"); // 'DATA' | 'BLOCK'

  // 4. ESTADO DE DATOS (Separado por planta)
  const [plantData, setPlantData] = useState({
    ARG: { rows: [], matrix: {}, comments: [] },
    PY: { rows: [], matrix: {}, comments: [] },
  });

  // ESTADO DE SELECCIÓN
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState(null);

  // --- HELPERS PARA ACCEDER AL ESTADO ACTUAL ---
  const currentRows = plantData[activePlant].rows;
  const currentMatrix = plantData[activePlant].matrix;
  const currentComments = plantData[activePlant].comments;

  // --- HANDLERS BÁSICOS ---

  const handleInputChange = (rowId, dateIso, field, value) => {
    const key = `${rowId}|${dateIso}`;
    setPlantData((prev) => ({
      ...prev,
      [activePlant]: {
        ...prev[activePlant],
        matrix: {
          ...prev[activePlant].matrix,
          [key]: {
            ...prev[activePlant].matrix[key],
            [field]: value,
          },
        },
      },
    }));
  };

  const handleAddProduct = (item) => {
    // Cálculo dinámico de inicio (cascada)
    let newStartIndex = 0;
    const lastRow = currentRows[currentRows.length - 1];

    if (lastRow) {
      let maxIdx = -1;
      daysArray.forEach((d, idx) => {
        const dateIso = d.toISOString().split("T")[0];
        const cell = currentMatrix[`${lastRow.id}|${dateIso}`];
        const hasData = cell && (cell.teo || cell.real);
        const hasComment = currentComments.some(
          (c) => c.rowId === lastRow.id && idx >= c.startIdx && idx <= c.endIdx
        );
        if (hasData || hasComment) {
          maxIdx = idx;
        }
      });
      if (maxIdx !== -1) newStartIndex = maxIdx + 1;
    }

    setPlantData((prev) => ({
      ...prev,
      [activePlant]: {
        ...prev[activePlant],
        rows: [
          ...prev[activePlant].rows,
          { id: Date.now(), name: item.nombre, startIndex: newStartIndex },
        ],
      },
    }));
  };

  const handleRemoveRow = (id) => {
    setPlantData((prev) => ({
      ...prev,
      [activePlant]: {
        ...prev[activePlant],
        rows: prev[activePlant].rows.filter((r) => r.id !== id),
        comments: prev[activePlant].comments.filter((c) => c.rowId !== id),
      },
    }));
  };

  const getCellValue = (rowId, dateIso) => {
    const key = `${rowId}|${dateIso}`;
    return currentMatrix[key] || { teo: "", real: "" };
  };

  const calculateAssigned = (rowId) => {
    let total = 0;
    Object.keys(currentMatrix).forEach((key) => {
      if (key.startsWith(rowId + "|")) {
        total += Number(currentMatrix[key].teo || 0);
      }
    });
    return total;
  };

  // --- LÓGICA DE SELECCIÓN Y COMENTARIOS ---

  const handleMouseDown = (rowId, idx) => {
    // SOLO PERMITIMOS SELECCIONAR SI ESTAMOS EN MODO BLOQUEO
    if (interactionMode !== "BLOCK") return;

    setIsSelecting(true);
    setSelection({ rowId, startIdx: idx, endIdx: idx });
  };

  const handleMouseEnter = (rowId, idx) => {
    if (isSelecting && selection && selection.rowId === rowId) {
      setSelection((prev) => ({ ...prev, endIdx: idx }));
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && selection) {
      const start = Math.min(selection.startIdx, selection.endIdx);
      const end = Math.max(selection.startIdx, selection.endIdx);

      if (start !== end || interactionMode === "BLOCK") {
        const text = prompt("📝 Comentario de bloqueo (ej: Mantenimiento):");
        if (text) {
          addComment(selection.rowId, start, end, text);
        }
      }
    }
    setIsSelecting(false);
    setSelection(null);
  };

  const addComment = (rowId, startIdx, endIdx, text) => {
    setPlantData((prev) => {
      const newMatrix = { ...prev[activePlant].matrix };

      // Limpiar datos debajo del bloqueo
      for (let i = startIdx; i <= endIdx; i++) {
        const dateIso = daysArray[i].toISOString().split("T")[0];
        const key = `${rowId}|${dateIso}`;
        if (newMatrix[key]) delete newMatrix[key];
      }

      // Eliminar solapamientos
      const filteredComments = prev[activePlant].comments.filter(
        (c) => c.rowId !== rowId || c.endIdx < startIdx || c.startIdx > endIdx
      );

      return {
        ...prev,
        [activePlant]: {
          ...prev[activePlant],
          matrix: newMatrix,
          comments: [
            ...filteredComments,
            { id: Date.now(), rowId, startIdx, endIdx, text },
          ],
        },
      };
    });
  };

  const removeComment = (commentId) => {
    if (!confirm("¿Desbloquear rango?")) return;
    setPlantData((prev) => ({
      ...prev,
      [activePlant]: {
        ...prev[activePlant],
        comments: prev[activePlant].comments.filter((c) => c.id !== commentId),
      },
    }));
  };

  const isCellSelected = (rowId, idx) => {
    if (!isSelecting || !selection) return false;
    if (selection.rowId !== rowId) return false;
    const min = Math.min(selection.startIdx, selection.endIdx);
    const max = Math.max(selection.startIdx, selection.endIdx);
    return idx >= min && idx <= max;
  };

  const getCommentStartingAt = (rowId, idx) => {
    return currentComments.find((c) => c.rowId === rowId && c.startIdx === idx);
  };

  const isCellCovered = (rowId, idx) => {
    return currentComments.some(
      (c) => c.rowId === rowId && idx > c.startIdx && idx <= c.endIdx
    );
  };

  // --- DINÁMICA DE BLOQUEOS (CASCADA) ---
  const rowStartIndices = useMemo(() => {
    const indices = {};
    let nextStart = 0;

    currentRows.forEach((row) => {
      indices[row.id] = nextStart;

      let maxOccupiedIndex = -1;
      daysArray.forEach((d, idx) => {
        if (idx >= nextStart) {
          const dateIso = d.toISOString().split("T")[0];
          const cell = currentMatrix[`${row.id}|${dateIso}`];
          const hasData = cell && (cell.teo || cell.real);
          const hasComment = currentComments.some(
            (c) => c.rowId === row.id && idx >= c.startIdx && idx <= c.endIdx
          );

          if (hasData || hasComment) {
            maxOccupiedIndex = idx;
          }
        }
      });

      if (maxOccupiedIndex !== -1) {
        nextStart = maxOccupiedIndex + 1;
      }
    });

    return indices;
  }, [currentRows, currentMatrix, currentComments, daysArray]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-2"
      onMouseUp={handleMouseUp}
    >
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 w-full max-w-[98vw] h-[95vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* HEADER */}
        <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg shadow-lg">
                <FaCalendarAlt className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Cronograma Maestro
                </h2>
                <p className="text-[10px] text-gray-400">
                  Planificación Diaria
                </p>
              </div>
            </div>

            {/* TOGGLE PLANTA */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-600">
              <button
                onClick={() => setActivePlant("ARG")}
                className={`px-4 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${
                  activePlant === "ARG"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FlagArg /> Argentina
              </button>
              <button
                onClick={() => setActivePlant("PY")}
                className={`px-4 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${
                  activePlant === "PY"
                    ? "bg-red-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FlagPy /> Paraguay
              </button>
            </div>

            {/* TOGGLE MODO EDICIÓN / BLOQUEO (LA CLAVE) */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-600 ml-4">
              <button
                onClick={() => setInteractionMode("DATA")}
                className={`px-4 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${
                  interactionMode === "DATA"
                    ? "bg-emerald-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FaPen /> Editar Datos
              </button>
              <button
                onClick={() => setInteractionMode("BLOCK")}
                className={`px-4 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${
                  interactionMode === "BLOCK"
                    ? "bg-orange-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FaLock /> Comentar/Bloquear
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 text-xs shadow-lg transition-colors">
              <FaSave /> Guardar
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg text-gray-400 hover:text-white"
            >
              <FaTimes size={18} />
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-hidden relative bg-slate-950 flex flex-col">
          {/* BARRA DE AGREGAR */}
          <div className="sticky top-0 left-0 z-50 bg-slate-900/95 border-b border-slate-700 p-2 flex gap-3 items-center backdrop-blur-sm shrink-0 shadow-sm">
            <div className="w-80">
              <AutoCompleteInput
                items={allSemis}
                onSelect={handleAddProduct}
                placeholder={`Agregar producto a ${
                  activePlant === "ARG" ? "Argentina" : "Paraguay"
                }...`}
              />
            </div>
            <div className="text-[10px] text-gray-500 flex flex-col leading-tight">
              <span className="flex items-center gap-1 text-gray-400">
                <FaPlus size={10} /> Añade fila.
              </span>
              <span>
                {interactionMode === "BLOCK"
                  ? "Modo Bloqueo ACTIVO: Arrastra en la grilla para crear comentarios."
                  : "Modo Datos ACTIVO: Escribe cantidades en las celdas."}
              </span>
            </div>
          </div>

          {/* ÁREA DE TABLA */}
          <div className="flex-1 overflow-auto custom-scrollbar relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePlant}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="min-w-full"
              >
                <table className="w-full border-collapse">
                  <thead className="bg-slate-900 sticky top-0 z-40 shadow-lg">
                    <tr>
                      {/* Esquina Fija */}
                      <th className="p-2 text-left min-w-[200px] w-[200px] border-r border-b border-slate-700 sticky left-0 bg-slate-900 z-50 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                          <FaMapMarkerAlt /> Producto ({activePlant})
                        </span>
                      </th>
                      {/* Columnas de Días */}
                      {daysArray.map((d, i) => {
                        const isToday =
                          new Date().toDateString() === d.toDateString();
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                        return (
                          <th
                            key={i}
                            className={`min-w-[60px] border-b border-r border-slate-700 py-1 text-center relative ${
                              isToday
                                ? "bg-blue-900/40"
                                : isWeekend
                                ? "bg-slate-800/80"
                                : ""
                            }`}
                          >
                            {isWeekend && (
                              <div className="absolute inset-0 border-t-2 border-slate-600/30 pointer-events-none"></div>
                            )}
                            <div
                              className={`text-[9px] font-bold uppercase leading-none mb-0.5 ${
                                isToday
                                  ? "text-blue-300"
                                  : isWeekend
                                  ? "text-yellow-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {d.toLocaleDateString("es-AR", {
                                weekday: "narrow",
                              })}
                            </div>
                            <div className="text-[10px] font-bold text-white leading-none">
                              {d.getDate()}/{d.getMonth() + 1}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row) => {
                      const assigned = calculateAssigned(row.id);
                      const startIndex = rowStartIndices[row.id] || 0;

                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-slate-800/30 transition-colors group h-14"
                        >
                          {/* Columna Izquierda Fija */}
                          <td className="sticky left-0 z-30 bg-slate-900 border-r border-b border-slate-700 p-2 group-hover:bg-slate-800 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                            <div className="flex justify-between items-start">
                              <div
                                className="font-bold text-white text-xs truncate w-40"
                                title={row.name}
                              >
                                {row.name}
                              </div>
                              <button
                                onClick={() => handleRemoveRow(row.id)}
                                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                              >
                                <FaTrash size={10} />
                              </button>
                            </div>
                            <div className="flex items-center mt-2">
                              <span className="text-[9px] text-gray-500 mr-1">
                                Plan:
                              </span>
                              <span className="text-[10px] font-mono font-bold text-blue-300">
                                {assigned} u.
                              </span>
                            </div>
                          </td>

                          {/* Celdas de Días */}
                          {daysArray.map((d, colIdx) => {
                            // Si está tapado por comentario, no renderizamos celda (merge)
                            if (isCellCovered(row.id, colIdx)) return null;

                            // Si acá empieza comentario, renderizamos la celda unificada
                            const comment = getCommentStartingAt(
                              row.id,
                              colIdx
                            );
                            if (comment) {
                              const span =
                                comment.endIdx - comment.startIdx + 1;
                              return (
                                <td
                                  key={colIdx}
                                  colSpan={span}
                                  className="p-1 border-r border-b border-slate-700 relative z-10"
                                >
                                  <div className="w-full h-full bg-red-900/40 border border-red-500/50 rounded-md flex items-center justify-center relative group/comment cursor-pointer">
                                    <span
                                      className="text-xs font-bold text-red-200 truncate px-2 select-none"
                                      title={comment.text}
                                    >
                                      {comment.text}
                                    </span>
                                    <button
                                      onClick={() => removeComment(comment.id)}
                                      className="absolute top-0 right-0 p-1 text-red-300 hover:text-white opacity-0 group-hover/comment:opacity-100 transition-opacity"
                                      title="Eliminar bloqueo"
                                    >
                                      <FaEraser size={10} />
                                    </button>
                                  </div>
                                </td>
                              );
                            }

                            // Renderizado Celda Normal
                            const dateIso = d.toISOString().split("T")[0];
                            const vals = getCellValue(row.id, dateIso);
                            const isWeekend =
                              d.getDay() === 0 || d.getDay() === 6;
                            const isToday =
                              new Date().toDateString() === d.toDateString();
                            const isHidden = colIdx < startIndex;
                            const selected = isCellSelected(row.id, colIdx);

                            // Si estamos en modo BLOCK, los inputs están disabled
                            const inputsDisabled = interactionMode === "BLOCK";

                            return (
                              <td
                                key={colIdx}
                                // Eventos para selección de rango (Solo en modo BLOCK y si no está oculta)
                                onMouseDown={() =>
                                  !isHidden && handleMouseDown(row.id, colIdx)
                                }
                                onMouseEnter={() =>
                                  !isHidden && handleMouseEnter(row.id, colIdx)
                                }
                                className={`border-r border-b border-slate-700/50 p-1 align-middle transition-colors relative ${
                                  isHidden
                                    ? "bg-slate-900/80 cursor-not-allowed opacity-50"
                                    : selected
                                    ? "bg-blue-500/30"
                                    : isWeekend
                                    ? "bg-slate-800/60 pattern-diagonal-lines-sm"
                                    : isToday
                                    ? "bg-blue-900/5"
                                    : ""
                                }`}
                              >
                                {!isHidden && (
                                  <div className="flex flex-col gap-1 h-full justify-center">
                                    <div className="relative">
                                      <input
                                        type="number"
                                        value={vals.teo}
                                        disabled={inputsDisabled} // Aquí está la clave
                                        onChange={(e) =>
                                          handleInputChange(
                                            row.id,
                                            dateIso,
                                            "teo",
                                            e.target.value
                                          )
                                        }
                                        className={`w-full bg-slate-800/80 border border-slate-600/50 rounded-sm px-1 py-0.5 text-[9px] text-blue-200 font-mono text-center focus:border-blue-500 outline-none focus:bg-slate-700 transition-colors h-5 placeholder:text-transparent focus:placeholder:text-slate-500 ${
                                          inputsDisabled ? "cursor-grab" : ""
                                        }`}
                                        placeholder="Plan"
                                      />
                                      {!vals.teo && !selected && (
                                        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-600 pointer-events-none uppercase font-bold tracking-wider opacity-60">
                                          Plan
                                        </span>
                                      )}
                                    </div>

                                    <div className="relative">
                                      <input
                                        type="number"
                                        value={vals.real}
                                        disabled={inputsDisabled}
                                        onChange={(e) =>
                                          handleInputChange(
                                            row.id,
                                            dateIso,
                                            "real",
                                            e.target.value
                                          )
                                        }
                                        className={`w-full bg-slate-800/80 border border-slate-600/50 rounded-sm px-1 py-0.5 text-[9px] text-green-300 font-bold font-mono text-center focus:border-green-500 outline-none focus:bg-slate-700 transition-colors h-5 placeholder:text-transparent focus:placeholder:text-slate-500 ${
                                          inputsDisabled ? "cursor-grab" : ""
                                        }`}
                                        placeholder="Real"
                                      />
                                      {!vals.real && !selected && (
                                        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-600 pointer-events-none uppercase font-bold tracking-wider opacity-60">
                                          Real
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
