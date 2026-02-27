// backend/middleware/auth.js
const jwt = require("jsonwebtoken");
const db = require("../db");

// Llave secreta (en producción debería estar en tu archivo .env)
const JWT_SECRET =
  process.env.JWT_SECRET || "mrp_super_secreto_2026_seguridad_maxima";

// 1. Proteger: Verifica si el usuario está logueado y activo
exports.protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ msg: "No autorizado. Inicie sesión." });
  }

  try {
    // Decodificar el token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Buscar el usuario en la BD
    const { rows } = await db.query(
      "SELECT id, nombre, email, rol, modulos_acceso, activo FROM usuarios WHERE id = $1",
      [decoded.id],
    );
    const usuario = rows[0];

    if (!usuario) {
      return res.status(401).json({ msg: "El usuario ya no existe." });
    }
    if (!usuario.activo) {
      return res
        .status(403)
        .json({ msg: "Usuario inactivo. Contacte a gerencia." });
    }

    // Le pasamos el usuario a la siguiente ruta
    req.user = usuario;
    next();
  } catch (error) {
    return res.status(401).json({ msg: "Token inválido o expirado." });
  }
};

// 2. Restringir por Rol (Ej: Solo GERENCIA)
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res
        .status(403)
        .json({ msg: "No tienes permiso para realizar esta acción." });
    }
    next();
  };
};

// 3. NUEVO: Validar si tiene acceso a un módulo específico
exports.requireModule = (modulo) => {
  return (req, res, next) => {
    if (req.user.rol === "GERENCIA") return next(); // Gerencia entra a todo

    const modulos = req.user.modulos_acceso || [];
    if (!modulos.includes(modulo)) {
      return res
        .status(403)
        .json({ msg: `No tienes permisos para el módulo: ${modulo}` });
    }
    next();
  };
};
