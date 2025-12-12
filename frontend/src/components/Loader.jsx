import React from "react";
import { motion } from "framer-motion";
import { FaSpinner } from "react-icons/fa";

// Si tienes un logo, descomenta y usa esta importación:
// import logoImg from "../assets/logo-white.png";

export default function Loader({
  text = "Cargando...",
  size = "lg",
  className = "",
}) {
  const sizeClasses = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl",
    xl: "text-8xl",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
    >
      {/* Versión simple con Icono (si no tienes logo a mano) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className={`text-blue-500 ${sizeClasses[size] || "text-4xl"}`}
      >
        <FaSpinner />
      </motion.div>

      {/* Versión con Logo (Descomentar si tienes la imagen) */}
      {/* <motion.img 
        src={logoImg} 
        alt="Loading"
        className="w-24 h-24 object-contain"
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1, 0.9] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      /> 
      */}

      {text && (
        <p className="text-gray-400 text-sm font-bold tracking-wider animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}
