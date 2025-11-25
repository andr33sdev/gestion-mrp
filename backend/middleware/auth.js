// backend/middleware/auth.js
const KEY_PANEL = process.env.API_KEY_PANEL;
const KEY_GERENCIA = process.env.API_KEY_GERENCIA;
const KEY_DEPOSITO = process.env.API_KEY_DEPOSITO;

// 1. Middleware base: Verifica que la clave sea válida (cualquiera de las dos)
const protect = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res
      .status(401)
      .json({ msg: "⛔ Acceso denegado: Falta credencial" });
  }

  if (apiKey === KEY_GERENCIA) {
    req.userRole = "GERENCIA"; // Es el jefe, tiene poder total
    return next();
  }

  if (apiKey === KEY_PANEL) {
    req.userRole = "PANEL"; // Es un operario
    return next();
  }

  if (apiKey === KEY_DEPOSITO) {
    req.userRole = "DEPOSITO"; // Es personal de depósito
    return next();
  }

  // Si no coincide con ninguna
  return res.status(403).json({ msg: "⛔ Credencial incorrecta" });
};

// 2. Middleware de restricción: Solo deja pasar si el rol es suficiente
// Uso: router.delete("/", protect, restrictTo('GERENCIA'), ...)
const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    // Si el usuario tiene rol 'GERENCIA', siempre lo dejamos pasar (superusuario)
    if (req.userRole === "GERENCIA") return next();

    // Si no es gerencia, verificamos si su rol está en la lista permitida
    if (!allowedRoles.includes(req.userRole)) {
      return res
        .status(403)
        .json({ msg: "⛔ No tienes permisos para realizar esta acción." });
    }

    next();
  };
};

module.exports = { protect, restrictTo };
