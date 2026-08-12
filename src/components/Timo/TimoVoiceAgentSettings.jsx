import { useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";

import { useToast } from "../../contexts/ToastContext";
import { useTimoVoiceAgent } from "./useTimoVoiceAgent";
import "./TimoVoiceAgentSettings.css";

const RELEASE_URL = "https://github.com/foxtec198/timo_voice_recognizer/releases/latest";

const AGENT_STATE_LABELS = {
  aguardando_wake_word: "Ouvindo",
  aguardando_comando: "Pode falar",
  processando: "Processando…",
  desativado: "Pausado",
  desconectado: "Reconectando…",
  erro_conexao: "Sem conexão",
};

function errorMessage(error, fallback) {
  return error.response?.data?.message || error.response?.data || fallback;
}

export function TimoVoiceAgentSettings() {
  const { showToast } = useToast();
  const {
    agents,
    agent,
    preferences,
    loading,
    createPairing,
    control,
    select,
    revoke,
  } = useTimoVoiceAgent();
  const [pairing, setPairing] = useState(null);
  const [busyAgentId, setBusyAgentId] = useState(null);
  const [creatingPairing, setCreatingPairing] = useState(false);

  const generatePairing = async () => {
    setCreatingPairing(true);
    try {
      setPairing(await createPairing());
    } catch (error) {
      showToast("error", "Voice Agent", errorMessage(error, "Não foi possível gerar o código de pareamento."));
    } finally {
      setCreatingPairing(false);
    }
  };

  const copyPairing = async () => {
    try {
      await navigator.clipboard.writeText(pairing.codigo);
      showToast("success", "Voice Agent", "Código copiado.");
    } catch {
      showToast("warning", "Voice Agent", "Copie o código manualmente.");
    }
  };

  const toggle = async (item) => {
    setBusyAgentId(item.id);
    try {
      await control(item.id, !(item.id === agent?.id && preferences?.habilitado));
      showToast("success", "Voice Agent", "Estado do agente atualizado.");
    } catch (error) {
      showToast("error", "Voice Agent", errorMessage(error, "Não foi possível atualizar o agente."));
    } finally {
      setBusyAgentId(null);
    }
  };

  const choose = async (item) => {
    setBusyAgentId(item.id);
    try {
      await select(item.id);
      showToast("success", "Voice Agent", "Agente preferido atualizado.");
    } catch (error) {
      showToast("error", "Voice Agent", errorMessage(error, "Não foi possível selecionar o agente."));
    } finally {
      setBusyAgentId(null);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Revogar o acesso do agente “${item.nome}”?`)) return;
    setBusyAgentId(item.id);
    try {
      await revoke(item.id);
      showToast("success", "Voice Agent", "Agente revogado. A credencial deste computador não poderá mais ser usada.");
    } catch (error) {
      showToast("error", "Voice Agent", errorMessage(error, "Não foi possível revogar o agente."));
    } finally {
      setBusyAgentId(null);
    }
  };

  return (
    <section className="timo-agent-settings">
      <div className="timo-agent-settings__header">
        <div>
          <h3>Voice Agent local</h3>
          <p>O computador reconhece a voz localmente com Whisper e envia somente o texto do comando ao TMHub.</p>
        </div>
        <div className="timo-agent-settings__actions">
          <Button label="Baixar agente" icon="pi pi-download" outlined onClick={() => window.open(RELEASE_URL, "_blank", "noopener,noreferrer")} />
          <Button label="Gerar pareamento" icon="pi pi-link" loading={creatingPairing} onClick={generatePairing} />
        </div>
      </div>

      <div className="timo-agent-settings__note">
        <i className="pi pi-shield" aria-hidden="true" />
        <span>O código é temporário, de uso único e não expõe a senha, sessão ou token principal do usuário.</span>
      </div>

      <div className="timo-agent-settings__list">
        {loading ? <span>Carregando agentes…</span> : null}
        {!loading && !agents.length ? <span>Nenhum computador pareado ainda.</span> : null}
        {agents.map((item) => {
          const preferred = item.id === agent?.id;
          const active = preferred && preferences?.habilitado;
          return (
            <article className="timo-agent-card" key={item.id}>
              <div>
                <strong>{item.nome}</strong>
                <small>{item.dispositivo_id}</small>
                <span className={`timo-agent-card__status ${item.online ? "is-online" : ""}`}>
                  <i className="pi pi-circle-fill" aria-hidden="true" />
                  {item.online
                    ? (AGENT_STATE_LABELS[item.estado] || item.estado || "Online")
                    : "Offline"}
                </span>
              </div>
              <div className="timo-agent-card__actions">
                {!preferred ? <Button label="Usar" text onClick={() => choose(item)} loading={busyAgentId === item.id} /> : null}
                <Button label={active ? "Parar" : "Iniciar"} icon={active ? "pi pi-pause" : "pi pi-play"} outlined onClick={() => toggle(item)} loading={busyAgentId === item.id} />
                <Button icon="pi pi-trash" severity="danger" text rounded aria-label="Revogar agente" onClick={() => remove(item)} disabled={busyAgentId === item.id} />
              </div>
            </article>
          );
        })}
      </div>

      <Dialog header="Parear Timo Voice Agent" visible={Boolean(pairing)} modal className="timo-agent-pairing-dialog" onHide={() => setPairing(null)}>
        <p>Abra o Timo Voice Agent neste computador e cole este código. Ele expira em 10 minutos e só pode ser utilizado uma vez.</p>
        <code className="timo-agent-pairing-code">{pairing?.codigo}</code>
        <div className="dialog-actions">
          <Button label="Copiar código" icon="pi pi-copy" onClick={copyPairing} />
          <Button label="Fechar" text onClick={() => setPairing(null)} />
        </div>
      </Dialog>
    </section>
  );
}
