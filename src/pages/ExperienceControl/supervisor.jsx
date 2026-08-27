import { AppIcon } from "../../components/icons/AppIcon";
// Tela autenticada das avaliações de experiência para supervisores.
import { useEffect, useRef, useState } from "react";

import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Stepper } from "primereact/stepper";
import { StepperPanel } from "primereact/stepperpanel";
import { Tag } from "primereact/tag";

import { ThemeLogo } from "../../components/ThemeLogo";
import { Table } from "../../components/tables/Table";
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

export function ExperienceSupervisor() {
  // A lista é limitada pela sessão e pela filial global selecionada.
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
    // A lista é carregada uma única vez dentro do escopo autenticado.
    async function loadSupervisors() {
      try {
        const { data } = await connect.get("/avaliacoes-experiencia/supervisores");
        setSupervisors((Array.isArray(data) ? data : []).map((item) => ({ label: item.nome, value: item.id })));
      } catch (error) {
        showToast("error", "Período de experiência", errorMessage(error, "Não foi possível carregar os supervisores."));
      }
    }
    loadSupervisors();
  }, [showToast]);

  const loadTasks = async () => {
    // A API limita as pendências ao supervisor e à filial da sessão.
    if (!supervisor) {
      showToast("warn", "Identificação", "Selecione seu nome para continuar.");
      return false;
    }
    setLoadingTasks(true);
    try {
      const { data } = await connect.get("/avaliacoes-experiencia/tarefas-supervisor", {
        params: { supervisor_id: supervisor },
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
    setLoading(true);
    try {
      const { data } = await connect.get(`/avaliacoes-experiencia/${evaluationId}`);
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
      const { data } = await connect[complete ? "post" : "patch"](
        complete
          ? `/avaliacoes-experiencia/${evaluation.id}/supervisor/concluir`
          : `/avaliacoes-experiencia/${evaluation.id}/supervisor`,
        {
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
      const { data: savedEvaluation } = await connect.patch(
        `/avaliacoes-experiencia/${evaluation.id}/supervisor`, form,
      );
      const payload = new FormData();
      payload.append("arquivo", file);
      const { data } = await connect.post(
        `/avaliacoes-experiencia/${savedEvaluation.id}/supervisor/assinatura`,
        payload,
      );
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
      <Button label="Salvar rascunho" icon={<AppIcon name="device-floppy" />} outlined onClick={() => saveEvaluation(false)} />
      <Button label="Assinar e enviar ao RH" icon={<AppIcon name="check" />} disabled={!supervisorReady || !evaluation.assinatura_supervisor_registrada} onClick={() => saveEvaluation(true)} />
    </div>
  );

  const taskColumns = [
    {
      header: "Colaborador",
      body: (row) => <div className="experience-public-person"><strong>{row.colaborador?.nome}</strong><small>Matrícula {row.colaborador?.matricula || "—"}</small></div>,
      style: { minWidth: "18rem" },
    },
    {
      header: "Contrato",
      body: (row) => <div className="experience-public-person"><strong>{row.colaborador?.centro_custo || "—"}</strong><small>DPTO. {row.colaborador?.departamento || "—"}</small></div>,
      style: { minWidth: "16rem" },
    },
    {
      header: "Fim da experiência",
      body: (row) => dateLabel(row.colaborador?.data_fim_experiencia),
      style: { minWidth: "10rem" },
    },
    {
      header: "Prazo",
      body: (row) => <time className="experience-public-table-date" dateTime={row.prazo_supervisor_em || undefined}>{dateLabel(row.prazo_supervisor_em, true)}</time>,
      style: { minWidth: "12rem" },
    },
    {
      header: "Situação",
      body: (row) => <Tag value={STATUS[row.status]?.label || row.status} severity={STATUS[row.status]?.severity || "secondary"} />,
      style: { minWidth: "10rem" },
    },
    {
      header: "Ação",
      body: (row) => <Button label="Avaliar" icon={<AppIcon name="file-pencil" />} text onClick={() => openEvaluation(row.id)} />,
      style: { minWidth: "8rem" },
    },
  ];

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
                icon={<AppIcon name="arrow-right" />}
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
                <Button label="Trocar nome" icon={<AppIcon name="user-edit" />} text onClick={() => stepperRef.current?.prevCallback?.()} />
              </div>
              <Table data={tasks} columns={taskColumns} loading={loadingTasks} rows={8} rowsPerPageOptions={[8, 16, 32]} tableClassName="experience-public-tasks-table" tableStyle={{ minWidth: "50rem" }} />
            </div>
          </StepperPanel>
        </Stepper>
      </section>

      <Dialog header={`Avaliação de experiência · ${evaluation?.colaborador?.nome || ""}`} visible={Boolean(evaluation)} modal className="experience-public-dialog" footer={footer} onHide={() => setEvaluation(null)}>
        {evaluation && <div className="experience-public-form">
          <div className="experience-public-context">
            <strong>{evaluation.colaborador?.centro_custo || "Contrato não informado"}</strong>
            <div className="experience-public-context-details">
              <span>Admissão: {dateLabel(evaluation.colaborador?.data_admissao)}</span>
              <span>Fim da experiência: {dateLabel(evaluation.colaborador?.data_fim_experiencia)}</span>
            </div>
          </div>
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
