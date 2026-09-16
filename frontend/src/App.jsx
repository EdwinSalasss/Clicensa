import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import AgendarCita from "./pages/AgendarCita.jsx";
import HistorialCitas from "./pages/HistorialCitas.jsx";
import MedicoPanel from "./pages/MedicoPanel.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
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

      <Route
        path="/paciente/agendar"
        element={
          <RutaPrivada rolesPermitidos={["paciente"]}>
            <AgendarCita />
          </RutaPrivada>
        }
      />
      <Route
        path="/paciente/historial"
        element={
          <RutaPrivada rolesPermitidos={["paciente"]}>
            <HistorialCitas />
          </RutaPrivada>
        }
      />

      <Route
        path="/medico"
        element={
          <RutaPrivada rolesPermitidos={["medico"]}>
            <MedicoPanel />
          </RutaPrivada>
        }
      />

      <Route
        path="/admin"
        element={
          <RutaPrivada rolesPermitidos={["administrativo"]}>
            <AdminPanel />
          </RutaPrivada>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
