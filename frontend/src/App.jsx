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
  FaChartPie,
  FaSignOutAlt,
  FaClipboardList,
  FaPlus,
  FaUsers,
  FaTruck,
  FaUserTie,
  FaHardHat,
  FaBars,
  FaTimes,
  FaWarehouse,
  FaCalendarAlt,
  FaTools,
  FaChevronRight,
  FaChevronLeft,
  FaBoxOpen,
  FaClipboardCheck,
  FaChartBar,
  FaUserShield,
  FaUserLock,
  FaMapMarkedAlt,
  FaLocationArrow,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";

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
import HojaDeRutaPage from "./pages/HojaDeRutaPage.jsx";
import CentroComando from "./pages/CentroComando";
import MantenimientoPage from "./pages/MantenimientoPage";
import RRHHPage from "./pages/RRHHPage";
import ChangelogPage from "./pages/ChangelogPage";
import DetalleProducto from "./pages/DetalleProducto";
import DepositoPage from "./pages/DepositoPage.jsx";
import DepositoDespacho from "./pages/DepositoDespacho.jsx";
import SugerenciasPage from "./pages/SugerenciasPage.jsx";
import GestorUsuarios from "./pages/GestorUsuarios.jsx";
import TransmisorUbicacion from "./pages/TransmisorUbicacion";
import MapaRastreo from "./pages/MapaRastreo";

import { getAuthData, logout } from "./auth/authHelper";

// --- CONFIGURACIÓN DEL MENÚ BASADO EN MÓDULOS ---
const NAV_LINKS = [
  { path: "/", label: "Inicio", icon: <FaChartPie />, moduloReq: "INICIO" },
  {
    path: "/analisis-pedidos",
    label: "Métricas",
    icon: <FaChartBar />,
    moduloReq: "METRICAS",
  },
  {
    path: "/planificacion",
    label: "Planificación",
    icon: <FaClipboardList />,
    moduloReq: "PLANIFICACION",
  },
  {
    path: "/registrar-produccion",
    label: "Registrar",
    icon: <FaPlus />,
    moduloReq: "REGISTRO",
  },
  {
    path: "/logistica",
    label: "Logística",
    icon: <FaTruck />,
    moduloReq: "LOGISTICA",
  },
  {
    path: "/deposito-despacho",
    label: "Despacho",
    icon: <FaBoxOpen />,
    moduloReq: "DESPACHO",
  },
  {
    path: "/deposito-3d",
    label: "Stock Iglú",
    icon: <FaWarehouse />,
    moduloReq: "STOCK",
  },
  {
    path: "/sugerencias",
    label: "Buzón Compras",
    icon: <FaClipboardCheck />,
    moduloReq: "COMPRAS",
  },
  {
    path: "/operarios",
    label: "Equipo",
    icon: <FaUsers />,
    moduloReq: "EQUIPO",
  },
  {
    path: "/hoja-de-ruta",
    label: "Hoja de Ruta",
    icon: <FaCalendarAlt />,
    moduloReq: "HOJA_RUTA",
  },
  {
    path: "/ingenieria",
    label: "Ingeniería",
    icon: <FaTools />,
    moduloReq: "INGENIERIA",
  },
  { path: "/rrhh", label: "RRHH", icon: <FaUserTie />, moduloReq: "RRHH" },
  {
    path: "/mantenimiento",
    label: "Mantenimiento",
    icon: <FaHardHat />,
    moduloReq: "MANTENIMIENTO",
  },
  // El menú de Accesos no tiene moduloReq porque solo lo ve la Gerencia por código
  {
    path: "/usuarios",
    label: "Accesos",
    icon: <FaUserShield />,
    moduloReq: "ACCESOS_ADMIN",
  },
  {
    path: "/mapa",
    label: "Mapa Flota",
    icon: <FaMapMarkedAlt />,
    moduloReq: "LOGISTICA",
  },
  {
    path: "/transmitir",
    label: "Mi Radar",
    icon: <FaLocationArrow />,
    moduloReq: "HOJA_RUTA",
  },
];

// --- RUTAS PROTEGIDAS CON REVISIÓN DE MÓDULO INTELIGENTE ---
const ProtectedRoute = ({ children, requiredModule }) => {
  const { token, user } = getAuthData();
  const location = useLocation();

  if (!token || !user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  // La gerencia y la jefatura pasan a todos lados sin importar los módulos
  if (user.rol === "GERENCIA" || user.rol === "JEFE PRODUCCIÓN")
    return children;

  // Si la ruta requiere un módulo y el usuario no lo tiene:
  if (
    requiredModule &&
    (!user.modulos || !user.modulos.includes(requiredModule))
  ) {
    // 1. Buscamos cuál es el primer módulo del menú al que SÍ tiene acceso
    const primerEnlacePermitido = NAV_LINKS.find((link) =>
      user.modulos?.includes(link.moduloReq),
    );

    // 2. Si le encontramos uno, lo mandamos directo para ahí (evita el bucle y la pantalla blanca)
    if (
      primerEnlacePermitido &&
      location.pathname !== primerEnlacePermitido.path
    ) {
      return <Navigate to={primerEnlacePermitido.path} replace />;
    }

    // 3. Si por algún motivo no tiene NINGÚN permiso asignado en todo el sistema:
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f8fafc] text-slate-500 flex-col gap-4">
        <FaUserLock size={48} className="text-slate-300" />
        <span className="font-bold text-lg text-slate-600">
          Acceso Restringido
        </span>
        <span className="text-sm">
          Tu cuenta no tiene módulos asignados todavía.
        </span>
        <button
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-md"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return children;
};

// --- SIDEBAR ESTILO LEBANE ---
const Sidebar = ({
  links,
  isCollapsed,
  setIsCollapsed,
  handleLogout,
  userBadge,
  role,
}) => {
  const location = useLocation();

  return (
    <aside
      className={`hidden lg:flex flex-col bg-white border-r border-gray-100 transition-all duration-300 z-50 ${isCollapsed ? "w-20" : "w-64"}`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <div className="flex items-center gap-2 text-blue-600">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
            <FaWarehouse />
          </div>
          {!isCollapsed && (
            <span className="font-extrabold text-xl tracking-tight text-blue-600">
              Gestion<span className="text-gray-800">MRP</span>
            </span>
          )}
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
        {links.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"} ${isCollapsed ? "justify-center" : ""}`}
              title={isCollapsed ? link.label : ""}
            >
              <span
                className={`text-lg ${isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"}`}
              >
                {link.icon}
              </span>
              {!isCollapsed && <span className="text-sm">{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer Usuario */}
      <div className="p-4 border-t border-gray-100">
        <div
          className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-black shadow-inner border border-blue-200 uppercase">
            {userBadge.text.charAt(0)}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-slate-800 truncate tracking-tight">
                {userBadge.text}
              </p>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {role || "OPERARIO"}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1"
                >
                  Salir
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="mt-4 w-full flex items-center justify-center text-slate-300 hover:text-slate-500 p-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          {isCollapsed ? (
            <FaChevronRight size={12} />
          ) : (
            <FaChevronLeft size={12} />
          )}
        </button>
      </div>
    </aside>
  );
};

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { user } = getAuthData();
  const role = user?.rol;
  const nombreUsuario = user?.nombre || "Usuario";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  let userBadge = { icon: <FaHardHat />, text: nombreUsuario };
  if (role === "GERENCIA" || role === "JEFE PRODUCCIÓN")
    userBadge = { icon: <FaUserTie />, text: nombreUsuario };
  if (role === "DEPOSITO")
    userBadge = { icon: <FaWarehouse />, text: nombreUsuario };
  if (role === "MANTENIMIENTO")
    userBadge = { icon: <FaTools />, text: nombreUsuario };

  const allowedLinks = NAV_LINKS.filter((link) => {
    if (user?.rol === "GERENCIA" || user?.rol === "JEFE PRODUCCIÓN")
      return true;
    return user?.modulos?.includes(link.moduloReq);
  });

  return (
    <div className="flex h-screen bg-[#F3F4F6] text-gray-900 font-sans overflow-hidden">
      {/* Sidebar Desktop */}
      <Sidebar
        links={allowedLinks}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        handleLogout={handleLogout}
        userBadge={userBadge}
        role={role}
      />

      {/* --- HEADER MÓVIL CORREGIDO --- */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-stone-100 flex items-center justify-between px-6 z-[40]">
        {/* Hamburguesa a la izquierda */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2.5 bg-stone-50 text-slate-600 rounded-xl active:scale-95 transition-all border border-stone-100"
        >
          <FaBars size={20} />
        </button>

        {/* Texto a la derecha */}
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xl tracking-tight text-blue-600">
            Gestion<span className="text-gray-800">MRP</span>
          </span>
        </div>
      </div>

      {/* Menú Lateral Móvil (Drawer) */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-[101] shadow-2xl lg:hidden flex flex-col"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-stone-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <FaWarehouse size={14} />
                  </div>
                  <span className="font-bold text-xl text-slate-800">Menú</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-slate-300 p-2"
                >
                  <FaTimes size={20} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {allowedLinks.map((link) => {
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : "text-slate-500 hover:bg-stone-50"
                      }`}
                    >
                      <span
                        className={
                          isActive ? "text-blue-600" : "text-stone-300"
                        }
                      >
                        {link.icon}
                      </span>
                      <span className="text-sm">{link.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-6 border-t border-stone-50 bg-stone-50/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold border border-blue-200">
                    {nombreUsuario.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {nombreUsuario}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                      {role}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full py-3 bg-white border border-stone-200 text-rose-500 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm"
                >
                  <FaSignOutAlt /> Salir
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* pt-16 es vital para que el contenido no quede debajo del header móvil */}
        <main className="flex-1 overflow-y-auto scroll-smooth pt-16 lg:pt-0">
          <div className="w-full h-full">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontSize: "12px",
            fontWeight: "bold",
            borderRadius: "16px",
            color: "#334155", // slate-700
          },
          success: {
            iconTheme: {
              primary: "#10B981", // emerald-500
              secondary: "#fff",
            },
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas con Layout - Reemplazados los allowedRoles por requiredModule */}
        <Route
          path="/"
          element={
            <ProtectedRoute requiredModule="INICIO">
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analisis-pedidos"
          element={
            <ProtectedRoute requiredModule="METRICAS">
              <Layout>
                <AnalisisPedidos />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Nota: Panel de Control lo dejamos libre si tiene permisos, o le podés asignar un módulo si preferís. Lo ato a "PLANIFICACION" para que siga la lógica */}
        <Route
          path="/panel-control"
          element={
            <ProtectedRoute requiredModule="PLANIFICACION">
              <Layout>
                <PanelControl />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/registrar-produccion"
          element={
            <ProtectedRoute requiredModule="REGISTRO">
              <Layout>
                <RegistrarProduccionPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mantenimiento"
          element={
            <ProtectedRoute requiredModule="MANTENIMIENTO">
              <Layout>
                <MantenimientoPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/planificacion"
          element={
            <ProtectedRoute requiredModule="PLANIFICACION">
              <Layout>
                <PlanificacionPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/operarios"
          element={
            <ProtectedRoute requiredModule="EQUIPO">
              <Layout>
                <OperariosPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/logistica"
          element={
            <ProtectedRoute requiredModule="LOGISTICA">
              <Layout>
                <LogisticaPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hoja-de-ruta"
          element={
            <ProtectedRoute requiredModule="HOJA_RUTA">
              <Layout>
                <HojaDeRutaPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* El calendario no estaba en la lista de módulos visuales, lo ato al inicio, podés ajustarlo */}
        <Route
          path="/calendario"
          element={
            <ProtectedRoute requiredModule="INICIO">
              <Layout>
                <CentroComando />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ingenieria"
          element={
            <ProtectedRoute requiredModule="INGENIERIA">
              <Layout>
                <IngenieriaProductos />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/changelog"
          element={
            <ProtectedRoute requiredModule="INGENIERIA">
              <Layout>
                <ChangelogPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Detalle Producto suele ser público para todos los logueados con acceso a ingeniería o registro */}
        <Route
          path="/producto/:nombre"
          element={
            <ProtectedRoute requiredModule="REGISTRO">
              <Layout>
                <DetalleProducto />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/compras"
          element={
            <ProtectedRoute requiredModule="COMPRAS">
              <Layout>
                <SolicitudesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/rrhh"
          element={
            <ProtectedRoute requiredModule="RRHH">
              <Layout>
                <RRHHPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/deposito-3d"
          element={
            <ProtectedRoute requiredModule="STOCK">
              <Layout>
                <DepositoPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sugerencias"
          element={
            <ProtectedRoute requiredModule="COMPRAS">
              <Layout>
                <SugerenciasPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/deposito-despacho"
          element={
            <ProtectedRoute requiredModule="DESPACHO">
              <Layout>
                <DepositoDespacho />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Ruta Exclusiva de Gerencia (No atada a un módulo seleccionable) */}
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute requiredModule="ACCESOS_ADMIN">
              <Layout>
                <GestorUsuarios />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mapa"
          element={
            <ProtectedRoute requiredModule="LOGISTICA">
              <Layout>
                <MapaRastreo />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transmitir"
          element={
            <ProtectedRoute requiredModule="HOJA_RUTA">
              <Layout>
                <TransmisorUbicacion />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
