import { AppIcon } from "../../components/icons/AppIcon";
import { useEffect, useMemo, useState } from "react";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { Timeline } from "primereact/timeline";

import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import { useToast } from "../../contexts/ToastContext";
import { UserAvatar } from "../../components/UserAvatar";
import { Table } from "../../components/tables/Table";

function toApiDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function duration(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}min` : `${minutes} min`;
}

function eventLabel(event) {
  if (event.tipo === "pagina_visitada") return `Abriu ${event.rota || "uma tela"}`;
  return `${event.metodo || "AÇÃO"} concluída em ${event.rota || "módulo"}`;
}

export function UsageControlSettings() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [data, setData] = useState({ resumo: {}, registros: [] });
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const response = await connect.get("/uso", { params: { dia: toApiDate(selectedDate) } });
      setData(response.data || { resumo: {}, registros: [] });
    } catch (error) {
      showToast("error", "Controle de uso", error.response?.data || "Não foi possível carregar a atividade do dia.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const refresh = (event) => {
      if (!event?.dia || event.dia === toApiDate(selectedDate)) load();
    };
    socketio.on("uso_tmhub_update", refresh);
    return () => socketio.off("uso_tmhub_update", refresh);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = data.resumo || {};
  const cards = useMemo(() => [
    ["users", "Usuários ativos", summary.usuarios_ativos || 0],
    ["clock", "Tempo ativo", duration(summary.segundos_ativos)],
    ["compass", "Páginas visitadas", summary.paginas_visitadas || 0],
    ["square-check", "Ações concluídas", summary.acoes_concluidas || 0],
    ["star-filled", "Edinhos liberados", summary.edinhos_gerados || 0],
  ], [summary]);

  const userBody = (record) => (
    <div className="usage-user-cell">
      <UserAvatar user={record.usuario} />
      <strong>{record.usuario?.nome || "Usuário"}</strong>
    </div>
  );

  return (
    <section className="usage-control">
      <header className="usage-control__header">
        <div>
          <h2>Uso do TMHub e Edinhos</h2>
          <p>Atividade por tela, tempo com a aba ativa e ações concluídas. Não registra conteúdo de formulários.</p>
        </div>
        <Calendar value={selectedDate} onChange={(event) => event.value && setSelectedDate(event.value)} dateFormat="dd/mm/yy" locale="pt-BR" showIcon readOnlyInput />
      </header>

      <div className="usage-control__summary">
        {cards.map(([icon, label, value]) => (
          <article key={label}>
            <AppIcon name={icon} />
            <div><small>{label}</small><strong>{value}</strong></div>
          </article>
        ))}
      </div>

      <Table data={data.registros || []} loading={loading} rows={10} emptyTitle="Nenhuma atividade registrada neste dia." tableClassName="usage-control__table" columns={[{ header: "Usuário", body: userBody, sortable: true, field: "usuario.nome" }, { header: "Primeira atividade", body: (record) => record.primeira_atividade_em ? new Date(record.primeira_atividade_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—" }, { header: "Última atividade", body: (record) => record.ultima_atividade_em ? new Date(record.ultima_atividade_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—" }, { header: "Tempo ativo", body: (record) => duration(record.segundos_ativos), sortable: true, field: "segundos_ativos" }, { header: "Páginas", field: "paginas_visitadas", sortable: true }, { header: "Ações", field: "acoes_concluidas", sortable: true }, { header: "Edinhos", body: (record) => <span className="usage-edinho"><AppIcon name="star-filled"  /> {record.edinhos_gerados}</span>, sortable: true, field: "edinhos_gerados" }, { header: "Timeline", body: (record) => <button type="button" className="usage-timeline-button" onClick={() => setSelectedRecord(record)}><AppIcon name="list"  /> Ver</button> }]} />

      <Dialog header={`Timeline de uso · ${selectedRecord?.usuario?.nome || ""}`} visible={Boolean(selectedRecord)} onHide={() => setSelectedRecord(null)} modal className="usage-timeline-dialog">
        {selectedRecord?.timeline?.length ? (
          <Timeline value={selectedRecord.timeline} align="left" opposite={(event) => <small>{new Date(event.ocorrido_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>} content={(event) => <span>{eventLabel(event)}</span>} />
        ) : <p className="text-color-secondary">Sem eventos detalhados neste dia.</p>}
      </Dialog>
    </section>
  );
}
