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
  FaQrcode,
  FaCamera,
  FaPrint,
  FaSave,
  FaExchangeAlt,
} from "react-icons/fa";
import { API_BASE_URL, authFetch } from "../utils";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import QRCode from "qrcode";
import { Scanner } from "@yudiel/react-qr-scanner";

// --- CONSTANTES ---
const ANCHO_PALLET = 1.2;
const LARGO_PALLET = 1.0;
const GAP = 0.15;
const ANCHO_PASILLO = 4.0;
const ROWS_LADO_1 = 8;
const ROWS_LADO_2 = 6;
const DEPTH_PER_SIDE = 2;

// --- POSICIONAMIENTO ---
const getPosition = (fila, lado, profundidad) => {
  const z = fila * (LARGO_PALLET + GAP);
  let x = 0;
  const startX = ANCHO_PASILLO / 2 + ANCHO_PALLET / 2;
  const pasoX = ANCHO_PALLET + GAP;

  if (lado === 1) {
    // Izquierda
    x = -(startX + profundidad * pasoX);
  } else {
    // Derecha
    x = startX + profundidad * pasoX;
  }
  return [x, 0, z];
};

// --- COMPONENTES 3D (Pigmentos, Pallet, Suelo) ---
function PigmentRoomMarking() {
  const filaInicio = 6;
  const pos = getPosition(filaInicio + 0.5, 2, 0.5); // Lado 2
  const largo = (LARGO_PALLET + GAP) * 2;
  const ancho = (ANCHO_PALLET + GAP) * 2;

  return (
    <group position={[pos[0], 0.005, pos[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ancho, largo]} />
        <meshBasicMaterial color="#334155" opacity={0.8} transparent />
      </mesh>
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(ancho, largo)]} />
        <lineBasicMaterial color="#facc15" linewidth={2} />
      </lineSegments>
      <Text
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        fontSize={0.4}
        color="#facc15"
        anchorX="center"
        anchorY="middle"
      >
        PIGMENTOS
      </Text>
    </group>
  );
}

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
          <div className="bg-black/80 text-white text-[10px] px-2 py-1 rounded border border-white/20 whitespace-nowrap pointer-events-none select-none z-50">
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

function AreaMarkers() {
  const maxRows = Math.max(ROWS_LADO_1, ROWS_LADO_2);
  const largoTotal = maxRows * (LARGO_PALLET + GAP);
  const anchoBloque = ANCHO_PALLET * DEPTH_PER_SIDE + GAP;
  const offsetPasillo = ANCHO_PASILLO / 2;
  const centerL1 = -(offsetPasillo + anchoBloque / 2);
  const centerL2 = offsetPasillo + anchoBloque / 2;
  const zCenter = largoTotal / 2 - LARGO_PALLET / 2;

  return (
    <group position={[0, 0.01, zCenter]}>
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
      <Text
        position={[0, 0.01, zCenter]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        fontSize={0.6}
        color="#475569"
        fillOpacity={0.3}
      >
        PASILLO CENTRAL
      </Text>
      <Text
        position={[0, 0.01, -largoTotal / 2 - 1.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.6}
        color="#fff"
      >
        ↓ ENTRADA ↓
      </Text>
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

// --- MODALES Y PANELES ---

// 1. MODAL GENERADOR DE QR
function QRModal({ pallet, onClose }) {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (pallet) {
      // Generamos un JSON simple que el escáner pueda leer
      const data = JSON.stringify({ type: "PALLET", id: pallet.id });
      QRCode.toDataURL(data, { width: 400, margin: 2 }, (err, url) => {
        if (!err) setQrUrl(url);
      });
    }
  }, [pallet]);

  const handlePrint = () => {
    const win = window.open("", "", "width=500,height=600");
    win.document.write(`
      <html>
        <head><title>Etiqueta Pallet #${pallet.id}</title></head>
        <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">${pallet.nombre}</h1>
          <h2 style="margin: 5px 0; font-size: 40px;">${pallet.cantidad} Kg</h2>
          <img src="${qrUrl}" style="width: 300px; height: 300px;" />
          <p style="font-size: 12px; color: #555;">ID: ${pallet.id} | Fecha: ${new Date().toLocaleDateString()}</p>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-xl p-6 max-w-sm w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-gray-900 font-bold text-xl mb-1">
          {pallet.nombre}
        </h3>
        <p className="text-gray-500 text-sm mb-4">Etiqueta de Identificación</p>

        {qrUrl ? (
          <img
            src={qrUrl}
            alt="QR"
            className="mx-auto w-48 h-48 border-4 border-black rounded-lg mb-4"
          />
        ) : (
          <div className="h-48 flex items-center justify-center">
            Generando...
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handlePrint}
            className="bg-black text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
          >
            <FaPrint /> Imprimir
          </button>
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// 2. MODAL ESCÁNER
function ScannerModal({ onClose, onScanSuccess }) {
  const handleScan = (result) => {
    if (result && result.length > 0) {
      try {
        const raw = result[0].rawValue;
        const data = JSON.parse(raw);
        if (data.type === "PALLET" && data.id) {
          onScanSuccess(data.id);
        }
      } catch (e) {
        console.error("QR Inválido", e);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-4 flex justify-between items-center bg-slate-900 z-10">
        <h3 className="text-white font-bold flex items-center gap-2">
          <FaCamera /> Escaneando...
        </h3>
        <button
          onClick={onClose}
          className="text-white bg-slate-800 p-2 rounded-full"
        >
          <FaTimes />
        </button>
      </div>
      <div className="flex-1 relative">
        <Scanner
          onScan={handleScan}
          components={{ audio: false }}
          styles={{ container: { height: "100%" } }}
        />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 border-2 border-white/50 rounded-xl relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500 -mt-1 -ml-1"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500 -mt-1 -mr-1"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500 -mb-1 -ml-1"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500 -mb-1 -mr-1"></div>
          </div>
        </div>
        <div className="absolute bottom-10 left-0 w-full text-center text-white/80 text-sm">
          Apunta al código QR del pallet
        </div>
      </div>
    </div>
  );
}

// 3. MODAL DE ACCIÓN RÁPIDA (Post-Escaneo)
function PalletControlModal({
  palletId,
  allPallets,
  onClose,
  onUpdate,
  onDelete,
}) {
  const pallet = allPallets.find((p) => p.id === Number(palletId));

  const [qty, setQty] = useState(pallet ? pallet.cantidad : "");
  const [fila, setFila] = useState(pallet ? pallet.fila : 0);
  const [lado, setLado] = useState(pallet ? pallet.lado : 1);
  const [prof, setProf] = useState(pallet ? pallet.columna : 0);

  if (!pallet)
    return (
      <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center">
        <div className="bg-slate-800 p-6 rounded-xl text-center">
          <FaExclamationTriangle className="text-4xl text-yellow-500 mx-auto mb-3" />
          <p className="text-white font-bold">Pallet no encontrado</p>
          <p className="text-sm text-gray-400 mb-4">
            El ID #{palletId} no existe o fue eliminado.
          </p>
          <button
            onClick={onClose}
            className="bg-slate-700 text-white px-4 py-2 rounded"
          >
            Cerrar
          </button>
        </div>
      </div>
    );

  const handleSave = () => {
    // Validar colisiones igual que antes
    const ocupado = allPallets.find(
      (p) =>
        p.id !== pallet.id &&
        p.fila === Number(fila) &&
        p.lado === Number(lado) &&
        p.columna === Number(prof),
    );
    if (ocupado) return alert(`Lugar ocupado por ${ocupado.nombre}`);

    onUpdate(pallet.id, {
      cantidad: Number(qty),
      fila: Number(fila),
      lado: Number(lado),
      columna: Number(prof),
    });
    onClose();
  };

  const handleDelete = () => {
    if (confirm("¿Seguro que este pallet se acabó?")) {
      onDelete(pallet.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="bg-indigo-600 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FaBox className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white leading-none">
                {pallet.nombre}
              </h3>
              <span className="text-[10px] text-indigo-200 uppercase tracking-wider">
                Control de Pallet #{pallet.id}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <FaTimes />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cantidad */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">
              Cantidad Actual (Kg)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-lg focus:border-indigo-500 outline-none"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <button
                className="bg-slate-800 text-white px-4 rounded-xl border border-slate-700"
                onClick={() => setQty(Number(qty) - 25)}
              >
                -25
              </button>
            </div>
          </div>

          {/* Ubicación */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block flex items-center gap-2">
              <FaExchangeAlt /> Mover Ubicación
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                className="bg-slate-950 text-white text-xs p-2 rounded-lg border border-slate-700 outline-none"
                value={lado}
                onChange={(e) => setLado(Number(e.target.value))}
              >
                <option value="1">Lado 1</option>
                <option value="2">Lado 2</option>
              </select>
              <input
                type="number"
                className="bg-slate-950 text-white text-xs p-2 rounded-lg border border-slate-700 text-center"
                value={fila}
                onChange={(e) => setFila(Number(e.target.value))}
                placeholder="Fila"
              />
              <select
                className="bg-slate-950 text-white text-xs p-2 rounded-lg border border-slate-700 outline-none"
                value={prof}
                onChange={(e) => setProf(Number(e.target.value))}
              >
                <option value="0">Frente</option>
                <option value="1">Fondo</option>
              </select>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDelete}
              className="flex-1 bg-red-900/30 text-red-400 border border-red-900/50 py-3 rounded-xl font-bold text-sm hover:bg-red-900/50 flex justify-center items-center gap-2"
            >
              <FaTrash /> BAJA
            </button>
            <button
              onClick={handleSave}
              className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 flex justify-center items-center gap-2"
            >
              <FaSave /> GUARDAR CAMBIOS
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- GESTOR DE PALLETS (PANEL) ---
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
  const [errorMsg, setErrorMsg] = useState("");

  const handleAdd = () => {
    setErrorMsg("");
    if (!newQty || Number(newQty) <= 0)
      return setErrorMsg("Ingresa una cantidad válida.");

    const f = Number(newFila);
    const l = Number(newLado);
    const p = Number(newProf);

    if (l === 1 && f >= ROWS_LADO_1)
      return setErrorMsg(`Lado 1: solo filas 0 a ${ROWS_LADO_1 - 1}.`);
    if (l === 2 && f >= ROWS_LADO_2)
      return setErrorMsg(`Lado 2: solo filas 0 a ${ROWS_LADO_2 - 1}.`);
    if (l === 1 && f >= 6)
      return setErrorMsg("¡Espacio ocupado por Cuarto de Pigmentos!");

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
            <div className="flex gap-1">
              <button
                onClick={() => onOpenQR(p)}
                className="text-white bg-slate-700 hover:bg-slate-600 p-2 rounded transition-colors"
                title="Generar QR"
              >
                <FaQrcode />
              </button>
              <button
                onClick={() => onDelete(p.id)}
                className="text-white bg-red-900/50 hover:bg-red-800 p-2 rounded transition-colors"
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

  // Estados para Modales Nuevos
  const [qrPallet, setQrPallet] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPalletId, setScannedPalletId] = useState(null);

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
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] animate-in fade-in relative bg-slate-950 overflow-hidden">
      {/* HEADER FLOTANTE */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none flex gap-2">
        <div className="bg-slate-900/90 backdrop-blur-xl p-3 md:p-4 rounded-xl border border-slate-700/50 shadow-2xl pointer-events-auto min-w-[200px]">
          <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
            <FaWarehouse className="text-indigo-500 text-xl" /> IGLÚ 3.0
          </h1>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">
            {pallets.length} Pallets Ubicados
          </p>
        </div>

        {/* BOTÓN ESCANEAR QR */}
        <button
          onClick={() => setIsScanning(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white w-14 h-14 md:w-16 md:h-auto rounded-xl shadow-lg border border-emerald-400/30 pointer-events-auto flex items-center justify-center transition-transform active:scale-95"
          title="Escanear Pallet"
        >
          <FaCamera className="text-2xl" />
        </button>
      </div>

      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setShowConfig(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 md:px-5 md:py-2.5 rounded-full md:rounded-xl font-bold shadow-lg flex items-center gap-2 pointer-events-auto transition-transform active:scale-95"
        >
          <FaCog /> <span className="hidden md:inline">Gestionar</span>
        </button>
      </div>

      {/* 3D SCENE */}
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
          <AreaMarkers maxFila={maxFila} />
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

      {/* PANEL LATERAL */}
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
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
                  onOpenQR={setQrPallet}
                />
              </div>
            )}
          </motion.div>
        )}

        {/* MODAL QR GENERADOR */}
        {qrPallet && (
          <QRModal pallet={qrPallet} onClose={() => setQrPallet(null)} />
        )}

        {/* MODAL ESCANER */}
        {isScanning && (
          <ScannerModal
            onClose={() => setIsScanning(false)}
            onScanSuccess={(id) => {
              setIsScanning(false);
              setScannedPalletId(id);
            }}
          />
        )}

        {/* MODAL CONTROL POST-ESCANEO */}
        {scannedPalletId && (
          <PalletControlModal
            palletId={scannedPalletId}
            allPallets={pallets}
            onClose={() => setScannedPalletId(null)}
            onUpdate={handleUpdatePallet}
            onDelete={handleDeletePallet}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
