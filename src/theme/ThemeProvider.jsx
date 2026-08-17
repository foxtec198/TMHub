// React
import { useCallback, useEffect, useMemo, useState } from "react";
// Tema
import { applyAppearance, getStoredAppearance, getThemeColor, THEME_EVENT } from "./theme";
import { ThemeContext } from "./theme-context";
import { normalizeMode, normalizeTheme } from "./themes";

// Sincroniza a aparência salva, o DOM e os consumidores do contexto.
export function ThemeProvider({ children }) {
  const [appearance, setAppearanceState] = useState(getStoredAppearance);

  // Aplica a aparência no DOM antes de notificar os consumidores do contexto.
  const setAppearance = useCallback((value) => {
    const next = applyAppearance(value, { notify: false });
    setAppearanceState(next);
    return next;
  }, []);

  const setTheme = useCallback((theme) => setAppearance({ theme: normalizeTheme(theme) }).theme, [setAppearance]);
  const setMode = useCallback((mode) => setAppearance({ mode: normalizeMode(mode) }).mode, [setAppearance]);

  // Reaplica a aparência quando o estado local for restaurado ou alterado.
  useEffect(() => {
    applyAppearance(appearance, { notify: false });
  }, [appearance]);

  // Mantém o contexto sincronizado com mudanças disparadas fora do provedor.
  useEffect(() => {
    const syncTheme = (event) => setAppearanceState({
      theme: normalizeTheme(event.detail?.theme),
      mode: normalizeMode(event.detail?.mode),
    });
    window.addEventListener(THEME_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_EVENT, syncTheme);
  }, []);

  // Evita recriar a API do contexto quando a aparência não mudou.
  const value = useMemo(() => ({
    ...appearance,
    setAppearance,
    setTheme,
    setMode,
    getThemeColor,
  }), [appearance, setAppearance, setMode, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
