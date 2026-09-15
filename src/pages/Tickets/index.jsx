import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { downloadProtectedFile } from "../../utils/protectedFile";
import { safeApiResourceUrl } from "../../utils/safeUrl";
import "../../components/UserAvatar.css";
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
  ABERTO: { label: "Aberto", severity: "info", icon: appIcon("inbox") },
  EM_ANDAMENTO: { label: "Em andamento", severity: "info", icon: appIcon("loader-2") },
  ATRASADO: { label: "Em atraso", severity: "danger", icon: appIcon("alert-triangle") },
  RESOLVIDO: { label: "Resolvido", severity: "success", icon: appIcon("circle-check") },
  FECHADO: { label: "Fechado", severity: "secondary", icon: appIcon("lock") },
  CANCELADO: { label: "Cancelado", severity: "secondary", icon: appIcon("circle-x") },
};

const EMPTY_TICKET = { name: "", observation: "", reason_id: null, responsible_id: null };
function ticketAdornment(value) {
  const adornment = String(value || "").trim();
  // Aceita somente códigos de adorno. Novos adornos usam a moldura padrão
  // automaticamente; estilos especiais continuam definidos no CSS global.
  return /^adorno_[a-z0-9_-]{1,64}$/i.test(adornment) ? adornment : "";
}

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

function ticketInitials(name = "") {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";
}

function ticketProfilePhoto(value) {
  const photo = String(value || "").trim();
  return /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(photo) ? photo : null;
}

function TicketAvatar({ user, className = "" }) {
  const photo = ticketProfilePhoto(user?.foto_perfil);
  const isCurrentUser = Number(user?.id) === Number(localStorage.getItem("current_id"));
  const configuredAdornment = user?.adorno_foto || (isCurrentUser ? localStorage.getItem("profile_adornment") : "");
  const adornment = ticketAdornment(configuredAdornment);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [photo]);

  const name = user?.nome || "Usuário";
  return <span className={`ticket-user-avatar tm-user-avatar ${adornment ? `tm-user-avatar--${adornment}` : ""} ${className}`.trim()} title={name} aria-label={name}>
    {photo && !imageFailed
      ? <img src={photo} alt="" onError={() => setImageFailed(true)} />
      : <span aria-hidden="true">{ticketInitials(name)}</span>}
  </span>;
}

function TicketMessageAvatar({ user }) {
  if (user?.avatar_type === "timo") {
    return <span className="ticket-message__timo-avatar" title="Timo Bot" aria-label="Timo Bot"><AppIcon name="sparkles"  /></span>;
  }
  return <TicketAvatar user={user} />;
}

function isTicketRequesterMessage(ticket, message) {
  if (typeof message?.is_requester === "boolean") return message.is_requester;
  const requesterId = Number(ticket?.created_by?.id);
  const authorId = Number(message?.created_by?.id);
  return Number.isInteger(requesterId)
    && requesterId > 0
    && requesterId === authorId;
}

function isImageAttachment(attachment) {
  return String(attachment?.content_type || attachment?.type || "").startsWith("image/");
}

function attachmentExtension(attachment) {
  const filename = String(attachment?.filename || attachment?.arquivo || attachment?.name || "");
  return filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
}

function isPdfAttachment(attachment) {
  return String(attachment?.content_type || attachment?.type || "") === "application/pdf"
    || attachmentExtension(attachment) === "pdf";
}

function isSpreadsheetAttachment(attachment) {
  const type = String(attachment?.content_type || attachment?.type || "");
  return [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ].includes(type) || ["xls", "xlsx"].includes(attachmentExtension(attachment));
}

function isPreviewableAttachment(attachment) {
  return isImageAttachment(attachment) || isPdfAttachment(attachment);
}

function attachmentKind(attachment) {
  if (isImageAttachment(attachment)) return "Imagem";
  if (isPdfAttachment(attachment)) return "PDF";
  if (isSpreadsheetAttachment(attachment)) return "Planilha";
  return "Arquivo";
}

function attachmentIcon(attachment) {
  if (isImageAttachment(attachment)) return "photo";
  if (isPdfAttachment(attachment)) return "file-type-pdf";
  if (isSpreadsheetAttachment(attachment)) return "file-spreadsheet";
  return "file";
}

function TicketAttachments({ ticketId, attachments = [] }) {
  const { showToast } = useToast();
  const [preview, setPreview] = useState(null);
  const [thumbnails, setThumbnails] = useState({});

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const attachmentPath = (attachment) => attachment?.url || (
    attachment?.id ? `/tickets/${ticketId}/anexos/${attachment.id}` : null
  );

  const fetchAttachment = async (attachment) => {
    const path = attachmentPath(attachment);
    const safeUrl = safeApiResourceUrl(path);
    if (!safeUrl) throw new Error("Endereço de anexo inválido.");
    const { data } = await connect.get(safeUrl, { responseType: "blob" });
    return data;
  };

  useEffect(() => {
    let active = true;
    const urls = [];
    setThumbnails({});

    const loadThumbnails = async () => {
      const entries = await Promise.all(attachments.map(async (attachment, index) => {
        if (!isImageAttachment(attachment)) return null;
        try {
          const data = await fetchAttachment(attachment);
          const url = URL.createObjectURL(data);
          if (!active) {
            URL.revokeObjectURL(url);
            return null;
          }
          urls.push(url);
          return [String(attachment.id || attachment.filename || index), url];
        } catch {
          return null;
        }
      }));
      if (active) setThumbnails(Object.fromEntries(entries.filter(Boolean)));
    };

    loadThumbnails();
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [attachments, ticketId]);

  const openPreview = async (attachment) => {
    try {
      const data = await fetchAttachment(attachment);
      setPreview({ attachment, url: URL.createObjectURL(data) });
    } catch (error) {
      showToast("error", "Anexo", messageFrom(error, "Não foi possível carregar a prévia do anexo."));
    }
  };

  const downloadAttachment = async (attachment) => {
    try {
      const data = await fetchAttachment(attachment);
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename || attachment.arquivo || "arquivo";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      showToast("error", "Anexo", messageFrom(error, "Não foi possível baixar o anexo."));
    }
  };

  if (!attachments.length) return null;

  return <>
    <div className="ticket-message__attachments">
      {attachments.map((attachment) => {
        const filename = attachment.filename || attachment.arquivo || "Arquivo";
        const attachmentKey = String(attachment.id || attachment.filename || filename);
        const previewable = isPreviewableAttachment(attachment);
        const available = Boolean(safeApiResourceUrl(attachmentPath(attachment)));
        return <article key={attachmentKey} className="ticket-message__attachment-item">
          <div className="ticket-message__attachment-thumb" aria-hidden="true">
            {thumbnails[attachmentKey]
              ? <img src={thumbnails[attachmentKey]} alt="" />
              : <AppIcon name={attachmentIcon(attachment)} />}
          </div>
          <div className="ticket-message__attachment-info">
            <strong>{filename}</strong>
            <span>{attachmentKind(attachment)}</span>
          </div>
          {available && <div className="ticket-message__attachment-controls">
            <button type="button" onClick={() => downloadAttachment(attachment)} aria-label={`Baixar ${filename}`} title="Baixar anexo">
              <AppIcon name="download" />
            </button>
            {previewable && <button type="button" onClick={() => openPreview(attachment)} aria-label={`Expandir ${filename}`} title="Expandir prévia">
              <AppIcon name="maximize" />
            </button>}
          </div>}
        </article>;
      })}
    </div>
    <Dialog
      header={preview?.attachment?.filename || preview?.attachment?.arquivo || "Prévia do anexo"}
      visible={Boolean(preview)}
      modal
      className="ticket-attachment-preview-dialog"
      onHide={() => setPreview(null)}
    >
      {preview && (isImageAttachment(preview.attachment)
        ? <img className="ticket-attachment-preview__image" src={preview.url} alt={preview.attachment.filename || preview.attachment.arquivo} />
        : <iframe className="ticket-attachment-preview__pdf" src={preview.url} title={`Prévia de ${preview.attachment.filename || preview.attachment.arquivo}`} sandbox="" referrerPolicy="no-referrer" />)}
    </Dialog>
  </>;
}

function TicketForm({ visible, onHide, onCreated, reasons }) {
  const [form, setForm] = useState(EMPTY_TICKET);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState([]);
  const { showToast } = useToast();

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  
  const handleFileSelect = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const maxSize = 15 * 1024 * 1024; // 15MB
    
    for (const file of selectedFiles) {
      if (!allowedTypes.includes(file.type)) {
        showToast("warn", "Arquivo inválido", `O arquivo "${file.name}" não é suportado.`);
        continue;
      }
      
      if (file.size > maxSize) {
        showToast("warn", "Arquivo muito grande", `O arquivo "${file.name}" excede o limite de 15MB.`);
        continue;
      }
      
      setFiles(prev => [...prev, {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      }]);
    }
  };
  
  const removeFile = (index) => {
    setFiles((current) => {
      const target = current[index];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const clearFiles = () => {
    setFiles((current) => {
      current.forEach((fileData) => fileData.preview && URL.revokeObjectURL(fileData.preview));
      return [];
    });
  };
  
  const save = async () => {
    if (!form.name.trim() || !form.observation.trim()) {
      showToast("warn", "Novo chamado", "Informe o título e a descrição do chamado.");
      return;
    }
    
    setSaving(true);
    try {
      const payload = files.length ? new FormData() : form;
      if (payload instanceof FormData) {
        payload.append("name", form.name);
        payload.append("observation", form.observation);
        if (form.reason_id) payload.append("reason_id", String(form.reason_id));
        files.forEach((fileData) => payload.append("arquivos", fileData.file));
      }
      const { data: ticket } = await connect.post("/tickets", payload);
      setForm(EMPTY_TICKET);
      clearFiles();
      onCreated(ticket);
      showToast("success", "Chamado aberto", "O chamado e seus anexos já estão disponíveis para atendimento.");
    } catch (error) {
      showToast("error", "Novo chamado", messageFrom(error, "Não foi possível abrir o chamado."));
    } finally {
      setSaving(false);
    }
  };

  return <Dialog visible={visible} onHide={() => { clearFiles(); onHide(); }} modal header="Abrir novo chamado" className="ticket-dialog" draggable={false}>
    <div className="ticket-form mt-5">
      <label><span>Título</span><InputText value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Descreva o chamado em uma frase" maxLength={180} /></label>
      <label><span>Motivo</span><Dropdown value={form.reason_id} options={reasons.map((item) => ({ label: item.nome, value: item.id }))} onChange={(event) => update("reason_id", event.value)} placeholder="Selecione se necessário" showClear /></label>
      <label className="ticket-form__wide"><span>Descrição</span><InputTextarea value={form.observation} onChange={(event) => update("observation", event.target.value)} placeholder="Explique o que aconteceu e o que precisa ser tratado." rows={5} autoResize /></label>
      
      {files.length > 0 && (
        <div className="ticket-form__wide">
          <label><span>Anexos ({files.length})</span></label>
          <div className="ticket-attachments-preview">
            {files.map((fileData, index) => (
              <div key={index} className="ticket-attachment-item">
                <div className="ticket-attachment-thumb">
                  {fileData.type.startsWith('image/') && fileData.preview ? (
                    <img src={fileData.preview} alt={fileData.name} />
                  ) : (
                    <AppIcon name={attachmentIcon(fileData)} />
                  )}
                </div>
                <div className="ticket-attachment-info">
                  <span className="ticket-attachment-name">{fileData.name}</span>
                  <span className="ticket-attachment-size">{(fileData.size / 1024).toFixed(2)} KB</span>
                </div>
                <Button
                  icon={<AppIcon name="trash" />}
                  onClick={() => removeFile(index)}
                  outlined
                  severity="danger"
                  rounded
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      <label className="ticket-form__wide">
        <span>Anexar arquivo</span>
        <div className="ticket-file-upload">
          <input
            type="file"
            id="ticket-file-upload"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <Button
            label="Selecionar arquivos"
            icon={<AppIcon name="paperclip" />}
            outlined
            onClick={() => document.getElementById('ticket-file-upload').click()}
          />
          <small className="p-text-secondary">Suporta PDF, imagens (PNG/JPG) e Excel</small>
        </div>
      </label>
    </div>
    <div className="ticket-dialog__footer"><Button label="Cancelar" text severity="secondary" onClick={() => { clearFiles(); onHide(); }} disabled={saving} /><Button label="Abrir chamado" icon={<AppIcon name="send" />} onClick={save} loading={saving} /></div>
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
        {canCreate && <Button icon={<AppIcon name="plus" />} label="Novo chamado" onClick={openNewTicket} />}
      </div>}
    />

    <section className="tickets-overview">
      <article className="tickets-highlight"><div className="tickets-highlight__icon"><AppIcon name="headphones"  /></div>
        <div>
          <span>Fila de atendimento</span>
          <strong>{metrics.open}</strong>
          <small>chamados em aberto ou em andamento</small>
        </div>
        <button type="button" onClick={() => { setStatus(null); setOnlyOpen(false); }}>Ver todos <AppIcon name="arrow-up-right"  /></button>
      </article>

      <article className="tickets-metric is-total">
        <AppIcon name="ticket"  />
        <span>Total</span>
        <strong>{metrics.total}</strong>
        <small>no seu escopo</small>
      </article>

      <article className="tickets-metric is-danger">
        <AppIcon name="clock"  />
        <span>Em atraso</span>
        <strong>{metrics.overdue}</strong>
        <small>prazo de 24h excedido</small>
      </article>

      <article className="tickets-metric is-success">
        <AppIcon name="circle-check"  />
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
            <AppIcon name="search"  />
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
                <AppIcon name="clock"  />{dueLabel(ticket, now)}
              </span>
              <div>
                {ticket.responsible && <TicketAvatar user={ticket.responsible} />}
                <span>{ticket.responsible?.nome || "Sem responsável"}</span>
              </div>
            </div>
          </button>)}{!filteredTickets.length && <div className="tickets-empty"><AppIcon name="ticket"  />

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
  const [files, setFiles] = useState([]);
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
      setTicket((current) => ({ ...current, ...data, comments: data.comments ?? (current?.comments || []) }));
      setStatusValue(data.status);
      setResponsibleValue(data.responsible?.id || null);
      showToast("success", "Chamado atualizado", successMessage);
    } catch (error) { showToast("error", "Chamado", messageFrom(error, "Não foi possível atualizar o chamado.")); }
  };

  const sendComment = async () => {
    if (!comment.trim() && files.length === 0) return;
    setSending(true);
    try {
      const description = comment.trim() || "Anexo enviado.";
      const { data: commentData } = await connect.post(`/tickets/${ticketId}/comentarios`, { description });
      let uploadedFiles = 0;
      let attachmentUploadFailed = false;
      try {
        for (const fileData of files) {
          const formData = new FormData();
          formData.append("arquivo", fileData.file);
          await connect.post(`/tickets/${ticketId}/comentarios/${commentData.id}/anexos`, formData);
          uploadedFiles += 1;
        }
      } catch {
        attachmentUploadFailed = true;
      }
      files.forEach((fileData) => {
        if (fileData.preview) URL.revokeObjectURL(fileData.preview);
      });
      setComment("");
      setFiles([]);
      await load();
      if (attachmentUploadFailed) {
        showToast("warn", "Comentário enviado", `A mensagem foi salva, mas apenas ${uploadedFiles} de ${files.length} anexo(s) foram enviados.`);
      }
    } catch (error) { 
      showToast("error", "Comentário", messageFrom(error, "Não foi possível enviar sua mensagem.")); 
    } finally { 
      setSending(false); 
    }
  };

  if (!ticket) return <section className="ticket-detail ticket-detail--loading"><AppIcon name="loader-2"  /> Carregando chamado…</section>;
  const isFinal = ["RESOLVIDO", "FECHADO", "CANCELADO"].includes(ticket.status);
  return <section className="ticket-detail">
    <PageHeader section="Atendimento / Chamados" title={`Chamado #${ticket.id}`} description={`Aberto em ${asDate(ticket.created_at)}`} actions={<Button icon={<AppIcon name="arrow-left" />} label="Voltar aos chamados" outlined onClick={() => navigate("/tickets")} />} />
    <section className="ticket-detail__meta"><div><span>Última atualização</span><strong>{asDate(ticket.updated_at)}</strong></div><div className={ticket.status === "ATRASADO" ? "is-overdue" : "is-on-time"}><span><AppIcon name="clock"  /> Prazo de resposta</span><strong>{dueLabel(ticket, now)}</strong></div><div>{statusTag(ticket.status)}</div></section>
    <section className="ticket-conversation">
      <aside className="ticket-info-panel"><div className="ticket-info-panel__heading"><span>Informações</span><h2>{ticket.name}</h2></div><p>{ticket.observation}</p><dl><div><dt>Motivo</dt><dd>{ticket.reason?.nome || "Não informado"}</dd></div><div><dt>Solicitante</dt><dd><TicketAvatar user={ticket.created_by} />{ticket.created_by?.nome || "—"}</dd></div><div><dt>Responsável</dt><dd><TicketAvatar user={ticket.responsible} />{ticket.responsible?.nome || "Aguardando atribuição"}</dd></div></dl>{canEdit && <div className="ticket-info-panel__edit"><label><span>Status</span><Dropdown value={statusValue} options={STATUS} onChange={(event) => { setStatusValue(event.value); update({ status: event.value }, "O status foi alterado."); }} /></label>{isAdmin && <label><span>Responsável</span><Dropdown value={responsibleValue} options={assignees.map((item) => ({ label: item.nome, value: item.id }))} onChange={(event) => { setResponsibleValue(event.value); update({ responsible_id: event.value }, "O responsável foi atualizado."); }} placeholder="Selecione" filter showClear /></label>}</div>}</aside>
      <main className="ticket-chat"><header><div><span>Conversa do chamado</span><h2>Tratativa em tempo real</h2></div><AppIcon name="messages"  /></header><div className="ticket-chat__messages"><article className="ticket-message ticket-message--origin"><TicketAvatar user={ticket.created_by} /><div><small>{ticket.created_by?.nome || "Solicitante"} · {asDate(ticket.created_at)}</small><p>{ticket.observation}</p><TicketAttachments ticketId={ticket.id} attachments={ticket.attachments || []} /></div></article>{(ticket.comments || []).map((item) => <article className={`ticket-message ${isTicketRequesterMessage(ticket, item) ? "ticket-message--requester" : ""} ${item.created_by?.avatar_type === "timo" ? "ticket-message--timo" : ""}`.trim()} key={item.id}><TicketMessageAvatar user={item.created_by} /><div><small>{item.created_by?.nome || "Atendimento"} · {asDate(item.created_at)}</small>{item.title && <strong>{item.title}</strong>}<p>{item.description}</p>{item.attachments?.length > 0 && <TicketAttachments ticketId={ticket.id} attachments={item.attachments} />}</div></article>)}{!(ticket.comments || []).length && <div className="ticket-chat__empty"><AppIcon name="messages"  />A conversa começa por aqui.</div>}</div>{canEdit && !isFinal && <footer className="ticket-chat__composer"><div className="ticket-chat__composer-attachments">{files.length > 0 && files.map((fileData, idx) => (
        <div key={idx} className="ticket-chat__attachment-preview">
          {fileData.type.startsWith('image/') ? (
            <img src={fileData.preview} alt={fileData.name} />
          ) : (
            <AppIcon name={attachmentIcon(fileData)} />
          )}
          <span>{fileData.name}</span>
          <button type="button" onClick={() => setFiles((prev) => {
            const removed = prev[idx];
            if (removed?.preview) URL.revokeObjectURL(removed.preview);
            return prev.filter((_, i) => i !== idx);
          })}>
            <AppIcon name="trash" />
          </button>
        </div>
      ))}</div><InputTextarea value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.ctrlKey && event.key === "Enter") sendComment(); }} rows={1} autoResize placeholder="Escreva uma atualização para o chamado…" /><div className="ticket-chat__composer-actions"><input type="file" id="chat-file-upload" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls" multiple onChange={(e) => {
        const selectedFiles = Array.from(e.target.files || []);
        const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
        const maxSize = 15 * 1024 * 1024;
        for (const file of selectedFiles) {
          if (!allowedTypes.includes(file.type)) continue;
          if (file.size > maxSize) continue;
          setFiles(prev => [...prev, { file, name: file.name, type: file.type, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null }]);
        }
        e.target.value = '';
      }} style={{ display: 'none' }} /><Button icon={<AppIcon name="paperclip" />} outlined onClick={() => document.getElementById('chat-file-upload').click()} /><Button icon={<AppIcon name="send" />} label="Enviar" aria-label="Enviar mensagem" title="Enviar mensagem" onClick={sendComment} loading={sending} disabled={!comment.trim() && files.length === 0} /></div></footer>}</main>
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
      if (event.source_socket && event.source_socket === socketio.id) return;
      if (event.channel && event.channel !== "tickets") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(reload, 250);
    };
    socketio.on("ticket_update", schedule);
    socketio.on("data_changed", schedule);
    return () => { window.clearTimeout(timer); socketio.off("ticket_update", schedule); socketio.off("data_changed", schedule); };
  }, [reload]);
}
