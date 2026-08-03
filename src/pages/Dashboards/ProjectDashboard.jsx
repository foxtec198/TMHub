import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { Tag } from "primereact/tag";

import { DashboardFilterButton, DashboardFilterPanel } from "../../components/DashboardFilterPanel";
import { PageHeader } from "../../components/PageHeader";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import "./projectDashboards.css";

const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const defaultFilters = () => ({ periodo: [monthStart(), new Date()], projeto: [], colaborador: [], card: [], status: [] });
const asDate = (value) => value ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}` : null;
const asParam = (values) => values?.length ? values.join(",") : undefined;
const formatHours = (value) => value == null ? "—" : value >= 24 ? `${Math.round(value / 24)}d` : `${Math.round(value)}h`;

function SummaryCard({ icon, label, value, detail, tone = "neutral" }) {
  return (
    <article className={`project-dashboard-summary-card is-${tone}`}>
      <span className="project-dashboard-summary-card__icon"><i className={icon} /></span>
      <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
    </article>
  );
}

function EmptyChart({ text }) {
  return <div className="project-dashboard-empty"><i className="pi pi-chart-bar" /><span>{text}</span></div>;
}

export function ProjectDashboard() {
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [refresh, setRefresh] = useState(0);
  const filterPanel = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    connect.get("/projetos").then(({ data: rows }) => setProjects(rows || [])).catch(() => setProjects([]));
  }, []);

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
  const cards = useMemo(() => projects.flatMap((project) => (
    (project.columns || []).flatMap((column) => (column.cards || []).map((card) => ({
      label: `${project.nome} · ${card.titulo}`,
      value: card.id,
    })))
  )), [projects]);
  const collaborators = useMemo(() => {
    const unique = new Map();
    projects.forEach((project) => (project.members || []).forEach((member) => unique.set(member.id, { label: member.nome, value: member.id })));
    return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [projects]);
  const activeFilterCount = ["projeto", "colaborador", "card", "status"].filter((key) => filters[key].length).length;
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value || [] }));
  const clearFilters = () => setFilters(defaultFilters());

  const performance = useMemo(() => ({
    labels: (data?.performance_colaboradores || []).map((item) => item.colaborador),
    datasets: [{ label: "Cards concluídos", data: (data?.performance_colaboradores || []).map((item) => item.concluidos), backgroundColor: "#45d66f", borderRadius: 8, maxBarThickness: 34 }],
  }), [data]);
  const statusChart = useMemo(() => ({
    labels: ["Abertos", "Concluídos", "Atrasados"],
    datasets: [{ data: [summary.abertos || 0, summary.concluidos || 0, summary.atrasados || 0], backgroundColor: ["#f2b44c", "#45d66f", "#ef5350"], borderWidth: 0, hoverOffset: 5 }],
  }), [summary.abertos, summary.atrasados, summary.concluidos]);
  const chartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: "#91a098" } },
      y: { beginAtZero: true, grid: { color: "rgba(130,145,135,.14)" }, border: { display: false }, ticks: { color: "#91a098", precision: 0 } },
    },
  }), []);
  const upcomingCards = useMemo(() => [...(data?.cards || [])]
    .filter((card) => card.atrasado || card.data_fim)
    .sort((left, right) => String(left.data_fim || "9999").localeCompare(String(right.data_fim || "9999")))
    .slice(0, 8), [data]);

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

      <section className="project-dashboard-summary">
        <SummaryCard icon="pi pi-folder" label="Projetos" value={summary.projetos || 0} detail={`${summary.projetos_no_prazo || 0} no prazo`} />
        <SummaryCard icon="pi pi-clone" label="Cards" value={summary.cards || 0} detail={`${summary.abertos || 0} em aberto`} tone="violet" />
        <SummaryCard icon="pi pi-check-circle" label="Concluídos" value={summary.concluidos || 0} detail={`${summary.concluidos_no_prazo || 0} no prazo`} tone="success" />
        <SummaryCard icon="pi pi-exclamation-triangle" label="Atrasados" value={summary.atrasados || 0} detail={`${summary.concluidos_atraso || 0} concluídos com atraso`} tone="danger" />
        <SummaryCard icon="pi pi-chart-pie" label="Conclusão" value={`${summary.percentual_conclusao || 0}%`} detail="do recorte selecionado" tone="info" />
        <SummaryCard icon="pi pi-stopwatch" label="Tempo médio" value={formatHours(summary.tempo_medio_horas)} detail="entre início e conclusão" tone="warning" />
      </section>

      <section className="project-dashboard-analysis">
        <article className="project-dashboard-panel project-dashboard-performance">
          <header><div><span>Execução por membro</span><h2>Cards concluídos</h2></div><Tag value={`${data?.performance_colaboradores?.length || 0} membros`} severity="success" rounded /></header>
          <div className="project-dashboard-chart">{data?.performance_colaboradores?.length ? <Chart type="bar" data={performance} options={chartOptions} /> : <EmptyChart text="Nenhuma execução no período." />}</div>
        </article>
        <article className="project-dashboard-panel project-dashboard-insight">
          <span>Leitura executiva</span>
          <h2>{summary.atrasados ? "Existem cards que exigem atenção" : "Todos os cards estão dentro do prazo"}</h2>
          <p>O indicador combina a data final do card com o status atual do quadro.</p>
          <div><span><small>Projetos em atraso</small><strong>{summary.projetos_atrasados || 0}</strong></span><em>{summary.projetos_no_prazo || 0} no prazo</em></div>
          <div><span><small>Cards próximos do vencimento</small><strong>{upcomingCards.filter((card) => !card.atrasado).length}</strong></span><em>{summary.atrasados || 0} em atraso</em></div>
        </article>
      </section>

      <section className="project-dashboard-detail-grid">
        <article className="project-dashboard-panel project-dashboard-status">
          <header><div><span>Andamento</span><h2>Distribuição dos cards</h2></div></header>
          <div className="project-dashboard-doughnut">{summary.cards ? <Chart type="doughnut" data={statusChart} options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } } }} /> : <EmptyChart text="Sem cards no período." />}</div>
        </article>
        <article className="project-dashboard-panel project-dashboard-deadlines">
          <header><div><span>Prioridade</span><h2>Próximos vencimentos e atrasos</h2></div></header>
          <div className="project-dashboard-list">
            {upcomingCards.map((card) => <div key={card.id}>
              <span><strong>{card.titulo}</strong><small>{card.projeto || "Projeto não informado"}</small></span>
              <Tag value={card.data_fim ? new Date(`${String(card.data_fim).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "Sem prazo"} severity={card.atrasado ? "danger" : "success"} rounded />
            </div>)}
            {!upcomingCards.length && <EmptyChart text="Nenhum card com prazo." />}
          </div>
        </article>
      </section>

      <DashboardFilterPanel
        panelRef={filterPanel}
        period={filters.periodo}
        onPeriodChange={(value) => setFilter("periodo", value)}
        onClear={clearFilters}
        fields={[
          { name: "projeto", label: "Projetos", value: filters.projeto, options: proceduralOptions.projetos || projects.map((project) => ({ label: project.nome, value: project.id })), onChange: (value) => setFilter("projeto", value) },
          { name: "colaborador", label: "Colaboradores", value: filters.colaborador, options: proceduralOptions.colaboradores || collaborators, onChange: (value) => setFilter("colaborador", value) },
          { name: "card", label: "Cards", value: filters.card, options: proceduralOptions.cards || cards, onChange: (value) => setFilter("card", value), wide: true },
          { name: "status", label: "Status", value: filters.status, options: (proceduralOptions.status || ["fazer", "andamento", "conclu"]).map((value) => ({ label: value.replace(/\b\w/g, (letter) => letter.toUpperCase()), value })), onChange: (value) => setFilter("status", value), wide: true, filter: false },
        ]}
      />
    </main>
  );
}
