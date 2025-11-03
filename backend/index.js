const express = require("express");
const cors = require("cors"); // <-- 1. Importamos cors

const app = express();
const PORT = 4000;

// --- MIDDLEWARE ---
// Son "ayudantes" que se ejecutan antes que nuestras rutas
app.use(cors()); // <-- 2. Usamos cors (permite peticiones de otros "orígenes")
app.use(express.json()); // <-- 3. Usamos el lector de JSON (para leer datos POST)

// --- RUTAS ---
app.get("/", (req, res) => {
  res.send("¡Mi servidor de backend funciona!");
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
