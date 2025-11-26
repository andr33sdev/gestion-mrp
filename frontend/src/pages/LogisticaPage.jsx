import { useState, useEffect } from "react";
import { API_BASE_URL, authFetch } from "../utils.js";
import { Scanner } from "@yudiel/react-qr-scanner";
import QRCode from "qrcode";
import {
  FaTruck,
  FaSearch,
  FaArrowRight,
  FaCheckCircle,
  FaTimes,
  FaPlus,
  FaTrash,
  FaListUl,
  FaFilePdf,
  FaUserTie,
  FaHistory,
  FaClock,
  FaBoxOpen,
  FaEdit,
  FaSave,
  FaEraser,
  FaExclamationTriangle,
  FaChevronLeft,
  FaChevronRight,
  FaSync,
  FaCartPlus,
  FaPaperPlane,
  FaMapMarkerAlt,
  FaEye,
} from "react-icons/fa";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";

// --- COMPONENTES UI ---
const Tab = ({ label, active, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`px-4 md:px-6 py-4 font-bold transition-all border-b-2 flex items-center gap-2 text-sm md:text-base ${
      active
        ? "border-blue-500 text-white bg-white/5"
        : "border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5"
    }`}
  >
    {icon} <span className="hidden md:inline">{label}</span>
  </button>
);

const Badge = ({ tipo, texto }) => {
  const styles = {
    RECIBIDO: "bg-green-500/20 text-green-400 border-green-500/50",
    EN_CAMINO:
      "bg-orange-500/20 text-orange-400 border-orange-500/50 animate-pulse",
    PENDIENTE: "bg-slate-600/40 text-gray-300 border-gray-500",
  };
  const statusKey = texto.includes("RECIBIDO")
    ? "RECIBIDO"
    : texto.includes("TRANSITO") || texto.includes("CAMINO")
    ? "EN_CAMINO"
    : "PENDIENTE";
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-bold uppercase border flex items-center gap-1 w-fit ${
        styles[statusKey] || styles.PENDIENTE
      }`}
    >
      {statusKey === "RECIBIDO" ? <FaCheckCircle /> : <FaTruck />} {texto}
    </span>
  );
};

const generarPDFRemito = (datos) => {
  const doc = new jsPDF();
  doc.setFillColor(33, 41, 54);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("REMITO DE TRASLADO", 105, 18, { align: "center" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("GESTIÓN DE STOCK INTERNO", 105, 28, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`CÓDIGO REMITO: ${datos.codigo}`, 14, 55);
  doc.text(`FECHA: ${datos.fecha}`, 14, 62);
  doc.text(`ORIGEN: ${datos.origen}`, 110, 55);
  doc.text(`DESTINO: ${datos.destino}`, 110, 62);
  doc.text(`CHOFER: ${datos.chofer.toUpperCase()}`, 14, 69);

  const tableBody = datos.items.map((item) => [
    item.codigo || "-",
    item.nombre,
    item.cantidad,
  ]);
  autoTable(doc, {
    startY: 80,
    head: [["CÓDIGO", "PRODUCTO", "CANTIDAD"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
  });

  if (datos.qrUrl) doc.addImage(datos.qrUrl, "PNG", 170, 5, 30, 30);
  doc.save(`Remito_${datos.codigo}.pdf`);
};

function ModalVerItems({ isOpen, onClose, items, codigo }) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-lg font-bold text-white">Remito #{codigo}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <FaTimes />
          </button>
        </div>
        <div className="p-0 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/50 text-xs uppercase text-gray-400 sticky top-0">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Producto</th>
                <th className="p-3 text-right">Cant.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {items?.map((it, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="p-3 font-mono text-xs text-gray-500">
                    {it.codigo}
                  </td>
                  <td className="p-3 text-white font-medium">{it.nombre}</td>
                  <td className="p-3 text-right font-bold text-blue-300">
                    {it.cantidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-700 bg-slate-900/30 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalDespacho({ isOpen, onClose, onConfirm, solicitud }) {
  const [origen, setOrigen] = useState("PLANTA_26");
  const [chofer, setChofer] = useState("");
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in">
        <div className="p-6 border-b border-slate-700 bg-slate-900/50">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FaTruck className="text-blue-400" /> Despachar Pedido
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Destino:{" "}
            <span className="text-white font-bold">{solicitud?.destino}</span>
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              Origen
            </label>
            <div className="relative">
              <FaMapMarkerAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <select
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
              >
                <option value="PLANTA_26">Planta 26</option>
                <option value="PLANTA_37">Planta 37</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
              Chofer
            </label>
            <div className="relative">
              <FaUserTie className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Nombre..."
                value={chofer}
                onChange={(e) => setChofer(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-700 bg-slate-900/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white font-bold"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(origen, chofer)}
            disabled={!chofer.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            <FaPaperPlane /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LogisticaPage() {
  const [activeTab, setActiveTab] = useState("STOCK");
  const [stockGlobal, setStockGlobal] = useState([]);
  const [stockVisible, setStockVisible] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- PEDIDOS INTERNOS ---
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [nuevoPedidoItem, setNuevoPedidoItem] = useState({
    semielaborado: null,
    cantidad: "",
  });
  const [carritoPedidos, setCarritoPedidos] = useState([]);
  const [pedidoDestino, setPedidoDestino] = useState("DEP_AYOLAS");

  // --- DESPACHO ---
  const [modalDespachoOpen, setModalDespachoOpen] = useState(false);
  const [solicitudADespachar, setSolicitudADespachar] = useState(null); // Solo para compatibilidad con modal viejo (puede removerse si solo usas lote)
  const [seleccionados, setSeleccionados] = useState([]);

  // --- OTROS ---
  const [remitoData, setRemitoData] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_ITEMS_PER_PAGE = 8;
  const [modalItemsOpen, setModalItemsOpen] = useState(false);
  const [itemsParaVer, setItemsParaVer] = useState([]);
  const [codigoParaVer, setCodigoParaVer] = useState("");
  const [autoCompleteReset, setAutoCompleteReset] = useState(Date.now());

  // --- EDICIÓN / ENVIAR MANUAL ---
  const [editRowId, setEditRowId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [formEnvio, setFormEnvio] = useState({
    origen: "PLANTA_26",
    destino: "DEP_AYOLAS",
    chofer: "",
  });
  const [carrito, setCarrito] = useState([]);
  const [busquedaEnvio, setBusquedaEnvio] = useState("");

  // --- CARGA DATOS ---
  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/logistica/stock`);
      if (res.ok) {
        const data = await res.json();
        setStockGlobal(data);
        setStockVisible(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/logistica/historial`);
      if (res.ok) setHistorial(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  const fetchSolicitudes = async () => {
    try {
      const res = await authFetch(
        `${API_BASE_URL}/logistica/solicitudes/pendientes`
      );
      if (res.ok) setSolicitudesPendientes(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === "STOCK") fetchStock();
    if (activeTab === "HISTORIAL") fetchHistorial();
    if (activeTab === "PEDIDOS") fetchSolicitudes();
    if (activeTab === "ENVIAR" && stockGlobal.length === 0) fetchStock();
  }, [activeTab]);

  // --- LÓGICA PEDIDOS (CARRITO) ---
  const agregarAlCarritoPedido = () => {
    if (!nuevoPedidoItem.semielaborado || !nuevoPedidoItem.cantidad)
      return alert("Faltan datos");
    setCarritoPedidos([
      ...carritoPedidos,
      { ...nuevoPedidoItem, idTemp: Date.now() },
    ]);
    setNuevoPedidoItem({ semielaborado: null, cantidad: "" });
    setAutoCompleteReset(Date.now());
  };
  const quitarDelCarritoPedido = (id) =>
    setCarritoPedidos(carritoPedidos.filter((i) => i.idTemp !== id));

  const enviarPedidoCompleto = async () => {
    if (carritoPedidos.length === 0) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/logistica/solicitud`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carritoPedidos.map((i) => ({
            id: i.semielaborado.id,
            cantidad: i.cantidad,
          })),
          destino: pedidoDestino,
        }),
      });
      if (res.ok) {
        alert("✅ Pedido enviado correctamente.");
        setCarritoPedidos([]);
        fetchSolicitudes();
      }
    } catch (e) {
      alert("Error al enviar");
    }
    setLoading(false);
  };

  // --- LÓGICA DESPACHO (SELECCIÓN) ---
  const toggleSeleccion = (id) => {
    if (seleccionados.includes(id))
      setSeleccionados(seleccionados.filter((s) => s !== id));
    else setSeleccionados([...seleccionados, id]);
  };

  const confirmarDespachoLote = async (origen, chofer) => {
    setModalDespachoOpen(false);
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/logistica/solicitudes/despachar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: seleccionados, origen, chofer }),
        }
      );

      if (res.status === 403) {
        alert("⛔ Solo GERENCIA.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (res.ok) {
        // Preparar datos para el QR
        const itemsDespachados = solicitudesPendientes
          .filter((s) => seleccionados.includes(s.id))
          .map((s) => ({
            nombre: s.nombre,
            codigo: s.codigo,
            cantidad: s.cantidad,
          }));

        const qrPayload = JSON.stringify({
          type: "REMITO",
          codigo: data.codigo_remito,
        });
        const url = await QRCode.toDataURL(qrPayload, {
          width: 400,
          margin: 2,
        });

        setRemitoData({
          codigo: data.codigo_remito,
          qrUrl: url,
          items: itemsDespachados,
          origen: origen,
          destino: "Varios/Lote",
          chofer: chofer,
          fecha: new Date().toLocaleString("es-AR"),
        });

        alert("✅ Lote despachado. Generando Remito...");
        setSeleccionados([]);
        fetchSolicitudes();
        setActiveTab("ENVIAR"); // Ir a ver el QR
      }
    } catch (e) {
      alert("Error al despachar");
    }
    setLoading(false);
  };

  const handleCancelarPedido = async (id) => {
    if (confirm("¿Cancelar?")) {
      await authFetch(`${API_BASE_URL}/logistica/solicitud/${id}`, {
        method: "DELETE",
      });
      fetchSolicitudes();
    }
  };

  // --- OTROS HANDLERS ---
  const verDetalleItems = (mov) => {
    setItemsParaVer(mov.items_detalle || []);
    setCodigoParaVer(mov.codigo_remito);
    setModalItemsOpen(true);
  };
  const descargarPDF = () => {
    if (remitoData) generarPDFRemito(remitoData);
  };
  const generarPDFHistorial = (mov) => {
    generarPDFRemito({
      codigo: mov.codigo_remito,
      fecha: mov.fecha_salida_arg,
      origen: mov.origen,
      destino: mov.destino,
      chofer: mov.chofer,
      items: mov.items_detalle,
    });
  };

  // ... (Funciones reutilizadas) ...
  const agregarAStockVisible = (item) => {
    if (!stockVisible.find((i) => i.id === item.id))
      setStockVisible([item, ...stockVisible]);
    setAutoCompleteReset(Date.now());
  };
  const quitarDeStockVisible = (id) =>
    setStockVisible(stockVisible.filter((i) => i.id !== id));
  const filtrarNegativos = () => {
    const negativos = stockGlobal.filter(
      (item) =>
        Number(item.stock_planta_26) < 0 ||
        Number(item.stock_planta_37) < 0 ||
        Number(item.stock_deposito_ayolas) < 0 ||
        Number(item.stock_deposito_quintana) < 0
    );
    setStockVisible(negativos);
    if (negativos.length === 0) alert("¡Excelente! No hay stock negativo.");
  };
  const handleResetNegativos = async () => {
    if (!confirm("⚠️ ¿Resetear a 0 los negativos?")) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/logistica/reset-negativos`, {
        method: "POST",
      });
      if (res.ok) fetchStock();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  const handleForceSync = async () => {
    if (!confirm("¿Sincronizar Drive?")) return;
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/ingenieria/sincronizar-stock`,
        { method: "POST" }
      );
      if (res.ok) fetchStock();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  const iniciarEdicion = (item) => {
    setEditRowId(item.id);
    setEditValues({
      p26: item.stock_planta_26,
      p37: item.stock_planta_37,
      ayolas: item.stock_deposito_ayolas,
      quintana: item.stock_deposito_quintana,
    });
  };
  const cancelarEdicion = () => setEditRowId(null);
  const guardarEdicion = async (id) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/logistica/stock/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      if (res.ok) {
        const updater = (prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  stock_planta_26: editValues.p26,
                  stock_planta_37: editValues.p37,
                  stock_deposito_ayolas: editValues.ayolas,
                  stock_deposito_quintana: editValues.quintana,
                }
              : item
          );
        setStockVisible(updater);
        setStockGlobal(updater);
        setEditRowId(null);
      }
    } catch (e) {
      alert("Error");
    }
  };
  const agregarAlCarrito = (producto) => {
    if (carrito.find((item) => item.id === producto.id)) return;
    setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    setBusquedaEnvio("");
  };
  const quitarDelCarrito = (id) =>
    setCarrito(carrito.filter((item) => item.id !== id));
  const cambiarCantidad = (id, valor) =>
    setCarrito(
      carrito.map((item) =>
        item.id === id ? { ...item, cantidad: Number(valor) } : item
      )
    );
  const handleGenerarRemito = async () => {
    if (carrito.length === 0) return alert("Vacío");
    if (!formEnvio.chofer.trim()) return alert("Falta chofer");
    try {
      const res = await authFetch(`${API_BASE_URL}/logistica/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carrito.map((i) => ({ id: i.id, cantidad: i.cantidad })),
          origen: formEnvio.origen,
          destino: formEnvio.destino,
          chofer: formEnvio.chofer,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const qrPayload = JSON.stringify({
          type: "REMITO",
          codigo: data.codigo_remito,
        });
        const url = await QRCode.toDataURL(qrPayload, {
          width: 400,
          margin: 2,
        });
        setRemitoData({
          codigo: data.codigo_remito,
          qrUrl: url,
          items: [...carrito],
          origen: formEnvio.origen,
          destino: formEnvio.destino,
          chofer: formEnvio.chofer,
          fecha: new Date().toLocaleString("es-AR"),
        });
        setCarrito([]);
        setFormEnvio({ ...formEnvio, chofer: "" });
        fetchStock();
      }
    } catch (err) {
      alert("Error");
    }
  };
  const handleScan = async (result) => {
    if (result && !scanResult) {
      try {
        const raw = result[0].rawValue;
        const data = JSON.parse(raw);
        if (data.type === "REMITO" && data.codigo) {
          const res = await authFetch(`${API_BASE_URL}/logistica/recibir`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo_remito: data.codigo }),
          });
          const response = await res.json();
          if (res.ok) {
            setScanResult({
              success: true,
              msg: response.msg,
              origen: response.origen,
              destino: response.destino,
            });
            fetchStock();
          } else {
            setScanError(response.msg);
          }
        }
      } catch (e) {
        setScanError("QR Inválido");
      }
    }
  };
  const resetScan = () => {
    setScanResult(null);
    setScanError("");
  };
  const resultadosBusquedaEnvio = stockGlobal.filter(
    (s) =>
      (s.nombre || "").toLowerCase().includes(busquedaEnvio.toLowerCase()) ||
      (s.codigo || "").toLowerCase().includes(busquedaEnvio.toLowerCase())
  );

  // --- AQUÍ AGREGAMOS LA VARIABLE FALTANTE ---
  const totalHistoryPages = Math.ceil(
    historial.length / HISTORY_ITEMS_PER_PAGE
  );
  const currentHistoryItems = historial.slice(
    (historyPage - 1) * HISTORY_ITEMS_PER_PAGE,
    historyPage * HISTORY_ITEMS_PER_PAGE
  );

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in pb-20">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <FaTruck className="text-4xl text-orange-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">Logística 4 Plantas</h1>
          <p className="text-gray-400">
            Control de Stock: P26, P37, Ayolas y Quintana.
          </p>
        </div>
      </div>

      <div className="flex border-b border-slate-700 mb-6 overflow-x-auto">
        <Tab
          icon={<FaBoxOpen />}
          label="Stock"
          active={activeTab === "STOCK"}
          onClick={() => setActiveTab("STOCK")}
        />
        <Tab
          icon={<FaCartPlus />}
          label="Pedidos Internos"
          active={activeTab === "PEDIDOS"}
          onClick={() => setActiveTab("PEDIDOS")}
        />
        <Tab
          icon={<FaTruck />}
          label="Armar Envío"
          active={activeTab === "ENVIAR"}
          onClick={() => setActiveTab("ENVIAR")}
        />
        <Tab
          icon={<FaCheckCircle />}
          label="Recibir (QR)"
          active={activeTab === "RECIBIR"}
          onClick={() => setActiveTab("RECIBIR")}
        />
        <Tab
          icon={<FaHistory />}
          label="Historial"
          active={activeTab === "HISTORIAL"}
          onClick={() => setActiveTab("HISTORIAL")}
        />
      </div>

      {/* TAB PEDIDOS INTERNOS (CARRITO MEJORADO) */}
      {activeTab === "PEDIDOS" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 1. CARRITO DE PEDIDOS */}
          <div className="lg:col-span-1 bg-slate-800 p-5 rounded-xl border border-slate-700 h-fit shadow-lg">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <FaCartPlus /> Solicitar Mercadería
            </h3>

            <div className="space-y-3 mb-4">
              <AutoCompleteInput
                key={autoCompleteReset}
                items={stockGlobal}
                onSelect={(s) =>
                  setNuevoPedidoItem({ ...nuevoPedidoItem, semielaborado: s })
                }
                placeholder="Buscar producto..."
              />

              <div className="flex gap-2 items-stretch">
                <input
                  type="number"
                  min="1"
                  placeholder="Cant."
                  value={nuevoPedidoItem.cantidad}
                  onChange={(e) =>
                    setNuevoPedidoItem({
                      ...nuevoPedidoItem,
                      cantidad: e.target.value,
                    })
                  }
                  className="w-24 bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-bold text-center"
                />
                {/* BOTÓN MEJORADO */}
                <button
                  onClick={agregarAlCarritoPedido}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  <FaPlus /> Agregar
                </button>
              </div>
            </div>

            <div className="bg-slate-900/50 p-3 rounded-lg min-h-[150px] mb-4 border border-slate-700/50">
              {carritoPedidos.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">
                  Carrito vacío
                </p>
              ) : (
                <ul className="space-y-2">
                  {carritoPedidos.map((it) => (
                    <li
                      key={it.idTemp}
                      className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-1 last:border-b-0"
                    >
                      <span className="text-gray-300 truncate w-40">
                        {it.semielaborado.nombre}
                      </span>
                      <span className="font-bold text-white">
                        x{it.cantidad}
                      </span>
                      <button
                        onClick={() => quitarDelCarritoPedido(it.idTemp)}
                        className="text-red-400 hover:text-red-200 p-1"
                      >
                        <FaTimes />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase font-bold mb-1">
                Destino
              </label>
              <select
                className="w-full bg-slate-900 border-slate-600 rounded p-2 text-white mb-3"
                value={pedidoDestino}
                onChange={(e) => setPedidoDestino(e.target.value)}
              >
                <option value="DEP_AYOLAS">Ayolas</option>
                <option value="DEP_QUINTANA">Quintana</option>
                <option value="PLANTA_26">Planta 26</option>
                <option value="PLANTA_37">Planta 37</option>
              </select>
              <button
                onClick={enviarPedidoCompleto}
                disabled={loading || carritoPedidos.length === 0}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold shadow-lg transition-all disabled:opacity-50 flex justify-center gap-2"
              >
                <FaPaperPlane /> Enviar Pedido
              </button>
            </div>
          </div>

          {/* LISTA DE PENDIENTES (Con Checkboxes) */}
          <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
              <h3 className="text-white font-bold">Solicitudes Pendientes</h3>
              {seleccionados.length > 0 && (
                <button
                  onClick={() => setModalDespachoOpen(true)}
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow animate-in fade-in flex items-center gap-2"
                >
                  <FaTruck /> Despachar ({seleccionados.length})
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-gray-400 uppercase font-bold">
                  <tr>
                    <th className="p-4 w-10"></th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Destino</th>
                    <th className="p-4">Producto</th>
                    <th className="p-4 text-right">Cant.</th>
                    <th className="p-4 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {solicitudesPendientes.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-500">
                        No hay pedidos pendientes.
                      </td>
                    </tr>
                  ) : (
                    solicitudesPendientes.map((sol) => (
                      <tr
                        key={sol.id}
                        className={`hover:bg-slate-700/50 cursor-pointer transition-colors ${
                          seleccionados.includes(sol.id) ? "bg-blue-900/20" : ""
                        }`}
                        onClick={() => toggleSeleccion(sol.id)}
                      >
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={seleccionados.includes(sol.id)}
                            onChange={() => {}}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-4 text-gray-400">
                          {new Date(sol.fecha_creacion).toLocaleDateString()}
                        </td>
                        <td className="p-4 font-bold text-blue-300">
                          {sol.destino
                            .replace("DEP_", "")
                            .replace("PLANTA_", "P. ")}
                        </td>
                        <td className="p-4 text-white">
                          <div>{sol.nombre}</div>
                          <div className="text-xs text-gray-500">
                            {sol.codigo}
                          </div>
                        </td>
                        <td className="p-4 text-right font-bold text-xl">
                          {sol.cantidad}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelarPedido(sol.id);
                            }}
                            className="text-red-400 hover:bg-slate-700 p-2 rounded transition-colors"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB HISTORIAL */}
      {activeTab === "HISTORIAL" && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-gray-400 uppercase font-bold">
                <tr>
                  <th className="p-4">Salida</th>
                  <th className="p-4">Recepción</th>
                  <th className="p-4">Remito / Chofer</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Carga</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {currentHistoryItems.map((mov, i) => (
                  <tr
                    key={i}
                    className="hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="p-4">
                      {/* FECHA YA VIENE FORMATEADA DESDE SQL */}
                      <div className="font-bold text-white text-xs">
                        {mov.fecha_salida_arg
                          ? mov.fecha_salida_arg.split(" ")[0]
                          : "-"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {mov.fecha_salida_arg
                          ? mov.fecha_salida_arg.split(" ")[1]
                          : "-"}
                      </div>
                    </td>
                    <td className="p-4">
                      {mov.fecha_recepcion_arg ? (
                        <>
                          <div className="font-bold text-green-400 text-xs">
                            {mov.fecha_recepcion_arg.split(" ")[0]}
                          </div>
                          <div className="text-xs text-gray-400">
                            {mov.fecha_recepcion_arg.split(" ")[1]}
                          </div>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-xs text-blue-300">
                        {mov.codigo_remito}
                      </div>
                      <div className="text-xs text-gray-400">{mov.chofer}</div>
                    </td>
                    <td className="p-4">
                      <Badge
                        tipo={mov.estado}
                        texto={mov.estado.replace("_", " ")}
                      />
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-bold text-white">
                        {mov.total_unidades} u.
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {mov.total_items} ítems
                      </div>
                    </td>
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button
                        onClick={() => verDetalleItems(mov)}
                        className="p-2 bg-slate-700 hover:bg-blue-600 text-white rounded shadow"
                        title="Ver Items"
                      >
                        <FaEye />
                      </button>
                      <button
                        onClick={() => generarPDFHistorial(mov)}
                        className="p-2 bg-slate-700 hover:bg-red-600 text-white rounded shadow"
                        title="PDF"
                      >
                        <FaFilePdf />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalHistoryPages > 1 && (
            <div className="p-4 border-t border-slate-700 flex justify-center gap-4">
              <button
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                className="p-2 bg-slate-700 rounded text-white disabled:opacity-50"
              >
                <FaChevronLeft />
              </button>
              <span className="text-sm text-gray-400">
                Página {historyPage} de {totalHistoryPages}
              </span>
              <button
                onClick={() =>
                  setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))
                }
                disabled={historyPage === totalHistoryPages}
                className="p-2 bg-slate-700 rounded text-white disabled:opacity-50"
              >
                <FaChevronRight />
              </button>
            </div>
          )}
        </div>
      )}

      <ModalDespacho
        isOpen={modalDespachoOpen}
        onClose={() => setModalDespachoOpen(false)}
        onConfirm={confirmarDespachoLote}
      />

      <ModalVerItems
        isOpen={modalItemsOpen}
        onClose={() => setModalItemsOpen(false)}
        items={itemsParaVer}
        codigo={codigoParaVer}
      />

      {/* TABS STOCK, ENVIAR, RECIBIR (REUTILIZADOS, COPIAR SI FALTAN) */}
      {activeTab === "STOCK" && (
        <div className="space-y-6">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <AutoCompleteInput
                key={autoCompleteReset}
                items={stockGlobal}
                onSelect={agregarAStockVisible}
                placeholder="🔍 Buscar producto..."
              />
            </div>
            <button
              onClick={handleForceSync}
              className="whitespace-nowrap px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 text-sm shadow-lg"
            >
              <FaSync className={loading ? "animate-spin" : ""} /> Sync Drive
            </button>
            <button
              onClick={() => setStockVisible([...stockGlobal])}
              className="whitespace-nowrap px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex items-center gap-2 text-sm"
            >
              <FaListUl /> Cargar Todo
            </button>
            <button
              onClick={() => setStockVisible([])}
              className="whitespace-nowrap px-4 py-3 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-bold flex items-center gap-2 text-sm"
            >
              <FaEraser /> Limpiar
            </button>
            <button
              onClick={filtrarNegativos}
              className="whitespace-nowrap px-4 py-3 bg-yellow-600/80 hover:bg-yellow-600 text-white border border-yellow-500/50 rounded-lg font-bold flex items-center gap-2 text-sm"
            >
              <FaExclamationTriangle /> Auditar Negativos
            </button>
            <button
              onClick={handleResetNegativos}
              className="whitespace-nowrap px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold flex items-center gap-2 text-sm shadow-lg"
            >
              <FaTrash /> Reset Negativos
            </button>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg min-h-[300px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-gray-400 uppercase font-bold">
                <tr>
                  <th className="p-4">Producto</th>
                  <th className="p-4 text-center text-blue-400 w-24">P. 26</th>
                  <th className="p-4 text-center text-purple-400 w-24">
                    P. 37
                  </th>
                  <th className="p-4 text-center text-orange-400 w-24">
                    Ayolas
                  </th>
                  <th className="p-4 text-center text-teal-400 w-24">
                    Quintana
                  </th>
                  <th className="p-4 text-center text-white w-24 bg-white/5">
                    TOTAL
                  </th>
                  <th className="p-4 text-right w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {stockVisible.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="p-10 text-center text-gray-500 italic"
                    >
                      Lista vacía.
                    </td>
                  </tr>
                ) : (
                  stockVisible.map((item) => {
                    const isEditing = editRowId === item.id;
                    const total =
                      Number(
                        isEditing ? editValues.p26 : item.stock_planta_26
                      ) +
                      Number(
                        isEditing ? editValues.p37 : item.stock_planta_37
                      ) +
                      Number(
                        isEditing
                          ? editValues.ayolas
                          : item.stock_deposito_ayolas
                      ) +
                      Number(
                        isEditing
                          ? editValues.quintana
                          : item.stock_deposito_quintana
                      );
                    const checkNeg = (val) =>
                      Number(val) < 0
                        ? "text-red-500 font-extrabold bg-red-900/20 px-2 py-1 rounded"
                        : "font-bold";
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-700/50 transition-colors ${
                          isEditing ? "bg-slate-700/80" : ""
                        }`}
                      >
                        <td className="p-4 font-medium text-white">
                          <div className="flex flex-col">
                            <span>{item.nombre}</span>
                            <span className="text-xs text-gray-500 font-mono">
                              {item.codigo}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              className="w-full bg-slate-900 border border-blue-500 rounded p-1 text-center text-white font-bold"
                              value={editValues.p26}
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  p26: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span className={checkNeg(item.stock_planta_26)}>
                              {item.stock_planta_26}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              className="w-full bg-slate-900 border border-purple-500 rounded p-1 text-center text-white font-bold"
                              value={editValues.p37}
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  p37: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span className={checkNeg(item.stock_planta_37)}>
                              {item.stock_planta_37}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              className="w-full bg-slate-900 border border-orange-500 rounded p-1 text-center text-white font-bold"
                              value={editValues.ayolas}
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  ayolas: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span
                              className={checkNeg(item.stock_deposito_ayolas)}
                            >
                              {item.stock_deposito_ayolas}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              className="w-full bg-slate-900 border border-teal-500 rounded p-1 text-center text-white font-bold"
                              value={editValues.quintana}
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  quintana: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span
                              className={checkNeg(item.stock_deposito_quintana)}
                            >
                              {item.stock_deposito_quintana}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center font-black text-white bg-white/5">
                          {total}
                        </td>
                        <td className="p-4 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => guardarEdicion(item.id)}
                                className="p-2 bg-green-600 text-white rounded"
                              >
                                <FaSave />
                              </button>
                              <button
                                onClick={cancelarEdicion}
                                className="p-2 bg-gray-600 text-white rounded"
                              >
                                <FaTimes />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => iniciarEdicion(item)}
                                className="p-2 text-blue-400 hover:bg-slate-700 rounded"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => quitarDeStockVisible(item.id)}
                                className="p-2 text-gray-500 hover:bg-slate-700 rounded"
                              >
                                <FaTimes />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab === "ENVIAR" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs uppercase text-gray-400 font-bold block mb-1">
                  Origen
                </label>
                <select
                  className="w-full bg-slate-900 border-slate-600 rounded p-2 text-white"
                  value={formEnvio.origen}
                  onChange={(e) =>
                    setFormEnvio({ ...formEnvio, origen: e.target.value })
                  }
                >
                  <option value="PLANTA_26">Planta 26</option>
                  <option value="PLANTA_37">Planta 37</option>
                  <option value="DEP_AYOLAS">Ayolas</option>
                  <option value="DEP_QUINTANA">Quintana</option>
                </select>
              </div>
              <FaArrowRight className="text-gray-500 mb-3" />
              <div className="flex-1">
                <label className="text-xs uppercase text-gray-400 font-bold block mb-1">
                  Destino
                </label>
                <select
                  className="w-full bg-slate-900 border-slate-600 rounded p-2 text-white"
                  value={formEnvio.destino}
                  onChange={(e) =>
                    setFormEnvio({ ...formEnvio, destino: e.target.value })
                  }
                >
                  <option value="DEP_AYOLAS">Ayolas</option>
                  <option value="DEP_QUINTANA">Quintana</option>
                  <option value="PLANTA_26">Planta 26</option>
                  <option value="PLANTA_37">Planta 37</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase text-gray-400 font-bold block mb-1 flex items-center gap-1">
                <FaUserTie /> Chofer
              </label>
              <input
                type="text"
                placeholder="Nombre del conductor..."
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                value={formEnvio.chofer}
                onChange={(e) =>
                  setFormEnvio({ ...formEnvio, chofer: e.target.value })
                }
              />
            </div>
          </div>
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 min-h-[300px]">
            <h3 className="text-white font-bold flex items-center gap-2 mb-4">
              <FaListUl /> Lista de Envío ({carrito.length})
            </h3>
            {carrito.length === 0 ? (
              <div className="text-center text-gray-500 py-10 border-2 border-dashed border-slate-700 rounded-lg">
                Lista vacía.
              </div>
            ) : (
              <ul className="space-y-2">
                {carrito.map((item) => (
                  <li
                    key={item.id}
                    className="bg-slate-700 p-3 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm truncate">
                        {item.nombre}
                      </p>
                      <p className="text-xs text-gray-400">{item.codigo}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) =>
                          cambiarCantidad(item.id, e.target.value)
                        }
                        className="w-16 bg-slate-900 border border-slate-600 rounded p-1 text-center text-white font-bold"
                      />
                      <button
                        onClick={() => quitarDelCarrito(item.id)}
                        className="text-red-400"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {carrito.length > 0 && !remitoData && (
              <button
                onClick={handleGenerarRemito}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold shadow-lg"
              >
                Generar Remito
              </button>
            )}

            {remitoData && (
              <div className="mt-6 bg-white p-4 rounded-lg flex flex-col items-center text-center animate-in zoom-in">
                <p className="text-black font-bold mb-2">{remitoData.codigo}</p>
                <img
                  src={remitoData.qrUrl}
                  alt="QR"
                  className="w-32 h-32 border-2 border-black"
                />
                <button
                  onClick={descargarPDF}
                  className="mt-2 bg-black text-white px-4 py-2 rounded text-sm font-bold"
                >
                  Descargar PDF
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === "RECIBIR" && (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          {!scanResult && !scanError ? (
            <div className="w-full max-w-md bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-700 relative">
              <Scanner
                onScan={handleScan}
                components={{ audio: false, finder: true }}
                styles={{ container: { width: "100%", height: "300px" } }}
              />
              <p className="text-center text-white p-4 bg-slate-900 font-bold">
                Escanear QR de Remito
              </p>
            </div>
          ) : (
            <div
              className={`p-8 rounded-2xl shadow-2xl text-center max-w-md w-full ${
                scanError
                  ? "bg-red-900/80 border-red-600"
                  : "bg-green-900/80 border-green-600"
              } border-2`}
            >
              {scanError ? (
                <>
                  <FaTimes className="text-6xl text-red-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Error</h3>
                  <p className="text-red-200 mb-6">{scanError}</p>
                </>
              ) : (
                <>
                  <FaCheckCircle className="text-6xl text-green-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">
                    ¡Recepción Exitosa!
                  </h3>
                  <p className="text-green-200 mb-6">{scanResult?.msg}</p>
                </>
              )}
              <button
                onClick={resetScan}
                className="bg-white text-slate-900 px-6 py-2 rounded-lg font-bold hover:bg-gray-200"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
