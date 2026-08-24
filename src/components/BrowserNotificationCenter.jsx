import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { socketio } from "../utils/socketio";

const NOTIFICATION_ICON = "/brands/main_fav.png";
const DEDUPE_WINDOW_MS = 1_500;

const CHANNEL_DETAILS = {
  "reposicoes.requisicoes": {
    title: "Reposições",
    body: "A fila de requisições foi atualizada.",
    route: "/reposicoes/requisicoes",
  },
  "reposicoes.historico": {
    title: "Histórico de reposições",
    body: "O histórico de reposições foi atualizado.",
    route: "/reposicoes/historico",
  },
  "reposicoes.reservas": {
    title: "Reservas",
    body: "A disponibilidade das reservas foi atualizada.",
    route: "/reposicoes/reservas",
  },
  controle_faltas: {
    title: "Controle de faltas",
    body: "Há uma atualização nas faltas registradas.",
    route: "/controle-faltas",
  },
  glosas: {
    title: "Controle de glosas",
    body: "Há uma atualização nas glosas.",
    route: "/controle-glosas",
  },
  admissao: {
    title: "Admissão",
    body: "As vagas ou admissões foram atualizadas.",
    route: "/admissao/vagas",
  },
  rescisoes: {
    title: "Rescisões",
    body: "Os registros de rescisão foram atualizados.",
    route: "/rescisoes",
  },
  projetos: {
    title: "Projetos",
    body: "Há uma atualização em projetos ou cards.",
    route: "/projetos",
  },
  tickets: {
    title: "Chamados",
    body: "Há uma atualização na Central de Chamados.",
    route: "/tickets",
  },
  estrutura: {
    title: "Estrutura",
    body: "A estrutura operacional foi atualizada.",
    route: "/estrutura",
  },
  colaboradores: {
    title: "Colaboradores",
    body: "Os dados de colaboradores foram atualizados.",
    route: "/reports/colaboradores-departamento",
  },
  configuracoes: {
    title: "Configurações",
    body: "Uma configuração do sistema foi atualizada.",
    route: "/configuracoes",
  },
  "estoque.produtos": {
    title: "Estoque",
    body: "Os produtos ou categorias foram atualizados.",
    route: "/estoque/produtos",
  },
  "estoque.movimentos": {
    title: "Estoque",
    body: "Há uma nova atualização nas movimentações de estoque.",
    route: "/estoque/movimentacoes",
  },
  "dashboard.logistica": {
    title: "Logística",
    body: "Os indicadores de logística foram atualizados.",
    route: "/reports/logistica",
  },
  ponto48: {
    title: "Ponto 48 horas",
    body: "Os dados do Ponto 48 horas foram atualizados.",
    route: "/reports/ponto-48-horas",
  },
  pcd: {
    title: "Indicadores PCD",
    body: "Os indicadores PCD foram atualizados.",
    route: "/indicadores/pcd",
  },
  medidas_disciplinares: {
    title: "Medidas disciplinares",
    body: "Há uma atualização nas medidas disciplinares.",
    route: "/controle-medidas-disciplinares",
  },
  avaliacoes_experiencia: {
    title: "Avaliações de experiência",
    body: "As avaliações de experiência foram atualizadas.",
    route: "/avaliacoes-experiencia",
  },
  ql: {
    title: "Quadro de lotação",
    body: "Os indicadores de QL foram atualizados.",
    route: "/reports/ql",
  },
  tm_ops: {
    title: "TM Ops",
    body: "Há uma atualização no Scheduler.",
    route: "/tm-ops/tarefas",
  },
  rpa: {
    title: "RPA Center",
    body: "Há uma atualização no RPA Center.",
    route: "/rpa",
  },
};

const ASYNC_SOCKET_CHANNELS = {
  ticket_update: "tickets",
  ql_update: "ql",
};

function browserNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function eventDetails(event = {}) {
  if (event.channel && CHANNEL_DETAILS[event.channel]) {
    return CHANNEL_DETAILS[event.channel];
  }

  return {
    title: event.summary || "TM Hub",
    body: event.detail || "Há uma atualização no sistema.",
    route: event.route || null,
  };
}

export function BrowserNotificationCenter({ showToast }) {
  const navigate = useNavigate();
  const [permission, setPermission] = useState(() => (
    browserNotificationsSupported() ? Notification.permission : "unsupported"
  ));
  const recentNotifications = useMemo(() => new Map(), []);
  const requestingPermission = useRef(false);

  const requestPermission = useCallback(async () => {
    if (
      requestingPermission.current
      || !browserNotificationsSupported()
      || Notification.permission !== "default"
    ) return;

    requestingPermission.current = true;
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission === "denied") {
        showToast(
          "warn",
          "Notificações bloqueadas",
          "Libere as notificações do TM Hub nas permissões do navegador para receber atualizações."
        );
      }
    } finally {
      requestingPermission.current = false;
    }
  }, [showToast]);

  // O navegador exige interação do usuário para mostrar a solicitação. Não há
  // preferência interna para desligar: uma vez permitidas, elas ficam ativas.
  useEffect(() => {
    if (!browserNotificationsSupported() || permission !== "default") return undefined;
    window.addEventListener("pointerdown", requestPermission, { capture: true, once: true });
    window.addEventListener("keydown", requestPermission, { capture: true, once: true });
    return () => {
      window.removeEventListener("pointerdown", requestPermission, { capture: true });
      window.removeEventListener("keydown", requestPermission, { capture: true });
    };
  }, [permission, requestPermission]);

  useEffect(() => {
    const showBrowserNotification = (event = {}) => {
      if (!browserNotificationsSupported() || Notification.permission !== "granted") return;
      if (event.source_socket && event.source_socket === socketio.id) return;
      if (document.visibilityState === "visible" && document.hasFocus()) return;

      const details = eventDetails(event);
      const key = `${event.channel || "system"}:${details.title}:${details.body}`;
      const now = Date.now();
      if (now - (recentNotifications.get(key) || 0) < DEDUPE_WINDOW_MS) return;
      recentNotifications.set(key, now);

      try {
        const notification = new Notification(details.title, {
          body: details.body,
          icon: NOTIFICATION_ICON,
          badge: NOTIFICATION_ICON,
          tag: `tmhub:${event.channel || "system"}`,
          renotify: false,
        });

        notification.onclick = () => {
          window.focus();
          if (details.route) navigate(details.route);
          notification.close();
        };
      } catch {
        // Browser notifications are complementary and must never affect realtime updates.
      }
    };

    socketio.on("data_changed", showBrowserNotification);
    socketio.on("system_notification", showBrowserNotification);
    const asyncHandlers = Object.entries(ASYNC_SOCKET_CHANNELS).map(([eventName, channel]) => {
      const handler = (event = {}) => showBrowserNotification({ ...event, channel });
      socketio.on(eventName, handler);
      return [eventName, handler];
    });

    return () => {
      socketio.off("data_changed", showBrowserNotification);
      socketio.off("system_notification", showBrowserNotification);
      asyncHandlers.forEach(([eventName, handler]) => socketio.off(eventName, handler));
    };
  }, [navigate, recentNotifications]);

  return null;
}
