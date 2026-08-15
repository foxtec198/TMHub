import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar } from "primereact/avatar";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";

import { PageHeader } from "../../components/PageHeader";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { can } from "../../utils/permissions";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import "./tickets.css";

const STATUS = [
  { label: "Abertos", value: "ABERTO" },
  { label: "Em andamento", value: "EM_ANDAMENTO" },
  { label: "Atrasados", value: "ATRASADO" },
  { label: "Resolvidos", value: "RESOLVIDO" },
  { label: "Fechados", value: "FECHADO" },
  { label: "Cancelados", value: "CANCELADO" },
];

const STATUS_META = {
  ABERTO: { label: "Aberto", severity: "info", icon: "pi pi-inbox" },
  EM_ANDAMENTO: { label: "Em andamento", severity: "info", icon: "pi pi-spin pi-spinner" },
  ATRASADO: { label: "Em atraso", severity: "danger", icon: "pi pi-exclamation-triangle" },
  RESOLVIDO: { label: "Resolvido", severity: "success", icon: "pi pi-check-circle" },
  FECHADO: { label: "Fechado", severity: "secondary", icon: "pi pi-lock" },
  CANCELADO: { label: "Cancelado", severity: "secondary", icon: "pi pi-times-circle" },
};

const EMPTY_TICKET = { name: "", observation: "", reason_id: null, responsible_id: null };

function messageFrom(error, fallback) {
  const value = error?.response?.data;
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value?.message === "string") return value.message;
  return fallback;
}

function asDate(value, withTime = true) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString("pt-BR", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

function initials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function statusTag(status) {
  const meta = STATUS_META[status] || STATUS_META.ABERTO;
  return <Tag value={meta.label.toUpperCase()} severity={meta.severity} icon={meta.icon} rounded className={`ticket-status ticket-status--${String(status || "aberto").toLowerCase()}`} />;
}

function dueLabel(ticket, now) {
  if (["RESOLVIDO", "FECHADO", "CANCELADO"].includes(ticket.status)) return "Chamado finalizado";
  const due = new Date(ticket.due_at).getTime();
  const diffMinutes = Math.round((due - now) / 60000);
  if (diffMinutes < 0) {
    const hours = Math.floor(Math.abs(diffMinutes) / 60);
    const minutes = Math.abs(diffMinutes) % 60;
    return `Em atraso há ${hours ? `${hours}h ` : ""}${minutes}min`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `Restam ${hours ? `${hours}h ` : ""}${minutes}min para o prazo`;
}

function TicketAvatar({ user, className = "" }) {
  return user?.foto_perfil
    ? <Avatar image={user.foto_perfil} shape="circle" className={className} />
    : <Avatar label={initials(user?.nome)} shape="circle" className={className} />;
}

function TicketForm({ visible, onHide, onCreated, reasons }) {
  const [form, setForm] = useState(EMPTY_TICKET);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const save = async () => {
    if (!form.name.trim() || !form.observation.trim()) {
      showToast("warn", "Novo chamado", "Informe o título e a descrição do chamado.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await connect.post("/tickets", form);
      setForm(EMPTY_TICKET);
      onCreated(data);
      showToast("success", "Chamado aberto", "O chamado já está disponível para atendimento.");
    } catch (error) {
      showToast("error", "Novo chamado", messageFrom(error, "Não foi possível abrir o chamado."));
    } finally {
      setSaving(false);
    }
  };

  return <Dialog visible={visible} onHide={onHide} modal header="Abrir novo chamado" className="ticket-dialog" draggable={false}>
    <div className="ticket-form mt-5">
      <label><span>Título</span><InputText value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Descreva o chamado em uma frase" maxLength={180} /></label>
      <label><span>Motivo</span><Dropdown value={form.reason_id} options={reasons.map((item) => ({ label: item.nome, value: item.id }))} onChange={(event) => update("reason_id", event.value)} placeholder="Selecione se necessário" showClear /></label>
      <label className="ticket-form__wide"><span>Descrição</span><InputTextarea value={form.observation} onChange={(event) => update("observation", event.target.value)} placeholder="Explique o que aconteceu e o que precisa ser tratado." rows={5} autoResize /></label>
    </div>
    <div className="ticket-dialog__footer"><Button label="Cancelar" text severity="secondary" onClick={onHide} disabled={saving} /><Button label="Abrir chamado" icon="pi pi-send" onClick={save} loading={saving} /></div>
  </Dialog>;
}

export function TicketsDashboard() {
  const [tickets, setTickets] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(null);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [newTicket, setNewTicket] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const now = useMinuteClock();
  const { showToast } = useToast();
  const setLoading = useLoading();
  const navigate = useNavigate();
  const canCreate = can("tickets", "create");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ticketData }, { data: reasonData }] = await Promise.all([
        connect.get("/tickets"),
        connect.get("/tickets/motivos"),
      ]);
      setTickets(Array.isArray(ticketData) ? ticketData : []);
      setReasons(Array.isArray(reasonData) ? reasonData : []);
    } catch (error) {
      showToast("error", "Chamados", messageFrom(error, "Não foi possível carregar os chamados."));
    } finally {
      setLoading(false);
    }
  }, [setLoading, showToast]);

  useEffect(() => { load(); }, [load, refresh]);
  const refreshTickets = useCallback(() => setRefresh((value) => value + 1), []);
  useTicketRealtime(refreshTickets);

  const openNewTicket = useCallback(() => {
    setNewTicket(true);
  }, []);

  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery = !term || [ticket.id, ticket.name, ticket.observation, ticket.reason?.nome, ticket.created_by?.nome, ticket.responsible?.nome]
      .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term));
    const matchesStatus = status
      ? ticket.status === status
      : !onlyOpen || ["ABERTO", "EM_ANDAMENTO", "ATRASADO"].includes(ticket.status);
    return matchesQuery && matchesStatus;
  }), [tickets, onlyOpen, query, status]);

  const metrics = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((ticket) => ["ABERTO", "EM_ANDAMENTO"].includes(ticket.status)).length,
    overdue: tickets.filter((ticket) => ticket.status === "ATRASADO").length,
    resolved: tickets.filter((ticket) => ["RESOLVIDO", "FECHADO"].includes(ticket.status)).length,
  }), [tickets]);

  return <section className="tickets-dashboard">
    <PageHeader
      section="Atendimento"
      title="Central de Chamados"
      description="Acompanhe solicitações, tratativas e prazos em tempo real."
      actions={<div className="tickets-header-actions">
        {canCreate && <Button icon="pi pi-plus" label="Novo chamado" onClick={openNewTicket} />}
      </div>}
    />

    <section className="tickets-overview">
      <article className="tickets-highlight"><div className="tickets-highlight__icon"><i className="pi pi-headphones" /></div>
        <div>
          <span>Fila de atendimento</span>
          <strong>{metrics.open}</strong>
          <small>chamados em aberto ou em andamento</small>
        </div>
        <button type="button" onClick={() => { setStatus(null); setOnlyOpen(false); }}>Ver todos <i className="pi pi-arrow-up-right" /></button>
      </article>

      <article className="tickets-metric is-total">
        <i className="pi pi-ticket" />
        <span>Total</span>
        <strong>{metrics.total}</strong>
        <small>no seu escopo</small>
      </article>

      <article className="tickets-metric is-danger">
        <i className="pi pi-clock" />
        <span>Em atraso</span>
        <strong>{metrics.overdue}</strong>
        <small>prazo de 24h excedido</small>
      </article>

      <article className="tickets-metric is-success">
        <i className="pi pi-check-circle" />
        <span>Resolvidos</span>
        <strong>{metrics.resolved}</strong>
        <small>tratativas concluídas</small>
      </article>
    </section>

    <section className="tickets-workspace">
      <header className="tickets-workspace__header">
        <div>
          <span>Chamados</span>
          <h2>{onlyOpen && !status ? "Atendimento em andamento" : "Todos os chamados"}</h2>
        </div>
        <div className="tickets-toolbar">
          <span className="tickets-search">
            <i className="pi pi-search" />
            <InputText value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar chamado" aria-label="Buscar chamado" />
          </span>
          <Dropdown value={status} options={STATUS} onChange={(event) => { setStatus(event.value); setOnlyOpen(false); }} placeholder="Todos os status" showClear />
        </div>
      </header>

      <div className="tickets-list">
        {filteredTickets.map((ticket) =>
          <button type="button" className={`ticket-list-card ${ticket.status === "ATRASADO" ? "is-overdue" : ""}`} key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}>
            <div className="ticket-list-card__top">
              <span>#{ticket.id}</span>
              {statusTag(ticket.status)}
            </div>
            <h3>{ticket.name}</h3>
            <p>{ticket.observation}</p>
            <div className="ticket-list-card__bottom">
              <span className={ticket.status === "ATRASADO" ? "is-overdue" : ""}>
                <i className="pi pi-clock" />{dueLabel(ticket, now)}
              </span>
              <div>
                {ticket.responsible && <TicketAvatar user={ticket.responsible} />}
                <span>{ticket.responsible?.nome || "Sem responsável"}</span>
              </div>
            </div>
          </button>)}{!filteredTickets.length && <div className="tickets-empty"><i className="pi pi-ticket" />

            <strong>Nenhum chamado encontrado</strong>
            <span>Altere os filtros ou abra um novo chamado.</span>
          </div>}
      </div>
    </section>

    <TicketForm visible={newTicket} onHide={() => setNewTicket(false)} onCreated={(ticket) => { setNewTicket(false); setTickets((current) => [ticket, ...current]); navigate(`/tickets/${ticket.id}`); }} reasons={reasons} />
  </section>;
}

export function TicketDetail() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [comment, setComment] = useState("");
  const [statusValue, setStatusValue] = useState(null);
  const [responsibleValue, setResponsibleValue] = useState(null);
  const [sending, setSending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const now = useMinuteClock();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const setLoading = useLoading();
  const canEdit = can("tickets", "edit");
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ticketData } = await connect.get(`/tickets/${ticketId}`);
      setTicket(ticketData);
      setStatusValue(ticketData.status);
      setResponsibleValue(ticketData.responsible?.id || null);
    } catch (error) {
      showToast("error", "Chamado", messageFrom(error, "Não foi possível carregar o chamado."));
    } finally { setLoading(false); }
  }, [setLoading, showToast, ticketId]);

  useEffect(() => { load(); }, [load, refresh]);
  useEffect(() => {
    if (!isAdmin) return;
    connect.get("/tickets/responsaveis", { params: { limit: 100 } })
      .then(({ data }) => setAssignees(Array.isArray(data) ? data : []))
      .catch(() => setAssignees([]));
  }, [isAdmin]);
  useTicketRealtime(() => setRefresh((value) => value + 1));

  const update = async (payload, successMessage) => {
    try {
      const { data } = await connect.patch(`/tickets/${ticketId}`, payload);
      setTicket((current) => ({ ...current, ...data, comments: current?.comments || [] }));
      setStatusValue(data.status);
      setResponsibleValue(data.responsible?.id || null);
      showToast("success", "Chamado atualizado", successMessage);
    } catch (error) { showToast("error", "Chamado", messageFrom(error, "Não foi possível atualizar o chamado.")); }
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      const { data } = await connect.post(`/tickets/${ticketId}/comentarios`, { description: comment.trim() });
      setTicket((current) => ({ ...current, comments: [...(current?.comments || []), data] }));
      setComment("");
    } catch (error) { showToast("error", "Comentário", messageFrom(error, "Não foi possível enviar sua mensagem.")); }
    finally { setSending(false); }
  };

  if (!ticket) return <section className="ticket-detail ticket-detail--loading"><i className="pi pi-spin pi-spinner" /> Carregando chamado…</section>;
  const isFinal = ["RESOLVIDO", "FECHADO", "CANCELADO"].includes(ticket.status);
  return <section className="ticket-detail">
    <PageHeader section="Atendimento / Chamados" title={`Chamado #${ticket.id}`} description={`Aberto em ${asDate(ticket.created_at)}`} actions={<Button icon="pi pi-arrow-left" label="Voltar aos chamados" outlined onClick={() => navigate("/tickets")} />} />
    <section className="ticket-detail__meta"><div><span>Última atualização</span><strong>{asDate(ticket.updated_at)}</strong></div><div className={ticket.status === "ATRASADO" ? "is-overdue" : "is-on-time"}><span><i className="pi pi-clock" /> Prazo de resposta</span><strong>{dueLabel(ticket, now)}</strong></div><div>{statusTag(ticket.status)}</div></section>
    <section className="ticket-conversation">
      <aside className="ticket-info-panel"><div className="ticket-info-panel__heading"><span>Informações</span><h2>{ticket.name}</h2></div><p>{ticket.observation}</p><dl><div><dt>Motivo</dt><dd>{ticket.reason?.nome || "Não informado"}</dd></div><div><dt>Solicitante</dt><dd><TicketAvatar user={ticket.created_by} />{ticket.created_by?.nome || "—"}</dd></div><div><dt>Responsável</dt><dd><TicketAvatar user={ticket.responsible} />{ticket.responsible?.nome || "Aguardando atribuição"}</dd></div></dl>{canEdit && <div className="ticket-info-panel__edit"><label><span>Status</span><Dropdown value={statusValue} options={STATUS} onChange={(event) => { setStatusValue(event.value); update({ status: event.value }, "O status foi alterado."); }} /></label>{isAdmin && <label><span>Responsável</span><Dropdown value={responsibleValue} options={assignees.map((item) => ({ label: item.nome, value: item.id }))} onChange={(event) => { setResponsibleValue(event.value); update({ responsible_id: event.value }, "O responsável foi atualizado."); }} placeholder="Selecione" filter showClear /></label>}</div>}</aside>
      <main className="ticket-chat"><header><div><span>Conversa do chamado</span><h2>Tratativa em tempo real</h2></div><i className="pi pi-comments" /></header><div className="ticket-chat__messages"><article className="ticket-message ticket-message--origin"><TicketAvatar user={ticket.created_by} /><div><small>{ticket.created_by?.nome || "Solicitante"} · {asDate(ticket.created_at)}</small><p>{ticket.observation}</p></div></article>{(ticket.comments || []).map((item) => <article className="ticket-message" key={item.id}><TicketAvatar user={item.created_by} /><div><small>{item.created_by?.nome || "Atendimento"} · {asDate(item.created_at)}</small>{item.title && <strong>{item.title}</strong>}<p>{item.description}</p>{item.file && <a href={item.file} target="_blank" rel="noreferrer"><i className="pi pi-paperclip" /> Abrir anexo</a>}</div></article>)}{!(ticket.comments || []).length && <div className="ticket-chat__empty"><i className="pi pi-comments" />A conversa começa por aqui.</div>}</div>{canEdit && !isFinal && <footer className="ticket-chat__composer"><InputTextarea value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.ctrlKey && event.key === "Enter") sendComment(); }} rows={2} autoResize placeholder="Escreva uma atualização para o chamado…" /><Button icon="pi pi-send" label="Enviar" onClick={sendComment} loading={sending} disabled={!comment.trim()} /></footer>}</main>
    </section>
  </section>;
}

function useMinuteClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  return now;
}

function useTicketRealtime(reload) {
  useEffect(() => {
    let timer;
    const schedule = (event = {}) => {
      if (event.channel && event.channel !== "tickets") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(reload, 250);
    };
    socketio.on("ticket_update", schedule);
    socketio.on("data_changed", schedule);
    return () => { window.clearTimeout(timer); socketio.off("ticket_update", schedule); socketio.off("data_changed", schedule); };
  }, [reload]);
}
