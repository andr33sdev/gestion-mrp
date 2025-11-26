import { useState, useEffect, useMemo } from "react";
import { API_BASE_URL, authFetch } from "../utils.js";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaInfoCircle,
  FaTimes,
  FaListUl,
  FaMapMarkerAlt,
  FaBuilding,
  FaFileAlt,
  FaBoxOpen,
  FaExclamationCircle,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const MAX_VISIBLE_EVENTS = 2;

// --- SUB-COMPONENTE: LISTA DE PEDIDOS DEL CLIENTE ---
function PedidosCliente({ clienteNombre }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPedidos = async () => {
      setLoading(true);
      try {
        // Limpiamos el nombre del cliente para mejorar la búsqueda
        const nombreLimpio = clienteNombre
          .replace(/\s+(S\.?A\.?|S\.?R\.?L\.?|S\.?H\.?)\s*$/i, "")
          .trim();
        const res = await authFetch(
          `${API_BASE_URL}/logistica/hoja-de-ruta/pedidos/${encodeURIComponent(
            nombreLimpio
          )}`
        );
        if (res.ok) {
          setPedidos(await res.json());
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    if (clienteNombre) fetchPedidos();
  }, [clienteNombre]);

  if (loading)
    return (
      <div className="py-6 text-center text-gray-500 text-xs animate-pulse">
        Buscando pedidos pendientes...
      </div>
    );

  if (pedidos.length === 0)
    return (
      <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700 text-center mt-2">
        <p className="text-xs text-gray-500 italic">
          No se encontraron pedidos "Sin Despachar" para este cliente en el
          sistema.
        </p>
      </div>
    );

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
          <FaBoxOpen /> Pedidos Pendientes de Despacho
        </h4>
        <span className="text-[10px] bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded-full border border-blue-800">
          {pedidos.length} encontrados
        </span>
      </div>

      <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-1">
        {pedidos.map((p) => (
          <div
            key={p.id}
            className="p-3 rounded-lg border bg-slate-800 border-slate-600/50 flex justify-between items-center hover:bg-slate-700 transition-colors"
          >
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-bold text-white truncate">
                {p.modelo}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-400 font-mono bg-black/30 px-1 rounded">
                  OC: {p.oc || "S/D"}
                </span>
                <span className="text-[10px] text-gray-500">
                  {new Date(p.fecha).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-lg font-bold text-emerald-400">
                {p.cantidad}
              </span>
              <span className="text-[9px] text-gray-400 uppercase">
                Unidades
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HojaDeRutaPage({ onNavigate }) {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/logistica/hoja-de-ruta`);
        if (res.ok) {
          setEvents(await res.json());
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchEvents();
  }, []);

  // --- FILTRO DE DUPLICADOS (LA CLAVE) ---
  // Agrupa eventos por fecha y razón social para evitar mostrar el mismo cliente múltiples veces el mismo día.
  const uniqueEvents = useMemo(() => {
    const seen = new Set();
    return events.filter((ev) => {
      const dateKey = ev.fecha_nueva.split("T")[0];
      // Clave única compuesta: FECHA + NOMBRE CLIENTE (normalizado)
      const key = `${dateKey}-${ev.razon_social.trim().toUpperCase()}`;

      if (seen.has(key)) {
        return false; // Si ya vimos este cliente hoy, lo saltamos (evita duplicados visuales)
      }
      seen.add(key);
      return true;
    });
  }, [events]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const changeMonth = (offset) => {
    const newDate = new Date(
      currentDate.setMonth(currentDate.getMonth() + offset)
    );
    setCurrentDate(new Date(newDate));
  };

  const daysRender = getDaysInMonth(currentDate);
  const todayStr = new Date().toISOString().split("T")[0];

  const getEventsForDay = (date) => {
    if (!date) return [];
    const dateStr = date.toLocaleDateString("en-CA");
    return uniqueEvents.filter(
      (e) => e.fecha_nueva && e.fecha_nueva.startsWith(dateStr)
    );
  };

  const handleOpenDayList = (dayEvents, dayDate) => {
    setSelectedDayEvents({ date: dayDate, list: dayEvents });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 animate-in fade-in">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-lg">
            <FaCalendarAlt className="text-2xl text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Hoja de Ruta</h1>
            <p className="text-gray-400 text-sm">Cronograma de entregas</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-800 p-1.5 rounded-xl border border-slate-700 shadow-lg">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-gray-300 hover:text-white"
          >
            <FaChevronLeft />
          </button>
          <span className="text-lg font-bold w-36 text-center capitalize text-white">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-gray-300 hover:text-white"
          >
            <FaChevronRight />
          </button>
        </div>
      </div>

      {/* CALENDARIO GRID */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-200px)] min-h-[650px]">
        <div className="grid grid-cols-7 bg-slate-900 border-b border-slate-700">
          {DAYS.map((day) => (
            <div
              key={day}
              className="py-3 text-center text-gray-500 font-bold text-xs uppercase tracking-wider"
            >
              {day.substring(0, 3)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 grid-rows-5 h-full bg-slate-800">
          {daysRender.map((day, index) => {
            const dayEvents = getEventsForDay(day);
            const isToday = day && day.toISOString().split("T")[0] === todayStr;

            const hasMore = dayEvents.length > MAX_VISIBLE_EVENTS;
            const visibleEvents = hasMore
              ? dayEvents.slice(0, MAX_VISIBLE_EVENTS)
              : dayEvents;
            const hiddenCount = dayEvents.length - MAX_VISIBLE_EVENTS;

            return (
              <div
                key={index}
                className={`border-r border-b border-slate-700/50 p-2 relative transition-colors flex flex-col ${
                  day ? "hover:bg-slate-700/20" : "bg-slate-900/30"
                }`}
              >
                {day && (
                  <>
                    <div className="flex justify-end mb-1">
                      <span
                        className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                          isToday
                            ? "bg-blue-600 text-white shadow-lg"
                            : "text-gray-400"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                      {visibleEvents.map((ev) => (
                        <motion.div
                          key={ev.id}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedEvent(ev)}
                          className="cursor-pointer text-[10px] px-2 py-1.5 rounded bg-slate-700 border-l-4 border-emerald-500 text-gray-200 shadow-sm hover:bg-slate-600 hover:text-white truncate transition-all flex items-center justify-between"
                          title={ev.razon_social}
                        >
                          <span className="font-medium truncate">
                            {ev.razon_social}
                          </span>
                        </motion.div>
                      ))}

                      {hasMore && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          onClick={() => handleOpenDayList(dayEvents, day)}
                          className="w-full text-[10px] font-bold py-1.5 rounded bg-slate-700/50 text-blue-300 hover:bg-blue-600 hover:text-white transition-colors border border-dashed border-blue-500/50 flex justify-center items-center"
                        >
                          +{hiddenCount} más...
                        </motion.button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL DETALLE MEJORADO */}
      <AnimatePresence>
        {selectedEvent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-800 border border-slate-600 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative flex flex-col md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              {/* COLUMNA IZQUIERDA: DATOS HOJA RUTA */}
              <div className="w-full md:w-1/2 bg-gradient-to-br from-slate-900 to-slate-800 p-6 border-r border-slate-700 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {selectedEvent.razon_social}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-gray-400 font-mono text-sm">
                    <FaMapMarkerAlt className="text-red-400" />
                    {selectedEvent.cliente || "Sin ID Cliente"}
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="bg-slate-700/30 p-4 rounded-xl border border-slate-600 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Fecha de Entrega
                      </p>
                      <p className="text-xl font-bold text-emerald-400 capitalize">
                        {new Date(selectedEvent.fecha_nueva).toLocaleDateString(
                          "es-AR",
                          { weekday: "long", day: "numeric", month: "long" }
                        )}
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-500/20 rounded-full">
                      <FaCalendarAlt className="text-emerald-400 text-xl" />
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: PEDIDOS DEL SISTEMA */}
              <div className="w-full md:w-1/2 p-6 bg-slate-800 relative flex flex-col">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="absolute top-4 right-4 bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-full transition-colors z-10"
                >
                  <FaTimes />
                </button>

                {/* COMPONENTE INTELIGENTE */}
                <PedidosCliente clienteNombre={selectedEvent.razon_social} />

                <div className="mt-auto pt-4 border-t border-slate-700 text-center">
                  <p className="text-[10px] text-gray-500">
                    <FaExclamationCircle className="inline mr-1 text-yellow-500" />
                    Datos cruzados automáticamente con la base de pedidos.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de lista del día se mantiene igual ... */}
      <AnimatePresence>
        {selectedDayEvents && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedDayEvents(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 bg-slate-900 border-b border-slate-700 flex justify-between items-center sticky top-0 z-10">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FaListUl className="text-emerald-400" /> Entregas del Día
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedDayEvents.date.toLocaleDateString("es-AR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDayEvents(null)}
                  className="text-gray-400 hover:text-white p-2"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="p-4 overflow-y-auto custom-scrollbar space-y-2">
                {selectedDayEvents.list.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => {
                      setSelectedDayEvents(null);
                      setSelectedEvent(ev);
                    }}
                    className="p-3 rounded-xl bg-slate-700/40 hover:bg-slate-700 border border-slate-600 cursor-pointer flex justify-between items-center group transition-all"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-sm group-hover:text-blue-300 transition-colors">
                        {ev.razon_social}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {ev.cliente || "Sin ID"}
                      </span>
                    </div>
                    <FaChevronRight className="text-gray-600 group-hover:text-white text-xs" />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
