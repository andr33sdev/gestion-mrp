import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaKey,
  FaLock,
  FaSpinner,
  FaUserTie,
  FaHardHat,
  FaWarehouse,
  FaTools,
  FaArrowLeft,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { API_BASE_URL } from "../utils";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Estado para saber qué rol eligió el usuario (null = ninguno)
  const [selectedRole, setSelectedRole] = useState(null);

  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); // Estado para "Recordarme"

  // Mapa de configuración para cada rol
  const rolesConfig = {
    GERENCIA: {
      title: "Gerencia",
      icon: <FaUserTie />,
      color:
        "border-purple-500 text-purple-400 hover:bg-purple-600 hover:text-white",
    },
    PANEL: {
      title: "Operario",
      icon: <FaHardHat />,
      color: "border-blue-500 text-blue-400 hover:bg-blue-600 hover:text-white",
    },
    DEPOSITO: {
      title: "Depósito",
      icon: <FaWarehouse />,
      color:
        "border-orange-500 text-orange-400 hover:bg-orange-600 hover:text-white",
    },
    MANTENIMIENTO: {
      title: "Técnico",
      icon: <FaTools />,
      color: "border-red-500 text-red-400 hover:bg-red-600 hover:text-white",
    },
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Intentamos conectar al backend con la contraseña
      const res = await fetch(`${API_BASE_URL}/`, {
        headers: { "x-api-key": input },
      });

      if (res.ok) {
        const data = await res.json();

        // 2. Verificamos si el rol devuelto coincide con el seleccionado
        if (data.role === selectedRole) {
          // --- PERSISTENCIA DE SESIÓN ---
          // Si marcó "Recordarme", usamos localStorage (persistente).
          // Si no, sessionStorage (se borra al cerrar pestaña).
          const storage = rememberMe ? localStorage : sessionStorage;

          storage.setItem("api_key", input);
          storage.setItem("role", data.role);

          // --- REDIRECCIÓN INTELIGENTE ---
          // Leemos el parámetro 'returnTo' de la URL (inyectado por ProtectedRoute)
          const searchParams = new URLSearchParams(location.search);
          const returnTo = searchParams.get("returnTo");

          let destino = "/";

          if (returnTo && returnTo !== "/" && returnTo !== "null") {
            // Si venía de un link específico (ej: /producto/X), volvemos ahí
            destino = decodeURIComponent(returnTo);
          } else {
            // Si entró directo al login, vamos al home de su rol
            if (data.role === "DEPOSITO") destino = "/logistica";
            else if (data.role === "MANTENIMIENTO") destino = "/mantenimiento";
            else destino = "/";
          }

          // Usamos replace para limpiar el historial y forzar la carga correcta del router
          window.location.replace(destino);
        } else {
          setError(
            `Esta contraseña no es de ${rolesConfig[selectedRole].title}`,
          );
          setLoading(false);
        }
      } else {
        setError("Contraseña incorrecta");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Error de conexión con el servidor");
      setLoading(false);
    }
  };

  // VISTA 1: SELECCIÓN DE ROL
  if (!selectedRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4 animate-in fade-in zoom-in duration-300">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 drop-shadow-lg text-center">
          Bienvenido al Sistema
        </h2>
        <p className="text-gray-400 mb-8 text-center">
          Seleccione su perfil para ingresar
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl">
          {Object.entries(rolesConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setSelectedRole(key)}
              className={`group bg-slate-800 border-2 p-8 rounded-3xl transition-all shadow-2xl flex flex-col items-center gap-4 w-full transform hover:-translate-y-2 ${config.color}`}
            >
              <div className="text-6xl transition-colors">{config.icon}</div>
              <span className="text-xl font-bold">{config.title}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // VISTA 2: FORMULARIO DE PASSWORD
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 pt-10 px-4">
      <div className="relative w-full max-w-md">
        <button
          onClick={() => {
            setSelectedRole(null);
            setError("");
            setInput("");
          }}
          className="absolute -top-12 left-0 text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          <FaArrowLeft /> Volver
        </button>

        <div className="bg-slate-800 rounded-xl shadow-2xl p-8 w-full border border-slate-700 animate-in slide-in-from-right-10 duration-300">
          <h2 className="text-3xl font-bold text-white mb-2 text-center flex justify-center gap-2 items-center">
            <FaLock className="text-blue-500" />{" "}
            {rolesConfig[selectedRole].title}
          </h2>
          <p className="text-gray-400 text-center text-sm mb-6">
            Ingrese su clave de seguridad
          </p>

          <form onSubmit={handleLogin}>
            <div className="relative mb-4">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                <FaKey />
              </span>
              <input
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full p-3 pl-10 bg-slate-900 text-white rounded-lg border border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-600"
                placeholder="********"
                autoFocus
                disabled={loading}
              />
            </div>

            {/* Checkbox "Recordarme" */}
            <div className="flex items-center mb-6">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-slate-900 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 text-sm font-medium text-gray-400 cursor-pointer select-none hover:text-gray-300 transition-colors"
              >
                Mantener sesión iniciada
              </label>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-center text-sm mb-4 bg-red-900/20 p-3 rounded border border-red-900/50 flex items-center justify-center gap-2"
              >
                <FaLock /> {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !input}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <FaSpinner className="animate-spin" />
              ) : (
                "Entrar al Sistema"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
