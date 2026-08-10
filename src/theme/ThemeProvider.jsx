import { useCallback, useEffect, useMemo, useState } from "react";
import { applyAppearance, getStoredAppearance, getThemeColor, THEME_EVENT } from "./theme";
import { ThemeContext } from "./theme-context";
import { normalizeMode, normalizeTheme } from "./themes";

export function ThemeProvider({ children }) {
  const [appearance, setAppearanceState] = useState(getStoredAppearance);

  const setAppearance = useCallback((value) => {
    const next = applyAppearance(value, { notify: false });
    setAppearanceState(next);
    return next;
  }, []);

  const setTheme = useCallback((theme) => setAppearance({ theme: normalizeTheme(theme) }).theme, [setAppearance]);
  const setMode = useCallback((mode) => setAppearance({ mode: normalizeMode(mode) }).mode, [setAppearance]);

  useEffect(() => {
    applyAppearance(appearance, { notify: false });
  }, [appearance]);

  useEffect(() => {
    const syncTheme = (event) => setAppearanceState({
      theme: normalizeTheme(event.detail?.theme),
      mode: normalizeMode(event.detail?.mode),
    });
    window.addEventListener(THEME_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_EVENT, syncTheme);
  }, []);

  const value = useMemo(() => ({
    ...appearance,
    setAppearance,
    setTheme,
    setMode,
    getThemeColor,
  }), [appearance, setAppearance, setMode, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
