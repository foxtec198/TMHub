import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MultiSelect } from "primereact/multiselect";

const CombinedFiltersContext = createContext(null);

function buildEmptyFilters(definitions) {
  return Object.keys(definitions).reduce((filters, name) => {
    filters[name] = [];
    return filters;
  }, {});
}

function sortOptions(options) {
  return options.sort((left, right) =>
    String(left.label).localeCompare(String(right.label), "pt-BR", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

function buildOptions(data, definition) {
  if (definition.options) {
    const availableValues = new Set(
      data
        .map((item) => definition.getValue(item))
        .filter((value) => value !== null && value !== undefined && value !== ""),
    );

    return definition.options.filter((option) => availableValues.has(option.value));
  }

  const options = new Map();

  data.forEach((item) => {
    const value = definition.getValue(item);
    if (value === null || value === undefined || value === "") return;

    const label = definition.getLabel
      ? definition.getLabel(item)
      : String(value);

    if (!options.has(value)) {
      options.set(value, { value, label: String(label) });
    }
  });

  return sortOptions([...options.values()]);
}

export function CombinedFiltersProvider({ definitions, children }) {
  const emptyFilters = useMemo(
    () => buildEmptyFilters(definitions),
    [definitions],
  );

  const [filters, setFilters] = useState(emptyFilters);

  useEffect(() => {
    setFilters((current) => {
      const next = buildEmptyFilters(definitions);

      Object.keys(next).forEach((name) => {
        next[name] = Array.isArray(current[name]) ? current[name] : [];
      });

      return next;
    });
  }, [definitions]);

  const setFilter = useCallback((name, values) => {
    setFilters((current) => ({
      ...current,
      [name]: Array.isArray(values) ? values : [],
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(buildEmptyFilters(definitions));
  }, [definitions]);

  const value = useMemo(() => ({
    definitions,
    filters,
    setFilter,
    setFilters,
    clearFilters,
  }), [definitions, filters, setFilter, clearFilters]);

  return (
    <CombinedFiltersContext.Provider value={value}>
      {children}
    </CombinedFiltersContext.Provider>
  );
}

export function useCombinedFilters(data = []) {
  const context = useContext(CombinedFiltersContext);

  if (!context) {
    throw new Error(
      "useCombinedFilters deve ser usado dentro de CombinedFiltersProvider.",
    );
  }

  const {
    definitions,
    filters,
    setFilters,
    setFilter,
    clearFilters,
  } = context;

  const matchesFilters = useCallback((item, ignoredFilter = null) => (
    Object.entries(definitions).every(([name, definition]) => {
      if (name === ignoredFilter) return true;

      const selectedValues = filters[name] || [];
      if (!selectedValues.length) return true;

      return selectedValues.includes(definition.getValue(item));
    })
  ), [definitions, filters]);

  const options = useMemo(() => (
    Object.entries(definitions).reduce((result, [name, definition]) => {
      const compatibleData = data.filter((item) => matchesFilters(item, name));
      result[name] = buildOptions(compatibleData, definition);
      return result;
    }, {})
  ), [data, definitions, matchesFilters]);

  useEffect(() => {
    setFilters((current) => {
      let changed = false;
      const next = { ...current };

      Object.keys(definitions).forEach((name) => {
        const availableValues = new Set(
          (options[name] || []).map((option) => option.value),
        );

        const selectedValues = current[name] || [];
        const validValues = selectedValues.filter((value) =>
          availableValues.has(value),
        );

        if (validValues.length !== selectedValues.length) {
          next[name] = validValues;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [definitions, options, setFilters]);

  const filteredData = useMemo(
    () => data.filter((item) => matchesFilters(item)),
    [data, matchesFilters],
  );

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((values) => values.length > 0).length,
    [filters],
  );

  return {
    filters,
    options,
    setFilter,
    clearFilters,
    filteredData,
    activeFilterCount,
  };
}

export function CombinedMultiSelect({
  name,
  label,
  options = [],
  placeholder,
  className,
  panelClassName,
  display = "chip",
  filter = true,
}) {
  const context = useContext(CombinedFiltersContext);

  if (!context) {
    throw new Error(
      "CombinedMultiSelect deve ser usado dentro de CombinedFiltersProvider.",
    );
  }

  const { filters, setFilter } = context;

  return (
    <label className={className}>
      <span>{label}</span>
      <MultiSelect
        value={filters[name] || []}
        options={options}
        onChange={(event) => setFilter(name, event.value)}
        optionLabel="label"
        optionValue="value"
        placeholder={placeholder}
        display={display}
        filter={filter}
        className="w-full"
        panelClassName={panelClassName}
      />
    </label>
  );
}
