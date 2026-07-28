import { useEffect, useMemo, useRef, useState } from "react";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";
import { PageHeader } from "../../components/PageHeader";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import "./index.css";

const EMPTY_FORM = {
    tipo: "",
    nome: "",
    categoria: "",
    patrimonio: "",
    local_id: null,
    descricao: "",
};

export function Structure() {
    const [departments, setDepartments] = useState([]);
    const [dialog, setDialog] = useState(null);
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

    useEffect(() => {
        let active = true;
        setLoading(true);
        connect.get("/estrutura")
            .then(({ data }) => active && setDepartments(Array.isArray(data) ? data : []))
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

    const contractHeader = (contract) => (
        <div className="structure-contract-header">
            <span className="structure-contract-name">{contract.id} - {contract.contrato}</span>
            <span className="structure-supervisor">
                <i className="pi pi-user" />
                {contract.supervisor}
            </span>
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
                                                {contract.locais.length ? contract.locais.map((location) => (
                                                    <article className="structure-item-card" key={location.id}>
                                                        <div>
                                                            <strong>{location.nome}</strong>
                                                            {location.descricao && <small>{location.descricao}</small>}
                                                        </div>
                                                        <Tag value="LOCAL" severity="info" />
                                                    </article>
                                                )) : <p className="structure-empty">Nenhum local cadastrado.</p>}
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
                                                            <Tag value={asset.patrimonio} severity="success" />
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
                        onClick={() => setForm({ ...EMPTY_FORM, tipo: "local" })}
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
                        {form.tipo === "ativo" && (
                            <>
                                <label>
                                    Tipo/categoria *
                                    <InputText
                                        value={form.categoria}
                                        onChange={(event) => setForm({ ...form, categoria: event.target.value })}
                                        placeholder="Ex.: Carro, VAP, equipamento"
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
        </main>
    );
}
