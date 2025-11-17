import { useEffect, useState } from "react";
import {
  FaHome,
  FaChartLine,
  FaCogs,
  FaSignOutAlt,
  FaLock,
  FaKey,
  FaClipboardList,
  FaPlusCircle,
  FaUsersCog,
} from "react-icons/fa";

// Importa las páginas
import Dashboard from "./pages/Dashboard.jsx";
import PanelControl from "./pages/PanelControl.jsx";
import IngenieriaProductos from "./pages/IngenieriaProductos.jsx";
import AnalisisPedidos from "./pages/AnalisisPedidos.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PlanificacionPage from "./pages/PlanificacionPage.jsx";
import RegistrarProduccionPage from "./pages/RegistrarProduccionPage.jsx";
import OperariosPage from "./pages/OperariosPage.jsx";

// Importa las contraseñas
import { PASS_PANEL, PASS_GERENCIA } from "./utils.js";

export default function App() {
  const [page, setPage] = useState(window.location.pathname);

  // --- DOBLE ESTADO DE AUTENTICACIÓN ---
  const [isAuthPanel, setIsAuthPanel] = useState(
    sessionStorage.getItem("auth_panel") === "true"
  );
  const [isAuthGerencia, setIsAuthGerencia] = useState(
    sessionStorage.getItem("auth_gerencia") === "true"
  );

  useEffect(() => {
    const onLocationChange = () => setPage(window.location.pathname);
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setPage(path);
  };

  // Login Handlers Específicos
  const loginPanel = () => {
    sessionStorage.setItem("auth_panel", "true");
    setIsAuthPanel(true);
  };
  const loginGerencia = () => {
    sessionStorage.setItem("auth_gerencia", "true");
    setIsAuthGerencia(true);
  };

  // Logout Global (Limpia todo)
  const handleLogout = () => {
    sessionStorage.removeItem("auth_panel");
    sessionStorage.removeItem("auth_gerencia");
    setIsAuthPanel(false);
    setIsAuthGerencia(false);
    navigate("/");
  };

  // --- Lógica de Ruteo ---
  let component;
  if (page === "/panel-control") {
    component = isAuthPanel ? (
      <PanelControl onNavigate={navigate} />
    ) : (
      <LoginPage
        onLoginSuccess={loginPanel}
        expectedPassword={PASS_PANEL}
        title="Acceso Operario"
      />
    );
  } else if (page === "/registrar-produccion") {
    component = isAuthPanel ? ( // Protegida con clave de Operario
      <RegistrarProduccionPage />
    ) : (
      <LoginPage
        onLoginSuccess={loginPanel}
        expectedPassword={PASS_PANEL}
        title="Acceso Operario"
      />
    );
  } else if (page === "/analisis-pedidos") {
    component = isAuthGerencia ? (
      <AnalisisPedidos />
    ) : (
      <LoginPage
        onLoginSuccess={loginGerencia}
        expectedPassword={PASS_GERENCIA}
        title="Acceso Gerencia"
      />
    );
  } else if (page === "/planificacion") {
    component = isAuthGerencia ? ( // <--- Protegida con la misma clave de Gerencia
      <PlanificacionPage />
    ) : (
      <LoginPage
        onLoginSuccess={loginGerencia}
        expectedPassword={PASS_GERENCIA}
        title="Acceso Gerencia"
      />
    );
  } else if (page === "/ingenieria") {
    component = isAuthGerencia ? (
      <IngenieriaProductos />
    ) : (
      <LoginPage
        onLoginSuccess={loginGerencia}
        expectedPassword={PASS_GERENCIA}
        title="Acceso Gerencia"
      />
    );
  } else if (page === "/operarios") {
    component = isAuthGerencia ? (
      <OperariosPage />
    ) : (
      <LoginPage
        onLoginSuccess={loginGerencia}
        expectedPassword={PASS_GERENCIA}
        title="Acceso Gerencia"
      />
    );
  } else {
    // Por defecto (ruta "/") muestra el Dashboard
    component = <Dashboard onNavigate={navigate} />;
  }

  // Lógica para resaltar el botón
  const isHornos = page === "/" || page === "/panel-control";

  const getBtnClass = (path) => {
    if (path === "/" && isHornos)
      return "bg-slate-600 text-white scale-105 shadow-lg ring-1 ring-slate-500";
    if (page === path)
      return "bg-slate-600 text-white scale-105 shadow-lg ring-1 ring-slate-500";
    return "text-gray-400 hover:text-white hover:bg-slate-800";
  };
  const btnBase =
    "flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all";
  const isLoggedAny = isAuthPanel || isAuthGerencia;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8 font-sans selection:bg-blue-500 selection:text-white">
      <div className="max-w-7xl mx-auto">
        <nav className="flex flex-wrap justify-center items-center gap-3 mb-8 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md sticky top-4 z-50">
          {/* --- ORDEN CAMBIADO --- */}
          <button
            onClick={() => navigate("/")}
            className={`${btnBase} ${getBtnClass("/")}`}
          >
            <FaHome /> Hornos
          </button>

          <button
            onClick={() => navigate("/analisis-pedidos")}
            className={`${btnBase} ${getBtnClass("/analisis-pedidos")}`}
          >
            <FaChartLine /> Análisis
          </button>

          <button
            onClick={() => navigate("/planificacion")}
            className={`${btnBase} ${getBtnClass("/planificacion")}`}
          >
            <FaClipboardList /> Planificación
          </button>

          <button
            onClick={() => navigate("/registrar-produccion")}
            className={`${btnBase} ${getBtnClass("/registrar-produccion")}`}
          >
            <FaPlusCircle /> Registrar Producción
          </button>
          <button
            onClick={() => navigate("/operarios")}
            className={`${btnBase} ${getBtnClass("/operarios")}`}
          >
            <FaUsersCog /> Operarios
          </button>
          <button
            onClick={() => navigate("/ingenieria")}
            className={`${btnBase} ${getBtnClass("/ingenieria")}`}
          >
            <FaCogs /> Ingeniería
          </button>
          {/* --- FIN DEL ORDEN --- */}

          {isLoggedAny && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-red-400 hover:text-red-200 hover:bg-red-900/20 transition-all border border-red-900/30 ml-auto"
            >
              <FaSignOutAlt /> Salir
            </button>
          )}
        </nav>
        {component}
      </div>
    </div>
  );
}
