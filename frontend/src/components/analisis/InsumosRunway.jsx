import React, { useEffect, useState } from "react";
import {
  FaHourglassHalf,
  FaHourglassEnd,
  FaHourglassStart,
  FaExclamationTriangle,
  FaShoppingCart,
  FaSpinner,
  FaFire,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { API_BASE_URL, authFetch } from "../../utils";

export default function InsumosRunway() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/analisis/insumos-runway`);
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading)
    return (
      <div className="p-20 text-center text-blue-400 flex flex-col items-center gap-4">
        <FaSpinner className="animate-spin text-4xl" />
        <p>Calculando consumo diario...</p>
      </div>
    );

  const criticos = data.filter((d) => d.status === "CRITICAL");
  const warnings = data.filter((d) => d.status === "WARNING");
  const safes = data.filter((d) => d.status === "SAFE");

  // Función para renderizar una tarjeta de insumo
  const InsumoCard = ({ item }) => {
    // Calculamos el porcentaje de "vida" (asumiendo 60 días como tanque lleno para visualización)
    const maxDiasVisual = 60;
    const porcentajeVida = Math.min(
      (item.dias_restantes / maxDiasVisual) * 100,
      100
    );

    let colorBarra = "bg-emerald-500";
    let colorTexto = "text-emerald-400";
    let icono = <FaHourglassStart />;
    let mensaje = "Stock Saludable";

    if (item.status === "CRITICAL") {
      colorBarra = "bg-rose-500";
      colorTexto = "text-rose-400";
      icono = <FaHourglassEnd className="animate-pulse" />;
      mensaje = "¡COMPRAR YA!";
    } else if (item.status === "WARNING") {
      colorBarra = "bg-amber-400";
      colorTexto = "text-amber-400";
      icono = <FaHourglassHalf />;
      mensaje = "Planificar Compra";
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col gap-3 relative overflow-hidden group"
      >
        {/* Fondo de alerta suave si es crítico */}
        {item.status === "CRITICAL" && (
          <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none"></div>
        )}

        <div className="flex justify-between items-start z-10">
          <div>
            <h3
              className="text-white font-bold text-lg truncate w-48"
              title={item.nombre}
            >
              {item.nombre}
            </h3>
            <p className="text-xs text-gray-500 font-mono">{item.codigo}</p>
          </div>
          <div
            className={`p-2 rounded-lg bg-slate-900 ${colorTexto} text-xl border border-slate-700`}
          >
            {icono}
          </div>
        </div>

        {/* Datos Duros */}
        <div className="grid grid-cols-2 gap-2 text-sm z-10">
          <div className="bg-slate-900/50 p-2 rounded">
            <p className="text-gray-500 text-[10px] uppercase">Stock Actual</p>
            <p className="text-white font-bold">{item.stock_actual}</p>
          </div>
          <div className="bg-slate-900/50 p-2 rounded">
            <p className="text-gray-500 text-[10px] uppercase">
              Consumo Diario
            </p>
            <p className="text-white font-bold flex items-center gap-1">
              <FaFire className="text-orange-500 text-[10px]" />{" "}
              {item.burn_rate}/día
            </p>
          </div>
        </div>

        {/* Barra de Tiempo (Runway) */}
        <div className="z-10">
          <div className="flex justify-between items-end mb-1">
            <span className={`text-xs font-bold ${colorTexto}`}>{mensaje}</span>
            <span className="text-xs text-white font-mono">
              {item.dias_restantes > 365
                ? "+1 Año"
                : item.dias_restantes === 0
                ? "AGOTADO"
                : `${item.dias_restantes} Días`}
            </span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${colorBarra}`}
              initial={{ width: 0 }}
              animate={{ width: `${porcentajeVida}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          {item.fecha_agotamiento && (
            <p className="text-[10px] text-right text-gray-400 mt-1">
              Se agota el:{" "}
              <span className="text-white font-bold">
                {item.fecha_agotamiento}
              </span>
            </p>
          )}
        </div>

        {/* Botón Acción (Mockup) */}
        {item.status !== "SAFE" && (
          <button className="mt-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors z-10">
            <FaShoppingCart /> Solicitar Compra
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500 pb-10">
      {/* HEADER / RESUMEN */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="bg-rose-900/20 border border-rose-500/30 p-4 rounded-xl flex-1 flex items-center gap-4">
          <div className="bg-rose-500 text-white p-3 rounded-full text-xl">
            <FaExclamationTriangle />
          </div>
          <div>
            <h3 className="text-rose-400 font-bold uppercase text-xs tracking-wider">
              Zona Crítica ({"<"} 7 días)
            </h3>
            <p className="text-2xl font-bold text-white">
              {criticos.length} Insumos
            </p>
          </div>
        </div>
        <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl flex-1 flex items-center gap-4">
          <div className="bg-amber-500 text-white p-3 rounded-full text-xl">
            <FaHourglassHalf />
          </div>
          <div>
            <h3 className="text-amber-400 font-bold uppercase text-xs tracking-wider">
              Alerta Temprana ({"<"} 30 días)
            </h3>
            <p className="text-2xl font-bold text-white">
              {warnings.length} Insumos
            </p>
          </div>
        </div>
        <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-xl flex-1 flex items-center gap-4">
          <div className="bg-emerald-500 text-white p-3 rounded-full text-xl">
            <FaHourglassStart />
          </div>
          <div>
            <h3 className="text-emerald-400 font-bold uppercase text-xs tracking-wider">
              Stock Saludable ({">"} 30 días)
            </h3>
            <p className="text-2xl font-bold text-white">
              {safes.length} Insumos
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN CRÍTICOS */}
      {criticos.length > 0 && (
        <div>
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>{" "}
            Urgencia Inmediata
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {criticos.map((item) => (
              <InsumoCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* SECCIÓN WARNINGS */}
      {warnings.length > 0 && (
        <div>
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>{" "}
            Planificar Reposición
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {warnings.map((item) => (
              <InsumoCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* SECCIÓN SAFE (Acordeón o lista simple para no ocupar tanto) */}
      {safes.length > 0 && (
        <div>
          <h3 className="text-gray-400 font-bold mb-4 flex items-center gap-2 border-b border-slate-700 pb-2 text-sm uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Stock
            Suficiente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-70 hover:opacity-100 transition-opacity">
            {safes.map((item) => (
              <div
                key={item.id}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex justify-between items-center"
              >
                <div>
                  <p className="text-gray-300 font-bold text-sm truncate w-32">
                    {item.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.dias_restantes > 365
                      ? "> 1 Año"
                      : item.dias_restantes + " días"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-mono text-sm font-bold">
                    {item.stock_actual}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
