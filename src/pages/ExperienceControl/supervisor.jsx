// Tela pública das avaliações de experiência para supervisores.
import { useEffect, useRef, useState } from "react";

import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Stepper } from "primereact/stepper";
import { StepperPanel } from "primereact/stepperpanel";
import { Tag } from "primereact/tag";

import { ThemeLogo } from "../../components/ThemeLogo";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import { SignaturePad } from "./SignaturePad";
import "./supervisor.css";


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

const STATUS = {
  aberta: { label: "ABERTA", severity: "info" },
  em_preenchimento: { label: "EM PREENCHIMENTO", severity: "info" },
  atrasada: { label: "ATRASADA", severity: "danger" },
};

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
  return fallback;
}

function formFromEvaluation(evaluation) {
  return {
    competencias: evaluation?.competencias || {},
    observacoes_supervisor: evaluation?.observacoes_supervisor || "",
  };
}

export function ExperiencePublic() {
  // O supervisor se identifica pelo nome, no mesmo fluxo público de reposições.
  const [supervisors, setSupervisors] = useState([]);
  const [supervisor, setSupervisor] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [form, setForm] = useState(formFromEvaluation(null));
  const [loadingTasks, setLoadingTasks] = useState(false);
  const stepperRef = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    // A lista é carregada uma única vez para compor o primeiro passo do formulário.
    async function loadSupervisors() {
      try {
        const { data } = await connect.get("/avaliacoes-experiencia/publico/supervisores");
        setSupervisors((Array.isArray(data) ? data : []).map((item) => ({ label: item.nome, value: item.id })));
      } catch (error) {
        showToast("error", "Período de experiência", errorMessage(error, "Não foi possível carregar os supervisores."));
      }
    }
    loadSupervisors();
  }, [showToast]);

  const loadTasks = async () => {
    // A API só retorna pendências vinculadas ao supervisor informado no corpo.
    if (!supervisor) {
      showToast("warn", "Identificação", "Selecione seu nome para continuar.");
      return false;
    }
    setLoadingTasks(true);
    try {
      const { data } = await connect.post("/avaliacoes-experiencia/publico/tarefas", {
        supervisor_id: supervisor,
      });
      setTasks(Array.isArray(data) ? data : []);
      return true;
    } catch (error) {
      showToast("error", "Pendências", errorMessage(error, "Não foi possível carregar suas pendências."));
      return false;
    } finally {
      setLoadingTasks(false);
    }
  };

  const openEvaluation = async (evaluationId) => {
    // O identificador segue no corpo para não ficar exposto na URL pública.
    setLoading(true);
    try {
      const { data } = await connect.post("/avaliacoes-experiencia/publico/detalhe", {
        supervisor_id: supervisor,
        avaliacao_id: evaluationId,
      });
      setEvaluation(data);
      setForm(formFromEvaluation(data));
    } catch (error) {
      showToast("error", "Avaliação", errorMessage(error, "Não foi possível abrir a avaliação."));
    } finally {
      setLoading(false);
    }
  };

  const saveEvaluation = async (complete = false) => {
    // Salvar mantém a avaliação aberta; concluir encaminha a tarefa ao RH.
    if (!evaluation) return;
    setLoading(true);
    try {
      const { data } = await connect.post(
        complete
          ? "/avaliacoes-experiencia/publico/concluir"
          : "/avaliacoes-experiencia/publico/salvar",
        {
          supervisor_id: supervisor,
          avaliacao_id: evaluation.id,
          ...form,
        },
      );
      setEvaluation(data);
      setForm(formFromEvaluation(data));
      await loadTasks();
      showToast("success", "Avaliação", complete
        ? "Avaliação enviada para a tratativa do RH."
        : "Rascunho salvo com sucesso.");
      if (complete) setEvaluation(null);
    } catch (error) {
      showToast("error", "Avaliação", errorMessage(error, "Confira os dados antes de salvar."));
    } finally {
      setLoading(false);
    }
  };

  const changeSupervisor = (value) => {
    // Evita mostrar pendências do supervisor anterior após uma nova seleção.
    setSupervisor(value);
    setTasks([]);
    setEvaluation(null);
  };

  const supervisorReady = COMPETENCIES.every((item) => (
    RATING_OPTIONS.some((option) => option.value === form.competencias[item.key])
  ));

  const updateSupervisorForm = (change) => {
    // A API invalida uma assinatura já enviada caso o rascunho seja alterado.
    setForm((current) => ({ ...current, ...change }));
  };

  const uploadSignature = async (file) => {
    if (!evaluation) return;
    setLoading(true);
    try {
      // Persiste as respostas antes da assinatura, evitando que ela seja
      // invalidada ao enviar a avaliação ao RH.
      const { data: savedEvaluation } = await connect.post(
        "/avaliacoes-experiencia/publico/salvar",
        {
          supervisor_id: supervisor,
          avaliacao_id: evaluation.id,
          ...form,
        },
      );
      const payload = new FormData();
      payload.append("supervisor_id", supervisor);
      payload.append("avaliacao_id", savedEvaluation.id);
      payload.append("arquivo", file);
      const { data } = await connect.post("/avaliacoes-experiencia/publico/assinatura", payload);
      setEvaluation(data);
      setForm(formFromEvaluation(data));
      showToast("success", "Assinatura", "Assinatura registrada com sucesso.");
    } catch (error) {
      showToast("error", "Assinatura", errorMessage(error, "Não foi possível salvar a assinatura."));
    } finally {
      setLoading(false);
    }
  };

  const footer = evaluation && (
    <div className="experience-public-dialog-actions">
      <Button label="Salvar rascunho" icon="pi pi-save" outlined onClick={() => saveEvaluation(false)} />
      <Button label="Assinar e enviar ao RH" icon="pi pi-check" disabled={!supervisorReady || !evaluation.assinatura_supervisor_registrada} onClick={() => saveEvaluation(true)} />
    </div>
  );

  return (
    <main className="experience-public-page">
      <header className="experience-public-header">
        <ThemeLogo alt="TM Hub" className="experience-public-logo" />
        <span>Gestão de pessoas</span>
        <h1>Avaliação de período de experiência</h1>
        <p>Consulte e preencha as avaliações pendentes da sua equipe.</p>
      </header>

      <section className="experience-public-shell">
        <Stepper ref={stepperRef}>
          <StepperPanel header="Identificação">
            <div className="experience-public-identification">
              <span className="experience-public-step">Passo 1 de 2</span>
              <h2>Vamos começar</h2>
              <p>Selecione seu nome para ver as avaliações pendentes da sua equipe.</p>
              <Dropdown value={supervisor} options={supervisors} onChange={(event) => changeSupervisor(event.value)} optionLabel="label" optionValue="value" placeholder="Selecione seu nome" filter className="w-full" />
              <Button
                label="Ver pendências"
                icon="pi pi-arrow-right"
                iconPos="right"
                loading={loadingTasks}
                onClick={async () => {
                  if (await loadTasks()) stepperRef.current?.nextCallback?.();
                }}
              />
            </div>
          </StepperPanel>
          <StepperPanel header="Pendências">
            <div className="experience-public-tasks">
              <div className="experience-public-tasks-header">
                <div><strong>{supervisors.find((item) => item.value === supervisor)?.label || "Supervisor"}</strong><span>{tasks.length} avaliação(ões) pendente(s)</span></div>
                <Button label="Trocar nome" icon="pi pi-user-edit" text onClick={() => stepperRef.current?.prevCallback?.()} />
              </div>
              <DataTable className="experience-public-tasks-table" value={tasks} loading={loadingTasks} paginator rows={8} rowsPerPageOptions={[8, 16, 32]} stripedRows size="small" dataKey="id" emptyMessage="Não há avaliações pendentes para este supervisor." tableStyle={{ minWidth: "50rem" }}>
                <Column header="Colaborador" body={(row) => <div className="experience-public-person"><strong>{row.colaborador?.nome}</strong><small>Matrícula {row.colaborador?.matricula || "—"}</small></div>} style={{ minWidth: "18rem" }} />
                <Column header="Contrato" body={(row) => <div className="experience-public-person"><strong>{row.colaborador?.centro_custo || "—"}</strong><small>DPTO. {row.colaborador?.departamento || "—"}</small></div>} style={{ minWidth: "16rem" }} />
                <Column header="Fim da experiência" body={(row) => dateLabel(row.colaborador?.data_fim_experiencia)} style={{ minWidth: "10rem" }} />
                <Column header="Prazo" body={(row) => <span className={row.status === "atrasada" ? "experience-public-overdue" : ""}>{dateLabel(row.prazo_supervisor_em, true)}</span>} style={{ minWidth: "12rem" }} />
                <Column header="Situação" body={(row) => <Tag value={STATUS[row.status]?.label || row.status} severity={STATUS[row.status]?.severity || "secondary"} />} style={{ minWidth: "10rem" }} />
                <Column header="Ação" body={(row) => <Button label="Avaliar" icon="pi pi-file-edit" text onClick={() => openEvaluation(row.id)} />} style={{ width: "8rem" }} />
              </DataTable>
              <div className="experience-public-task-cards">
                {tasks.length === 0 && !loadingTasks && <div className="experience-public-empty"><i className="pi pi-check-circle" /><strong>Nenhuma pendência no momento</strong><span>Quando houver uma avaliação para preencher, ela aparecerá aqui.</span></div>}
                {tasks.map((task) => <article className="experience-public-task-card" key={task.id}>
                  <div className="experience-public-task-card-top">
                    <div className="experience-public-person"><strong>{task.colaborador?.nome || "Colaborador não informado"}</strong><small>Matrícula {task.colaborador?.matricula || "—"}</small></div>
                    <Tag value={STATUS[task.status]?.label || task.status} severity={STATUS[task.status]?.severity || "secondary"} />
                  </div>
                  <dl className="experience-public-task-details">
                    <div><dt>Contrato</dt><dd>{task.colaborador?.centro_custo || "—"}</dd></div>
                    <div><dt>Fim da experiência</dt><dd>{dateLabel(task.colaborador?.data_fim_experiencia)}</dd></div>
                    <div><dt>Prazo para preencher</dt><dd className={task.status === "atrasada" ? "experience-public-overdue" : ""}>{dateLabel(task.prazo_supervisor_em, true)}</dd></div>
                  </dl>
                  <Button label="Avaliar colaborador" icon="pi pi-file-edit" iconPos="right" onClick={() => openEvaluation(task.id)} />
                </article>)}
              </div>
            </div>
          </StepperPanel>
        </Stepper>
      </section>

      <Dialog header={`Avaliação de experiência · ${evaluation?.colaborador?.nome || ""}`} visible={Boolean(evaluation)} modal className="experience-public-dialog" footer={footer} onHide={() => setEvaluation(null)}>
        {evaluation && <div className="experience-public-form">
          <div className="experience-public-context"><strong>{evaluation.colaborador?.centro_custo || "Contrato não informado"}</strong><span>Admissão: {dateLabel(evaluation.colaborador?.data_admissao)} · Fim da experiência: {dateLabel(evaluation.colaborador?.data_fim_experiencia)}</span></div>
          <div className="experience-public-competencies">
            {COMPETENCIES.map((item) => <label key={item.key}><span>{item.label}</span><Dropdown value={form.competencias[item.key] || null} options={RATING_OPTIONS} onChange={(event) => updateSupervisorForm({ competencias: { ...form.competencias, [item.key]: event.value } })} placeholder="Selecione" /></label>)}
          </div>
          <div className="experience-public-fields">
            <label className="is-wide"><span>Observações</span><InputTextarea value={form.observacoes_supervisor} rows={4} autoResize onChange={(event) => updateSupervisorForm({ observacoes_supervisor: event.target.value })} /></label>
          </div>
          {supervisorReady && <SignaturePad label="Assinatura do avaliador - operação" signed={evaluation.assinatura_supervisor_registrada} onSave={uploadSignature} />}
          {!supervisorReady && <small className="experience-public-signature-hint">Preencha as cinco competências para liberar a assinatura.</small>}
        </div>}
      </Dialog>
    </main>
  );
}
