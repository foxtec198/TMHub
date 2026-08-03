import { Navigate } from "react-router-dom";
import { can } from "../utils/permissions";


export function PermissionGate({ screen, action = "view", adminOnly = false, children }) {
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  return (!adminOnly || isAdmin) && can(screen, action)
    ? children
    : <Navigate to="/init" replace />;
}
