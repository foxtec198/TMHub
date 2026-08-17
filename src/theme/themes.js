export const THEMES = Object.freeze(["tmhub", "cyberpunk", "pride", "christmas"]);
export const MODES = Object.freeze(["light", "dark"]);

export const DEFAULT_THEME = "tmhub";
export const DEFAULT_MODE = "light";
export const THEME_STORAGE_KEY = "theme";
export const MODE_STORAGE_KEY = "themeMode";

export const MODE_OPTIONS = Object.freeze([
  { id: "light", label: "Claro", icon: "pi pi-sun", description: "Superfícies claras" },
  { id: "dark", label: "Escuro", icon: "pi pi-moon", description: "Superfícies escuras" },
]);

export const THEME_OPTIONS = Object.freeze([
  { id: "tmhub", label: "TMHub", icon: "pi pi-building", description: "Identidade corporativa", default: true },
  { id: "cyberpunk", label: "Cyberpunk", icon: "pi pi-bolt", description: "Cyan e vermelho neon" },
  { id: "pride", label: "Orgulho", icon: "pi pi-heart", description: "Cores do orgulho" },
  { id: "christmas", label: "Natal", icon: "pi pi-gift", description: "Identidade natalina", hiddenUntilUnlocked: true },
]);

// Filtra temas liberados sem ocultar o tema corporativo padrão.
export function getAvailableThemeOptions(unlockedThemes) {
  if (!Array.isArray(unlockedThemes)) {
    return THEME_OPTIONS.filter((option) => !option.hiddenUntilUnlocked);
  }
  const unlocked = new Set(unlockedThemes.map((value) => normalizeTheme(value)));
  return THEME_OPTIONS.filter((option) => option.default || unlocked.has(option.id));
}

export function isValidTheme(value) {
  // Valida o tema antes de persistir preferências recebidas de fontes externas.
  return THEMES.includes(String(value || "").toLowerCase());
}

export function isValidMode(value) {
  return MODES.includes(String(value || "").toLowerCase());
}

export function normalizeTheme(value) {
  // Converte valores legados de modo em um tema corporativo compatível.
  const candidate = String(value || "").toLowerCase();
  if (candidate === "light" || candidate === "dark") return DEFAULT_THEME;
  return isValidTheme(candidate) ? candidate : DEFAULT_THEME;
}

export function normalizeMode(value, fallback = DEFAULT_MODE) {
  // Mantém um modo seguro quando a preferência armazenada for inválida.
  const candidate = String(value || "").toLowerCase();
  return isValidMode(candidate) ? candidate : fallback;
}

export function appearanceFromLegacyTheme(value, storedMode) {
  // Combina formatos antigos e atuais em uma única aparência normalizada.
  const candidate = String(value || "").toLowerCase();
  const legacyMode = isValidMode(candidate) ? candidate : null;
  const customTheme = isValidTheme(candidate) ? candidate : DEFAULT_THEME;
  return {
    theme: legacyMode ? DEFAULT_THEME : customTheme,
    mode: normalizeMode(storedMode, legacyMode || (customTheme === DEFAULT_THEME ? DEFAULT_MODE : "dark")),
  };
}
