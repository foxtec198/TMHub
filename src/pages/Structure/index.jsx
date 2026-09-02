import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { StandardFilterButton } from "../../components/filters/StandardFilterButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { Accordion, AccordionTab } from "primereact/accordion";
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
    const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

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

    useEffect(() => {
        if (!isAdmin) return undefined;
        let active = true;
        connect.get("/centro/empresas", { skipStandardFilters: true })
            .then(({ data }) => {
                if (!active) return;
                setCompanies((Array.isArray(data) ? data : []).filter((company) => company.ativa));
            })
            .catch((error) => showToast("error", "Estrutura", error.response?.data || "Não foi possível carregar as empresas."));
        return () => { active = false; };
    }, [isAdmin, showToast]);

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
        setSelectedSupervisorIds(contract.supervisor_usuario_ids || []);
    };

    const openCompanyEdit = (event, contract) => {
        event.stopPropagation();
        setCompanyDialog(contract);
        setSelectedCompanyId(contract.empresa_id || null);
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
            <div><strong><AppIcon name="bars" className="mr-2"  />{location.nome}</strong>{location.descricao && <small>{location.descricao}</small>}</div>
            <div className="structure-item-actions"><Tag value={depth ? "SUBESTRUTURA" : "LOCAL"} severity="info" />{canCreateRoutine && <Button icon={<AppIcon name="calendar-plus" />} text rounded aria-label={`Criar rotina para ${location.nome}`} tooltip="Criar rotina" onClick={(event) => openRoutineCreate(event, contract, location)} />}{canEdit && <Button icon={<AppIcon name="plus" />} text rounded aria-label={`Adicionar subestrutura em ${location.nome}`} tooltip="Adicionar subestrutura" onClick={(event) => openSubstructureCreate(event, contract, location)} />}{canEdit && <Button icon={<AppIcon name="trash" />} severity="danger" text rounded aria-label={`Excluir local ${location.nome}`} tooltip="Excluir local" onClick={(event) => removeItem(event, "local", location)} />}</div>
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

    const contractHeader = (contract) => (
        <div className="structure-contract-header">
            <span className="structure-contract-name">{contract.id} - {contract.contrato}</span>
            <span className="structure-supervisor">
                <AppIcon name="user"  />
                {contract.supervisor}
            </span>
            <span className="structure-supervisor">
                <AppIcon name="building"  />
                {contract.empresa_nome || "SEM EMPRESA"}
            </span>
            {canEdit && (
                <Button
                    type="button"
                    icon={<AppIcon name="user-edit" />}
                    rounded
                    text
                    aria-label={`Alterar supervisor de ${contract.contrato}`}
                    tooltip="Alterar supervisor"
                    onClick={(event) => openSupervisorEdit(event, contract)}
                />
            )}
            {isAdmin && (
                <Button
                    type="button"
                    icon={<AppIcon name="building" />}
                    rounded
                    text
                    aria-label={`Alterar empresa de ${contract.contrato}`}
                    tooltip="Alterar empresa"
                    onClick={(event) => openCompanyEdit(event, contract)}
                />
            )}
            <Button
                type="button"
                icon={<AppIcon name="plus" />}
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
                    <StandardFilterButton panelRef={filterPanel} count={activeFilterCount} />
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
                                    <AppIcon name="building"  />
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
                                                <h3><AppIcon name="map-pin"  /> Locais</h3>
                                                {contract.locais.length ? (contract.estrutura || contract.locais.filter((location) => !location.parent_id)).map((location) => renderLocation(location, contract)) : <p className="structure-empty">Nenhum local cadastrado.</p>}
                                            </section>
                                            <section>
                                                <h3><AppIcon name="box"  /> Ativos</h3>
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
                                                                        icon={<AppIcon name="trash" />}
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
                        value: filters.department ? [filters.department] : [],
                        options: filterOptions.departments,
                        onChange: (value) => setFilters((current) => ({ ...current, department: value?.[0] || null })),
                    }}
                    center={{
                        value: filters.contract ? [filters.contract] : [],
                        options: filterOptions.contracts,
                        onChange: (value) => setFilters((current) => ({ ...current, contract: value?.[0] || null })),
                    }}
                />
                <div className="structure-filter-grid">
                    <label className="structure-filter-search">
                        Busca
                        <span className="p-input-icon-left">
                            <AppIcon name="search"  />
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
                        <strong><AppIcon name="user"  /> {supervisorDialog?.supervisor}</strong>
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
