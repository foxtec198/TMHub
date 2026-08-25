export const THEMES = Object.freeze([
  "tmhub", "cyberpunk", "pride", "christmas", "aurora", "ocean",
  "sunset", "forest", "terminal", "paper", "muertos",
]);
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
  {
    id: "tmhub",
    label: "TMHub",
    icon: "pi pi-building",
    description: "Identidade corporativa",
    default: true,
    preview: ["#ffffff", "#155c27", "#4bd66e", "#071009"],
    card: ["#0b3518", "#ffffff", "#b9d8c4", "#286d3c", "#68e58e"],
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    icon: "pi pi-bolt",
    description: "Cyan e vermelho neon",
    preview: ["#090d11", "#00f0ff", "#ff334f", "#fcee09"],
    card: ["#0c0c14", "#f5f7ff", "#9699aa", "#26454d", "#00f0ff"],
  },
  {
    id: "pride",
    label: "Orgulho",
    icon: "pi pi-heart",
    description: "Cores do orgulho",
    preview: ["#e40303", "#ff8c00", "#ffed00", "#008026", "#004dff", "#750787"],
    card: ["#15151c", "#ffffff", "#b9b9c4", "#49335e", "#b879ff"],
  },
  {
    id: "christmas",
    label: "Natal",
    icon: "pi pi-gift",
    description: "Pinheiro, vinho e dourado",
    preview: ["#0d2118", "#43d477", "#e84b5f", "#f4d58d"],
    card: ["#0d2b1c", "#f7fbf8", "#bfd0c5", "#8f3442", "#f4d58d"],
  },
  {
    id: "aurora",
    label: "Aurora",
    icon: "pi pi-sparkles",
    description: "Índigo, violeta e verde-luz",
    preview: ["#1a1c37", "#8b7cff", "#e579ff", "#42dfb3"],
    card: ["#1a1c37", "#f7f5ff", "#c4c2db", "#5b5998", "#b4a9ff"],
  },
  {
    id: "ocean",
    label: "Ocean",
    icon: "pi pi-wave-pulse",
    description: "Azul oceano e ciano",
    preview: ["#0b2b38", "#29c9e6", "#38a9ff", "#5ce1b3"],
    card: ["#0b2b38", "#effdff", "#b5d2dc", "#347185", "#72e0f1"],
  },
  {
    id: "sunset",
    label: "Sunset",
    icon: "pi pi-sun",
    description: "Âmbar, coral e noite",
    preview: ["#351828", "#ff9a57", "#ff647f", "#d275ff"],
    card: ["#351828", "#fff6f7", "#e2bfca", "#8c5269", "#ffc18b"],
  },
  {
    id: "forest",
    label: "Forest",
    icon: "pi pi-tree",
    description: "Verde profundo e dourado",
    preview: ["#173323", "#69cd8a", "#d7b96b", "#78cdb6"],
    card: ["#173323", "#f0f8f0", "#c0d2c1", "#577b60", "#d7b96b"],
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: "pi pi-code",
    description: "Grafite e verde phosphor",
    preview: ["#0b1210", "#77ff9d", "#50dfd1", "#e8cf65"],
    card: ["#0b1210", "#eaffee", "#bad2bd", "#4c7560", "#77ff9d"],
  },
  {
    id: "paper",
    label: "Paper",
    icon: "pi pi-file",
    description: "Papel claro, tinta e elegância",
    preview: ["#fffdf7", "#285d45", "#b66b48", "#507f9c"],
    card: ["#f4eddf", "#26332b", "#627168", "#b9c7b8", "#285d45"],
  },
  {
    id: "muertos",
    label: "Dia de los Muertos",
    icon: "pi pi-sparkles",
    description: "Vinho, violeta e cempasúchil",
    preview: ["#101820", "#4d0057", "#b944bc", "#f5ad24", "#e35a43"],
    card: ["#1b2633", "#fff4df", "#e0c9bc", "#a46c88", "#f5ad24"],
  },
]);

export function getAvailableThemeOptions(unlockedThemes) {
  if (!Array.isArray(unlockedThemes)) {
    // A API é a fonte de verdade. Sem uma liberação explícita, mantém apenas
    // a identidade institucional para não expor temas em testes.
    return THEME_OPTIONS.filter((option) => option.default);
  }
  const unlocked = new Set(unlockedThemes.map((value) => normalizeTheme(value)));
  return THEME_OPTIONS.filter((option) => option.default || unlocked.has(option.id));
}

export function isValidTheme(value) {
  return THEMES.includes(String(value || "").toLowerCase());
}

export function isValidMode(value) {
  return MODES.includes(String(value || "").toLowerCase());
}

export function normalizeTheme(value) {
  const candidate = String(value || "").toLowerCase();
  if (candidate === "light" || candidate === "dark") return DEFAULT_THEME;
  return isValidTheme(candidate) ? candidate : DEFAULT_THEME;
}

export function normalizeMode(value, fallback = DEFAULT_MODE) {
  const candidate = String(value || "").toLowerCase();
  return isValidMode(candidate) ? candidate : fallback;
}

export function appearanceFromLegacyTheme(value, storedMode) {
  const candidate = String(value || "").toLowerCase();
  const legacyMode = isValidMode(candidate) ? candidate : null;
  const customTheme = isValidTheme(candidate) ? candidate : DEFAULT_THEME;
  return {
    theme: legacyMode ? DEFAULT_THEME : customTheme,
    mode: normalizeMode(storedMode, legacyMode || (customTheme === DEFAULT_THEME ? DEFAULT_MODE : "dark")),
  };
}
