// authHelper.js

export const getAuthData = () => {
  // Ahora buscamos las credenciales seguras que guardó el nuevo LoginPage
  const token = localStorage.getItem("mrp_token");

  let user = null;
  try {
    const userStr = localStorage.getItem("mrp_user");
    if (userStr) {
      user = JSON.parse(userStr);
    }
  } catch (e) {
    console.error("Error leyendo datos del usuario", e);
  }

  // Retornamos el token y los datos del usuario logueado
  return { token, user };
};

export const logout = () => {
  // Borramos todo rastro de la sesión
  localStorage.removeItem("mrp_token");
  localStorage.removeItem("mrp_user");

  // Lo mandamos al login
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

// Saber si tiene acceso a un módulo (Para la Fase 3)
export const hasModuleAccess = (moduloRequerido) => {
  const { user } = getAuthData();
  if (!user) return false;

  // La gerencia tiene acceso a todo
  if (
    user.rol === "GERENCIA" ||
    (user.modulos && user.modulos.includes("TODOS"))
  ) {
    return true;
  }

  return user.modulos && user.modulos.includes(moduloRequerido);
};

// --- LA FUNCIÓN QUE FALTABA PARA QUE NO SE ROMPA PLANIFICACIÓN ---
export const hasRole = (rolRequerido) => {
  const { user } = getAuthData();
  if (!user) return false;

  // Si a la función le pasaban un array de roles (ej: ["GERENCIA", "ADMIN"])
  if (Array.isArray(rolRequerido)) {
    return rolRequerido.includes(user.rol);
  }

  // Si le pasaban un rol específico en texto, o si es la Gerencia (que puede hacer todo)
  return user.rol === rolRequerido || user.rol === "GERENCIA";
};
