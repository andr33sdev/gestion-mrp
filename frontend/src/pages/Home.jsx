import { motion } from "framer-motion";
import { FaUserTie, FaBars, FaArrowRight } from "react-icons/fa";
import { getAuthData } from "../auth/authHelper";

export default function Home() {
  const { user } = getAuthData();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8fafc] p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100"
      >
        <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <FaUserTie className="text-3xl text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tighter mb-2">
          ¡Hola, {user?.nombre || "Bienvenido"}!
        </h1>
        <p className="text-slate-400 font-medium text-sm leading-relaxed mb-8">
          Has ingresado a **Gestión MRP**. Tu panel está listo. Desliza el menú
          lateral para explorar los módulos disponibles.
        </p>
        <div className="flex items-center justify-center gap-3 text-blue-600 font-bold text-[10px] uppercase tracking-widest bg-blue-50 py-4 rounded-2xl border border-blue-100">
          <FaBars className="animate-pulse" /> Explora el menú lateral
        </div>
      </motion.div>
    </div>
  );
}
