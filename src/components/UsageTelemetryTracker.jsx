import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import connect from "../utils/request";

const HEARTBEAT_MS = 60_000;
const MAX_ACTIVITY_SECONDS = 90;

function postActivity(payload) {
  // Telemetria é complementar: uma indisponibilidade não deve gerar toast,
  // reprocessar tela ou impedir o uso do módulo que o usuário abriu.
  connect.post("/uso/atividade", payload).catch(() => undefined);
}

export function UsageTelemetryTracker() {
  const location = useLocation();
  const lastActivityAt = useRef(Date.now());

  useEffect(() => {
    postActivity({ tipo: "pagina_visitada", rota: location.pathname });
    lastActivityAt.current = Date.now();
  }, [location.pathname]);

  useEffect(() => {
    const registerActiveTime = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;

      const now = Date.now();
      const seconds = Math.min(
        MAX_ACTIVITY_SECONDS,
        Math.max(0, Math.round((now - lastActivityAt.current) / 1000)),
      );
      lastActivityAt.current = now;
      if (!seconds) return;

      postActivity({
        tipo: "atividade",
        rota: location.pathname,
        segundos_ativos: seconds,
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") registerActiveTime();
      else lastActivityAt.current = Date.now();
    };
    const onFocus = () => { lastActivityAt.current = Date.now(); };

    const interval = window.setInterval(registerActiveTime, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [location.pathname]);

  return null;
}
