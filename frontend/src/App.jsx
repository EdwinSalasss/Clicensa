import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Registro from "./pages/Registro.jsx";
import AgendarCita from "./pages/AgendarCita.jsx";
import HistorialCitas from "./pages/HistorialCitas.jsx";
import MedicoPanel from "./pages/MedicoPanel.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
import Perfil from "./pages/Perfil.jsx";
import SystemAdminPanel from "./pages/SystemAdminPanel.jsx";
import MedicoActivacion from "./pages/MedicoActivacion.jsx";
import Reportes from "./pages/Reportes.jsx";
import { estaAutenticado, getUsuario } from "./api/session.js";

function RutaPrivada({ rolesPermitidos, children }) {
  if (!estaAutenticado()) return <Navigate to="/login" replace />;
  const usuario = getUsuario();
  if (rolesPermitidos && !rolesPermitidos.includes(usuario?.rol)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/medico/activar" element={<MedicoActivacion />} />
      <Route path="/registro" element={<Registro />} />
      <Route
        path="/perfil"
        element={
          <RutaPrivada>
            <Perfil />
          </RutaPrivada>
        }
      />

      <Route
        path="/paciente/agendar"
        element={
          <RutaPrivada rolesPermitidos={["PACIENTE", "paciente"]}>
            <AgendarCita />
          </RutaPrivada>
        }
      />
      <Route
        path="/paciente/historial"
        element={
          <RutaPrivada rolesPermitidos={["PACIENTE", "paciente"]}>
            <HistorialCitas />
          </RutaPrivada>
        }
      />

      <Route
        path="/medico"
        element={
          <RutaPrivada rolesPermitidos={["MEDICO", "medico"]}>
            <MedicoPanel />
          </RutaPrivada>
        }
      />
      <Route
        path="/reportes"
        element={
          <RutaPrivada rolesPermitidos={[
            "PERSONAL_ADMINISTRATIVO",
            "MEDICO",
            "administrativo",
            "medico",
          ]}>
            <Reportes />
          </RutaPrivada>
        }
      />

      <Route
        path="/admin"
        element={
          <RutaPrivada rolesPermitidos={["PERSONAL_ADMINISTRATIVO", "administrativo"]}>
            <AdminPanel />
          </RutaPrivada>
        }
      />
      <Route path="/admin/medicos" element={<Navigate to="/admin" replace />} />
      <Route
        path="/sistema"
        element={
          <RutaPrivada rolesPermitidos={["ADMIN_SISTEMA"]}>
            <SystemAdminPanel />
          </RutaPrivada>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
