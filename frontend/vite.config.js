import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: "esnext", // Habilita optimizaciones nativas para navegadores modernos
    minify: "esbuild", // Minificación ultra veloz nativa de Vite
    cssCodeSplit: true, // Divide el CSS automáticamente por cada página/componente diferido
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // 🔥 ESTRATEGIA PREMIUM DE SEPARACIÓN DE LIBRERÍAS PESADAS
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // 1. Separar Gráficos (Métricas)
            if (id.includes("recharts")) {
              return "vendor-analytics-charts";
            }
            // 2. Separar Mapas (Hojas de ruta / Logística)
            if (id.includes("leaflet") || id.includes("react-leaflet")) {
              return "vendor-maps-core";
            }
            // 3. Separar Exportadores (Generación estética de PDF y planillas Excel)
            if (
              id.includes("jspdf") ||
              id.includes("xlsx") ||
              id.includes("qrcode")
            ) {
              return "vendor-document-exports";
            }
            // 4. Separar Firebase e Infraestructura en la nube
            if (id.includes("firebase")) {
              return "vendor-cloud-firebase";
            }
            // 5. Separar Calendarios de Operación masivos
            if (
              id.includes("react-big-calendar") ||
              id.includes("date-fns") ||
              id.includes("moment")
            ) {
              return "vendor-calendar-engine";
            }
            // 6. Animaciones e íconos core de UI
            if (id.includes("framer-motion") || id.includes("react-icons")) {
              return "vendor-interface-ui";
            }
            // El resto de librerías utilitarias pequeñas se agrupan juntas
            return "vendor-utilities";
          }
        },
        // Estructura ultra limpia con Hashes únicos para forzar la actualización de caché en producción solo si el archivo cambió
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
