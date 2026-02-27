const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { protect, restrictTo } = require("../middleware/auth");

const JWT_SECRET =
  process.env.JWT_SECRET || "mrp_super_secreto_2026_seguridad_maxima";

const signToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: "12h" });

// --- 1. REGISTRO ---
router.post("/register", async (req, res) => {
  const { nombre, email, password } = req.body;
  try {
    const { rowCount } = await db.query(
      "SELECT id FROM usuarios WHERE email = $1",
      [email],
    );
    if (rowCount > 0)
      return res.status(400).json({ msg: "El email ya está registrado." });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await db.query(
      "INSERT INTO usuarios (nombre, email, password_hash, rol, modulos_acceso, activo) VALUES ($1, $2, $3, 'SIN ASIGNAR', '[]', false)",
      [nombre, email, passwordHash],
    );
    res.status(201).json({
      msg: "Registro exitoso. Espere a que un administrador active su cuenta.",
    });
  } catch (error) {
    res.status(500).json({ msg: "Error en el servidor al registrar usuario." });
  }
});

// --- 2. LOGIN ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query("SELECT * FROM usuarios WHERE email = $1", [
      email,
    ]);
    const usuario = rows[0];
    if (!usuario)
      return res.status(401).json({ msg: "Credenciales incorrectas." });

    const passwordValida = await bcrypt.compare(
      password,
      usuario.password_hash,
    );
    if (!passwordValida)
      return res.status(401).json({ msg: "Credenciales incorrectas." });
    if (!usuario.activo)
      return res
        .status(403)
        .json({ msg: "Tu cuenta aún no ha sido aprobada por la Gerencia." });

    const token = signToken(usuario.id);
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        modulos: usuario.modulos_acceso,
      },
    });
  } catch (error) {
    res.status(500).json({ msg: "Error en el servidor al iniciar sesión." });
  }
});

router.get("/me", protect, async (req, res) => {
  res.json({ usuario: req.user });
});

// --- 3. ADMIN: VER USUARIOS ---
router.get(
  "/admin/usuarios",
  protect,
  restrictTo("GERENCIA", "JEFE PRODUCCIÓN"),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        "SELECT id, nombre, email, rol, modulos_acceso, activo, to_char(fecha_creacion, 'DD/MM/YYYY') as fecha FROM usuarios ORDER BY id ASC",
      );
      res.json(rows);
    } catch (e) {
      res.status(500).send(e.message);
    }
  },
);

// --- 4. ADMIN: EDITAR USUARIO (¡CORREGIDO: AHORA SÍ GUARDA EL NOMBRE!) ---
router.put(
  "/admin/usuarios/:id",
  protect,
  restrictTo("GERENCIA", "JEFE PRODUCCIÓN"),
  async (req, res) => {
    // 1. Agregamos "nombre" a lo que extraemos del cuerpo de la petición
    const { nombre, activo, rol, modulos_acceso } = req.body;
    try {
      const modulosJSON = JSON.stringify(modulos_acceso);

      // 2. Agregamos "nombre = $1" a la consulta SQL y corremos los índices de los demás
      await db.query(
        "UPDATE usuarios SET nombre = $1, activo = $2, rol = $3, modulos_acceso = $4 WHERE id = $5",
        [nombre, activo, rol, modulosJSON, req.params.id],
      );

      res.json({ success: true, msg: "Perfil actualizado correctamente." });
    } catch (e) {
      res.status(500).send(e.message);
    }
  },
);

// --- 5. ADMIN: ELIMINAR USUARIO ---
router.delete(
  "/admin/usuarios/:id",
  protect,
  restrictTo("GERENCIA", "JEFE PRODUCCIÓN"),
  async (req, res) => {
    try {
      if (req.user.id === parseInt(req.params.id))
        return res.status(400).json({ msg: "No te podés borrar a vos mismo." });
      await db.query("DELETE FROM usuarios WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).send(e.message);
    }
  },
);

// ==========================================
// CATÁLOGO DE PUESTOS / ROLES (CRUD)
// ==========================================
router.get(
  "/admin/puestos",
  protect,
  restrictTo("GERENCIA", "JEFE PRODUCCIÓN"),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        "SELECT * FROM puestos ORDER BY nombre ASC",
      );
      res.json(rows);
    } catch (e) {
      res.status(500).send(e.message);
    }
  },
);

router.post(
  "/admin/puestos",
  protect,
  restrictTo("GERENCIA", "JEFE PRODUCCIÓN"),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        "INSERT INTO puestos (nombre) VALUES ($1) RETURNING *",
        [req.body.nombre.toUpperCase()],
      );
      res.json(rows[0]);
    } catch (e) {
      res.status(500).send(e.message);
    }
  },
);

router.put(
  "/admin/puestos/:id",
  protect,
  restrictTo("GERENCIA", "JEFE PRODUCCIÓN"),
  async (req, res) => {
    const { nombreViejo, nombreNuevo } = req.body;
    const nuevoFormateado = nombreNuevo.toUpperCase();
    try {
      await db.query("UPDATE puestos SET nombre = $1 WHERE id = $2", [
        nuevoFormateado,
        req.params.id,
      ]);
      // Actualizamos automáticamente a todos los usuarios que tenían ese puesto
      await db.query("UPDATE usuarios SET rol = $1 WHERE rol = $2", [
        nuevoFormateado,
        nombreViejo,
      ]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).send(e.message);
    }
  },
);

router.delete(
  "/admin/puestos/:id",
  protect,
  restrictTo("GERENCIA", "JEFE PRODUCCIÓN"),
  async (req, res) => {
    try {
      await db.query("DELETE FROM puestos WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).send(e.message);
    }
  },
);

module.exports = router;
