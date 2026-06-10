import React, { useEffect, useState } from "react";
import {
  FaPlus,
  FaFolderPlus,
  FaUsers,
  FaUserPlus,
  FaCheckCircle,
  FaRegCircle,
  FaBriefcase,
  FaTasks,
  FaChartLine,
  FaFilePdf,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { API_BASE_URL, authFetch } from "../utils";
import { getAuthData } from "../auth/authHelper";
import Loader from "../components/Loader";

const PERSONAL_DISPONIBLE = [
  {
    nombre: "Andrés",
    rol: "Gerencia",
    inicial: "A",
    color: "from-amber-400 to-orange-500",
  },
  {
    nombre: "Leonel",
    rol: "Operario Panel",
    inicial: "L",
    color: "from-blue-400 to-indigo-600",
  },
  {
    nombre: "Mauro",
    rol: "Depósito",
    inicial: "M",
    color: "from-emerald-400 to-teal-600",
  },
];

export default function TableroPage() {
  const [proyectos, setProyectos] = useState([]);
  const [proyectoActivo, setProyectoActivo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modales
  const [isProjModalOpen, setIsProjModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isMicroModalOpen, setIsMicroModalOpen] = useState(false);

  // Formularios
  const [newProj, setNewProj] = useState({ nombre: "", descripcion: "" });
  const [newTask, setNewTask] = useState({
    titulo: "",
    descripcion: "",
    estado: "PENDIENTE",
  });
  const [newMicro, setNewMicro] = useState({
    tarea_id: null,
    asignado_a: "",
    descripcion: "",
  });

  // Autenticación
  const { user } = getAuthData();
  const nombreUsuario = user?.nombre || "Anónimo";
  let currentUser = nombreUsuario;
  if (user?.rol === "GERENCIA") currentUser = "Andrés";
  else if (user?.rol === "OPERARIO" || user?.rol === "PANEL")
    currentUser = "Leonel";
  else if (user?.rol === "DEPOSITO") currentUser = "Mauro";

  const loadTablero = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/tablero/proyectos`);
      if (res.ok) {
        const data = await res.json();
        setProyectos(data);
        if (data.length > 0) {
          const actual = proyectoActivo
            ? data.find((p) => p.id === proyectoActivo.id)
            : data[0];
          setProyectoActivo(actual || data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTablero();
  }, []);

  const handleCreateProyecto = async (e) => {
    e.preventDefault();
    if (!newProj.nombre) return toast.error("Ingresa el nombre del proyecto");
    try {
      const res = await authFetch(`${API_BASE_URL}/tablero/proyectos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProj),
      });
      if (res.ok) {
        toast.success("Proyecto abierto de manera exitosa");
        setNewProj({ nombre: "", descripcion: "" });
        setIsProjModalOpen(false);
        loadTablero();
      }
    } catch (e) {
      toast.error("Error al procesar");
    }
  };

  const handleCreateTarea = async (e) => {
    e.preventDefault();
    if (!newTask.titulo) return toast.error("Ingresa el título de la tarea");
    try {
      const res = await authFetch(`${API_BASE_URL}/tablero/tareas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newTask, proyecto_id: proyectoActivo.id }),
      });
      if (res.ok) {
        toast.success("Tarea inyectada al flujo");
        setNewTask({ titulo: "", descripcion: "", estado: "PENDIENTE" });
        setIsTaskModalOpen(false);
        loadTablero();
      }
    } catch (e) {
      toast.error("Error al crear tarea");
    }
  };

  const handleToggleMicro = async (id, actual) => {
    try {
      const res = await authFetch(
        `${API_BASE_URL}/tablero/microtareas/${id}/toggle`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completado: !actual }),
        },
      );
      if (res.ok) {
        toast.success("Avance micro guardado");
        loadTablero();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateMicro = async (e) => {
    e.preventDefault();
    if (!newMicro.descripcion)
      return toast.error("Especifica la micro-tarea individual");
    try {
      const res = await authFetch(
        `${API_BASE_URL}/tablero/tareas/${newMicro.tarea_id}/microtareas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asignado_a: newMicro.asignado_a,
            descripcion: newMicro.descripcion,
            creado_por: currentUser,
          }),
        },
      );
      if (res.ok) {
        toast.success(
          `Micro-tarea asignada y enviada a ${newMicro.asignado_a}`,
        );
        setNewMicro({ tarea_id: null, asignado_a: "", descripcion: "" });
        setIsMicroModalOpen(false);
        loadTablero();
      }
    } catch (e) {
      toast.error("Error de enlace");
    }
  };

  // Drag & Drop
  const handleDragStartPersona = (e, nombre) => {
    e.dataTransfer.setData("tipo", "PERSONA");
    e.dataTransfer.setData("valor", nombre);
  };

  const handleDragStartTarea = (e, taskId) => {
    e.dataTransfer.setData("tipo", "TAREA");
    e.dataTransfer.setData("valor", taskId);
  };

  const handleDropOnTask = (e, targetTaskId) => {
    e.preventDefault();
    e.stopPropagation();
    const tipo = e.dataTransfer.getData("tipo");
    const valor = e.dataTransfer.getData("valor");

    if (tipo === "PERSONA") {
      setNewMicro({
        tarea_id: targetTaskId,
        asignado_a: valor,
        descripcion: "",
      });
      setIsMicroModalOpen(true);
    }
  };

  const handleDropOnColumn = async (e, targetEstado) => {
    e.preventDefault();
    const tipo = e.dataTransfer.getData("tipo");
    const valor = e.dataTransfer.getData("valor");

    if (tipo === "TAREA") {
      try {
        const res = await authFetch(
          `${API_BASE_URL}/tablero/tareas/${valor}/posicion`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: targetEstado, posicion: 1 }),
          },
        );
        if (res.ok) {
          toast.success(
            `Tarjeta de tarea movilizada a ${targetEstado.replace("_", " ")}`,
          );
          loadTablero();
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // 🔥 EXPORTACIÓN CORREGIDA: Sin márgenes negativos riesgosos
  const handleExportarPDF = () => {
    if (!proyectoActivo) return;

    const printWindow = window.open("", "_blank");

    const tareasHTML = (proyectoActivo.tareas || [])
      .map((t) => {
        const microHTML = (t.micro_tareas || [])
          .map(
            (m) => `
        <div class="micro-item">
          <strong>@${m.asignado_a}:</strong> ${m.descripcion}
          <span class="status-tag ${m.completado ? "done" : "pending"}">${m.completado ? "Completado" : "Pendiente"}</span>
        </div>
      `,
          )
          .join("");

        let labelEstado = "Por Hacer";
        let dotColor = "pending";
        if (t.estado === "EN_PROCESO") {
          labelEstado = "En Proceso";
          dotColor = "process";
        }
        if (t.estado === "TERMINADO") {
          labelEstado = "Completado";
          dotColor = "done";
        }

        return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotColor}"></div>
          <div class="timeline-meta">Estado Actual: <span class="status-tag ${dotColor}">${labelEstado}</span></div>
          <div class="timeline-card">
            <h4 class="timeline-title">${t.titulo}</h4>
            <p class="timeline-desc">${t.descripcion || "Sin especificaciones añadidas."}</p>
            ${
              microHTML
                ? `
              <div class="micro-box">
                <div class="micro-box-title">Asignaciones Individuales (Fuerza de Planta)</div>
                ${microHTML}
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte - ${proyectoActivo.nombre}</title>
        <style>
          @page { size: A4; margin: 15mm; background-color: #fcfbf9; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #334155; margin: 0; background-color: #fcfbf9; font-size: 10pt; line-height: 1.5; padding-top: 5mm; }
          
          /* CORRECCIÓN: Encabezado encapsulado con bordes redondeados, dentro de los márgenes de impresión seguros */
          .header { background-color: #0f172a; color: white; padding: 25px; border-radius: 20px; margin-bottom: 25px; border-bottom: 4px solid #2196f3; }
          .header-table { display: table; width: 100%; }
          .header-row { display: table-row; }
          .header-cell { display: table-cell; vertical-align: middle; }
          .header-right { display: table-cell; vertical-align: middle; text-align: right; }
          .header h1 { margin: 0; font-size: 18pt; font-weight: 900; letter-spacing: -0.5px; }
          .header p { margin: 4px 0 0 0; font-size: 8.5pt; color: #38bdf8; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          
          .badge { background-color: #10b981; color: white; padding: 5px 12px; border-radius: 8px; font-size: 8pt; font-weight: bold; text-transform: uppercase; }
          .section-title { font-size: 11pt; color: #0f172a; font-weight: bold; border-left: 4px solid #2196f3; padding-left: 8px; margin: 25px 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta-table { display: table; width: 100%; background: white; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 20px; padding: 12px; }
          .meta-cell { display: table-cell; width: 50%; padding: 6px 12px; }
          .meta-label { font-size: 8pt; font-weight: bold; color: #94a3b8; text-transform: uppercase; }
          .meta-value { font-size: 10pt; font-weight: bold; color: #334155; margin-top: 2px; }
          .timeline-container { margin-left: 10px; border-left: 2px dashed #e2e8f0; padding-left: 20px; }
          .timeline-item { position: relative; margin-bottom: 20px; page-break-inside: avoid; }
          .timeline-dot { position: absolute; left: -26px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background-color: #fb8c00; border: 2px solid #fcfbf9; box-shadow: 0 0 0 2px #fb8c00; }
          .timeline-dot.process { background-color: #2196f3; box-shadow: 0 0 0 2px #2196f3; }
          .timeline-dot.done { background-color: #10b981; box-shadow: 0 0 0 2px #10b981; }
          .timeline-meta { font-size: 8.5pt; font-weight: bold; color: #64748b; margin-bottom: 4px; }
          .timeline-card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; }
          .timeline-title { font-size: 10.5pt; font-weight: bold; color: #0f172a; margin: 0 0 4px 0; }
          .timeline-desc { font-size: 9.5pt; color: #475569; margin: 0; }
          .micro-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; margin-top: 8px; }
          .micro-box-title { font-size: 7.5pt; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
          .micro-item { font-size: 9pt; font-weight: 600; color: #334155; padding: 3px 0; }
          .status-tag { font-size: 7pt; font-weight: bold; padding: 1px 5px; border-radius: 4px; display: inline-block; margin-left: 4px; text-transform: uppercase; }
          .status-tag.done { background-color: #e8f5e9; color: #2e7d32; }
          .status-tag.pending { background-color: #fff8e1; color: #b78103; }
          .status-tag.process { background-color: #e3f2fd; color: #1565c0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-table">
            <div class="header-row">
              <div class="header-cell">
                <h1>Historia Clínica de Manufactura</h1>
                <p>GestionMRP &bull; Auditoría de Procesos Abiertos</p>
              </div>
              <div class="header-right">
                <span class="badge">Lote en Curso</span>
              </div>
            </div>
          </div>
        </div>

        <div class="section-title">Información del Objetivo Activo</div>
        <div class="meta-table">
          <div class="header-row">
            <div class="meta-cell">
              <div class="meta-label">Proyecto Indexado</div>
              <div class="meta-value">${proyectoActivo.nombre}</div>
            </div>
            <div class="meta-cell">
              <div class="meta-label">Porcentaje de Avance</div>
              <div class="meta-value">${progresoPorcentaje}% de tareas resueltas</div>
            </div>
          </div>
        </div>

        <div class="section-title">Despliegue Cronológico de Operaciones</div>
        <div class="timeline-container">
          ${tareasHTML}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  const totalTareas = proyectoActivo?.tareas?.length || 0;
  const terminadasCount =
    proyectoActivo?.tareas?.filter((t) => t.estado === "TERMINADO").length || 0;
  const progresoPorcentaje =
    totalTareas > 0 ? Math.round((terminadasCount / totalTareas) * 100) : 0;

  if (loading)
    return (
      <div className="h-full flex items-center justify-center bg-[#fcfbf9]">
        <Loader />
      </div>
    );

  return (
    <div className="min-h-full bg-[#fcfbf9] p-4 md:p-8 flex flex-col font-sans animate-in fade-in pb-16">
      {/* HEADER DE MESA DE CONTROL CON SELECTOR PREMIUM */}
      <header className="bg-white rounded-3xl p-6 border border-stone-100/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 shrink-0 pr-20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 shrink-0">
            <FaBriefcase size={18} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">
              Workspace & Proyectos
            </h1>
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
              Co-working interactivo y despliegue de objetivos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex items-center bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5">
            <select
              className="bg-transparent font-bold text-xs p-1.5 outline-none text-slate-700 pr-6 cursor-pointer appearance-none"
              value={proyectoActivo?.id || ""}
              onChange={(e) =>
                setProyectoActivo(
                  proyectos.find((p) => p.id === parseInt(e.target.value)),
                )
              }
            >
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <div className="absolute right-3 pointer-events-none text-stone-400 text-[10px]">
              ▼
            </div>
          </div>

          <button
            onClick={handleExportarPDF}
            className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-5 py-3.5 rounded-xl shadow-[0_6px_20px_rgba(225,29,72,0.25)] transition-all active:scale-95 cursor-pointer tracking-wider"
          >
            <FaFilePdf size={13} /> EXPORTAR PDF
          </button>

          <button
            onClick={() => setIsProjModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-[#2196f3] hover:bg-blue-600 text-white font-black text-xs px-5 py-3.5 rounded-xl shadow-[0_6px_20px_rgba(33,150,243,0.3)] transition-all active:scale-95 cursor-pointer tracking-wider"
          >
            <FaFolderPlus size={14} /> INICIAR PROYECTO
          </button>
        </div>
      </header>

      {/* METRICAS DE RENDIMIENTO GRÁFICAS */}
      {proyectoActivo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
          <div className="bg-white border border-stone-100 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">
                Estatus General
              </span>
              <h3 className="text-lg font-black text-slate-800">
                {proyectoActivo.nombre}
              </h3>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-600 font-black text-[9px] uppercase tracking-widest rounded-lg">
              {proyectoActivo.estado}
            </span>
          </div>

          <div className="bg-white border border-stone-100 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest block mb-1">
                Carga Logística de Objetivos
              </span>
              <h3 className="text-lg font-black text-slate-800">
                {terminadasCount} de {totalTareas} completadas
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2196f3] flex items-center justify-center">
              <FaChartLine size={16} />
            </div>
          </div>

          <div className="bg-white border border-stone-100 rounded-2xl p-4.5 flex flex-col justify-center shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">
                Sincronización Total
              </span>
              <span className="text-xs font-black text-[#2196f3]">
                {progresoPorcentaje}%
              </span>
            </div>
            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progresoPorcentaje}%` }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* FLUJO DE TRABAJO */}
      {!proyectoActivo ? (
        <div className="flex-1 bg-white border-2 border-dashed border-stone-200 rounded-[2.5rem] flex flex-col items-center justify-center py-24 shadow-sm">
          <FaBriefcase size={36} className="text-stone-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-700">
            No se detectan proyectos
          </h3>
          <p className="text-xs text-stone-400 mt-1">
            Genera un proyecto maestro en la parte superior para desplegar el
            flujo.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden items-stretch">
          {/* ASIGNACIONES (POOL LATERAL DE PERSONAL) */}
          <div className="w-full lg:w-64 bg-white border border-stone-100 p-5 rounded-3xl flex flex-col shrink-0 shadow-sm relative overflow-hidden">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
              <FaUsers size={12} /> Recursos Humanos Disp.
            </h3>
            <p className="text-[11px] text-stone-400 font-semibold mb-5 leading-normal">
              Arrastra un perfil y suéltalo dentro de una tarjeta para segmentar
              una micro-tarea específica.
            </p>

            <div className="space-y-2.5">
              {PERSONAL_DISPONIBLE.map((p) => (
                <div
                  key={p.nombre}
                  draggable
                  onDragStart={(e) => handleDragStartPersona(e, p.nombre)}
                  className="flex items-center justify-between p-3 bg-stone-50 hover:bg-stone-100/70 border border-stone-200/60 rounded-xl shadow-sm cursor-grab active:cursor-grabbing group transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${p.color} text-white flex items-center justify-center font-black text-xs shadow-sm`}
                    >
                      {p.inicial}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 group-hover:text-[#2196f3] transition-colors">
                        {p.nombre}
                      </h4>
                      <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">
                        {p.rol}
                      </p>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 text-[10px] text-[#2196f3] font-bold transition-all pr-1">
                    Mover →
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 lg:mt-auto pt-4 border-t border-stone-100">
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                <FaPlus size={10} /> CREAR TAREA MAESTRA
              </button>
            </div>
          </div>

          {/* TABLERO KANBAN TRIPLE COLUMNA */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {["PENDIENTE", "EN_PROCESO", "TERMINADO"].map((columna) => {
              const tareasFiltradas = (proyectoActivo.tareas || []).filter(
                (t) => t.estado === columna,
              );

              let labelCol = "Por Hacer";
              let colorCol = "border-amber-400 bg-amber-500/5";
              if (columna === "EN_PROCESO") {
                labelCol = "En Proceso";
                colorCol = "border-blue-400 bg-blue-500/5";
              }
              if (columna === "TERMINADO") {
                labelCol = "Completado";
                colorCol = "border-emerald-400 bg-emerald-500/5";
              }

              return (
                <div
                  key={columna}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnColumn(e, columna)}
                  className={`border border-transparent rounded-[2rem] p-4 flex flex-col transition-all min-h-[350px] ${colorCol}`}
                >
                  {/* Badge de Columna */}
                  <div className="flex justify-between items-center mb-4 px-2 shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 bg-white border border-stone-200 px-3 py-1.5 rounded-full shadow-sm">
                      {labelCol}
                    </span>
                    <span className="text-xs font-black text-slate-500 bg-white border border-stone-200 w-6 h-6 rounded-lg flex items-center justify-center shadow-sm">
                      {tareasFiltradas.length}
                    </span>
                  </div>

                  {/* Cuerpo Scrolleable */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar max-h-[60vh] md:max-h-[68vh]">
                    <AnimatePresence mode="popLayout">
                      {tareasFiltradas.map((tarea) => {
                        const totalMicro = tarea.micro_tareas?.length || 0;
                        const completasMicro =
                          tarea.micro_tareas?.filter((m) => m.completado)
                            .length || 0;
                        const pctMicro =
                          totalMicro > 0
                            ? Math.round((completasMicro / totalMicro) * 100)
                            : 0;

                        return (
                          <motion.div
                            key={tarea.id}
                            layout
                            draggable
                            onDragStart={(e) =>
                              handleDragStartTarea(e, tarea.id)
                            }
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDropOnTask(e, tarea.id)}
                            className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all cursor-grab active:cursor-grabbing group relative overflow-hidden"
                          >
                            <h4 className="text-xs font-black text-slate-800 leading-snug group-hover:text-[#2196f3] transition-colors mb-1.5">
                              {tarea.titulo}
                            </h4>
                            {tarea.descripcion && (
                              <p className="text-[11px] font-semibold text-stone-400 line-clamp-2 leading-relaxed mb-4">
                                {tarea.descripcion}
                              </p>
                            )}

                            {totalMicro > 0 && (
                              <div className="mb-4">
                                <div className="flex justify-between items-center text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">
                                  <span>Progreso micro</span>
                                  <span className="font-black text-slate-700">
                                    {completasMicro}/{totalMicro}
                                  </span>
                                </div>
                                <div className="w-full bg-stone-50 border border-stone-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                                    style={{ width: `${pctMicro}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {tarea.micro_tareas &&
                              tarea.micro_tareas.length > 0 && (
                                <div className="border-t border-stone-50 pt-3.5 space-y-2">
                                  {tarea.micro_tareas.map((m) => (
                                    <div
                                      key={m.id}
                                      onClick={() =>
                                        handleToggleMicro(m.id, m.completado)
                                      }
                                      className={`flex items-start gap-2.5 p-2 rounded-xl border transition-all cursor-pointer text-[11px] font-bold ${m.completado ? "bg-stone-50/50 border-stone-100 text-stone-400" : "bg-white border-stone-200/70 text-slate-600 shadow-sm hover:border-stone-300"}`}
                                    >
                                      <button className="text-stone-400 shrink-0 mt-0.5 outline-none">
                                        {m.completado ? (
                                          <FaCheckCircle
                                            size={13}
                                            className="text-emerald-500"
                                          />
                                        ) : (
                                          <FaRegCircle size={13} />
                                        )}
                                      </button>
                                      <span className="leading-tight">
                                        <strong className="text-slate-800 font-extrabold mr-1">
                                          @{m.asignado_a}:
                                        </strong>
                                        <span
                                          className={
                                            m.completado
                                              ? "line-through text-stone-400"
                                              : ""
                                          }
                                        >
                                          {m.descripcion}
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- MODAL DE PROYECTO --- */}
      <AnimatePresence>
        {isProjModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-6 md:p-8 border border-stone-100"
            >
              <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2.5">
                <FaFolderPlus className="text-[#2196f3]" /> Lanzar Nuevo
                Proyecto
              </h3>
              <form onSubmit={handleCreateProyecto} className="space-y-4">
                <input
                  type="text"
                  placeholder="Nombre identificador del proyecto..."
                  className="w-full bg-stone-50 border border-transparent focus:border-blue-200 focus:bg-white rounded-xl p-3.5 text-xs font-bold outline-none shadow-inner"
                  value={newProj.nombre}
                  onChange={(e) =>
                    setNewProj({ ...newProj, nombre: e.target.value })
                  }
                />
                <textarea
                  placeholder="Descripción general o directivas base del lote..."
                  rows="3"
                  className="w-full bg-stone-50 border border-transparent focus:border-blue-200 focus:bg-white rounded-xl p-3.5 text-xs font-bold outline-none resize-none shadow-inner"
                  value={newProj.descripcion}
                  onChange={(e) =>
                    setNewProj({ ...newProj, descripcion: e.target.value })
                  }
                />
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsProjModalOpen(false)}
                    className="flex-1 bg-stone-100 hover:bg-stone-200 text-slate-600 font-bold text-xs py-3.5 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#2196f3] hover:bg-blue-600 text-white font-black text-xs py-3.5 rounded-xl shadow-md tracking-wide"
                  >
                    Crear Proyecto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL DE TAREA MAYOR --- */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-6 md:p-8 border border-stone-100"
            >
              <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2.5">
                <FaTasks className="text-slate-800" /> Registrar Objetivo
                Principal
              </h3>
              <form onSubmit={handleCreateTarea} className="space-y-4">
                <input
                  type="text"
                  placeholder="Título de la operation (Ej: Extrusión Base)"
                  className="w-full bg-stone-50 border border-transparent focus:border-blue-200 focus:bg-white rounded-xl p-3.5 text-xs font-bold outline-none shadow-inner"
                  value={newTask.titulo}
                  onChange={(e) =>
                    setNewTask({ ...newTask, titulo: e.target.value })
                  }
                />
                <textarea
                  placeholder="Especificaciones de manufactura o control..."
                  rows="3"
                  className="w-full bg-stone-50 border border-transparent focus:border-blue-200 focus:bg-white rounded-xl p-3.5 text-xs font-bold outline-none resize-none shadow-inner"
                  value={newTask.descripcion}
                  onChange={(e) =>
                    setNewTask({ ...newTask, descripcion: e.target.value })
                  }
                />
                <select
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs font-bold outline-none cursor-pointer text-slate-700"
                  value={newTask.estado}
                  onChange={(e) =>
                    setNewTask({ ...newTask, estado: e.target.value })
                  }
                >
                  <option value="PENDIENTE">Columna inicial: Por Hacer</option>
                  <option value="EN_PROCESO">
                    Columna inicial: En Proceso
                  </option>
                </select>
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="flex-1 bg-stone-100 hover:bg-stone-200 text-slate-600 font-bold text-xs py-3.5 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-3.5 rounded-xl shadow-md tracking-wide"
                  >
                    Añadir Tarjeta
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL DE ASIGNACIÓN AL SOLTAR (FROSTED GLASS EFFECT) --- */}
      <AnimatePresence>
        {isMicroModalOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/20 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white/85 backdrop-blur-xl w-full max-w-sm rounded-[2.5rem] shadow-2xl p-6 md:p-8 border border-white/60"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-50 border border-blue-100 text-[#2196f3] rounded-xl flex items-center justify-center shadow-sm">
                  <FaUserPlus size={14} />
                </div>
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-stone-400">
                    Inyección de Tarea Individual
                  </h3>
                  <h4 className="text-sm font-black text-slate-800 mt-0.5">
                    Asignar a @{newMicro.asignado_a}
                  </h4>
                </div>
              </div>
              <form onSubmit={handleCreateMicro} className="space-y-4">
                <p className="text-[11px] font-semibold text-stone-500 leading-relaxed">
                  Ingresa la micro-tarea de planta específica que esta persona
                  recibirá en su buzón de alertas.
                </p>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ej: Monitorear tolva de enfriamiento..."
                  className="w-full bg-white border border-stone-200 shadow-sm focus:border-blue-300 rounded-xl p-3.5 text-xs font-bold outline-none transition-all"
                  value={newMicro.descripcion}
                  onChange={(e) =>
                    setNewMicro({ ...newMicro, descripcion: e.target.value })
                  }
                />
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMicroModalOpen(false);
                      setNewMicro({
                        tarea_id: null,
                        asignado_a: "",
                        descripcion: "",
                      });
                    }}
                    className="flex-1 bg-stone-100 hover:bg-stone-200 text-slate-600 font-bold text-xs py-3 rounded-xl transition-all"
                  >
                    Anular
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#2196f3] hover:bg-blue-600 text-white font-black text-xs py-3 rounded-xl shadow-md tracking-wide"
                  >
                    Confirmar Orden
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
