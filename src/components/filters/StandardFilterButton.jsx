import { Button } from "primereact/button";
import { AppIcon } from "../icons/AppIcon";

/** Botão único de abertura dos filtros do TMHub. */
export function StandardFilterButton({ panelRef, count = 0, ariaLabel = "Abrir filtros", onBeforeToggle }) {
  const label = count ? `Filtros (${count})` : "Filtros";
  return (
    <Button
      type="button"
      className="standard-filter-button"
      icon={<AppIcon name="filter-filled" />}
      label={label}
      aria-label={ariaLabel}
      onClick={(event) => { onBeforeToggle?.(); panelRef?.current?.toggle(event); }}
    />
  );
}
