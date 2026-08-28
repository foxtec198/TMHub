import { AppIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";

import { DashboardMetricCard } from "../../components/DashboardMetricCard";
import { DashboardPanel } from "../../components/DashboardPanel";
import { PageHeader } from "../../components/PageHeader";
import { Placeholder } from "../../components/Placeholder";
import { Table } from "../../components/tables/Table";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import connect from "../../utils/request";

import "./experience.css";


const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const STATUS_SEVERITY = {
  aberta: "info",
  em_preenchimento: "warning",
  aguardando_rh: "warning",
  atrasada: "danger",
  concluida: "success",
  cancelada: "secondary",
};

function initialPeriod() {
  const today = new Date();
  return [new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31)];
}

function initialFilters() {
  return {
    period: initialPeriod(),
    department: [],
    costCenter: [],
    supervisor: [],
    status: [],
  };
}

function dateParam(value) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateLabel(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (withTime) {
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }
  return date.toLocaleDateString("pt-BR");
}

function monthLabel(value) {
  const [year, month] = String(value).split("-").map(Number);
  return `${MONTHS[month - 1]}/${String(year).slice(-2)}`;
}

function strokeRoundedRect(context, left, top, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(left + safeRadius, top);
  context.lineTo(left + width - safeRadius, top);
  context.quadraticCurveTo(left + width, top, left + width, top + safeRadius);
  context.lineTo(left + width, top + height - safeRadius);
  context.quadraticCurveTo(left + width, top + height, left + width - safeRadius, top + height);
  context.lineTo(left + safeRadius, top + height);
  context.quadraticCurveTo(left, top + height, left, top + height - safeRadius);
  context.lineTo(left, top + safeRadius);
  context.quadraticCurveTo(left, top, left + safeRadius, top);
  context.closePath();
  context.stroke();
}

const futureBarsDashedBorderPlugin = {
  id: "experience-future-bars-dashed-border",
  afterDatasetDraw(chart, args) {
    const dataset = chart.data.datasets[args.index];
    if (!dataset?.isFutureProjection) return;

    const { ctx } = chart;
    ctx.save();
    ctx.strokeStyle = dataset.borderColor;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.setLineDash([1, 4]);

    chart.getDatasetMeta(args.index).data.forEach((bar) => {
      const left = bar.x - (bar.width / 2) + 1;
      const top = Math.min(bar.y, bar.base) + 1;
      const width = Math.max(bar.width - 2, 0);
      const height = Math.max(Math.abs(bar.base - bar.y) - 2, 0);
      if (width > 0 && height > 0) strokeRoundedRect(ctx, left, top, width, height, 7);
    });

    ctx.restore();
  },
};

function futureLegendMarker(color) {
  if (typeof document === "undefined") return "circle";

  const canvas = document.createElement("canvas");
  canvas.width = 20;
  canvas.height = 8;
  const context = canvas.getContext("2d");
  if (!context) return "circle";

  context.fillStyle = color;
  [3, 10, 17].forEach((position) => {
    context.beginPath();
    context.arc(position, 4, 1.6, 0, Math.PI * 2);
    context.fill();
  });
  return canvas;
}

function errorMessage(error) {
  const response = error.response?.data;
  if (typeof response === "string") return response;
  return response?.message || "Não foi possível carregar o dashboard.";
}

function StatusTag({ status, label }) {
  return <Tag value={label || status || "Não informado"} severity={STATUS_SEVERITY[status] || "secondary"} />;
}

export function ExperienceDashboard() {
  const chartTheme = useChartTheme();
  const filterPanel = useRef(null);
  const { showToast } = useToast();
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [activeDetail, setActiveDetail] = useState("priorities");

  const reload = useCallback(() => setRevision((current) => current + 1), []);
  const periodComplete = Boolean(filters.period?.[0] && filters.period?.[1]);

  useEffect(() => {
    if (!periodComplete) return undefined;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: response } = await connect.get("/dash/experiencias", {
          signal: controller.signal,
          params: {
            inicio: dateParam(filters.period[0]),
            fim: dateParam(filters.period[1]),
            departamento: filters.department.join(",") || undefined,
            centro_custo: filters.costCenter.join(",") || undefined,
            supervisor: filters.supervisor.join(",") || undefined,
            status: filters.status.join(",") || undefined,
          },
        });
        if (!controller.signal.aborted) setData(response);
      } catch (requestError) {
        if (controller.signal.aborted || requestError.code === "ERR_CANCELED") return;
        const message = errorMessage(requestError);
        setError(message);
        showToast("error", "Dashboard de experiência", message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [filters, periodComplete, revision, showToast]);

  const indicators = data?.indicadores || {};
  const options = data?.filtros || {};
  const activeFilterCount = ["department", "costCenter", "supervisor", "status"]
    .filter((key) => filters[key].length).length;
  const monthlyRows = useMemo(() => (data?.mensal || []).filter((item) => (
    [item.total, item.concluidas, item.atrasadas, item.futuras]
      .some((value) => Number(value || 0) > 0)
  )), [data]);
  const completedColor = useMemo(() => {
    if (chartTheme.theme === "cyberpunk") return chartTheme.palette[5];
    if (chartTheme.theme === "pride") return chartTheme.palette[3];
    return chartTheme.palette[1];
  }, [chartTheme]);
  const futureLegendPointStyle = useMemo(
    () => futureLegendMarker(chartTheme.palette[2]),
    [chartTheme],
  );

  const chartOptions = useMemo(() => ({
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", align: "end", labels: { color: chartTheme.text, usePointStyle: true, boxWidth: 8, pointStyleWidth: 20 } },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const descriptions = {
              "Em avaliação": "Tarefas abertas no controle.",
              "Concluídas": "Tarefas finalizadas pelo RH.",
              "Tarefas previstas": "Colaboradores em experiência cuja tarefa ainda será aberta.",
            };
            return [...new Set(items.map((item) => descriptions[item.dataset.label]).filter(Boolean))];
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: chartTheme.textSecondary }, grid: { display: false }, border: { display: false } },
      y: { beginAtZero: true, ticks: { color: chartTheme.textSecondary, precision: 0 }, grid: { color: chartTheme.grid }, border: { display: false } },
    },
  }), [chartTheme]);

  const monthlyChart = useMemo(() => ({
    labels: monthlyRows.map((item) => monthLabel(item.mes)),
    datasets: [
      {
        label: "Em avaliação",
        data: monthlyRows.map((item) => item.total),
        backgroundColor: chartTheme.palette[0],
        borderRadius: 7,
        maxBarThickness: 40
        ,
      },
      {
        label: "Concluídas",
        data: monthlyRows.map((item) => item.concluidas),
        backgroundColor: completedColor,
        borderRadius: 7,
        maxBarThickness: 40,
      },
      {
        label: "Tarefas previstas",
        data: monthlyRows.map((item) => item.futuras || 0),
        isFutureProjection: true,
        pointStyle: futureLegendPointStyle,
        backgroundColor: "transparent",
        borderColor: chartTheme.palette[2],
        borderWidth: 0,
        borderRadius: 7,
        maxBarThickness: 40,
      },
    ],
  }), [chartTheme, completedColor, futureLegendPointStyle, monthlyRows]);

  const columns = useMemo(() => [
    {
      header: "Colaborador",
      mobileHeader: "Colaborador",
      body: (row) => <div className="experience-dashboard-person"><strong>{row.colaborador}</strong><small>Matrícula {row.matricula}</small></div>,
    },
    {
      header: "Contrato",
      mobileHeader: "Contrato",
      body: (row) => <div className="experience-dashboard-person"><strong>{row.centro_custo}</strong><small>DPTO. {row.departamento}</small></div>,
    },
    { header: "Supervisor", mobileHeader: "Supervisor", field: "supervisor" },
    { header: "Fim da experiência", mobileHeader: "Fim da experiência", body: (row) => dateLabel(row.fim_experiencia) },
    { header: "Prazo", mobileHeader: "Prazo", body: (row) => dateLabel(row.prazo_supervisor, true) },
    { header: "Situação", mobileHeader: "Situação", body: (row) => <StatusTag status={row.situacao} label={data?.situacoes?.find((item) => item.situacao === row.situacao)?.label} /> },
  ], [data?.situacoes]);

  const employeesInExperienceColumns = useMemo(() => [
    {
      header: "Colaborador",
      mobileHeader: "Colaborador",
      body: (row) => <div className="experience-dashboard-person"><strong>{row.colaborador}</strong><small>Matrícula {row.matricula}</small></div>,
    },
    {
      header: "Contrato",
      mobileHeader: "Contrato",
      body: (row) => <div className="experience-dashboard-person"><strong>{row.centro_custo}</strong><small>DPTO. {row.departamento}</small></div>,
    },
    { header: "Supervisor", mobileHeader: "Supervisor", field: "supervisor" },
    { header: "Admissão", mobileHeader: "Admissão", body: (row) => dateLabel(row.admissao) },
    { header: "Fim da experiência", mobileHeader: "Fim da experiência", body: (row) => dateLabel(row.fim_experiencia) },
  ], []);

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value || [] }));
  };

  const clearFilters = () => setFilters(initialFilters());
  const totalDecisions = (data?.decisoes || []).reduce((total, item) => total + Number(item.total || 0), 0);
  const executiveTitle = indicators.atrasadas
    ? "Prazos exigem acompanhamento"
    : indicators.aguardando_rh
      ? "Tratativas aguardam o RH"
      : indicators.abertas
        ? "Avaliações em andamento"
        : "Fila de experiência regular";
  const executiveDescription = indicators.avaliacoes
    ? `${indicators.concluidas || 0} de ${indicators.avaliacoes} avaliação(ões) foram concluídas no recorte selecionado.`
    : "Não há avaliações de experiência no recorte selecionado.";

  return (
    <section className="experience-dashboard">
      <PageHeader
        section="Recursos humanos"
        title="Resumo de período de experiência"
        description="Acompanhe tarefas, prazos e decisões das avaliações de 90 dias."
        actions={<>
          <Button icon={<AppIcon name="filter-filled" />} label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"} onClick={(event) => filterPanel.current?.toggle(event)} />
        </>}
      />

      {loading && !data ? <Placeholder loading variant="dashboard" /> : error && !data ? (
        <div className="experience-dashboard-error" role="alert"><AppIcon name="alert-triangle"  /><div><strong>Não foi possível abrir o dashboard</strong><span>{error}</span></div><Button label="Tentar novamente" icon={<AppIcon name="refresh" />} outlined onClick={reload} /></div>
      ) : <>
        <div className="experience-dashboard-summary">
          <DashboardMetricCard title="Em experiência" value={indicators.em_experiencia || 0} detail="colaboradores ativos no período" icon={<AppIcon name="users" />} tone="primary" />
          <DashboardMetricCard title="Avaliações" value={indicators.avaliacoes || 0} detail="no recorte selecionado" icon={<AppIcon name="file-pencil" />} tone="info" />
          <DashboardMetricCard title="Em andamento" value={indicators.abertas || 0} detail="com o supervisor" icon={<AppIcon name="pencil" />} tone="warning" />
          <DashboardMetricCard title="Aguardando RH" value={indicators.aguardando_rh || 0} detail="prontas para tratativa" icon={<AppIcon name="briefcase" />} tone="info" />
          <DashboardMetricCard title="Atrasadas" value={indicators.atrasadas || 0} detail="requerem acompanhamento" icon={<AppIcon name="clock" />} tone="danger" />
          <DashboardMetricCard title="Concluídas" value={indicators.concluidas || 0} detail="avaliações finalizadas" icon={<AppIcon name="circle-check" />} tone="success" />
        </div>

        <div className="experience-dashboard-analysis">
          <DashboardPanel className="experience-dashboard-panel experience-dashboard-panel--wide">
            <header><div><span>Previsão</span><h2>Fim do período de experiência</h2></div></header>
            <div className="experience-dashboard-chart">
              {monthlyRows.length ? <Chart type="bar" data={monthlyChart} options={chartOptions} plugins={[futureBarsDashedBorderPlugin]} /> : <EmptyState message="Não há avaliações ou tarefas previstas no período." />}
            </div>
          </DashboardPanel>

          <DashboardPanel className="experience-dashboard-panel experience-dashboard-insight">
            <span>Leitura executiva</span>
            <h2>{executiveTitle}</h2>
            <p>{executiveDescription}</p>
            <div className="experience-dashboard-insight-row">
              <span><small>Em andamento</small><strong>{indicators.abertas || 0}</strong></span>
              <em>{indicators.atrasadas || 0} atrasada(s)</em>
            </div>
            <div className="experience-dashboard-insight-row">
              <span><small>Aguardando RH</small><strong>{indicators.aguardando_rh || 0}</strong></span>
              <em>{indicators.concluidas || 0} concluída(s)</em>
            </div>
            <div className="experience-dashboard-decision-title"><span>Decisões do RH</span><small>{totalDecisions} registrada(s)</small></div>
            <div className="experience-dashboard-decisions">
              {(data?.decisoes || []).map((item) => <article className={`is-${item.decisao}`} key={item.decisao}><strong>{item.total}</strong><span>{item.label}</span></article>)}
            </div>
          </DashboardPanel>
        </div>

        <DashboardPanel className="experience-dashboard-details">
          <nav className="experience-dashboard-detail-tabs" aria-label="Informações de acompanhamento">
            <button className={activeDetail === "priorities" ? "is-active" : ""} type="button" onClick={() => setActiveDetail("priorities")}><AppIcon name="alert-circle"  /><span>Tarefas que exigem acompanhamento</span><em>{data?.prioridades?.length || 0}</em></button>
            <button className={activeDetail === "supervisors" ? "is-active" : ""} type="button" onClick={() => setActiveDetail("supervisors")}><AppIcon name="users"  /><span>Pendências por supervisor</span><em>{data?.supervisores?.length || 0}</em></button>
            <button className={activeDetail === "employees" ? "is-active" : ""} type="button" onClick={() => setActiveDetail("employees")}><AppIcon name="id-badge"  /><span>Colaboradores em experiência</span><em>{indicators.em_experiencia || 0}</em></button>
          </nav>
          <div className="experience-dashboard-detail-content">
            {activeDetail === "priorities" ? <Table data={data?.prioridades || []} columns={columns} rows={10} rowsPerPageOptions={[10, 25, 50]} emptyMessage="Nenhuma tarefa pendente no recorte." /> : activeDetail === "employees" ? (
              <Table data={data?.colaboradores_em_experiencia || []} columns={employeesInExperienceColumns} rows={10} rowsPerPageOptions={[10, 25]} emptyMessage="Nenhum colaborador ativo em experiência no recorte." />
            ) : (
              (data?.supervisores || []).length ? <div className="experience-dashboard-supervisor-list">
                {data.supervisores.map((item) => <article key={item.supervisor}>
                  <div><strong>{item.supervisor}</strong><small>{item.total} avaliação(ões) no recorte</small></div>
                  <div><span className="is-warning">{item.pendentes} pendente(s)</span><span className="is-danger">{item.atrasadas} atrasada(s)</span></div>
                </article>)}
              </div> : <Placeholder variant="chart" icon={<AppIcon name="user-minus" />} title="Não há supervisores no recorte" />
            )}
          </div>
        </DashboardPanel>
      </>}

      <OverlayPanel ref={filterPanel} className="experience-dashboard-filter-panel">
        <div className="experience-dashboard-filter-header"><div><strong>Filtrar dashboard</strong><span>Indicadores, gráficos e lista usam o mesmo recorte.</span></div><Button icon={<AppIcon name="filter-off" />} rounded text aria-label="Limpar filtros" onClick={clearFilters} /></div>
        <StandardFilterFields date={{ value: filters.period, onChange: (value) => setFilters((current) => ({ ...current, period: value })) }} department={{ value: filters.department, options: options.departamentos, onChange: (value) => setFilter("department", value) }} center={{ value: filters.costCenter, options: options.centros_custo, onChange: (value) => setFilter("costCenter", value) }} />
        <div className="experience-dashboard-filters">
          <label><span>Supervisor</span><MultiSelect value={filters.supervisor} options={options.supervisores || []} onChange={(event) => setFilter("supervisor", event.value)} placeholder="Todos os supervisores" filter showClear /></label>
          <label><span>Situação</span><MultiSelect value={filters.status} options={options.situacoes || []} onChange={(event) => setFilter("status", event.value)} placeholder="Todas as situações" filter showClear /></label>
        </div>
      </OverlayPanel>
    </section>
  );
}
