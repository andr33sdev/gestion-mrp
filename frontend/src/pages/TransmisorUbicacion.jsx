import React, { useState, useEffect, useRef } from "react";
import {
  FaLocationArrow,
  FaStopCircle,
  FaSignal,
  FaLightbulb,
} from "react-icons/fa";
import io from "socket.io-client";
import { registerPlugin } from "@capacitor/core";
import { API_BASE_URL } from "../utils";
import { getAuthData } from "../auth/authHelper";

// Importamos el plugin de segundo plano
const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

const socketURL = API_BASE_URL.replace("/api", "");
const socket = io(socketURL, {
  transports: ["websocket"],
  upgrade: false, // Forzamos websocket desde el inicio
  rememberUpgrade: true,
  secure: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500, // Reintento súper rápido
  timeout: 20000,
});

export default function TransmisorUbicacion() {
  const [transmitiendo, setTranstransmitiendo] = useState(false);
  const [error, setError] = useState(null);
  const [precisionMetros, setPrecisionMetros] = useState(null);

  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const { user } = getAuthData();

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (err) {
      console.log("No se pudo bloquear la pantalla:", err.message);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const iniciarViaje = async () => {
    try {
      setError(null);
      setTranstransmitiendo(true);
      setPrecisionMetros("Iniciando Radar...");

      await requestWakeLock();

      // Iniciamos el rastreo de fondo con notificación persistente
      const watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Transmitiendo ubicación en tiempo real...",
          backgroundTitle: "Rastreo Logística Activo",
          requestPermissions: true,
          stale: false,
          distanceFilter: 2, // Se activa cada 2 metros de movimiento
        },
        (location, err) => {
          if (err) {
            setError("Error de GPS: " + err.message);
            return;
          }

          if (location) {
            const { latitude, longitude, speed, accuracy } = location;
            setPrecisionMetros(Math.round(accuracy));

            socket.emit("enviarUbicacion", {
              nombre: user?.nombre || "Repartidor",
              lat: latitude,
              lng: longitude,
              velocidad: speed || 0,
              precision: accuracy,
            });
          }
        },
      );

      watchIdRef.current = watcherId;
    } catch (error) {
      setError(error.message);
      setTranstransmitiendo(false);
      releaseWakeLock();
    }
  };

  const detenerViaje = async () => {
    if (watchIdRef.current) {
      // Removemos el watcher de fondo
      await BackgroundGeolocation.removeWatcher({ id: watchIdRef.current });
      watchIdRef.current = null;
    }

    setTranstransmitiendo(false);
    setPrecisionMetros(null);
    releaseWakeLock();
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (transmitiendo && document.visibilityState === "visible") {
        await requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (watchIdRef.current) {
        BackgroundGeolocation.removeWatcher({ id: watchIdRef.current });
      }
      releaseWakeLock();
    };
  }, [transmitiendo]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-[#fcfbf9] p-6">
      <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-stone-100 max-w-sm w-full text-center relative overflow-hidden">
        <div
          className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 transition-all duration-500 ${transmitiendo ? "bg-blue-100 text-blue-600 animate-pulse shadow-[0_0_40px_rgba(37,99,235,0.4)]" : "bg-stone-100 text-stone-400"}`}
        >
          <FaLocationArrow size={32} />
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-2">Radar Activo</h2>

        <div className="mb-8 h-12 flex flex-col justify-center">
          {transmitiendo ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-500 flex items-center gap-2">
                <FaSignal /> Transmitiendo
              </span>
              <span
                className={`text-[10px] font-medium ${precisionMetros > 100 ? "text-rose-500" : "text-emerald-500"}`}
              >
                Margen de error:{" "}
                {typeof precisionMetros === "number"
                  ? `${precisionMetros} metros`
                  : precisionMetros}
              </span>
            </div>
          ) : (
            <span className="text-sm text-stone-500">
              Podés bloquear el celular al iniciar.
            </span>
          )}
        </div>

        {error && (
          <p className="text-rose-500 text-xs mb-4 font-bold bg-rose-50 p-2 rounded-lg">
            {error}
          </p>
        )}

        {!transmitiendo ? (
          <button
            onClick={iniciarViaje}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-200"
          >
            <FaLocationArrow /> Iniciar Viaje
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 py-2 px-3 rounded-lg">
              <FaLightbulb size={12} /> Rastreo en segundo plano activo.
            </div>
            <button
              onClick={detenerViaje}
              className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-200"
            >
              <FaStopCircle /> Finalizar Viaje
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
