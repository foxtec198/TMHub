// Controle de período de experiência.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";

import { PageHeader } from "../../components/PageHeader";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { can } from "../../utils/permissions";
import connect from "../../utils/request";
import { SignaturePad } from "./SignaturePad";
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
  ["aberta", "em_preenchimento", "atrasada", "aguardando_rh"].includes(value)
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
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [rhRecords, setRhRecords] = useState([]);
  const [employeesInExperience, setEmployeesInExperience] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [form, setForm] = useState(formFromEvaluation(null));
  const [exporting, setExporting] = useState(false);
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
      const [evaluationsResponse, employeesResponse] = await Promise.all([
        connect.get("/avaliacoes-experiencia"),
        connect.get("/avaliacoes-experiencia/em-experiencia"),
      ]);
      setRhRecords(Array.isArray(evaluationsResponse.data) ? evaluationsResponse.data : []);
      setEmployeesInExperience(Array.isArray(employeesResponse.data) ? employeesResponse.data : []);
    } catch (error) {
      showToast("error", "Período de experiência", errorMessage(error, "Não foi possível carregar o controle do RH."));
    }
  }, [canRh, showToast]);

  useEffect(() => { loadSupervisors(); }, [loadSupervisors, revision]);
  useEffect(() => { loadRh(); }, [loadRh, revision]);

  const openEvaluation = async (evaluationId) => {
    // O detalhe contém o formulário completo e o histórico consolidado do RH.
    setLoading(true);
    try {
      const { data } = await connect.get(`/avaliacoes-experiencia/${evaluationId}`);
      setSelectedEvaluation(data);
      setForm(formFromEvaluation(data));
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
    setSelectedSupervisor(null);
    setSelectedStatus(null);
    setSearch("");
  };

  const changeTaskStatus = async () => {
    if (!selectedEvaluation || !isAdmin || form.status === selectedEvaluation.status) return;
    setLoading(true);
    try {
      const { data } = await connect.patch(
        `/avaliacoes-experiencia/${selectedEvaluation.id}/estado`,
        { status: form.status },
      );
      refreshAfterMutation(data);
      showToast("success", "Estado da tarefa", "O estado da avaliação foi atualizado.");
    } catch (error) {
      showToast("error", "Estado da tarefa", errorMessage(error, "Não foi possível alterar o estado da avaliação."));
    } finally {
      setLoading(false);
    }
  };

  const filteredRhRecords = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return rhRecords.filter((item) => {
      const matchesSupervisor = !selectedSupervisor || item.supervisor?.id === selectedSupervisor;
      const matchesStatus = !selectedStatus || item.status === selectedStatus;
      const matchesSearch = !term || [
      item.colaborador?.nome,
      item.colaborador?.matricula,
      item.colaborador?.centro_custo,
      item.supervisor?.nome,
      item.status,
      ].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term));
      return matchesSupervisor && matchesStatus && matchesSearch;
    });
  }, [rhRecords, search, selectedStatus, selectedSupervisor]);

  const activeFilterCount = Number(Boolean(selectedSupervisor))
    + Number(Boolean(selectedStatus))
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
  const canCompleteRh = canRh && selectedEvaluation?.status === "aguardando_rh";
  const canChangeStatus = isAdmin && Boolean(selectedEvaluation);
  const rhReady = PROFILE_OPTIONS.some((option) => option.value === form.classificacao_perfil)
    && DECISION_OPTIONS.some((option) => option.value === form.decisao_supervisor);
  const updateRhForm = (change) => {
    // A API invalida a assinatura após salvar qualquer alteração real do RH.
    setForm((current) => ({ ...current, ...change }));
  };

  const uploadRhSignature = async (file) => {
    if (!selectedEvaluation) return;
    setLoading(true);
    try {
      // Salva primeiro os campos do RH, exatamente como a etapa do supervisor.
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
      const payload = new FormData();
      payload.append("arquivo", file);
      const { data } = await connect.post(
        `/avaliacoes-experiencia/${savedEvaluation.id}/rh/assinatura`,
        payload,
      );
      refreshAfterMutation(data);
      showToast("success", "Assinatura", "Assinatura do RH registrada com sucesso.");
    } catch (error) {
      showToast("error", "Assinatura", errorMessage(error, "Não foi possível salvar a assinatura."));
    } finally {
      setLoading(false);
    }
  };
  const statusOptions = useMemo(() => {
    const current = STATUS_OPTIONS.find((item) => item.value === selectedEvaluation?.status);
    return current && !ADMIN_STATUS_OPTIONS.some((item) => item.value === current.value)
      ? [current, ...ADMIN_STATUS_OPTIONS]
      : ADMIN_STATUS_OPTIONS;
  }, [selectedEvaluation?.status]);

  const evaluationFooter = selectedEvaluation && (
    <div className="experience-dialog-actions">
      {canRh && selectedEvaluation.status === "concluida" && (
        <Button label="Exportar PDF" icon="pi pi-file-pdf" outlined loading={exporting} onClick={exportPdf} />
      )}
      {rhCanEdit && <>
        <Button label={adminCanEdit ? "Salvar alterações" : "Salvar rascunho"} icon="pi pi-save" outlined onClick={() => saveRh(false)} />
        {canCompleteRh && <Button label="Assinar e concluir" icon="pi pi-check" disabled={!rhReady || !selectedEvaluation.assinatura_rh_registrada} onClick={() => saveRh(true)} />}
      </>}
      {canChangeStatus && form.status !== selectedEvaluation.status && (
        <Button label="Alterar estado" icon="pi pi-sync" severity="warning" outlined onClick={changeTaskStatus} />
      )}
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
          <Button icon="pi pi-filter-fill" label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"} onClick={(event) => filterPanel.current?.toggle(event)} />
          <Button label="Tela do supervisor" icon="pi pi-external-link" outlined onClick={openSupervisorPage} />
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
            <DataTable value={filteredRhRecords} paginator rows={10} rowsPerPageOptions={[10, 25, 50, 100]} stripedRows size="small" dataKey="id" emptyMessage="Nenhuma avaliação encontrada." tableStyle={{ minWidth: "68rem" }}>
              <Column header="Colaborador" body={personBody} style={{ minWidth: "18rem" }} />
              <Column header="Supervisor" field="supervisor.nome" body={(row) => row.supervisor?.nome || "—"} style={{ minWidth: "14rem" }} />
              <Column header="Contrato" body={(row) => <div className="experience-person"><strong>{row.colaborador?.centro_custo || "—"}</strong><small>DPTO. {row.colaborador?.departamento || "—"}</small></div>} style={{ minWidth: "16rem" }} />
              <Column header="Fim da experiência" body={(row) => dateLabel(row.colaborador?.data_fim_experiencia)} style={{ minWidth: "10rem" }} />
              <Column header="Situação" body={(row) => statusTag(row.status)} style={{ minWidth: "11rem" }} />
              <Column header="Ações" body={(row) => <div className="experience-row-actions"><Button label={isAdmin && row.status === "concluida" ? "Editar" : "Abrir"} icon={isAdmin && row.status === "concluida" ? "pi pi-pencil" : "pi pi-eye"} text onClick={() => openEvaluation(row.id)} />{isAdmin && row.status === "concluida" && <Button icon="pi pi-trash" severity="danger" rounded text aria-label={`Excluir avaliação de ${row.colaborador?.nome || "colaborador"}`} onClick={() => deleteEvaluation(row)} />}</div>} style={{ width: "10rem" }} />
            </DataTable>
      </article>

      <OverlayPanel ref={filterPanel} className="experience-filter-panel">
        <div className="experience-filter-title"><div><strong>Filtrar avaliações</strong><span>Os indicadores e a lista acompanham este recorte.</span></div><Button icon="pi pi-filter-slash" rounded text aria-label="Limpar filtros" onClick={clearFilters} /></div>
        <div className="experience-filters">
          <label className="experience-search is-wide"><span>Buscar colaborador</span><span className="p-input-icon-left"><i className="pi pi-search" /><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, matrícula ou contrato" /></span></label>
          <label><span>Supervisor</span><Dropdown value={selectedSupervisor} options={supervisors} onChange={(event) => setSelectedSupervisor(event.value)} placeholder="Todos os supervisores" filter showClear /></label>
          <label><span>Situação</span><Dropdown value={selectedStatus} options={STATUS_OPTIONS} onChange={(event) => setSelectedStatus(event.value)} placeholder="Todas as situações" showClear /></label>
        </div>
      </OverlayPanel>

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
            {canCompleteRh && rhReady && <SignaturePad label="Assinatura do avaliador - RH" signed={selectedEvaluation.assinatura_rh_registrada} onSave={uploadRhSignature} />}
            {canCompleteRh && !rhReady && <small className="experience-signature-hint">Preencha a classificação e a decisão para liberar a assinatura.</small>}
          </section>

          {canChangeStatus && <section className="experience-section experience-state-section">
            <h2>Estado da tarefa</h2>
            <p>Somente administradores podem devolver uma tarefa para uma etapa anterior.</p>
            <label><span>Novo estado</span><Dropdown value={form.status} options={statusOptions} onChange={(event) => setForm((current) => ({ ...current, status: event.value }))} placeholder="Selecione o estado" /></label>
          </section>}
        </div>}
      </Dialog>
    </section>
  );
}
