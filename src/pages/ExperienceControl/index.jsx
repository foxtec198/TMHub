import { AppIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { StandardFilterButton } from "../../components/filters/StandardFilterButton";
// Controle de período de experiência.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";

import { PageHeader } from "../../components/PageHeader";
import { Table } from "../../components/tables/Table";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { can } from "../../utils/permissions";
import connect from "../../utils/request";
import "./signature.css";
import "./styles.css";


const COMPETENCIES = [
  { key: "adaptacao_local_trabalho", label: "Adaptação ao local de trabalho" },
  { key: "iniciativa_interesse", label: "Iniciativa e interesse" },
  { key: "relacionamento_interpessoal", label: "Relacionamento interpessoal" },
  { key: "capacidade_aprendizagem", label: "Capacidade de aprendizagem" },
  { key: "produtividade", label: "Produtividade" },
];

const RATING_OPTIONS = [
  { label: "Não atende", value: "nao_atende" },
  { label: "Atende parcialmente", value: "atende_parcial" },
  { label: "Atende", value: "atende" },
];

const PROFILE_OPTIONS = [
  { label: "Perfil incompatível; inviável a permanência", value: "incompativel" },
  { label: "Bom perfil; pode ser desenvolvido para permanecer", value: "bom_desenvolvivel" },
  { label: "Excelente contratação", value: "excelente" },
];

const DECISION_OPTIONS = [
  { label: "Demitir", value: "demitir" },
  { label: "Efetivar", value: "efetivar" },
  { label: "Prorrogar", value: "prorrogar" },
];

const STATUS = {
  aberta: { label: "ABERTA", severity: "info" },
  em_preenchimento: { label: "EM PREENCHIMENTO", severity: "info" },
  aguardando_rh: { label: "AGUARDANDO RH", severity: "warning" },
  concluida: { label: "CONCLUÍDA", severity: "success" },
  atrasada: { label: "ATRASADA", severity: "danger" },
  cancelada: { label: "CANCELADA", severity: "secondary" },
  aguardando_abertura: { label: "AGUARDANDO ABERTURA", severity: "secondary" },
};

const STATUS_OPTIONS = Object.entries(STATUS)
  .filter(([value]) => value !== "aguardando_abertura")
  .map(([value, item]) => ({ label: item.label, value }));

const ADMIN_STATUS_OPTIONS = STATUS_OPTIONS.filter(({ value }) => (
  ["aberta", "em_preenchimento", "atrasada", "aguardando_rh", "concluida"].includes(value)
));

function dateLabel(value, withTime = false) {
  if (!value) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly && !withTime) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", withTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" });
}

function errorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (!error?.response) return "Não foi possível conectar ao servidor.";
  return fallback;
}

async function blobErrorMessage(error) {
  const response = error?.response?.data;
  if (!(response instanceof Blob)) return errorMessage(error, "Não foi possível exportar a avaliação.");
  try {
    const text = await response.text();
    const parsed = JSON.parse(text);
    return parsed?.message || text || "Não foi possível exportar a avaliação.";
  } catch {
    return "Não foi possível exportar a avaliação.";
  }
}

function formFromEvaluation(evaluation) {
  return {
    competencias: evaluation?.competencias || {},
    classificacao_perfil: evaluation?.classificacao_perfil || null,
    decisao_supervisor: evaluation?.decisao_supervisor || null,
    observacoes_supervisor: evaluation?.observacoes_supervisor || "",
    observacoes_rh: evaluation?.observacoes_rh || "",
    status: evaluation?.status || null,
  };
}

function statusTag(status) {
  const current = STATUS[status] || { label: String(status || "—").toUpperCase(), severity: "secondary" };
  return <Tag value={current.label} severity={current.severity} />;
}

export function ExperienceControl() {
  // A tela interna concentra a gestão do RH e preserva as permissões existentes.
  const [supervisors, setSupervisors] = useState([]);
  const [selectedSupervisors, setSelectedSupervisors] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [rhRecords, setRhRecords] = useState([]);
  const [employeesInExperience, setEmployeesInExperience] = useState([]);
  const [registeredSigners, setRegisteredSigners] = useState([]);
  const [selectedSignerId, setSelectedSignerId] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [form, setForm] = useState(formFromEvaluation(null));
  const [exporting, setExporting] = useState(false);
  const [manualCompletionVisible, setManualCompletionVisible] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [revision, setRevision] = useState(0);
  const filterPanel = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canRh = can("controle_experiencia_rh");
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

  const loadSupervisors = useCallback(async () => {
    if (!canRh) return;
    try {
      const { data } = await connect.get("/avaliacoes-experiencia/supervisores");
      setSupervisors((Array.isArray(data) ? data : []).map((item) => ({ label: item.nome, value: item.id })));
    } catch (error) {
      showToast("error", "Período de experiência", errorMessage(error, "Não foi possível carregar os supervisores."));
    }
  }, [canRh, showToast]);

  const loadRh = useCallback(async () => {
    // Carrega a fila de avaliações e a visão geral dos colaboradores em experiência.
    if (!canRh) return;
    try {
      const [evaluationsResponse, employeesResponse, signaturesResponse] = await Promise.all([
        connect.get("/avaliacoes-experiencia"),
        connect.get("/avaliacoes-experiencia/em-experiencia"),
        ...(isAdmin ? [connect.get("/avaliacoes-experiencia/assinaturas-cadastradas")] : []),
      ]);
      setRhRecords(Array.isArray(evaluationsResponse.data) ? evaluationsResponse.data : []);
      setEmployeesInExperience(Array.isArray(employeesResponse.data) ? employeesResponse.data : []);
      if (isAdmin) setRegisteredSigners(Array.isArray(signaturesResponse?.data) ? signaturesResponse.data : []);
    } catch (error) {
      showToast("error", "Período de experiência", errorMessage(error, "Não foi possível carregar o controle do RH."));
    }
  }, [canRh, isAdmin, showToast]);

  useEffect(() => { loadSupervisors(); }, [loadSupervisors, revision]);
  useEffect(() => { loadRh(); }, [loadRh, revision]);

  const openEvaluation = async (evaluationId) => {
    // O detalhe contém o formulário completo e o histórico consolidado do RH.
    setLoading(true);
    try {
      const { data } = await connect.get(`/avaliacoes-experiencia/${evaluationId}`);
      setSelectedEvaluation(data);
      setForm(formFromEvaluation(data));
      setSelectedSignerId(null);
    } catch (error) {
      showToast("error", "Avaliação", errorMessage(error, "Não foi possível carregar a avaliação."));
    } finally {
      setLoading(false);
    }
  };

  const refreshAfterMutation = (evaluation) => {
    // Mantém o diálogo sincronizado e atualiza as tabelas após qualquer tratativa.
    setSelectedEvaluation(evaluation);
    setForm(formFromEvaluation(evaluation));
    setRevision((value) => value + 1);
  };

  const saveRh = async (complete = false) => {
    if (!selectedEvaluation) return;
    setLoading(true);
    try {
      const payload = {
        classificacao_perfil: form.classificacao_perfil,
        decisao_supervisor: form.decisao_supervisor,
        observacoes_rh: form.observacoes_rh,
        ...(isAdmin ? {
          competencias: form.competencias,
          observacoes_supervisor: form.observacoes_supervisor,
        } : {}),
      };
      const url = complete
        ? `/avaliacoes-experiencia/${selectedEvaluation.id}/rh/concluir`
        : `/avaliacoes-experiencia/${selectedEvaluation.id}/rh`;
      const response = complete ? await connect.post(url, payload) : await connect.patch(url, payload);
      refreshAfterMutation(response.data);
      showToast("success", "Avaliação", complete
        ? "Avaliação concluída pelo RH."
        : "Rascunho do RH salvo com sucesso.");
    } catch (error) {
      showToast("error", "Avaliação", errorMessage(error, "Confira os dados antes de salvar."));
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = async () => {
    // Reutiliza o padrão de exportação do projeto: download do blob fornecido pela API.
    if (!selectedEvaluation) return;
    setExporting(true);
    try {
      const { data } = await connect.get(`/avaliacoes-experiencia/${selectedEvaluation.id}/export`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      const collaboratorName = String(selectedEvaluation.colaborador?.nome || "COLABORADOR")
        .toLocaleUpperCase("pt-BR")
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const collaboratorCode = String(selectedEvaluation.colaborador?.matricula || selectedEvaluation.id)
        .replace(/[\\/:*?"<>|\s]+/g, "");
      anchor.download = `${collaboratorName || "COLABORADOR"} - ${collaboratorCode || selectedEvaluation.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast("success", "Exportação concluída", "O PDF da avaliação foi baixado.");
    } catch (error) {
      showToast("error", "Falha na exportação", await blobErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const openSupervisorPage = () => {
    window.open("/avaliacoes-experiencia/avaliar", "_blank", "noopener,noreferrer");
  };

  const deleteEvaluation = async (evaluation) => {
    if (!window.confirm(`Excluir a avaliação concluída de ${evaluation.colaborador?.nome || "este colaborador"}?`)) return;
    setLoading(true);
    try {
      await connect.delete(`/avaliacoes-experiencia/${evaluation.id}`);
      setSelectedEvaluation(null);
      setRevision((value) => value + 1);
      showToast("success", "Avaliação", "Avaliação excluída com sucesso.");
    } catch (error) {
      showToast("error", "Avaliação", errorMessage(error, "Não foi possível excluir a avaliação."));
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedSupervisors([]);
    setSelectedDepartments([]);
    setSelectedStatuses([]);
    setSearch("");
  };

  const changeTaskStatus = async (status) => {
    if (!selectedEvaluation || !isAdmin || status === selectedEvaluation.status) return;
    setLoading(true);
    try {
      const { data } = await connect.patch(
        `/avaliacoes-experiencia/${selectedEvaluation.id}/estado`,
        { status },
      );
      refreshAfterMutation(data);
      showToast("success", "Estado da tarefa", "O estado da avaliação foi atualizado.");
    } catch (error) {
      showToast("error", "Estado da tarefa", errorMessage(error, "Não foi possível alterar o estado da avaliação."));
    } finally {
      setLoading(false);
    }
  };

  const requestTaskStatusChange = (status) => {
    if (!selectedEvaluation || !isAdmin || status === selectedEvaluation.status) return;
    if (status === "concluida") {
      setPendingStatus(status);
      setManualCompletionVisible(true);
      return;
    }
    changeTaskStatus(status);
  };

  const confirmManualCompletion = () => {
    setManualCompletionVisible(false);
    changeTaskStatus(pendingStatus);
    setPendingStatus(null);
  };

  const filteredRhRecords = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return rhRecords.filter((item) => {
      const matchesSupervisor = !selectedSupervisors.length
        || selectedSupervisors.includes(item.supervisor?.id);
      const matchesDepartment = !selectedDepartments.length
        || selectedDepartments.includes(String(item.colaborador?.departamento || ""));
      const matchesStatus = !selectedStatuses.length || selectedStatuses.includes(item.status);
      const matchesSearch = !term || [
      item.colaborador?.nome,
      item.colaborador?.matricula,
      item.colaborador?.centro_custo,
      item.supervisor?.nome,
      item.status,
      ].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term));
      return matchesSupervisor && matchesDepartment && matchesStatus && matchesSearch;
    });
  }, [rhRecords, search, selectedDepartments, selectedStatuses, selectedSupervisors]);

  const departmentOptions = useMemo(() => (
    [...new Set(rhRecords
      .map((item) => String(item.colaborador?.departamento || "").trim())
      .filter(Boolean))]
      .sort((first, second) => first.localeCompare(second, "pt-BR"))
      .map((department) => ({ label: department, value: department }))
  ), [rhRecords]);

  const activeFilterCount = Number(Boolean(selectedSupervisors.length))
    + Number(Boolean(selectedDepartments.length))
    + Number(Boolean(selectedStatuses.length))
    + Number(Boolean(search.trim()));

  const summary = useMemo(() => filteredRhRecords.reduce((result, item) => {
    result.total += 1;
    if (item.status === "aguardando_rh") result.waitingRh += 1;
    if (item.status === "atrasada") result.overdue += 1;
    if (item.status === "concluida") result.completed += 1;
    return result;
  }, { total: 0, waitingRh: 0, overdue: 0, completed: 0 }), [filteredRhRecords]);

  const adminCanEdit = isAdmin && Boolean(selectedEvaluation);
  const rhCanEdit = canRh && (selectedEvaluation?.status === "aguardando_rh" || adminCanEdit);
  const isAwaitingRh = selectedEvaluation?.status === "aguardando_rh";
  const canCompleteRh = canRh && isAwaitingRh;
  const rhReady = PROFILE_OPTIONS.some((option) => option.value === form.classificacao_perfil)
    && DECISION_OPTIONS.some((option) => option.value === form.decisao_supervisor);
  const updateRhForm = (change) => {
    // A API invalida a assinatura após salvar qualquer alteração real do RH.
    setForm((current) => ({ ...current, ...change }));
  };

  const statusOptions = useMemo(() => {
    const current = STATUS_OPTIONS.find((item) => item.value === selectedEvaluation?.status);
    return current && !ADMIN_STATUS_OPTIONS.some((item) => item.value === current.value)
      ? [current, ...ADMIN_STATUS_OPTIONS]
      : ADMIN_STATUS_OPTIONS;
  }, [selectedEvaluation?.status]);

  const useRegisteredRhSignature = async () => {
    if (!selectedEvaluation) return;
    setLoading(true);
    try {
      // Salva os campos antes de aplicar a assinatura, pois uma edição a invalida.
      const savePayload = {
        classificacao_perfil: form.classificacao_perfil,
        decisao_supervisor: form.decisao_supervisor,
        observacoes_rh: form.observacoes_rh,
        ...(isAdmin ? {
          competencias: form.competencias,
          observacoes_supervisor: form.observacoes_supervisor,
        } : {}),
      };
      const { data: savedEvaluation } = await connect.patch(
        `/avaliacoes-experiencia/${selectedEvaluation.id}/rh`,
        savePayload,
      );
      const { data } = await connect.post(
        `/avaliacoes-experiencia/${savedEvaluation.id}/rh/assinatura-cadastrada`,
        isAdmin ? { usuario_id: selectedSignerId } : {},
      );
      refreshAfterMutation(data);
      showToast("success", "Assinatura", "Assinatura aplicada com sucesso.");
    } catch (error) {
      showToast("error", "Assinatura", errorMessage(error, "Não foi possível aplicar a assinatura."));
    } finally {
      setLoading(false);
    }
  };
  const evaluationFooter = selectedEvaluation && (
    <div className="experience-dialog-actions">
      {canRh && selectedEvaluation.status === "concluida" && (
        <Button label="Exportar PDF" icon={<AppIcon name="file-type-pdf" />} outlined loading={exporting} onClick={exportPdf} />
      )}
      {rhCanEdit && <>
        <Button label={adminCanEdit ? "Salvar alterações" : "Salvar rascunho"} icon={<AppIcon name="device-floppy" />} outlined onClick={() => saveRh(false)} />
        {canCompleteRh && <Button label="Assinar e concluir" icon={<AppIcon name="check" />} disabled={!rhReady || !selectedEvaluation.assinatura_rh_registrada} onClick={() => saveRh(true)} />}
      </>}
    </div>
  );

  const personBody = (row) => (
    <div className="experience-person">
      <strong>{row.colaborador?.nome}</strong>
      <small>Matrícula {row.colaborador?.matricula || "—"}</small>
    </div>
  );

  if (!canRh) {
    return <section className="experience-page"><PageHeader section="Recursos humanos" title="Período de experiência" description="Você não possui acesso a este controle." /></section>;
  }

  return (
    <section className="experience-page">
      <PageHeader
        section="Recursos humanos"
        title="Período de experiência"
        description="Acompanhe as avaliações de 90 dias e as tratativas pendentes."
        actions={<>
          <StandardFilterButton panelRef={filterPanel} count={activeFilterCount} />
          <Button label="Tela do supervisor" icon={<AppIcon name="external-link" />} outlined onClick={openSupervisorPage} />
        </>}
      />

      <div className="experience-summary">
            <article><small>Em avaliação</small><strong>{summary.total}</strong></article>
            <article><small>Aguardando RH</small><strong>{summary.waitingRh}</strong></article>
            <article className="is-danger"><small>Atrasadas</small><strong>{summary.overdue}</strong></article>
            <article className="is-success"><small>Concluídas</small><strong>{summary.completed}</strong></article>
      </div>
      <article className="experience-panel">
        <div className="experience-list-meta">
          <span>{filteredRhRecords.length} de {rhRecords.length} avaliação(ões) · {employeesInExperience.length} colaborador(es) em experiência</span>
        </div>
            <Table
              data={filteredRhRecords}
              dataKey="id"
              rows={10}
              rowsPerPageOptions={[10, 25, 50, 100]}
              emptyTitle="Nenhuma avaliação encontrada."
              tableStyle={{ minWidth: "68rem" }}
              columns={[
                { header: "Colaborador", body: personBody, style: { minWidth: "18rem" } },
                { header: "Supervisor", field: "supervisor.nome", body: (row) => row.supervisor?.nome || "—", style: { minWidth: "14rem" } },
                { header: "Contrato", body: (row) => <div className="experience-person"><strong>{row.colaborador?.centro_custo || "—"}</strong><small>DPTO. {row.colaborador?.departamento || "—"}</small></div>, style: { minWidth: "16rem" } },
                { header: "Fim da experiência", body: (row) => dateLabel(row.colaborador?.data_fim_experiencia), style: { minWidth: "10rem" } },
                { header: "Situação", body: (row) => statusTag(row.status), style: { minWidth: "11rem" } },
                { header: "Ações", body: (row) => <div className="experience-row-actions"><Button label={isAdmin && row.status === "concluida" ? "Editar" : "Abrir"} icon={<AppIcon name={isAdmin && row.status === "concluida" ? "pencil" : "eye"} />} text onClick={() => openEvaluation(row.id)} />{isAdmin && row.status === "concluida" && <Button icon={<AppIcon name="trash" />} severity="danger" rounded text aria-label={`Excluir avaliação de ${row.colaborador?.nome || "colaborador"}`} onClick={() => deleteEvaluation(row)} />}</div>, style: { width: "10rem" } },
              ]}
            />
      </article>

      <OverlayPanel ref={filterPanel} className="experience-filter-panel">
        <div className="experience-filter-title"><div><strong>Filtrar avaliações</strong><span>Os indicadores e a lista acompanham este recorte.</span></div><Button icon={<AppIcon name="filter-off" />} rounded text aria-label="Limpar filtros" onClick={clearFilters} /></div>
        <StandardFilterFields department={{ value: selectedDepartments, options: departmentOptions, onChange: setSelectedDepartments }} />
        <div className="experience-filters">
          <label className="experience-search is-wide"><span>Buscar colaborador</span><span className="p-input-icon-left"><AppIcon name="search"  /><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, matrícula ou contrato" /></span></label>
          <label><span>Supervisor</span><MultiSelect value={selectedSupervisors} options={supervisors} onChange={(event) => setSelectedSupervisors(event.value || [])} placeholder="Todos os supervisores" filter showClear /></label>
          <label><span>Situação</span><MultiSelect value={selectedStatuses} options={STATUS_OPTIONS} onChange={(event) => setSelectedStatuses(event.value || [])} placeholder="Todas as situações" showClear /></label>
        </div>
      </OverlayPanel>

      <Dialog
        header="Finalizar tarefa"
        visible={manualCompletionVisible}
        modal
        className="experience-manual-completion-dialog"
        onHide={() => { setManualCompletionVisible(false); setPendingStatus(null); }}
        footer={<div className="experience-manual-completion-actions">
          <Button label="Cancelar" outlined onClick={() => { setManualCompletionVisible(false); setPendingStatus(null); }} />
          <Button label="Finalizar tarefa" icon={<AppIcon name="check" />} severity="success" onClick={confirmManualCompletion} />
        </div>}
      >
        <div className="experience-manual-completion-content">
          <span className="experience-manual-completion-icon"><AppIcon name="circle-check" aria-hidden="true"  /></span>
          <div><strong>Confirmar conclusão manual</strong><p>A tarefa será marcada como concluída e a ação ficará registrada em seu usuário. Nenhuma assinatura será criada automaticamente.</p></div>
        </div>
      </Dialog>

      <Dialog header={`Avaliação de experiência · ${selectedEvaluation?.colaborador?.nome || ""}`} visible={Boolean(selectedEvaluation)} modal className="experience-dialog" footer={evaluationFooter} onHide={() => setSelectedEvaluation(null)}>
        {selectedEvaluation && <div className="experience-form">
          <div className="experience-context">
            <div className="experience-context-contract">
              <strong>{selectedEvaluation.colaborador?.centro_custo || "Contrato não informado"}</strong>
              <div className="experience-context-meta"><span>DPTO. {selectedEvaluation.colaborador?.departamento || "—"}</span><span>{selectedEvaluation.supervisor?.nome || "Supervisor não informado"}</span>{statusTag(selectedEvaluation.status)}</div>
            </div>
          </div>
          <div className="experience-dates"><span>Admissão <strong>{dateLabel(selectedEvaluation.colaborador?.data_admissao)}</strong></span><span>Fim da experiência <strong>{dateLabel(selectedEvaluation.colaborador?.data_fim_experiencia)}</strong></span><span>Prazo do supervisor <strong>{dateLabel(selectedEvaluation.prazo_supervisor_em, true)}</strong></span></div>

          <section className="experience-history">
            <h2>Histórico do colaborador no RH</h2>
            <div><span>Advertências<strong>{selectedEvaluation.historico_rh?.advertencias || 0}</strong></span><span>Suspensões<strong>{selectedEvaluation.historico_rh?.suspensoes || 0}</strong></span><span>Ausências<strong>{selectedEvaluation.historico_rh?.ausencias?.total || 0}</strong></span></div>
            <small>Por tipo: {Object.entries(selectedEvaluation.historico_rh?.ausencias?.por_tipo || {}).map(([key, value]) => `${key}: ${value}`).join(" · ") || "Nenhuma"}</small>
          </section>

          <section className="experience-section">
            <h2>Avaliação do supervisor</h2>
            <div className="experience-competencies">
              {COMPETENCIES.map((item) => <label key={item.key}><span>{item.label}</span><Dropdown value={form.competencias[item.key] || null} options={RATING_OPTIONS} disabled={!adminCanEdit} showClear={adminCanEdit} onChange={(event) => setForm((current) => ({ ...current, competencias: { ...current.competencias, [item.key]: event.value } }))} placeholder="Selecione" /></label>)}
            </div>
            <div className="experience-fields">
              <label className="is-wide"><span>Observações do supervisor</span><InputTextarea value={form.observacoes_supervisor} disabled={!adminCanEdit} rows={4} autoResize onChange={(event) => setForm((current) => ({ ...current, observacoes_supervisor: event.target.value }))} /></label>
            </div>
          </section>

          <section className="experience-section">
            <h2>Tratativa do RH</h2>
            <div className="experience-fields">
              <label><span>Classificação do perfil</span><Dropdown value={form.classificacao_perfil} options={PROFILE_OPTIONS} disabled={!rhCanEdit} showClear={rhCanEdit} onChange={(event) => updateRhForm({ classificacao_perfil: event.value })} placeholder="Selecione" /></label>
              <label><span>Decisão do RH</span><Dropdown value={form.decisao_supervisor} options={DECISION_OPTIONS} disabled={!rhCanEdit} showClear={rhCanEdit} onChange={(event) => updateRhForm({ decisao_supervisor: event.value })} placeholder="Selecione" /></label>
              <label className="is-wide"><span>Observações do RH</span><InputTextarea value={form.observacoes_rh} disabled={!rhCanEdit} rows={4} autoResize onChange={(event) => updateRhForm({ observacoes_rh: event.target.value })} /></label>
            </div>
            {(isAdmin || (canCompleteRh && rhReady)) && <div className="experience-signature-action">
              {isAdmin && <label className="experience-state-select"><span>Estado da tarefa</span><Dropdown value={selectedEvaluation.status} options={statusOptions} onChange={(event) => requestTaskStatusChange(event.value)} /></label>}
              {canCompleteRh && rhReady && <>
                {isAdmin && <label className="experience-signer-select"><span>Assinatura cadastrada</span><Dropdown value={selectedSignerId} options={registeredSigners} optionLabel="nome" optionValue="id" onChange={(event) => setSelectedSignerId(event.value)} placeholder="Escolha uma assinatura" filter showClear /></label>}
                <Button label={selectedEvaluation.assinatura_rh_registrada ? "Aplicar novamente" : isAdmin ? "Aplicar assinatura" : "Usar minha assinatura"} icon={<AppIcon name="verified" />} outlined disabled={isAdmin && !selectedSignerId} onClick={useRegisteredRhSignature} />
              </>}
            </div>}
            {canRh && isAwaitingRh && !rhReady && <small className="experience-signature-hint">Preencha a classificação e a decisão para liberar a assinatura.</small>}
          </section>

        </div>}
      </Dialog>
    </section>
  );
}
