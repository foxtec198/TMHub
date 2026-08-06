import { useEffect, useMemo, useRef, useState } from "react";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
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

export function Structure() {
    const [departments, setDepartments] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [dialog, setDialog] = useState(null);
    const [supervisorDialog, setSupervisorDialog] = useState(null);
    const [selectedSupervisorId, setSelectedSupervisorId] = useState(null);
    const [routineDialog, setRoutineDialog] = useState(null);
    const [dragLocationId, setDragLocationId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [refresh, setRefresh] = useState(0);
    const [filters, setFilters] = useState({
        search: "",
        department: null,
        contract: null,
        supervisor: null,
        itemType: null,
    });
    const filterPanel = useRef(null);
    const setLoading = useLoading();
    const { showToast } = useToast();
    const canEdit = can("estrutura", "edit");
    const canCreateRoutine = can("tm_ops", "create");

    useEffect(() => {
        let active = true;
        setLoading(true);
        Promise.all([
            connect.get("/estrutura"),
            connect.get("/estrutura/supervisores"),
        ])
            .then(([structureResponse, supervisorsResponse]) => {
                if (!active) return;
                setDepartments(Array.isArray(structureResponse.data) ? structureResponse.data : []);
                setSupervisors(Array.isArray(supervisorsResponse.data) ? supervisorsResponse.data : []);
            })
            .catch((error) => showToast(
                "error",
                "Estrutura",
                error.response?.data || "Não foi possível carregar a estrutura.",
            ))
            .finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [refresh, setLoading, showToast]);

    const totals = useMemo(() => departments.reduce((summary, department) => {
        summary.contracts += department.contratos.length;
        department.contratos.forEach((contract) => {
            summary.locations += contract.locais.length;
            summary.assets += contract.ativos.length;
        });
        return summary;
    }, { contracts: 0, locations: 0, assets: 0 }), [departments]);

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
            supervisors: unique(contracts.map((item) => item.supervisor)),
        };
    }, [departments]);

    const filteredDepartments = useMemo(() => {
        const query = filters.search.trim().toLocaleLowerCase("pt-BR");
        return departments.map((department) => ({
            ...department,
            contratos: department.contratos.filter((contract) => {
                if (filters.department && department.departamento !== filters.department) return false;
                if (filters.contract && contract.id !== filters.contract) return false;
                if (filters.supervisor && contract.supervisor !== filters.supervisor) return false;
                if (filters.itemType === "local" && !contract.locais.length) return false;
                if (filters.itemType === "ativo" && !contract.ativos.length) return false;
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

    const activeFilterCount = Object.values(filters).filter((value) => value !== null && value !== "").length;
    const clearFilters = () => setFilters({
        search: "",
        department: null,
        contract: null,
        supervisor: null,
        itemType: null,
    });

    const openCreate = (event, contract) => {
        event.stopPropagation();
        setDialog(contract);
        setForm(EMPTY_FORM);
    };

    const openSubstructureCreate = (event, contract, parent) => {
        event.stopPropagation();
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
        event.stopPropagation();
        setRoutineDialog({ contract, location });
    };

    const openSupervisorEdit = (event, contract) => {
        event.stopPropagation();
        setSupervisorDialog(contract);
        setSelectedSupervisorId(contract.supervisor_id || null);
    };

    const updateSupervisor = async () => {
        if (!supervisorDialog || !selectedSupervisorId) {
            showToast("warn", "Estrutura", "Selecione um supervisor.");
            return;
        }
        setLoading(true);
        try {
            const { data } = await connect.patch(
                `/estrutura/contratos/${supervisorDialog.id}/supervisor`,
                { supervisor_id: selectedSupervisorId },
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

    const renderLocation = (location, contract, depth = 0) => (
        <article
            className="structure-item-card structure-location-card"
            key={location.id}
            draggable
            onDragStart={() => setDragLocationId(location.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); moveLocation(dragLocationId, location.id); }}
            style={{ marginLeft: `${Math.min(depth, 6) * 1.1}rem` }}
        >
            <div><strong><i className="pi pi-bars mr-2" />{location.nome}</strong>{location.descricao && <small>{location.descricao}</small>}</div>
            <div className="structure-item-actions"><Tag value={depth ? "SUBESTRUTURA" : "LOCAL"} severity="info" />{canCreateRoutine && <Button icon="pi pi-calendar-plus" text rounded aria-label={`Criar rotina para ${location.nome}`} tooltip="Criar rotina" onClick={(event) => openRoutineCreate(event, contract, location)} />}{canEdit && <Button icon="pi pi-plus" text rounded aria-label={`Adicionar subestrutura em ${location.nome}`} tooltip="Adicionar subestrutura" onClick={(event) => openSubstructureCreate(event, contract, location)} />}{canEdit && <Button icon="pi pi-trash" severity="danger" text rounded aria-label={`Excluir local ${location.nome}`} tooltip="Excluir local" onClick={(event) => removeItem(event, "local", location)} />}</div>
            {location.filhos?.map((child) => renderLocation(child, contract, depth + 1))}
        </article>
    );

    const removeItem = (event, type, item) => {
        event.stopPropagation();
        confirmDialog({
            header: `Excluir ${type}`,
            message: type === "local"
                ? `Deseja excluir o local “${item.nome}”? Os ativos vinculados ficarão sem local definido.`
                : `Deseja excluir o ativo “${item.nome}” (${item.patrimonio})?`,
            icon: "pi pi-exclamation-triangle",
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

    const contractHeader = (contract) => (
        <div className="structure-contract-header">
            <span className="structure-contract-name">{contract.id} - {contract.contrato}</span>
            <span className="structure-supervisor">
                <i className="pi pi-user" />
                {contract.supervisor}
            </span>
            {canEdit && (
                <Button
                    type="button"
                    icon="pi pi-user-edit"
                    rounded
                    text
                    aria-label={`Alterar supervisor de ${contract.contrato}`}
                    tooltip="Alterar supervisor"
                    onClick={(event) => openSupervisorEdit(event, contract)}
                />
            )}
            <Button
                type="button"
                icon="pi pi-plus"
                rounded
                text
                aria-label={`Adicionar item em ${contract.contrato}`}
                tooltip="Adicionar local ou ativo"
                onClick={(event) => openCreate(event, contract)}
            />
        </div>
    );

    return (
        <main className="structure-page">
            <PageHeader
                section="Estrutura"
                title="Estrutura de Contratos"
                description="Organize locais e ativos por departamento e contrato."
                actions={(
                    <>
                        <Button
                            icon="pi pi-filter-fill"
                            label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"}
                            onClick={(event) => filterPanel.current?.toggle(event)}
                        />
                        <Button
                            icon="pi pi-refresh"
                            outlined
                            aria-label="Atualizar estrutura"
                            onClick={() => setRefresh((value) => value + 1)}
                        />
                    </>
                )}
            />

            <section className="structure-summary" aria-label="Resumo da estrutura">
                <div><strong>{departments.length}</strong><span>Departamentos</span></div>
                <div><strong>{totals.contracts}</strong><span>Contratos</span></div>
                <div><strong>{totals.locations}</strong><span>Locais</span></div>
                <div><strong>{totals.assets}</strong><span>Ativos</span></div>
            </section>

            {filteredDepartments.length ? (
                <Accordion multiple className="structure-departments">
                    {filteredDepartments.map((department) => (
                        <AccordionTab
                            key={department.departamento}
                            header={
                                <div className="structure-department-header">
                                    <i className="pi pi-building" />
                                    <span>DPTO {department.departamento}</span>
                                    <Tag value={`${department.contratos.length} contratos`} />
                                </div>
                            }
                        >
                            <Accordion multiple className="structure-contracts">
                                {department.contratos.map((contract) => (
                                    <AccordionTab key={contract.id} header={contractHeader(contract)}>
                                        <div className="structure-items">
                                            <section>
                                                <h3><i className="pi pi-map-marker" /> Locais</h3>
                                                {contract.locais.length ? (contract.estrutura || contract.locais.filter((location) => !location.parent_id)).map((location) => renderLocation(location, contract)) : <p className="structure-empty">Nenhum local cadastrado.</p>}
                                            </section>
                                            <section>
                                                <h3><i className="pi pi-box" /> Ativos</h3>
                                                {contract.ativos.length ? contract.ativos.map((asset) => {
                                                    const location = contract.locais.find((item) => item.id === asset.local_id);
                                                    return (
                                                        <article className="structure-item-card" key={asset.id}>
                                                            <div>
                                                                <strong>{asset.nome}</strong>
                                                                <small>{asset.categoria}{location ? ` · ${location.nome}` : ""}</small>
                                                            </div>
                                                            <div className="structure-item-actions">
                                                                <Tag value={asset.patrimonio} severity="success" />
                                                                {canEdit && (
                                                                    <Button
                                                                        icon="pi pi-trash"
                                                                        severity="danger"
                                                                        text
                                                                        rounded
                                                                        aria-label={`Excluir ativo ${asset.nome}`}
                                                                        tooltip="Excluir ativo"
                                                                        onClick={(event) => removeItem(event, "ativo", asset)}
                                                                    />
                                                                )}
                                                            </div>
                                                        </article>
                                                    );
                                                }) : <p className="structure-empty">Nenhum ativo cadastrado.</p>}
                                            </section>
                                        </div>
                                    </AccordionTab>
                                ))}
                            </Accordion>
                        </AccordionTab>
                    ))}
                </Accordion>
            ) : (
                <div className="structure-zero-state">
                    <i className="pi pi-sitemap" />
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
                        icon="pi pi-filter-slash"
                        text
                        rounded
                        aria-label="Limpar filtros"
                        tooltip="Limpar filtros"
                        onClick={clearFilters}
                    />
                </div>
                <div className="structure-filter-grid">
                    <label className="structure-filter-search">
                        Busca
                        <span className="p-input-icon-left">
                            <i className="pi pi-search" />
                            <InputText
                                value={filters.search}
                                placeholder="Contrato, local, ativo ou patrimônio"
                                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                            />
                        </span>
                    </label>
                    <label>
                        Departamento
                        <Dropdown
                            value={filters.department}
                            options={filterOptions.departments}
                            showClear
                            filter
                            placeholder="Todos"
                            onChange={(event) => setFilters({ ...filters, department: event.value })}
                        />
                    </label>
                    <label>
                        Contrato
                        <Dropdown
                            value={filters.contract}
                            options={filterOptions.contracts}
                            showClear
                            filter
                            placeholder="Todos"
                            onChange={(event) => setFilters({ ...filters, contract: event.value })}
                        />
                    </label>
                    <label>
                        Supervisor
                        <Dropdown
                            value={filters.supervisor}
                            options={filterOptions.supervisors}
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
                header={supervisorDialog ? `Supervisor — ${supervisorDialog.id}` : "Alterar supervisor"}
                visible={Boolean(supervisorDialog)}
                modal
                className="structure-supervisor-dialog"
                onHide={() => setSupervisorDialog(null)}
                footer={(
                    <div className="structure-dialog-footer">
                        <Button label="Cancelar" severity="secondary" text onClick={() => setSupervisorDialog(null)} />
                        <Button
                            label="Confirmar alteração"
                            icon="pi pi-check"
                            onClick={updateSupervisor}
                            disabled={!selectedSupervisorId || selectedSupervisorId === supervisorDialog?.supervisor_id}
                        />
                    </div>
                )}
            >
                <div className="structure-supervisor-form">
                    <div className="structure-current-supervisor">
                        <span>Supervisor atual</span>
                        <strong><i className="pi pi-user" /> {supervisorDialog?.supervisor}</strong>
                    </div>
                    <label>
                        Novo supervisor
                        <Dropdown
                            value={selectedSupervisorId}
                            options={supervisors}
                            optionLabel="nome"
                            optionValue="id"
                            filter
                            filterBy="nome"
                            placeholder="Selecione o supervisor"
                            emptyMessage="Nenhum supervisor disponível"
                            onChange={(event) => setSelectedSupervisorId(event.value)}
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
                        <Button label="Salvar" icon="pi pi-check" onClick={submit} disabled={!form.tipo} />
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
                        <i className="pi pi-map-marker" />
                        <strong>Local</strong>
                        <span>Base para rotinas, tarefas e checklists.</span>
                    </button>
                    <button
                        type="button"
                        className={form.tipo === "ativo" ? "selected" : ""}
                        onClick={() => setForm({ ...EMPTY_FORM, tipo: "ativo" })}
                    >
                        <i className="pi pi-box" />
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
                                    options={dialog?.locais || []}
                                    optionLabel="nome"
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
                                        options={dialog?.locais || []}
                                        optionLabel="nome"
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
