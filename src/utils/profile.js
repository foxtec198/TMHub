import { applyProfileAppearance } from "../theme/theme";

export function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0][0]}${parts.length > 1 ? parts.at(-1)[0] : ""}`.toUpperCase();
}

export function storeProfile(profile) {
  if (profile.nome != null) localStorage.setItem("display_name", profile.nome);
  if (profile.email != null) localStorage.setItem("email", profile.email);
  if (profile.foto_perfil) localStorage.setItem("profile_photo", profile.foto_perfil);
  else localStorage.removeItem("profile_photo");
  if (profile.gerencia_faltas != null) localStorage.setItem("gerencia_faltas", profile.gerencia_faltas ? "true" : "false");
  if (profile.timo_ativo != null) localStorage.setItem("timo_ativo", profile.timo_ativo ? "true" : "false");
  else localStorage.removeItem("timo_ativo");
  if (Array.isArray(profile.permissions)) localStorage.setItem("permissions", JSON.stringify(profile.permissions));
  if (profile.tema || profile.modo_tema) applyProfileAppearance(profile);
  window.dispatchEvent(new CustomEvent("tmhub:profile", { detail: profile }));
}
