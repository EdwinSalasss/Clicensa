import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import AgendarCita from "./pages/AgendarCita.jsx";

function estaAutenticado() {
  return Boolean(localStorage.getItem("clisensa_token"));
}

function RutaPrivada({ children }) {
  return estaAutenticado() ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/agendar"
        element={
          <RutaPrivada>
            <AgendarCita />
          </RutaPrivada>
        }
      />
    </Routes>
  );
}
