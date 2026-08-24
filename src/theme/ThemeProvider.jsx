import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyAppearance, applyParticles, getStoredAppearance, getStoredParticles,
  getThemeColor, PARTICLES_EVENT, THEME_EVENT,
} from "./theme";
import { ThemeContext } from "./theme-context";
import { normalizeMode, normalizeTheme } from "./themes";
import { AmbientParticles } from "../components/AmbientParticles";

export function ThemeProvider({ children }) {
  const [appearance, setAppearanceState] = useState(getStoredAppearance);
  const [particlesEnabled, setParticlesEnabledState] = useState(getStoredParticles);

  const setAppearance = useCallback((value) => {
    const next = applyAppearance(value, { notify: false });
    setAppearanceState(next);
    return next;
  }, []);

  const setTheme = useCallback((theme) => setAppearance({ theme: normalizeTheme(theme) }).theme, [setAppearance]);
  const setMode = useCallback((mode) => setAppearance({ mode: normalizeMode(mode) }).mode, [setAppearance]);
  const setParticlesEnabled = useCallback((enabled) => {
    const next = applyParticles(enabled, { notify: false });
    setParticlesEnabledState(next);
    return next;
  }, []);

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

  useEffect(() => {
    const syncParticles = (event) => setParticlesEnabledState(Boolean(event.detail?.enabled));
    window.addEventListener(PARTICLES_EVENT, syncParticles);
    return () => window.removeEventListener(PARTICLES_EVENT, syncParticles);
  }, []);

  const value = useMemo(() => ({
    ...appearance,
    setAppearance,
    setTheme,
    setMode,
    particlesEnabled,
    setParticlesEnabled,
    getThemeColor,
  }), [appearance, particlesEnabled, setAppearance, setMode, setParticlesEnabled, setTheme]);

  return <ThemeContext.Provider value={value}><AmbientParticles enabled={particlesEnabled} />{children}</ThemeContext.Provider>;
}
