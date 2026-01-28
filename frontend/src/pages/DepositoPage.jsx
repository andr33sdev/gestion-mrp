import React, { useState, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  Text,
  Grid,
  Environment,
  ContactShadows,
  Float,
} from "@react-three/drei";
import {
  FaWarehouse,
  FaInfoCircle,
  FaCog,
  FaTimes,
  FaSearch,
  FaMapMarkerAlt,
  FaPlus,
  FaTrash,
  FaBox,
  FaCubes,
} from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../utils";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";

// --- CONSTANTES DE DIMENSIONES ---
const ANCHO_PALLET = 1.2;
const LARGO_PALLET = 1.2;
const GAP = 0.3; // Espacio de aire
const ANCHO_PASILLO = 3.5; // Pasillo central generoso

// Cálculo de posición en la grilla
const getPosition = (fila, lado) => {
  // Z = Filas (Hacia el fondo)
  const z = fila * (LARGO_PALLET + GAP);

  // X = Lados
  let x = 0;
  // Offset desde el centro del pasillo
  const distCentro = ANCHO_PASILLO / 2 + ANCHO_PALLET / 2;
  const pasoLateral = ANCHO_PALLET + GAP;

  switch (Number(lado)) {
    case 0:
      x = -(distCentro + pasoLateral);
      break; // Lado 1 (Fondo)
    case 1:
      x = -distCentro;
      break; // Lado 1 (Pasillo)
    case 2:
      x = distCentro;
      break; // Lado 2 (Pasillo)
    case 3:
      x = distCentro + pasoLateral;
      break; // Lado 2 (Fondo)
    default:
      x = 0;
  }
  return [x, 0, z];
};

// --- COMPONENTE: PALLET REALISTA (PRO) ---
function RealisticPallet({ data, onClick, isSelected }) {
  const [hovered, setHover] = useState(false);
  const position = useMemo(
    () => getPosition(data.fila, data.lado),
    [data.fila, data.lado],
  );
  const groupRef = useRef();

  // Animación suave al aparecer/moverse
  useFrame((state, delta) => {
    if (groupRef.current) {
      const targetY = isSelected ? 0.2 : 0; // Levantar si está seleccionado
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        position[0],
        delta * 5,
      );
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        position[2],
        delta * 5,
      );
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        targetY,
        delta * 5,
      );
    }
  });

  const alturaCarga = Math.max(0.3, data.cantidad / 1000);
  const colorMaterial = data.color_hex || "#ccc";

  return (
    <group ref={groupRef} position={position}>
      {/* CORRECCIÓN: Solo mostramos el cartel si está en Hover (quitamos "|| isSelected") */}
      {hovered && (
        <Html
          position={[0, alturaCarga + 0.8, 0]}
          center
          zIndexRange={[100, 0]}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900/90 backdrop-blur-md border border-indigo-500/50 p-3 rounded-lg shadow-[0_0_20px_rgba(99,102,241,0.4)] text-center min-w-[120px] pointer-events-none select-none"
          >
            <h4 className="text-indigo-300 font-bold text-[10px] uppercase tracking-wider mb-1">
              {data.nombre}
            </h4>
            <div className="bg-black/40 rounded px-2 py-1 mb-1">
              <span className="text-white font-mono text-sm font-bold">
                {data.cantidad}
              </span>
              <span className="text-gray-500 text-[10px] ml-1">kg</span>
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 border-t border-white/10 pt-1 mt-1">
              <span>Fila: {data.fila}</span>
              <span>Pos: {data.lado}</span>
            </div>
          </motion.div>
        </Html>
      )}

      <group
        onClick={(e) => {
          e.stopPropagation();
          onClick(data);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        {/* CARGA (Bolsas) con Efecto Plástico */}
        <mesh
          position={[0, 0.15 + alturaCarga / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[ANCHO_PALLET * 0.95, alturaCarga, LARGO_PALLET * 0.95]}
          />
          <meshPhysicalMaterial
            color={hovered ? "#ffffff" : colorMaterial} // Brilla al hover
            emissive={hovered ? colorMaterial : "#000"}
            emissiveIntensity={0.2}
            roughness={0.2} // Liso como plástico
            metalness={0.1}
            clearcoat={1} // Capa de brillo extra (film stretch)
            clearcoatRoughness={0.1}
            transparent
            opacity={0.95}
          />
        </mesh>

        {/* BASE DE MADERA (Geometría compuesta simple) */}
        <group position={[0, 0.08, 0]}>
          {/* Tabla superior */}
          <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
            <boxGeometry args={[ANCHO_PALLET, 0.04, LARGO_PALLET]} />
            <meshStandardMaterial color="#8d6e63" roughness={0.9} />
          </mesh>
          {/* Tacos (Patas) */}
          {[-0.4, 0, 0.4].map((x) => (
            <mesh key={x} position={[x, 0, 0]} castShadow>
              <boxGeometry args={[0.15, 0.1, LARGO_PALLET]} />
              <meshStandardMaterial color="#5d4037" roughness={1} />
            </mesh>
          ))}
        </group>

        {/* Outline de selección (Anillo en el piso) */}
        {isSelected && (
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 0.7, 32]} />
            <meshBasicMaterial color="#6366f1" opacity={0.8} transparent />
          </mesh>
        )}
      </group>
    </group>
  );
}

// --- MARCADORES DE ÁREA EN EL SUELO ---
function AreaMarkers({ maxFila }) {
  const largoTotal = (maxFila + 2) * (LARGO_PALLET + GAP);
  const anchoBloque = ANCHO_PALLET * 2 + GAP + 0.5; // Un poco más ancho para el borde
  const xOffset = ANCHO_PASILLO / 2 + anchoBloque / 2 - 0.25;
  const zCenter = largoTotal / 2 - 1;

  return (
    <group position={[0, 0.02, zCenter]}>
      {/* Área LADO 1 (Izquierda) */}
      <group position={[-xOffset, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[anchoBloque, largoTotal]} />
          <meshBasicMaterial color="#3b82f6" opacity={0.05} transparent />
        </mesh>
        {/* Borde */}
        <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
          <edgesGeometry
            args={[new THREE.PlaneGeometry(anchoBloque, largoTotal)]}
          />
          <lineBasicMaterial color="#3b82f6" opacity={0.3} transparent />
        </lineSegments>
        <Text
          position={[0, 0.1, -largoTotal / 2 - 1]}
          fontSize={0.8}
          color="#3b82f6"
        >
          LADO 1
        </Text>
      </group>

      {/* Área LADO 2 (Derecha) */}
      <group position={[xOffset, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[anchoBloque, largoTotal]} />
          <meshBasicMaterial color="#10b981" opacity={0.05} transparent />
        </mesh>
        {/* Borde */}
        <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
          <edgesGeometry
            args={[new THREE.PlaneGeometry(anchoBloque, largoTotal)]}
          />
          <lineBasicMaterial color="#10b981" opacity={0.3} transparent />
        </lineSegments>
        <Text
          position={[0, 0.1, -largoTotal / 2 - 1]}
          fontSize={0.8}
          color="#10b981"
        >
          LADO 2
        </Text>
      </group>

      {/* Pasillo Central */}
      <Text
        position={[0, 0.1, 0]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        fontSize={0.6}
        color="#64748b"
        fillOpacity={0.4}
      >
        PASILLO CENTRAL
      </Text>
    </group>
  );
}

// --- GESTOR DE PALLETS (PANEL DERECHO) ---
function PalletManager({ mp, pallets, onAdd, onDelete, onUpdateColor }) {
  const stockTotal = Number(mp.stock_actual);
  const stockUbicado = pallets.reduce((acc, p) => acc + Number(p.cantidad), 0);
  const stockSuelto = stockTotal - stockUbicado;

  const [newQty, setNewQty] = useState("");
  const [newFila, setNewFila] = useState(0);
  const [newLado, setNewLado] = useState(0);

  const handleAdd = () => {
    if (!newQty || Number(newQty) <= 0) return;
    onAdd(mp.id, Number(newQty), Number(newFila), Number(newLado));
    setNewQty("");
  };

  return (
    <div className="mt-4 border-t border-slate-700 pt-4 animate-in slide-in-from-right">
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-md">
        <h4 className="font-bold text-white text-base mb-3 flex items-center gap-2">
          <FaBox className="text-blue-400" /> {mp.nombre}
        </h4>

        {/* Barra de Distribución */}
        <div className="relative h-6 w-full bg-slate-950 rounded-full overflow-hidden flex text-[10px] font-bold uppercase tracking-wider mb-2 border border-slate-700">
          <div
            style={{
              width: `${Math.min(100, (stockUbicado / stockTotal) * 100)}%`,
            }}
            className="bg-blue-600 flex items-center justify-center text-white transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.5)_inset]"
          >
            {stockUbicado > 0 && "IGLÚ"}
          </div>
          <div
            style={{
              width: `${Math.min(100, (stockSuelto / stockTotal) * 100)}%`,
            }}
            className="bg-slate-700/50 text-gray-400 flex items-center justify-center transition-all duration-500"
          >
            {stockSuelto > 0 && "SUELTO"}
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 font-mono">
          <span>
            Ubicado: <strong className="text-blue-400">{stockUbicado}</strong>
          </span>
          <span>
            Total: <strong className="text-white">{stockTotal}</strong>
          </span>
        </div>

        {/* Selector de Color */}
        <div className="mt-4 flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
          <label className="text-xs text-gray-400 uppercase font-bold">
            Identificador:
          </label>
          <input
            type="color"
            className="w-8 h-8 bg-transparent border-0 cursor-pointer rounded-full overflow-hidden"
            value={mp.color_hex || "#3b82f6"}
            onChange={(e) => onUpdateColor(mp, e.target.value)}
          />
        </div>
      </div>

      {/* Form Nuevo Pallet */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-blue-500/20 border-dashed my-4">
        <p className="text-xs text-blue-400 font-bold mb-3 flex items-center gap-2 uppercase tracking-wide">
          <FaPlus /> Ingresar Pallet Físico
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="col-span-2">
            <input
              type="number"
              placeholder="Cantidad (Kg)"
              className="w-full bg-slate-950 text-white text-sm p-2 rounded border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">
              Fila
            </label>
            <input
              type="number"
              className="w-full bg-slate-950 text-white text-sm p-2 rounded border border-slate-700 text-center"
              value={newFila}
              onChange={(e) => setNewFila(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">
              Ubicación
            </label>
            <select
              className="w-full bg-slate-950 text-white text-[10px] p-2 rounded border border-slate-700 outline-none"
              value={newLado}
              onChange={(e) => setNewLado(e.target.value)}
            >
              <option value="0">L1 - Fondo</option>
              <option value="1">L1 - Pasillo</option>
              <option disabled>──────</option>
              <option value="2">L2 - Pasillo</option>
              <option value="3">L2 - Fondo</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-3 rounded-lg transition-all shadow-lg shadow-blue-900/20 active:scale-95"
        >
          UBICAR EN 3D
        </button>
      </div>

      {/* Lista de Pallets */}
      <h5 className="text-xs font-bold text-gray-500 uppercase mb-2 pl-1">
        Pallets en Iglú ({pallets.length})
      </h5>
      <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
        {pallets.map((p) => (
          <div
            key={p.id}
            className="bg-slate-800 p-3 rounded-lg flex justify-between items-center border border-slate-700 hover:border-slate-500 transition-colors group"
          >
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm flex items-center gap-2">
                <FaCubes className="text-slate-600 text-xs" /> {p.cantidad} Kg
              </span>
              <span className="text-gray-500 text-[10px] mt-0.5">
                Fila {p.fila} •{" "}
                {["L1 Fondo", "L1 Frente", "L2 Frente", "L2 Fondo"][p.lado]}
              </span>
            </div>
            <button
              onClick={() => onDelete(p.id)}
              className="text-slate-600 hover:text-red-400 p-2 rounded hover:bg-slate-700 transition-colors"
            >
              <FaTrash />
            </button>
          </div>
        ))}
        {pallets.length === 0 && (
          <div className="text-center py-6 border-2 border-dashed border-slate-800 rounded-lg">
            <p className="text-gray-600 text-xs italic">
              No hay pallets ubicados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function DepositoPage() {
  const [materiales, setMateriales] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedMpId, setSelectedMpId] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedPalletId, setSelectedPalletId] = useState(null); // Para resaltar en 3D

  const cargarDatos = async () => {
    try {
      const [resMat, resPal] = await Promise.all([
        authFetch(`${API_BASE_URL}/ingenieria/materias-primas`),
        authFetch(`${API_BASE_URL}/ingenieria/deposito/pallets`),
      ]);
      if (resMat.ok) setMateriales(await resMat.json());
      if (resPal.ok) setPallets(await resPal.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleAddPallet = async (mpId, cant, f, l) => {
    try {
      await authFetch(`${API_BASE_URL}/ingenieria/deposito/pallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materia_prima_id: mpId,
          cantidad: cant,
          fila: f,
          lado: l,
        }),
      });
      cargarDatos();
    } catch (e) {
      alert("Error");
    }
  };

  const handleDeletePallet = async (id) => {
    if (!confirm("¿Quitar pallet del sistema?")) return;
    try {
      await authFetch(`${API_BASE_URL}/ingenieria/deposito/pallets/${id}`, {
        method: "DELETE",
      });
      cargarDatos();
    } catch (e) {
      alert("Error");
    }
  };

  const handleUpdateColor = async (mp, color) => {
    setPallets((prev) =>
      prev.map((p) =>
        p.materia_prima_id === mp.id ? { ...p, color_hex: color } : p,
      ),
    );
    setMateriales((prev) =>
      prev.map((m) => (m.id === mp.id ? { ...m, color_hex: color } : m)),
    );
    try {
      await authFetch(
        `${API_BASE_URL}/ingenieria/materias-primas/${mp.id}/iglu`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...mp, color_hex: color }),
        },
      );
    } catch (e) {}
  };

  const handle3DClick = (data) => {
    setSelectedMpId(data.materia_prima_id);
    setSelectedPalletId(data.id);
    setShowConfig(true);
  };

  const maxFila =
    pallets.length > 0 ? Math.max(...pallets.map((p) => p.fila)) : 10;
  const filteredMaterials = materiales.filter((m) =>
    m.nombre.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedMp = materiales.find((m) => m.id === selectedMpId);
  const selectedMpPallets = pallets.filter(
    (p) => p.materia_prima_id === selectedMpId,
  );

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] animate-in fade-in relative bg-slate-950 overflow-hidden">
      {/* HEADER FLOTANTE ESTILIZADO */}
      <div className="absolute top-4 left-6 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-xl p-5 rounded-2xl border border-slate-700/50 shadow-2xl pointer-events-auto min-w-[280px]">
          <h1 className="text-xl font-extrabold text-white flex items-center gap-3">
            <FaWarehouse className="text-indigo-500 text-2xl" /> IGLÚ DIGITAL
          </h1>
          <div className="h-px bg-slate-700 my-3"></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                Ocupación
              </p>
              <p className="text-2xl font-mono text-white">{pallets.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                Materiales
              </p>
              <p className="text-2xl font-mono text-blue-400">
                {materiales.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-6 z-10">
        <button
          onClick={() => setShowConfig(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-900/40 flex items-center gap-2 transition-all active:scale-95 pointer-events-auto border border-indigo-400/20"
        >
          <FaCog /> Administrar Stock
        </button>
      </div>

      {/* ESCENA 3D MEJORADA */}
      <div className="flex-1 w-full h-full cursor-move">
        <Canvas
          camera={{ position: [8, 12, 18], fov: 50 }}
          shadows
          dpr={[1, 2]}
        >
          <color attach="background" args={["#0b0f19"]} />
          <fog attach="fog" args={["#0b0f19", 15, 60]} />

          <Environment preset="city" />

          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 20, 5]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />

          <OrbitControls
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2.1}
            target={[0, 0, maxFila / 2]}
            dampingFactor={0.05}
          />

          <AreaMarkers maxFila={maxFila} />

          {/* PALLETS REALES */}
          <group>
            {pallets.map((p) => (
              <RealisticPallet
                key={p.id}
                data={p}
                isSelected={selectedPalletId === p.id}
                onClick={handle3DClick}
              />
            ))}
          </group>

          {/* SUELO Y GRILLA */}
          <ContactShadows
            position={[0, -0.01, 0]}
            opacity={0.6}
            scale={60}
            blur={2}
            far={2}
            color="#000"
          />
          <Grid
            position={[0, -0.01, 0]}
            args={[60, 60]}
            cellColor="#1e293b"
            sectionColor="#334155"
            fadeDistance={35}
            sectionThickness={1}
            cellThickness={0.5}
            infiniteGrid
          />
        </Canvas>
      </div>

      {/* PANEL LATERAL */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute top-0 right-0 h-full w-[400px] bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl"
          >
            <div className="p-5 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <FaBox className="text-indigo-500" /> Inventario
              </h3>
              <button
                onClick={() => setShowConfig(false)}
                className="text-gray-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-full"
              >
                <FaTimes />
              </button>
            </div>

            {!selectedMp ? (
              <>
                <div className="p-4 bg-slate-900 border-b border-slate-800">
                  <div className="relative group">
                    <FaSearch className="absolute left-4 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                    <input
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all shadow-inner placeholder-gray-600"
                      placeholder="Buscar Materia Prima..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {filteredMaterials.map((m) => {
                    const ubicados = pallets.filter(
                      (p) => p.materia_prima_id === m.id,
                    ).length;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMpId(m.id)}
                        className="p-4 rounded-xl bg-slate-800 border border-slate-700/50 hover:border-indigo-500 hover:bg-slate-800/80 cursor-pointer transition-all group shadow-sm hover:shadow-md"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-200 text-sm group-hover:text-white transition-colors">
                            {m.nombre}
                          </span>
                          {ubicados > 0 && (
                            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                              {ubicados} pallets
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[10px] text-gray-500 font-mono bg-slate-950 px-1.5 py-0.5 rounded">
                            {m.codigo}
                          </span>
                          <span className="text-xs text-gray-400 font-bold">
                            {m.stock_actual} Kg
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 bg-slate-900 custom-scrollbar flex flex-col">
                <button
                  onClick={() => {
                    setSelectedMpId(null);
                    setSelectedPalletId(null);
                  }}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 mb-4 flex items-center gap-1 self-start uppercase tracking-wider"
                >
                  <FaTimes /> Volver al listado
                </button>
                <PalletManager
                  mp={selectedMp}
                  pallets={selectedMpPallets}
                  onAdd={handleAddPallet}
                  onDelete={handleDeletePallet}
                  onUpdateColor={handleUpdateColor}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
