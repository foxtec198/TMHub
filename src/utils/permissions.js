// Mantém a chave de permissões e as exceções do modelo legado.
const STORAGE_KEY = "permissions";
const LEGACY_RESTRICTED = new Set(["controle_faltas", "controle_glosas", "dashboard_faltas"]);

export function storePermissions(permissions) {
  if (Array.isArray(permissions)) localStorage.setItem(STORAGE_KEY, JSON.stringify(permissions));
}

export function getPermissions() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function can(screen, action = "view") {
  if (String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN") return true;
  const permissions = getPermissions();
  if (!permissions.length) {
    return LEGACY_RESTRICTED.has(screen)
      ? localStorage.getItem("gerencia_faltas") === "true"
      : true;
  }
  const permission = permissions.find((item) => item.screen === screen)
    || (screen === "tm_ops" ? permissions.find((item) => item.screen === "schedular") : null);
  return Boolean(permission?.[action]);
}
