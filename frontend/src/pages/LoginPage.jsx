import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaLock,
  FaEnvelope,
  FaUser,
  FaSignInAlt,
  FaUserPlus,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSpinner,
} from "react-icons/fa";
import { API_BASE_URL } from "../utils.js"; // Asegurate de que la ruta sea correcta

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMsg(null); // Limpiamos errores al escribir
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const endpoint = isLogin ? "/auth/login" : "/auth/register";

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || "Ocurrió un error inesperado.");
      }

      if (isLogin) {
        // --- LOGIN EXITOSO ---
        // Guardamos el token y los datos del usuario en el navegador
        localStorage.setItem("mrp_token", data.token);
        localStorage.setItem("mrp_user", JSON.stringify(data.usuario));

        // Recargamos la página para que la App lea el token y lo deje pasar
        window.location.href = "/";
      } else {
        // --- REGISTRO EXITOSO ---
        setSuccessMsg(data.msg);
        setIsLogin(true); // Lo pasamos a la pantalla de login
        setFormData({ nombre: "", email: "", password: "" }); // Limpiamos formulario
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 selection:bg-blue-200">
      <div className="w-full max-w-md">
        {/* LOGO O TÍTULO */}
        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <FaLock size={28} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Gestión MRP
          </h1>
          <p className="text-slate-500 font-medium mt-2 uppercase tracking-wider text-xs">
            Acceso Restringido
          </p>
        </div>

        {/* TARJETA PRINCIPAL */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login" : "register"}
              initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                {isLogin ? (
                  <>
                    <FaSignInAlt className="text-blue-500" /> Iniciar Sesión
                  </>
                ) : (
                  <>
                    <FaUserPlus className="text-emerald-500" /> Nuevo Registro
                  </>
                )}
              </h2>

              {errorMsg && (
                <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-bold flex items-start gap-3 shadow-sm animate-in fade-in zoom-in-95">
                  <FaExclamationTriangle className="mt-0.5 shrink-0 text-rose-500 text-base" />
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs font-bold flex items-start gap-3 shadow-sm animate-in fade-in zoom-in-95">
                  <FaCheckCircle className="mt-0.5 shrink-0 text-emerald-500 text-base" />
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                      Nombre Completo
                    </label>
                    <div className="relative">
                      <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        name="nombre"
                        required
                        value={formData.nombre}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder-slate-400"
                        placeholder="Ej: Juan Pérez"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder-slate-400"
                      placeholder="usuario@empresa.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder-slate-400"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] ${isLogin ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"} ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {loading ? (
                    <FaSpinner className="animate-spin text-lg" />
                  ) : isLogin ? (
                    "Ingresar al Sistema"
                  ) : (
                    "Crear Cuenta"
                  )}
                </button>
              </form>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* PIE DE PÁGINA (TOGGLE) */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-500 font-medium">
            {isLogin ? "¿No tenés una cuenta?" : "¿Ya estás registrado?"}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="ml-2 font-bold text-blue-600 hover:text-blue-800 transition-colors focus:outline-none"
            >
              {isLogin ? "Solicitar acceso" : "Iniciá sesión aquí"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
