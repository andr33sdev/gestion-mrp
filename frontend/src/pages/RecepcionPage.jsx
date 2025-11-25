import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  FaCheckCircle,
  FaTimes,
  FaBoxOpen,
  FaSignOutAlt,
} from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../utils.js";

export default function RecepcionPage({ onNavigate }) {
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleScan = async (result) => {
    if (result && !scanResult && !loading) {
      setLoading(true);
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
          } else {
            setScanError(response.msg || "Error al procesar");
          }
        } else {
          setScanError("El código QR no es un remito válido.");
        }
      } catch (e) {
        setScanError("QR Inválido o Error de Conexión");
      } finally {
        setLoading(false);
      }
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setScanError("");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      {/* Header Simple */}
      <div className="w-full max-w-md flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
          <FaBoxOpen className="text-3xl text-blue-400" />
          <div>
            <h1 className="text-xl font-bold">Recepción</h1>
            <p className="text-xs text-gray-400">Depósito</p>
          </div>
        </div>
        {/* Botón de Salir o Volver */}
        <button
          onClick={() => onNavigate("/")}
          className="text-gray-400 hover:text-white"
        >
          <FaSignOutAlt />
        </button>
      </div>

      {/* Área de Escaneo */}
      <div className="w-full max-w-md flex-1 flex flex-col justify-center">
        {!scanResult && !scanError ? (
          <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-700 relative">
            <Scanner
              onScan={handleScan}
              components={{ audio: false, finder: true }}
              styles={{ container: { width: "100%", height: "400px" } }}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-slate-900/90 p-4 text-center">
              <p className="font-bold text-white animate-pulse">
                Escaneando Remito...
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Apunte la cámara al código QR
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`p-8 rounded-2xl shadow-2xl text-center w-full ${
              scanError
                ? "bg-red-900/20 border-2 border-red-500"
                : "bg-green-900/20 border-2 border-green-500"
            }`}
          >
            {scanError ? (
              <>
                <FaTimes className="text-6xl text-red-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Error</h3>
                <p className="text-red-200 mb-6">{scanError}</p>
              </>
            ) : (
              <>
                <FaCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">
                  ¡Recibido!
                </h3>
                <div className="bg-slate-800/50 p-4 rounded-lg mb-6 text-left text-sm">
                  <p className="text-gray-400">
                    Origen:{" "}
                    <span className="text-white font-bold">
                      {scanResult?.origen}
                    </span>
                  </p>
                  <p className="text-gray-400">
                    Destino:{" "}
                    <span className="text-white font-bold">
                      {scanResult?.destino}
                    </span>
                  </p>
                  <p className="mt-2 text-green-300">{scanResult?.msg}</p>
                </div>
              </>
            )}
            <button
              onClick={resetScan}
              className="w-full bg-white text-slate-900 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-lg"
            >
              Escanear Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
