import React from "react";
import { FaCheckCircle, FaTruck } from "react-icons/fa";

const Badge = ({ tipo, texto }) => {
  const styles = {
    RECIBIDO: "bg-green-500/20 text-green-400 border-green-500/50",
    EN_CAMINO:
      "bg-orange-500/20 text-orange-400 border-orange-500/50 animate-pulse",
    PENDIENTE: "bg-slate-600/40 text-gray-300 border-gray-500",
  };

  // Lógica defensiva por si texto viene undefined
  const safeTexto = texto || "";
  const statusKey = safeTexto.includes("RECIBIDO")
    ? "RECIBIDO"
    : safeTexto.includes("TRANSITO") || safeTexto.includes("CAMINO")
    ? "EN_CAMINO"
    : "PENDIENTE";

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-bold uppercase border flex items-center gap-1 w-fit ${
        styles[statusKey] || styles.PENDIENTE
      }`}
    >
      {statusKey === "RECIBIDO" ? <FaCheckCircle /> : <FaTruck />} {safeTexto}
    </span>
  );
};

export default Badge;
