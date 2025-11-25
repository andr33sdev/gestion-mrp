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
} from "react-icons/fa";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import AutoCompleteInput from "../components/planificacion/AutoCompleteInput";

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

export default function LogisticaPage() {
  const [activeTab, setActiveTab] = useState("STOCK");
  const [stockGlobal, setStockGlobal] = useState([]);
  const [stockVisible, setStockVisible] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- ESTADOS EDICIÓN ---
  const [editRowId, setEditRowId] = useState(null);
  const [editValues, setEditValues] = useState({
    p26: 0,
    p37: 0,
    ayolas: 0,
    quintana: 0,
  });
  const [autoCompleteReset, setAutoCompleteReset] = useState(Date.now());

  // --- ESTADOS ENVIAR ---
  const [formEnvio, setFormEnvio] = useState({
    origen: "PLANTA_26",
    destino: "DEP_AYOLAS",
    chofer: "",
  });
  const [carrito, setCarrito] = useState([]);
  const [busquedaEnvio, setBusquedaEnvio] = useState("");
  const [remitoData, setRemitoData] = useState(null);

  // --- ESTADOS RECIBIR ---
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");

  // --- PAGINACIÓN HISTORIAL ---
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_ITEMS_PER_PAGE = 5;

  // --- CARGA INICIAL ---
  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/logistica/stock`);
      const data = await res.json();
      setStockGlobal(data);
      if (stockVisible.length > 0) {
        const actualizados = stockVisible.map(
          (v) => data.find((d) => d.id === v.id) || v
        );
        setStockVisible(actualizados);
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
      setHistorial(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStock();
    if (activeTab === "HISTORIAL") fetchHistorial();
  }, [activeTab]);

  // --- LÓGICA STOCK ---
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

  // --- NUEVA FUNCIÓN: LIMPIEZA DE NEGATIVOS ---
  const handleResetNegativos = async () => {
    if (
      !confirm(
        "⚠️ ¿Estás seguro?\n\nEsto pondrá en 0 TODOS los stocks negativos en la base de datos.\nÚsalo si ya corregiste el Excel y quieres limpiar errores viejos."
      )
    )
      return;

    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/logistica/reset-negativos`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.msg);
        fetchStock(); // Recarga la tabla limpia
      } else {
        alert("Error: " + data.msg);
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  // --- NUEVA FUNCIÓN: SYNC MANUAL ---
  const handleForceSync = async () => {
    if (!confirm("¿Actualizar stock desde Google Drive ahora?")) return;
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/ingenieria/sincronizar-stock`,
        { method: "POST" }
      );
      if (res.ok) {
        alert("Sincronización completada.");
        fetchStock();
      } else {
        alert("Error al sincronizar.");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión");
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
      } else alert("Error al guardar");
    } catch (e) {
      alert("Error de conexión");
    }
  };

  // --- LÓGICA ENVIAR ---
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
    if (carrito.length === 0) return alert("Carrito vacío");
    if (!formEnvio.chofer.trim()) return alert("Indique el chofer");

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
      alert("Error creando remito");
    }
  };

  const descargarPDF = () => {
    if (!remitoData) return;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("REMITO DE TRASLADO", 14, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`ID: ${remitoData.codigo}`, 14, 26);
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`FECHA: ${remitoData.fecha}`, 14, 40);
    doc.text(`ORIGEN: ${remitoData.origen}`, 14, 48);
    doc.text(`DESTINO: ${remitoData.destino}`, 14, 56);
    doc.setFont("helvetica", "bold");
    doc.text(`TRANSPORTISTA: ${remitoData.chofer.toUpperCase()}`, 14, 64);
    if (remitoData.qrUrl)
      doc.addImage(remitoData.qrUrl, "PNG", 140, 15, 50, 50);
    const body = remitoData.items.map((item) => [
      item.codigo || "-",
      item.nombre,
      item.cantidad,
    ]);
    autoTable(doc, {
      startY: 75,
      head: [["CÓDIGO", "PRODUCTO", "CANTIDAD"]],
      body: body,
      theme: "grid",
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: "bold" },
      columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
    });
    doc.save(`Remito_${remitoData.codigo}.pdf`);
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

  // --- CORRECCIÓN: BÚSQUEDA BLINDADA CONTRA NULOS ---
  const resultadosBusquedaEnvio = stockGlobal.filter(
    (s) =>
      (s.nombre || "").toLowerCase().includes(busquedaEnvio.toLowerCase()) ||
      (s.codigo || "").toLowerCase().includes(busquedaEnvio.toLowerCase())
  );

  const totalHistoryPages = Math.ceil(
    historial.length / HISTORY_ITEMS_PER_PAGE
  );
  const currentHistoryItems = historial.slice(
    (historyPage - 1) * HISTORY_ITEMS_PER_PAGE,
    historyPage * HISTORY_ITEMS_PER_PAGE
  );

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in pb-20">
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
          label="Gestión de Stock"
          active={activeTab === "STOCK"}
          onClick={() => setActiveTab("STOCK")}
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

      {/* TAB STOCK */}
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

            {/* --- BOTONES DE ACCIÓN --- */}
            <button
              onClick={handleForceSync}
              className="whitespace-nowrap px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 text-sm shadow-lg transition-all active:scale-95"
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

      {/* TAB ENVIAR */}
      {activeTab === "ENVIAR" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
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
            </div>
          </div>
          <div className="space-y-6">
            {remitoData ? (
              <div className="bg-white p-8 rounded-xl flex flex-col items-center justify-center text-center shadow-2xl animate-in zoom-in">
                <h3 className="text-black font-bold text-2xl mb-2">
                  REMITO GENERADO
                </h3>
                <p className="text-gray-600 mb-4">ID: {remitoData.codigo}</p>
                <img
                  src={remitoData.qrUrl}
                  alt="Remito QR"
                  className="w-48 h-48 border-4 border-black mb-4"
                />
                <p className="text-black font-bold mb-2">
                  {remitoData.chofer.toUpperCase()}
                </p>
                <button
                  onClick={descargarPDF}
                  className="mt-4 bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg"
                >
                  <FaFilePdf /> Descargar PDF
                </button>
                <button
                  onClick={() => setRemitoData(null)}
                  className="mt-4 text-blue-600 underline text-sm"
                >
                  Nuevo Envío
                </button>
              </div>
            ) : (
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 h-full flex flex-col">
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={busquedaEnvio}
                    onChange={(e) => setBusquedaEnvio(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:border-blue-500"
                  />
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
                  {resultadosBusquedaEnvio.length === 0 ? (
                    <p className="text-center text-gray-500 mt-10">
                      Sin resultados.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {resultadosBusquedaEnvio.map((item) => {
                        const enCarrito = carrito.some((c) => c.id === item.id);
                        return (
                          <li
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600/50 mb-2"
                          >
                            <div>
                              <p className="text-white font-medium text-sm">
                                {item.nombre}
                              </p>
                              <p className="text-xs text-gray-400">
                                Total:{" "}
                                {Number(item.stock_planta_26) +
                                  Number(item.stock_planta_37) +
                                  Number(item.stock_deposito_ayolas) +
                                  Number(item.stock_deposito_quintana)}
                              </p>
                            </div>
                            <button
                              onClick={() => agregarAlCarrito(item)}
                              disabled={enCarrito}
                              className={`w-8 h-8 flex items-center justify-center rounded-full ${
                                enCarrito ? "bg-green-600" : "bg-blue-600"
                              }`}
                            >
                              {enCarrito ? <FaCheckCircle /> : <FaPlus />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB RECIBIR */}
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

      {/* TAB HISTORIAL (PAGINADO) */}
      {activeTab === "HISTORIAL" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {historial.length === 0 && (
              <p className="text-center text-gray-500 py-10">
                No hay movimientos registrados.
              </p>
            )}
            {currentHistoryItems.map((viaje, i) => {
              const isRecibido = viaje.estado === "RECIBIDO";
              return (
                <div
                  key={i}
                  className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden"
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-2 ${
                      isRecibido ? "bg-green-500" : "bg-orange-500"
                    }`}
                  ></div>
                  <div className="flex items-center gap-6 w-full md:w-auto">
                    <div
                      className={`p-4 rounded-full ${
                        isRecibido
                          ? "bg-green-900/30 text-green-400"
                          : "bg-orange-900/30 text-orange-400"
                      }`}
                    >
                      <FaTruck className="text-2xl" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-gray-500 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                          {viaje.codigo_remito}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <FaClock size={10} />{" "}
                          {new Date(viaje.fecha).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-lg font-bold text-white">
                        <span>{viaje.origen}</span>
                        <FaArrowRight className="text-gray-600 text-sm" />
                        <span>{viaje.destino}</span>
                      </div>
                      <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                        <FaUserTie className="text-blue-400" /> Chofer:{" "}
                        <span className="text-gray-200">
                          {viaje.chofer || "Desconocido"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-700 pt-4 md:pt-0">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase font-bold">
                        Modelos
                      </p>
                      <p className="text-xl font-bold text-white">
                        {viaje.total_items}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase font-bold">
                        Unidades
                      </p>
                      <p className="text-xl font-bold text-white">
                        {viaje.total_unidades}
                      </p>
                    </div>
                    <div
                      className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                        isRecibido
                          ? "bg-green-900/20 border-green-500/50 text-green-400"
                          : "bg-orange-900/20 border-orange-500/50 text-orange-400 animate-pulse"
                      }`}
                    >
                      {isRecibido ? "ENTREGADO" : "EN CAMINO"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {totalHistoryPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                className="p-3 bg-slate-800 text-white rounded-full hover:bg-slate-700 disabled:opacity-50"
              >
                <FaChevronLeft />
              </button>
              <span className="text-gray-400 text-sm font-bold">
                Página {historyPage} de {totalHistoryPages}
              </span>
              <button
                onClick={() =>
                  setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))
                }
                disabled={historyPage === totalHistoryPages}
                className="p-3 bg-slate-800 text-white rounded-full hover:bg-slate-700 disabled:opacity-50"
              >
                <FaChevronRight />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
