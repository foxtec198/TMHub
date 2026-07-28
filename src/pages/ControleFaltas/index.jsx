import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { PageHeader } from "../../components/PageHeader";
import { can } from "../../utils/permissions";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import "./styles.css";

const REASONS = ["ATESTADO", "AFASTAMENTO", "DECLARAÇÃO", "INJUSTIFICADA", "POSTO VAGO", "REMANEJAMENTO", "OUTROS"];
const CLASSIFICATIONS = [
  { label: "Justificada", value: "justificada" },
  { label: "Injustificada", value: "injustificada" },
];
const ABSENCE_TYPES = [
  { label: "Integral", value: "integral" },
  { label: "Parcial", value: "parcial" },
];
const hasDocumentDeadline = (reason) => reason?.includes("ATESTADO") || reason?.includes("DECLARA");
const ALL = "__all__";
const loadedAt = new Date();
const CURRENT_MONTH = [
  new Date(loadedAt.getFullYear(), loadedAt.getMonth(), 1),
  new Date(loadedAt.getFullYear(), loadedAt.getMonth() + 1, 0, 23, 59, 59, 999),
];

function uniqueOptions(records, field, formatter = (value) => String(value)) {
  return [...new Set(records.map((record) => record[field]).filter((value) => value != null && value !== ""))]
    .map((value) => ({ label: formatter(value), value: String(value) }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR", { numeric: true }));
}

function remaining(deadline, now) {
  if (!deadline) return null;
  const milliseconds = new Date(deadline).getTime() - now;
  if (milliseconds <= 0) return { expired: true, text: "Prazo esgotado" };
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return { expired: false, text: `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}min` };
}

export function AbsenceControl() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [classificationFilter, setClassificationFilter] = useState(ALL);
  const [dateRange, setDateRange] = useState(() => [...CURRENT_MONTH]);
  const [departmentFilter, setDepartmentFilter] = useState(ALL);
  const [supervisorFilter, setSupervisorFilter] = useState(ALL);
  const [reasonFilter, setReasonFilter] = useState(ALL);
  const [contractFilter, setContractFilter] = useState(ALL);
  const [collaboratorFilter, setCollaboratorFilter] = useState(ALL);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [manualForm, setManualForm] = useState(null);
  const [supervisors, setSupervisors] = useState([]);
  const [now, setNow] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const filterPanel = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canEdit = can("controle_faltas", "edit");

  useEffect(() => {
    connect.get("/controle-faltas")
      .then(({ data }) => { setRecords(Array.isArray(data) ? data : []); setNow(Date.now()); })
      .catch((error) => showToast("error", "Controle de Faltas", error.response?.data || "Não foi possível carregar os registros."));
  }, [refresh, showToast]);

  useEffect(() => {
    connect.get("/supervisores")
      .then(({ data }) => setSupervisors((Array.isArray(data) ? data : [])
        .map((supervisor) => ({ label: supervisor.nome, value: supervisor.id }))
        .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"))))
      .catch(() => setSupervisors([]));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()); setRefresh((value) => value + 1); }, 60_000);
    const reload = () => setRefresh((value) => value + 1);
    socketio.on("absence_control_update", reload);
    socketio.on("new_request", reload);
    return () => { window.clearInterval(timer); socketio.off("absence_control_update", reload); socketio.off("new_request", reload); };
  }, []);

  const summary = useMemo(() => records.reduce((result, record) => {
    result.total += 1;
    if (record.status === "tratada") result.treated += 1;
    else result.pending += 1;
    if (record.status === "pendente" && hasDocumentDeadline(record.motivo) && remaining(record.prazo_atestado, now)?.expired) result.expired += 1;
    return result;
  }, { total: 0, pending: 0, expired: 0, treated: 0 }), [records, now]);

  const filterOptions = useMemo(() => ({
    departments: uniqueOptions(records, "departamento", (value) => `DPTO. ${value}`),
    supervisors: uniqueOptions(records, "supervisor"),
    reasons: uniqueOptions(records, "motivo"),
    contracts: uniqueOptions(records, "contrato"),
    collaborators: [...new Map(records.map((record) => {
      const value = `${record.colaborador || ""}|||${record.matricula || ""}`;
      const label = record.matricula ? `${record.colaborador} · ${record.matricula}` : record.colaborador;
      return [value, { label, value }];
    })).values()].filter((option) => option.label).sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
  }), [records]);

  const filtered = useMemo(() => records.filter((record) => {
    const term = search.trim().toLowerCase();
    const recordDate = new Date(record.data_falta);
    const collaboratorKey = `${record.colaborador || ""}|||${record.matricula || ""}`;
    const rangeStart = dateRange?.[0] ? new Date(dateRange[0]) : null;
    const rangeEnd = dateRange?.[1] ? new Date(dateRange[1]) : null;
    rangeStart?.setHours(0, 0, 0, 0);
    rangeEnd?.setHours(23, 59, 59, 999);
    if (statusFilter !== ALL && record.status !== statusFilter) return false;
    if (classificationFilter !== ALL && record.classificacao !== classificationFilter) return false;
    if (rangeStart && recordDate < rangeStart) return false;
    if (rangeEnd && recordDate > rangeEnd) return false;
    if (departmentFilter !== ALL && String(record.departamento) !== departmentFilter) return false;
    if (supervisorFilter !== ALL && String(record.supervisor) !== supervisorFilter) return false;
    if (reasonFilter !== ALL && String(record.motivo) !== reasonFilter) return false;
    if (contractFilter !== ALL && String(record.contrato) !== contractFilter) return false;
    if (collaboratorFilter !== ALL && collaboratorKey !== collaboratorFilter) return false;
    return !term || [record.colaborador, record.matricula, record.contrato, record.supervisor, record.motivo]
      .some((value) => String(value || "").toLowerCase().includes(term));
  }), [records, search, statusFilter, classificationFilter, dateRange, departmentFilter, supervisorFilter, reasonFilter, contractFilter, collaboratorFilter]);

  const clearFilters = () => {
    setStatusFilter(ALL);
    setClassificationFilter(ALL);
    setDateRange([...CURRENT_MONTH]);
    setDepartmentFilter(ALL);
    setSupervisorFilter(ALL);
    setReasonFilter(ALL);
    setContractFilter(ALL);
    setCollaboratorFilter(ALL);
  };

  const activeFilterCount = [statusFilter, classificationFilter, departmentFilter, supervisorFilter, reasonFilter, contractFilter, collaboratorFilter]
    .filter((value) => value !== ALL).length;

  const open = (record) => {
    setEditing(record);
    setForm({
      motivo: record.motivo,
      data_falta: new Date(record.data_falta),
      classificacao: record.classificacao === "em_analise" ? null : record.classificacao,
      observacao: record.observacao || "",
    });
  };

  const save = async (treated = false) => {
    if (treated && !form.classificacao) return showToast("warn", "Tratativa", "Informe se a falta foi justificada ou injustificada.");
    setLoading(true);
    try {
      await connect.patch("/controle-faltas", {
        id: editing.id,
        motivo: form.motivo,
        data_falta: form.data_falta,
        classificacao: form.classificacao,
        observacao: form.observacao,
        status: treated ? "tratada" : undefined,
      });
      setEditing(null);
      setRefresh((value) => value + 1);
      showToast("success", "Controle de Faltas", treated ? "Falta tratada com sucesso." : "Registro atualizado.");
    } catch (error) {
      showToast("error", "Não foi possível salvar", error.response?.data || "Confira os dados informados.");
    } finally { setLoading(false); }
  };

  const reopen = async () => {
    setLoading(true);
    try {
      await connect.patch("/controle-faltas", { id: editing.id, status: "pendente" });
      setEditing(null);
      setRefresh((value) => value + 1);
      showToast("success", "Controle de Faltas", "Falta devolvida para pendente.");
    } catch (error) {
      showToast("error", "Não foi possível reabrir", error.response?.data || "Tente novamente.");
    } finally { setLoading(false); }
  };

  const openManual = () => {
    setManualForm({
      colaborador_id: null,
      colaborador_nome: "",
      colaborador_matricula: "",
      contrato: "",
      departamento: "",
      supervisor_id: null,
      motivo: null,
      tipo_ausencia: "integral",
      quantidade_horas: null,
      data_falta: new Date(),
      observacao: "",
    });
  };

  const saveManual = async () => {
    if (!manualForm?.colaborador_id || !manualForm.supervisor_id || !manualForm.motivo || !manualForm.data_falta) {
      return showToast("warn", "Lançamento manual", "Selecione o colaborador, supervisor, motivo e data da falta.");
    }
    if (manualForm.tipo_ausencia === "parcial" && !manualForm.quantidade_horas) {
      return showToast("warn", "Lançamento manual", "Informe quantas horas correspondem à falta parcial.");
    }
    setLoading(true);
    try {
      const { data } = await connect.post("/controle-faltas", manualForm);
      setManualForm(null);
      setRefresh((value) => value + 1);
      showToast("success", "Falta lançada", `${data.message} Requisição #${data.requisicao_id}.`);
    } catch (error) {
      showToast("error", "Não foi possível lançar a falta", error.response?.data || "Confira os dados informados.");
    } finally {
      setLoading(false);
    }
  };

  const timerBody = (record) => {
    if (!hasDocumentDeadline(record.motivo) || record.status === "tratada") return <span className="absence-no-timer">Sem prazo</span>;
    const timer = remaining(record.prazo_atestado, now);
    return <span className={`absence-timer ${timer?.expired ? "is-expired" : ""}`}><i className={`pi ${timer?.expired ? "pi-exclamation-triangle" : "pi-clock"}`} />{timer?.text || "—"}</span>;
  };

  const classificationBody = (record) => {
    const config = record.classificacao === "justificada"
      ? { label: "JUSTIFICADA", severity: "success" }
      : record.classificacao === "injustificada"
        ? { label: "INJUSTIFICADA", severity: "danger" }
        : { label: "EM ANÁLISE", severity: "warning" };
    return <Tag value={config.label} severity={config.severity} />;
  };

  return <section className="absence-page">
    <PageHeader
      section="Gestão de ponto"
      title="Controle de Faltas"
      description="Registros gerados automaticamente pelas requisições de reposição."
      actions={<>
        <Button icon="pi pi-filter-fill" label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"} onClick={(event) => filterPanel.current?.toggle(event)} />
        {canEdit && <Button icon="pi pi-plus" label="Lançar falta" onClick={openManual} />}
        <Button icon="pi pi-refresh" label="Atualizar" outlined onClick={() => setRefresh((value) => value + 1)} />
      </>}
    />
    <div className="absence-summary">
      <article><i className="pi pi-list" /><div><small>Total</small><strong>{summary.total}</strong></div></article>
      <article><i className="pi pi-inbox" /><div><small>Pendentes</small><strong>{summary.pending}</strong></div></article>
      <article className="is-danger"><i className="pi pi-stopwatch" /><div><small>Documentos vencidos</small><strong>{summary.expired}</strong></div></article>
      <article><i className="pi pi-check-circle" /><div><small>Tratadas</small><strong>{summary.treated}</strong></div></article>
    </div>
    <div className="absence-panel">
      <div className="absence-filters">
        <span className="p-input-icon-left"><i className="pi pi-search" /><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar colaborador, matrícula ou contrato" /></span>
      </div>
      <DataTable value={filtered} paginator rows={10} rowsPerPageOptions={[10, 25, 50, 100]} stripedRows emptyMessage="Nenhuma falta encontrada." dataKey="id" size="small">
        <Column field="data_falta" header="Data" sortable body={(record) => new Date(record.data_falta).toLocaleDateString("pt-BR")} />
        <Column field="colaborador" header="Colaborador" sortable body={(record) => <div className="absence-person"><strong>{record.colaborador}</strong><small>Matrícula {record.matricula}</small></div>} />
        <Column field="contrato" header="Contrato" sortable body={(record) => <div className="absence-person"><strong>{record.contrato}</strong><small>DPTO. {record.departamento ?? "—"}</small></div>} />
        <Column field="motivo" header="Motivo" sortable body={(record) => <div className="absence-person"><strong>{record.motivo}</strong><small>{record.tipo_ausencia === "parcial" ? `Parcial · ${record.quantidade_horas || 0}h` : "Integral"}</small></div>} />
        <Column header="Prazo do documento" body={timerBody} />
        <Column header="Classificação" field="classificacao" sortable body={classificationBody} />
        <Column field="status" header="Tratativa" sortable body={(record) => <Tag value={record.status === "tratada" ? "TRATADA" : "PENDENTE"} severity={record.status === "tratada" ? "success" : "info"} />} />
        {canEdit && <Column header="Ações" body={(record) => <Button icon="pi pi-pencil" rounded text aria-label={`Tratar falta de ${record.colaborador}`} onClick={() => open(record)} />} />}
      </DataTable>
    </div>

    <OverlayPanel ref={filterPanel} className="absence-filter-panel">
      <div className="absence-filter-title"><div><strong>Filtrar faltas</strong><span>O período começa no mês atual.</span></div><Button icon="pi pi-filter-slash" text rounded aria-label="Limpar filtros" onClick={clearFilters} /></div>
      <div className="absence-filter-grid">
        <label className="is-wide"><span>Período</span><Calendar value={dateRange} onChange={(event) => setDateRange(event.value)} selectionMode="range" readOnlyInput hideOnRangeSelection dateFormat="dd/mm/yy" showIcon /></label>
        <label><span>Situação</span><Dropdown value={statusFilter} options={[{ label: "Todas", value: ALL }, { label: "Pendentes", value: "pendente" }, { label: "Tratadas", value: "tratada" }]} onChange={(event) => setStatusFilter(event.value)} /></label>
        <label><span>Classificação</span><Dropdown value={classificationFilter} options={[{ label: "Todas", value: ALL }, ...CLASSIFICATIONS, { label: "Em análise", value: "em_analise" }]} onChange={(event) => setClassificationFilter(event.value)} /></label>
        <label><span>Departamento</span><Dropdown value={departmentFilter} options={[{ label: "Todos", value: ALL }, ...filterOptions.departments]} onChange={(event) => setDepartmentFilter(event.value)} filter /></label>
        <label><span>Supervisor</span><Dropdown value={supervisorFilter} options={[{ label: "Todos", value: ALL }, ...filterOptions.supervisors]} onChange={(event) => setSupervisorFilter(event.value)} filter /></label>
        <label className="is-wide"><span>Motivo</span><Dropdown value={reasonFilter} options={[{ label: "Todos", value: ALL }, ...filterOptions.reasons]} onChange={(event) => setReasonFilter(event.value)} filter /></label>
        <label className="is-wide"><span>Contrato</span><Dropdown value={contractFilter} options={[{ label: "Todos", value: ALL }, ...filterOptions.contracts]} onChange={(event) => setContractFilter(event.value)} filter /></label>
        <label className="is-wide"><span>Colaborador</span><Dropdown value={collaboratorFilter} options={[{ label: "Todos", value: ALL }, ...filterOptions.collaborators]} onChange={(event) => setCollaboratorFilter(event.value)} filter /></label>
      </div>
    </OverlayPanel>

    <Dialog header={`Tratativa da falta · ${editing?.colaborador || ""}`} visible={Boolean(editing)} modal className="absence-dialog" onHide={() => setEditing(null)}>
      {editing && <div className="absence-form">
        <div className="absence-context"><strong>{editing.contrato}</strong><span>{editing.supervisor} · Requisição #{editing.requisicao_id}</span></div>
        <label>Motivo</label><Dropdown value={form.motivo} options={REASONS} onChange={(event) => setForm({ ...form, motivo: event.value })} />
        <label>Data da falta</label><Calendar value={form.data_falta} onChange={(event) => setForm({ ...form, data_falta: event.value })} dateFormat="dd/mm/yy" showIcon />
        <label>Classificação final</label><Dropdown value={form.classificacao} options={CLASSIFICATIONS} onChange={(event) => setForm({ ...form, classificacao: event.value })} placeholder="Justificada ou injustificada" />
        <label>Observação da tratativa</label><InputTextarea value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} rows={4} autoResize />
        {editing.tratado_por && <small>Última tratativa por {editing.tratado_por} em {new Date(editing.tratado_em).toLocaleString("pt-BR")}.</small>}
        <div className="dialog-actions">
          <Button label="Cancelar" text onClick={() => setEditing(null)} />
          <Button label="Salvar alterações" outlined onClick={() => save(false)} />
          {editing.status === "tratada"
            ? <Button label="Voltar para pendente" severity="warning" icon="pi pi-undo" onClick={reopen} />
            : <Button label="Marcar como tratada" icon="pi pi-check" onClick={() => save(true)} />}
        </div>
      </div>}
    </Dialog>
    <Dialog header="Lançar falta manualmente" visible={Boolean(manualForm)} modal className="absence-manual-dialog" onHide={() => setManualForm(null)}>
      {manualForm && <div className="absence-manual-form">
        <div className="absence-manual-intro">
          <i className="pi pi-info-circle" />
          <span>Este lançamento criará automaticamente uma requisição aberta como <strong>SEM COBERTURA</strong> e registrará seu usuário na timeline.</span>
        </div>

        <label className="is-wide">
          <span>Colaborador ausente</span>
          <CollaboratorDropdown
            value={manualForm.colaborador_id}
            selectedOption={manualForm.colaborador_id ? { id: manualForm.colaborador_id, nome: manualForm.colaborador_nome, matricula: manualForm.colaborador_matricula } : null}
            queryParams={{ com_local: true }}
            onChange={(employeeId, employee) => setManualForm((current) => ({
              ...current,
              colaborador_id: employeeId,
              colaborador_nome: employee?.nome || "",
              colaborador_matricula: employee?.matricula || "",
              contrato: employee?.centro_local || "",
              departamento: employee?.departamento || "",
            }))}
            placeholder="Selecione ou pesquise o colaborador"
          />
        </label>

        {manualForm.colaborador_id && <div className="absence-manual-employee is-wide">
          <div><i className="pi pi-user" /><strong>{manualForm.colaborador_nome}</strong><span>Matrícula {manualForm.colaborador_matricula || "não informada"}</span></div>
          <div><i className="pi pi-building" /><strong>{manualForm.contrato || "Local não informado"}</strong><span>{manualForm.departamento ? `DPTO. ${manualForm.departamento}` : "Sem departamento"}</span></div>
        </div>}

        <label><span>Data e hora da falta</span><Calendar value={manualForm.data_falta} onChange={(event) => setManualForm({ ...manualForm, data_falta: event.value })} dateFormat="dd/mm/yy" showTime hourFormat="24" showIcon /></label>
        <label><span>Supervisor responsável</span><Dropdown value={manualForm.supervisor_id} options={supervisors} onChange={(event) => setManualForm({ ...manualForm, supervisor_id: event.value })} placeholder="Selecione" filter /></label>
        <label><span>Motivo</span><Dropdown value={manualForm.motivo} options={REASONS} onChange={(event) => setManualForm({ ...manualForm, motivo: event.value })} placeholder="Selecione o motivo" /></label>
        <label><span>Tipo da falta</span><Dropdown value={manualForm.tipo_ausencia} options={ABSENCE_TYPES} onChange={(event) => setManualForm({ ...manualForm, tipo_ausencia: event.value, quantidade_horas: null })} /></label>
        {manualForm.tipo_ausencia === "parcial" && <label className="is-wide"><span>Quantidade de horas da falta</span><InputNumber value={manualForm.quantidade_horas} onValueChange={(event) => setManualForm({ ...manualForm, quantidade_horas: event.value })} min={0.01} max={23.99} minFractionDigits={0} maxFractionDigits={2} suffix=" h" placeholder="Ex.: 2 horas" /></label>}
        <label className="is-wide"><span>Observação</span><InputTextarea value={manualForm.observacao} onChange={(event) => setManualForm({ ...manualForm, observacao: event.target.value })} rows={4} autoResize placeholder="Descreva informações importantes sobre esta falta" /></label>
        <div className="dialog-actions is-wide">
          <Button label="Cancelar" text onClick={() => setManualForm(null)} />
          <Button label="Lançar e criar requisição" icon="pi pi-check" onClick={saveManual} />
        </div>
      </div>}
    </Dialog>
  </section>;
}
