import { useCallback, useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { useSearchParams } from "react-router-dom";

import { AppIcon } from "../../components/icons/AppIcon";
import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import "./styles.css";

function errorMessage(error, fallback) {
  const payload = error.response?.data;
  return typeof payload === "string" ? payload : payload?.message || fallback;
}

function state(agent) {
  if (!agent.active) return { label: "Inativo", severity: "secondary" };
  return agent.online ? { label: "Online", severity: "success" } : { label: "Offline", severity: "warning" };
}

function automationDetails(agent) {
  if (agent.capability === "pontomais_report_import") {
    return {
      icon: "file-spreadsheet",
      type: "Automação web",
      note: "Acessa o Ponto Mais, baixa o relatório do dia e envia o XLSX para o controle.",
    };
  }
  return {
    icon: "device-desktop",
    type: "Agente legado",
    note: "Mantido para uso técnico. Requer tela, foco e imagens compatíveis na máquina local.",
  };
}

export function RpaAgents() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [execution, setExecution] = useState(null);
  const [displayProgress, setDisplayProgress] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await connect.get("/rpa/agentes");
      setAgents(data?.agentes || []);
    } catch (error) {
      showToast("error", "Agentes RPA", errorMessage(error, "Não foi possível consultar os agentes."));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!execution?.commandId) setDisplayProgress(0);
  }, [execution?.commandId]);

  useEffect(() => {
    if (!execution) {
      setDisplayProgress(0);
      return undefined;
    }

    const target = Math.max(0, Math.min(100, Number(execution.progress) || 0));
    if (execution.status === "failed") {
      setDisplayProgress(0);
      return undefined;
    }

    if (displayProgress === target) return undefined;
    const timer = window.setTimeout(() => setDisplayProgress((current) => current < target ? current + 1 : current - 1), 350);
    return () => window.clearTimeout(timer);
  }, [execution?.progress, execution?.status, execution?.commandId, displayProgress]);

  useEffect(() => {
    const refresh = () => load();
    const progress = (event) => {
      if (event?.capability !== "pontomais_report_import") return;
      const completed = event.status === "completed" || Number(event.progress) >= 100;
      if (completed) setDisplayProgress(100);
      setExecution((current) => {
        if (current?.commandId !== event.command_id || current.status === "completed") return current;
        return {
          ...current,
          progress: completed ? 100 : Math.max(Number(current.progress) || 0, Number(event.progress) || 0),
          step: event.step || current.step,
          status: completed ? "completed" : (event.status || current.status),
        };
      });
    };
    socketio.on("rpa_agents_update", refresh);
    socketio.on("rpa_progress", progress);
    return () => {
      socketio.off("rpa_agents_update", refresh);
      socketio.off("rpa_progress", progress);
    };
  }, [load]);

  const runJornadas = async () => {
    try {
      setExecution({ progress: 2, step: "Enviando comando ao agente", status: "running" });
      const { data } = await connect.post("/jornadas/automatizar", {});
      setExecution({ commandId: data.command_id, progress: 5, step: "Agente recebeu a solicitação", status: "running" });
    } catch (error) {
      const message = errorMessage(error, "Não foi possível iniciar a automação.");
      setExecution({ progress: 0, step: message, status: "failed" });
      showToast("error", "Ponto Mais", message);
    }
  };

  const category = searchParams.get("categoria") || "";
  const visibleAgents = category ? agents.filter((agent) => agent.category === category) : agents;
  const groups = visibleAgents.reduce((result, agent) => ({ ...result, [agent.category]: [...(result[agent.category] || []), agent] }), {});
  return <section className="rpa-agents-page">
    <PageHeader section="RPA Center" title={category ? `Automações · ${category}` : "Automações"} description="Agentes locais que executam tarefas integradas ao TMHub." />
    {loading ? <div className="rpa-agents-loading">Carregando automações…</div> : Object.entries(groups).map(([group, items]) => <section className="rpa-agent-group" key={group}>
      <header><div><span>{group}</span><h2>Automações disponíveis</h2></div><small>{items.length} disponível(is) neste departamento</small></header>
      <div className="rpa-agent-list">{items.map((agent) => {
        const status = state(agent);
        const details = automationDetails(agent);
        const isPontoMais = agent.capability === "pontomais_report_import";
        const finishing = isPontoMais && execution?.status === "completed" && displayProgress < 100;
        const running = isPontoMais && (execution?.status === "running" || finishing);
        const progress = isPontoMais ? execution : null;
        return <article className={`rpa-agent-row ${agent.active ? "" : "is-inactive"}`} key={agent.key}>
          <div className="rpa-agent-row__identity"><span className="rpa-agent-icon"><AppIcon name={details.icon} /></span><div><span>{details.type}</span><h3>{agent.name}</h3><p>{details.note}</p></div></div>
          <dl className="rpa-agent-facts"><div><dt>Status</dt><dd><Tag value={status.label} severity={status.severity} /></dd></div><div><dt>Execução</dt><dd>{agent.online ? "Pronta para uso" : "Aguardando agente"}</dd></div><div><dt>Máquinas</dt><dd>{agent.machines?.length || 0} conectada(s)</dd></div></dl>
          <div className="rpa-agent-row__action">{isPontoMais ? <Button label={running ? "Executando Jornadas…" : "Executar Jornadas"} icon={<AppIcon name="play" />} loading={running} disabled={!agent.available || running} onClick={runJornadas} /> : <Button label="Indisponível" icon={<AppIcon name="lock" />} disabled />}</div>
          {isPontoMais && progress && <div className={`rpa-agent-progress is-${progress.status}`} aria-live="polite"><div className="rpa-agent-progress__meta"><span>{progress.step}</span><strong>{displayProgress}%</strong></div><div className="rpa-agent-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={displayProgress} aria-label="Andamento da automação"><i style={{ width: `${displayProgress}%` }} /></div></div>}
        </article>;
      })}</div>
    </section>)}
  </section>;
}
