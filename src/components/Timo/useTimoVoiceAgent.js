// React
import { useCallback, useEffect, useMemo, useState } from "react";

// Utilitários
import { socketio } from "../../utils/socketio";
import connect from "../../utils/request";

// Seleciona a preferência do usuário antes do agente marcado como padrão.
function preferredAgent(agents, preferences) {
  return agents.find((agent) => agent.id === preferences?.agente_preferido_id)
    || agents.find((agent) => agent.preferido)
    || null;
}

export function useTimoVoiceAgent({ onResponse } = {}) {
  const [agents, setAgents] = useState([]);
  const [preferences, setPreferences] = useState({ habilitado: false });
  const [loading, setLoading] = useState(true);

  // Carrega agentes pareados e suas preferências em uma única requisição.
  const refresh = useCallback(async () => {
    const { data } = await connect.get("/timo/agentes");
    const nextAgents = data?.agentes || [];
    const nextPreferences = data?.preferencias || { habilitado: false };
    setAgents(nextAgents);
    setPreferences(nextPreferences);
    return { agents: nextAgents, preferences: nextPreferences };
  }, []);

  // Escuta o status e as respostas do agente enquanto o hook estiver montado.
  useEffect(() => {
    let alive = true;
    refresh().catch(() => {
      if (alive) {
        setAgents([]);
      }
    }).finally(() => {
      if (alive) {
        setLoading(false);
      }
    });

    const updateStatus = (payload) => {
      if (!payload?.id) return;
      setAgents((current) => current.map((agent) => (
        agent.id === payload.id ? { ...agent, ...payload } : agent
      )));
    };
    const receiveResponse = (payload) => onResponse?.(payload);

    socketio.on("timo_agent_status", updateStatus);
    socketio.on("timo_agent_response", receiveResponse);

    return () => {
      alive = false;
      socketio.off("timo_agent_status", updateStatus);
      socketio.off("timo_agent_response", receiveResponse);
    };
  }, [onResponse, refresh]);

  const agent = useMemo(
    () => preferredAgent(agents, preferences),
    [agents, preferences]
  );

  // Solicita um código temporário para parear outro computador.
  const createPairing = useCallback(async () => {
    const { data } = await connect.post("/timo/agentes/pareamentos");
    return data;
  }, []);

  // Ativa ou pausa o agente e sincroniza a preferência devolvida pela API.
  const control = useCallback(async (agentId, enabled) => {
    const { data } = await connect.patch(`/timo/agentes/${agentId}/controle`, {
      habilitado: enabled,
    });
    setPreferences((current) => ({
      ...current,
      habilitado: Boolean(data?.habilitado),
      agente_preferido_id: data?.agente?.id || current.agente_preferido_id,
    }));
    setAgents((current) => current.map((item) => (
      item.id === agentId ? { ...item, ...data?.agente } : item
    )));
    return data;
  }, []);

  // Marca o agente preferido que receberá os próximos comandos de voz.
  const select = useCallback(async (agentId) => {
    const { data } = await connect.patch(`/timo/agentes/${agentId}/selecionar`);
    setPreferences((current) => ({ ...current, agente_preferido_id: agentId }));
    setAgents((current) => current.map((item) => ({
      ...item,
      preferido: item.id === agentId,
    })));
    return data;
  }, []);

  // Revoga a credencial do computador e atualiza a lista local.
  const revoke = useCallback(async (agentId) => {
    await connect.delete(`/timo/agentes/${agentId}`);
    setAgents((current) => current.filter((item) => item.id !== agentId));
    setPreferences((current) => current.agente_preferido_id === agentId
      ? { ...current, agente_preferido_id: null, habilitado: false }
      : current);
  }, []);

  return {
    agents,
    agent,
    preferences,
    loading,
    refresh,
    createPairing,
    control,
    select,
    revoke,
  };
}
