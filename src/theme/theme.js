// Configurações de tema
import {
  appearanceFromLegacyTheme,
  MODE_STORAGE_KEY,
  normalizeMode,
  normalizeTheme,
  THEME_STORAGE_KEY,
} from "./themes";

export const THEME_EVENT = "tmhub:theme-change";

// Recupera e normaliza a aparência persistida pelo usuário.
export function getStoredAppearance() {
  return appearanceFromLegacyTheme(
    localStorage.getItem(THEME_STORAGE_KEY),
    localStorage.getItem(MODE_STORAGE_KEY),
  );
}

export function getStoredTheme() {
  return getStoredAppearance().theme;
}

export function getStoredMode() {
  return getStoredAppearance().mode;
}

export function applyAppearance(value, { notify = true } = {}) {
  // Normaliza o valor recebido e persiste tema e modo antes de atualizar o DOM.
  const current = getStoredAppearance();
  const next = {
    theme: normalizeTheme(value?.theme ?? current.theme),
    mode: normalizeMode(value?.mode, current.mode),
  };

  document.documentElement.dataset.theme = next.theme;
  document.documentElement.dataset.mode = next.mode;
  document.documentElement.style.colorScheme = next.mode;
  localStorage.setItem(THEME_STORAGE_KEY, next.theme);
  localStorage.setItem(MODE_STORAGE_KEY, next.mode);

  requestAnimationFrame(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      getComputedStyle(document.documentElement).getPropertyValue("--browser-theme-color").trim() || "#0b3518",
    );
  });

  if (notify) window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  return next;
}

export function applyTheme(theme, options) {
  return applyAppearance({ theme }, options).theme;
}

export function applyMode(mode, options) {
  return applyAppearance({ mode }, options).mode;
}

export function applyProfileAppearance(profile, options) {
  // Mantém compatibilidade com perfis que ainda salvam o tema no formato antigo.
  const candidate = String(profile?.tema || "").toLowerCase();
  const legacyMode = candidate === "light" || candidate === "dark" ? candidate : null;
  return applyAppearance({
    theme: legacyMode ? "tmhub" : candidate,
    mode: profile?.modo_tema || legacyMode || getStoredMode(),
  }, options);
}

export function getThemeColor(variable, fallback = "") {
  // Lê variáveis CSS somente no navegador para também funcionar em testes.
  if (typeof document === "undefined") return fallback;
  const property = variable.startsWith("--") ? variable : `--${variable}`;
  return getComputedStyle(document.documentElement).getPropertyValue(property).trim() || fallback;
}
