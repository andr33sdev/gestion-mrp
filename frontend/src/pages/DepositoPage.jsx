import React, { useState, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  Text,
  Grid,
  Environment,
  ContactShadows,
} from "@react-three/drei";
import {
  FaWarehouse,
  FaCog,
  FaTimes,
  FaSearch,
  FaPlus,
  FaTrash,
  FaBox,
  FaArrowLeft,
  FaExclamationTriangle,
  FaBan,
} from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../utils";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";

// --- CONSTANTES DE INGENIERÍA ---
const ANCHO_PALLET = 1.2; // Eje X (Profundidad)
const LARGO_PALLET = 1.0; // Eje Z (Fila)
const GAP = 0.15; // Aire entre pallets
const ANCHO_PASILLO = 4.0; // Pasillo central generoso

// CAPACIDADES (FIJAS)
const ROWS_LADO_1 = 8; // Izquierda (0 a 7)
const ROWS_LADO_2 = 6; // Derecha (0 a 5) -> Pigmentos en 6 y 7
const DEPTH_PER_SIDE = 2; // "Uno delante del otro"

// --- LÓGICA DE POSICIONAMIENTO EXACTO ---
const getPosition = (fila, lado, profundidad) => {
  // Eje Z: Fila (0 es la más cercana a la entrada/cámara)
  const z = fila * (LARGO_PALLET + GAP);

  let x = 0;
  // Offset del pasillo (desde el centro 0)
  const startX = ANCHO_PASILLO / 2 + ANCHO_PALLET / 2;
  const pasoX = ANCHO_PALLET + GAP;

  if (lado === 1) {
    // LADO 1 (Izquierda): X negativo
    x = -(startX + profundidad * pasoX);
  } else {
    // LADO 2 (Derecha): X positivo
    x = startX + profundidad * pasoX;
  }

  return [x, 0, z];
};

// --- COMPONENTE: CUARTO DE PIGMENTOS (MARKING PLANO) ---
function PigmentRoomMarking() {
  // Ubicación: LADO 2 (Derecha), en el espacio "sobrante" (Filas 6 y 7)
  const filaInicio = 6;
  const prof = 0.5; // Centro de las 2 profundidades (columnas 0 y 1)
  const lado = 2; // Lado Derecha

  // Posición central del cuarto
  const pos = getPosition(filaInicio + 0.5, lado, prof);

  // Tamaño: 2 Filas de largo x 2 Pallets de ancho
  const largo = (LARGO_PALLET + GAP) * 2;
  const ancho = (ANCHO_PALLET + GAP) * 2;

  return (
    <group position={[pos[0], 0.005, pos[2]]}>
      {/* Área Prohibida (Hatched) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ancho, largo]} />
        <meshBasicMaterial color="#334155" opacity={0.8} transparent />
      </mesh>

      {/* Borde Amarillo Advertencia */}
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(ancho, largo)]} />
        <lineBasicMaterial color="#facc15" linewidth={2} />
      </lineSegments>

      {/* Texto en el suelo */}
      <Text
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]} // Rotado para leerse desde el pasillo
        fontSize={0.4}
        color="#facc15"
        anchorX="center"
        anchorY="middle"
      >
        PIGMENTOS
      </Text>

      {/* Icono/Texto de Prohibido */}
      <Text
        position={[0, 0.01, 0.5]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        fontSize={0.2}
        color="#ef4444"
      >
        (NO ESTIBAR)
      </Text>
    </group>
  );
}

// --- PALLET REALISTA ---
function RealisticPallet({ data, onClick, isSelected }) {
  const [hovered, setHover] = useState(false);
  const position = useMemo(
    () => getPosition(data.fila, data.lado, data.columna),
    [data.fila, data.lado, data.columna],
  );
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      const targetY = isSelected ? 0.3 : 0;
      groupRef.current.position.lerp(
        new THREE.Vector3(position[0], targetY, position[2]),
        delta * 8,
      );
    }
  });

  const alturaCarga = Math.max(0.3, data.cantidad / 1000);
  const colorMaterial = data.color_hex || "#ccc";

  return (
    <group ref={groupRef} position={position}>
      {hovered && (
        <Html
          position={[0, alturaCarga + 0.5, 0]}
          center
          zIndexRange={[100, 0]}
        >
          <div className="bg-black/80 text-white text-[10px] px-2 py-1 rounded border border-white/20 whitespace-nowrap pointer-events-none select-none">
            <span className="font-bold text-yellow-400">{data.nombre}</span>
            <br />
            {data.cantidad} kg
          </div>
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
        <mesh position={[0, 0.1 + alturaCarga / 2, 0]} castShadow receiveShadow>
          <boxGeometry
            args={[ANCHO_PALLET * 0.95, alturaCarga, LARGO_PALLET * 0.95]}
          />
          <meshStandardMaterial
            color={hovered ? "#fff" : colorMaterial}
            emissive={hovered ? "#444" : "#000"}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[ANCHO_PALLET, 0.1, LARGO_PALLET]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
        {isSelected && (
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.6, 32]} />
            <meshBasicMaterial color="#6366f1" opacity={0.8} transparent />
          </mesh>
        )}
      </group>
    </group>
  );
}

// --- SUELO (DELIMITACIÓN DE ÁREAS) ---
function AreaMarkers() {
  // El largo total se define por el lado más largo (Lado 1 = 8 filas)
  const maxRows = ROWS_LADO_1;
  const largoTotal = maxRows * (LARGO_PALLET + GAP);

  // Ancho de cada bloque (2 pallets de profundidad)
  const anchoBloque = ANCHO_PALLET * DEPTH_PER_SIDE + GAP;

  // Posiciones X (Centros de los bloques)
  const offsetPasillo = ANCHO_PASILLO / 2;
  const centerL1 = -(offsetPasillo + anchoBloque / 2);
  const centerL2 = offsetPasillo + anchoBloque / 2;

  // El origen Z=0 está en la fila 0. Centramos el plano visual.
  const zCenter = largoTotal / 2 - LARGO_PALLET / 2;

  return (
    <group position={[0, 0.01, zCenter]}>
      {/* LADO 1 (Izquierda) - 8 Filas */}
      <group position={[centerL1, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[anchoBloque, largoTotal]} />
          <meshBasicMaterial color="#3b82f6" opacity={0.05} transparent />
        </mesh>
        <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
          <edgesGeometry
            args={[new THREE.PlaneGeometry(anchoBloque, largoTotal)]}
          />
          <lineBasicMaterial color="#3b82f6" opacity={0.2} transparent />
        </lineSegments>
        <Text
          position={[0, 0.02, -largoTotal / 2 - 0.5]}
          fontSize={0.5}
          color="#3b82f6"
          rotation={[-Math.PI / 2, 0, 0]}
        >
          LADO 1
        </Text>
      </group>

      {/* LADO 2 (Derecha) - 6 Filas (Dibujamos suelo más corto) */}
      {/* Calculamos el largo de 6 filas y lo centramos en su propia posición Z */}
      <group
        position={[
          centerL2,
          0,
          (ROWS_LADO_2 * (LARGO_PALLET + GAP)) / 2 - largoTotal / 2,
        ]}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry
            args={[anchoBloque, ROWS_LADO_2 * (LARGO_PALLET + GAP)]}
          />
          <meshBasicMaterial color="#10b981" opacity={0.05} transparent />
        </mesh>
        <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
          <edgesGeometry
            args={[
              new THREE.PlaneGeometry(
                anchoBloque,
                ROWS_LADO_2 * (LARGO_PALLET + GAP),
              ),
            ]}
          />
          <lineBasicMaterial color="#10b981" opacity={0.2} transparent />
        </lineSegments>
        <Text
          position={[0, 0.02, -(ROWS_LADO_2 * (LARGO_PALLET + GAP)) / 2 - 0.5]}
          fontSize={0.5}
          color="#10b981"
          rotation={[-Math.PI / 2, 0, 0]}
        >
          LADO 2
        </Text>
      </group>

      {/* LEYENDAS EXTREMOS (Relativos al grupo 'zCenter') */}

      {/* Entrada (Z Negativo local) */}
      <Text
        position={[0, 0.01, -largoTotal / 2 - 1.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.6}
        color="#fff"
      >
        ↓ ENTRADA ↓
      </Text>

      {/* Patio (Z Positivo local) */}
      <Text
        position={[0, 0.01, largoTotal / 2 + 1.5]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={0.6}
        color="#94a3b8"
      >
        ↑ PATIO ↑
      </Text>
    </group>
  );
}

// --- PANEL DE GESTIÓN ---
function PalletManager({
  mp,
  pallets,
  allPallets,
  onAdd,
  onDelete,
  onUpdateColor,
}) {
  const stockTotal = Number(mp.stock_actual);
  const stockUbicado = pallets.reduce((acc, p) => acc + Number(p.cantidad), 0);
  const stockSuelto = stockTotal - stockUbicado;

  const [newQty, setNewQty] = useState("");
  const [newFila, setNewFila] = useState("0");
  const [newLado, setNewLado] = useState("1");
  const [newProf, setNewProf] = useState("0");
  const [errorMsg, setErrorMsg] = useState("");

  const handleAdd = () => {
    setErrorMsg("");
    if (!newQty || Number(newQty) <= 0)
      return setErrorMsg("Ingresa una cantidad válida.");

    const f = Number(newFila);
    const l = Number(newLado);
    const p = Number(newProf);

    // 1. Validar Límites de Filas
    if (l === 1 && f >= ROWS_LADO_1)
      return setErrorMsg(`Lado 1: solo filas 0 a ${ROWS_LADO_1 - 1}.`);
    if (l === 2 && f >= ROWS_LADO_2)
      return setErrorMsg(`Lado 2: solo filas 0 a ${ROWS_LADO_2 - 1}.`);

    // 2. Validar Cuarto de Pigmentos (Ya está visualmente ocupado)
    // El cuarto está en Lado 2, filas 6 y 7.
    // Como el select de filas solo deja elegir hasta el límite de la constante,
    // y ROWS_LADO_2 = 6 (filas 0-5), el usuario NO podrá elegir fila 6 o 7 para el lado 2
    // desde el selector estándar. La lógica visual del cuarto es "extra" a la capacidad.

    // 3. Validar Ocupación (Colisión)
    const ocupado = allPallets.find(
      (pal) =>
        Number(pal.lado) === l &&
        Number(pal.fila) === f &&
        Number(pal.columna) === p,
    );

    if (ocupado) return setErrorMsg(`Lugar ocupado por: ${ocupado.nombre}`);

    onAdd(mp.id, Number(newQty), f, l, p);
    setNewQty("");
  };

  return (
    <div className="mt-4 border-t border-slate-700 pt-4 animate-in slide-in-from-right">
      <div className="bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-bold text-white text-base truncate pr-2">
            {mp.nombre}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase">Color</span>
            <input
              type="color"
              className="w-5 h-5 bg-transparent border-0 cursor-pointer rounded overflow-hidden p-0"
              value={mp.color_hex || "#3b82f6"}
              onChange={(e) => onUpdateColor(mp, e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 text-xs font-mono">
          <span className="bg-blue-900/40 text-blue-200 px-2 py-1 rounded">
            Ubicado: {stockUbicado}
          </span>
          <span className="bg-slate-700/40 text-gray-300 px-2 py-1 rounded">
            Suelto: {stockSuelto}
          </span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-xl border border-indigo-500/20 shadow-lg mb-6">
        <p className="text-xs text-indigo-400 font-bold mb-3 uppercase flex items-center gap-2">
          <FaPlus /> Nuevo Ingreso
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
              CANTIDAD (KG)
            </label>
            <input
              type="number"
              className="w-full bg-slate-950 text-white text-sm p-2 rounded-lg border border-slate-700 focus:border-indigo-500 outline-none"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="Ej: 500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                LADO
              </label>
              <select
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs outline-none"
                value={newLado}
                onChange={(e) => {
                  setNewLado(Number(e.target.value));
                  setNewFila(0);
                }}
              >
                <option value="1">Lado 1 (8 filas)</option>
                <option value="2">Lado 2 (6 filas)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                FILA
              </label>
              <select
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs outline-none"
                value={newFila}
                onChange={(e) => setNewFila(e.target.value)}
              >
                {Array.from({
                  length: Number(newLado) === 1 ? ROWS_LADO_1 : ROWS_LADO_2,
                }).map((_, i) => (
                  <option key={i} value={i}>
                    Fila {i}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
              POSICIÓN
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setNewProf("0")}
                className={`flex-1 py-2 rounded text-xs border ${newProf === "0" ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-950 text-gray-400 border-slate-700"}`}
              >
                Frente (Pasillo)
              </button>
              <button
                onClick={() => setNewProf("1")}
                className={`flex-1 py-2 rounded text-xs border ${newProf === "1" ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-950 text-gray-400 border-slate-700"}`}
              >
                Fondo (Pared)
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-900/20 border border-red-500/30 text-red-300 p-2 rounded text-xs flex items-center gap-2">
              <FaExclamationTriangle /> {errorMsg}
            </div>
          )}

          <button
            onClick={handleAdd}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg text-sm transition-transform active:scale-95 shadow-lg"
          >
            UBICAR
          </button>
        </div>
      </div>

      <h5 className="text-xs font-bold text-gray-500 uppercase mb-3 pl-1">
        Pallets Ubicados ({pallets.length})
      </h5>

      <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
        {pallets.map((p) => (
          <div
            key={p.id}
            className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-slate-700 text-xs"
          >
            <div>
              <span className="font-bold text-white block">
                {p.cantidad} Kg
              </span>
              <span className="text-gray-500">
                L{p.lado} • F{p.fila} • {p.columna === 0 ? "Frente" : "Fondo"}
              </span>
            </div>
            <button
              onClick={() => onDelete(p.id)}
              className="text-slate-500 hover:text-red-400 p-2"
            >
              <FaTrash />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function DepositoPage() {
  const [materiales, setMateriales] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedMpId, setSelectedMpId] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedPalletId, setSelectedPalletId] = useState(null);

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

  const handleAddPallet = async (mpId, cant, f, l, p) => {
    try {
      const res = await authFetch(
        `${API_BASE_URL}/ingenieria/deposito/pallets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materia_prima_id: mpId,
            cantidad: cant,
            fila: f,
            lado: l,
            columna: p,
          }),
        },
      );
      if (res.ok) cargarDatos();
      else {
        const err = await res.json();
        alert(err.msg || "Error");
      }
    } catch (e) {
      alert("Error al guardar");
    }
  };

  const handleDeletePallet = async (id) => {
    if (!confirm("¿Retirar pallet?")) return;
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

  const filteredMaterials = materiales.filter((m) =>
    m.nombre.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedMp = materiales.find((m) => m.id === selectedMpId);
  const selectedMpPallets = pallets.filter(
    (p) => p.materia_prima_id === selectedMpId,
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] animate-in fade-in relative bg-slate-950 overflow-hidden">
      {/* HEADER FLOTANTE */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-xl p-3 md:p-4 rounded-xl border border-slate-700/50 shadow-2xl pointer-events-auto">
          <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
            <FaWarehouse className="text-indigo-500" /> IGLÚ DIGITAL
          </h1>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">
            {pallets.length} Pallets • {materiales.length} SKUs
          </p>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setShowConfig(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 md:px-5 md:py-2.5 rounded-full md:rounded-xl font-bold shadow-lg flex items-center gap-2 pointer-events-auto transition-transform active:scale-95"
        >
          <FaCog /> <span className="hidden md:inline">Gestionar</span>
        </button>
      </div>

      {/* VISOR 3D */}
      <div className="flex-1 w-full h-full cursor-move bg-gradient-to-b from-[#0f172a] to-[#020617]">
        <Canvas
          camera={{ position: [0, 18, 15], fov: 50 }}
          shadows
          dpr={[1, 2]}
        >
          <Environment preset="city" />
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 30, 10]}
            intensity={1.2}
            castShadow
          />

          <OrbitControls
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2.1}
            target={[0, 0, 4]}
            dampingFactor={0.05}
          />

          <AreaMarkers />
          <PigmentRoomMarking />

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
            infiniteGrid
          />
        </Canvas>
      </div>

      {/* DRAWER RESPONSIVE */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28 }}
            className="absolute top-0 right-0 h-full w-full md:w-[400px] bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl"
          >
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center shrink-0">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <FaBox className="text-indigo-500" /> Inventario
              </h3>
              <button
                onClick={() => setShowConfig(false)}
                className="text-gray-400 hover:text-white p-2"
              >
                <FaTimes />
              </button>
            </div>

            {!selectedMp ? (
              <>
                <div className="p-4 bg-slate-900 border-b border-slate-800">
                  <div className="relative group">
                    <FaSearch className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                    <input
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white focus:border-indigo-500 outline-none"
                      placeholder="Buscar..."
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
                        className="p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-indigo-500 cursor-pointer transition-all flex justify-between items-center group"
                      >
                        <div>
                          <p className="font-bold text-gray-200 text-sm group-hover:text-white">
                            {m.nombre}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {m.codigo}
                          </p>
                        </div>
                        {ubicados > 0 && (
                          <span className="bg-indigo-900 text-indigo-200 text-[10px] px-2 py-1 rounded font-bold">
                            {ubicados}
                          </span>
                        )}
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
                  className="text-xs font-bold text-indigo-400 mb-4 flex items-center gap-2"
                >
                  <FaArrowLeft /> VOLVER
                </button>
                <PalletManager
                  mp={selectedMp}
                  pallets={selectedMpPallets}
                  allPallets={pallets}
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
