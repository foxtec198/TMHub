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

export function RpaAgents() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [execution, setExecution] = useState(null);

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
    const refresh = () => load();
    const progress = (event) => {
      if (event?.capability !== "pontomais_report_import") return;
      setExecution((current) => current?.commandId === event.command_id ? { ...current, progress: event.progress, step: event.step, status: event.status } : current);
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
    <PageHeader section="RPA Center" title={category ? `Agentes · ${category}` : "Agentes"} description="Agentes locais disponíveis para automações do TMHub." />
    {loading ? <div className="rpa-agents-loading">Carregando agentes…</div> : Object.entries(groups).map(([category, items]) => <section className="rpa-agent-group" key={category}>
      <header><span>{category}</span><h2>{items.length} agente(s)</h2></header>
      <div className="rpa-agent-grid">{items.map((agent) => {
        const status = state(agent);
        const isPontoMais = agent.capability === "pontomais_report_import";
        const running = isPontoMais && execution?.status === "running";
        const progress = isPontoMais ? execution : null;
        return <article className={`rpa-agent-card ${agent.active ? "" : "is-inactive"}`} key={agent.key}>
          <div className="rpa-agent-card__head"><span className="rpa-agent-icon"><AppIcon name={isPontoMais ? "cloud-upload" : "device-desktop"} /></span><Tag value={status.label} severity={status.severity} /></div>
          <div><h3>{agent.name}</h3><p>{agent.description}</p></div>
          {isPontoMais && progress && <div className={`rpa-agent-progress is-${progress.status}`} aria-live="polite"><div className="rpa-agent-progress__meta"><span>{progress.step}</span><strong>{progress.progress}%</strong></div><div className="rpa-agent-progress__track"><i style={{ width: `${progress.progress}%` }} /></div></div>}
          <div className="rpa-agent-card__footer">{agent.machines?.length > 0 && <small>{agent.machines.length} máquina(s) conectada(s)</small>}{isPontoMais ? <Button label={running ? "Executando…" : "Executar Jornadas"} icon={<AppIcon name="play" />} loading={running} disabled={!agent.available || running} onClick={runJornadas} /> : <Button label="Indisponível" icon={<AppIcon name="lock" />} disabled />}</div>
        </article>;
      })}</div>
    </section>)}
  </section>;
}
