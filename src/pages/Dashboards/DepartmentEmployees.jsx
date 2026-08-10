// Colab. por DTPO.

// Utils
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";

// Widgets
import { Accordion, AccordionTab } from "primereact/accordion";
import { Button } from "primereact/button";
import { Divider } from "primereact/divider";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { PageHeader } from "../../components/PageHeader";
import { exportDepartmentEmployeesXlsx } from "../../utils/exportDepartmentEmployeesXlsx";

// Styles
import "./departmentEmployees.css";

const EMPTY_FILTERS = {
    departamentos: [],
    centros: [],
    supervisores: [],
    cidades: [],
    situacoes: [],
    cargos: [],
    colaboradores: [],
};

function uniqueOptions(items, valueKey, labelKey = valueKey) {
    const options = new Map();

    items.forEach((item) => {
        const value = item[valueKey];
        const label = item[labelKey];
        if (value !== null && value !== undefined && label) {
            options.set(value, { value, label: String(label) });
        }
    });

    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
}

function collaboratorOptions(items) {
    return [...new Map(items.map((employee) => [employee.id, {
        value: employee.id,
        label: `${employee.matricula || "Sem matrícula"} - ${employee.nome || "Colaborador"}`,
    }])).values()]
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
}

function formatAdmission(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

function isDismissed(employee) {
    return Number(employee.situacao_id) === 8;
}

function groupByCenter(employees) {
    const centers = new Map();

    employees.forEach((employee) => {
        const centerId = employee.centro_id || "sem-centro";
        if (!centers.has(centerId)) centers.set(centerId, []);
        centers.get(centerId).push(employee);
    });

    return [...centers.entries()];
}

function DepartmentHeader({ department, employees }) {
    const dismissed = employees.filter(isDismissed).length;
    const active = employees.length - dismissed;

    return (
        <div className="department-header">
            <strong>Departamento {department}</strong>
            <span className="department-counter department-counter--active">
                <i className="pi pi-circle-fill" /> Ativos: {active}
            </span>
            <span className="department-counter department-counter--dismissed">
                <i className="pi pi-circle-fill" /> Demitidos: {dismissed}
            </span>
        </div>
    );
}

export function DepartmentEmployeesDashboard() {
    const filterPanel = useRef(null);
    const [employees, setEmployees] = useState([]);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        async function loadEmployees() {
            try {
                setLoading(true);
                const response = await connect.post("/dash/colaboradores-departamento", {});
                setEmployees(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                showToast(
                    "error", "Erro ao carregar colaboradores",
                    error.response?.data?.message || error.response?.data || "Não foi possível carregar o dashboard."
                );
            } finally {
                setLoading(false);
            }
        }
        loadEmployees();
    }, [showToast]);

    const options = useMemo(() => ({
        departamentos: uniqueOptions(employees, "departamento"),
        centros: uniqueOptions(employees, "centro_id", "centro_custo"),
        supervisores: uniqueOptions(employees, "supervisor_id", "supervisor"),
        cidades: uniqueOptions(employees, "cidade_id", "cidade"),
        situacoes: uniqueOptions(employees, "situacao_id", "situacao"),
        cargos: uniqueOptions(employees, "cargo", "cargo"),
        colaboradores: collaboratorOptions(employees),
    }), [employees]);

    const filteredEmployees = useMemo(() => employees.filter((employee) => (
        (!filters.departamentos.length || filters.departamentos.includes(employee.departamento))
        && (!filters.centros.length || filters.centros.includes(employee.centro_id))
        && (!filters.supervisores.length || filters.supervisores.includes(employee.supervisor_id))
        && (!filters.cidades.length || filters.cidades.includes(employee.cidade_id))
        && (!filters.situacoes.length || filters.situacoes.includes(employee.situacao_id))
        && (!filters.cargos.length || filters.cargos.includes(employee.cargo))
        && (!filters.colaboradores.length || filters.colaboradores.includes(employee.id))
    )), [employees, filters]);

    const departments = useMemo(() => {
        const grouped = new Map();

        filteredEmployees.forEach((employee) => {
            const department = employee.departamento || "Sem departamento";
            if (!grouped.has(department)) grouped.set(department, []);
            grouped.get(department).push(employee);
        });

        return [...grouped.entries()].sort(([a], [b]) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));
    }, [filteredEmployees]);

    const activeFilterCount = Object.values(filters).filter((value) => value.length).length;

    const setFilter = (name, value) => {
        setFilters((current) => ({ ...current, [name]: value || [] }));
    };

    const exportEmployees = () => {
        if (!filteredEmployees.length) {
            showToast("warn", "Exportação", "Não há colaboradores para os filtros selecionados.");
            return;
        }
        exportDepartmentEmployeesXlsx(filteredEmployees);
        showToast("success", "Exportação", `${filteredEmployees.length} colaborador(es) exportado(s).`);
    };

    return (
        <section className="department-dashboard">
            <PageHeader
                section="Dashboards"
                title="Colaboradores por departamento"
                description="Visualize a distribuição dos colaboradores por contrato e departamento."
                actions={
                    <div className="department-dashboard__actions">
                        <Button
                            type="button"
                            icon="pi pi-file-excel"
                            label="Exportar"
                            outlined
                            disabled={!filteredEmployees.length}
                            onClick={exportEmployees}
                        />
                        <Button
                            type="button"
                            icon="pi pi-filter-fill"
                            label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"}
                            aria-label="Abrir filtros do dashboard"
                            onClick={(event) => filterPanel.current?.toggle(event)}
                        />
                    </div>
                }
            />

            <div className="department-dashboard__summary">
                <div><span>Departamentos</span><strong>{departments.length}</strong></div>
                <div><span>Colaboradores</span><strong>{filteredEmployees.length}</strong></div>
                <div><span>Ativos</span><strong>{filteredEmployees.filter((employee) => !isDismissed(employee)).length}</strong></div>
                <div><span>Demitidos</span><strong>{filteredEmployees.filter(isDismissed).length}</strong></div>
            </div>

            <OverlayPanel ref={filterPanel} className="department-filter-panel">
                <div className="department-filter-panel__title">
                    <div>
                        <strong>Filtrar dashboard</strong>
                        <span>Combine um ou mais filtros.</span>
                    </div>
                    <Button
                        type="button"
                        icon="pi pi-filter-slash"
                        text
                        rounded
                        aria-label="Limpar filtros"
                        onClick={() => setFilters(EMPTY_FILTERS)}
                    />
                </div>
                <Divider />

                {[
                    ["departamentos", "Departamentos"],
                    ["centros", "Centros de custo"],
                    ["supervisores", "Supervisores"],
                    ["cidades", "Cidades"],
                    ["situacoes", "Situações"],
                    ["cargos", "Cargos"],
                    ["colaboradores", "Colaboradores"],
                ].map(([name, label]) => (
                    <label className="department-filter-field" key={name}>
                        <span>{label}</span>
                        <MultiSelect
                            value={filters[name]}
                            options={options[name]}
                            onChange={(event) => setFilter(name, event.value)}
                            optionLabel="label"
                            optionValue="value"
                            placeholder={`Todos os ${label.toLowerCase()}`}
                            display="chip"
                            filter
                            className="w-full"
                            panelClassName="department-filter-dropdown"
                        />
                    </label>
                ))}
            </OverlayPanel>

            <div className="department-dashboard__content">
                {loading ? (
                    <div className="department-dashboard__state"><i className="pi pi-spin pi-spinner" /> Carregando colaboradores...</div>
                ) : departments.length ? (
                    <Accordion multiple activeIndex={[0]}>
                        {departments.map(([department, departmentEmployees]) => {
                            const centers = groupByCenter(departmentEmployees);

                            return (
                                <AccordionTab
                                    key={department}
                                    header={<DepartmentHeader department={department} employees={departmentEmployees} />}
                                >
                                    <div className="department-centers">
                                        {centers.map(([centerId, centerEmployees]) => {
                                            const center = centerEmployees[0];
                                            return (
                                                <article className="department-center" key={centerId}>
                                                    <header className="department-center__header">
                                                        <i className="pi pi-building" />
                                                        <strong>{center.centro_custo || "Centro de custo não informado"}</strong>
                                                        <span>{center.supervisor || "Sem supervisor"}</span>
                                                        <span>{center.cidade || "Cidade não informada"}</span>
                                                    </header>

                                                    <div className="department-employees">
                                                        {centerEmployees.map((employee) => (
                                                            <div className="department-employee" key={employee.id}>
                                                                <i className="pi pi-arrow-right" aria-hidden="true" />
                                                                <div className="department-employee__identity">
                                                                    <strong>{employee.nome}</strong>
                                                                    <span>Matrícula {employee.matricula || "—"}</span>
                                                                </div>
                                                                <span className="department-employee__admission">
                                                                    Admissão {formatAdmission(employee.data_admissao)}
                                                                </span>
                                                                <span className={`department-employee__status ${isDismissed(employee) ? "is-dismissed" : "is-active"}`}>
                                                                    {employee.situacao || "Não informada"}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </AccordionTab>
                            );
                        })}
                    </Accordion>
                ) : (
                    <div className="department-dashboard__state">Nenhum colaborador encontrado para os filtros selecionados.</div>
                )}
            </div>
        </section>
    );
}
