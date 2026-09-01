import { useEffect, useMemo, useRef, useState } from "react";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import connect from "../utils/request";
import "./cost-center-dropdown.css";

const DEFAULT_LIMIT = 50;
const DEFAULT_DEBOUNCE = 350;

function normalizeCenter(center) {
  if (!center) return null;
  const number = center.numero ?? center.centro_id;
  const local = String(center.local || center.nome || center.label || "Centro sem nome").trim();
  return {
    ...center,
    id: Number(center.id ?? center.value),
    label: number ? `${number} - ${local}` : local,
  };
}

function mergeOptions(selected, remote) {
  const byId = new Map();
  [...selected, ...remote].forEach((center) => {
    const normalized = normalizeCenter(center);
    if (normalized && Number.isFinite(normalized.id)) byId.set(normalized.id, normalized);
  });
  return [...byId.values()];
}

function CostCenterOption({ center, selected = false }) {
  if (!center) return null;
  return <div className={`cost-center-dropdown-option${selected ? " is-selected" : ""}`}>
    <strong>{center.label}</strong>
    <small>{center.empresa_nome || "Empresa não informada"} · DPTO. {center.departamento ?? "—"}</small>
  </div>;
}

/**
 * Busca remota padrão de centros de custo. Apenas 50 itens são carregados por
 * consulta; opções já selecionadas permanecem disponíveis fora desse recorte.
 */
export function CostCenterDropdown({
  value,
  onChange,
  selectedOption = null,
  selectedOptions = [],
  multiple = false,
  queryParams = {},
  excludeDepartments = [],
  limit = DEFAULT_LIMIT,
  debounce = DEFAULT_DEBOUNCE,
  minSearch = 0,
  inputId,
  className = "",
  placeholder = "Selecione um centro de custo",
  emptyMessage = "Nenhum centro de custo encontrado",
  showClear = true,
  disabled = false,
  appendTo,
  panelStyle,
  onError,
  skipStandardFilters = false,
}) {
  const [options, setOptions] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedRef = useRef([]);
  const requestIdRef = useRef(0);
  const serializedParams = useMemo(() => JSON.stringify(queryParams), [queryParams]);
  const serializedExcluded = useMemo(() => JSON.stringify(excludeDepartments), [excludeDepartments]);
  const serializedSelected = useMemo(
    () => JSON.stringify(multiple ? selectedOptions : [selectedOption].filter(Boolean)),
    [multiple, selectedOption, selectedOptions],
  );
  const selectedFromProps = useMemo(
    () => mergeOptions([], JSON.parse(serializedSelected || "[]")),
    [serializedSelected],
  );
  const serializedValue = useMemo(() => JSON.stringify(multiple ? (value || []) : [value].filter((item) => item != null)), [multiple, value]);

  useEffect(() => {
    selectedRef.current = selectedFromProps;
  }, [selectedFromProps]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const normalizedFilter = filter.trim();
    if (normalizedFilter.length < minSearch) {
      setOptions(selectedRef.current);
      return () => { requestIdRef.current += 1; };
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const selectedIds = JSON.parse(serializedValue || "[]").map(Number).filter(Number.isFinite);
        const knownIds = new Set(selectedFromProps.map((center) => center.id));
        const missingIds = selectedIds.filter((id) => !knownIds.has(id));
        const [searchResponse, selectedResponse] = await Promise.all([
          connect.get("/centro", {
            params: { ...queryParams, search: normalizedFilter, limit: Math.min(limit, DEFAULT_LIMIT) },
            skipStandardFilters,
          }),
          missingIds.length
            ? connect.get("/centro", { params: { ids: missingIds.join(",") }, skipStandardFilters })
            : Promise.resolve({ data: [] }),
        ]);
        if (requestId !== requestIdRef.current) return;
        const excluded = new Set(JSON.parse(serializedExcluded || "[]").map(Number));
        const rows = (Array.isArray(searchResponse.data) ? searchResponse.data : searchResponse.data?.items || [])
          .filter((center) => !excluded.has(Number(center.departamento)));
        const hydrated = Array.isArray(selectedResponse.data) ? selectedResponse.data : [];
        setOptions(mergeOptions(selectedFromProps, [...hydrated, ...rows]));
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        setOptions(selectedRef.current);
        onError?.(error);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, normalizedFilter ? debounce : 0);

    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
    // serializedParams representa as propriedades individuais de queryParams.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounce, filter, limit, minSearch, selectedFromProps, serializedExcluded, serializedParams, serializedValue, skipStandardFilters]);

  const handleChange = (event) => {
    const values = multiple ? (event.value || []) : event.value;
    const ids = new Set((multiple ? values : [values]).filter((item) => item != null).map(Number));
    const chosen = options.filter((center) => ids.has(center.id));
    selectedRef.current = chosen;
    onChange?.(values, multiple ? chosen : chosen[0] || null);
  };

  const commonProps = {
    inputId,
    value,
    options: mergeOptions(selectedFromProps, options),
    optionLabel: "label",
    optionValue: "id",
    onChange: handleChange,
    onFilter: (event) => setFilter(event.filter || ""),
    filter: true,
    resetFilterOnHide: true,
    loading,
    itemTemplate: (option) => <CostCenterOption center={option} />,
    className: `${className} cost-center-dropdown`.trim(),
    placeholder,
    emptyMessage: filter.trim().length < minSearch ? `Digite pelo menos ${minSearch} caracteres para buscar` : emptyMessage,
    emptyFilterMessage: filter.trim().length < minSearch ? `Digite pelo menos ${minSearch} caracteres para buscar` : emptyMessage,
    showClear,
    disabled,
    appendTo,
    panelStyle,
  };

  if (multiple) {
    return <MultiSelect
      {...commonProps}
      display="comma"
      maxSelectedLabels={2}
      selectedItemsLabel="{0} centros selecionados"
    />;
  }

  return <Dropdown
    {...commonProps}
    virtualScrollerOptions={{ itemSize: 58 }}
    valueTemplate={(option, props) => option
      ? <CostCenterOption center={option} selected />
      : <span className="p-placeholder">{props.placeholder}</span>}
  />;
}

export function CostCenterMultiSelect(props) {
  return <CostCenterDropdown {...props} multiple />;
}
