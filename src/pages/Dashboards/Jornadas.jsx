import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Chart } from "primereact/chart";
import { Divider } from "primereact/divider";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";

import { StandardFilterButton } from "../../components/filters/StandardFilterButton";
import { AppIcon } from "../../components/icons/AppIcon";
import { PageHeader } from "../../components/PageHeader";
import { Placeholder } from "../../components/Placeholder";
import { Table } from "../../components/tables/Table";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import connect from "../../utils/request";
import "./jornadas.css";

const INDICATORS = [
  { label: "Intrajornada", value: "intrajornada" },
  { label: "Interjornada", value: "interjornada" },
  { label: "Escala", value: "escala" },
];
const LINK_STATUS = [{ label: "Vinculado", value: "vinculado" }, { label: "Pendente", value: "pendente" }];

const initialPeriod = () => {
  const today = new Date();
  return [new Date(today.getFullYear(), today.getMonth(), 1), today];
};
const defaultFilters = () => ({ period: initialPeriod(), types: [], links: [], contracts: [], departments: [] });
const asDate = (value) => value ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}` : undefined;
const formatDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const formatPeriod = (period) => period?.[0] && period?.[1] ? `${formatDate(asDate(period[0]))} — ${formatDate(asDate(period[1]))}` : "Período incompleto";

function EmptyChart({ title, description }) {
  return <Placeholder variant="chart" icon={<AppIcon name="chart-bar" />} title={title} description={description} />;
}

function SummaryCard({ icon, label, value, detail, tone, badge }) {
  return <article className={`journey-dashboard-summary-card is-${tone}`}><span className="journey-dashboard-summary-card__icon"><AppIcon name={icon} /></span><div><small>{label}</small><strong>{value || 0}</strong><em>{detail}</em></div>{badge && <b>{badge}</b>}</article>;
}

export function JourneyDashboard() {
  const chartTheme = useChartTheme();
  const { showToast } = useToast();
  const setLoading = useLoading();
  const filterPanel = useRef(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [data, setData] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!filters.period?.[0] || !filters.period?.[1]) return undefined;
    let cancelled = false;
    const params = {
      inicio: asDate(filters.period[0]), fim: asDate(filters.period[1]),
      tipo: filters.types.join(",") || undefined,
      vinculo: filters.links.join(",") || undefined,
      contrato: filters.contracts.join(",") || undefined,
      departamento: filters.departments.join(",") || undefined,
    };
    setLoading(true);
    connect.get("/dash/jornadas", { params })
      .then(({ data: payload }) => { if (!cancelled) setData(payload); })
      .catch((error) => !cancelled && showToast("error", "Dashboard de Jornadas", error.response?.data || "Não foi possível carregar os indicadores."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters, refresh, setLoading, showToast]);

  const indicators = data?.indicadores || {};
  const evolution = data?.evolucao || [];
  const departments = data?.departamentos || [];
  const topOffenders = data?.ofensores || [];
  const activeFilterCount = filters.types.length + filters.links.length + filters.contracts.length + filters.departments.length;
  const percentage = (value) => indicators.total ? `${Math.round((Number(value || 0) * 100) / indicators.total)}%` : "0%";

  const evolutionChart = useMemo(() => ({
    labels: evolution.map((item) => formatDate(item.data)),
    datasets: [
      { label: "Intrajornada", data: evolution.map((item) => item.intrajornada), borderColor: chartTheme.warning, backgroundColor: `${chartTheme.warning}26`, tension: .35, fill: true, pointRadius: 3 },
      { label: "Interjornada", data: evolution.map((item) => item.interjornada), borderColor: chartTheme.danger, backgroundColor: `${chartTheme.danger}20`, tension: .35, fill: true, pointRadius: 3 },
      { label: "Escala", data: evolution.map((item) => item.escala), borderColor: chartTheme.palette[0], backgroundColor: `${chartTheme.palette[0]}20`, tension: .35, fill: true, pointRadius: 3 },
    ],
  }), [chartTheme, evolution]);

  const distributionChart = useMemo(() => ({
    labels: ["Intrajornada", "Interjornada", "Escala"],
    datasets: [{ data: [indicators.intrajornada || 0, indicators.interjornada || 0, indicators.escala || 0], backgroundColor: [chartTheme.warning, chartTheme.danger, chartTheme.palette[0]], borderWidth: 0, hoverOffset: 5, cutout: "72%" }],
  }), [chartTheme, indicators]);

  const lineOptions = useMemo(() => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: chartTheme.text, usePointStyle: true, padding: 16 } } }, scales: { x: { grid: { display: false }, ticks: { color: chartTheme.text }, border: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0, color: chartTheme.text }, grid: { color: chartTheme.grid }, border: { display: false } } } }), [chartTheme]);

  const setFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value || [] }));
  const clearFilters = () => setFilters(defaultFilters());
  const latestLabel = data?.ultima_importacao ? `Importado em ${formatDate(data.ultima_importacao.data_referencia)}` : "Sem importação";

  return <section className="journey-dashboard">
    <PageHeader section="Dashboards · Recursos humanos" title="Jornadas" description="Acompanhe as infrações apontadas pelo relatório Auditoria/Jornadas do Ponto Mais." actions={<><div className="journey-dashboard-period"><AppIcon name="calendar" /><span>{formatPeriod(filters.period)}</span></div><StandardFilterButton panelRef={filterPanel} count={activeFilterCount} /></>} />

    {!data?.disponivel ? <div className="journey-dashboard-unavailable"><Placeholder variant="chart" icon={<AppIcon name="file-spreadsheet" />} title="Aguardando dados de Jornadas" description="O dashboard será habilitado após a primeira importação do relatório Auditoria/Jornadas." /></div> : <>
      <section className="journey-dashboard-summary">
        <SummaryCard icon="alert-triangle" label="Infrações" value={indicators.total} detail="no recorte selecionado" tone="warning" badge="100%" />
        <SummaryCard icon="clock" label="Intrajornada" value={indicators.intrajornada} detail="intervalos insuficientes" tone="warning" badge={percentage(indicators.intrajornada)} />
        <SummaryCard icon="calendar-time" label="Interjornada" value={indicators.interjornada} detail="descansos insuficientes" tone="danger" badge={percentage(indicators.interjornada)} />
        <SummaryCard icon="calendar" label="Escala" value={indicators.escala} detail="acima do limite da escala" tone="violet" badge={percentage(indicators.escala)} />
        <SummaryCard icon="users" label="Colaboradores" value={indicators.colaboradores} detail="com apontamentos" tone="success" />
        <SummaryCard icon="link" label="Vínculos pendentes" value={indicators.pendentes_vinculo} detail="matrículas para completar" tone="neutral" />
      </section>

      <section className="journey-dashboard-details">
        <article className="journey-dashboard-panel journey-dashboard-departments"><header><div><span>Departamentos</span><h2>Resumo por área</h2></div><small>{departments.length} departamento(s) no recorte</small></header><div className="journey-dashboard-department-grid">{departments.length ? departments.map((item) => <article key={item.label}><header><strong>{item.label === "Não informado" ? item.label : `DPTO. ${item.label}`}</strong><span>{item.total} infração(ões)</span></header><div><span className="is-warning">{item.intrajornada || 0} intra</span><span className="is-danger">{item.interjornada || 0} inter</span><span className="is-success">{item.escala || 0} escala</span></div></article>) : <EmptyChart title="Nenhum departamento no recorte" />}</div></article>
      </section>

      <section className="journey-dashboard-analysis">
        <article className="journey-dashboard-panel journey-dashboard-evolution"><header><div><span>Evolução</span><h2>Infrações por dia</h2></div><small>{latestLabel}</small></header><div className="journey-dashboard-chart">{evolution.length ? <Chart type="line" data={evolutionChart} options={lineOptions} /> : <EmptyChart title="Sem ocorrências no período" description="Ajuste o período ou aguarde a próxima importação." />}</div></article>
        <article className="journey-dashboard-panel journey-dashboard-distribution"><header><div><span>Distribuição</span><h2>Por indicador</h2></div></header><div className="journey-dashboard-doughnut">{indicators.total ? <><Chart type="doughnut" data={distributionChart} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} /><div><strong>{indicators.total}</strong><span>infrações</span></div></> : <EmptyChart title="Sem indicadores" />}</div><div className="journey-dashboard-legend"><span className="is-warning"><i />Intrajornada<strong>{indicators.intrajornada || 0}</strong></span><span className="is-danger"><i />Interjornada<strong>{indicators.interjornada || 0}</strong></span><span className="is-violet"><i />Escala<strong>{indicators.escala || 0}</strong></span></div></article>
      </section>

      <section className="journey-dashboard-details">
        <article className="journey-dashboard-panel journey-dashboard-offenders"><header><div><span>Prioridade</span><h2>Maiores ofensores</h2></div><Tag value={`${topOffenders.length} colaborador(es)`} severity="warning" rounded /></header><Table data={topOffenders} rows={10} emptyTitle="Nenhum ofensor no período." tableStyle={{ minWidth: "760px" }} columns={[{ field: "colaborador", header: "Colaborador", body: (row) => <div className="journey-dashboard-person"><strong>{row.colaborador}</strong><small>{row.matricula ? `Matrícula ${row.matricula}` : "Matrícula pendente"}</small></div> }, { field: "contrato", header: "Contrato" }, { field: "total", header: "Total", body: (row) => <Tag value={row.total} severity="danger" rounded /> }, { field: "intrajornada", header: "Intra" }, { field: "interjornada", header: "Inter" }, { field: "escala", header: "Escala" }]} /></article>
      </section>
    </>}

    <OverlayPanel ref={filterPanel} className="dashboard-filter-panel journey-dashboard-filter">
      <div className="dashboard-filter-title"><div><strong>Filtrar dashboard</strong><span>Os filtros atualizam todos os indicadores e gráficos.</span></div><Button type="button" icon={<AppIcon name="filter-off" />} label="Limpar filtros" text severity="secondary" onClick={clearFilters} /></div>
      <Divider />
      <div className="dashboard-filter-grid">
        <label className="is-wide"><span>PERÍODO DA OCORRÊNCIA</span><Calendar value={filters.period} onChange={(event) => setFilter("period", event.value)} selectionMode="range" dateFormat="dd/mm/yy" readOnlyInput showIcon showButtonBar hideOnRangeSelection placeholder="Selecione o período" /></label>
        <label><span>INDICADORES</span><MultiSelect value={filters.types} options={INDICATORS} optionLabel="label" optionValue="value" display="chip" showClear placeholder="Todos os indicadores" onChange={(event) => setFilter("types", event.value)} /></label>
        <label><span>VÍNCULO</span><MultiSelect value={filters.links} options={LINK_STATUS} optionLabel="label" optionValue="value" display="chip" showClear placeholder="Todos os vínculos" onChange={(event) => setFilter("links", event.value)} /></label>
        <label><span>CONTRATO</span><MultiSelect value={filters.contracts} options={data?.filtros?.contratos || []} optionLabel="label" optionValue="value" display="chip" filter showClear maxSelectedLabels={1} selectedItemsLabel="{0} selecionados" placeholder="Todos os contratos" onChange={(event) => setFilter("contracts", event.value)} /></label>
        <label><span>DEPARTAMENTO</span><MultiSelect value={filters.departments} options={data?.filtros?.departamentos || []} optionLabel="label" optionValue="value" display="chip" filter showClear maxSelectedLabels={1} selectedItemsLabel="{0} selecionados" placeholder="Todos os departamentos" onChange={(event) => setFilter("departments", event.value)} /></label>
      </div>
    </OverlayPanel>
  </section>;
}
