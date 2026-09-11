import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { can } from "../utils/permissions";
import connect from "../utils/request";

export function PermissionGate({ screen, action = "view", adminOnly = false, authenticatedOnly = false, children }) {
  const [authenticated, setAuthenticated] = useState(authenticatedOnly ? null : true);

  useEffect(() => {
    if (!authenticatedOnly) return undefined;
    let active = true;
    connect.get("/usuarios/perfil")
      .then(({ data }) => {
        if (active) setAuthenticated(Boolean(data));
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      });
    return () => { active = false; };
  }, [authenticatedOnly]);

  if (authenticatedOnly && authenticated === null) return null;
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  const allowed = authenticatedOnly
    ? authenticated
    : (!adminOnly || isAdmin) && can(screen, action);
  return allowed ? children : <Navigate to="/init" replace />;
}
