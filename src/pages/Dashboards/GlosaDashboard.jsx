import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";

import { DashboardFilterButton, DashboardFilterPanel } from "../../components/DashboardFilterPanel";
import { PageHeader } from "../../components/PageHeader";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import "./projectDashboards.css";

const yearPeriod = () => {
  const today = new Date();
  return [new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31)];
};
const initialFilters = () => ({ periodo: yearPeriod(), cobertura: [], departamento: [], contrato: [], colaborador: [] });
const iso = (date) => date && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const param = (values) => values?.length ? values.join(",") : undefined;
const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function MetricList({ rows = [], label }) {
  return <div className="project-dashboard-list">{rows.slice(0, 8).map((row) => <div key={row[label]}><span><strong>{row[label]}</strong><small>{row.quantidade} registro(s)</small></span><strong>{money(row.valor)}</strong></div>) || null}</div>;
}

function Summary({ icon, label, value, detail, tone = "neutral" }) {
  return <article className={`project-dashboard-summary-card is-${tone}`}><span className="project-dashboard-summary-card__icon"><i className={icon} /></span><span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span></article>;
}

export function GlosaDashboard() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [refresh, setRefresh] = useState(0);
  const filterPanel = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    if (!filters.periodo?.[0] || !filters.periodo?.[1]) return undefined;
    setLoading(true);
    connect.get("/glosas/dashboard", { params: { inicio: iso(filters.periodo[0]), fim: iso(filters.periodo[1]), cobertura: param(filters.cobertura), departamento: param(filters.departamento), contrato: param(filters.contrato), colaborador: param(filters.colaborador) } })
      .then(({ data: response }) => setData(response))
      .catch((error) => showToast("error", "Dashboard de Glosas", error.response?.data || "Não foi possível carregar as glosas."))
      .finally(() => setLoading(false));
  }, [filters, refresh, setLoading, showToast]);

  const summary = data?.resumo || {};
  const options = data?.filtros || {};
  const activeFilterCount = ["cobertura", "departamento", "contrato", "colaborador"].filter((key) => filters[key]?.length).length;
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value || [] }));
  const chart = useMemo(() => ({ labels: (data?.evolucao_mensal || []).map((row) => row.competencia), datasets: [{ label: "Valor", data: (data?.evolucao_mensal || []).map((row) => row.valor), backgroundColor: "#ef5350", borderRadius: 8 }] }), [data]);

  return <main className="project-dashboard">
    <PageHeader section="Dashboards" title="Dashboard de Glosas" description="Acompanhamento financeiro e operacional das glosas registradas." actions={<><DashboardFilterButton panelRef={filterPanel} activeCount={activeFilterCount} /><Button icon="pi pi-refresh" label="Atualizar" outlined onClick={() => setRefresh((value) => value + 1)} /></>} />
    <section className="project-dashboard-summary">
      <Summary icon="pi pi-file" label="Glosas" value={summary.total_registros || 0} detail="registros no período" />
      <Summary icon="pi pi-money-bill" label="Valor total" value={money(summary.valor_total)} detail="valor apontado" tone="violet" />
      <Summary icon="pi pi-check-circle" label="Valor coberto" value={money(summary.valor_coberto)} detail="com cobertura comprovada" tone="success" />
      <Summary icon="pi pi-times-circle" label="Valor descoberto" value={money(summary.valor_descoberto)} detail="impacto sem cobertura" tone="danger" />
      <Summary icon="pi pi-clock" label="Em análise" value={money(summary.valor_em_analise)} detail="aguardando tratativa" tone="warning" />
    </section>
    <section className="project-dashboard-analysis"><article className="project-dashboard-panel project-dashboard-performance"><header><div><span>Financeiro</span><h2>Evolução mensal</h2></div></header><div className="project-dashboard-chart">{data?.evolucao_mensal?.length ? <Chart type="bar" data={chart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: "#91a098" } }, y: { beginAtZero: true, grid: { color: "rgba(130,145,135,.14)" }, ticks: { color: "#91a098" } } } }} /> : <div className="project-dashboard-empty">Sem movimentação no período.</div>}</div></article><article className="project-dashboard-panel project-dashboard-insight"><span>Resumo do recorte</span><h2>{summary.valor_descoberto ? "Há valores sem cobertura para tratar" : "Não há valores descobertos"}</h2><p>Os indicadores consideram somente as glosas dentro do período e dos filtros escolhidos.</p><div><span><small>Dias apontados</small><strong>{summary.dias || 0}</strong></span><em>{summary.total_registros || 0} glosas</em></div></article></section>
    <section className="project-dashboard-detail-grid"><article className="project-dashboard-panel"><header><div><span>Contratos</span><h2>Maior impacto financeiro</h2></div></header><MetricList rows={data?.por_contrato} label="contrato" /></article><article className="project-dashboard-panel"><header><div><span>Motivos</span><h2>Ocorrências e colaboradores</h2></div></header><MetricList rows={data?.por_motivo} label="motivo" /></article></section>
    <DashboardFilterPanel panelRef={filterPanel} period={filters.periodo} onPeriodChange={(value) => setFilter("periodo", value)} onClear={() => setFilters(initialFilters())} fields={[
      { name: "cobertura", label: "Situação", value: filters.cobertura, options: [{ label: "Em análise", value: "em_analise" }, { label: "Coberta", value: "coberta" }, { label: "Parcial", value: "parcial" }, { label: "Descoberta", value: "descoberta" }], onChange: (value) => setFilter("cobertura", value), filter: false },
      { name: "departamento", label: "Departamento", value: filters.departamento, options: (options.departamentos || []).map((value) => ({ label: value, value })), onChange: (value) => setFilter("departamento", value) },
      { name: "contrato", label: "Contrato", value: filters.contrato, options: options.contratos || [], onChange: (value) => setFilter("contrato", value), wide: true },
      { name: "colaborador", label: "Colaborador", value: filters.colaborador, options: options.colaboradores || [], onChange: (value) => setFilter("colaborador", value), wide: true },
    ]} />
  </main>;
}
