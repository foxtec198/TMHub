import { useContext, useMemo } from "react";
import { getThemeColor } from "./theme";
import { ThemeContext } from "./theme-context";

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme deve ser usado dentro de ThemeProvider.");
  return context;
}

export function useChartTheme() {
  const { theme, mode } = useTheme();
  return useMemo(() => ({
    theme,
    mode,
    palette: Array.from({ length: 8 }, (_, index) => getThemeColor(`--chart-${index + 1}`)),
    text: getThemeColor("--chart-text"),
    grid: getThemeColor("--chart-grid"),
    tooltipBackground: getThemeColor("--chart-tooltip-bg"),
    surface: getThemeColor("--surface-1"),
    border: getThemeColor("--border"),
    primary: getThemeColor("--primary"),
    primaryHover: getThemeColor("--primary-hover"),
    success: getThemeColor("--status-success"),
    danger: getThemeColor("--status-danger"),
    warning: getThemeColor("--status-warning"),
    info: getThemeColor("--status-info"),
  }), [theme, mode]);
}
