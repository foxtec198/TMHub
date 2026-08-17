// React
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// Utilitários
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
// Componentes
import { ThemeLogo } from "../../components/ThemeLogo";
// Estilos
import "./requests_ods.css";

// Limita a paginação para manter os cards legíveis no painel.
const PAGE_SIZE = 9;
const ACTIVE_STATUSES = new Set(["pending", "updated"]);

const STATUS = {
  pending: { label: "PENDENTE", icon: "pi-hourglass", tone: "pending" },
  updated: { label: "ALTERADA", icon: "pi-pencil", tone: "updated" },
  approved: { label: "APROVADA", icon: "pi-check-circle", tone: "approved" },
  reproved: { label: "REPROVADA", icon: "pi-times-circle", tone: "reproved" },
};

// Aceita datas da API e mantém valores inválidos fora dos cálculos de prazo.
function parseDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shortName(value, fallback = "Não informado") {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.at(-1)}`;
}

// Mede o tempo operacional desde a abertura ou o agendamento da solicitação.
function elapsedMilliseconds(request, now) {
  const openedAt = parseDate(request.aberta_em || request.abertura);
  if (!openedAt) return 0;
  const closedAt = parseDate(request.decidida_em);
  return Math.max(0, (closedAt?.getTime() || now) - openedAt.getTime());
}

function formatElapsed(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return days ? `${days}d ${clock}` : clock;
}

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : parseDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayCategory(request, now) {
  const requestDay = startOfDay(request.abertura);
  const today = startOfDay(new Date(now));
  if (!requestDay || !today) return "past";
  if (requestDay.getTime() === today.getTime()) return "today";
  return requestDay > today ? "future" : "past";
}

function scheduledLabel(request, now) {
  const requestDay = startOfDay(request.abertura);
  const today = startOfDay(new Date(now));
  if (!requestDay || !today) return "DATA NÃO INFORMADA";
  const difference = Math.round((requestDay - today) / 86_400_000);
  if (difference === 0) return "HOJE";
  if (difference === 1) return `AMANHÃ • ${requestDay.toLocaleDateString("pt-BR")}`;
  return requestDay.toLocaleDateString("pt-BR");
}

// Define a situação visual a partir da data e do tempo decorrido.
function situation(request, now) {
  if (!ACTIVE_STATUSES.has(request.status)) return { label: "FINALIZADA", tone: "closed" };
  if (dayCategory(request, now) === "future") return { label: "AGENDADA", tone: "scheduled" };
  const hours = elapsedMilliseconds(request, now) / 3_600_000;
  if (hours >= 6) return { label: "EXPIRADA", tone: "critical" };
  if (hours >= 4) return { label: "EM ATRASO", tone: "warning" };
  return { label: "ABERTA", tone: "open" };
}

// Mantém o painel operacional atualizado e alterna automaticamente as páginas.
export function RequestsODS() {
  const [requests, setRequests] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [connected, setConnected] = useState(socketio.connected);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const refreshTimer = useRef(null);

  // Carrega as solicitações e preserva a última lista em caso de falha momentânea.
  const loadRequests = useCallback(async () => {
    try {
      const { data } = await connect.get("/repo/kds");
      setRequests(data.requisicoes || []);
      setLastUpdated(new Date());
      setError("");
    } catch (requestError) {
      const message = requestError.response?.data;
      const readableMessage = typeof message === "string" && !message.trim().startsWith("<")
        ? message
        : message?.message;
      setError(readableMessage || "Não foi possível atualizar o painel.");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadRequests, 0);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const fallback = window.setInterval(loadRequests, 60_000);
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(loadRequests, 150);
    };
    const handleConnect = () => { setConnected(true); scheduleRefresh(); };
    const handleDisconnect = () => setConnected(false);
    const handleFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));

    socketio.on("connect", handleConnect);
    socketio.on("disconnect", handleDisconnect);
    socketio.on("kds_update", scheduleRefresh);
    document.addEventListener("fullscreenchange", handleFullscreen);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(clock);
      window.clearInterval(fallback);
      window.clearTimeout(refreshTimer.current);
      socketio.off("connect", handleConnect);
      socketio.off("disconnect", handleDisconnect);
      socketio.off("kds_update", scheduleRefresh);
      document.removeEventListener("fullscreenchange", handleFullscreen);
    };
  }, [loadRequests]);

  // Prioriza solicitações mais críticas sem alterar a ordem original recebida.
  const sortedRequests = useMemo(() => [...requests].sort((first, second) => {
    const firstActive = ACTIVE_STATUSES.has(first.status);
    const secondActive = ACTIVE_STATUSES.has(second.status);
    if (firstActive !== secondActive) return firstActive ? -1 : 1;

    const dayPriority = { today: 0, future: 1, past: 2 };
    const firstDay = dayCategory(first, now);
    const secondDay = dayCategory(second, now);
    if (firstDay !== secondDay) return dayPriority[firstDay] - dayPriority[secondDay];

    if (firstActive) {
      const severityPriority = { critical: 0, warning: 1, open: 2, scheduled: 3 };
      const severityDifference = severityPriority[situation(first, now).tone] - severityPriority[situation(second, now).tone];
      if (severityDifference) return severityDifference;
      return (parseDate(first.abertura)?.getTime() || 0) - (parseDate(second.abertura)?.getTime() || 0);
    }
    return (parseDate(second.decidida_em)?.getTime() || 0) - (parseDate(first.decidida_em)?.getTime() || 0);
  }), [requests, now]);

  const pageCount = Math.max(1, Math.ceil(sortedRequests.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount - 1);
  const visibleRequests = sortedRequests.slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE);

  useEffect(() => {
    if (pageCount <= 1) return undefined;
    const rotation = window.setInterval(() => setPage((current) => (current + 1) % pageCount), 12_000);
    return () => window.clearInterval(rotation);
  }, [pageCount]);

  // Consolida os totais exibidos no cabeçalho do painel.
  const summary = useMemo(() => requests.reduce((result, request) => {
    if (ACTIVE_STATUSES.has(request.status)) {
      result.open += 1;
      const requestSituation = situation(request, now).tone;
      if (requestSituation === "warning") result.warning += 1;
      if (requestSituation === "critical") result.critical += 1;
    } else {
      result.closed += 1;
    }
    return result;
  }, { open: 0, warning: 0, critical: 0, closed: 0 }), [requests, now]);

  // Alterna o modo de exibição usado em monitores operacionais.
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  };

  return (
    <main className="requests-kds">
      <header className="requests-kds__header">
        <div className="requests-kds__brand">
          <ThemeLogo />
          <div><span>OPERAÇÃO EM TEMPO REAL</span><h1>ODS DE REPOSIÇÕES</h1></div>
        </div>

        <div className="requests-kds__header-status">
          <div className={`requests-kds__connection ${connected ? "is-online" : "is-offline"}`}>
            <i />{connected ? "TEMPO REAL" : "RECONECTANDO"}
          </div>
          <time>{new Date(now).toLocaleTimeString("pt-BR")}</time>
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}>
            <i className={`pi ${fullscreen ? "pi-window-minimize" : "pi-window-maximize"}`} />
          </button>
        </div>
      </header>

      <section className="requests-kds__summary" aria-label="Resumo das requisições">
        <article><span>Em aberto</span><strong>{summary.open}</strong></article>
        <article className="is-warning"><span>Em atraso</span><strong>{summary.warning}</strong></article>
        <article className="is-critical"><span>Expiradas</span><strong>{summary.critical}</strong></article>
        <article className="is-closed"><span>Finalizadas hoje</span><strong>{summary.closed}</strong></article>
      </section>

      <section className="requests-kds__board" aria-live="polite">
        <div className="requests-kds__table-header requests-kds__grid">
          <span>Tempo / data</span><span>Contrato / posto</span><span>Ausente</span><span>Reserva</span>
          <span>Supervisor</span><span>Motivo</span><span>Status</span><span>Situação</span>
        </div>

        <div className="requests-kds__rows">
          {visibleRequests.map((request) => {
            const status = STATUS[request.status] || { label: String(request.status || "—").toUpperCase(), icon: "pi-circle", tone: "pending" };
            const requestSituation = situation(request, now);
            const requestDay = dayCategory(request, now);
            return (
              <article key={request.id} className={`requests-kds__row requests-kds__grid is-${requestSituation.tone}`}>
                <div className="requests-kds__elapsed">
                  <i className={`pi ${requestDay === "future" ? "pi-calendar" : "pi-clock"}`} />
                  <strong>{requestDay === "future" ? "PROGRAMADA" : formatElapsed(elapsedMilliseconds(request, now))}</strong>
                  <small>{scheduledLabel(request, now)} • REQ #{request.id}</small>
                </div>
                <div><strong>{request.contrato || "Não informado"}</strong><small>DPTO {request.departamento ?? "—"}</small></div>
                <div><strong>{shortName(request.ausente)}</strong><small>{request.ausente_matricula || "Sem matrícula"}</small></div>
                <div><strong>{shortName(request.reserva, "SEM COBERTURA")}</strong><small>{request.reserva_matricula || "Aguardando definição"}</small></div>
                <div><strong>{shortName(request.supervisor)}</strong></div>
                <div><strong>{request.motivo || "Não informado"}</strong>{request.warning ? <small className="is-alert">ADVERTÊNCIA APLICADA</small> : request.obs ? <small title={request.obs}>{request.obs}</small> : null}</div>
                <div><span className={`requests-kds__badge is-${status.tone}`}><i className={`pi ${status.icon}`} />{status.label}</span></div>
                <div><span className={`requests-kds__badge is-${requestSituation.tone}`}>{requestSituation.label}</span></div>
              </article>
            );
          })}

          {!visibleRequests.length && (
            <div className="requests-kds__empty"><i className="pi pi-check-circle" /><strong>Nenhuma requisição na fila</strong><span>O painel atualizará automaticamente quando houver movimentação.</span></div>
          )}
        </div>
      </section>

      <footer className="requests-kds__footer">
        <span>{error || `Última sincronização: ${lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR") : "aguardando"}`}</span>
        <div className="requests-kds__pagination">
          {Array.from({ length: pageCount }, (_, index) => <i key={index} className={index === visiblePage ? "is-active" : ""} />)}
          <span>PÁGINA {visiblePage + 1}/{pageCount}</span>
        </div>
        <span>ABERTAS SEM LIMITE • FINALIZADAS DE HOJE</span>
      </footer>
    </main>
  );
}
