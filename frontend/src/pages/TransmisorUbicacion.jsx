import React, { useState, useEffect } from "react";
import { FaLocationArrow, FaStopCircle } from "react-icons/fa";
import io from "socket.io-client";
import { API_BASE_URL } from "../utils";
import { getAuthData } from "../auth/authHelper";

// Conectamos al servidor (Reemplazá API_BASE_URL sacándole el /api si hace falta)
const socketURL = API_BASE_URL.replace("/api", "");
const socket = io(socketURL);

export default function TransmisorUbicacion() {
  const [transmitiendo, setTranstransmitiendo] = useState(false);
  const [error, setError] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const { user } = getAuthData();

  const iniciarViaje = () => {
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta GPS.");
      return;
    }

    setTranstransmitiendo(true);
    setError(null);

    const id = navigator.geolocation.watchPosition(
      (position) => {
        // Extraemos la "accuracy" (precisión en metros)
        const { latitude, longitude, speed, accuracy } = position.coords;

        // 🛡️ FILTRO DE PRECISIÓN (NUEVO)
        // Si el margen de error es mayor a 40 metros, ignoramos el dato.
        // Esto evita que el marcador "salte" a otra cuadra cuando la señal es débil.
        if (accuracy > 40) {
          console.log(
            `Descartado: Precisión muy baja (${Math.round(accuracy)} metros)`,
          );
          return;
        }

        // Si pasó el filtro, enviamos al servidor
        socket.emit("enviarUbicacion", {
          nombre: user?.nombre || "Repartidor",
          lat: latitude,
          lng: longitude,
          velocidad: speed || 0,
        });
      },
      (err) => {
        setError("Error de GPS: " + err.message);
        setTranstransmitiendo(false);
      },
      {
        enableHighAccuracy: true, // Obliga a prender el chip GPS de alta precisión
        maximumAge: 0, // PROHÍBE usar ubicaciones guardadas en caché
        timeout: 15000, // Le da 15 segundos al GPS para triangular bien
      },
    );
    setWatchId(id);
  };

  const detenerViaje = () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    setTranstransmitiendo(false);
    setWatchId(null);
  };

  // Limpiamos si el usuario sale de la pantalla
  useEffect(() => {
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [watchId]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-[#fcfbf9] p-6">
      <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-stone-100 max-w-sm w-full text-center">
        <div
          className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 transition-all duration-500 ${transmitiendo ? "bg-blue-100 text-blue-600 animate-pulse shadow-[0_0_40px_rgba(37,99,235,0.4)]" : "bg-stone-100 text-stone-400"}`}
        >
          <FaLocationArrow size={32} />
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-2">Radar Activo</h2>
        <p className="text-sm text-stone-500 mb-8">
          {transmitiendo
            ? "Transmitiendo tu ubicación en tiempo real a la central."
            : "Presioná el botón cuando comiences tu recorrido."}
        </p>

        {error && <p className="text-red-500 text-xs mb-4">{error}</p>}

        {!transmitiendo ? (
          <button
            onClick={iniciarViaje}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-200"
          >
            <FaLocationArrow /> Empezar a Transmitir
          </button>
        ) : (
          <button
            onClick={detenerViaje}
            className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-200"
          >
            <FaStopCircle /> Detener Transmisión
          </button>
        )}
      </div>
    </div>
  );
}
