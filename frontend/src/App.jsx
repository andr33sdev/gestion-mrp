import { useEffect, useState } from "react";
import {
  FaChartLine,
  FaCogs,
  FaSignOutAlt,
  FaClipboardList,
  FaPlusCircle,
  FaUsersCog,
  FaTruck,
  FaSignInAlt,
  FaUserTie,
  FaHardHat,
  FaBars,
  FaTimes,
  FaBox,
  FaIndustry,
  FaWarehouse,
  FaCalendarAlt, // Importar icono calendario
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
import LogisticaPage from "./pages/LogisticaPage.jsx";
import SolicitudesPage from "./pages/SolicitudesPage";
import RecepcionPage from "./pages/RecepcionPage.jsx";
import HojaDeRutaPage from "./pages/HojaDeRutaPage.jsx"; // Importar Hoja de Ruta

import { API_BASE_URL } from "./utils.js";

export default function App() {
  const [page, setPage] = useState(window.location.pathname);
  const [loginTarget, setLoginTarget] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estados de autenticación
  const [isAuthPanel, setIsAuthPanel] = useState(
    !!sessionStorage.getItem("api_key") &&
      sessionStorage.getItem("role") === "PANEL"
  );
  const [isAuthGerencia, setIsAuthGerencia] = useState(
    !!sessionStorage.getItem("api_key") &&
      sessionStorage.getItem("role") === "GERENCIA"
  );
  const [isAuthDeposito, setIsAuthDeposito] = useState(
    !!sessionStorage.getItem("api_key") &&
      sessionStorage.getItem("role") === "DEPOSITO"
  );

  // Lógica de permisos combinada
  const isLoggedAny = isAuthPanel || isAuthGerencia || isAuthDeposito;
  const canAccessShared = isAuthPanel || isAuthGerencia; // Operario + Gerencia
  const canAccessGerencia = isAuthGerencia;
  const canAccessDeposito = isAuthDeposito || isAuthGerencia; // Deposito + Gerencia

  useEffect(() => {
    const key = sessionStorage.getItem("api_key");
    const role = sessionStorage.getItem("role");
    if (key && role === "PANEL") setIsAuthPanel(true);
    if (key && role === "GERENCIA") setIsAuthGerencia(true);
    if (key && role === "DEPOSITO") setIsAuthDeposito(true);
  }, []);

  useEffect(() => {
    const onLocationChange = () => setPage(window.location.pathname);
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  // Redirección de seguridad
  useEffect(() => {
    if (page === "/" && !isLoggedAny) {
      navigate("/login");
    }
  }, [page, isLoggedAny]);

  useEffect(() => {
    setLoginTarget(null);
    setMobileMenuOpen(false);
  }, [page]);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setPage(path);
  };

  const handleLogin = async (password, roleTarget) => {
    try {
      const res = await fetch(`${API_BASE_URL}/`, {
        headers: { "x-api-key": password },
      });

      if (res.ok) {
        const data = await res.json();
        const realRole = data.role;

        // Validación estricta
        if (realRole !== roleTarget) {
          return false;
        }

        sessionStorage.setItem("api_key", password);
        sessionStorage.setItem("role", realRole);

        if (realRole === "PANEL") setIsAuthPanel(true);
        if (realRole === "GERENCIA") setIsAuthGerencia(true);
        if (realRole === "DEPOSITO") setIsAuthDeposito(true);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.error("Error de conexión", err);
      return false;
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("api_key");
    sessionStorage.removeItem("role");
    setIsAuthPanel(false);
    setIsAuthGerencia(false);
    setIsAuthDeposito(false);
    navigate("/login");
  };

  // --- MENÚ DE NAVEGACIÓN ---
  const navLinks = [
    {
      path: "/planificacion",
      label: "Planif.",
      icon: <FaClipboardList />,
      show: canAccessShared,
    },
    {
      path: "/registrar-produccion",
      label: "Producir",
      icon: <FaPlusCircle />,
      show: canAccessShared,
    },
    {
      path: "/operarios",
      label: "Personal",
      icon: <FaUsersCog />,
      show: canAccessShared,
    },

    {
      path: "/analisis-pedidos",
      label: "Análisis",
      icon: <FaChartLine />,
      show: canAccessGerencia,
    },
    {
      path: "/logistica",
      label: "Logística",
      icon: <FaTruck />,
      show: canAccessGerencia,
    },

    // --- SECCIÓN NUEVA: HOJA DE RUTA ---
    {
      path: "/hoja-de-ruta",
      label: "Hoja Ruta",
      icon: <FaCalendarAlt />,
      show: canAccessGerencia,
    },

    {
      path: "/ingenieria",
      label: "Ingeniería",
      icon: <FaCogs />,
      show: canAccessGerencia,
    },
    {
      path: "/compras",
      label: "Compras",
      icon: <FaBox />,
      show: canAccessGerencia,
    },

    // NOTA: El botón de RECEPCIÓN se eliminó del menú principal como pediste.
    // La ruta sigue accesible directamentes o al loguearse como DEPOSITO.
  ];

  // --- RENDERIZADO DE COMPONENTES ---
  let component;

  // 1. LOGIN
  if (page === "/login") {
    if (loginTarget) {
      component = (
        <div className="relative pt-20">
          <button
            onClick={() => setLoginTarget(null)}
            className="absolute top-24 left-4 text-gray-400 hover:text-white text-sm underline"
          >
            ← Volver
          </button>
          <LoginPage
            onLoginAttempt={async (pass) => {
              const success = await handleLogin(pass, loginTarget);
              if (success) {
                // Redirección inteligente según rol
                if (loginTarget === "DEPOSITO") navigate("/recepcion");
                else navigate("/");
              }
              return success;
            }}
            title={`Acceso ${loginTarget}`}
          />
        </div>
      );
    } else {
      component = (
        <div className="flex flex-col items-center justify-center min-h-[80vh] animate-in fade-in zoom-in duration-500 pt-10">
          <h2 className="text-4xl font-bold text-white mb-12 drop-shadow-lg text-center">
            Seleccione su Perfil
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
            <button
              onClick={() => setLoginTarget("PANEL")}
              className="group bg-slate-800 hover:bg-blue-600 border-2 border-slate-700 hover:border-blue-500 p-8 rounded-3xl transition-all shadow-2xl flex flex-col items-center gap-4 w-full md:w-60 transform hover:-translate-y-2"
            >
              <FaHardHat className="text-6xl text-blue-400 group-hover:text-white transition-colors" />
              <span className="text-xl font-bold text-white">Operario</span>
            </button>

            <button
              onClick={() => setLoginTarget("DEPOSITO")}
              className="group bg-slate-800 hover:bg-orange-600 border-2 border-slate-700 hover:border-orange-500 p-8 rounded-3xl transition-all shadow-2xl flex flex-col items-center gap-4 w-full md:w-60 transform hover:-translate-y-2"
            >
              <FaWarehouse className="text-6xl text-orange-400 group-hover:text-white transition-colors" />
              <span className="text-xl font-bold text-white">Depósito</span>
            </button>

            <button
              onClick={() => setLoginTarget("GERENCIA")}
              className="group bg-slate-800 hover:bg-purple-600 border-2 border-slate-700 hover:border-purple-500 p-8 rounded-3xl transition-all shadow-2xl flex flex-col items-center gap-4 w-full md:w-60 transform hover:-translate-y-2"
            >
              <FaUserTie className="text-6xl text-purple-400 group-hover:text-white transition-colors" />
              <span className="text-xl font-bold text-white">Gerencia</span>
            </button>
          </div>
        </div>
      );
    }
  }

  // 2. RUTAS OPERATIVAS
  else if (page === "/panel-control") {
    component = canAccessShared ? (
      <PanelControl onNavigate={navigate} />
    ) : (
      <LoginPage
        onLoginAttempt={(pass) => handleLogin(pass, "PANEL")}
        title="Acceso Requerido"
      />
    );
  } else if (page === "/registrar-produccion") {
    component = canAccessShared ? (
      <RegistrarProduccionPage />
    ) : (
      <LoginPage
        onLoginAttempt={(pass) => handleLogin(pass, "PANEL")}
        title="Acceso Requerido"
      />
    );
  }

  // 3. RUTA RECEPCIÓN (Oculta del menú, pero accesible)
  else if (page === "/recepcion") {
    component = canAccessDeposito ? (
      <RecepcionPage onNavigate={navigate} />
    ) : (
      <LoginPage
        onLoginAttempt={(pass) => handleLogin(pass, "DEPOSITO")}
        title="Acceso Depósito"
      />
    );
  }

  // 4. NUEVA RUTA: HOJA DE RUTA (CALENDARIO)
  else if (page === "/hoja-de-ruta") {
    component = canAccessGerencia ? (
      <HojaDeRutaPage onNavigate={navigate} />
    ) : (
      <LoginPage
        onLoginAttempt={(pass) => handleLogin(pass, "GERENCIA")}
        title="Acceso Gerencia"
      />
    );
  }

  // 5. RUTAS MIXTAS Y GERENCIA
  else if (
    [
      "/analisis-pedidos",
      "/planificacion",
      "/ingenieria",
      "/operarios",
      "/logistica",
      "/compras",
    ].includes(page)
  ) {
    const PageComp = {
      "/analisis-pedidos": AnalisisPedidos,
      "/planificacion": PlanificacionPage,
      "/ingenieria": IngenieriaProductos,
      "/operarios": OperariosPage,
      "/logistica": LogisticaPage,
      "/compras": SolicitudesPage,
    }[page];

    const isSharedRoute = ["/planificacion", "/operarios"].includes(page);
    const hasAccess = isSharedRoute ? canAccessShared : canAccessGerencia;
    const requiredRole = isSharedRoute ? "PANEL" : "GERENCIA";

    component = hasAccess ? (
      <PageComp onNavigate={navigate} />
    ) : (
      <LoginPage
        onLoginAttempt={(pass) => handleLogin(pass, requiredRole)}
        title="Acceso Requerido"
      />
    );
  }

  // 6. DASHBOARD (Solo logueados)
  else {
    if (isLoggedAny) {
      component = <Dashboard onNavigate={navigate} />;
    } else {
      component = null; // Redirección en useEffect
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-blue-500 selection:text-white">
      {isLoggedAny && (
        <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-700 z-[1000] px-4 shadow-lg">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg">
                <FaIndustry className="text-white text-lg" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight hidden md:block">
                Gestión MRP
              </span>
            </div>

            <nav className="hidden lg:flex items-center gap-1 bg-slate-800/50 p-1 rounded-full border border-slate-700/50 ml-4">
              {navLinks
                .filter((l) => l.show)
                .map((link) => (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      page === link.path
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-400 hover:text-white hover:bg-slate-700"
                    }`}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </button>
                ))}
            </nav>

            <div className="flex items-center gap-3">
              <div
                className={`hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg border ${
                  isAuthGerencia
                    ? "bg-purple-900/20 border-purple-500/30 text-purple-200"
                    : isAuthDeposito
                    ? "bg-orange-900/20 border-orange-500/30 text-orange-200"
                    : "bg-blue-900/20 border-blue-500/30 text-blue-200"
                }`}
              >
                {isAuthGerencia ? (
                  <FaUserTie />
                ) : isAuthDeposito ? (
                  <FaWarehouse />
                ) : (
                  <FaHardHat />
                )}
                <span className="text-xs font-bold tracking-wider">
                  {isAuthGerencia
                    ? "GERENCIA"
                    : isAuthDeposito
                    ? "DEPÓSITO"
                    : "OPERARIO"}
                </span>
                <button
                  onClick={handleLogout}
                  className="ml-2 text-gray-400 hover:text-white transition-colors"
                  title="Salir"
                >
                  <FaSignOutAlt />
                </button>
              </div>

              <button
                className="lg:hidden p-2 text-gray-300 hover:text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
              </button>
            </div>
          </div>
        </header>
      )}

      {mobileMenuOpen && isLoggedAny && (
        <div className="fixed inset-0 z-[900] bg-slate-900/95 backdrop-blur-xl pt-20 px-6 animate-in slide-in-from-top-10 duration-200 lg:hidden">
          <div className="flex flex-col gap-2">
            <div
              className={`flex items-center justify-between p-4 rounded-xl border mb-4 ${
                isAuthGerencia
                  ? "bg-purple-900/20 border-purple-500 text-purple-200"
                  : isAuthDeposito
                  ? "bg-orange-900/20 border-orange-500 text-orange-200"
                  : "bg-blue-900/20 border-blue-500 text-blue-200"
              }`}
            >
              <div className="flex items-center gap-3">
                {isAuthGerencia ? (
                  <FaUserTie size={20} />
                ) : isAuthDeposito ? (
                  <FaWarehouse size={20} />
                ) : (
                  <FaHardHat size={20} />
                )}
                <span className="font-bold">
                  {isAuthGerencia
                    ? "GERENCIA"
                    : isAuthDeposito
                    ? "DEPÓSITO"
                    : "OPERARIO"}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm underline opacity-80"
              >
                Cerrar Sesión
              </button>
            </div>
            {navLinks
              .filter((l) => l.show)
              .map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`flex items-center gap-4 p-4 rounded-xl text-lg font-medium transition-all ${
                    page === link.path
                      ? "bg-slate-800 text-white border border-slate-600"
                      : "text-gray-400 hover:bg-slate-800/50 hover:text-white"
                  }`}
                >
                  <span className="text-xl">{link.icon}</span>
                  {link.label}
                </button>
              ))}
          </div>
        </div>
      )}

      <div
        className={`px-4 md:px-8 max-w-7xl mx-auto ${
          isLoggedAny ? "pt-24 pb-10" : ""
        }`}
      >
        {component}
      </div>
    </div>
  );
}
