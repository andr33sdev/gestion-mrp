import React, { useState, useEffect } from "react";
import {
  FaUserShield,
  FaCheckCircle,
  FaExclamationTriangle,
  FaUserLock,
  FaUserCheck,
  FaKey,
  FaTrash,
  FaEdit,
  FaTimes,
  FaBriefcase,
  FaPlus,
  FaSave,
  FaSpinner,
  FaChevronDown,
  FaUserEdit,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { API_BASE_URL, authFetch } from "../utils.js";
import { getAuthData } from "../auth/authHelper.js";

// Catálogo maestro unificado idéntico al Sidebar de Conoflex
const MODULOS_DISPONIBLES = [
  { key: "INICIO", label: "Inicio / Horno N°2" },
  { key: "PROYECTOS", label: "Proyectos y Tareas" },
  { key: "STOCK_ML", label: "Stock MercadoLibre" },
  { key: "PLANIFICACION", label: "Planificación / Centro de Datos" },
  { key: "METRICAS", label: "Métricas (Análisis)" },
  { key: "REGISTRO", label: "Registrar Producción" },
  { key: "LOGISTICA", label: "Logística" },
  { key: "COMPRAS", label: "Buzón Compras / Compras" },
  { key: "EQUIPO", label: "Equipo (Operarios)" },
  { key: "HOJA_RUTA", label: "Hoja de Ruta" },
  { key: "INGENIERIA", label: "Ingeniería / Cambios Prod." },
  { key: "RRHH", label: "RRHH" },
  { key: "MANTENIMIENTO", label: "Mantenimiento" },
  { key: "ACCESOS_ADMIN", label: "Accesos (Administrador)" },
];

export default function GestorUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados del Modal de Edición de Usuario
  const [modalOpen, setModalOpen] = useState(false);
  const [usuarioEdit, setUsuarioEdit] = useState(null);

  // Estados del Modal del Catálogo de Puestos
  const [modalPuestosOpen, setModalPuestosOpen] = useState(false);
  const [nuevoPuesto, setNuevoPuesto] = useState("");
  const [puestoEditId, setPuestoEditId] = useState(null);
  const [puestoEditName, setPuestoEditName] = useState("");

  const { user: currentUser } = getAuthData();

  const esRolAdmin = (rol) => {
    if (!rol) return false;
    const r = String(rol)
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    return (
      r === "GERENCIA" || r === "JEFE PRODUCCION" || r === "JEFE PRODUCCIÓN"
    );
  };

  const cargarDatos = async () => {
    try {
      const [resUsu, resPuestos] = await Promise.all([
        authFetch(`${API_BASE_URL}/auth/admin/usuarios`),
        authFetch(`${API_BASE_URL}/auth/admin/puestos`),
      ]);
      if (resUsu.ok) {
        const data = await resUsu.json();
        setUsuarios(
          data.map((u) => ({
            ...u,
            modulos_acceso:
              typeof u.modulos_acceso === "string"
                ? JSON.parse(u.modulos_acceso)
                : u.modulos_acceso || [],
          })),
        );
      }
      if (resPuestos.ok) {
        setPuestos(await resPuestos.json());
      }
    } catch (error) {
      toast.error("Error de conexión al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // ==================================================
  // LÓGICA DE USUARIOS
  // ==================================================
  const abrirModalUsuario = (user) => {
    setUsuarioEdit(JSON.parse(JSON.stringify(user)));
    setModalOpen(true);
  };

  const toggleModuloEdit = (moduloKey) => {
    if (esRolAdmin(usuarioEdit.rol)) return;

    const tiene = usuarioEdit.modulos_acceso.includes(moduloKey);
    setUsuarioEdit({
      ...usuarioEdit,
      modulos_acceso: tiene
        ? usuarioEdit.modulos_acceso.filter((m) => m !== moduloKey)
        : [...usuarioEdit.modulos_acceso, moduloKey],
    });
  };

  const guardarUsuario = async () => {
    if (!usuarioEdit.nombre.trim())
      return toast.error("El nombre no puede estar vacío.");

    const loadingToast = toast.loading("Guardando cambios...");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/auth/admin/usuarios/${usuarioEdit.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: usuarioEdit.nombre,
            activo: usuarioEdit.activo,
            rol: usuarioEdit.rol,
            modulos_acceso: usuarioEdit.modulos_acceso,
          }),
        },
      );

      if (res.ok) {
        if (usuarioEdit.id === currentUser?.id) {
          const authData = JSON.parse(localStorage.getItem("mrp_data") || "{}");
          if (authData.user) {
            authData.user.nombre = usuarioEdit.nombre;
            localStorage.setItem("mrp_data", JSON.stringify(authData));
          }

          toast.success("Tu perfil se actualizó. Refrescando...", {
            id: loadingToast,
          });

          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          toast.success("Usuario actualizado correctamente", {
            id: loadingToast,
          });
          setModalOpen(false);
          cargarDatos();
        }
      } else throw new Error();
    } catch (e) {
      toast.error("Error al guardar cambios", { id: loadingToast });
    }
  };

  const eliminarUsuario = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar definitivamente a ${nombre}?`)) return;

    const loadingToast = toast.loading("Eliminando usuario...");
    try {
      const res = await authFetch(`${API_BASE_URL}/auth/admin/usuarios/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Usuario eliminado", { id: loadingToast });
        cargarDatos();
      } else {
        const d = await res.json();
        toast.error(d.msg || "Error al eliminar", { id: loadingToast });
      }
    } catch (e) {
      toast.error("Error de red al eliminar", { id: loadingToast });
    }
  };

  // ==================================================
  // LÓGICA DEL CATÁLOGO DE PUESTOS
  // ==================================================
  const agregarPuesto = async () => {
    if (!nuevoPuesto.trim()) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/auth/admin/puestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoPuesto }),
      });
      if (res.ok) {
        setNuevoPuesto("");
        cargarDatos();
        toast.success("Puesto agregado al catálogo");
      }
    } catch (e) {
      toast.error("Error al crear puesto");
    }
  };

  const guardarEdicionPuesto = async (id, nombreViejo) => {
    if (!puestoEditName.trim()) return setPuestoEditId(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/auth/admin/puestos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreViejo, nombreNuevo: puestoEditName }),
      });
      if (res.ok) {
        setPuestoEditId(null);
        cargarDatos();
        toast.success("Catálogo actualizado");
      }
    } catch (e) {
      toast.error("Error al editar puesto");
    }
  };

  const eliminarPuesto = async (id) => {
    if (
      !window.confirm(
        "¿Eliminar este puesto del catálogo? (Los usuarios conservarán el nombre actual).",
      )
    )
      return;
    try {
      const res = await authFetch(`${API_BASE_URL}/auth/admin/puestos/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        cargarDatos();
        toast.success("Puesto eliminado");
      }
    } catch (e) {
      toast.error("Error al eliminar puesto");
    }
  };

  return (
    <div className="min-h-full bg-[#fafafa] flex flex-col font-sans pb-12">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-5 md:px-10 md:py-6 shrink-0 z-20 sticky top-0">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shadow-sm shrink-0">
              <FaKey size={18} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight leading-none">
                Directorio de Accesos
              </h1>
              <p className="text-[11px] font-medium text-slate-400 mt-1.5 tracking-wide">
                Gestioná usuarios, asigná puestos y definí permisos.
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalPuestosOpen(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-blue-600 font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm hover:bg-slate-50 transition-all active:scale-95 cursor-pointer"
          >
            <FaBriefcase className="text-blue-400" /> Catálogo de Puestos
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col mt-2">
        <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Usuario
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Puesto / Rol
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
                    Permisos
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-16 text-center text-slate-400"
                    >
                      <FaSpinner className="animate-spin text-2xl mx-auto opacity-50" />
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-12 text-center text-slate-400 font-medium text-sm"
                    >
                      No hay usuarios registrados
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                          {u.nombre}
                          {esRolAdmin(u.rol) && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-bold uppercase tracking-widest border border-emerald-100">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-slate-400 text-xs mt-0.5">
                          {u.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {u.rol || "SIN ASIGNAR"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${u.activo ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-500 border-rose-100"}`}
                        >
                          {u.activo ? (
                            <>
                              <FaUserCheck size={10} /> Activo
                            </>
                          ) : (
                            <>
                              <FaUserLock size={10} /> Bloqueado
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-medium text-slate-500">
                          {esRolAdmin(u.rol)
                            ? "Acceso Total"
                            : `${u.modulos_acceso?.length || 0} Módulos`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100">
                          <button
                            onClick={() => abrirModalUsuario(u)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                            title="Editar Permisos"
                          >
                            <FaEdit size={14} />
                          </button>
                          <button
                            onClick={() => eliminarUsuario(u.id, u.nombre)}
                            disabled={u.id === currentUser?.id}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Eliminar Usuario"
                          >
                            <FaTrash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL 1: EDITAR USUARIO */}
      <AnimatePresence>
        {modalOpen && usuarioEdit && (
          <div className="fixed inset-0 z-[8000] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100"
            >
              <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    Editar Perfil de Usuario
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    {usuarioEdit.nombre} ({usuarioEdit.email})
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-400 hover:text-rose-500 p-2 bg-white rounded-full shadow-sm border border-slate-100 transition-all active:scale-95 cursor-pointer"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                    Nombre Completo
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                      <FaUserEdit size={14} />
                    </div>
                    <input
                      type="text"
                      value={usuarioEdit.nombre}
                      onChange={(e) =>
                        setUsuarioEdit({
                          ...usuarioEdit,
                          nombre: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-700 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                      placeholder="Escribir nombre..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 pl-1">
                      Estado de Cuenta
                    </label>
                    <button
                      onClick={() =>
                        setUsuarioEdit({
                          ...usuarioEdit,
                          activo: !usuarioEdit.activo,
                        })
                      }
                      disabled={usuarioEdit.id === currentUser?.id}
                      className={`w-full flex justify-center items-center gap-2 px-4 py-3.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${usuarioEdit.activo ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"} disabled:opacity-50`}
                    >
                      {usuarioEdit.activo ? (
                        <>
                          <FaCheckCircle /> Cuenta Activa
                        </>
                      ) : (
                        <>
                          <FaUserLock /> Suspendida
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 pl-1">
                      Puesto / Rol
                    </label>
                    <div className="relative">
                      <select
                        value={usuarioEdit.rol || ""}
                        disabled={usuarioEdit.id === currentUser?.id}
                        onChange={(e) =>
                          setUsuarioEdit({
                            ...usuarioEdit,
                            rol: e.target.value,
                          })
                        }
                        className="w-full text-sm font-bold text-slate-700 px-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 bg-white appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="" disabled>
                          -- Seleccionar --
                        </option>
                        {puestos.map((p) => (
                          <option key={p.id} value={p.nombre}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                      <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-xs" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4 pl-1">
                    <FaUserShield className="text-slate-300" />
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      Permisos de Módulos
                    </label>
                  </div>

                  {esRolAdmin(usuarioEdit.rol) ? (
                    <div className="bg-blue-50 text-blue-700 text-xs font-medium px-5 py-4 rounded-2xl border border-blue-100 flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">
                        <FaKey size={14} />
                      </div>
                      <p>
                        Este usuario es <b>Administrador</b>. Tiene acceso
                        garantizado y total a todas las funciones del sistema,
                        no requiere asignación manual de módulos.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {MODULOS_DISPONIBLES.map((mod) => {
                        {
                          /* 🔥 FIX: Cambiado mod.id por mod.key para enlazar correctamente los strings del backend */
                        }
                        const tieneAcceso = usuarioEdit.modulos_acceso.includes(
                          mod.key,
                        );
                        return (
                          <button
                            key={mod.key}
                            onClick={() => toggleModuloEdit(mod.key)}
                            className={`text-left px-3.5 py-3 rounded-xl text-[11px] font-semibold transition-all border flex items-center justify-between group cursor-pointer ${tieneAcceso ? "bg-slate-800 border-slate-700 text-white shadow-md shadow-slate-200" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:shadow-sm"}`}
                          >
                            <span className="truncate pr-2">{mod.label}</span>
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors border-slate-300 group-hover:border-slate-400 ${tieneAcceso ? "bg-emerald-400 text-slate-900 border-emerald-400" : ""}`}
                            >
                              {tieneAcceso && <FaCheckCircle size={10} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-5 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2.5 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarUsuario}
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: CATÁLOG DE PUESTOS */}
      <AnimatePresence>
        {modalPuestosOpen && (
          <div className="fixed inset-0 z-[9000] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden border border-slate-100"
            >
              <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 shrink-0">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <FaBriefcase className="text-blue-400" size={16} /> Catálogo
                  de Puestos
                </h2>
                <button
                  onClick={() => setModalPuestosOpen(false)}
                  className="text-slate-400 hover:text-rose-500 p-2 bg-white rounded-full shadow-sm border border-slate-100 transition-all active:scale-95 cursor-pointer"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                  <input
                    type="text"
                    placeholder="Escribir nuevo puesto y presionar Enter..."
                    value={nuevoPuesto}
                    onChange={(e) => setNuevoPuesto(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && agregarPuesto()}
                    className="flex-1 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none placeholder-slate-400"
                  />
                  <button
                    onClick={agregarPuesto}
                    disabled={!nuevoPuesto.trim()}
                    className="bg-slate-800 hover:bg-slate-900 disabled:opacity-30 disabled:hover:bg-slate-800 text-white p-3 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <FaPlus size={12} />
                  </button>
                </div>

                <div className="space-y-2 mt-2">
                  {puestos.length === 0 && (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl">
                      <p className="text-xs text-slate-400 font-medium">
                        Catálogo vacío. Agrega el primer puesto.
                      </p>
                    </div>
                  )}
                  {puestos.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm transition-all group"
                    >
                      {puestoEditId === p.id ? (
                        <input
                          type="text"
                          value={puestoEditName}
                          onChange={(e) => setPuestoEditName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            guardarEdicionPuesto(p.id, p.nombre)
                          }
                          className="flex-1 text-sm font-semibold text-slate-700 bg-slate-50 border border-blue-200 rounded-xl px-3 py-1.5 outline-none mr-2 focus:ring-4 focus:ring-blue-50"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-semibold text-slate-600 pl-2">
                          {p.nombre}
                        </span>
                      )}

                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {puestoEditId === p.id ? (
                          <>
                            <button
                              onClick={() =>
                                guardarEdicionPuesto(p.id, p.nombre)
                              }
                              className="p-2 text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                              <FaSave size={14} />
                            </button>
                            <button
                              onClick={() => setPuestoEditId(null)}
                              className="p-2 text-slate-400 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              <FaTimes size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setPuestoEditId(p.id);
                                setPuestoEditName(p.nombre);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <FaEdit size={14} />
                            </button>
                            <button
                              onClick={() => eliminarPuesto(p.id)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <FaTrash size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
