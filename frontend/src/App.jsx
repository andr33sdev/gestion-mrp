import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  FaChartLine,
  FaCogs,
  FaSignOutAlt,
  FaClipboardList,
  FaPlusCircle,
  FaUsersCog,
  FaTruck,
  FaUserTie,
  FaHardHat,
  FaBars,
  FaTimes,
  FaBox,
  FaIndustry,
  FaWarehouse,
  FaCalendarAlt,
  FaTools,
  FaChevronRight,
  FaChevronLeft,
  FaUserClock, // <--- 1. IMPORTAMOS EL ÍCONO NUEVO
} from "react-icons/fa";

// Importación de Páginas
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
import HojaDeRutaPage from "./pages/HojaDeRutaPage.jsx";
import CentroComando from "./pages/CentroComando";
import MantenimientoPage from "./pages/MantenimientoPage";
import RRHHPage from "./pages/RRHHPage"; // <--- 2. IMPORTAMOS LA PÁGINA NUEVA

// Componentes Globales
import ChatGerencia from "./components/ChatGerencia";
import { getAuthData, hasRole, logout } from "./auth/authHelper";

// --- CONFIGURACIÓN DEL MENÚ ---
const NAV_LINKS = [
  {
    path: "/",
    label: "Dashboard Vivo",
    icon: <FaChartLine />,
    roles: ["GERENCIA", "PANEL", "MANTENIMIENTO", "OPERARIO"],
  },
  {
    path: "/planificacion",
    label: "Planificación",
    icon: <FaClipboardList />,
    roles: ["GERENCIA", "PANEL"],
  },
  {
    path: "/calendario",
    label: "Centro Comando",
    icon: <FaIndustry />,
    roles: ["GERENCIA"],
  },
  {
    path: "/registrar-produccion",
    label: "Registrar Prod.",
    icon: <FaPlusCircle />,
    roles: ["GERENCIA", "PANEL", "OPERARIO"],
  },
  {
    path: "/panel-control",
    label: "Control Hornos",
    icon: <FaCogs />,
    roles: ["GERENCIA", "PANEL"],
  },
  {
    path: "/operarios",
    label: "Personal",
    icon: <FaUsersCog />,
    roles: ["GERENCIA", "PANEL"],
  },
  {
    path: "/rrhh", // <--- 3. AGREGAMOS EL LINK EN EL MENÚ LATERAL
    label: "RRHH / Asistencia",
    icon: <FaUserClock />,
    roles: ["GERENCIA"],
  },
  {
    path: "/mantenimiento",
    label: "Mantenimiento",
    icon: <FaTools />,
    // AQUI AGREGAMOS "PANEL" ADEMÁS DE "OPERARIO" PARA ASEGURARNOS
    roles: ["GERENCIA", "MANTENIMIENTO", "OPERARIO", "PANEL"],
  },
  {
    path: "/analisis-pedidos",
    label: "Inteligencia",
    icon: <FaChartLine />,
    roles: ["GERENCIA"],
  },
  {
    path: "/logistica",
    label: "Solicitudes Internas",
    icon: <FaTruck />,
    roles: ["DEPOSITO", "GERENCIA", "OPERARIO", "PANEL"],
  },
  {
    path: "/hoja-de-ruta",
    label: "Hoja de Ruta",
    icon: <FaCalendarAlt />,
    roles: ["GERENCIA"],
  },
  {
    path: "/ingenieria",
    label: "Ingeniería",
    icon: <FaCogs />,
    roles: ["GERENCIA"],
  },
  {
    path: "/compras",
    label: "Compras",
    icon: <FaBox />,
    roles: ["GERENCIA"],
  },
  {
    path: "/recepcion",
    label: "Recepción",
    icon: <FaWarehouse />,
    roles: ["GERENCIA"],
  },
];

// --- COMPONENTE: RUTA PROTEGIDA ---
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { token, role } = getAuthData();

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role) && role !== "GERENCIA") {
    return <Navigate to="/" replace />;
  }

  return children;
};

// --- HELPER: LOGO COMPARTIDO ---
const Logo = ({ subtext = "v2.5 PRO", showText = true }) => (
  <div className="flex items-center gap-3">
    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-lg">
      <FaIndustry className="text-white text-lg" />
    </div>
    {showText && (
      <div className="leading-none">
        <h1 className="text-lg font-bold text-white tracking-tight">
          Gestión MRP
        </h1>
        <p className="text-[10px] text-gray-500 font-mono mt-0.5">{subtext}</p>
      </div>
    )}
  </div>
);

// --- COMPONENTE 1: SIDEBAR ESCRITORIO (IZQUIERDA) ---
const DesktopSidebar = ({
  links,
  isCollapsed,
  setIsCollapsed,
  handleLogout,
  userBadge,
}) => {
  const location = useLocation();
  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-300 relative ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* BOTÓN SOLAPA */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 z-50 w-6 h-6 rounded-full bg-slate-900 text-gray-400 hover:text-white border border-slate-700 shadow-lg flex items-center justify-center transition-colors hover:border-blue-500 hover:bg-slate-800"
      >
        {isCollapsed ? (
          <FaChevronRight size={10} />
        ) : (
          <FaChevronLeft size={10} />
        )}
      </button>

      {/* HEADER */}
      <div
        className={`h-16 flex items-center ${
          isCollapsed ? "justify-center" : "px-6"
        } border-b border-slate-800`}
      >
        <Logo showText={!isCollapsed} />
      </div>

      {/* NAV */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
        {!isCollapsed && (
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">
            Navegación
          </div>
        )}
        {links.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              title={isCollapsed ? link.label : ""}
              className={`group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20 font-bold"
                  : "text-gray-400 hover:bg-slate-800 hover:text-white"
              } ${isCollapsed ? "justify-center" : ""}`}
            >
              <span className="text-xl">{link.icon}</span>
              {!isCollapsed && (
                <span className="flex-1 truncate">{link.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div
          className={`flex items-center gap-3 mb-3 ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <div
            className={`p-2 rounded-lg bg-slate-800 border border-slate-700 ${userBadge.color}`}
          >
            {userBadge.icon}
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="text-xs text-gray-500 font-bold uppercase">
                Perfil
              </p>
              <p className="text-sm font-bold text-white truncate">
                {userBadge.text}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 py-2 rounded-lg text-xs font-bold transition-all border border-slate-700 hover:border-red-900/50 ${
            isCollapsed ? "px-0" : "px-4"
          }`}
          title="Cerrar Sesión"
        >
          <FaSignOutAlt size={16} /> {!isCollapsed && "SALIR"}
        </button>
      </div>
    </aside>
  );
};

// --- COMPONENTE 2: MENÚ MÓVIL (DRAWER DESLIZANTE) ---
const MobileMenu = ({ isOpen, onClose, links, handleLogout, userBadge }) => {
  const location = useLocation();
  return (
    <>
      {/* Backdrop oscuro */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`fixed inset-y-0 left-0 z-[70] w-72 bg-slate-900 border-r border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header Móvil */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900">
          <Logo />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* User Card Móvil */}
        <div className="p-4 bg-slate-800/50 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-full border bg-slate-800 ${userBadge.color} border-slate-700`}
            >
              {userBadge.icon}
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase">
                Sesión activa
              </p>
              <p className="text-sm font-bold text-white">{userBadge.text}</p>
            </div>
          </div>
        </div>

        {/* Links Móvil */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {links.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={onClose}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-blue-600 text-white font-bold shadow-lg"
                    : "text-gray-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="text-xl opacity-80">{link.icon}</span>
                <span className="text-sm">{link.label}</span>
                {isActive && (
                  <FaChevronRight className="ml-auto text-xs opacity-60" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Móvil */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-900/20 text-red-400 hover:bg-red-900/30 py-3 rounded-xl text-sm font-bold transition-all border border-red-900/30"
          >
            <FaSignOutAlt /> Cerrar Sesión
          </button>
        </div>
      </div>
    </>
  );
};

// --- COMPONENTE: LAYOUT PRINCIPAL ---
const Layout = ({ children }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Estado Móvil
  const [isCollapsed, setIsCollapsed] = useState(false); // Estado Escritorio

  const { role } = getAuthData();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Configuración del Badge de Usuario
  let userBadge = {
    icon: <FaHardHat />,
    text: "OPERARIO",
    color: "text-blue-400",
  };
  if (role === "GERENCIA")
    userBadge = {
      icon: <FaUserTie />,
      text: "GERENCIA",
      color: "text-purple-400",
    };
  else if (role === "DEPOSITO")
    userBadge = {
      icon: <FaWarehouse />,
      text: "DEPÓSITO",
      color: "text-orange-400",
    };
  else if (role === "MANTENIMIENTO")
    userBadge = { icon: <FaTools />, text: "TÉCNICO", color: "text-red-400" };

  // Filtrar links permitidos
  const allowedLinks = NAV_LINKS.filter((link) => {
    // Normalizamos el rol a mayúsculas y sin espacios por si acaso
    const currentRole = role ? role.toString().trim().toUpperCase() : "";

    // Si es Gerencia ve todo, si no, buscamos en el array
    return currentRole === "GERENCIA" || link.roles.includes(currentRole);
  });

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden selection:bg-blue-500 selection:text-white">
      {/* 1. SIDEBAR DE ESCRITORIO (Fijo) */}
      <DesktopSidebar
        links={allowedLinks}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        handleLogout={handleLogout}
        userBadge={userBadge}
      />

      {/* 2. MENÚ MÓVIL (Off-canvas) */}
      <MobileMenu
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        links={allowedLinks}
        handleLogout={handleLogout}
        userBadge={userBadge}
      />

      {/* 3. ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-950 relative">
        {/* HEADER MÓVIL (Solo visible en LG y menor) */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 lg:hidden shrink-0 z-30 shadow-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-300 hover:text-white bg-slate-800 rounded-lg border border-slate-700 active:bg-slate-700"
            >
              <FaBars size={20} />
            </button>
            <span className="font-bold text-white text-lg">Gestión MRP</span>
          </div>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-slate-600 bg-slate-800 ${userBadge.color}`}
          >
            {userBadge.icon}
          </div>
        </header>

        {/* CONTENIDO SCROLLABLE */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
          <div className="max-w-[1600px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

// --- APP ---
export default function App() {
  const isAuthGerencia = sessionStorage.getItem("role") === "GERENCIA";

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas Privadas */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                {/* 2. PERO... Si es DEPOSITO, lo redirigimos forzosamente a Logística */}
                {getAuthData().role === "DEPOSITO" ? (
                  <Navigate to="/logistica" replace />
                ) : (
                  <Dashboard />
                )}
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Rutas Específicas */}
        <Route
          path="/panel-control"
          element={
            <ProtectedRoute allowedRoles={["PANEL", "GERENCIA"]}>
              <Layout>
                <PanelControl />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/registrar-produccion"
          element={
            <ProtectedRoute allowedRoles={["PANEL", "GERENCIA", "OPERARIO"]}>
              <Layout>
                <RegistrarProduccionPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/recepcion"
          element={
            <ProtectedRoute allowedRoles={["GERENCIA"]}>
              <Layout>
                <RecepcionPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* MODIFICADO: MANTENIMIENTO ACCESIBLE A OPERARIOS Y PANEL */}
        <Route
          path="/mantenimiento"
          element={
            <ProtectedRoute
              allowedRoles={["MANTENIMIENTO", "GERENCIA", "OPERARIO", "PANEL"]}
            >
              <Layout>
                <MantenimientoPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/planificacion"
          element={
            <ProtectedRoute allowedRoles={["PANEL", "GERENCIA"]}>
              <Layout>
                <PlanificacionPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/operarios"
          element={
            <ProtectedRoute allowedRoles={["PANEL", "GERENCIA"]}>
              <Layout>
                <OperariosPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Rutas Gerencia */}
        <Route
          path="/analisis-pedidos"
          element={
            <ProtectedRoute allowedRoles={["GERENCIA"]}>
              <Layout>
                <AnalisisPedidos />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/logistica"
          element={
            <ProtectedRoute
              allowedRoles={["DEPOSITO", "GERENCIA", "OPERARIO", "PANEL"]}
            >
              <Layout>
                <LogisticaPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hoja-de-ruta"
          element={
            <ProtectedRoute allowedRoles={["GERENCIA"]}>
              <Layout>
                <HojaDeRutaPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendario"
          element={
            <ProtectedRoute allowedRoles={["GERENCIA"]}>
              <Layout>
                <CentroComando />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ingenieria"
          element={
            <ProtectedRoute allowedRoles={["GERENCIA"]}>
              <Layout>
                <IngenieriaProductos />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/compras"
          element={
            <ProtectedRoute allowedRoles={["GERENCIA"]}>
              <Layout>
                <SolicitudesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/rrhh" // <--- 4. AGREGAMOS LA RUTA PROTEGIDA
          element={
            <ProtectedRoute allowedRoles={["GERENCIA"]}>
              <Layout>
                <RRHHPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {isAuthGerencia && <ChatGerencia />}
    </BrowserRouter>
  );
}
