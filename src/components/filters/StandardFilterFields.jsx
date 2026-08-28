import { useState } from "react";
import { Calendar } from "primereact/calendar";
import { MultiSelect } from "primereact/multiselect";
import "./standard-filter-fields.css";

const STORAGE = {
  date: "standard_filter_date",
  departments: "selected_department_ids",
  centers: "selected_cost_center_ids",
};

// O recorte do painel vale somente durante a sessão atual da aplicação. Ao
// recarregar a página o módulo é reinicializado e os filtros retornam ao padrão.
let panelFilterStorageInitialized = false;
const initializePanelFilterStorage = () => {
  if (panelFilterStorageInitialized) return;
  panelFilterStorageInitialized = true;
  localStorage.removeItem(STORAGE.date);
  localStorage.removeItem(STORAGE.departments);
  localStorage.removeItem(STORAGE.centers);
};

const readIds = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
};

const readDates = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE.date) || "[]");
    return Array.isArray(value) ? value.map((item) => item ? new Date(item) : null) : [];
  } catch {
    return [];
  }
};

const save = (key, value) => localStorage.setItem(key, JSON.stringify(value || []));

const normalizeOptions = (options, prefix = "") => (options || []).map((option) => {
  if (option && typeof option === "object") return option;
  return { label: `${prefix}${option}`, value: option };
});

/**
 * Campos estruturais obrigatórios de qualquer painel de filtros do TMHub.
 * Os campos podem ser controlados pela própria tela; quando não forem, usam o
 * escopo persistente enviado em todas as requisições autenticadas.
 */
export function StandardFilterFields({ date, department, center }) {
  initializePanelFilterStorage();
  const [scope, setScope] = useState(() => ({
    date: readDates(),
    departments: readIds(STORAGE.departments),
    centers: readIds(STORAGE.centers),
  }));

  const updateScope = (name, value) => {
    const next = value || [];
    setScope((current) => ({ ...current, [name]: next }));
    const dateValues = Array.isArray(next) ? next : [next];
    save(STORAGE[name], name === "date" ? dateValues.map((item) => item?.toISOString?.() || item) : next);
    // Range calendars emit once with only the start date; wait for the end
    // before refreshing the current panel.
    if (name === "date" && Array.isArray(next) && next.length > 1 && !next[1]) return;
    window.dispatchEvent(new CustomEvent("tmhub:standard-filters-changed", { detail: { name, value: next } }));
  };

  const controlledDate = date?.value !== undefined ? date.value : scope.date;
  const controlledDepartments = department?.value !== undefined ? department.value : scope.departments;
  const controlledCenters = center?.value !== undefined ? center.value : scope.centers;
  // A tela pode informar as facetas do próprio recorte. Quando `options` foi
  // explicitamente passado (inclusive como lista vazia), nunca voltamos ao
  // catálogo global, pois isso exibiria valores sem registros na tela.
  const departmentOptions = department && Object.prototype.hasOwnProperty.call(department, "options")
    ? department.options
    : [];
  const centerOptions = center && Object.prototype.hasOwnProperty.call(center, "options")
    ? center.options
    : [];
  const onDateChange = (value) => {
    if (!date) updateScope("date", value);
    date?.onChange?.(value);
  };
  const onDepartmentChange = (value) => {
    if (!department) updateScope("departments", value);
    department?.onChange?.(value);
  };
  const onCenterChange = (value) => {
    if (!center) updateScope("centers", value);
    center?.onChange?.(value);
  };
  return <div className="standard-filter-fields">
    <div className="standard-filter-fields__toolbar"><strong>Filtros padrão</strong></div>
    <label className="is-wide"><span>DATA</span><Calendar value={controlledDate} onChange={(event) => onDateChange(event.value)} selectionMode={date?.selectionMode || (date?.view === "month" ? "single" : "range")} view={date?.view || "date"} dateFormat={date?.dateFormat || (date?.view === "month" ? "mm/yy" : "dd/mm/yy")} readOnlyInput showIcon showButtonBar={date?.view !== "month"} hideOnRangeSelection={date?.view !== "month"} placeholder={date?.placeholder || "Selecione o período"} /></label>
    <label><span>DPTO</span><MultiSelect value={controlledDepartments || []} options={normalizeOptions(departmentOptions, "DPTO. ")} optionLabel={department?.optionLabel || "label"} optionValue={department?.optionValue || "value"} onChange={(event) => onDepartmentChange(event.value || [])} placeholder="Todos os departamentos" display="comma" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
    <label><span>CENTRO DE CUSTO</span><MultiSelect value={controlledCenters || []} options={normalizeOptions(centerOptions)} optionLabel={center?.optionLabel || "label"} optionValue={center?.optionValue || "value"} onChange={(event) => onCenterChange(event.value || [])} placeholder="Todos os centros" display="comma" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
  </div>;
}
