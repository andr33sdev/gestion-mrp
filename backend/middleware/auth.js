// backend/middleware/auth.js
const jwt = require("jsonwebtoken");
const db = require("../db");
const JWT_SECRET =
  process.env.JWT_SECRET || "mrp_super_secreto_2026_seguridad_maxima";

// 1. Proteger: Verifica si el usuario está logueado
exports.protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) return res.status(401).json({ msg: "No autorizado" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { rows } = await db.query(
      "SELECT id, nombre, rol, modulos_acceso, activo FROM usuarios WHERE id = $1",
      [decoded.id],
    );
    if (!rows[0] || !rows[0].activo)
      return res.status(401).json({ msg: "Token inválido o usuario inactivo" });

    req.user = rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ msg: "Sesión expirada" });
  }
};

// 2. Otros middlewares (restrictTo, requireModule...)
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol))
      return res.status(403).json({ msg: "Sin permiso" });
    next();
  };
};
