import { useEffect, useState, useLayoutEffect } from "react";
import { API_BASE_URL, authFetch } from "../utils";
import QRCode from "qrcode";
import {
  FaSync,
  FaTruckLoading,
  FaSearch,
  FaPrint,
  FaChevronLeft,
  FaChevronRight,
  FaCheck,
  FaTruck,
  FaUndo,
  FaFilter,
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import { getAuthData } from "../auth/authHelper";

export default function DepositoDespacho() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Empezamos bajo para evitar salto visual

  const { role } = getAuthData();
  const isGerencia = role === "GERENCIA";

  // --- CÁLCULO EXACTO DE FILAS (AUTO-FIT) ---
  useLayoutEffect(() => {
    function updateSize() {
      // Altura ventana - Header(56) - Padding Contenedor(16) - Header Tabla(35) - Footer(36) - Margen Seguridad(20)
      const espacioOcupadoFijo = 56 + 16 + 35 + 36 + 20;
      const alturaDisponible = window.innerHeight - espacioOcupadoFijo;

      const alturaFila = 34; // Altura fija de cada fila en px
      const filas = Math.floor(alturaDisponible / alturaFila);

      // Mínimo 5 filas por seguridad
      setItemsPerPage(Math.max(5, filas));
    }

    window.addEventListener("resize", updateSize);
    updateSize();
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const cargarPedidos = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/deposito/pedidos`);
      if (res.ok) {
        const data = await res.json();
        setPedidos(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/deposito/sincronizar`, {
        method: "POST",
      });
      if (res.ok) {
        alert("Sincronizado correctamente.");
        cargarPedidos();
      }
    } catch (e) {
      alert("Error al sincronizar");
    }
    setLoading(false);
  };

  useEffect(() => {
    cargarPedidos();
  }, []);

  // --- FILTRADO ---
  const pedidosFiltrados = pedidos.filter((p) => {
    const texto = busqueda.toLowerCase();
    const coincideTexto =
      p.cliente?.toLowerCase().includes(texto) ||
      p.op?.includes(texto) ||
      p.modelo?.toLowerCase().includes(texto);

    let coincideEstado = true;
    if (filtroEstado !== "TODOS") {
      if (filtroEstado === "PENDIENTES_ACCION") {
        coincideEstado = p.estado === "EN STOCK" || p.estado === "SIN STOCK";
      } else {
        coincideEstado = p.estado === filtroEstado;
      }
    }
    return coincideTexto && coincideEstado;
  });

  const totalPages = Math.ceil(pedidosFiltrados.length / itemsPerPage);
  if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
  const currentData = pedidosFiltrados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // --- ACCIONES ---
  const handlePreparar = async (id) => {
    if (!confirm("¿Marcar PREPARADO?")) return;
    try {
      await authFetch(`${API_BASE_URL}/deposito/preparar/${id}`, {
        method: "POST",
      });
      cargarPedidos();
    } catch (e) {}
  };
  const handleDespachar = async (id) => {
    if (!confirm("¿Confirmar DESPACHO?")) return;
    try {
      await authFetch(`${API_BASE_URL}/deposito/despachar/${id}`, {
        method: "POST",
      });
      cargarPedidos();
    } catch (e) {}
  };
  const handleRevertir = async (id) => {
    if (!confirm("¿Revertir estado?")) return;
    try {
      await authFetch(`${API_BASE_URL}/deposito/revertir/${id}`, {
        method: "POST",
      });
      cargarPedidos();
    } catch (e) {}
  };

  const imprimirEtiqueta = async (pedido) => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [100, 60],
    });
    const qrText = JSON.stringify({
      id: pedido.id,
      op: pedido.op,
      type: "DESPACHO",
    });
    try {
      const url = await QRCode.toDataURL(qrText, { margin: 1 });
      doc.addImage(url, "PNG", 2, 5, 25, 25);
      doc.setFontSize(14);
      doc.text(`OP: ${pedido.op}`, 30, 12);
      doc.setFontSize(10);
      doc.text(`${pedido.cliente?.substring(0, 25)}`, 30, 18);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${pedido.modelo}`, 30, 24);
      doc.setFontSize(20);
      doc.text(`CANT: ${pedido.cantidad}`, 30, 35);
      doc.save(`Etiqueta_${pedido.op}.pdf`);
    } catch (e) {}
  };

  const goToPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  return (
    // USAMOS h-[100dvh] PARA QUE OCUPE EXACTAMENTE LA PANTALLA
    // overflow-hidden BLOQUEA CUALQUIER SCROLL DEL BODY
    <div className="h-[100dvh] w-full flex flex-col bg-slate-950 text-white overflow-hidden font-sans">
      {/* HEADER (Altura fija 56px) */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex justify-between items-center px-4 shrink-0 shadow-md z-20 gap-4">
        <h1 className="text-base font-bold flex items-center gap-2 text-white uppercase tracking-wider whitespace-nowrap">
          <FaTruckLoading className="text-blue-500" /> Despacho
        </h1>

        {/* BARRA DE HERRAMIENTAS */}
        <div className="flex items-center gap-2 flex-1 max-w-3xl">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-2 text-gray-500 text-xs" />
            <input
              type="text"
              placeholder="Buscar OP, Cliente..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-4 py-1.5 text-xs focus:border-blue-500 outline-none text-gray-300 transition-all"
            />
          </div>
          <div className="relative">
            <FaFilter className="absolute left-3 top-2 text-gray-400 text-xs pointer-events-none" />
            <select
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-xs focus:border-blue-500 outline-none text-gray-300 appearance-none cursor-pointer font-bold uppercase"
            >
              <option value="TODOS">Todos</option>
              <option value="PENDIENTES_ACCION">Pendientes</option>
              <option value="EN STOCK">✅ En Stock</option>
              <option value="SIN STOCK">🔴 Sin Stock</option>
              <option value="PREPARADO">📦 Preparado</option>
              <option value="ENTREGADO">🚚 Entregado</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 text-xs transition-all shadow-lg active:scale-95 whitespace-nowrap"
        >
          <FaSync className={loading ? "animate-spin" : ""} />{" "}
          {loading ? "..." : "Sync"}
        </button>
      </div>

      {/* CONTENEDOR PRINCIPAL: flex-1 ocupa el resto, min-h-0 PERMITE QUE SE ENCOJA */}
      <div className="flex-1 p-2 overflow-hidden flex flex-col min-h-0">
        <div className="bg-slate-900 rounded-lg border border-slate-800 flex flex-col shadow-2xl h-full w-full">
          {/* HEADERS TABLA (Altura fija) */}
          <div className="grid grid-cols-12 bg-slate-950 p-2 border-b border-slate-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0">
            <div className="col-span-1 text-center">Estado</div>
            <div className="col-span-1 text-center text-blue-400">Fecha</div>
            <div className="col-span-1">OP #</div>
            <div className="col-span-2">Cliente</div>
            <div className="col-span-2">Modelo</div>
            <div className="col-span-1 text-center">Cant.</div>
            <div className="col-span-1 text-center">F. Prep</div>
            <div className="col-span-1 text-center">F. Desp</div>
            <div className="col-span-2 text-center">Acciones</div>
          </div>

          {/* CUERPO TABLA (El único lugar donde permitimos scroll si falla el cálculo, pero oculto por defecto) */}
          <div className="flex-1 overflow-hidden relative">
            {currentData.map((p, idx) => {
              let rowClass =
                "hover:bg-slate-800 transition-colors bg-slate-900 border-b border-slate-800";
              let estadoTexto = "EN STOCK";
              let badgeClass = "bg-slate-700 text-slate-300 border-slate-600";

              if (p.estado === "ENTREGADO" || p.fecha_despacho) {
                rowClass =
                  "bg-orange-900/20 text-orange-100 hover:bg-orange-900/30 border-l-2 border-orange-500 border-b border-slate-800";
                estadoTexto = "ENTREGADO";
                badgeClass =
                  "bg-orange-500/20 text-orange-200 border-orange-500/40";
              } else if (p.estado === "PREPARADO" || p.fecha_preparacion) {
                rowClass =
                  "bg-emerald-900/20 text-emerald-100 hover:bg-emerald-900/30 border-l-2 border-emerald-500 border-b border-slate-800";
                estadoTexto = "PREPARADO";
                badgeClass =
                  "bg-emerald-500/20 text-emerald-200 border-emerald-500/40";
              } else if (p.estado === "SIN STOCK") {
                rowClass =
                  "bg-red-900/30 text-red-100 hover:bg-red-900/40 border-l-2 border-red-500 border-b border-slate-800";
                estadoTexto = "SIN STOCK";
                badgeClass = "bg-red-500/20 text-red-200 border-red-500/40";
              } else {
                rowClass =
                  "border-l-2 border-transparent border-b border-slate-800 " +
                  (idx % 2 === 0 ? "" : "bg-slate-800/30");
              }

              return (
                // Forzamos altura exacta h-[34px] para que coincida con el cálculo
                <div
                  key={p.id}
                  className={`grid grid-cols-12 px-2 py-0 items-center text-xs h-[34px] ${rowClass}`}
                >
                  <div className="col-span-1 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold border ${badgeClass}`}
                    >
                      {estadoTexto}
                    </span>
                  </div>
                  <div className="col-span-1 text-center font-mono opacity-80 text-[10px] leading-tight text-blue-200 whitespace-nowrap overflow-hidden">
                    {p.fecha}
                  </div>
                  <div className="col-span-1 font-mono font-bold opacity-80">
                    {p.op}
                  </div>
                  <div
                    className="col-span-2 truncate pr-2 font-medium opacity-80"
                    title={p.cliente}
                  >
                    {p.cliente}
                  </div>
                  <div
                    className="col-span-2 truncate pr-2 opacity-80"
                    title={p.modelo}
                  >
                    {p.modelo}
                  </div>
                  <div className="col-span-1 text-center font-mono font-bold">
                    {p.cantidad}
                  </div>
                  <div className="col-span-1 text-center font-mono opacity-80">
                    {p.fecha_preparacion || "-"}
                  </div>
                  <div className="col-span-1 text-center font-mono opacity-80">
                    {p.fecha_despacho || "-"}
                  </div>

                  <div className="col-span-2 flex justify-center gap-1">
                    <button
                      onClick={() => imprimirEtiqueta(p)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <FaPrint />
                    </button>
                    {(estadoTexto === "EN STOCK" ||
                      estadoTexto === "SIN STOCK") && (
                      <button
                        onClick={() => handlePreparar(p.id)}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[9px] font-bold flex items-center gap-1 shadow"
                      >
                        <FaCheck /> Prep
                      </button>
                    )}
                    {estadoTexto === "PREPARADO" && (
                      <button
                        onClick={() => handleDespachar(p.id)}
                        className="px-2 py-0.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-[9px] font-bold flex items-center gap-1 shadow"
                      >
                        <FaTruck /> Desp
                      </button>
                    )}
                    {isGerencia &&
                      estadoTexto !== "EN STOCK" &&
                      estadoTexto !== "SIN STOCK" && (
                        <button
                          onClick={() => handleRevertir(p.id)}
                          className="p-1 text-red-500 hover:bg-red-900/20 rounded"
                        >
                          <FaUndo size={10} />
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* FOOTER PAGINACIÓN (Altura fija 36px) */}
          <div className="h-9 bg-slate-950 border-t border-slate-800 flex justify-between items-center px-4 shrink-0 text-xs mt-auto">
            <span className="text-gray-500">
              Mostrando {currentData.length} de {pedidosFiltrados.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrev}
                disabled={currentPage === 1}
                className="p-1 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-30 text-gray-400"
              >
                <FaChevronLeft size={10} />
              </button>
              <span className="text-gray-300 font-mono">
                Pág {currentPage} / {totalPages || 1}
              </span>
              <button
                onClick={goToNext}
                disabled={currentPage === totalPages}
                className="p-1 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-30 text-gray-400"
              >
                <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
