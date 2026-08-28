import { AppIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
// Controle de Faltas - FaltsControl.jsx
// Utils
import { useEffect, useMemo, useRef, useState } from "react";
import { can } from "../../utils/permissions";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import {
  CombinedFiltersProvider,
  CombinedMultiSelect,
  useCombinedFilters,
} from "../../contexts/CombinedFiltersContext";

// Widgets
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";

// Components
import { PageHeader } from "../../components/PageHeader";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import { Table } from "../../components/tables/Table";
import "../../components/tables/index.css";

// Styles
import "./styles.css";

// Remanejamento é uma alteração de alocação; não deve gerar nem ser tratado
// como falta neste módulo.
const REASONS = ["ATESTADO", "AFASTAMENTO", "DECLARAÇÃO", "INJUSTIFICADA", "POSTO VAGO", "OUTROS"];
const CLASSIFICATIONS = [
  { label: "Justificada", value: "justificada" },
  { label: "Injustificada", value: "injustificada" },
];
const ABSENCE_TYPES = [
  { label: "Integral", value: "integral" },
  { label: "Parcial", value: "parcial" },
];
const hasDocumentDeadline = (reason) => reason?.includes("ATESTADO") || reason?.includes("DECLARA");
const loadedAt = new Date();
const CURRENT_MONTH = [
  new Date(loadedAt.getFullYear(), loadedAt.getMonth(), 1),
  new Date(loadedAt.getFullYear(), loadedAt.getMonth() + 1, 0, 23, 59, 59, 999),
];

function remaining(deadline, now) {
  if (!deadline) return null;
  const milliseconds = new Date(deadline).getTime() - now;
  if (milliseconds <= 0) return { expired: true, text: "Prazo esgotado" };
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return { expired: false, text: `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}min` };
}

function toApiDate(value) {
  if (!value) return null;

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function getExportErrorMessage(error) {
  const response = error.response?.data;

  if (!(response instanceof Blob)) {
    return response?.message || response || "Não foi possível exportar o relatório.";
  }

  try {
    const text = await response.text();
    const parsed = JSON.parse(text);
    return parsed?.message || text || "Não foi possível exportar o relatório.";
  } catch {
    return "Não foi possível exportar o relatório.";
  }
}

const FILTER_DEFINITIONS = {
  status: {
    getValue: (record) => record.status,
    options: [
      { label: "Pendentes", value: "pendente" },
      { label: "Tratadas", value: "tratada" },
    ],
  },
  classificacao: {
    getValue: (record) => record.classificacao || "em_analise",
    options: [
      ...CLASSIFICATIONS,
      { label: "Em análise", value: "em_analise" },
    ],
  },
  departamento: {
    getValue: (record) => String(record.departamento ?? ""),
    getLabel: (record) => `DPTO. ${record.departamento}`,
  },
  supervisor: {
    getValue: (record) => String(record.supervisor ?? ""),
    getLabel: (record) => record.supervisor,
  },
  motivo: {
    getValue: (record) => String(record.motivo ?? ""),
    getLabel: (record) => record.motivo,
  },
  contrato: {
    getValue: (record) => String(record.contrato ?? ""),
    getLabel: (record) => record.contrato,
  },
  colaborador: {
    getValue: (record) => `${record.colaborador || ""}|||${record.matricula || ""}`,
    getLabel: (record) => record.matricula
      ? `${record.colaborador} · ${record.matricula}`
      : record.colaborador,
  },
};

function AbsenceControlPage() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(() => [...CURRENT_MONTH]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [manualForm, setManualForm] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [supervisors, setSupervisors] = useState([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [now, setNow] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const filterPanel = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canEdit = can("controle_faltas", "edit");
  const {
    filters,
    options: filterOptions,
    setFilter,
    clearFilters: clearCombinedFilters,
    filteredData: combinedFilteredRecords,
    activeFilterCount,
  } = useCombinedFilters(records);
  const initialStatusApplied = useRef(false);

  useEffect(() => {
    if (initialStatusApplied.current) return;
    initialStatusApplied.current = true;
    setFilter("status", ["pendente"]);
  }, [setFilter]);

  useEffect(() => {
    connect.get("/controle-faltas")
      .then(({ data }) => { setRecords(Array.isArray(data) ? data : []); setNow(Date.now()); })
      .catch((error) => showToast("error", "Controle de Faltas", error.response?.data || "Não foi possível carregar os registros."));
  }, [refresh, showToast]);

  const manualCenterId = manualForm?.centro_custo_id;

  useEffect(() => {
    if (!manualCenterId) {
      setSupervisors([]);
      return undefined;
    }

    let active = true;
    setLoadingSupervisors(true);
    connect.get("/estrutura/supervisores", { params: { centro_id: manualCenterId } })
      .then(({ data }) => {
        if (!active) return;
        setSupervisors((Array.isArray(data) ? data : [])
          .map((supervisor) => ({ label: supervisor.nome, value: supervisor.id }))
          .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")));
      })
      .catch((error) => {
        if (!active) return;
        setSupervisors([]);
        showToast(
          "error",
          "Supervisores",
          error.response?.data || "Não foi possível carregar o supervisor responsável pelo local.",
        );
      })
      .finally(() => {
        if (active) setLoadingSupervisors(false);
      });

    return () => { active = false; };
  }, [manualCenterId, showToast]);

  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()); setRefresh((value) => value + 1); }, 60_000);
    const reload = () => setRefresh((value) => value + 1);
    socketio.on("absence_control_update", reload);
    socketio.on("new_request", reload);
    return () => { window.clearInterval(timer); socketio.off("absence_control_update", reload); socketio.off("new_request", reload); };
  }, []);

  const filtered = useMemo(() => combinedFilteredRecords.filter((record) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const recordDate = new Date(record.data_falta);
    const rangeStart = dateRange?.[0] ? new Date(dateRange[0]) : null;
    const rangeEnd = dateRange?.[1] ? new Date(dateRange[1]) : null;

    rangeStart?.setHours(0, 0, 0, 0);
    rangeEnd?.setHours(23, 59, 59, 999);

    if (rangeStart && recordDate < rangeStart) return false;
    if (rangeEnd && recordDate > rangeEnd) return false;

    return !term || [
      record.colaborador,
      record.matricula,
      record.contrato,
      record.supervisor,
      record.motivo,
    ].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term));
  }), [combinedFilteredRecords, search, dateRange]);

  // Os indicadores precisam refletir o mesmo recorte da tabela: período,
  // busca e todos os filtros avançados aplicados pelo usuário.
  const summary = useMemo(() => filtered.reduce((result, record) => {
    result.total += 1;
    if (record.status === "tratada") result.treated += 1;
    else result.pending += 1;
    if (record.status === "pendente" && hasDocumentDeadline(record.motivo) && remaining(record.prazo_atestado, now)?.expired) result.expired += 1;
    return result;
  }, { total: 0, pending: 0, expired: 0, treated: 0 }), [filtered, now]);

  const clearFilters = () => {
    clearCombinedFilters();
    setDateRange([...CURRENT_MONTH]);
    setSearch("");
  };

  const exportAbsences = async () => {
    if (!filtered.length) {
      showToast("warn", "Exportação", "Não há faltas para exportar com os filtros atuais.");
      return;
    }

    // A rota atual ainda não aceita busca textual; evita uma exportação diferente da tela.
    if (search.trim()) {
      showToast(
        "warn",
        "Exportação",
        "Limpe a busca textual para exportar. A planilha respeita período e filtros avançados.",
      );
      return;
    }

    const params = new URLSearchParams();
    const inicio = toApiDate(dateRange?.[0]);
    const fim = toApiDate(dateRange?.[1]);

    if (inicio) params.append("inicio", inicio);
    if (fim) params.append("fim", fim);

    Object.entries({
      status: filters.status,
      classificacao: filters.classificacao,
      departamento: filters.departamento,
      supervisor: filters.supervisor,
      motivo: filters.motivo,
      contrato: filters.contrato,
      // O seletor mantém "nome|||matrícula"; a API recebe somente o nome.
      colaborador: filters.colaborador.map((value) => String(value).split("|||")[0]),
    }).forEach(([name, values]) => {
      values.forEach((value) => params.append(name, value));
    });

    setExporting(true);
    try {
      const { data } = await connect.get("/controle-faltas/export", {
        params,
        responseType: "blob",
      });

      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `controle_faltas_${toApiDate(new Date())}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);

      showToast("success", "Exportação concluída", "A planilha foi baixada com os filtros aplicados.");
    } catch (error) {
      showToast("error", "Falha na exportação", await getExportErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

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
      centro_custo_id: null,
      contrato: "",
      departamento: "",
      supervisor_usuario_id: null,
      houve_cobertura: false,
      cobertura_colaborador_id: null,
      cobertura_nome: "",
      cobertura_matricula: "",
      motivo: null,
      tipo_ausencia: "integral",
      quantidade_horas: null,
      data_falta: new Date(),
      observacao: "",
    });
  };

  const saveManual = async () => {
    if (!manualForm?.colaborador_id || !manualForm.supervisor_usuario_id || !manualForm.motivo || !manualForm.data_falta) {
      return showToast("warn", "Lançamento manual", "Selecione o colaborador, supervisor, motivo e data da falta.");
    }
    if (manualForm.tipo_ausencia === "parcial" && !manualForm.quantidade_horas) {
      return showToast("warn", "Lançamento manual", "Informe quantas horas correspondem à falta parcial.");
    }
    if (manualForm.houve_cobertura && !manualForm.cobertura_colaborador_id) {
      return showToast("warn", "Lançamento manual", "Selecione quem realizou a cobertura.");
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
    return <span className={`absence-timer ${timer?.expired ? "is-expired" : ""}`}><AppIcon name={timer?.expired ? "alert-triangle" : "clock"} />{timer?.text || "—"}</span>;
  };

  const classificationBody = (record) => {
    const config = record.classificacao === "justificada"
      ? { label: "JUSTIFICADA", severity: "success" }
      : record.classificacao === "injustificada"
        ? { label: "INJUSTIFICADA", severity: "danger" }
        : { label: "EM ANÁLISE", severity: "warning" };
    return <Tag value={config.label} severity={config.severity} />;
  };

  const additionalBody = (record) => {
    if (!record.adicional_tipo || record.adicional_valor_diaria == null) return "—";
    const value = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(record.adicional_valor_diaria));
    return <div className="absence-person"><strong>{value} por dia</strong><small>{record.adicional_tipo}</small></div>;
  };

  const additionalRecipientBody = (record) => {
    if (!record.adicional_tipo || !record.beneficiario_adicional) return "—";
    return (
      <div className="absence-person">
        <strong>{record.beneficiario_adicional}</strong>
        <small>Matrícula {record.beneficiario_adicional_matricula || "—"}</small>
      </div>
    );
  };

  return <section className="absence-page">
    <PageHeader
      section="Gestão de ponto"
      title="Controle de Faltas"
      description="Registros gerados automaticamente pelas requisições de reposição."
      actions={<>
        <Button icon={<AppIcon name="filter-filled" />} label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"} onClick={(event) => filterPanel.current?.toggle(event)} />
        <Button
          icon={<AppIcon name="file-spreadsheet" />}
          label="Exportar XLSX"
          outlined
          loading={exporting}
          disabled={exporting || !filtered.length}
          onClick={exportAbsences}
        />
        {canEdit && <Button icon={<AppIcon name="plus" />} label="Lançar falta" onClick={openManual} />}
      </>}
    />
    <div className="absence-summary">
      <article><AppIcon name="list"  /><div><small>Total</small><strong>{summary.total}</strong></div></article>
      <article><AppIcon name="inbox"  /><div><small>Pendentes</small><strong>{summary.pending}</strong></div></article>
      <article className="is-danger"><AppIcon name="stopwatch"  /><div><small>Documentos vencidos</small><strong>{summary.expired}</strong></div></article>
      <article><AppIcon name="circle-check"  /><div><small>Tratadas</small><strong>{summary.treated}</strong></div></article>
    </div>
    <div className="absence-panel">
      <div className="absence-filters">
        <span className="p-input-icon-left">
          <AppIcon name="search" className="px-3"  />
          <InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar colaborador, matrícula ou contrato" />
        </span>
      </div>
      <Table
        data={filtered}
        dataKey="id"
        rows={10}
        rowsPerPageOptions={[10, 25, 50, 100]}
        emptyTitle="Nenhuma falta encontrada."
        tableClassName="absence-table"
        tableStyle={{ minWidth: "90rem" }}
        columns={[
          { field: "data_falta", header: "Data", sortable: true, body: (record) => new Date(record.data_falta).toLocaleDateString("pt-BR") },
          { field: "colaborador", header: "Colaborador", sortable: true, body: (record) => <div className="absence-person"><strong>{record.colaborador}</strong><small>Matrícula {record.matricula}</small></div> },
          { field: "contrato", header: "Contrato", sortable: true, body: (record) => <div className="absence-person"><strong>{record.contrato}</strong><small>DPTO. {record.departamento ?? "—"}</small></div> },
          { field: "motivo", header: "Motivo", sortable: true, body: (record) => <div className="absence-person"><strong>{record.motivo}</strong><small>{record.tipo_ausencia === "parcial" ? `Parcial · ${record.quantidade_horas || 0}h` : "Integral"}</small></div> },
          { header: "Adicional", body: additionalBody },
          { header: "Nominal", body: additionalRecipientBody },
          { header: "Prazo do documento", body: timerBody },
          { field: "classificacao", header: "Classificação", sortable: true, body: classificationBody },
          { field: "status", header: "Tratativa", sortable: true, body: (record) => <Tag value={record.status === "tratada" ? "TRATADA" : "PENDENTE"} severity={record.status === "tratada" ? "success" : "info"} /> },
          ...(canEdit ? [{ header: "Ações", body: (record) => <Button icon={<AppIcon name="pencil" />} rounded text aria-label={`Tratar falta de ${record.colaborador}`} onClick={() => open(record)} /> }] : []),
        ]}
      />
    </div>

    <OverlayPanel ref={filterPanel} className="absence-filter-panel">
      <div className="absence-filter-title"><div><strong>Filtrar faltas</strong><span>O período começa no mês atual.</span></div><Button icon={<AppIcon name="filter-off" />} text rounded aria-label="Limpar filtros" onClick={clearFilters} /></div>
      <StandardFilterFields date={{ value: dateRange, onChange: setDateRange }} />
      <div className="absence-filter-grid">
        <CombinedMultiSelect name="status" label="Situação" options={filterOptions.status} placeholder="Todas as situações" />
        <CombinedMultiSelect name="classificacao" label="Classificação" options={filterOptions.classificacao} placeholder="Todas as classificações" />
        <CombinedMultiSelect name="supervisor" label="Supervisor" options={filterOptions.supervisor} placeholder="Todos os supervisores" />
        <CombinedMultiSelect name="motivo" label="Motivo" options={filterOptions.motivo} placeholder="Todos os motivos" className="is-wide" />
        <CombinedMultiSelect name="colaborador" label="Colaborador" options={filterOptions.colaborador} placeholder="Todos os colaboradores" className="is-wide" />
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
            ? <Button label="Voltar para pendente" severity="warning" icon={<AppIcon name="arrow-back-up" />} onClick={reopen} />
            : <Button label="Marcar como tratada" icon={<AppIcon name="check" />} onClick={() => save(true)} />}
        </div>
      </div>}
    </Dialog>
    <Dialog header="Lançar falta manualmente" visible={Boolean(manualForm)} modal className="absence-manual-dialog" onHide={() => setManualForm(null)}>
      {manualForm && <div className="absence-manual-form">
        <div className="absence-manual-intro">
          <AppIcon name="info-circle"  />
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
              centro_custo_id: employee?.centro_id || null,
              contrato: employee?.centro_local || "",
              departamento: employee?.departamento || "",
              supervisor_usuario_id: null,
              cobertura_colaborador_id: null,
              cobertura_nome: "",
              cobertura_matricula: "",
            }))}
            placeholder="Selecione ou pesquise o colaborador"
          />
        </label>

        {manualForm.colaborador_id && <div className="absence-manual-employee is-wide">
          <div><AppIcon name="user"  /><strong>{manualForm.colaborador_nome}</strong><span>Matrícula {manualForm.colaborador_matricula || "não informada"}</span></div>
          <div><AppIcon name="building"  /><strong>{manualForm.contrato || "Local não informado"}</strong><span>{manualForm.departamento ? `DPTO. ${manualForm.departamento}` : "Sem departamento"}</span></div>
        </div>}

        <label><span>Data e hora da falta</span><Calendar value={manualForm.data_falta} onChange={(event) => setManualForm({ ...manualForm, data_falta: event.value })} dateFormat="dd/mm/yy" showTime hourFormat="24" showIcon /></label>
        <label><span>Supervisor responsável</span><Dropdown value={manualForm.supervisor_usuario_id} options={supervisors} onChange={(event) => setManualForm({ ...manualForm, supervisor_usuario_id: event.value })} placeholder="Selecione" filter loading={loadingSupervisors} disabled={!manualCenterId || loadingSupervisors} emptyMessage="Nenhum supervisor vinculado a este local" emptyFilterMessage="Nenhum supervisor encontrado" /></label>
        <label><span>Motivo</span><Dropdown value={manualForm.motivo} options={REASONS} onChange={(event) => setManualForm({ ...manualForm, motivo: event.value })} placeholder="Selecione o motivo" /></label>
        <label><span>Tipo da falta</span><Dropdown value={manualForm.tipo_ausencia} options={ABSENCE_TYPES} onChange={(event) => setManualForm({ ...manualForm, tipo_ausencia: event.value, quantidade_horas: null })} /></label>
        {manualForm.tipo_ausencia === "parcial" && <label className="is-wide"><span>Quantidade de horas da falta</span><InputNumber value={manualForm.quantidade_horas} onValueChange={(event) => setManualForm({ ...manualForm, quantidade_horas: event.value })} min={0.01} max={23.99} minFractionDigits={0} maxFractionDigits={2} suffix=" h" placeholder="Ex.: 2 horas" /></label>}
        <label className="absence-manual-coverage-toggle is-wide" htmlFor="manual-absence-has-coverage">
          <Checkbox
            inputId="manual-absence-has-coverage"
            checked={manualForm.houve_cobertura}
            onChange={(event) => setManualForm((current) => ({
              ...current,
              houve_cobertura: Boolean(event.checked),
              cobertura_colaborador_id: event.checked ? current.cobertura_colaborador_id : null,
              cobertura_nome: event.checked ? current.cobertura_nome : "",
              cobertura_matricula: event.checked ? current.cobertura_matricula : "",
            }))}
          />
          <span>Houve cobertura?</span>
        </label>
        {manualForm.houve_cobertura && <label className="is-wide">
          <span>Quem realizou a cobertura</span>
          <CollaboratorDropdown
            value={manualForm.cobertura_colaborador_id}
            selectedOption={manualForm.cobertura_colaborador_id ? {
              id: manualForm.cobertura_colaborador_id,
              nome: manualForm.cobertura_nome,
              matricula: manualForm.cobertura_matricula,
            } : null}
            queryParams={{
              centro_id: manualForm.centro_custo_id,
              situacao: 1,
              excluir_id: manualForm.colaborador_id,
            }}
            onChange={(employeeId, employee) => setManualForm((current) => ({
              ...current,
              cobertura_colaborador_id: employeeId,
              cobertura_nome: employee?.nome || "",
              cobertura_matricula: employee?.matricula || "",
            }))}
            placeholder="Selecione quem cobriu a falta"
            emptyMessage="Nenhum colaborador ativo encontrado neste local"
          />
        </label>}
        <label className="is-wide"><span>Observação</span><InputTextarea value={manualForm.observacao} onChange={(event) => setManualForm({ ...manualForm, observacao: event.target.value })} rows={4} autoResize placeholder="Descreva informações importantes sobre esta falta" /></label>
        <div className="dialog-actions is-wide">
          <Button label="Cancelar" text onClick={() => setManualForm(null)} />
          <Button label="Lançar e criar requisição" icon={<AppIcon name="check" />} onClick={saveManual} />
        </div>
      </div>}
    </Dialog>
  </section>;
}

export function AbsenceControl() {
  return (
    <CombinedFiltersProvider definitions={FILTER_DEFINITIONS}>
      <AbsenceControlPage />
    </CombinedFiltersProvider>
  );
}
