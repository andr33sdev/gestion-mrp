import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

  // Estado para saber qué rol eligió el usuario (null = ninguno)
  const [selectedRole, setSelectedRole] = useState(null);

  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
          // Guardamos sesión
          sessionStorage.setItem("api_key", input);
          sessionStorage.setItem("role", data.role);

          // Redirigimos según el rol
          if (data.role === "DEPOSITO") navigate("/recepcion");
          else if (data.role === "MANTENIMIENTO") navigate("/mantenimiento");
          else navigate("/");

          // Recargamos para que App.jsx detecte el cambio de estado
          window.location.reload();
        } else {
          setError(
            `Esta contraseña no es de ${rolesConfig[selectedRole].title}`
          );
        }
      } else {
        setError("Contraseña incorrecta");
      }
    } catch (err) {
      console.error(err);
      setError("Error de conexión con el servidor");
    } finally {
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
            <div className="relative mb-6">
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
