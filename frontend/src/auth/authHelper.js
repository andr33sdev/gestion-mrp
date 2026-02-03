export const getAuthData = () => {
  // Intentamos recuperar de sessionStorage (pestaña actual)
  // Si no hay nada, intentamos localStorage (persistente)
  const token =
    sessionStorage.getItem("api_key") || localStorage.getItem("api_key");
  const role = sessionStorage.getItem("role") || localStorage.getItem("role");
  return { token, role };
};

export const hasRole = (requiredRole) => {
  const { role } = getAuthData();
  if (role === "GERENCIA") return true;
  return role === requiredRole;
};

export const logout = () => {
  // Limpiamos AMBOS almacenamientos para asegurar el cierre de sesión
  sessionStorage.removeItem("api_key");
  sessionStorage.removeItem("role");
  localStorage.removeItem("api_key");
  localStorage.removeItem("role");

  window.location.href = "/login";
};
