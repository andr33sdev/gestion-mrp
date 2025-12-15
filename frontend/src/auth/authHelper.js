export const getAuthData = () => {
  const token = sessionStorage.getItem("api_key");
  const role = sessionStorage.getItem("role");
  return { token, role };
};

export const hasRole = (requiredRole) => {
  const { role } = getAuthData();
  if (role === "GERENCIA") return true; // Gerencia suele tener acceso a todo
  return role === requiredRole;
};

export const logout = () => {
  sessionStorage.removeItem("api_key");
  sessionStorage.removeItem("role");
  window.location.href = "/login"; // O usar navegación de react-router
};
