import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import io from "socket.io-client";
import { API_BASE_URL } from "../utils";

// Solución para importar imágenes en Vite
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Arreglo para el ícono por defecto de Leaflet en React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});

const socketURL = API_BASE_URL.replace("/api", "");
const socket = io(socketURL, {
  transports: ["websocket"],
  secure: true,
});

// --- CONFIGURACIÓN DEL ÍCONO DEL CAMIÓN ---
const camionIcon = new L.Icon({
  iconUrl: "../camion.png", // Apunta a la imagen en tu carpeta public
  iconSize: [72, 72], // Tamaño en píxeles (ajustalo si se ve muy grande/chico)
  iconAnchor: [36, 36], // El punto de la imagen que toca la coordenada exacta (la mitad)
  popupAnchor: [0, -20], // Donde aparece el cartelito con el nombre
});

export default function MapaRastreo() {
  const [flota, setFlota] = useState({});

  useEffect(() => {
    // Al recibir ubicación, actualizamos o agregamos al repartidor en el estado
    socket.on("recibirUbicacion", (data) => {
      setFlota((prev) => ({
        ...prev,
        [data.idSocket]: data,
      }));
    });

    // Si se desconecta, lo borramos del mapa
    socket.on("repartidorDesconectado", (idSocket) => {
      setFlota((prev) => {
        const nuevaFlota = { ...prev };
        delete nuevaFlota[idSocket];
        return nuevaFlota;
      });
    });

    return () => {
      socket.off("recibirUbicacion");
      socket.off("repartidorDesconectado");
    };
  }, []);

  // Convertimos el objeto en un array para mapearlo en Leaflet
  const marcadores = Object.values(flota);

  // Coordenadas por defecto (Centro de Buenos Aires, cambialo por la fábrica)
  const defaultCenter = [-34.6037, -58.3816];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full relative z-0">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-stone-200">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          Rastreo Satelital Activo ({marcadores.length} vehículos)
        </h2>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ height: "100%", width: "100%", zIndex: 10 }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">Carto</a>'
        />

        {marcadores.map((rep, idx) => (
          <React.Fragment key={idx}>
            {/* El camión siempre se dibuja */}
            <Marker position={[rep.lat, rep.lng]} icon={camionIcon}>
              <Popup>
                <div className="text-center">
                  <p className="font-bold text-slate-800">{rep.nombre}</p>
                  <p className="text-xs text-stone-500">
                    Velocidad:{" "}
                    {rep.velocidad ? Math.round(rep.velocidad * 3.6) : 0} km/h
                  </p>
                  <p className="text-[10px] text-stone-400 mt-1">
                    Precisión: ±{Math.round(rep.precision || 0)}m
                  </p>
                </div>
              </Popup>
            </Marker>

            {/* Si el error es mayor a 50 metros, dibujamos un círculo de advertencia */}
            {rep.precision > 50 && (
              <Circle
                center={[rep.lat, rep.lng]}
                radius={rep.precision} // El tamaño del círculo es exactamente el error en metros
                pathOptions={{
                  color: "#ef4444", // Borde rojo
                  fillColor: "#ef4444", // Relleno rojo
                  fillOpacity: 0.15, // Bien transparente para no tapar las calles
                }}
              />
            )}
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
