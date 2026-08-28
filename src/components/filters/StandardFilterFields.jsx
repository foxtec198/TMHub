import { useEffect, useMemo, useState } from "react";
import { Calendar } from "primereact/calendar";
import { MultiSelect } from "primereact/multiselect";
import { Button } from "primereact/button";
import { AppIcon } from "../icons/AppIcon";
import connect from "../../utils/request";
import "./standard-filter-fields.css";

const STORAGE = {
  date: "standard_filter_date",
  departments: "selected_department_ids",
  centers: "selected_cost_center_ids",
  companies: "selected_company_ids",
  branches: "selected_filial_ids",
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
  const [catalog, setCatalog] = useState({ companies: [], branches: [], centers: [] });
  const [scope, setScope] = useState(() => ({
    date: readDates(),
    departments: readIds(STORAGE.departments),
    centers: readIds(STORAGE.centers),
    companies: readIds(STORAGE.companies),
    branches: readIds(STORAGE.branches),
  }));

  useEffect(() => {
    let active = true;
    Promise.all([
      connect.get("/centro/empresas", { skipStandardFilters: true }),
      connect.get("/filiais", { skipStandardFilters: true }),
      connect.get("/centro", { params: { paginado: false }, skipStandardFilters: true }),
    ]).then(([companies, branches, centers]) => {
      if (!active) return;
      setCatalog({
        companies: (companies.data || []).filter((item) => item.ativa !== false),
        branches: (branches.data || []).filter((item) => item.ativa !== false),
        centers: Array.isArray(centers.data) ? centers.data : [],
      });
    }).catch(() => {
      if (active) setCatalog({ companies: [], branches: [], centers: [] });
    });
    return () => { active = false; };
  }, []);

  const scopedCenters = useMemo(() => catalog.centers.filter((item) => (
    !scope.companies.length || scope.companies.includes(Number(item.empresa_id))
  )), [catalog.centers, scope.companies]);

  const globalDepartments = useMemo(() => [...new Set(scopedCenters
    .map((item) => item.departamento)
    .filter((value) => value !== null && value !== undefined))]
    .sort((a, b) => Number(a) - Number(b))
    .map((value) => ({ label: `DPTO. ${value}`, value })), [scopedCenters]);

  const globalCenters = useMemo(() => scopedCenters.map((item) => ({
    label: `${item.numero} - ${item.nome || item.local}`,
    value: item.id,
    departamento: item.departamento,
  })).filter((item) => !scope.departments.length || scope.departments.includes(Number(item.departamento))), [scopedCenters, scope.departments]);

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

  const onDateChange = (value) => {
    updateScope("date", value);
    date?.onChange?.(value);
  };
  const onDepartmentChange = (value) => {
    updateScope("departments", value);
    department?.onChange?.(value);
  };
  const onCenterChange = (value) => {
    updateScope("centers", value);
    center?.onChange?.(value);
  };

  const clearPanelFilters = () => {
    const now = new Date();
    const defaultDate = date?.view === "month"
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : [new Date(now.getFullYear(), now.getMonth(), 1), now];
    const resetDate = date ? (date.defaultValue ?? defaultDate) : [];
    // Empresa e filial são escopo global e só podem ser limpas pelo seletor
    // global do layout. O botão deste painel atua apenas nos filtros locais.
    const empty = {
      date: resetDate,
      departments: [],
      centers: [],
      companies: scope.companies,
      branches: scope.branches,
    };
    setScope(empty);
    date?.onChange?.(resetDate);
    department?.onChange?.([]);
    center?.onChange?.([]);
    [STORAGE.date, STORAGE.departments, STORAGE.centers].forEach((key) => localStorage.removeItem(key));
    window.dispatchEvent(new CustomEvent("tmhub:standard-filters-changed", { detail: { name: "clear" } }));
  };

  return <div className="standard-filter-fields">
    <div className="standard-filter-fields__toolbar"><strong>Filtros padrão</strong><Button type="button" label="Limpar locais" icon={<AppIcon name="filter-off" />} text size="small" aria-label="Limpar filtros locais" onClick={clearPanelFilters} /></div>
    <label className="is-wide"><span>DATA</span><Calendar value={controlledDate} onChange={(event) => onDateChange(event.value)} selectionMode={date?.selectionMode || "range"} view={date?.view || "date"} dateFormat={date?.dateFormat || (date?.view === "month" ? "mm/yy" : "dd/mm/yy")} readOnlyInput showIcon showButtonBar={date?.view !== "month"} hideOnRangeSelection={date?.view !== "month"} placeholder={date?.placeholder || "Selecione o período"} /></label>
    <label><span>DPTO</span><MultiSelect value={controlledDepartments || []} options={normalizeOptions(department?.options || globalDepartments, "DPTO. ")} optionLabel={department?.optionLabel || "label"} optionValue={department?.optionValue || "value"} onChange={(event) => onDepartmentChange(event.value || [])} placeholder="Todos os departamentos" display="comma" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
    <label><span>CENTRO DE CUSTO</span><MultiSelect value={controlledCenters || []} options={normalizeOptions(center?.options || globalCenters)} optionLabel={center?.optionLabel || "label"} optionValue={center?.optionValue || "value"} onChange={(event) => onCenterChange(event.value || [])} placeholder="Todos os centros" display="comma" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
    <label><span>EMPRESA</span><MultiSelect value={scope.companies} options={catalog.companies} optionLabel="nome" optionValue="id" onChange={(event) => updateScope("companies", event.value || [])} placeholder="Todas as empresas" display="comma" filter maxSelectedLabels={2} selectedItemsLabel="{0} selecionadas" /></label>
    <label><span>FILIAL</span><MultiSelect value={scope.branches} options={catalog.branches} optionLabel="nome" optionValue="id" onChange={(event) => updateScope("branches", event.value || [])} placeholder="Todas as filiais" display="comma" filter maxSelectedLabels={2} selectedItemsLabel="{0} selecionadas" /></label>
  </div>;
}
