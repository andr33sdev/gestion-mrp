import { useState, useEffect } from "react";
import { API_BASE_URL, authFetch } from "../utils.js";
import {
  FaShoppingCart,
  FaSearch,
  FaTrash,
  FaFilePdf,
  FaSpinner,
  FaPlus,
  FaHistory,
  FaClipboardList,
  FaCheckCircle,
  FaClock,
  FaTimes,
  FaEdit,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationTriangle,
  FaArrowRight,
  FaBoxOpen,
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";

const imprimirSolicitud = (id, items, fechaStr) => {
  const doc = new jsPDF();
  const fecha = new Date(fechaStr).toLocaleDateString("es-AR");

  // --- PALETA DE COLORES "LEBANE" ---
  const slate900 = [15, 23, 42]; // Textos principales
  const slate500 = [100, 116, 139]; // Textos secundarios
  const slate200 = [226, 232, 240]; // Bordes
  const slate50 = [248, 250, 252]; // Fondos sutiles

  // --- CABECERA (HEADER) ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...slate900);
  doc.text("Gestión MRP", 14, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...slate500);
  doc.text("SOLICITUD OFICIAL DE COMPRAS", 14, 28);

  // Recuadro de Metadatos (Arriba a la derecha)
  doc.setDrawColor(...slate200);
  doc.setFillColor(...slate50);
  doc.roundedRect(135, 12, 60, 22, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...slate900);
  doc.text("SOLICITUD N°", 140, 20);
  doc.text("FECHA EMISIÓN", 140, 28);

  doc.setFont("helvetica", "normal");
  doc.text(`# ${id}`, 190, 20, { align: "right" });
  doc.text(fecha, 190, 28, { align: "right" });

  // Línea divisoria elegante
  doc.setDrawColor(...slate200);
  doc.line(14, 36, 195, 36);

  // --- BLOQUE DESTINATARIO ---
  const startY = 46;
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(14, startY, 80, 18, 2, 2, "F");

  // Detalle de diseño: Pequeña barrita azul de acento a la izquierda del cuadro
  doc.setFillColor(59, 130, 246); // Blue 500
  doc.rect(14, startY, 2, 18, "F");

  doc.setFontSize(8);
  doc.setTextColor(...slate500);
  doc.text("DESTINATARIO:", 20, startY + 7);

  doc.setFontSize(10);
  doc.setTextColor(...slate900);
  doc.setFont("helvetica", "bold");
  doc.text("DEPARTAMENTO DE COMPRAS", 20, startY + 13);

  // --- TABLA DE MATERIALES (Diseño Limpio) ---
  const tableBody = items.map((item) => [
    item.codigo || "S/C",
    item.nombre || "Material Desconocido",
    item.cantidad,
    item.proveedor_recomendado || item.proveedor || "-",
  ]);

  autoTable(doc, {
    startY: startY + 28,
    head: [
      ["CÓDIGO", "DESCRIPCIÓN DEL MATERIAL", "CANTIDAD", "PROV. SUGERIDO"],
    ],
    body: tableBody,
    theme: "plain", // Elimina el enrejado tosco por defecto
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: slate50,
      textColor: slate900,
      fontStyle: "bold",
      lineWidth: { bottom: 0.5, top: 0.5 }, // Solo líneas horizontales en el header
      lineColor: slate200,
    },
    bodyStyles: {
      lineWidth: { bottom: 0.1 }, // Línea súper sutil dividiendo filas
      lineColor: slate200,
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [71, 85, 105], width: 35 },
      2: {
        halign: "center",
        fontStyle: "bold",
        textColor: slate900,
        width: 25,
      },
      3: { fontStyle: "italic", textColor: slate500 },
    },
  });

  // --- FIRMAS ---
  // Calculamos si hay espacio o si hay que pasar a la otra página
  let finalY = doc.lastAutoTable.finalY + 40;
  if (finalY > 250) {
    doc.addPage();
    finalY = 50;
  }

  // Firma Izquierda
  doc.setDrawColor(...slate500);
  doc.setLineWidth(0.5);
  doc.line(20, finalY, 80, finalY);

  doc.setTextColor(...slate900);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Andrés Cardoso", 50, finalY + 6, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...slate500);
  doc.text("JEFE DE PRODUCCIÓN", 50, finalY + 11, { align: "center" });

  // Firma Derecha
  doc.line(130, finalY, 190, finalY);

  doc.setTextColor(...slate900);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Fernando Rigoni", 160, finalY + 6, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...slate500);
  doc.text("GERENTE DE PRODUCCIÓN", 160, finalY + 11, { align: "center" });

  // --- PIE DE PÁGINA (Paginación) ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Línea separadora del footer
    doc.setDrawColor(...slate200);
    doc.setLineWidth(0.5);
    doc.line(14, 285, 195, 285);

    doc.setFontSize(7);
    doc.setTextColor(...slate500);
    doc.text("Gestión MRP - Documento generado digitalmente", 14, 290);
    doc.text(`Página ${i} de ${pageCount}`, 195, 290, { align: "right" });
  }

  // Guardar PDF
  doc.save(`Solicitud_Compra_N${id}.pdf`);
};

// --- MODAL DE CONFIRMACIÓN ELEGANTE ---
function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isDanger = false,
}) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[300] p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden text-center p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto w-16 h-16 rounded-3xl flex items-center justify-center mb-6 border shadow-sm ${isDanger ? "bg-rose-50 text-rose-500 border-rose-100" : "bg-emerald-50 text-emerald-500 border-emerald-100"}`}
        >
          <FaExclamationTriangle size={28} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-3 tracking-tight">
          {title}
        </h3>
        <p className="text-slate-500 text-sm mb-8 font-medium">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3.5 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 ${isDanger ? "bg-rose-500 hover:bg-rose-600 shadow-rose-200" : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"}`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- MODAL DETALLE DE SOLICITUD ---
function SolicitudDetailModal({ solicitudId, onClose, todasMateriasPrimas }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ingresos, setIngresos] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [edicionValues, setEdicionValues] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);

  const cargarDetalle = async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/compras/solicitud/${solicitudId}`,
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      toast.error("Error al cargar la solicitud.");
    }
    setLoading(false);
  };
  useEffect(() => {
    cargarDetalle();
  }, [solicitudId]);

  const startEdit = () => {
    if (!data) return;
    const initVals = {};
    data.items.forEach((i) => {
      initVals[i.id] = {
        cantidad: i.cantidad,
        proveedor: i.proveedor_recomendado || "",
      };
    });
    setEdicionValues(initVals);
    setIsEditing(true);
  };

  const saveItemChange = async (itemId) => {
    try {
      const vals = edicionValues[itemId];
      if (!vals.cantidad || Number(vals.cantidad) <= 0)
        return toast.error("La cantidad no puede ser 0.");
      const res = await authFetch(`${API_BASE_URL}/compras/item/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cantidad: Number(vals.cantidad),
          proveedor: vals.proveedor,
        }),
      });
      if (!res.ok) throw new Error();
      cargarDetalle();
    } catch (e) {
      toast.error("Error al guardar cambios.");
    }
  };

  const agregarNuevoItem = async (mp) => {
    const toastId = toast.loading("Añadiendo material...");
    try {
      await authFetch(
        `${API_BASE_URL}/compras/solicitud/${solicitudId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materia_prima_id: mp.id,
            cantidad: 1,
            proveedor: "",
          }),
        },
      );
      cargarDetalle();
      toast.success("Ítem agregado. Ajustá la cantidad.", { id: toastId });
    } catch (e) {
      toast.error("Error agregando ítem.", { id: toastId });
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, itemId, payload } = confirmAction;
    setConfirmAction(null);
    const toastId = toast.loading("Procesando...");

    try {
      if (type === "delete") {
        const res = await authFetch(`${API_BASE_URL}/compras/item/${itemId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
        toast.success("Ítem eliminado.", { id: toastId });
        cargarDetalle();
      } else if (type === "receive") {
        const res = await authFetch(
          `${API_BASE_URL}/compras/item/${itemId}/recepcion`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cantidad_ingresada: payload }),
          },
        );
        if (!res.ok) throw new Error();
        toast.success("Ingreso registrado en Stock.", { id: toastId });
        setIngresos({ ...ingresos, [itemId]: "" });
        cargarDetalle();
      }
    } catch (e) {
      toast.error("Ocurrió un error.", { id: toastId });
    }
  };

  if (!data && loading)
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center text-emerald-500">
        <FaSpinner className="animate-spin text-4xl" />
      </div>
    );
  if (!data) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex justify-center p-4 items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row md:justify-between md:items-center gap-4 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 tracking-tighter">
              <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl">
                <FaClipboardList size={18} />
              </div>
              Solicitud #{data.id}
            </h2>
            <div className="flex gap-3 mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                <FaClock /> {new Date(data.fecha_creacion).toLocaleDateString()}
              </span>
              <span
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${data.estado === "COMPLETA" ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-amber-50 border-amber-100 text-amber-600"}`}
              >
                {data.estado}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isEditing ? (
              <button
                onClick={startEdit}
                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"
              >
                <FaEdit /> Editar
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all"
              >
                <FaCheckCircle /> Finalizar
              </button>
            )}
            <button
              onClick={() =>
                imprimirSolicitud(data.id, data.items, data.fecha_creacion)
              }
              className="w-10 h-10 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-500 rounded-xl flex items-center justify-center transition-colors shadow-sm"
            >
              <FaFilePdf size={16} />
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white hover:bg-rose-50 border border-slate-100 text-slate-400 hover:text-rose-500 rounded-xl flex items-center justify-center transition-colors shadow-sm"
            >
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6 bg-slate-50/30 min-h-0">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50/80 text-slate-400 uppercase font-bold tracking-widest text-[9px] sticky top-0 backdrop-blur-md z-10">
                <tr>
                  <th className="p-4 px-6">Material</th>
                  <th className="p-4 text-center">Solicitado</th>
                  <th className="p-4 text-center">Recibido</th>
                  <th className="p-4 text-center">Pendiente</th>
                  <th className="p-4">Proveedor</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.map((item) => {
                  const pendiente = Math.max(
                    0,
                    Number(item.cantidad) - Number(item.cantidad_recibida),
                  );
                  const isCompleto = item.estado === "COMPLETO";
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 transition-colors ${isEditing ? "bg-blue-50/30" : ""}`}
                    >
                      <td className="p-4 px-6 min-w-0">
                        <p className="font-bold text-slate-700 truncate text-xs">
                          {item.nombre}
                        </p>
                        <p className="text-[9px] font-bold tracking-widest uppercase text-slate-400">
                          {item.codigo}
                        </p>
                      </td>
                      <td className="p-4 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-16 bg-white border border-blue-200 rounded-lg p-1.5 text-center font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 text-xs shadow-sm"
                            value={
                              edicionValues[item.id]?.cantidad || item.cantidad
                            }
                            onChange={(e) =>
                              setEdicionValues({
                                ...edicionValues,
                                [item.id]: {
                                  ...edicionValues[item.id],
                                  cantidad: e.target.value,
                                },
                              })
                            }
                            onBlur={() => saveItemChange(item.id)}
                          />
                        ) : (
                          <span className="font-bold text-slate-600">
                            {item.cantidad}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center text-emerald-600 font-bold">
                        {item.cantidad_recibida}
                      </td>
                      <td className="p-4 text-center text-rose-500 font-bold">
                        {pendiente}
                      </td>
                      <td className="p-4 text-xs">
                        {isEditing ? (
                          <input
                            type="text"
                            className="w-full bg-white border border-blue-200 rounded-lg p-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 text-xs shadow-sm"
                            value={
                              edicionValues[item.id]?.proveedor ||
                              item.proveedor_recomendado
                            }
                            onChange={(e) =>
                              setEdicionValues({
                                ...edicionValues,
                                [item.id]: {
                                  ...edicionValues[item.id],
                                  proveedor: e.target.value,
                                },
                              })
                            }
                            onBlur={() => saveItemChange(item.id)}
                          />
                        ) : (
                          <span className="text-slate-500 font-medium italic">
                            {item.proveedor_recomendado || "-"}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {isEditing ? (
                          <button
                            onClick={() =>
                              setConfirmAction({
                                type: "delete",
                                itemId: item.id,
                              })
                            }
                            className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-colors"
                          >
                            <FaTrash size={14} />
                          </button>
                        ) : !isCompleto ? (
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              placeholder="Cant."
                              className="w-14 bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 text-center text-xs font-bold outline-none focus:border-emerald-300 shadow-sm"
                              value={ingresos[item.id] || ""}
                              onChange={(e) =>
                                setIngresos({
                                  ...ingresos,
                                  [item.id]: e.target.value,
                                })
                              }
                            />
                            <button
                              onClick={() => {
                                const cant = ingresos[item.id];
                                if (!cant || Number(cant) <= 0)
                                  return toast.error(
                                    "Ingresá una cantidad válida",
                                  );
                                setConfirmAction({
                                  type: "receive",
                                  itemId: item.id,
                                  payload: cant,
                                });
                              }}
                              className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-sm transition-all"
                            >
                              <FaCheckCircle size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-lg font-bold text-[9px] uppercase tracking-widest">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {isEditing && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <FaPlus /> Sumar Material Olvidado
              </h4>
              <AutoCompleteInput
                items={todasMateriasPrimas}
                onSelect={agregarNuevoItem}
                placeholder="Escribí el nombre o código..."
              />
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {confirmAction && (
          <ConfirmModal
            isOpen={!!confirmAction}
            title={
              confirmAction.type === "delete"
                ? "¿Quitar material?"
                : "¿Ingresar al Stock?"
            }
            message={
              confirmAction.type === "delete"
                ? "Se eliminará este ítem de la solicitud de compra."
                : `Se registrarán ${confirmAction.payload} unidades en el inventario.`
            }
            isDanger={confirmAction.type === "delete"}
            onConfirm={handleConfirmAction}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function SolicitudesPage() {
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historial, setHistorial] = useState([]);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [selectedSolicitudId, setSelectedSolicitudId] = useState(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [resMP, resHist] = await Promise.all([
        authFetch(`${API_BASE_URL}/ingenieria/materias-primas`),
        authFetch(`${API_BASE_URL}/compras/historial`),
      ]);
      if (resMP.ok) setMateriasPrimas(await resMP.json());
      if (resHist.ok) setHistorial(await resHist.json());
    } catch (e) {
      toast.error("Error conectando con la base de datos.");
    }
    setLoading(false);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const agregarItem = (mp) => {
    if (carrito.find((i) => i.id === mp.id))
      return toast.error("Este material ya está en la lista.");
    setCarrito([...carrito, { ...mp, cantidad: 1, proveedor: "" }]);
    toast.success("Material agregado");
  };

  const actualizarItem = (id, field, val) =>
    setCarrito(carrito.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
  const eliminarItem = (id) => setCarrito(carrito.filter((i) => i.id !== id));

  const handleGenerarNueva = async () => {
    if (carrito.length === 0)
      return toast.error("No hay materiales en la solicitud.");
    const toastId = toast.loading("Emitiendo Solicitud...");
    try {
      const itemsData = carrito.map((i) => ({
        materia_prima_id: i.id,
        cantidad: i.cantidad,
        proveedor: i.proveedor,
      }));
      const res = await authFetch(`${API_BASE_URL}/compras/nueva`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsData }),
      });
      if (res.status === 403)
        return toast.error("Acceso denegado.", { id: toastId });

      const data = await res.json();
      if (data.success) {
        imprimirSolicitud(data.solicitudId, carrito, new Date());
        setCarrito([]);
        toast.success("Solicitud emitida y descargada.", { id: toastId });
        cargarDatos();
      } else throw new Error();
    } catch (e) {
      toast.error("Ocurrió un error al emitir.", { id: toastId });
    }
  };

  const reimprimirDesdeHistorial = async (e, solId, fecha) => {
    e.stopPropagation();
    const toastId = toast.loading("Generando Documento...");
    try {
      const res = await authFetch(`${API_BASE_URL}/compras/solicitud/${solId}`);
      if (res.ok) {
        const data = await res.json();
        imprimirSolicitud(data.id, data.items, fecha);
        toast.success("Descarga completada", { id: toastId });
      } else throw new Error();
    } catch (err) {
      toast.error("Error al generar PDF", { id: toastId });
    }
  };

  const totalPages = Math.ceil(historial.length / ITEMS_PER_PAGE);
  const currentItems = historial.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full mx-auto p-4 lg:p-8 bg-[#f8fafc] h-full flex flex-col min-h-0"
    >
      {/* HEADER FIJO */}
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
          <FaShoppingCart size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tighter">
            Módulo Compras
          </h1>
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-1">
            Requisiciones e Ingresos de Stock
          </p>
        </div>
      </div>

      {/* GRILLA CON CANDADO DE ALTURA (h-[calc...]) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1 min-h-0 h-[calc(100vh-200px)]">
        {/* COLUMNA IZQUIERDA (2/3): EL CARRITO Y BUSCADOR INTEGRADO */}
        <div className="xl:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-0">
          {/* Header del Carrito */}
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 shrink-0 z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h3 className="text-slate-800 font-bold flex items-center gap-3 tracking-tight text-lg">
                <FaBoxOpen className="text-emerald-500" /> Bandeja de Solicitud
                <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-lg text-xs border border-emerald-200">
                  {carrito.length} items
                </span>
              </h3>
              {carrito.length > 0 && (
                <button
                  onClick={handleGenerarNueva}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-md shadow-emerald-200 flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  <FaFilePdf /> Emitir Orden
                </button>
              )}
            </div>

            {/* Buscador Integrado */}
            <div className="relative">
              <AutoCompleteInput
                items={materiasPrimas}
                onSelect={agregarItem}
                placeholder="🔍 Escribí el nombre o código del material para agregarlo..."
              />
            </div>
          </div>

          {/* LISTA DEL CARRITO (Con Scroll) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white min-h-0">
            <AnimatePresence>
              {carrito.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-slate-300 py-12"
                >
                  <FaShoppingCart className="text-6xl mb-4 text-slate-100" />
                  <p className="font-bold text-xl text-slate-400 tracking-tight">
                    Bandeja Vacía
                  </p>
                  <p className="text-sm font-medium mt-2">
                    Usá el buscador de arriba para añadir materiales.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {carrito.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center gap-4 group hover:shadow-sm transition-all hover:border-emerald-200"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-slate-700 font-bold text-sm truncate">
                          {item.nombre}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
                          {item.codigo || "S/C"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex flex-col">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 ml-1">
                            Cant.
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="w-16 bg-white border border-slate-200 rounded-xl p-2 text-slate-700 text-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-300 shadow-sm transition-all"
                            value={item.cantidad}
                            onChange={(e) =>
                              actualizarItem(
                                item.id,
                                "cantidad",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="flex flex-col hidden sm:flex">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 ml-1">
                            Proveedor (Opcional)
                          </label>
                          <input
                            type="text"
                            className="w-48 bg-white border border-slate-200 rounded-xl p-2 text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-300 shadow-sm transition-all"
                            placeholder="Ej: Aceros S.A."
                            value={item.proveedor}
                            onChange={(e) =>
                              actualizarItem(
                                item.id,
                                "proveedor",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <button
                          onClick={() => eliminarItem(item.id)}
                          className="mt-4 text-slate-300 p-2.5 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-colors border border-transparent hover:border-rose-100"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* COLUMNA DERECHA (1/3): HISTORIAL LATERAL */}
        <div className="xl:col-span-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 shrink-0">
            <h3 className="text-slate-800 font-bold flex items-center gap-2 tracking-tight text-lg">
              <FaHistory className="text-blue-500" /> Historial Reciente
            </h3>
          </div>

          {/* LISTA DEL HISTORIAL (Con Scroll) */}
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar min-h-0">
            {loading && currentItems.length === 0 ? (
              <div className="flex justify-center py-10 text-slate-300">
                <FaSpinner className="animate-spin text-3xl" />
              </div>
            ) : currentItems.length === 0 ? (
              <div className="text-center text-slate-400 font-medium py-10 text-sm">
                Sin historial de compras.
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {currentItems.map((sol) => (
                  <div
                    key={sol.id}
                    onClick={() => setSelectedSolicitudId(sol.id)}
                    className="p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md bg-white transition-all cursor-pointer group flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-slate-700 font-mono font-bold text-sm">
                          #{sol.id}
                        </span>
                        <span
                          className={`text-[8px] px-2 py-0.5 rounded-md font-bold uppercase tracking-widest border ${sol.estado === "COMPLETA" ? "bg-emerald-50 border-emerald-100 text-emerald-600" : sol.estado === "EN PROCESO" ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-amber-50 border-amber-100 text-amber-600"}`}
                        >
                          {sol.estado || "PENDIENTE"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1 truncate">
                          <FaClock size={10} />{" "}
                          {new Date(sol.fecha_creacion).toLocaleDateString(
                            "es-AR",
                          )}
                        </span>
                        <span>•</span>
                        <span className="whitespace-nowrap">
                          {sol.items_count} ítems
                        </span>
                      </div>
                    </div>

                    {/* ICONOS REDISEÑADOS: HORIZONTALES Y ELEGANTES */}
                    <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) =>
                          reimprimirDesdeHistorial(
                            e,
                            sol.id,
                            sol.fecha_creacion,
                          )
                        }
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        title="Descargar PDF"
                      >
                        <FaFilePdf size={16} />
                      </button>
                      <FaChevronRight
                        size={12}
                        className="text-slate-300 group-hover:text-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-50 flex justify-between items-center bg-slate-50/50 shrink-0">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm"
              >
                <FaChevronLeft size={10} />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Pág {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm"
              >
                <FaChevronRight size={10} />
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedSolicitudId && (
          <SolicitudDetailModal
            solicitudId={selectedSolicitudId}
            todasMateriasPrimas={materiasPrimas}
            onClose={() => setSelectedSolicitudId(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
