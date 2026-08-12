import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { socketio } from "../../utils/socketio";

/*
 * O avatar existe apenas no Timo Voice Agent do Windows. Este componente não
 * renderiza UI: ele mantém a ponte global que recebe ações pelo Socket.IO e
 * navega o TMHub aberto, independente da página atual.
 */
export function TimoAgentNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAgentResponse = (payload) => {
      if (payload?.action?.type === "navigate" && payload.action.path) {
        navigate(payload.action.path);
      }
    };

    socketio.on("timo_agent_response", handleAgentResponse);

    return () => {
      socketio.off("timo_agent_response", handleAgentResponse);
    };
  }, [navigate]);

  return null;
}
