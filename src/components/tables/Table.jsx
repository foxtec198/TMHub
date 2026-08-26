// components/Table/index.jsx
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { useId, useState } from "react";
import { Calendar } from "primereact/calendar";
import { FloatLabel } from "primereact/floatlabel";
import { DataTable } from "./DataTable";
import './index.css'

export function Table({
    data = [],
    columns = [],
    loading = false,
    mode = "paginate",
    rows = 5,
    rowsPerPageOptions = [5, 10, 50, 100],
    tableClassName,
    dateValue,
    setRefresh,
    style,
    tableStyle,
    search,
    handleSetDate,
    searchValue,
    onSearchChange,
    emptyTitle,
    emptyMessage,
    emptyDescription,
    emptyIcon,
    emptyAction,
    dataKey,
    expandedRows,
    onRowToggle,
    rowExpansionTemplate,
    onRowClick,
    lazy = false,
    totalRecords,
    first,
    onPageChange,
}) {
    const [globalFilterDash, setGlobalFilterDash] = useState("");
    const searchInputId = useId();
    const dateInputId = useId();
    const resolvedSearchValue = searchValue ?? globalFilterDash;

    const updateSearch = (value) => {
        setGlobalFilterDash(value);
        onSearchChange?.(value);
    };

    const renderResponsiveCell = (column) => (rowData, options) => {
        const content = typeof column.body === "function"
            ? column.body(rowData, options)
            : rowData?.[column.field];

        return (
            <div className="tm-table-cell">
                <span className="tm-table-card-label">{column.mobileHeader || column.header}</span>
                <div className="tm-table-card-value">{content ?? "—"}</div>
            </div>
        );
    };

    const header = search || handleSetDate ? (
        <div className="tm-table-header flex min-w-full justify-content-between align-items-center gap-3">
            {search
                ? <FloatLabel className="mt-3">
                    <InputText
                        id={searchInputId}
                        value={resolvedSearchValue}
                        onChange={(e) => updateSearch(e.target.value)}
                    />
                    <label htmlFor={searchInputId}>Buscar...</label>
                </FloatLabel> : null
            }

            {handleSetDate
                ? <FloatLabel>
                    <Calendar
                        inputId={dateInputId}
                        value={dateValue}
                        onChange={(e) => {
                            handleSetDate(e.value);
                            setRefresh?.((prev) => !prev);
                        }}
                        dateFormat="dd/mm/yy"
                        selectionMode="range"
                        placeholder="Selecione um período."
                        readOnlyInput
                        showButtonBar
                    />
                    <label htmlFor={dateInputId}>Selecione um período</label>
                </FloatLabel>
                : null
            }
        </div>
    ) : undefined;

    return (
        <DataTable
            value={data}
            loading={loading}
            globalFilter={resolvedSearchValue}
            header={header}
            emptyTitle={emptyTitle || emptyMessage}
            emptyDescription={emptyDescription}
            emptyIcon={emptyIcon}
            emptyAction={emptyAction}
            dataKey={dataKey}
            expandedRows={expandedRows}
            onRowToggle={onRowToggle}
            rowExpansionTemplate={rowExpansionTemplate}
            onRowClick={onRowClick}
            paginator={mode === "paginate"}
            rows={rows}
            rowsPerPageOptions={rowsPerPageOptions}
            lazy={lazy}
            totalRecords={lazy ? totalRecords : undefined}
            first={lazy ? first : undefined}
            onPage={onPageChange}

            scrollable
            scrollHeight={mode === "scroll" ? "400px" : undefined}
            tableStyle={{
                minWidth: `${Math.max(columns.length * 180, 800)}px`,
                ...tableStyle,
            }}

            paginatorTemplate="RowsPerPageDropdown CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
            currentPageReportTemplate="Mostrando {first} até {last} de {totalRecords} resultados"
            stripedRows
            style={{
                width: "100%",
                ...style,
            }}
            className={`tm-responsive-table ${tableClassName || ""}`}
        >
            {columns.map((col) => (
                <Column
                    key={col.field || col.header}
                    field={col.field}
                    header={col.header}
                    body={renderResponsiveCell(col)}
                    sortable={col.sortable}
                    style={col.style}
                    className={col.class}
                />
            ))}
        </DataTable>
    );
}
