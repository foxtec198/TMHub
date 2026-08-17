// Estilos
import "./theme-logo.css";

// Combina variante e classes externas antes de renderizar o logotipo.
export function ThemeLogo({
  className = "",
  variant = "default",
  alt = "TM Hub — Painel Executivo",
  ...props
}) {
  const classes = [
    "theme-logo",
    variant === "inverse" ? "theme-logo--inverse" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <span
      {...props}
      className={classes}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : "true"}
    />
  );
}
