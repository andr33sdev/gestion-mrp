/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // --- ¡AÑADE ESTO! ---
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      animation: {
        // 'marquee 30s' = 30 segundos en completar un ciclo. Ajústalo si va muy rápido/lento
        marquee: "marquee 30s linear infinite",
      },
      // --- FIN DE LO AÑADIDO ---
    },
  },
  plugins: [],
};
