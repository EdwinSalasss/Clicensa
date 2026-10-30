import { useEffect } from "react";
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
  useEffect(() => {
    function mostrarErrorDeCampo(event) {
      const campo = event.target;
      if (!(campo instanceof HTMLInputElement || campo instanceof HTMLSelectElement || campo instanceof HTMLTextAreaElement)) return;

      const { validity } = campo;
      if (validity.valueMissing) {
        campo.setCustomValidity("Completa este campo.");
      } else if (validity.typeMismatch && campo.type === "email") {
        campo.setCustomValidity("Escribe un correo electrónico válido, por ejemplo, nombre@ejemplo.com.");
      } else if (validity.typeMismatch && campo.type === "url") {
        campo.setCustomValidity("Escribe una dirección web válida que comience con http:// o https://.");
      } else if (validity.typeMismatch) {
        campo.setCustomValidity("El valor ingresado no tiene el formato solicitado.");
      } else if (validity.patternMismatch) {
        campo.setCustomValidity(campo.title || "El formato ingresado no es válido. Revisa la indicación del campo.");
      } else if (validity.tooShort) {
        campo.setCustomValidity(`Escribe al menos ${campo.minLength} caracteres.`);
      } else if (validity.tooLong) {
        campo.setCustomValidity(`Escribe como máximo ${campo.maxLength} caracteres.`);
      } else if (validity.rangeUnderflow) {
        campo.setCustomValidity(`El valor debe ser igual o mayor que ${campo.min}.`);
      } else if (validity.rangeOverflow) {
        campo.setCustomValidity(`El valor debe ser igual o menor que ${campo.max}.`);
      } else if (validity.stepMismatch) {
        campo.setCustomValidity("El valor no coincide con los incrementos permitidos para este campo.");
      } else if (validity.badInput) {
        campo.setCustomValidity("Ingresa un valor con el formato indicado.");
      }
    }
    function limpiarErrorDeCampo(event) {
      const campo = event.target;
      if (campo instanceof HTMLInputElement || campo instanceof HTMLSelectElement || campo instanceof HTMLTextAreaElement) {
        campo.setCustomValidity("");
      }
    }

    document.addEventListener("invalid", mostrarErrorDeCampo, true);
    document.addEventListener("input", limpiarErrorDeCampo, true);
    document.addEventListener("change", limpiarErrorDeCampo, true);
    return () => {
      document.removeEventListener("invalid", mostrarErrorDeCampo, true);
      document.removeEventListener("input", limpiarErrorDeCampo, true);
      document.removeEventListener("change", limpiarErrorDeCampo, true);
    };
  }, []);

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
