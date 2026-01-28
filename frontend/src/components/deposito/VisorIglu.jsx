import React, { useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";

// Componente para un Pallet individual
function Pallet({ position, color, cantidad, material, onClick }) {
  const [hovered, setHover] = useState(false);

  // Altura basada en la cantidad (ej: 1 unidad de altura por cada 1000kg)
  const alturaCarga = Math.max(0.2, cantidad / 1000);

  return (
    <group position={position}>
      {/* Etiqueta flotante al hacer hover */}
      {hovered && (
        <Html position={[0, alturaCarga + 0.5, 0]} center>
          <div className="bg-slate-900 text-white text-xs p-2 rounded border border-slate-500 w-32 text-center pointer-events-none">
            <strong>{material}</strong>
            <br />
            {cantidad} Kg
          </div>
        </Html>
      )}

      {/* La Carga (Bolsas) */}
      <mesh
        position={[0, 0.1 + alturaCarga / 2, 0]} // Ajuste para que quede sobre el pallet
        onClick={(e) => {
          e.stopPropagation();
          onClick(material);
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[0.9, alturaCarga, 0.9]} />
        <meshStandardMaterial color={hovered ? "hotpink" : color} />
      </mesh>

      {/* La base de madera (Pallet) */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1, 0.2, 1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    </group>
  );
}

// Escenario del Depósito
export default function VisorIglu({ datosStock }) {
  // Datos simulados si no vienen de props (luego esto viene de tu DB)
  const pallets = datosStock || [
    {
      id: 1,
      fila: 0,
      lado: 0,
      material: "POLIETILENO AZUL",
      color: "#0000FF",
      cantidad: 1500,
    },
    {
      id: 2,
      fila: 0,
      lado: 1,
      material: "POLIETILENO ROJO",
      color: "#FF0000",
      cantidad: 500,
    },
    {
      id: 3,
      fila: 1,
      lado: 0,
      material: "VIRGEN NATURAL",
      color: "#F5F5DC",
      cantidad: 2000,
    },
    {
      id: 4,
      fila: 2,
      lado: 1,
      material: "MASTERBATCH NEGRO",
      color: "#111111",
      cantidad: 100,
    },
  ];

  // Configuración de la grilla (Espaciado entre pallets)
  const ESPACIO = 1.5;

  return (
    <div className="h-[500px] w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        {/* Luces */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />

        {/* Controles de cámara (Orbitar) */}
        <OrbitControls minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />

        {/* Suelo del Iglú */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#334155" />
        </mesh>

        {/* Renderizado de Pallets */}
        {pallets.map((p) => (
          <Pallet
            key={p.id}
            // Mapeamos Fila/Lado a coordenadas X/Z
            position={[p.fila * ESPACIO, 0, p.lado * ESPACIO]}
            color={p.color}
            cantidad={p.cantidad}
            material={p.material}
            onClick={(mat) => alert(`Abrir detalle de: ${mat}`)}
          />
        ))}

        {/* Texto 3D para identificar filas (Opcional) */}
        <Text
          position={[-2, 0.1, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.5}
          color="white"
        >
          Entrada
        </Text>
      </Canvas>
    </div>
  );
}
