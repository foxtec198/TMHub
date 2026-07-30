import { useEffect, useMemo, useRef, useState } from "react";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Button } from "primereact/button";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Dialog } from "primereact/dialog";
import { Divider } from "primereact/divider";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { SpeedDial } from "primereact/speeddial";
import { Tag } from "primereact/tag";
import { Tooltip } from "primereact/tooltip";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import { useToast } from "../../contexts/ToastContext";
import { useLoading } from "../../contexts/LoadingContext";
import { can } from "../../utils/permissions";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import { PageHeader } from "../../components/PageHeader";
import "./pcd.css";

const TIPOS_PCD = ["Motora", "Visual", "Auditiva", "Intelectual", "Outras", "Reabilitado"];

const TYPE_ICONS = {
  "Motora": "pi pi-arrows-alt",
  "Visual": "pi pi-eye",
  "Auditiva": "pi pi-volume-up",
  "Intelectual": "pi pi-book",
  "Outras": "pi pi-question-circle",
  "Reabilitado": "pi pi-refresh",
};

const EMPTY_FILTERS = {
  filiais: [],
  departamentos: [],
  centros: [],
  supervisores: [],
  tipos: [],
  situacoes: [],
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

function groupByCenter(colaboradores) {
  const centers = new Map();

  colaboradores.forEach((colaborador) => {
    const centerId = colaborador.centro_id || "sem-centro";
    if (!centers.has(centerId)) centers.set(centerId, []);
    centers.get(centerId).push(colaborador);
  });

  return [...centers.entries()];
}
function matches(colaborador, search) {
  if (!search) return true;
  const term = search.toLowerCase();
  return (
    colaborador.nome?.toLowerCase().includes(term) ||
    String(colaborador.matricula ?? "").includes(term) ||
    colaborador.cargo?.toLowerCase().includes(term) ||
    colaborador.type_pcd?.toLowerCase().includes(term)
  );
}

export function Pcd() {
  const [colaboradores, setColaboradores] = useState([]);
  const [filiaisPorDepartamento, setFiliaisPorDepartamento] = useState({});
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [refresh, setRefresh] = useState(0);
  const [manageForm, setManageForm] = useState(null); // { id, nome, matricula, pcd, type_pcd, obs_pcd, isNew }
  const [importOpen, setImportOpen] = useState(false);
  const [spreadsheet, setSpreadsheet] = useState(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const fileInput = useRef(null);
  const filterPanel = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canEdit = can("indicador_pcd", "edit");
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

  useEffect(() => {
    setLoading(true);
    connect.get("/pcd")
      .then(({ data }) => {
        setColaboradores(Array.isArray(data?.colaboradores) ? data.colaboradores : []);
        setFiliaisPorDepartamento(data?.filiais_por_departamento || {});
      })
      .catch((error) => showToast("error", "Indicador PCD", error.response?.data || "Não foi possível carregar os colaboradores PCD."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // Mantém a listagem sincronizada em tempo real quando outro usuário altera o indicador de PCD.
  useEffect(() => {
    const refreshPcd = () => setRefresh((value) => value + 1);

    socketio.on("pcd_update", refreshPcd);

    return () => {
      socketio.off("pcd_update", refreshPcd);
    };
  }, []);

  const options = useMemo(() => ({
    filiais: [...new Set(Object.values(filiaisPorDepartamento).flat())]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))
      .map((filial) => ({ value: filial, label: filial })),
    departamentos: uniqueOptions(colaboradores, "departamento"),
    centros: uniqueOptions(colaboradores, "centro_id", "centro_custo"),
    supervisores: uniqueOptions(colaboradores, "supervisor_id", "supervisor"),
    situacoes: uniqueOptions(colaboradores, "situacao_id", "situacao"),
    tipos: uniqueOptions(
      colaboradores.flatMap((colaborador) => (colaborador.type_pcd || "Não informado")
        .split(",").map((tipo) => tipo.trim()).filter(Boolean).map((tipo) => ({ tipo }))),
      "tipo",
    ),
  }), [colaboradores, filiaisPorDepartamento]);

  const filteredColaboradores = useMemo(() => colaboradores.filter((colaborador) => {
    const tipos = (colaborador.type_pcd || "Não informado").split(",").map((tipo) => tipo.trim()).filter(Boolean);
    const filiais = filiaisPorDepartamento[String(colaborador.departamento)] || [];
    return (
      matches(colaborador, search)
      && (!filters.filiais.length || filters.filiais.some((filial) => filiais.includes(filial)))
      && (!filters.departamentos.length || filters.departamentos.includes(colaborador.departamento))
      && (!filters.centros.length || filters.centros.includes(colaborador.centro_id))
      && (!filters.supervisores.length || filters.supervisores.includes(colaborador.supervisor_id))
      && (!filters.tipos.length || filters.tipos.some((tipo) => tipos.includes(tipo)))
      && (!filters.situacoes.length || filters.situacoes.includes(colaborador.situacao_id))
    );
  }), [colaboradores, filiaisPorDepartamento, search, filters]);

  const departments = useMemo(() => {
    const grouped = new Map();

    filteredColaboradores.forEach((colaborador) => {
      const department = colaborador.departamento ?? "Sem departamento";
      if (!grouped.has(department)) grouped.set(department, []);
      grouped.get(department).push(colaborador);
    });

    return [...grouped.entries()].sort(([a], [b]) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));
  }, [filteredColaboradores]);

  const activeFilterCount = Object.values(filters).filter((value) => value.length).length;

  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value || [] }));
  };

  const summaryByType = useMemo(() => {
    const counts = {};
    for (const colaborador of filteredColaboradores) {
      (colaborador.type_pcd || "Não informado").split(",").map((t) => t.trim()).filter(Boolean).forEach((tipo) => {
        counts[tipo] = (counts[tipo] || 0) + 1;
      });
    }
    return counts;
  }, [filteredColaboradores]);

  function openEdit(colaborador) {
    setManageForm({
      id: colaborador.id,
      nome: colaborador.nome,
      matricula: colaborador.matricula,
      pcd: true,
      type_pcd: colaborador.type_pcd ? colaborador.type_pcd.split(",").map((tipo) => tipo.trim()).filter(Boolean) : [],
      obs_pcd: colaborador.obs_pcd || "",
      isNew: false,
    });
  }

  function openNew() {
    setManageForm({ id: null, nome: "", matricula: "", pcd: true, type_pcd: [], obs_pcd: "", isNew: true });
  }

  async function saveManage() {
    if (!manageForm?.id) return showToast("warn", "Indicador PCD", "Selecione um colaborador.");
    if (!manageForm.type_pcd?.length) return showToast("warn", "Indicador PCD", "Selecione ao menos um tipo de deficiência.");
    setSaving(true);
    try {
      await connect.patch("/pcd", {
        id: manageForm.id,
        pcd: manageForm.pcd,
        type_pcd: manageForm.type_pcd.join(", "),
        obs_pcd: manageForm.obs_pcd,
      });
      showToast("success", "Indicador PCD", manageForm.pcd ? "Colaborador atualizado." : "Colaborador removido do indicador PCD.");
      setManageForm(null);
      setRefresh((value) => value + 1);
    } catch (error) {
      showToast("error", "Indicador PCD", error.response?.data || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function removePcd(colaborador) {
    setSaving(true);
    try {
      await connect.patch("/pcd", { id: colaborador.id, pcd: false });
      showToast("success", "Indicador PCD", `${colaborador.nome} removido(a) do indicador PCD.`);
      setRefresh((value) => value + 1);
    } catch (error) {
      showToast("error", "Indicador PCD", error.response?.data || "Não foi possível remover.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAll() {
    setDeletingAll(true);
    try {
      const { data } = await connect.delete("/pcd/todos");
      showToast("success", "Indicador PCD", data?.message || "Todos os dados de PCD foram excluídos.");
      setRefresh((value) => value + 1);
    } catch (error) {
      showToast("error", "Indicador PCD", error.response?.data || "Não foi possível excluir os dados.");
    } finally {
      setDeletingAll(false);
    }
  }

  function confirmDeleteAll() {
    confirmDialog({
      header: "Excluir todos os dados de PCD",
      message: "Isso remove a marcação de PCD, o tipo e a observação de todos os colaboradores. Use apenas em caso de erro na importação. Deseja continuar?",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Excluir tudo",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      defaultFocus: "reject",
      accept: deleteAll,
    });
  }

  function closeImport() {
    if (importing) return;
    setSpreadsheet(null);
    if (fileInput.current) fileInput.current.value = "";
    setImportOpen(false);
  }

  async function importSpreadsheet(event) {
    event.preventDefault();
    if (!spreadsheet) return showToast("warn", "Importar planilha", "Selecione um arquivo .xlsx.");

    const payload = new FormData();
    payload.append("file", spreadsheet);
    setImporting(true);
    try {
      const { data } = await connect.post("/pcd/importar", payload, { timeout: 120000 });
      showToast("success", "Importação concluída", data?.message || "Planilha importada.");
      if (data?.nao_encontrados?.length) {
        showToast("warn", "Matrículas não encontradas", `${data.nao_encontrados.length} matrícula(s) da planilha não foram localizadas no cadastro.`);
      }
      closeImport();
      setRefresh((value) => value + 1);
    } catch (error) {
      showToast("error", "Falha na importação", error.response?.data || "Confira a planilha e tente novamente.");
    } finally {
      setImporting(false);
    }
  }

  const speedDialItems = [
    ...(canEdit ? [
      { label: "Importar planilha", icon: "pi pi-upload", command: () => setImportOpen(true) },
      { label: "Marcar colaborador como PCD", icon: "pi pi-plus", command: openNew },
    ] : []),
    { label: "Exportar (em breve)", icon: "pi pi-download", disabled: true, command: () => {} },
    ...(isAdmin ? [
      { label: "Excluir todos os dados", icon: "pi pi-trash", command: confirmDeleteAll },
    ] : []),
  ];

  return <section className="pcd-page">
    <PageHeader
      section="Indicadores"
      title="Controle de PCD"
      description="Colaboradores com deficiência, organizados por departamento e centro de custo."
      actions={<>
        <Button icon="pi pi-refresh" label="Atualizar" outlined onClick={() => setRefresh((value) => value + 1)} />
        <Button
          type="button"
          icon="pi pi-filter-fill"
          label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"}
          outlined
          onClick={(event) => filterPanel.current?.toggle(event)}
        />
      </>}
    />

    {(canEdit || isAdmin) && <div className="pcd-speed-dial">
      <Tooltip target=".pcd-speed-dial .p-speeddial-action" position="left" showDelay={150} />
      <SpeedDial model={speedDialItems} type="quarter-circle" direction="up-left" radius={132} showIcon="pi pi-plus" hideIcon="pi pi-times" aria-label="Ações de PCD" />
    </div>}

    <OverlayPanel ref={filterPanel} className="pcd-filter-panel">
      <div className="pcd-filter-panel__title">
        <div>
          <strong>Filtrar colaboradores</strong>
          <span>Combine um ou mais filtros.</span>
        </div>
        <Button type="button" icon="pi pi-filter-slash" text rounded aria-label="Limpar filtros" onClick={() => setFilters(EMPTY_FILTERS)} />
      </div>
      <Divider />

      {[
        ["filiais", "Filiais"],
        ["departamentos", "Departamentos"],
        ["centros", "Centros de custo"],
        ["supervisores", "Supervisores"],
        ["tipos", "Tipos de PCD"],
        ["situacoes", "Situação"],
      ].map(([name, label]) => (
        <label className="pcd-filter-field" key={name}>
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
            panelClassName="pcd-filter-dropdown"
          />
        </label>
      ))}
    </OverlayPanel>

    <div className="pcd-summary">
      <article className="pcd-summary-card"><i className="pi pi-users" /><div><small>Total PCD</small><strong>{filteredColaboradores.length}</strong></div></article>
      {Object.entries(summaryByType).map(([tipo, count]) => (
        <article className="pcd-summary-card" key={tipo}><i className={TYPE_ICONS[tipo] || "pi pi-tag"} /><div><small>{tipo}</small><strong>{count}</strong></div></article>
      ))}
    </div>

    <div className="pcd-panel">
      <div className="pcd-filters">
        <span className="p-input-icon-left"><i className="pi pi-search" /><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, matrícula, cargo ou tipo" /></span>
      </div>

      {departments.length === 0 && <p className="pcd-empty">Nenhum colaborador PCD encontrado.</p>}

      <Accordion multiple activeIndex={[0]}>
        {departments.map(([department, departmentColaboradores]) => {
          const centers = groupByCenter(departmentColaboradores);

          return (
            <AccordionTab
              key={department}
              header={
                <span className="pcd-tab-header pcd-tab-header-split">
                  <span className="pcd-tab-header-left">Departamento {department} <Tag value={departmentColaboradores.length} rounded /></span>
                  <span className="pcd-tab-header-filiais">
                    {(filiaisPorDepartamento[String(department)] || []).map((filial) => (
                      <Tag key={filial} className="pcd-filial-tag" value={filial} rounded />
                    ))}
                  </span>
                </span>
              }
            >
              <div className="pcd-centers">
                {centers.map(([centerId, centerColaboradores]) => {
                  const center = centerColaboradores[0];
                  return (
                    <article className="pcd-center" key={centerId}>
                      <header className="pcd-center-header">
                        <i className="pi pi-building" />
                        <strong>{center.centro_custo || "Centro de custo não informado"}</strong>
                        <span><i className="pi pi-user" /> {center.supervisor}</span>
                      </header>

                      <ul className="pcd-employee-list">
                        {centerColaboradores.map((colaborador) => (
                          <li key={colaborador.id} className="pcd-employee">
                            <div className="pcd-employee-info">
                              <span className="pcd-employee-name">{colaborador.nome}</span>
                              <span className="pcd-employee-subtitle">
                                Matrícula {colaborador.matricula} • {colaborador.cargo || "Sem cargo"}
                                <span className={`pcd-employee-status ${colaborador.situacao_id === 8 ? "is-inativo" : "is-ativo"}`}>{colaborador.situacao}</span>
                              </span>
                            </div>
                            <Divider layout="vertical" />
                            <div className="pcd-employee-meta">
                              {colaborador.type_pcd && <Tag className="pcd-employee-tipo" value={colaborador.type_pcd} />}
                              {colaborador.obs_pcd && <span className="pcd-employee-obs">{colaborador.obs_pcd}</span>}
                            </div>
                            {canEdit && <div className="pcd-employee-actions">
                              <Button icon="pi pi-pencil" rounded text aria-label={`Editar ${colaborador.nome}`} onClick={() => openEdit(colaborador)} />
                              <Button icon="pi pi-times" rounded text severity="danger" aria-label={`Remover PCD de ${colaborador.nome}`} onClick={() => removePcd(colaborador)} />
                            </div>}
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
              </div>
            </AccordionTab>
          );
        })}
      </Accordion>
    </div>

    <Dialog header={manageForm?.isNew ? "Marcar colaborador como PCD" : `Editar PCD · ${manageForm?.nome || ""}`} visible={Boolean(manageForm)} modal className="pcd-dialog" onHide={() => setManageForm(null)}>
      {manageForm && <div className="pcd-form">
        {manageForm.isNew && <div className="pcd-field">
          <label>Colaborador</label>
          <CollaboratorDropdown
            value={manageForm.id}
            selectedOption={manageForm.id ? { id: manageForm.id, nome: manageForm.nome, matricula: manageForm.matricula } : null}
            onChange={(employeeId, employee) => setManageForm((current) => ({
              ...current,
              id: employeeId,
              nome: employee?.nome || "",
              matricula: employee?.matricula || "",
            }))}
            placeholder="Selecione ou pesquise o colaborador"
          />
        </div>}
        {!manageForm.isNew && <div className="pcd-context"><strong>{manageForm.nome}</strong><span>Matrícula {manageForm.matricula}</span></div>}

        <div className="pcd-field">
          <label>Tipo de deficiência</label>
          <MultiSelect
            value={manageForm.type_pcd || []}
            options={TIPOS_PCD}
            onChange={(event) => setManageForm({ ...manageForm, type_pcd: event.value })}
            placeholder="Selecione um ou mais tipos"
            display="chip"
            className="w-full"
          />
        </div>
        <div className="pcd-field">
          <label>Observação</label>
          <InputTextarea value={manageForm.obs_pcd} onChange={(event) => setManageForm({ ...manageForm, obs_pcd: event.target.value })} rows={6} placeholder="Descrição livre da condição, laudo, restrições, etc." />
        </div>

        <div className="pcd-dialog-actions">
          <Button label="Cancelar" text disabled={saving} onClick={() => setManageForm(null)} />
          <Button label="Salvar" icon="pi pi-check" loading={saving} onClick={saveManage} />
        </div>
      </div>}
    </Dialog>

    <Dialog header="Importar planilha de PCD" visible={importOpen} modal className="pcd-import-dialog" closable={!importing} closeOnEscape={!importing} onHide={closeImport}>
      <form className="pcd-import-form" onSubmit={importSpreadsheet}>
        <p>A planilha deve seguir o modelo do relatório "Relação de Empregados - Cadastro" (com a coluna <strong>Matricula</strong>). A matrícula é usada para localizar o colaborador e marcá-lo como PCD.</p>
        <input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={importing} onChange={(event) => setSpreadsheet(event.target.files?.[0] || null)} />
        {spreadsheet && <small>Arquivo selecionado: {spreadsheet.name}</small>}
        <div className="pcd-dialog-actions">
          <Button type="button" label="Cancelar" text disabled={importing} onClick={closeImport} />
          <Button type="submit" label={importing ? "Importando..." : "Importar"} icon="pi pi-upload" loading={importing} disabled={!spreadsheet || importing} />
        </div>
      </form>
    </Dialog>
    <ConfirmDialog />
  </section>;
}
