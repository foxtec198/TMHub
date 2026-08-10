import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";

import { DashboardFilterButton, DashboardFilterPanel } from "../../components/DashboardFilterPanel";
import { PageHeader } from "../../components/PageHeader";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import connect from "../../utils/request";
import "./projectDashboards.css";

const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const defaultFilters = () => ({ periodo: [monthStart(), new Date()], projeto: [], colaborador: [], card: [], status: [] });
const asDate = (value) => value ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}` : null;
const asParam = (values) => values?.length ? values.join(",") : undefined;
const formatHours = (value) => value == null ? "—" : value >= 24 ? `${Math.round(value / 24)}d` : `${Math.round(value)}h`;
const percentage = (value, total) => total ? Math.round((Number(value || 0) / total) * 100) : 0;

const parseCardDate = (value) => {
  if (!value) return null;
  const raw = String(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatCardDate = (value, compact = false) => {
  const date = parseCardDate(value);
  if (!date) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", compact
    ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
  ).format(date).replace(",", " ·");
};

function MemberAvatar({ member, small = false }) {
  return (
    <span
      className={`project-member-avatar ${small ? "is-small" : ""}`}
      style={{ "--member-color": member.avatarColor || "#168447" }}
      title={member.nome}
    >
      {member.iniciais || member.nome?.slice(0, 2).toUpperCase() || "?"}
    </span>
  );
}

function EmptyChart({ text }) {
  return <div className="project-dashboard-empty">
      <span>Is Here, endpoint</span>
    <i className="pi pi-chart-bar" /><span>{text}</span></div>;
}

const projectDoughnutCenterPlugin = {
  id: "projectDoughnutCenter",
  afterDraw(chart, _args, options) {
    const center = chart.getDatasetMeta(0)?.data?.[0];
    if (!center) return;

    const total = chart.data.datasets[0]?.data?.reduce(
      (sum, value) => sum + Number(value || 0),
      0,
    );
    const { ctx } = chart;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = options.textColor;
    ctx.font = "700 24px Inter, Arial, sans-serif";
    ctx.fillText(String(total), center.x, center.y - 7);
    ctx.fillStyle = options.labelColor;
    ctx.font = "500 11px Inter, Arial, sans-serif";
    ctx.fillText("cards", center.x, center.y + 13);
    ctx.restore();
  },
};

export function ProjectDashboard() {
  const chartTheme = useChartTheme();
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [refresh, setRefresh] = useState(0);
  const filterPanel = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    if (!filters.periodo?.[0] || !filters.periodo?.[1]) return;
    setLoading(true);
    connect.get("/projetos/dashboard", {
      params: {
        inicio: asDate(filters.periodo[0]), fim: asDate(filters.periodo[1]),
        projeto: asParam(filters.projeto), colaborador: asParam(filters.colaborador),
        card: asParam(filters.card), status: asParam(filters.status),
      },
    })
      .then(({ data: response }) => setData(response))
      .catch((error) => showToast("error", "Dashboard de Projetos", error.response?.data || "Não foi possível carregar os dados."))
      .finally(() => setLoading(false));
  }, [filters, refresh, setLoading, showToast]);

  const summary = data?.resumo || {};
  const proceduralOptions = data?.filtros || {};
  const activeFilterCount = ["projeto", "colaborador", "card", "status"].filter((key) => filters[key].length).length;
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value || [] }));
  const clearFilters = () => setFilters(defaultFilters());

  const statusChart = useMemo(() => ({
    labels: ["Abertas", "Em andamento", "Concluídas"],
    datasets: [{
      data: [summary.status_abertas || 0, summary.status_andamento || 0, summary.status_concluidas || 0],
      backgroundColor: [chartTheme.palette[0], chartTheme.warning, chartTheme.success],
      borderWidth: 0,
      hoverOffset: 5,
    }],
  }), [summary.status_abertas, summary.status_andamento, summary.status_concluidas, chartTheme]);
  const doughnutOptions = useMemo(() => ({
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: chartTheme.text,
          usePointStyle: true,
          boxWidth: 8,
          padding: 18,
        },
      },
      projectDoughnutCenter: {
        textColor: chartTheme.text,
        labelColor: chartTheme.text,
      },
    },
  }), [chartTheme]);
  const upcomingCards = useMemo(() => [...(data?.cards || [])]
    .filter((card) => card.atrasado || card.data_fim)
    .sort((left, right) => {
      if (left.atrasado !== right.atrasado) return left.atrasado ? -1 : 1;
      return (parseCardDate(left.data_fim)?.getTime() || Infinity)
        - (parseCardDate(right.data_fim)?.getTime() || Infinity);
    })
    .slice(0, 8), [data]);
  const timelineCards = useMemo(() => [...(data?.timeline || [])]
    .sort((left, right) => (parseCardDate(left.data_inicio || left.data_fim)?.getTime() || Infinity)
      - (parseCardDate(right.data_inicio || right.data_fim)?.getTime() || Infinity))
    .slice(0, 8), [data]);
  const totalCards = Number(summary.cards || 0);
  const statusProgress = [
    { key: "done", label: "Concluídas", value: summary.status_concluidas || 0, tone: "success" },
    { key: "progress", label: "Em andamento", value: summary.status_andamento || 0, tone: "warning" },
    { key: "open", label: "Não iniciadas", value: summary.status_abertas || 0, tone: "neutral" },
  ];

  return (
    <main className="project-dashboard">
      <PageHeader
        section="Dashboards"
        title="Dashboard de Projetos"
        description="Prazos, execução e distribuição dos cards pelos membros."
        actions={<>
          <div className="project-dashboard-period"><i className="pi pi-calendar" />{filters.periodo?.[0]?.toLocaleDateString("pt-BR")} — {filters.periodo?.[1]?.toLocaleDateString("pt-BR")}</div>
          <DashboardFilterButton panelRef={filterPanel} activeCount={activeFilterCount} />
          <Button icon="pi pi-refresh" label="Atualizar" outlined onClick={() => setRefresh((value) => value + 1)} />
        </>}
      />

      <section className="project-progress-overview">
        <div>
          <span className="project-dashboard-eyebrow">Progresso dos cards</span>
          <h2>Visão geral do portfólio</h2>
        </div>
        <div className="project-progress-segments">
          {statusProgress.map((item) => (
            <div className={`is-${item.tone}`} key={item.key}>
              <span>{item.label}</span>
              <strong>{percentage(item.value, totalCards)}%</strong>
              <small>{item.value} cards</small>
            </div>
          ))}
        </div>
        <div className="project-progress-totals">
          <span><i className="pi pi-users" /><strong>{summary.participantes || 0}</strong><small>Participantes</small></span>
          <span><i className="pi pi-folder-open" /><strong>{summary.projetos || 0}</strong><small>Projetos</small></span>
        </div>
      </section>

      <section className="project-command-grid">
        <article className="project-command-card project-participants-card">
          <header><span>Pessoas</span><h2>Times por projeto</h2></header>
          <div className="project-participant-groups">
            {(data?.participantes_por_projeto || []).map((group) => (
              <div className="project-participant-group" key={group.projeto_id}>
                <div>
                  <i style={{ "--project-color": group.cor || "#168447" }} />
                  <span><strong>{group.projeto}</strong><small>{group.membros.length} participante(s)</small></span>
                </div>
                <div className="project-member-stack">
                  {group.membros.slice(0, 6).map((member) => <MemberAvatar member={member} key={member.id} />)}
                  {group.membros.length > 6 && <span className="project-member-more">+{group.membros.length - 6}</span>}
                </div>
              </div>
            ))}
            {!data?.participantes_por_projeto?.length && <EmptyChart text="Nenhum participante no recorte." />}
          </div>
        </article>

        <article className="project-command-card project-performance-card">
          <header><span>Performance</span><h2>Entrega contra o prazo</h2></header>
          <div className="project-performance-content">
            <div
              className="project-performance-ring"
              style={{ "--deadline-progress": `${Math.min(100, Number(summary.percentual_dentro_prazo || 0)) * 3.6}deg` }}
            >
              <span><strong>{summary.percentual_dentro_prazo || 0}%</strong><small>dentro do prazo</small></span>
            </div>
            <div className="project-performance-breakdown">
              <div className="is-on-time"><span>Dentro do prazo</span><strong>{summary.dentro_prazo || 0}</strong><small>{summary.percentual_dentro_prazo || 0}% do total</small></div>
              <div className="is-late"><span>Fora do prazo</span><strong>{summary.fora_prazo || 0}</strong><small>{summary.percentual_fora_prazo || 0}% do total</small></div>
              <div className="is-average"><span>Tempo médio</span><strong>{formatHours(summary.tempo_medio_horas)}</strong><small>até a conclusão</small></div>
            </div>
          </div>
        </article>

        <article className="project-command-card project-deadlines-card">
          <header><span>Agenda</span><h2>Próximos vencimentos</h2></header>
          <div className="project-deadline-feed">
            {upcomingCards.map((card) => (
              <div className={card.atrasado ? "is-late" : ""} key={card.id}>
                <span className="project-deadline-day">{parseCardDate(card.data_fim)?.getDate().toString().padStart(2, "0") || "—"}</span>
                <span><strong>{card.titulo}</strong><small>{card.projeto || "Projeto não informado"}</small></span>
                <time>{formatCardDate(card.data_fim, true)}</time>
              </div>
            ))}
            {!upcomingCards.length && <EmptyChart text="Nenhum vencimento no período." />}
          </div>
        </article>

        <article className="project-command-card project-timeline-card">
          <header><span>Planejamento</span><h2>Timeline dos cards</h2></header>
          <div className="project-card-timeline">
            {timelineCards.map((card) => (
              <div className={`is-${card.status}`} key={card.id}>
                <time>{formatCardDate(card.data_inicio || card.data_fim)}</time>
                <span className="project-timeline-marker" />
                <div>
                  <span><strong>{card.titulo}</strong><small>{card.projeto}</small></span>
                  <span className="project-member-stack is-compact">
                    {(card.membros || []).slice(0, 4).map((member) => <MemberAvatar member={member} small key={member.id} />)}
                  </span>
                </div>
              </div>
            ))}
            {!timelineCards.length && <EmptyChart text="Nenhum card com data no período." />}
          </div>
        </article>

        <article className="project-command-card project-status-card">
          <header><span>Status</span><h2>Distribuição atual</h2></header>
          <div className="project-dashboard-doughnut">
            {totalCards ? <Chart type="doughnut" data={statusChart} options={doughnutOptions} plugins={[projectDoughnutCenterPlugin]} /> : <EmptyChart text="Sem cards no período." />}
          </div>
        </article>
      </section>

      <DashboardFilterPanel
        panelRef={filterPanel}
        period={filters.periodo}
        onPeriodChange={(value) => setFilter("periodo", value)}
        onClear={clearFilters}
        fields={[
          { name: "projeto", label: "Projetos", value: filters.projeto, options: proceduralOptions.projetos || [], onChange: (value) => setFilter("projeto", value) },
          { name: "colaborador", label: "Colaboradores", value: filters.colaborador, options: proceduralOptions.colaboradores || [], onChange: (value) => setFilter("colaborador", value) },
          { name: "card", label: "Cards", value: filters.card, options: proceduralOptions.cards || [], onChange: (value) => setFilter("card", value), wide: true },
          { name: "status", label: "Status", value: filters.status, options: (proceduralOptions.status || ["fazer", "andamento", "conclu"]).map((value) => ({ label: value.replace(/\b\w/g, (letter) => letter.toUpperCase()), value })), onChange: (value) => setFilter("status", value), wide: true, filter: false },
        ]}
      />
    </main>
  );
}
