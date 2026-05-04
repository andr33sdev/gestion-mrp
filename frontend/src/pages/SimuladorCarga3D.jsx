import React, { useState, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Instances,
  Instance,
  RoundedBox,
  Text,
  Line,
} from "@react-three/drei";
import * as THREE from "three";
import {
  FaTruck,
  FaCube,
  FaRulerCombined,
  FaLayerGroup,
  FaExclamationTriangle,
  FaArrowsAltH,
  FaCheck,
  FaFilePdf,
  FaCheckCircle,
  FaBoxOpen,
  FaInfoCircle,
  FaCalculator,
  FaBullseye,
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";

// Importar el Logo
import logoConoflex from "../assets/LogoConoflex.png";

// --- CONSTANTES TÉCNICAS ---
const BED_Y = 1.2;
const COLOR_CONO = "#f97316";

// --- COMPONENTE: REGLA TÉCNICA (COTAS) ---
const Ruler = ({
  start,
  end,
  label,
  color = "#475569",
  offset = [0, 0, 0],
  lineWidth = 1.5,
}) => {
  const points = [start, end];
  const midpoint = [
    (start[0] + end[0]) / 2 + offset[0],
    (start[1] + end[1]) / 2 + offset[1],
    (start[2] + end[2]) / 2 + offset[2],
  ];

  const textRef = useRef();
  useFrame((state) => {
    if (textRef.current) {
      textRef.current.quaternion.copy(state.camera.quaternion);
    }
  });

  return (
    <group>
      <Line points={points} color={color} lineWidth={lineWidth} />
      <Line
        points={[
          [start[0], start[1] - 0.15, start[2]],
          [start[0], start[1] + 0.15, start[2]],
        ]}
        color={color}
        lineWidth={1}
      />
      <Line
        points={[
          [end[0], end[1] - 0.15, end[2]],
          [end[0], end[1] + 0.15, end[2]],
        ]}
        color={color}
        lineWidth={1}
      />
      <mesh ref={textRef} position={midpoint}>
        <Text
          text={`${label}m`}
          fontSize={0.25}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#ffffff"
          fontWeight="bold"
        />
      </mesh>
    </group>
  );
};

// --- COMPONENTE: RUEDA REALISTA ---
const Wheel = ({ position }) => (
  <group position={position}>
    <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.45, 0.45, 0.35, 24]} />
      <meshStandardMaterial color="#111111" roughness={0.9} />
    </mesh>
    <mesh
      rotation={[0, 0, Math.PI / 2]}
      position={[Math.sign(position[0]) * 0.18, 0, 0]}
    >
      <cylinderGeometry args={[0.25, 0.25, 0.05, 16]} />
      <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
    </mesh>
  </group>
);

// --- COMPONENTE 3D: EL CAMIÓN Y LA CARGA ---
const Scene3D = ({ config }) => {
  const w = config.truckW;
  const l = config.truckL;
  const h = config.truckH;
  const cBase = config.coneBase;
  const cH = config.coneH;
  const sCount = config.stackCount;
  const sTotalH = config.stackTotalH;
  const calcMode = config.calcMode;
  const targetQ = config.targetQuantity;

  const fitX = Math.floor(w / cBase);
  const fitZ = Math.floor(l / cBase);
  const startX = -(w / 2) + cBase / 2;
  const startZ = -(l / 2) + cBase / 2;
  const stepY = sCount > 1 ? (sTotalH - cH) / (sCount - 1) : 0;

  const maxCapacity = fitX * fitZ * sCount;
  const limitQ = calcMode === "max" ? maxCapacity : targetQ;

  const coneInstances = useMemo(() => {
    if (fitX <= 0 || fitZ <= 0 || limitQ <= 0) return [];
    const instances = [];
    let conesPlaced = 0;

    for (let z = 0; z < fitZ; z++) {
      for (let x = 0; x < fitX; x++) {
        let conesInThisStack = 0;
        while (conesInThisStack < sCount && conesPlaced < limitQ) {
          const posX = startX + x * cBase;
          const posZ = startZ + z * cBase;
          const posY = BED_Y + cH / 2 + conesInThisStack * stepY;

          instances.push({
            position: [posX, posY, posZ],
            id: `cone-${conesPlaced}`,
          });
          conesInThisStack++;
          conesPlaced++;
        }
        if (conesPlaced >= limitQ) break;
      }
      if (conesPlaced >= limitQ) break;
    }
    return instances;
  }, [fitX, fitZ, startX, startZ, sCount, stepY, cH, cBase, limitQ]);

  const cabZ = -l / 2 - 1.8;

  return (
    <group>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[15, 25, 15]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <Environment preset="city" />

      {/* SEMIRREMOLQUE */}
      <group>
        <mesh position={[0, BED_Y - 0.05, 0]} receiveShadow castShadow>
          <boxGeometry args={[w, 0.1, l]} />
          <meshStandardMaterial
            color="#334155"
            metalness={0.4}
            roughness={0.6}
          />
        </mesh>
        <mesh position={[0, BED_Y - 0.25, 0]} receiveShadow castShadow>
          <boxGeometry args={[1, 0.3, l]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[0, BED_Y + 0.8, -l / 2 + 0.05]} castShadow>
          <boxGeometry args={[w, 1.6, 0.1]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        {[l / 2 - 1, l / 2 - 2.5].map((zPos, idx) => (
          <React.Fragment key={`axle-${idx}`}>
            <Wheel position={[-w / 2 + 0.2, 0.45, zPos]} />
            <Wheel position={[w / 2 - 0.2, 0.45, zPos]} />
          </React.Fragment>
        ))}
        <mesh position={[0, BED_Y + h / 2, 0]}>
          <boxGeometry args={[w, h, l]} />
          <meshPhysicalMaterial
            color="#3b82f6"
            transparent
            opacity={0.08}
            transmission={0.9}
            side={2}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* CABINA TRACTORA */}
      <group>
        <mesh position={[0, 0.6, cabZ + 0.5]} castShadow>
          <boxGeometry args={[1, 0.2, 3.5]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <Wheel position={[-1.1, 0.45, cabZ + 1.2]} />
        <Wheel position={[1.1, 0.45, cabZ + 1.2]} />
        <Wheel position={[-1.1, 0.45, cabZ - 0.8]} />
        <Wheel position={[1.1, 0.45, cabZ - 0.8]} />
        <RoundedBox
          args={[2.4, 2.6, 2.2]}
          position={[0, 1.9, cabZ - 0.2]}
          radius={0.1}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial
            color="#f8fafc"
            metalness={0.2}
            roughness={0.3}
          />
        </RoundedBox>
        <mesh position={[0, 2.3, cabZ - 1.31]}>
          <planeGeometry args={[2.2, 1]} />
          <meshPhysicalMaterial
            color="#0f172a"
            metalness={0.9}
            roughness={0.1}
            transparent
            opacity={0.9}
          />
        </mesh>
        <mesh position={[0, 1.2, cabZ - 1.31]}>
          <planeGeometry args={[1.8, 0.8]} />
          <meshStandardMaterial color="#111" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[-0.8, 0.9, cabZ - 1.31]}>
          <planeGeometry args={[0.4, 0.2]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={2}
          />
        </mesh>
        <mesh position={[0.8, 0.9, cabZ - 1.31]}>
          <planeGeometry args={[0.4, 0.2]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={2}
          />
        </mesh>
        <RoundedBox
          args={[2.5, 0.4, 0.4]}
          position={[0, 0.7, cabZ - 1.2]}
          radius={0.05}
          castShadow
        >
          <meshStandardMaterial color="#334155" />
        </RoundedBox>
      </group>

      {/* CARGA */}
      {coneInstances.length > 0 && (
        <Instances limit={20000} castShadow receiveShadow>
          <cylinderGeometry args={[0.04, cBase / 2, cH, 12]} />
          <meshStandardMaterial
            color={COLOR_CONO}
            roughness={0.5}
            metalness={0.1}
          />
          {coneInstances.map((props) => (
            <Instance key={props.id} position={props.position} />
          ))}
        </Instances>
      )}

      <ContactShadows
        resolution={1024}
        scale={30}
        blur={2}
        opacity={0.7}
        far={10}
        color="#000000"
        position={[0, 0, 0]}
      />

      {/* COTAS */}
      <Ruler
        start={[-w / 2 - 0.6, BED_Y, l / 2]}
        end={[-w / 2 - 0.6, BED_Y, -l / 2]}
        label={l.toFixed(2)}
        color="#3b82f6"
        offset={[-0.4, 0, 0]}
      />
      <Ruler
        start={[-w / 2, BED_Y, l / 2 + 0.6]}
        end={[w / 2, BED_Y, l / 2 + 0.6]}
        label={w.toFixed(2)}
        color="#3b82f6"
        offset={[0, 0, 0.4]}
      />
      <Ruler
        start={[w / 2 + 0.6, BED_Y, l / 2]}
        end={[w / 2 + 0.6, BED_Y + h, l / 2]}
        label={h.toFixed(2)}
        color="#94a3b8"
        offset={[0.4, 0, 0]}
      />
      {coneInstances.length > 0 && (
        <Ruler
          start={[0, BED_Y, 0]}
          end={[0, BED_Y + sTotalH, 0]}
          label={sTotalH.toFixed(2)}
          color={COLOR_CONO}
          offset={[0.3, 0, cBase / 2 + 0.3]}
          lineWidth={2}
        />
      )}
    </group>
  );
};

// --- HELPER PARA CARGAR LOGO EN PDF ---
const getBase64ImageFromUrl = async (imageUrl) => {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      function () {
        resolve(reader.result);
      },
      false,
    );
    reader.onerror = () =>
      reject(new Error("Error al convertir imagen a base64"));
    reader.readAsDataURL(blob);
  });
};

export default function SimuladorCarga3D() {
  const glRef = useRef(null);

  const [draft, setDraft] = useState({
    calcMode: "max",
    targetQuantity: "2000",
    truckL: "14.5",
    truckW: "2.4",
    truckH: "2.6",
    coneBase: "0.35",
    coneH: "0.7",
    stackCount: "8",
    stackTotalH: "2.3",
  });

  const [appliedConfig, setAppliedConfig] = useState({
    calcMode: "max",
    targetQuantity: 2000,
    truckL: 14.5,
    truckW: 2.4,
    truckH: 2.6,
    coneBase: 0.35,
    coneH: 0.7,
    stackCount: 8,
    stackTotalH: 2.3,
  });

  const handleDraftChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const applyChanges = () => {
    const safeConfig = {
      calcMode: draft.calcMode,
      targetQuantity: Math.max(
        1,
        Math.floor(Number(draft.targetQuantity)) || 2000,
      ),
      truckL: Math.max(1, Number(draft.truckL) || 14.5),
      truckW: Math.max(1, Number(draft.truckW) || 2.4),
      truckH: Math.max(0.5, Number(draft.truckH) || 2.6),
      coneBase: Math.max(0.1, Number(draft.coneBase) || 0.35),
      coneH: Math.max(0.1, Number(draft.coneH) || 0.7),
      stackCount: Math.max(1, Math.floor(Number(draft.stackCount)) || 8),
      stackTotalH: Math.max(0.1, Number(draft.stackTotalH) || 2.3),
    };

    setAppliedConfig(safeConfig);
    setDraft({
      calcMode: safeConfig.calcMode,
      targetQuantity: String(safeConfig.targetQuantity),
      truckL: String(safeConfig.truckL),
      truckW: String(safeConfig.truckW),
      truckH: String(safeConfig.truckH),
      coneBase: String(safeConfig.coneBase),
      coneH: String(safeConfig.coneH),
      stackCount: String(safeConfig.stackCount),
      stackTotalH: String(safeConfig.stackTotalH),
    });
  };

  // --- MATEMÁTICA LOGÍSTICA ---
  const fitX = Math.floor(appliedConfig.truckW / appliedConfig.coneBase);
  const fitZ = Math.floor(appliedConfig.truckL / appliedConfig.coneBase);
  const maxStacks = fitX * fitZ;
  const maxCapacity = maxStacks * appliedConfig.stackCount;

  const effectiveTarget =
    appliedConfig.calcMode === "max"
      ? maxCapacity
      : appliedConfig.targetQuantity;

  const loadedCones = Math.min(effectiveTarget, maxCapacity);
  const loadedStacks = Math.ceil(loadedCones / appliedConfig.stackCount);

  const excessCones = Math.max(0, effectiveTarget - maxCapacity);
  const excessStacks = Math.ceil(excessCones / appliedConfig.stackCount);

  const heightExceeded = appliedConfig.stackTotalH > appliedConfig.truckH;

  let loadedVolume = 0;
  if (fitX > 0 && fitZ > 0 && !heightExceeded) {
    const usedRowsZ = Math.ceil(loadedStacks / fitX);
    const usedColsX = loadedStacks >= fitX ? fitX : loadedStacks;
    loadedVolume =
      usedColsX *
      appliedConfig.coneBase *
      (usedRowsZ * appliedConfig.coneBase) *
      appliedConfig.stackTotalH;
  }

  let excessVolume = 0;
  if (excessStacks > 0 && !heightExceeded) {
    const effectiveFitX = fitX > 0 ? fitX : 1;
    const excessRowsZ = Math.ceil(excessStacks / effectiveFitX);
    const excessColsX =
      excessStacks >= effectiveFitX ? effectiveFitX : excessStacks;
    excessVolume =
      excessColsX *
      appliedConfig.coneBase *
      (excessRowsZ * appliedConfig.coneBase) *
      appliedConfig.stackTotalH;
  }

  // --- EXPORTACIÓN PDF ---
  const generarPlanoPDF = async () => {
    toast.loading("Generando reporte técnico...", { id: "pdfRender" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      if (!glRef.current) throw new Error("El motor 3D no está listo");
      const img3D = glRef.current.domElement.toDataURL("image/jpeg", 1.0);
      const logoData = await getBase64ImageFromUrl(logoConoflex);

      const doc = new jsPDF("landscape", "mm", "a4");

      const textDark = [30, 41, 59];
      const textMuted = [100, 116, 139];
      const borderLight = [226, 232, 240];
      const emerald = [5, 150, 105];

      // --- CABECERA (COMPACTADA) ---
      // Logo subido a y=10 y un poco más chico
      doc.addImage(logoData, "PNG", 15, 10, 38, 12);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13); // Título apenitas más chico
      doc.setTextColor(...textDark);
      doc.text("REPORTE DE CUBICAJE Y LOGÍSTICA", 60, 17);

      const modoTexto =
        appliedConfig.calcMode === "max"
          ? "Capacidad Máxima"
          : "Objetivo de Carga";
      const estadoTexto = heightExceeded
        ? "No Viable (Altura)"
        : excessCones > 0
          ? "Carga Dividida"
          : "Óptima";

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textMuted);

      // Datos subidos
      doc.text(`MODO:`, 235, 13, { align: "right" });
      doc.text(`ESTADO:`, 235, 17.5, { align: "right" });
      doc.text(`FECHA:`, 235, 22, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...textDark);
      doc.text(modoTexto, 238, 13, { align: "left" });
      doc.text(estadoTexto, 238, 17.5, { align: "left" });
      doc.text(new Date().toLocaleDateString("es-AR"), 238, 22, {
        align: "left",
      });

      // Línea divisoria subida
      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.2);
      doc.line(15, 26, 282, 26);

      // --- RENDER 3D (Subido y Estirado) ---
      doc.addImage(img3D, "JPEG", 15, 30, 165, 145);
      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.2);
      doc.rect(15, 30, 165, 145);

      // --- TABLAS DE DATOS (Subidas y Compactadas) ---
      const tableStartX = 190;

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...textMuted);
      doc.text("ESPECIFICACIONES", tableStartX, 32); // Texto subido

      const table1Body = [];
      if (appliedConfig.calcMode === "target") {
        table1Body.push(["Cantidad Requerida", `${effectiveTarget} uds`]);
      }
      table1Body.push(
        ["Uds. por Pila", `${appliedConfig.stackCount} uds`],
        ["Base Cono", `${appliedConfig.coneBase.toFixed(2)} m`],
        ["Altura Pila", `${appliedConfig.stackTotalH.toFixed(2)} m`],
        ["Largo Caja (Z)", `${appliedConfig.truckL.toFixed(2)} m`],
        ["Ancho Caja (X)", `${appliedConfig.truckW.toFixed(2)} m`],
        ["Alto Techo (Y)", `${appliedConfig.truckH.toFixed(2)} m`],
      );

      autoTable(doc, {
        startY: 34, // Inicio de tabla subido
        margin: { left: tableStartX, right: 15, bottom: 5 },
        pageBreak: "avoid",
        head: [["PARÁMETRO", "VALOR"]],
        body: table1Body,
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5, // Padding apenas más ajustado
          textColor: [71, 85, 105],
          lineColor: [241, 245, 249],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [100, 116, 139],
          fontStyle: "bold",
        },
        columnStyles: {
          1: { halign: "right", fontStyle: "bold", textColor: [30, 41, 59] },
        },
      });

      const finalY = doc.lastAutoTable.finalY;

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...textMuted);
      doc.text("DISTRIBUCIÓN Y VOLUMEN", tableStartX, finalY + 8);

      const table2Body = [
        ["Camión Principal", `${loadedCones} uds`],
        ["Pallets (Pilas)", `${loadedStacks}`],
        ["Volumen Carga", `${loadedVolume.toFixed(2)} m³`],
      ];

      if (excessCones > 0 && !heightExceeded) {
        table2Body.push(["--", "--"]);
        table2Body.push(["EXCEDENTE", `${excessCones} uds`]);
        table2Body.push(["Volumen Exced", `${excessVolume.toFixed(2)} m³`]);
      }

      autoTable(doc, {
        startY: finalY + 10,
        margin: { left: tableStartX, right: 15, bottom: 5 },
        pageBreak: "avoid",
        head: [["ASIGNACIÓN", "CANTIDAD"]],
        body: table2Body,
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          textColor: [71, 85, 105],
          lineColor: [241, 245, 249],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [100, 116, 139],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { fontStyle: "bold" },
          1: {
            halign: "right",
            fontStyle: "bold",
            textColor: heightExceeded ? [225, 29, 72] : emerald,
          },
        },
      });

      const finalYTable2 = doc.lastAutoTable.finalY;

      // --- ALERTAS ---
      if (heightExceeded) {
        const alertY = finalYTable2 + 6;
        doc.setFillColor(255, 241, 242);
        doc.roundedRect(tableStartX, alertY, 92, 14, 2, 2, "F"); // Caja más baja (14mm)
        doc.setTextColor(225, 29, 72);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("Colisión Vertical", tableStartX + 4, alertY + 5.5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(
          "La altura de la pila supera el límite de techo.",
          tableStartX + 4,
          alertY + 10,
        );
      } else if (excessCones > 0) {
        const alertY = finalYTable2 + 6;
        doc.setFillColor(255, 251, 235);
        doc.roundedRect(tableStartX, alertY, 92, 14, 2, 2, "F");
        doc.setTextColor(217, 119, 6);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("Transporte Adicional", tableStartX + 4, alertY + 5.5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(
          `Se requiere espacio para ${excessCones} uds adicionales.`,
          tableStartX + 4,
          alertY + 10,
        );
      }

      // Pie de página subido
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.text("Generado por Sistema de Gestión MRP", 15, 195);

      doc.save(`Reporte_Logistica_${effectiveTarget}uds.pdf`);
      toast.dismiss("pdfRender");
      toast.success("Reporte Exportado Exitosamente");
    } catch (error) {
      console.error(error);
      toast.dismiss("pdfRender");
      toast.error("Error al generar el reporte PDF");
    }
  };

  // --- VARIABLES UI SIDEBAR ---
  const isDivided = excessCones > 0 && !heightExceeded;
  const headerBgColor = heightExceeded
    ? "bg-rose-600"
    : isDivided
      ? "bg-amber-500"
      : "bg-emerald-600";

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#f4f7f9] font-sans overflow-hidden animate-in fade-in duration-500">
      {/* PANEL LATERAL */}
      <aside className="w-full lg:w-[420px] h-full bg-white border-r border-slate-200 flex flex-col z-10 shadow-2xl relative">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
          <div className="p-3 rounded-2xl bg-blue-600 shadow-md shadow-blue-200 text-white">
            <FaBoxOpen size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">
              Simulador Logístico
            </h1>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
              Motor de Cubicaje
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* SELECTOR DE MODO */}
          <div className="bg-slate-100 p-1.5 rounded-xl flex gap-1">
            <button
              onClick={() => handleDraftChange("calcMode", "max")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${draft.calcMode === "max" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <FaCalculator /> Capacidad Máxima
            </button>
            <button
              onClick={() => handleDraftChange("calcMode", "target")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${draft.calcMode === "target" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <FaBullseye /> Por Objetivo
            </button>
          </div>

          {/* OBJETIVO DE CARGA */}
          {draft.calcMode === "target" && (
            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <InputNumber
                label="🎯 Cantidad a cargar (Total Despacho)"
                value={draft.targetQuantity}
                onChange={(v) => handleDraftChange("targetQuantity", v)}
                highlight
              />
            </div>
          )}

          {/* Especificaciones Producto */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
              <FaLayerGroup className="text-orange-500" /> Detalle del Producto
              y Apilado
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <InputNumber
                label="Uds. por Pila"
                value={draft.stackCount}
                onChange={(v) => handleDraftChange("stackCount", v)}
              />
              <InputNumber
                label="Alto Pila (m)"
                value={draft.stackTotalH}
                onChange={(v) => handleDraftChange("stackTotalH", v)}
                error={heightExceeded}
              />
              <InputNumber
                label="Base Cono (m)"
                value={draft.coneBase}
                onChange={(v) => handleDraftChange("coneBase", v)}
              />
              <InputNumber
                label="Alto 1 Cono (m)"
                value={draft.coneH}
                onChange={(v) => handleDraftChange("coneH", v)}
              />
            </div>
          </div>

          {/* Dimensiones Caja */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
              <FaTruck className="text-slate-500" /> Camión 1 (Transporte
              Principal)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <InputNumber
                label="Largo (Z)"
                value={draft.truckL}
                onChange={(v) => handleDraftChange("truckL", v)}
              />
              <InputNumber
                label="Ancho (X)"
                value={draft.truckW}
                onChange={(v) => handleDraftChange("truckW", v)}
              />
              <InputNumber
                label="Techo (Y)"
                value={draft.truckH}
                onChange={(v) => handleDraftChange("truckH", v)}
              />
            </div>
          </div>

          {/* BOTONES */}
          <div className="flex gap-2">
            <button
              onClick={applyChanges}
              className="flex-1 py-3.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <FaCheck size={12} /> Calcular
            </button>
            <button
              onClick={generarPlanoPDF}
              className="px-5 py-3.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <FaFilePdf size={14} /> PDF
            </button>
          </div>

          {/* ALERTAS */}
          {heightExceeded && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex gap-3 animate-in slide-in-from-top-2">
              <FaExclamationTriangle className="text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-rose-700">
                  Colisión Vertical
                </p>
                <p className="text-[10px] font-medium text-rose-600 mt-1">
                  La pila ({appliedConfig.stackTotalH}m) choca con el techo (
                  {appliedConfig.truckH}m).
                </p>
              </div>
            </div>
          )}

          {isDivided && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 animate-in slide-in-from-top-2">
              <FaInfoCircle className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-700">
                  Transporte Adicional Requerido
                </p>
                <p className="text-[10px] font-medium text-amber-700/80 mt-1">
                  El camión principal se llenó. Quedan{" "}
                  <strong>{excessCones} conos</strong> pendientes de cargar que
                  ocupan <strong>{excessVolume.toFixed(2)} m³</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* STATS FOOTER REFORMULADO */}
        <div
          className={`p-6 text-white rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] transition-colors ${headerBgColor}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/80 mb-4 flex items-center gap-2">
            {heightExceeded ? (
              <>
                <FaExclamationTriangle /> Colisión de Techo
              </>
            ) : isDivided ? (
              <>
                <FaTruck /> Carga Dividida (Camión Lleno)
              </>
            ) : (
              <>
                <FaCheckCircle /> Carga Óptima (Al Tope)
              </>
            )}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-black tracking-tight leading-none">
                {loadedStacks}
              </p>
              <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-1">
                Pilas en Camión 1
              </p>
              <p className="text-[10px] font-medium text-white/50 mt-1">
                {loadedCones} unidades
              </p>
            </div>
            <div>
              <p className="text-2xl font-black tracking-tight leading-none">
                {loadedVolume.toFixed(2)} m³
              </p>
              <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-1">
                Volumen Camión 1
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* VISOR 3D */}
      <main className="flex-1 relative cursor-grab active:cursor-grabbing bg-[#e2e8f0]">
        <Canvas
          shadows
          gl={{ preserveDrawingBuffer: true }}
          onCreated={({ gl }) => (glRef.current = gl)}
          camera={{ position: [12, 10, 15], fov: 40 }}
        >
          <color attach="background" args={["#e2e8f0"]} />
          <Scene3D config={appliedConfig} />
          <OrbitControls
            makeDefault
            maxPolarAngle={Math.PI / 2 - 0.02}
            minDistance={5}
            maxDistance={40}
            target={[0, BED_Y, 0]}
          />
        </Canvas>
      </main>
    </div>
  );
}

// --- HELPER DE INPUTS ---
const InputNumber = ({ label, value, onChange, error, highlight }) => (
  <div>
    <label
      className={`text-[9px] font-bold uppercase ${highlight ? "text-blue-600" : "text-slate-500"}`}
    >
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-white border rounded-xl px-3 py-2 text-sm font-bold outline-none transition-colors mt-1 shadow-sm ${error ? "border-rose-300 text-rose-600 bg-rose-50" : highlight ? "border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 text-blue-700" : "border-slate-200 text-slate-700 focus:border-slate-500"}`}
    />
  </div>
);
