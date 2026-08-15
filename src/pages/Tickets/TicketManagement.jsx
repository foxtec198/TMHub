import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";

import { PageHeader } from "../../components/PageHeader";
import { Table } from "../../components/tables/Table";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";

const STATUS_META = {
  ABERTO: { label: "Aberto", severity: "info" },
  EM_ANDAMENTO: { label: "Em andamento", severity: "info" },
  ATRASADO: { label: "Em atraso", severity: "danger" },
  RESOLVIDO: { label: "Resolvido", severity: "success" },
  FECHADO: { label: "Fechado", severity: "secondary" },
  CANCELADO: { label: "Cancelado", severity: "secondary" },
};

function messageFrom(error, fallback) {
  const data = error?.response?.data;
  return typeof data === "string" && data.trim() ? data : fallback;
}

function asDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function statusTag(status) {
  const meta = STATUS_META[status] || STATUS_META.ABERTO;
  return <Tag value={meta.label.toUpperCase()} severity={meta.severity} rounded />;
}

export function TicketManagement() {
  const [tickets, setTickets] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [reasonDialog, setReasonDialog] = useState(false);
  const [reasonName, setReasonName] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [{ data: ticketData }, { data: reasonData }] = await Promise.all([
        connect.get("/tickets"),
        connect.get("/tickets/motivos", { params: { include_inactive: true } }),
      ]);
      setTickets(Array.isArray(ticketData) ? ticketData : []);
      setReasons(Array.isArray(reasonData) ? reasonData : []);
    } catch (error) {
      showToast("error", "Gestão de chamados", messageFrom(error, "Não foi possível carregar os dados."));
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const reload = (event = {}) => {
      if (!event.channel || event.channel === "tickets") load();
    };
    socketio.on("ticket_update", reload);
    socketio.on("data_changed", reload);
    return () => {
      socketio.off("ticket_update", reload);
      socketio.off("data_changed", reload);
    };
  }, [load]);

  const metrics = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((ticket) => ["ABERTO", "EM_ANDAMENTO", "ATRASADO"].includes(ticket.status)).length,
    unassigned: tickets.filter((ticket) => !ticket.responsible).length,
  }), [tickets]);

  const createReason = async () => {
    if (reasonName.trim().length < 2) {
      showToast("warn", "Motivo", "Informe um motivo com ao menos 2 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await connect.post("/tickets/motivos", { nome: reasonName.trim() });
      setReasonName("");
      setReasonDialog(false);
      showToast("success", "Motivo criado", "O novo motivo já pode ser usado em chamados.");
      load();
    } catch (error) {
      showToast("error", "Motivo", messageFrom(error, "Não foi possível criar o motivo."));
    } finally {
      setSaving(false);
    }
  };

  const setReasonActive = async (reason, active) => {
    try {
      await connect.patch(`/tickets/motivos/${reason.id}`, { ativo: active });
      setReasons((current) => current.map((item) => item.id === reason.id ? { ...item, ativo: active } : item));
      showToast("success", "Motivo atualizado", active ? "Motivo ativado." : "Motivo inativado.");
    } catch (error) {
      showToast("error", "Motivo", messageFrom(error, "Não foi possível atualizar o motivo."));
    }
  };

  const ticketColumns = [
    { header: "#", field: "id", sortable: true, style: { width: "5rem" } },
    { header: "Chamado", field: "name", sortable: true },
    { header: "Filial", body: (ticket) => ticket.branch?.nome || "Não vinculada", sortable: true },
    { header: "Status", body: (ticket) => statusTag(ticket.status), sortable: true },
    { header: "Responsável", body: (ticket) => ticket.responsible?.nome || "Sem responsável" },
    { header: "Atualizado", body: (ticket) => asDate(ticket.updated_at) },
    { header: "Ações", body: (ticket) => <Button icon="pi pi-eye" text rounded aria-label="Abrir chamado" onClick={() => navigate(`/tickets/${ticket.id}`)} /> },
  ];

  const reasonColumns = [
    { header: "Motivo", field: "nome", sortable: true },
    { header: "Situação", body: (reason) => <Tag value={reason.ativo ? "ATIVO" : "INATIVO"} severity={reason.ativo ? "success" : "secondary"} /> },
    { header: "Ativo", body: (reason) => <InputSwitch checked={Boolean(reason.ativo)} onChange={(event) => setReasonActive(reason, event.value)} /> },
  ];

  return <section className="ticket-management">
    <PageHeader
      section="Atendimento / Administração"
      title="Gestão de Chamados"
      description="Acompanhe os chamados da filial selecionada, direcione responsáveis e mantenha os motivos de atendimento."
      actions={
        <div className="tickets-header-actions">
          <Button label="Novo motivo" icon="pi pi-plus" onClick={() => setReasonDialog(true)} />
        </div>}
    />

    <section className="ticket-management__metrics">
      <article><i className="pi pi-ticket" /><span>Total no filtro global</span><strong>{metrics.total}</strong></article>
      <article><i className="pi pi-inbox" /><span>Em tratativa</span><strong>{metrics.open}</strong></article>
      <article><i className="pi pi-user-minus" /><span>Sem responsável</span><strong>{metrics.unassigned}</strong></article>
    </section>

    <section className="ticket-management__grid">
      <article className="ticket-management__panel ticket-management__panel--tickets">
        <header><div><span>Fila administrativa</span><h2>Chamados da filial selecionada</h2></div></header>
        <Table data={tickets} columns={ticketColumns} search rows={10} rowsPerPageOptions={[10, 25, 50, 100]} />
      </article>
      <article className="ticket-management__panel ticket-management__panel--reasons">
        <header><div><span>Catálogo</span><h2>Motivos de chamados</h2></div></header>
        <Table data={reasons} columns={reasonColumns} search rows={8} rowsPerPageOptions={[8, 25, 50]} />
      </article>
    </section>

    <Dialog visible={reasonDialog} onHide={() => !saving && setReasonDialog(false)} modal draggable={false} header="Novo motivo de chamado" className="ticket-reason-dialog">
      <label className="ticket-reason-dialog__field"><span>Nome do motivo</span><InputText value={reasonName} onChange={(event) => setReasonName(event.target.value)} autoFocus placeholder="Ex.: Ajuste de acesso" maxLength={120} /></label>
      <footer><Button label="Cancelar" severity="secondary" text disabled={saving} onClick={() => setReasonDialog(false)} /><Button label="Salvar motivo" icon="pi pi-save" loading={saving} onClick={createReason} /></footer>
    </Dialog>
  </section>;
}
