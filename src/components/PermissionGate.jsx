// Roteamento
import { Navigate } from "react-router-dom";
// Utilitários
import { can } from "../utils/permissions";


// Libera o conteúdo apenas quando a permissão exigida é atendida.
export function PermissionGate({ screen, action = "view", adminOnly = false, children }) {
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  return (!adminOnly || isAdmin) && can(screen, action)
    ? children
    : <Navigate to="/init" replace />;
}
