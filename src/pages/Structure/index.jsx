import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { StandardFilterButton } from "../../components/filters/StandardFilterButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { PageHeader } from "../../components/PageHeader";
import { RoutineDialog } from "../../components/TMOps/RoutineDialog";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import { can } from "../../utils/permissions";
import "./index.css";

const EMPTY_FORM = {
    tipo: "",
    nome: "",
    categoria: "",
    patrimonio: "",
    local_id: null,
    parent_id: null,
    descricao: "",
};

const ASSET_CATEGORY_OPTIONS = [
    { label: "Máquina ou equipamento", value: "MÁQUINA/EQUIPAMENTO" },
    { label: "Móvel ou utensílio", value: "MÓVEL/UTENSÍLIO" },
    { label: "Veículo", value: "VEÍCULO" },
];

const formatRoutineDate = (value) => {
    if (!value) return "Sem próxima execução";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Sem próxima execução";
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
};

const locationOptionsFor = (locations = []) => {
    const locationsById = new Map(locations.map((location) => [location.id, location]));

    const labelFor = (location) => {
        const names = [location.nome];
        const visited = new Set([location.id]);
        let parent = locationsById.get(location.parent_id);
        while (parent && !visited.has(parent.id)) {
            names.unshift(parent.nome);
            visited.add(parent.id);
            parent = locationsById.get(parent.parent_id);
        }
        return names.join(" › ");
    };

    return locations
        .map((location) => ({ ...location, label: labelFor(location) }))
        .sort((left, right) => left.label.localeCompare(right.label, "pt-BR", { numeric: true }));
};

export function Structure() {
    const [departments, setDepartments] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [dialog, setDialog] = useState(null);
    const [supervisorDialog, setSupervisorDialog] = useState(null);
    const [selectedSupervisorIds, setSelectedSupervisorIds] = useState([]);
    const [companyDialog, setCompanyDialog] = useState(null);
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [routineDialog, setRoutineDialog] = useState(null);
    const [dragLocationId, setDragLocationId] = useState(null);
    const [selectedContractId, setSelectedContractId] = useState(null);
    const [selectedLocationId, setSelectedLocationId] = useState(null);
    const [expandedLocationIds, setExpandedLocationIds] = useState(new Set());
    const [expandedCompanyIds, setExpandedCompanyIds] = useState(new Set());
    const [expandedBranchIds, setExpandedBranchIds] = useState(new Set());
    const [expandedHierarchyDepartmentIds, setExpandedHierarchyDepartmentIds] = useState(new Set());
    const [form, setForm] = useState(EMPTY_FORM);
    const [refresh, setRefresh] = useState(0);
    const [filters, setFilters] = useState({
        search: "",
        departments: [],
        contracts: [],
        supervisor: null,
        itemType: null,
    });
    const filterPanel = useRef(null);
    const setLoading = useLoading();
    const { showToast } = useToast();
    const canEdit = can("estrutura", "edit");
    const canCreateRoutine = can("tm_ops", "create");
    const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

    useEffect(() => {
        let active = true;
        setLoading(true);
        connect.get("/estrutura/navegador")
            .then((structureResponse) => {
                if (!active) return;
                setDepartments(Array.isArray(structureResponse.data) ? structureResponse.data : []);
            })
            .catch((error) => showToast(
                "error",
                "Estrutura",
                error.response?.data || "Não foi possível carregar a estrutura.",
            ))
            .finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [refresh, setLoading, showToast]);

    const filterOptions = useMemo(() => {
        const contracts = departments.flatMap((department) => department.contratos);
        const unique = (values) => [...new Set(values.filter(Boolean))]
            .sort((left, right) => String(left).localeCompare(String(right), "pt-BR", { numeric: true }))
            .map((value) => ({ label: String(value), value }));
        return {
            departments: unique(departments.map((item) => item.departamento)),
            contracts: contracts
                .map((item) => ({ label: `${item.id} - ${item.contrato}`, value: item.id }))
                .sort((left, right) => left.label.localeCompare(right.label, "pt-BR", { numeric: true })),
            supervisors: [...new Map(
                contracts
                    .flatMap((item) => item.supervisores || [])
                    .map((supervisor) => [supervisor.id, { label: supervisor.nome, value: supervisor.id }]),
            ).values()].sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
        };
    }, [departments]);

    const filteredDepartments = useMemo(() => {
        const query = filters.search.trim().toLocaleLowerCase("pt-BR");
        return departments.map((department) => ({
            ...department,
            contratos: department.contratos.filter((contract) => {
                if (filters.departments.length && !filters.departments.includes(department.departamento)) return false;
                if (filters.contracts.length && !filters.contracts.includes(contract.id)) return false;
                if (filters.supervisor && !contract.supervisores?.some((supervisor) => supervisor.id === filters.supervisor)) return false;
                if (filters.itemType === "local" && !(contract.locais_count ?? contract.locais.length)) return false;
                if (filters.itemType === "ativo" && !(contract.ativos_count ?? contract.ativos.length)) return false;
                if (!query) return true;
                return [
                    department.departamento,
                    contract.id,
                    contract.contrato,
                    contract.supervisor,
                    ...contract.locais.flatMap((item) => [item.nome, item.descricao]),
                    ...contract.ativos.flatMap((item) => [
                        item.nome, item.categoria, item.patrimonio, item.descricao,
                    ]),
                ].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(query));
            }),
        })).filter((department) => department.contratos.length);
    }, [departments, filters]);

    const visibleContracts = useMemo(
        () => filteredDepartments.flatMap((department) => department.contratos.map((contract) => ({
            ...contract,
            departamento: department.departamento,
        }))),
        [filteredDepartments],
    );

    const effectiveSelectedContractId = useMemo(
        () => (
            visibleContracts.some((contract) => contract.id === selectedContractId)
                ? selectedContractId
                : visibleContracts[0]?.id || null
        ),
        [selectedContractId, visibleContracts],
    );

    const selectedContract = useMemo(
        () => visibleContracts.find((contract) => contract.id === effectiveSelectedContractId) || null,
        [effectiveSelectedContractId, visibleContracts],
    );

    const contractHierarchy = useMemo(() => {
        const companiesById = new Map();
        visibleContracts.forEach((contract) => {
            const companyId = contract.empresa_id ?? "without-company";
            const companyName = contract.empresa_nome || "SEM EMPRESA";
            if (!companiesById.has(companyId)) {
                companiesById.set(companyId, { id: companyId, nome: companyName, filiais: new Map() });
            }
            const company = companiesById.get(companyId);
            const contractBranches = contract.filiais || [];
            const branches = contractBranches.filter((branch) => (
                Number(branch.id) !== 1 && String(branch.nome || "").toLocaleUpperCase("pt-BR") !== "MATRIZ"
            ));
            if (contractBranches.length && !branches.length) return;
            const displayBranches = branches.length
                ? branches
                : [{ id: `without-branch-${companyId}`, nome: "Sem filial vinculada" }];
            displayBranches.forEach((branch) => {
                const branchId = String(branch.id);
                if (!company.filiais.has(branchId)) {
                    company.filiais.set(branchId, { id: branchId, nome: branch.nome, departamentos: new Map() });
                }
                const departmentId = String(contract.departamento || "SEM DEPARTAMENTO");
                const branchEntry = company.filiais.get(branchId);
                if (!branchEntry.departamentos.has(departmentId)) {
                    branchEntry.departamentos.set(departmentId, { id: departmentId, contratos: [] });
                }
                branchEntry.departamentos.get(departmentId).contratos.push(contract);
            });
        });
        return [...companiesById.values()]
            .map((company) => ({
                ...company,
                filiais: [...company.filiais.values()]
                    .map((branch) => ({
                        ...branch,
                        departamentos: [...branch.departamentos.values()]
                            .map((department) => ({
                                ...department,
                                contratos: department.contratos.sort((left, right) => String(left.contrato || "").localeCompare(String(right.contrato || ""), "pt-BR", { numeric: true })),
                            }))
                            .sort((left, right) => left.id.localeCompare(right.id, "pt-BR", { numeric: true })),
                    }))
                    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR", { numeric: true })),
            }))
            .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR", { numeric: true }));
    }, [visibleContracts]);

    const effectiveSelectedLocationId = useMemo(
        () => (
            selectedContract?.locais.some((location) => location.id === selectedLocationId)
                ? selectedLocationId
                : selectedContract?.estrutura?.[0]?.id || selectedContract?.locais[0]?.id || null
        ),
        [selectedContract, selectedLocationId],
    );

    const selectedLocation = useMemo(
        () => selectedContract?.locais.find((location) => location.id === effectiveSelectedLocationId) || null,
        [effectiveSelectedLocationId, selectedContract],
    );

    const dialogLocationOptions = useMemo(
        () => locationOptionsFor(dialog?.locais),
        [dialog],
    );

    const selectedLocationAssets = useMemo(
        () => selectedContract?.ativos.filter((asset) => asset.local_id === effectiveSelectedLocationId) || [],
        [effectiveSelectedLocationId, selectedContract],
    );

    const unassignedAssets = useMemo(
        () => selectedContract?.ativos.filter((asset) => !asset.local_id) || [],
        [selectedContract],
    );

    useEffect(() => {
        if (!effectiveSelectedContractId) return undefined;
        let active = true;
        connect.get(`/estrutura/contratos/${effectiveSelectedContractId}`)
            .then(({ data }) => {
                if (!active || !data?.contrato) return;
                setDepartments((current) => current.map((department) => ({
                    ...department,
                    contratos: department.contratos.map((contract) => (
                        contract.id === effectiveSelectedContractId
                            ? { ...contract, ...data.contrato }
                            : contract
                    )),
                })));
            })
            .catch((error) => active && showToast(
                "error",
                "Estrutura",
                error.response?.data || "Não foi possível carregar o contrato selecionado.",
            ));
        return () => { active = false; };
    }, [effectiveSelectedContractId, refresh, showToast]);

    const activeFilterCount = Object.values(filters).filter((value) => value !== null && value !== "").length;
    const clearFilters = () => setFilters({
        search: "",
        departments: [],
        contracts: [],
        supervisor: null,
        itemType: null,
    });

    const openCreate = (event, contract) => {
        event?.stopPropagation();
        setDialog(contract);
        setForm(EMPTY_FORM);
    };

    const openSubstructureCreate = (event, contract, parent) => {
        event?.stopPropagation();
        setExpandedLocationIds((current) => new Set([...current, parent.id]));
        setDialog(contract);
        setForm({ ...EMPTY_FORM, tipo: "local", parent_id: parent.id });
    };

    const moveLocation = async (locationId, parentId) => {
        if (!locationId || locationId === parentId) return;
        setLoading(true);
        try {
            await connect.patch(`/estrutura/locais/${locationId}`, { parent_id: parentId });
            setRefresh((value) => value + 1);
        } catch (error) { showToast("error", "Estrutura", error.response?.data || "Não foi possível mover a estrutura."); }
        finally { setLoading(false); setDragLocationId(null); }
    };

    const openRoutineCreate = (event, contract, location) => {
        event?.stopPropagation();
        setRoutineDialog({ contract, location });
    };

    const openSupervisorEdit = async (event, contract) => {
        event?.stopPropagation();
        setSupervisorDialog(contract);
        setSelectedSupervisorIds(contract.supervisor_usuario_ids || []);
        setLoading(true);
        try {
            const { data } = await connect.get("/estrutura/supervisores", { params: { centro_id: contract.id } });
            setSupervisors(Array.isArray(data) ? data : []);
        } catch (error) {
            showToast("error", "Estrutura", error.response?.data || "Não foi possível carregar os supervisores.");
        } finally {
            setLoading(false);
        }
    };

    const openCompanyEdit = async (event, contract) => {
        event?.stopPropagation();
        setCompanyDialog(contract);
        setSelectedCompanyId(contract.empresa_id || null);
        setLoading(true);
        try {
            const { data } = await connect.get("/centro/empresas", { skipStandardFilters: true });
            setCompanies((Array.isArray(data) ? data : []).filter((company) => company.ativa));
        } catch (error) {
            showToast("error", "Estrutura", error.response?.data || "Não foi possível carregar as empresas.");
        } finally {
            setLoading(false);
        }
    };

    const updateCompany = async () => {
        if (!companyDialog || !selectedCompanyId) {
            showToast("warn", "Estrutura", "Selecione uma empresa.");
            return;
        }
        setLoading(true);
        try {
            const { data } = await connect.patch(
                `/estrutura/contratos/${companyDialog.id}/empresa`,
                { empresa_id: selectedCompanyId },
            );
            setDepartments((current) => current.map((department) => ({
                ...department,
                contratos: department.contratos.map((contract) => (
                    contract.id === data.contrato.id ? { ...contract, ...data.contrato } : contract
                )),
            })));
            setCompanyDialog(null);
            showToast("success", "Estrutura", data.message);
        } catch (error) {
            showToast("error", "Estrutura", error.response?.data || "Não foi possível alterar a empresa.");
        } finally {
            setLoading(false);
        }
    };

    const updateSupervisor = async () => {
        if (!supervisorDialog || !selectedSupervisorIds.length) {
            showToast("warn", "Estrutura", "Selecione ao menos um supervisor.");
            return;
        }
        setLoading(true);
        try {
            const { data } = await connect.patch(
                `/estrutura/contratos/${supervisorDialog.id}/supervisor`,
                { supervisor_usuario_ids: selectedSupervisorIds },
            );
            const updatedContract = data.contrato;
            setDepartments((current) => current.map((department) => ({
                ...department,
                contratos: department.contratos.map((contract) => (
                    contract.id === updatedContract.id
                        ? { ...contract, ...updatedContract }
                        : contract
                )),
            })));
            setSupervisorDialog(null);
            showToast("success", "Estrutura", data.message);
        } catch (error) {
            showToast(
                "error",
                "Estrutura",
                error.response?.data || "Não foi possível alterar o supervisor.",
            );
        } finally {
            setLoading(false);
        }
    };

    const submit = async () => {
        if (!form.tipo) {
            showToast("warn", "Estrutura", "Escolha se deseja cadastrar um local ou um ativo.");
            return;
        }
        if (!form.nome.trim() || (form.tipo === "ativo" && !form.categoria.trim())) {
            showToast("warn", "Estrutura", "Preencha os campos obrigatórios.");
            return;
        }
        setLoading(true);
        try {
            const { data } = await connect.post("/estrutura", {
                ...form,
                centro_custo_id: dialog.id,
            });
            showToast("success", "Estrutura", data.message);
            setDialog(null);
            setRefresh((value) => value + 1);
        } catch (error) {
            showToast("error", "Estrutura", error.response?.data || "Não foi possível salvar.");
        } finally {
            setLoading(false);
        }
    };

    const renderLocationTree = (location, contract, depth = 0) => {
        const isSelected = location.id === effectiveSelectedLocationId;
        const childCount = location.filhos?.length || 0;
        const isExpanded = expandedLocationIds.has(location.id);

        const toggleExpansion = (event) => {
            event.stopPropagation();
            setExpandedLocationIds((current) => {
                const next = new Set(current);
                if (next.has(location.id)) next.delete(location.id);
                else next.add(location.id);
                return next;
            });
        };

        return (
            <li className="structure-tree-node" key={location.id}>
                <article
                    className={`structure-tree-item${isSelected ? " is-selected" : ""}`}
                    draggable={canEdit}
                    role="treeitem"
                    aria-level={depth + 1}
                    aria-selected={isSelected}
                    tabIndex={0}
                    onClick={() => setSelectedLocationId(location.id)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedLocationId(location.id);
                        }
                    }}
                    onDragStart={() => setDragLocationId(location.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                        event.preventDefault();
                        moveLocation(dragLocationId, location.id);
                    }}
                >
                    {childCount > 0 ? (
                        <button
                            type="button"
                            className="structure-tree-toggle"
                            aria-label={`${isExpanded ? "Recolher" : "Expandir"} ${location.nome}`}
                            aria-expanded={isExpanded}
                            onClick={toggleExpansion}
                        >
                            <AppIcon name={isExpanded ? "chevron-down" : "chevron-right"} />
                        </button>
                    ) : <span className="structure-tree-toggle structure-tree-toggle--placeholder" aria-hidden="true" />}
                    <div className="structure-tree-item__content">
                        <span className="structure-tree-item__icon"><AppIcon name={childCount ? "folder-open" : "map-pin"} /></span>
                        <div>
                            <strong>{location.nome}</strong>
                            <small>{childCount ? `${childCount} sublocal${childCount > 1 ? "is" : ""}` : "Local final"}</small>
                        </div>
                    </div>
                    <div className="structure-tree-item__actions">
                        {canEdit && <Button icon={<AppIcon name="plus" />} text rounded aria-label={`Adicionar sublocal em ${location.nome}`} tooltip="Adicionar sublocal" onClick={(event) => openSubstructureCreate(event, contract, location)} />}
                    </div>
                </article>
                {childCount > 0 && isExpanded && <ul role="group">{location.filhos.map((child) => renderLocationTree(child, contract, depth + 1))}</ul>}
            </li>
        );
    };

    const removeItem = (event, type, item) => {
        event.stopPropagation();
        confirmDialog({
            header: `Excluir ${type}`,
            className: "structure-delete-confirmation",
            message: type === "local"
                ? (() => {
                    const directChildren = selectedContract?.locais.filter((location) => location.parent_id === item.id).length || 0;
                    const childrenNotice = directChildren
                        ? ` Os ${directChildren} sublocal${directChildren > 1 ? "is" : ""} direto${directChildren > 1 ? "s" : ""} se tornarão estruturas principais.`
                        : "";
                    return `Deseja excluir o local “${item.nome}”? Os ativos vinculados ficarão sem local definido.${childrenNotice}`;
                })()
                : `Deseja excluir o ativo “${item.nome}” (${item.patrimonio})?`,
            icon: appIcon("alert-triangle"),
            acceptLabel: "Excluir",
            rejectLabel: "Cancelar",
            acceptClassName: "p-button-danger",
            accept: async () => {
                setLoading(true);
                try {
                    const { data } = await connect.delete("/estrutura", { data: { tipo: type, id: item.id } });
                    showToast("success", "Estrutura", data);
                    setRefresh((value) => value + 1);
                } catch (error) {
                    showToast("error", "Estrutura", error.response?.data || "Não foi possível excluir.");
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    return (
        <main className="structure-page">
            <PageHeader
                section="Estrutura"
                title="Estrutura de Contratos"
                description="Organize locais e ativos por departamento e contrato."
                actions={(
                    <StandardFilterButton panelRef={filterPanel} count={activeFilterCount} />
                )}
            />

            {visibleContracts.length && selectedContract ? (
                <section className="structure-workspace" aria-label="Área de trabalho da estrutura">
                    <aside className="structure-hierarchy-browser" aria-label="Contratos por empresa e filial">
                        <header className="structure-hierarchy-browser__header">
                            <div>
                                <span>Navegação</span>
                                <h2>Empresas e filiais</h2>
                                <p>Escolha o contrato que deseja organizar.</p>
                            </div>
                            <Tag value={String(visibleContracts.length)} severity="info" rounded />
                        </header>
                        <div className="structure-hierarchy-list">
                            {contractHierarchy.map((company) => {
                                const companyId = String(company.id);
                                const companyExpanded = expandedCompanyIds.has(companyId);
                                return (
                                    <section className="structure-hierarchy-company" key={companyId}>
                                        <button
                                            className="structure-hierarchy-company__button"
                                            type="button"
                                            aria-expanded={companyExpanded}
                                            onClick={() => {
                                                setExpandedCompanyIds((current) => {
                                                    const next = new Set(current);
                                                    if (next.has(companyId)) next.delete(companyId);
                                                    else next.add(companyId);
                                                    return next;
                                                });
                                            }}
                                        >
                                            <span className="structure-hierarchy-company__icon"><AppIcon name="building" /></span>
                                            <span className="structure-hierarchy-company__content">
                                                <strong>{company.nome}</strong>
                                                <small>{company.filiais.length} {company.filiais.length === 1 ? "filial" : "filiais"}</small>
                                            </span>
                                            <AppIcon name={companyExpanded ? "chevron-down" : "chevron-right"} />
                                        </button>
                                        {companyExpanded && (
                                            <div className="structure-hierarchy-branches">
                                                {company.filiais.map((branch) => {
                                                    const branchKey = `${companyId}:${branch.id}`;
                                                    const branchContractCount = branch.departamentos.reduce((total, department) => total + department.contratos.length, 0);
                                                    const branchExpanded = expandedBranchIds.has(branchKey);
                                                    return (
                                                        <section className="structure-hierarchy-branch" key={branchKey}>
                                                            <button
                                                                className="structure-hierarchy-branch__button"
                                                                type="button"
                                                                aria-expanded={branchExpanded}
                                                                onClick={() => {
                                                                    setExpandedBranchIds((current) => {
                                                                        const next = new Set(current);
                                                                        if (next.has(branchKey)) next.delete(branchKey);
                                                                        else next.add(branchKey);
                                                                        return next;
                                                                    });
                                                                }}
                                                            >
                                                                <span className="structure-hierarchy-branch__content">
                                                                    <AppIcon name="map-pin" />
                                                                    <span><strong>{branch.nome}</strong><small>{branchContractCount} {branchContractCount === 1 ? "contrato" : "contratos"}</small></span>
                                                                </span>
                                                                <AppIcon name={branchExpanded ? "chevron-down" : "chevron-right"} />
                                                            </button>
                                                            {branchExpanded && (
                                                                <div className="structure-hierarchy-departments">
                                                                    {branch.departamentos.map((department) => {
                                                                        const departmentKey = `${branchKey}:${department.id}`;
                                                                        const departmentExpanded = expandedHierarchyDepartmentIds.has(departmentKey);
                                                                        return (
                                                                            <section className="structure-hierarchy-department" key={departmentKey}>
                                                                                <button
                                                                                    className="structure-hierarchy-department__button"
                                                                                    type="button"
                                                                                    aria-expanded={departmentExpanded}
                                                                                    onClick={() => {
                                                                                        setExpandedHierarchyDepartmentIds((current) => {
                                                                                            const next = new Set(current);
                                                                                            if (next.has(departmentKey)) next.delete(departmentKey);
                                                                                            else next.add(departmentKey);
                                                                                            return next;
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    <span><AppIcon name="hierarchy" /><strong>DPTO {department.id}</strong><small>{department.contratos.length} {department.contratos.length === 1 ? "CC" : "CCs"}</small></span>
                                                                                    <AppIcon name={departmentExpanded ? "chevron-down" : "chevron-right"} />
                                                                                </button>
                                                                                {departmentExpanded && (
                                                                                    <div className="structure-hierarchy-contracts">
                                                                                        {department.contratos.map((contract) => (
                                                                                            <button
                                                                                                className={`structure-hierarchy-contract ${contract.id === effectiveSelectedContractId ? "is-selected" : ""}`}
                                                                                                type="button"
                                                                                                key={contract.id}
                                                                                                onClick={() => setSelectedContractId(contract.id)}
                                                                                            >
                                                                                                <span className="structure-hierarchy-contract__content">
                                                                                                    <strong title={contract.contrato}>{contract.contrato}</strong>
                                                                                                    <small>CC {contract.numero || contract.id} · {contract.locais_count ?? contract.locais.length} locais</small>
                                                                                                </span>
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </section>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </section>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    </aside>
                    <section className="structure-workbench">
                        <header className="structure-contract-overview">
                            <div className="structure-contract-overview__identity">
                                <span className="structure-contract-overview__icon"><AppIcon name="building" /></span>
                                <div>
                                    <span>{selectedContract.departamento} · CONTRATO {selectedContract.id}</span>
                                    <h2>{selectedContract.contrato}</h2>
                                    <p>
                                        <AppIcon name="user" />
                                        <span title={selectedContract.supervisor}>
                                            {selectedContract.supervisores?.length
                                                ? `${selectedContract.supervisores.length} supervisor${selectedContract.supervisores.length > 1 ? "es" : ""}`
                                                : "Sem supervisor"}
                                        </span>
                                        <i />
                                        <AppIcon name="building" /> {selectedContract.empresa_nome || "SEM EMPRESA"}
                                    </p>
                                </div>
                            </div>
                            <div className="structure-contract-overview__actions">
                                {canEdit && <Button icon={<AppIcon name="user-edit" />} label="Supervisores" outlined onClick={() => openSupervisorEdit(null, selectedContract)} />}
                                {isAdmin && <Button icon={<AppIcon name="building" />} label="Empresa" outlined onClick={() => openCompanyEdit(null, selectedContract)} />}
                                {canEdit && <Button icon={<AppIcon name="plus" />} label="Adicionar" onClick={() => openCreate(null, selectedContract)} />}
                            </div>
                        </header>

                        <div className="structure-workbench-grid">
                            <section className="structure-tree-panel">
                                <header className="structure-panel-heading">
                                    <div>
                                        <span>Mapa de locais</span>
                                        <h2>Estrutura do contrato</h2>
                                        <p>Arraste um local sobre outro para torná-lo sublocal.</p>
                                    </div>
                                    <Tag value={`${selectedContract.locais_count ?? selectedContract.locais.length} locais`} severity="info" rounded />
                                </header>
                                {canEdit && (
                                    <div
                                        className="structure-root-dropzone"
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            moveLocation(dragLocationId, null);
                                        }}
                                    >
                                        <AppIcon name="hierarchy" />
                                        Solte aqui para tornar um local principal
                                    </div>
                                )}
                                {selectedContract.estrutura?.length ? (
                                    <ul className="structure-tree" role="tree" aria-label={`Locais de ${selectedContract.contrato}`}>
                                        {selectedContract.estrutura.map((location) => renderLocationTree(location, selectedContract))}
                                    </ul>
                                ) : <div className="structure-empty"><AppIcon name="map-pin" /> <span>Nenhum local cadastrado neste contrato.</span></div>}
                                {unassignedAssets.length > 0 && (
                                    <section className="structure-unassigned-assets">
                                        <header><AppIcon name="box" /><strong>Ativos sem local</strong><Tag value={String(unassignedAssets.length)} severity="warning" rounded /></header>
                                        {unassignedAssets.map((asset) => (
                                            <article key={asset.id}>
                                                <div><strong>{asset.nome}</strong><small>{asset.categoria} · {asset.patrimonio}</small></div>
                                                {canEdit && <Button icon={<AppIcon name="trash" />} severity="danger" text rounded aria-label={`Excluir ativo ${asset.nome}`} tooltip="Excluir ativo" onClick={(event) => removeItem(event, "ativo", asset)} />}
                                            </article>
                                        ))}
                                    </section>
                                )}
                            </section>

                            <aside className="structure-detail-panel">
                                {selectedLocation ? (
                                    <>
                                        <header className="structure-panel-heading">
                                            <div>
                                                <span>Local selecionado</span>
                                                <h2>{selectedLocation.nome}</h2>
                                                <p>{selectedLocation.descricao || "Sem observação cadastrada."}</p>
                                            </div>
                                            <span className="structure-detail-icon" aria-hidden="true"><AppIcon name="target" /></span>
                                        </header>

                                        <div className="structure-detail-metrics">
                                            <div><span>SUBLOCAIS</span><strong>{selectedContract.locais.filter((location) => location.parent_id === selectedLocation.id).length}</strong></div>
                                            <div><span>ATIVOS</span><strong>{selectedLocationAssets.length}</strong></div>
                                        </div>

                                        <div className="structure-detail-actions">
                                            {canEdit && <Button icon={<AppIcon name="plus" />} label="Adicionar sublocal" onClick={() => openSubstructureCreate(null, selectedContract, selectedLocation)} />}
                                            {canCreateRoutine && <Button icon={<AppIcon name="calendar-plus" />} label="Criar rotina" outlined onClick={() => openRoutineCreate(null, selectedContract, selectedLocation)} />}
                                            {canEdit && selectedLocation.parent_id && <Button icon={<AppIcon name="hierarchy" />} label="Tornar principal" severity="secondary" text onClick={() => moveLocation(selectedLocation.id, null)} />}
                                            {canEdit && <Button icon={<AppIcon name="trash" />} label="Excluir local" severity="danger" text onClick={(event) => removeItem(event, "local", selectedLocation)} />}
                                        </div>

                                        <section className="structure-recent-routines">
                                            <header>
                                                <div><AppIcon name="calendar-clock" /><strong>Rotinas recentes</strong></div>
                                                <Tag value={String(selectedLocation.rotinas_recentes?.length || 0)} severity="info" rounded />
                                            </header>
                                            {selectedLocation.rotinas_recentes?.length ? selectedLocation.rotinas_recentes.map((routine) => (
                                                <article key={routine.id}>
                                                    <span><AppIcon name="clock" /></span>
                                                    <div>
                                                        <strong>{routine.nome}</strong>
                                                        <small>{routine.recorrencia_label} · {formatRoutineDate(routine.proxima_execucao)}</small>
                                                    </div>
                                                </article>
                                            )) : <p className="structure-empty">Nenhuma rotina recente neste local.</p>}
                                        </section>

                                        <section className="structure-assets-panel">
                                            <header>
                                                <div><AppIcon name="box" /><strong>Ativos neste local</strong></div>
                                                <Tag value={String(selectedLocationAssets.length)} severity="success" rounded />
                                            </header>
                                            {selectedLocationAssets.length ? selectedLocationAssets.map((asset) => (
                                                <article className="structure-asset-card" key={asset.id}>
                                                    <span className="structure-asset-card__icon"><AppIcon name="box" /></span>
                                                    <div>
                                                        <strong>{asset.nome}</strong>
                                                        <small>{asset.categoria} · {asset.patrimonio}</small>
                                                    </div>
                                                    {canEdit && <Button icon={<AppIcon name="trash" />} severity="danger" text rounded aria-label={`Excluir ativo ${asset.nome}`} tooltip="Excluir ativo" onClick={(event) => removeItem(event, "ativo", asset)} />}
                                                </article>
                                            )) : <p className="structure-empty">Nenhum ativo vinculado a este local.</p>}
                                        </section>
                                    </>
                                ) : (
                                    <div className="structure-detail-empty">
                                        <span><AppIcon name="map-pin" /></span>
                                        <strong>Selecione um local</strong>
                                        <p>Os detalhes, ativos e ações do local aparecerão aqui.</p>
                                    </div>
                                )}
                            </aside>
                        </div>
                    </section>
                </section>
            ) : (
                <div className="structure-zero-state">
                    <AppIcon name="hierarchy"  />
                    <h2>{activeFilterCount ? "Nenhum resultado encontrado" : "Nenhum contrato disponível"}</h2>
                    <p>{activeFilterCount
                        ? "Revise ou limpe os filtros aplicados."
                        : "Não há contratos vinculados às filiais do seu usuário."}</p>
                </div>
            )}

            <OverlayPanel ref={filterPanel} className="structure-filter-panel">
                <div className="structure-filter-title">
                    <div>
                        <strong>Filtrar estrutura</strong>
                        <span>A busca considera contratos, locais e patrimônios.</span>
                    </div>
                    <Button
                        icon={<AppIcon name="filter-off" />}
                        text
                        rounded
                        aria-label="Limpar filtros"
                        tooltip="Limpar filtros"
                        onClick={clearFilters}
                    />
                </div>
                <StandardFilterFields
                    department={{
                        value: filters.departments,
                        options: filterOptions.departments,
                        display: "chip",
                        onChange: (value) => setFilters((current) => ({ ...current, departments: value || [] })),
                    }}
                    center={{
                        value: filters.contracts,
                        options: filterOptions.contracts,
                        display: "chip",
                        preserveOptionOrder: true,
                        onChange: (value) => setFilters((current) => ({ ...current, contracts: value || [] })),
                    }}
                />
                <div className="structure-filter-grid">
                    <label className="structure-filter-search">
                        Busca
                        <span className="structure-filter-search__field">
                            <AppIcon name="search" className="structure-filter-search__icon" />
                            <InputText
                                value={filters.search}
                                placeholder="Contrato, local, ativo ou patrimônio"
                                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                            />
                        </span>
                    </label>
                    <label>
                        Supervisor
                        <Dropdown
                            value={filters.supervisor}
                            options={filterOptions.supervisors}
                            optionLabel="label"
                            optionValue="value"
                            showClear
                            filter
                            placeholder="Todos"
                            onChange={(event) => setFilters({ ...filters, supervisor: event.value })}
                        />
                    </label>
                    <label>
                        Conteúdo
                        <Dropdown
                            value={filters.itemType}
                            options={[
                                { label: "Com locais", value: "local" },
                                { label: "Com ativos", value: "ativo" },
                            ]}
                            showClear
                            placeholder="Todos"
                            onChange={(event) => setFilters({ ...filters, itemType: event.value })}
                        />
                    </label>
                </div>
            </OverlayPanel>

            <RoutineDialog
                visible={Boolean(routineDialog)}
                fixedStructure={routineDialog}
                onHide={() => setRoutineDialog(null)}
            />

            <Dialog
                header={supervisorDialog ? `Supervisores — ${supervisorDialog.id}` : "Alterar supervisores"}
                visible={Boolean(supervisorDialog)}
                modal
                className="structure-supervisor-dialog"
                onHide={() => setSupervisorDialog(null)}
                footer={(
                    <div className="structure-dialog-footer">
                        <Button label="Cancelar" severity="secondary" text onClick={() => setSupervisorDialog(null)} />
                        <Button
                            label="Confirmar alteração"
                            icon={<AppIcon name="check" />}
                            onClick={updateSupervisor}
                            disabled={!selectedSupervisorIds.length}
                        />
                    </div>
                )}
            >
                <div className="structure-supervisor-form">
                    <div className="structure-current-supervisor">
                        <span>Supervisores atuais</span>
                        <div className="structure-current-supervisor__list">
                            {(supervisorDialog?.supervisores || []).map((supervisor) => (
                                <Tag key={supervisor.id} value={supervisor.nome} icon={<AppIcon name="user" />} severity="info" rounded />
                            ))}
                        </div>
                    </div>
                    <label>
                        Supervisores responsáveis
                        <MultiSelect
                            value={selectedSupervisorIds}
                            options={supervisors}
                            optionLabel="nome"
                            optionValue="id"
                            filter
                            filterBy="nome"
                            placeholder="Selecione um ou mais supervisores"
                            emptyMessage="Nenhum supervisor disponível"
                            display="chip"
                            maxSelectedLabels={2}
                            showClear
                            selectedItemsLabel="{0} supervisores selecionados"
                            onChange={(event) => setSelectedSupervisorIds(event.value || [])}
                        />
                    </label>
                </div>
            </Dialog>

            <Dialog
                header={companyDialog ? `Empresa — ${companyDialog.id}` : "Alterar empresa"}
                visible={Boolean(companyDialog)}
                modal
                className="structure-supervisor-dialog"
                onHide={() => setCompanyDialog(null)}
                footer={(
                    <div className="structure-dialog-footer">
                        <Button label="Cancelar" severity="secondary" text onClick={() => setCompanyDialog(null)} />
                        <Button
                            label="Confirmar alteração"
                            icon={<AppIcon name="check" />}
                            onClick={updateCompany}
                            disabled={!selectedCompanyId || selectedCompanyId === companyDialog?.empresa_id}
                        />
                    </div>
                )}
            >
                <div className="structure-supervisor-form">
                    <div className="structure-current-supervisor">
                        <span>Empresa atual</span>
                        <strong><AppIcon name="building"  /> {companyDialog?.empresa_nome || "SEM EMPRESA"}</strong>
                    </div>
                    <label>
                        Nova empresa
                        <Dropdown
                            value={selectedCompanyId}
                            options={companies}
                            optionLabel="nome"
                            optionValue="id"
                            filter
                            filterBy="nome"
                            placeholder="Selecione a empresa"
                            emptyMessage="Nenhuma empresa disponível"
                            onChange={(event) => setSelectedCompanyId(event.value)}
                        />
                    </label>
                </div>
            </Dialog>

            <Dialog
                header={dialog ? `${dialog.id} - ${dialog.contrato}` : "Novo item"}
                visible={Boolean(dialog)}
                modal
                className="structure-dialog"
                onHide={() => setDialog(null)}
                footer={(
                    <div className="structure-dialog-footer">
                        <Button label="Cancelar" severity="secondary" text onClick={() => setDialog(null)} />
                        <Button label="Salvar" icon={<AppIcon name="check" />} onClick={submit} disabled={!form.tipo} />
                    </div>
                )}
            >
                <p className="structure-dialog-help">O que você deseja adicionar neste contrato?</p>
                <div className="structure-type-options">
                    <button
                        type="button"
                        className={form.tipo === "local" ? "selected" : ""}
                        onClick={() => setForm((current) => ({ ...EMPTY_FORM, tipo: "local", parent_id: current.parent_id }))}
                    >
                        <AppIcon name="map-pin"  />
                        <strong>Local</strong>
                        <span>Base para rotinas, tarefas e checklists.</span>
                    </button>
                    <button
                        type="button"
                        className={form.tipo === "ativo" ? "selected" : ""}
                        onClick={() => setForm({ ...EMPTY_FORM, tipo: "ativo" })}
                    >
                        <AppIcon name="box"  />
                        <strong>Ativo</strong>
                        <span>Carros, VAPs e outros bens patrimoniais.</span>
                    </button>
                </div>

                {form.tipo && (
                    <div className="structure-form">
                        <label>
                            Nome *
                            <InputText
                                value={form.nome}
                                onChange={(event) => setForm({ ...form, nome: event.target.value })}
                                placeholder={form.tipo === "local" ? "Ex.: Almoxarifado" : "Ex.: Veículo operacional"}
                            />
                        </label>
                        {form.tipo === "local" && (
                            <label>
                                Estrutura pai
                                <Dropdown
                                    value={form.parent_id}
                                    options={dialogLocationOptions}
                                    optionLabel="label"
                                    optionValue="id"
                                    filter
                                    showClear
                                    placeholder="Estrutura principal"
                                    onChange={(event) => setForm({ ...form, parent_id: event.value })}
                                />
                            </label>
                        )}
                        {form.tipo === "ativo" && (
                            <>
                                <label>
                                    Tipo/categoria *
                                    <Dropdown
                                        value={form.categoria}
                                        options={ASSET_CATEGORY_OPTIONS}
                                        optionLabel="label"
                                        optionValue="value"
                                        placeholder="Selecione o tipo do ativo"
                                        onChange={(event) => setForm({ ...form, categoria: event.value })}
                                    />
                                </label>
                                <label>
                                    Local vinculado
                                    <Dropdown
                                        value={form.local_id}
                                        options={dialogLocationOptions}
                                        optionLabel="label"
                                        optionValue="id"
                                        showClear
                                        placeholder="Sem local definido"
                                        emptyMessage="Nenhum local cadastrado"
                                        onChange={(event) => setForm({ ...form, local_id: event.value })}
                                    />
                                </label>
                                <label>
                                    Patrimônio
                                    <InputText
                                        value={form.patrimonio}
                                        onChange={(event) => setForm({ ...form, patrimonio: event.target.value })}
                                        placeholder="Deixe vazio para gerar automaticamente"
                                    />
                                </label>
                            </>
                        )}
                        <label>
                            Observação
                            <InputTextarea
                                value={form.descricao}
                                rows={3}
                                autoResize
                                onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                            />
                        </label>
                    </div>
                )}
            </Dialog>
            <ConfirmDialog />
        </main>
    );
}
