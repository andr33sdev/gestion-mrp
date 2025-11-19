import React from "react";
import { Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";

// ESTILOS MONOCROMÁTICOS (BLANCO Y NEGRO)
const styles = StyleSheet.create({
  page: {
    padding: 35,
    fontFamily: "Helvetica",
    fontSize: 9, // Letra un poco más compacta para meter más info
    color: "#000",
    backgroundColor: "#fff",
  },
  // ENCABEZADO
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    paddingBottom: 10,
    marginBottom: 15,
  },
  headerLeft: {
    flexDirection: "column",
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 10,
    marginTop: 2,
    textTransform: "uppercase",
  },
  // DATOS GENERALES (Resumen)
  summaryBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f0f0f0", // Gris muy claro para separar
    padding: 8,
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 20,
  },
  summaryItem: {
    flexDirection: "column",
    alignItems: "center",
    width: "25%",
  },
  summaryLabel: {
    fontSize: 7,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: "bold",
  },
  // TÍTULOS DE SECCIÓN
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    marginTop: 15,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 2,
  },
  // TABLAS
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 20,
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#000", // Encabezado NEGRO
    color: "#fff", // Texto BLANCO
    height: 25,
  },
  tableCell: {
    padding: 4,
    fontSize: 9,
  },
  // Columnas Tabla 1 (Producción)
  colProdCode: { width: "20%", borderRightWidth: 1, borderColor: "#000" },
  colProdName: { width: "50%", borderRightWidth: 1, borderColor: "#000" },
  colProdQty: {
    width: "15%",
    borderRightWidth: 1,
    borderColor: "#000",
    textAlign: "right",
  },
  colProdDone: { width: "15%", textAlign: "right" },

  // Columnas Tabla 2 (MRP)
  colMrpName: { width: "35%", borderRightWidth: 1, borderColor: "#000" },
  colMrpCode: { width: "20%", borderRightWidth: 1, borderColor: "#000" },
  colMrpNec: {
    width: "15%",
    borderRightWidth: 1,
    borderColor: "#000",
    textAlign: "right",
  },
  colMrpStock: {
    width: "15%",
    borderRightWidth: 1,
    borderColor: "#000",
    textAlign: "right",
  },
  colMrpBal: { width: "15%", textAlign: "right" },

  // Utilidades
  bold: { fontWeight: "bold" },
  textRight: { textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 35,
    right: 35,
    fontSize: 8,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 10,
  },
});

export const PlanDocument = ({ plan, items, explosion }) => {
  const nombrePlan = plan?.nombre || "SIN NOMBRE";
  const fecha = new Date().toLocaleDateString("es-AR");
  const safeItems = Array.isArray(items) ? items : [];
  const safeExplosion = Array.isArray(explosion) ? explosion : [];

  // Cálculos para el resumen
  const totalUnidades = safeItems.reduce(
    (acc, item) => acc + Number(item.cantidad || 0),
    0
  );
  const totalAvance = safeItems.reduce(
    (acc, item) => acc + Number(item.producido || 0),
    0
  );
  const itemsConFalta = safeExplosion.filter((i) => i.balance < 0).length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 1. HEADER ESTILO INGENIERÍA */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>ORDEN DE PRODUCCIÓN</Text>
            <Text style={styles.subtitle}>Horno Rotomoldeo</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 14, fontWeight: "bold" }}>
              #{nombrePlan}
            </Text>
            <Text style={{ fontSize: 10 }}>Fecha de Emisión: {fecha}</Text>
          </View>
        </View>

        {/* 2. RESUMEN EJECUTIVO (BOX GRIS) */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Ítems</Text>
            <Text style={styles.summaryValue}>{safeItems.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Unidades a Producir</Text>
            <Text style={styles.summaryValue}>{totalUnidades}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Avance Actual</Text>
            <Text style={styles.summaryValue}>{totalAvance}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Insumos Faltantes</Text>
            <Text style={styles.summaryValue}>
              {itemsConFalta > 0 ? `${itemsConFalta} ITEMS` : "OK"}
            </Text>
          </View>
        </View>

        {/* 3. TABLA DE PRODUCCIÓN DETALLADA */}
        <Text style={styles.sectionTitle}>1. Plan de Trabajo (Detalle)</Text>
        <View style={styles.table}>
          {/* Header Negro */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.colProdCode]}>CÓDIGO</Text>
            <Text style={[styles.tableCell, styles.colProdName]}>
              PRODUCTO / SEMIELABORADO
            </Text>
            <Text style={[styles.tableCell, styles.colProdQty]}>CANT.</Text>
            <Text style={[styles.tableCell, styles.colProdDone]}>HECHO</Text>
          </View>
          {/* Filas */}
          {safeItems.length > 0 ? (
            safeItems.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colProdCode]}>
                  {item.semielaborado?.codigo || "-"}
                </Text>
                <Text style={[styles.tableCell, styles.colProdName]}>
                  {item.semielaborado?.nombre || "Desconocido"}
                </Text>
                <Text
                  style={[styles.tableCell, styles.colProdQty, styles.bold]}
                >
                  {item.cantidad}
                </Text>
                <Text style={[styles.tableCell, styles.colProdDone]}>
                  {item.producido}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text
                style={[
                  styles.tableCell,
                  { width: "100%", textAlign: "center" },
                ]}
              >
                No se han asignado ítems a este plan.
              </Text>
            </View>
          )}
        </View>

        {/* 4. TABLA MRP (MATERIALES) */}
        <Text style={styles.sectionTitle}>
          2. Requerimiento de Materiales (MRP)
        </Text>
        <View style={styles.table}>
          {/* Header Negro */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.colMrpName]}>
              MATERIA PRIMA
            </Text>
            <Text style={[styles.tableCell, styles.colMrpCode]}>CÓDIGO</Text>
            <Text style={[styles.tableCell, styles.colMrpNec]}>NECESARIO</Text>
            <Text style={[styles.tableCell, styles.colMrpStock]}>STOCK</Text>
            <Text style={[styles.tableCell, styles.colMrpBal]}>BALANCE</Text>
          </View>
          {/* Filas */}
          {safeExplosion.length > 0 ? (
            safeExplosion.map((mp, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colMrpName]}>
                  {mp.nombre}
                </Text>
                <Text style={[styles.tableCell, styles.colMrpCode]}>
                  {mp.codigo}
                </Text>
                <Text style={[styles.tableCell, styles.colMrpNec]}>
                  {mp.necesario}
                </Text>
                <Text style={[styles.tableCell, styles.colMrpStock]}>
                  {mp.stock}
                </Text>
                <Text style={[styles.tableCell, styles.colMrpBal, styles.bold]}>
                  {mp.balance < 0
                    ? `FALTA ${Math.abs(mp.balance)}`
                    : mp.balance}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text
                style={[
                  styles.tableCell,
                  { width: "100%", textAlign: "center" },
                ]}
              >
                No hay requerimientos de materiales pendientes.
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          Documento interno de producción. Generado el{" "}
          {new Date().toLocaleString()}
        </Text>
      </Page>
    </Document>
  );
};
