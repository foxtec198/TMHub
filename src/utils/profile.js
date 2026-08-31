import { applyProfileAppearance, applyProfileParticles } from "../theme/theme";

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
  if (profile.adorno_foto) localStorage.setItem("profile_adornment", profile.adorno_foto);
  else localStorage.removeItem("profile_adornment");
  localStorage.setItem("timo_skin", profile.timo_skin || "default");
  localStorage.setItem("timo_scene", profile.timo_cenario || "workshop");
  localStorage.setItem("timo_home", profile.timo_tela_inicial ? "true" : "false");
  if (profile.gerencia_faltas != null) localStorage.setItem("gerencia_faltas", profile.gerencia_faltas ? "true" : "false");
  if (Array.isArray(profile.permissions)) localStorage.setItem("permissions", JSON.stringify(profile.permissions));
  if (profile.tema || profile.modo_tema) applyProfileAppearance(profile);
  if (profile.particulas_ativas != null) applyProfileParticles(profile);
  window.dispatchEvent(new CustomEvent("tmhub:profile", { detail: profile }));
}

export function getPreferredHomePath() {
  return localStorage.getItem("timo_home") === "true" ? "/timo" : "/init";
}
