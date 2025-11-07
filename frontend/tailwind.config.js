// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // --- ¡AÑADE ESTO! ---
      keyframes: {
        "spin-slow": {
          // Para el copo de nieve
          "0%, 100%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        flicker: {
          // Para el fuego
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.6 },
        },
      },
      animation: {
        "spin-slow": "spin-slow 4s linear infinite",
        flicker: "flicker 1.5s ease-in-out infinite",
      },
      // --- FIN DE LO AÑADIDO ---
    },
  },
  plugins: [],
};
