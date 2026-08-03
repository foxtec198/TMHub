import { Calendar } from "primereact/calendar";
import { Button } from "primereact/button";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";

/** Filtro único reutilizado pelos dashboards do TMHub. */
export function DashboardFilterButton({ panelRef, activeCount = 0, className = "" }) {
  return (
    <Button
      type="button"
      icon="pi pi-filter-fill"
      label={activeCount ? `Filtros (${activeCount})` : "Filtros"}
      className={`dashboard-filter-trigger ${className}`.trim()}
      aria-label="Abrir filtros do dashboard"
      onClick={(event) => panelRef.current?.toggle(event)}
    />
  );
}

export function DashboardFilterPanel({
  panelRef,
  period,
  onPeriodChange,
  fields = [],
  onClear,
  title = "Filtrar dashboard",
  description = "Combine os filtros para atualizar todos os indicadores e gráficos.",
}) {
  return (
    <OverlayPanel ref={panelRef} className="dashboard-filter-panel">
      <div className="dashboard-filter-title">
        <div><strong>{title}</strong><span>{description}</span></div>
        <Button type="button" icon="pi pi-filter-slash" label="Limpar filtros" text severity="secondary" onClick={onClear} />
      </div>
      <div className="dashboard-filter-grid">
        {onPeriodChange && (
          <label className="is-wide">
            <span>Período</span>
            <Calendar value={period} onChange={(event) => onPeriodChange(event.value)} selectionMode="range" readOnlyInput hideOnRangeSelection dateFormat="dd/mm/yy" placeholder="Selecione o período" showIcon showButtonBar />
          </label>
        )}
        {fields.map((field) => (
          <label className={field.wide ? "is-wide" : ""} key={field.name}>
            <span>{field.label}</span>
            <MultiSelect
              value={field.value || []}
              options={field.options || []}
              optionLabel={field.optionLabel || "label"}
              optionValue={field.optionValue || "value"}
              onChange={(event) => field.onChange(event.value || [])}
              placeholder={field.placeholder || `Todos os ${field.label.toLowerCase()}`}
              display="chip"
              filter={field.filter !== false}
              showClear
              className="w-full"
              maxSelectedLabels={2}
              selectedItemsLabel="{0} selecionados"
              panelClassName="dashboard-filter-dropdown"
            />
          </label>
        ))}
      </div>
    </OverlayPanel>
  );
}
