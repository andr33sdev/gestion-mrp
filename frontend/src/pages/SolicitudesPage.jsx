import { useState, useEffect } from "react";
import { API_BASE_URL, authFetch } from "../utils.js"; // <--- IMPORTAR
import { FaShoppingCart, FaSearch, FaTrash, FaFilePdf, FaSpinner, FaPlus, FaHistory, FaClipboardList, FaCheckCircle, FaClock, FaTimes, FaSave, FaEdit, FaEraser, FaChevronLeft } from "react-icons/fa";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";
import { motion, AnimatePresence } from "framer-motion";

const imprimirSolicitud = (id, items, fechaStr) => {
  const doc = new jsPDF();
  const fecha = new Date(fechaStr).toLocaleDateString("es-AR");
  doc.setFillColor(30, 41, 59); doc.rect(0, 0, 210, 35, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text("SOLICITUD DE MATERIALES", 14, 20);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(148, 163, 184); doc.text("SISTEMA DE GESTIÓN - MRP", 14, 28);
  doc.setFillColor(255, 255, 255); doc.roundedRect(140, 10, 60, 20, 2, 2, "F");
  doc.setTextColor(0, 0, 0); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("SOLICITUD N°", 145, 16); doc.text("FECHA EMISIÓN", 145, 24);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`# ${id}`, 195, 16, { align: "right" }); doc.text(fecha, 195, 24, { align: "right" });
  const startY = 45; doc.setFillColor(241, 245, 249); doc.roundedRect(14, startY, 100, 18, 2, 2, "F");
  doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.text("DESTINATARIO:", 20, startY + 7);
  doc.setFontSize(11); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.text("DEPARTAMENTO DE COMPRAS", 20, startY + 13);
  const tableBody = items.map((item) => [item.codigo || "-", item.nombre || "Material Desconocido", item.cantidad, item.proveedor_recomendado || item.proveedor || "-"]);
  autoTable(doc, { startY: startY + 25, head: [["CÓDIGO", "DESCRIPCIÓN DEL MATERIAL", "CANT.", "PROVEEDOR SUGERIDO"]], body: tableBody, theme: "grid", styles: { fontSize: 9, cellPadding: 4, lineColor: [203, 213, 225], lineWidth: 0.1 }, headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold", halign: "center" }, alternateRowStyles: { fillColor: [248, 250, 252] }, columnStyles: { 0: { halign: "center", fontStyle: "bold", width: 30 }, 2: { halign: "right", fontStyle: "bold", width: 20 }, 3: { fontStyle: "italic" } } });
  let finalY = doc.lastAutoTable.finalY + 40; if (finalY > 250) { doc.addPage(); finalY = 40; }
  doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Andrés Cardoso", 45, finalY, { align: "center" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100); doc.text("JEFE DE PRODUCCIÓN", 45, finalY + 5, { align: "center" });
  doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(20, finalY + 10, 70, finalY + 10);
  doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Fernando Rigoni", 165, finalY, { align: "center" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100); doc.text("GERENTE DE PRODUCCIÓN", 165, finalY + 5, { align: "center" });
  doc.line(140, finalY + 10, 190, finalY + 10);
  const pageCount = doc.internal.getNumberOfPages(); for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150); doc.text(`Página ${i} de ${pageCount} - Documento generado digitalmente`, 105, 290, { align: "center" }); }
  doc.save(`Solicitud_${id}.pdf`);
};

function SolicitudDetailModal({ solicitudId, onClose, todasMateriasPrimas }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ingresos, setIngresos] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [edicionValues, setEdicionValues] = useState({});

  const cargarDetalle = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/compras/solicitud/${solicitudId}`); // --- CAMBIO: authFetch
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { cargarDetalle(); }, [solicitudId]);

  const startEdit = () => { if (!data) return; const initVals = {}; data.items.forEach((i) => { initVals[i.id] = { cantidad: i.cantidad, proveedor: i.proveedor_recomendado || "" }; }); setEdicionValues(initVals); setIsEditing(true); };
  const saveItemChange = async (itemId) => {
    try {
      const vals = edicionValues[itemId];
      if (!vals.cantidad || Number(vals.cantidad) <= 0) return alert("Por favor ingrese una cantidad válida.");
      await authFetch(`${API_BASE_URL}/compras/item/${itemId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cantidad: Number(vals.cantidad), proveedor: vals.proveedor }) }); // --- CAMBIO: authFetch
      cargarDetalle();
    } catch (e) { alert("Error al guardar"); }
  };
  const deleteItem = async (itemId) => { if (!confirm("¿Eliminar ítem?")) return; try { await authFetch(`${API_BASE_URL}/compras/item/${itemId}`, { method: "DELETE" }); cargarDetalle(); } catch (e) { alert("Error"); } }; // --- CAMBIO: authFetch
  const agregarNuevoItem = async (mp) => { const cantidad = prompt(`Cantidad de ${mp.nombre}:`, "1"); if (!cantidad) return; try { await authFetch(`${API_BASE_URL}/compras/solicitud/${solicitudId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materia_prima_id: mp.id, cantidad: Number(cantidad), proveedor: "" }) }); cargarDetalle(); alert("Ítem agregado."); } catch (e) { alert("Error agregando ítem"); } }; // --- CAMBIO: authFetch
  const handleRecepcion = async (itemId) => { const cantidad = ingresos[itemId]; if (!cantidad || Number(cantidad) <= 0) return alert("Cantidad inválida"); if (!confirm(`¿Ingresar ${cantidad} unidades?`)) return; try { const res = await authFetch(`${API_BASE_URL}/compras/item/${itemId}/recepcion`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cantidad_ingresada: cantidad }) }); if (res.ok) { alert("Registrado."); setIngresos({ ...ingresos, [itemId]: "" }); cargarDetalle(); } } catch (e) { alert("Error"); } }; // --- CAMBIO: authFetch

  if (!data && loading) return <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center text-white"><FaSpinner className="animate-spin text-4xl" /></div>;
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-800 w-full max-w-5xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-start"><div><h2 className="text-2xl font-bold text-white flex items-center gap-3"><FaClipboardList className="text-blue-400" /> Solicitud #{data.id}</h2><div className="flex gap-4 mt-2 text-sm"><span className="text-gray-400 flex items-center gap-1"><FaClock /> {new Date(data.fecha_creacion).toLocaleDateString()}</span><span className={`px-2 rounded border font-bold ${data.estado === "COMPLETA" ? "bg-green-900/30 border-green-500 text-green-400" : "bg-yellow-900/30 border-yellow-500 text-yellow-400"}`}>{data.estado}</span></div></div><div className="flex gap-2">{!isEditing ? (<button onClick={startEdit} className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 text-sm font-bold"><FaEdit /> Editar Pedido</button>) : (<button onClick={() => setIsEditing(false)} className="p-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2 text-sm font-bold"><FaCheckCircle /> Finalizar Edición</button>)}<button onClick={() => imprimirSolicitud(data.id, data.items, data.fecha_creacion)} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full"><FaFilePdf className="text-xl" /></button><button onClick={onClose} className="p-2 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 rounded-full text-gray-400"><FaTimes className="text-xl" /></button></div></div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6"><table className="w-full text-left text-sm border-collapse"><thead className="bg-slate-900 text-gray-400 uppercase font-bold text-xs sticky top-0"><tr><th className="p-3">Producto</th><th className="p-3 text-right">Solicitado</th><th className="p-3 text-right">Recibido</th><th className="p-3 text-right">Pendiente</th><th className="p-3">Proveedor</th><th className="p-3 text-center">Acción</th></tr></thead><tbody className="divide-y divide-slate-700">{data.items.map((item) => { const pendiente = Math.max(0, Number(item.cantidad) - Number(item.cantidad_recibida)); const isCompleto = item.estado === "COMPLETO"; return (<tr key={item.id} className={`hover:bg-slate-700/30 ${isEditing ? "bg-blue-900/10" : ""}`}><td className="p-3 font-medium text-white">{item.nombre}<br /><span className="text-xs text-gray-500">{item.codigo}</span></td><td className="p-3 text-right">{isEditing ? (<input type="number" className="w-20 bg-slate-900 border border-blue-500 rounded p-1 text-white text-right" value={edicionValues[item.id]?.cantidad || item.cantidad} onChange={(e) => setEdicionValues({ ...edicionValues, [item.id]: { ...edicionValues[item.id], cantidad: e.target.value } })} onBlur={() => saveItemChange(item.id)} />) : (<span className="font-bold text-blue-200">{item.cantidad}</span>)}</td><td className="p-3 text-right text-green-400 font-bold">{item.cantidad_recibida}</td><td className="p-3 text-right text-red-300 font-bold">{pendiente}</td><td className="p-3 text-xs">{isEditing ? (<input type="text" className="w-full bg-slate-900 border border-blue-500 rounded p-1 text-white" value={edicionValues[item.id]?.proveedor || item.proveedor_recomendado} onChange={(e) => setEdicionValues({ ...edicionValues, [item.id]: { ...edicionValues[item.id], proveedor: e.target.value } })} onBlur={() => saveItemChange(item.id)} />) : (item.proveedor_recomendado || "-")}</td><td className="p-3 text-center">{isEditing ? (<button onClick={() => deleteItem(item.id)} className="text-red-400 hover:bg-red-900/30 p-2 rounded"><FaTrash /></button>) : !isCompleto ? (<div className="flex items-center justify-center gap-2"><input type="number" placeholder="Ingreso" className="w-16 bg-slate-900 border border-slate-600 rounded p-1 text-white text-center text-xs" value={ingresos[item.id] || ""} onChange={(e) => setIngresos({ ...ingresos, [item.id]: e.target.value })} /><button onClick={() => handleRecepcion(item.id)} className="p-1 bg-green-600 text-white rounded"><FaCheckCircle /></button></div>) : (<span className="text-green-500 font-bold text-xs">OK</span>)}</td></tr>); })}</tbody></table>{isEditing && (<div className="bg-slate-700/30 p-4 rounded-xl border-2 border-dashed border-slate-600"><h4 className="text-sm font-bold text-blue-300 mb-3 flex items-center gap-2"><FaPlus /> Agregar Ítem Olvidado</h4><AutoCompleteInput items={todasMateriasPrimas} onSelect={agregarNuevoItem} placeholder="Buscar material para añadir a esta solicitud..." /></div>)}</div>
      </motion.div>
    </div>
  );
}

export default function SolicitudesPage() {
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historial, setHistorial] = useState([]);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [selectedSolicitudId, setSelectedSolicitudId] = useState(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      // --- CAMBIO: authFetch ---
      const [resMP, resHist] = await Promise.all([
        authFetch(`${API_BASE_URL}/ingenieria/materias-primas`),
        authFetch(`${API_BASE_URL}/compras/historial`),
      ]);
      if (resMP.ok) setMateriasPrimas(await resMP.json());
      if (resHist.ok) setHistorial(await resHist.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { cargarDatos(); }, []);

  const agregarItem = (mp) => { if (carrito.find((i) => i.id === mp.id)) return; setCarrito([...carrito, { ...mp, cantidad: 1, proveedor: "" }]); };
  const actualizarItem = (id, field, val) => setCarrito(carrito.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
  const eliminarItem = (id) => setCarrito(carrito.filter((i) => i.id !== id));

  const handleGenerarNueva = async () => {
    if (carrito.length === 0) return alert("Carrito vacío");
    try {
      const itemsData = carrito.map((i) => ({ materia_prima_id: i.id, cantidad: i.cantidad, proveedor: i.proveedor }));
      // --- CAMBIO: authFetch ---
      const res = await authFetch(`${API_BASE_URL}/compras/nueva`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: itemsData }) });
      const data = await res.json();
      if (data.success) { imprimirSolicitud(data.solicitudId, carrito, new Date()); setCarrito([]); alert("Generada OK"); cargarDatos(); }
    } catch (e) { alert("Error"); }
  };

  const reimprimirDesdeHistorial = async (e, solId, fecha) => {
    e.stopPropagation();
    try {
      // --- CAMBIO: authFetch ---
      const res = await authFetch(`${API_BASE_URL}/compras/solicitud/${solId}`);
      if (res.ok) { const data = await res.json(); imprimirSolicitud(data.id, data.items, fecha); }
    } catch (err) { alert("Error al recuperar datos"); }
  };

  const totalPages = Math.ceil(historial.length / ITEMS_PER_PAGE);
  const currentItems = historial.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-20">
      <div className="flex items-center gap-4 mb-8"><FaShoppingCart className="text-4xl text-green-400" /><div><h1 className="text-3xl font-bold text-white">Solicitudes de Compra</h1><p className="text-gray-400">Generar requisiciones y controlar recepción.</p></div></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12"><div className="bg-slate-800 p-5 rounded-xl border border-slate-700 col-span-1 h-fit"><h3 className="text-white font-bold mb-4 flex items-center gap-2"><FaSearch /> Buscar Material</h3><AutoCompleteInput items={materiasPrimas} onSelect={agregarItem} placeholder="Nombre o código..." /></div><div className="bg-slate-800 p-5 rounded-xl border border-slate-700 col-span-2 min-h-[300px] flex flex-col"><h3 className="text-white font-bold mb-4 flex items-center gap-2"><FaPlus /> Nueva Solicitud ({carrito.length})</h3><div className="flex-1">{carrito.length === 0 ? (<div className="text-center text-gray-500 py-10 border-2 border-dashed border-slate-600 rounded-lg">Vacío.</div>) : (<ul className="space-y-3">{carrito.map((item) => (<li key={item.id} className="bg-slate-700 p-3 rounded-lg flex flex-col md:flex-row md:items-center gap-4 animate-in slide-in-from-left-2"><div className="flex-1"><p className="text-white font-bold text-sm">{item.nombre}</p><p className="text-xs text-gray-400">{item.codigo}</p></div><div className="flex items-center gap-2"><input type="number" className="w-24 bg-slate-900 border border-slate-600 rounded p-2 text-white text-center font-bold" placeholder="Cant." value={item.cantidad} onChange={(e) => actualizarItem(item.id, "cantidad", e.target.value)} /><input type="text" className="w-40 bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" placeholder="Proveedor" value={item.proveedor} onChange={(e) => actualizarItem(item.id, "proveedor", e.target.value)} /><button onClick={() => eliminarItem(item.id)} className="text-red-400 p-2 hover:bg-slate-600 rounded"><FaTrash /></button></div></li>))}</ul>)}</div>{carrito.length > 0 && (<button onClick={handleGenerarNueva} className="w-full mt-6 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2"><FaFilePdf /> Generar y Descargar</button>)}</div></div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"><div className="p-4 border-b border-slate-700 bg-slate-900/50"><h3 className="text-white font-bold flex items-center gap-2"><FaHistory className="text-blue-400" /> Historial</h3></div><table className="w-full text-left text-sm"><thead className="bg-slate-900 text-gray-400 uppercase font-bold"><tr><th className="p-4">ID</th><th className="p-4">Fecha</th><th className="p-4 text-center">Items</th><th className="p-4">Estado</th><th className="p-4 text-right">Acción</th></tr></thead><tbody className="divide-y divide-slate-700">{currentItems.length === 0 ? (<tr><td colSpan="5" className="p-8 text-center text-gray-500">Sin historial.</td></tr>) : (currentItems.map((sol) => (<tr key={sol.id} onClick={() => setSelectedSolicitudId(sol.id)} className="hover:bg-slate-700/50 transition-colors cursor-pointer group"><td className="p-4 text-white font-mono font-bold">#{sol.id}</td><td className="p-4 text-gray-300"><div className="flex items-center gap-2"><FaClock className="text-gray-500" /> {new Date(sol.fecha_creacion).toLocaleDateString("es-AR")}</div></td><td className="p-4 text-center"><span className="bg-slate-700 text-white px-2 py-1 rounded text-xs font-bold">{sol.items_count}</span></td><td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${sol.estado === "COMPLETA" ? "bg-green-900/30 border-green-500 text-green-400" : sol.estado === "EN PROCESO" ? "bg-blue-900/30 border-blue-500 text-blue-400" : "bg-yellow-900/30 border-yellow-500 text-yellow-400"}`}>{sol.estado || "PENDIENTE"}</span></td><td className="p-4 text-right"><button onClick={(e) => reimprimirDesdeHistorial(e, sol.id, sol.fecha_creacion)} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded shadow mr-2" title="Reimprimir PDF"><FaFilePdf /></button><span className="text-blue-400 font-bold text-xs">Ver →</span></td></tr>)))}</tbody></table>{totalPages > 1 && (<div className="p-4 border-t border-slate-700 flex justify-center items-center gap-4"><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 bg-slate-700 text-white rounded disabled:opacity-50"><FaChevronLeft /></button><span className="text-gray-400 text-sm">Página {page}</span><button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 bg-slate-700 text-white rounded disabled:opacity-50"><FaChevronRight /></button></div>)}</div>
      <AnimatePresence>{selectedSolicitudId && (<SolicitudDetailModal solicitudId={selectedSolicitudId} todasMateriasPrimas={materiasPrimas} onClose={() => setSelectedSolicitudId(null)} />)}</AnimatePresence>
    </div>
  );
}
