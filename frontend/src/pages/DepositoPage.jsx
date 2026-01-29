import React, { useState, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  Text,
  Grid,
  Environment,
  RoundedBox,
} from "@react-three/drei";
import {
  FaWarehouse,
  FaCog,
  FaTimes,
  FaSearch,
  FaList,
  FaCube,
  FaCamera,
  FaQrcode,
  FaTrash,
  FaArrowLeft,
  FaPrint,
  FaBox,
  FaChevronDown,
  FaChevronRight,
  FaTrafficLight,
} from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../utils";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import QRCode from "qrcode";
import { Scanner } from "@yudiel/react-qr-scanner";

// --- CONSTANTES DE INGENIERÍA ---
const ANCHO_PALLET = 1.2;
const LARGO_PALLET = 1.0;
const GAP = 0.15;
const ANCHO_PASILLO = 4.0;
const ROWS_LADO_1 = 8;
const ROWS_LADO_2 = 6;
const DEPTH_PER_SIDE = 2;
const VISUAL_ROWS = 8;

// --- IDs VIRTUALES DE PRODUCTOS ---
const ID_CANALIZADOR = 999998;
const ID_CONOS = 999999;

// Helper para saber unidad
const getUnidad = (id) =>
  id === ID_CANALIZADOR || id === ID_CONOS ? "Un" : "Kg";

// --- POSICIONAMIENTO ---
const getPosition = (fila, lado, profundidad) => {
  const z = fila * (LARGO_PALLET + GAP);

  // LADOS LATERALES
  if (lado === 1 || lado === 2) {
    const startX = ANCHO_PASILLO / 2 + ANCHO_PALLET / 2;
    const pasoX = ANCHO_PALLET + GAP;
    const x =
      lado === 1
        ? -(startX + profundidad * pasoX)
        : startX + profundidad * pasoX;
    return [x, 0, z];
  }

  // PASILLO CENTRAL
  if (lado === 3) return [-0.75, 0, z]; // Pasillo Izq
  if (lado === 4) return [0.75, 0, z]; // Pasillo Der

  return [0, 0, 0];
};

// --- COMPONENTES 3D ---

function IndustrialEnvironment() {
  return <group></group>;
}

// IGLÚ
function IglooStructure() {
  const largoTotal = VISUAL_ROWS * (LARGO_PALLET + GAP) + 3;
  const zCenter = (VISUAL_ROWS * (LARGO_PALLET + GAP)) / 2 - LARGO_PALLET / 2;
  const radio = 5.2;
  const zStep = largoTotal / 8;
  const posLuz = [0, 4.5, 0];
  const tubeRadius = 0.05;

  const curve = useMemo(() => {
    const points = [];
    const segments = 16;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI;
      points.push(
        new THREE.Vector3(-Math.cos(t) * radio, Math.sin(t) * radio, 0),
      );
    }
    return new THREE.CatmullRomCurve3(points);
  }, []);

  return (
    <group position={[0, 0, zCenter]}>
      <pointLight
        position={posLuz}
        intensity={0.8}
        distance={20}
        color="#fff"
      />
      {Array.from({ length: 8 }).map((_, i) => {
        if (i === 0) return null;
        const zRel = i * zStep - largoTotal / 2;
        return (
          <group key={i} position={[0, tubeRadius, zRel]}>
            <mesh>
              <tubeGeometry args={[curve, 12, tubeRadius, 4, false]} />
              <meshStandardMaterial
                color="#cbd5e1"
                metalness={0.5}
                roughness={0.2}
                transparent
                opacity={0.3}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[radio, 0.1, 0]}>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <mesh position={[-radio, 0.1, 0]}>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ENTREPISO
function MezzanineStructure() {
  const pasoZ = LARGO_PALLET + GAP;
  const zStart = 3 * pasoZ + LARGO_PALLET / 2 + GAP / 2;
  const zEnd = 7 * pasoZ + LARGO_PALLET / 2 + GAP / 2;
  const zLength = zEnd - zStart;
  const zCenter = zStart + zLength / 2;
  const alturaTechoBajo = 2.1;
  const anchoTechoLado = ANCHO_PALLET * DEPTH_PER_SIDE + 0.4;
  const xOffsetLado = ANCHO_PASILLO / 2 + anchoTechoLado / 2 - 0.2;
  const columnaWidth = 0.1;
  const columnGaps = [3, 4, 5, 6, 7];

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#94a3b8",
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      }),
    [],
  );

  return (
    <group>
      <mesh
        position={[-xOffsetLado, alturaTechoBajo, zCenter]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={material}
      >
        <planeGeometry args={[anchoTechoLado, zLength]} />
      </mesh>
      <mesh
        position={[xOffsetLado, alturaTechoBajo, zCenter]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={material}
      >
        <planeGeometry args={[anchoTechoLado, zLength]} />
      </mesh>
      {columnGaps.map((gapIndex) => {
        const zCol = gapIndex * pasoZ + LARGO_PALLET / 2 + GAP / 2;
        const xInnerAbs = ANCHO_PASILLO / 2 + 0.15;
        const xOuterAbs = ANCHO_PASILLO / 2 + ANCHO_PALLET * 2 + 0.15;
        return (
          <group
            key={`col-gap-${gapIndex}`}
            position={[0, alturaTechoBajo / 2, zCol]}
          >
            <mesh position={[-xInnerAbs, 0, 0]} material={material}>
              <boxGeometry
                args={[columnaWidth, alturaTechoBajo, columnaWidth]}
              />
            </mesh>
            <mesh position={[-xOuterAbs, 0, 0]} material={material}>
              <boxGeometry
                args={[columnaWidth, alturaTechoBajo, columnaWidth]}
              />
            </mesh>
            <mesh position={[xInnerAbs, 0, 0]} material={material}>
              <boxGeometry
                args={[columnaWidth, alturaTechoBajo, columnaWidth]}
              />
            </mesh>
            <mesh position={[xOuterAbs, 0, 0]} material={material}>
              <boxGeometry
                args={[columnaWidth, alturaTechoBajo, columnaWidth]}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// PIGMENTOS
function PigmentRoomMarking() {
  const filaInicio = 6;
  const lado = 2;
  const profPromedio = 0.5;
  const pos = getPosition(filaInicio + 0.5, lado, profPromedio);
  const largo = (LARGO_PALLET + GAP) * 2;
  const ancho = (ANCHO_PALLET + GAP) * 2;

  return (
    <group position={[pos[0], 0.005, pos[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ancho, largo]} />
        <meshBasicMaterial
          color="#ca8a04"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(ancho, largo)]} />
        <lineBasicMaterial color="#d97706" linewidth={2} />
      </lineSegments>
      <Text
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        fontSize={0.35}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
      >
        PIGMENTOS
      </Text>
    </group>
  );
}

// --- MODELOS DE PRODUCTOS ---

// Cono Vial
function ProductCone() {
  return (
    <group>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.02, 16]} />
        <meshStandardMaterial color="#f97316" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.04, 0.14, 0.75, 16]} />
        <meshStandardMaterial color="#f97316" roughness={0.3} />
      </mesh>
    </group>
  );
}

// Canalizador Vial (Rediseñado: Sin patas, gordito, círculos)
function ProductChannelizer() {
  return (
    <group>
      {/* Cuerpo Principal: Más ancho (0.25) y sin patas, apoyado en el suelo (y=0.325) */}
      <RoundedBox
        args={[0.95, 0.65, 0.25]}
        radius={0.04}
        smoothness={1}
        position={[0, 0.325, 0]}
      >
        <meshStandardMaterial color="#dc2626" />
      </RoundedBox>

      {/* Cinta Reflectiva */}
      <mesh position={[0, 0.5, 0.13]}>
        <planeGeometry args={[0.8, 0.12]} />
        <meshBasicMaterial color="#fff" side={THREE.DoubleSide} />
      </mesh>

      {/* Círculos Centrales (Detalle) */}
      {/* Círculo Izquierdo */}
      <mesh position={[-0.25, 0.28, 0.131]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.07, 16]} />
        <meshStandardMaterial color="#991b1b" side={THREE.DoubleSide} />
      </mesh>

      {/* Círculo Derecho */}
      <mesh position={[0.25, 0.28, 0.131]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.07, 16]} />
        <meshStandardMaterial color="#991b1b" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// 6. PALLET REALISTA
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
      groupRef.current.position.y +=
        (targetY - groupRef.current.position.y) * 0.2;
    }
  });

  const palletVisuals = useMemo(() => {
    const isCono = data.materia_prima_id === ID_CONOS;
    const isCanalizador = data.materia_prima_id === ID_CANALIZADOR;

    if (isCono) {
      const numItems = Math.min(data.cantidad, 280);
      return (
        <group>
          {Array.from({ length: numItems }).map((_, i) => {
            const stackHeight = 14;
            const pileIndex = Math.floor(i / stackHeight);
            const heightIndex = i % stackHeight;
            const row = Math.floor(pileIndex / 5);
            const col = pileIndex % 5;
            const x = (col - 2) * 0.22;
            const y = heightIndex * 0.1;
            const z = (row - 1.5) * 0.22;
            return (
              <group key={i} position={[x, y, z]} scale={0.75}>
                <ProductCone />
              </group>
            );
          })}
        </group>
      );
    } else if (isCanalizador) {
      // Estiba 6x3
      const numItems = Math.min(data.cantidad, 18);
      return (
        <group>
          {Array.from({ length: numItems }).map((_, i) => {
            const piso = Math.floor(i / 6);
            const filaIndex = i % 6;

            // Separación horizontal
            const z = (filaIndex - 2.5) * 0.18;

            // Apilamiento ajustado para que se apoyen (altura 0.65 -> paso 0.60 para encastre visual)
            const y = piso * 0.6;

            return (
              <group key={i} position={[0, y, z]} scale={0.85}>
                <ProductChannelizer />
              </group>
            );
          })}
        </group>
      );
    } else {
      // BOLSAS / PISOS
      const numPisos = Math.max(1, Math.ceil(data.cantidad / 100));
      const mat = new THREE.MeshStandardMaterial({
        color: data.color_hex || "#ccc",
        roughness: 0.9,
        metalness: 0.1,
      });

      return (
        <group>
          {Array.from({ length: numPisos }).map((_, i) => (
            <RoundedBox
              key={i}
              args={[ANCHO_PALLET * 0.95, 0.11, LARGO_PALLET * 0.95]}
              radius={0.04}
              smoothness={1}
              position={[0, 0.12 * i + 0.06, 0]}
            >
              <primitive object={mat} />
            </RoundedBox>
          ))}
          {/* Pallet madera */}
          <RoundedBox
            args={[ANCHO_PALLET, 0.1, LARGO_PALLET]}
            radius={0.02}
            smoothness={1}
            position={[0, -0.06, 0]}
          >
            <meshStandardMaterial color="#8d6e63" />
          </RoundedBox>
        </group>
      );
    }
  }, [data, isSelected]);

  return (
    <group ref={groupRef} position={position}>
      {hovered && (
        <Html position={[0, 2, 0]} center zIndexRange={[100, 0]}>
          <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded border border-slate-500 whitespace-nowrap pointer-events-none select-none z-50 shadow-xl">
            <span className="font-bold text-blue-400 block mb-0.5">
              {data.nombre}
            </span>
            <span className="font-mono text-gray-300">
              {data.cantidad} {getUnidad(data.materia_prima_id)}
            </span>
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
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHover(false);
        }}
      >
        {palletVisuals}
        {isSelected && (
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.7, 0.75, 32]} />
            <meshBasicMaterial color="#6366f1" />
          </mesh>
        )}
      </group>
    </group>
  );
}

// 7. AREA MARKERS
function AreaMarkers() {
  const largoExacto = VISUAL_ROWS * LARGO_PALLET + (VISUAL_ROWS - 1) * GAP;
  const zCenter = largoExacto / 2 - LARGO_PALLET / 2;
  const xLeftLine = -1.1;
  const xRightLine = 1.1;

  return (
    <group position={[0, 0, 0]}>
      <Grid
        cellSize={1.2}
        cellThickness={0.6}
        cellColor="#334155"
        sectionSize={4.8}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={50}
        infiniteGrid={true}
      />

      <group position={[0, 0.01, zCenter]}>
        <mesh position={[xLeftLine, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.1, largoExacto + 2]} />
          <meshBasicMaterial color="#eab308" />
        </mesh>
        <mesh position={[xRightLine, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.1, largoExacto + 2]} />
          <meshBasicMaterial color="#eab308" />
        </mesh>
      </group>

      <group position={[0, 0.015, zCenter]}>
        <line>
          <bufferGeometry
            attach="geometry"
            points={[
              new THREE.Vector3(0, 0, -largoExacto / 2 - 1),
              new THREE.Vector3(0, 0, largoExacto / 2 + 1),
            ]}
          />
          <lineBasicMaterial attach="material" color="#334155" />
        </line>
        <Text
          position={[-0.4, 0, -largoExacto / 2 - 1.5]}
          fontSize={0.25}
          color="#94a3b8"
          rotation={[-Math.PI / 2, 0, 0]}
          anchorX="right"
        >
          L3 (Izq)
        </Text>
        <Text
          position={[0.4, 0, -largoExacto / 2 - 1.5]}
          fontSize={0.25}
          color="#94a3b8"
          rotation={[-Math.PI / 2, 0, 0]}
          anchorX="left"
        >
          L4 (Der)
        </Text>
      </group>

      {Array.from({ length: VISUAL_ROWS }).map((_, i) => {
        const z = i * (LARGO_PALLET + GAP) - zCenter;
        return (
          <group key={i} position={[0, 0.01, z + zCenter]}>
            <Text
              position={[-0.6, 0, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.2}
              color="#64748b"
            >
              {i}
            </Text>
            <Text
              position={[0.6, 0, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.2}
              color="#64748b"
            >
              {i}
            </Text>
            <mesh position={[-0.75, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.05, 16]} />
              <meshBasicMaterial color="#1e293b" />
            </mesh>
            <mesh position={[0.75, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.05, 16]} />
              <meshBasicMaterial color="#1e293b" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// --- FUNCIÓN PALLETMANAGER (GLOBAL) ---
function PalletManager({
  mp,
  pallets,
  allPallets,
  onAdd,
  onDelete,
  onUpdateColor,
  onOpenQR,
}) {
  const stockTotal = Number(mp.stock_actual);
  const stockUbicado = pallets.reduce((acc, p) => acc + Number(p.cantidad), 0);
  const stockSuelto = stockTotal - stockUbicado;
  const [newQty, setNewQty] = useState("");
  const [newFila, setNewFila] = useState("0");
  const [newLado, setNewLado] = useState("1");
  const [newProf, setNewProf] = useState("0");
  const unidad = getUnidad(mp.id);
  const isPasillo = Number(newLado) === 3 || Number(newLado) === 4;

  const handleAdd = () => {
    if (!newQty || Number(newQty) <= 0) return alert("Cantidad inválida");
    const f = Number(newFila);
    const l = Number(newLado);
    const p = Number(newProf);
    const ocupado = allPallets.find(
      (pa) =>
        Number(pa.lado) === l &&
        Number(pa.fila) === f &&
        Number(pa.columna) === p,
    );
    if (ocupado) return alert("Ubicación ocupada");
    onAdd(mp.id, Number(newQty), f, l, p);
    setNewQty("");
  };

  return (
    <div className="mt-4 border-t border-slate-700 pt-4">
      <div className="bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700">
        <div className="flex justify-between mb-2">
          <h4 className="font-bold text-white text-sm">{mp.nombre}</h4>
          <input
            type="color"
            className="w-5 h-5 bg-transparent border-0 cursor-pointer"
            value={mp.color_hex || "#3b82f6"}
            onChange={(e) => onUpdateColor(mp, e.target.value)}
          />
        </div>
        <div className="flex gap-2 text-xs font-mono">
          <span className="bg-blue-900/40 text-blue-200 px-2 py-1 rounded">
            Ubicado: {stockUbicado} {unidad}
          </span>
          <span className="bg-slate-700/40 text-gray-300 px-2 py-1 rounded">
            Suelto: {stockSuelto} {unidad}
          </span>
        </div>
      </div>

      <div className="bg-slate-900 p-4 rounded-xl space-y-3 mb-4">
        <input
          type="number"
          className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
          placeholder="Cantidad"
          value={newQty}
          onChange={(e) => setNewQty(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs"
            value={newLado}
            onChange={(e) => {
              const val = Number(e.target.value);
              setNewLado(val);
              if (val === 3 || val === 4) setNewProf("0");
            }}
          >
            <option value="1">Lado 1</option>
            <option value="2">Lado 2</option>
            <option value="3">Pasillo Izq</option>
            <option value="4">Pasillo Der</option>
          </select>
          <select
            className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs"
            value={newFila}
            onChange={(e) => setNewFila(e.target.value)}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <option key={i} value={i}>
                Fila {i}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setNewProf("0")}
            className={`flex-1 py-2 rounded text-xs border ${newProf === "0" ? "bg-indigo-600 text-white" : "bg-slate-950 text-gray-400"}`}
          >
            Frente
          </button>
          <button
            onClick={() => !isPasillo && setNewProf("1")}
            disabled={isPasillo}
            className={`flex-1 py-2 rounded text-xs border ${
              isPasillo
                ? "bg-slate-900 text-gray-600 cursor-not-allowed"
                : newProf === "1"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-950 text-gray-400"
            }`}
          >
            Fondo
          </button>
        </div>
        <button
          onClick={handleAdd}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded text-sm"
        >
          UBICAR
        </button>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
        {pallets.map((p) => (
          <div
            key={p.id}
            className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-slate-700 text-xs"
          >
            <div>
              <span className="font-bold text-white block">
                {p.cantidad} {unidad}
              </span>
              <span className="text-gray-500">
                L{p.lado} • F{p.fila} • {p.columna === 0 ? "Frente" : "Fondo"}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onOpenQR(p)}
                className="text-white bg-slate-700 p-2 rounded"
              >
                <FaQrcode />
              </button>
              <button
                onClick={() => onDelete(p.id)}
                className="text-red-400 bg-slate-700 p-2 rounded"
              >
                <FaTrash />
              </button>
            </div>
          </div>
        ))}
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
  const [selectedPalletId, setSelectedPalletId] = useState(null);
  const [qrPallet, setQrPallet] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPalletId, setScannedPalletId] = useState(null);
  const [viewMode, setViewMode] = useState("3D");

  const cargarDatos = async () => {
    try {
      const [resMat, resPal] = await Promise.all([
        authFetch(`${API_BASE_URL}/ingenieria/materias-primas`),
        authFetch(`${API_BASE_URL}/ingenieria/deposito/pallets`),
      ]);
      if (resMat.ok) {
        const rawMats = await resMat.json();
        const filteredMats = rawMats.filter(
          (m) => m.id !== ID_CANALIZADOR && m.id !== ID_CONOS,
        );
        const extras = [
          {
            id: ID_CANALIZADOR,
            nombre: "🔴 CANALIZADOR VIAL",
            codigo: "PT-CAN",
            color_hex: "#dc2626",
            stock_actual: 9999,
          },
          {
            id: ID_CONOS,
            nombre: "🟠 CONO VIAL",
            codigo: "PT-CON",
            color_hex: "#ea580c",
            stock_actual: 9999,
          },
        ];
        setMateriales([...extras, ...filteredMats]);
      }
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
    try {
      await authFetch(`${API_BASE_URL}/ingenieria/deposito/pallets/${id}`, {
        method: "DELETE",
      });
      cargarDatos();
    } catch (e) {
      alert("Error");
    }
  };

  const handleUpdatePallet = async (id, data) => {
    try {
      await authFetch(`${API_BASE_URL}/ingenieria/deposito/pallets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      cargarDatos();
    } catch (e) {
      alert("Error al actualizar");
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
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-xl p-3 md:px-5 md:py-3 rounded-xl border border-slate-700/50 shadow-2xl pointer-events-auto flex flex-col">
          <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
            <FaWarehouse className="text-indigo-500 text-xl" /> IGLÚ DIGITAL
          </h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">
            {pallets.length} Pallets Ubicados
          </p>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto ml-auto bg-slate-900/80 p-2 rounded-2xl border border-slate-700/50 shadow-xl backdrop-blur-md">
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode("3D")}
              className={`w-10 h-9 rounded-md flex items-center justify-center transition-all ${viewMode === "3D" ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"}`}
              title="Vista 3D"
            >
              <FaCube />
            </button>
            <button
              onClick={() => setViewMode("LIST")}
              className={`w-10 h-9 rounded-md flex items-center justify-center transition-all ${viewMode === "LIST" ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"}`}
              title="Vista Lista"
            >
              <FaList />
            </button>
          </div>
          <div className="w-px h-6 bg-slate-700 mx-1"></div>
          <button
            onClick={() => setIsScanning(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white w-10 h-10 rounded-lg flex items-center justify-center transition-transform active:scale-95 shadow-lg"
            title="Escanear"
          >
            <FaCamera size={20} />
          </button>
          {viewMode === "3D" && (
            <button
              onClick={() => setShowConfig(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 h-10 rounded-lg font-bold text-sm flex items-center gap-2 transition-all border border-slate-600 ml-1"
            >
              <FaCog /> <span className="hidden md:inline">Administrar</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === "3D" ? (
        <div className="flex-1 w-full h-full cursor-move bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0e17] to-[#05070a] min-w-0 min-h-0 relative">
          <Canvas camera={{ position: [0, 18, 25], fov: 50 }} dpr={[1, 1.5]}>
            <color attach="background" args={["#05070a"]} />
            <fogExp2 attach="fog" args={["#05070a", 0.015]} />
            <Environment preset="night" />
            <ambientLight intensity={0.6} color="#b0c4de" />
            <hemisphereLight
              skyColor="#1e293b"
              groundColor="#000000"
              intensity={0.7}
            />
            <directionalLight
              position={[15, 20, 10]}
              intensity={2.5}
              color="#ffdcb4"
            />
            <OrbitControls
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2.1}
              target={[0, 0, 4]}
              dampingFactor={0.05}
            />

            <IndustrialEnvironment />
            <IglooStructure />
            <MezzanineStructure />
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
          </Canvas>
        </div>
      ) : (
        <StockListView pallets={pallets} materiales={materiales} />
      )}

      {/* DRAWER LATERAL */}
      <AnimatePresence>
        {showConfig && viewMode === "3D" && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 h-full w-full md:w-[400px] bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl"
          >
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center shrink-0">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <FaBox className="text-indigo-500" /> Inventario
              </h3>
              <button
                onClick={() => {
                  setShowConfig(false);
                  setSelectedPalletId(null);
                }}
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                      placeholder="Buscar material..."
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
                            {ubicados} pallets
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
                  className="text-xs font-bold text-indigo-400 mb-4 flex items-center gap-2 hover:text-indigo-300"
                >
                  <FaArrowLeft /> VOLVER AL LISTADO
                </button>
                <PalletManager
                  mp={selectedMp}
                  pallets={selectedMpPallets}
                  allPallets={pallets}
                  onAdd={handleAddPallet}
                  onDelete={handleDeletePallet}
                  onUpdateColor={handleUpdateColor}
                  onOpenQR={setQrPallet}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {qrPallet && (
        <QRModal pallet={qrPallet} onClose={() => setQrPallet(null)} />
      )}
      {isScanning && (
        <ScannerModal
          onClose={() => setIsScanning(false)}
          onScanSuccess={(id) => {
            setIsScanning(false);
            setScannedPalletId(id);
          }}
        />
      )}
      {scannedPalletId && (
        <PalletControlModal
          palletId={scannedPalletId}
          allPallets={pallets}
          onClose={() => {
            setScannedPalletId(null);
            setSelectedPalletId(null);
          }}
          onUpdate={handleUpdatePallet}
          onDelete={handleDeletePallet}
        />
      )}
    </div>
  );
}
