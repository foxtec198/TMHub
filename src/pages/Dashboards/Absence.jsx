import { AppIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";

import { PageHeader } from "../../components/PageHeader";
import { Placeholder } from "../../components/Placeholder";
import { Table } from "../../components/tables/Table";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import "./absenceDashboard.css";

const initialPeriod = () => {
  const now = new Date();
  return [new Date(now.getFullYear(), now.getMonth(), 1), now];
};
const defaultFilters = () => ({ period: initialPeriod(), status: [], classification: [], department: [], supervisor: [], reason: [], contract: [], collaborator: [] });
const asDate = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const asOptions = (values = [], prefix = "") => values.map((value) => typeof value === "object" && value !== null ? value : ({ label: `${prefix}${value}`, value: String(value) }));
const formatPeriod = (period) => period?.[0] && period?.[1] ? `${period[0].toLocaleDateString("pt-BR")} — ${period[1].toLocaleDateString("pt-BR")}` : "Período incompleto";
const formatDuration = (value) => value == null ? "—" : value >= 48 ? `${(value / 24).toFixed(1)} dias` : `${Number(value).toFixed(1)}h`;

function EmptyChart({ text }) {
  return <Placeholder variant="chart" icon={<AppIcon name="chart-bar" />} title={text} />;
}

export function AbsenceDashboard() {
  const chartTheme = useChartTheme();
  const [filters, setFilters] = useState(defaultFilters);
  const [data, setData] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const filterPanel = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    if (!filters.period?.[0] || !filters.period?.[1]) return undefined;
    let cancelled = false;
    const params = { inicio: asDate(filters.period[0]), fim: asDate(filters.period[1]) };
    const mappings = { status: "status", classification: "classificacao", department: "departamento", supervisor: "supervisor", reason: "motivo", contract: "contrato", collaborator: "colaborador" };
    Object.entries(mappings).forEach(([stateKey, paramKey]) => {
      if (filters[stateKey]?.length) params[paramKey] = filters[stateKey].join(",");
    });
    setLoading(true);
    connect.get("/controle-faltas/dashboard", { params })
      .then(({ data: response }) => !cancelled && setData(response))
      .catch((error) => !cancelled && showToast("error", "Dashboard de Faltas", error.response?.data || "Não foi possível carregar os indicadores."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters, refresh, setLoading, showToast]);

  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1);
    socketio.on("absence_control_update", reload);
    socketio.on("new_request", reload);
    return () => { socketio.off("absence_control_update", reload); socketio.off("new_request", reload); };
  }, []);

  const indicators = useMemo(() => data?.indicadores || {}, [data]);
  const options = data?.filtros || {};
  const activeFilterCount = ["status", "classification", "department", "supervisor", "reason", "contract", "collaborator"].filter((key) => filters[key]?.length).length;
  const treatedPercentage = indicators.total ? Math.round((indicators.tratadas || 0) * 100 / indicators.total) : 0;
  const reasonData = (data?.motivos || []).slice(0, 7);
  const contractData = (data?.contratos || []).slice(0, 7);
  const maxContract = Math.max(1, ...contractData.map((item) => item.total));
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value || [] }));
  const clearFilters = () => setFilters(defaultFilters());

  const reasonChart = useMemo(() => ({ labels: reasonData.map((item) => item.label), datasets: [{ label: "Ocorrências", data: reasonData.map((item) => item.total), backgroundColor: chartTheme.palette[0], hoverBackgroundColor: chartTheme.palette[1], borderRadius: 7, barThickness: 22 }] }), [reasonData, chartTheme]);
  const classificationChart = useMemo(() => ({ labels: ["Justificadas", "Injustificadas", "Em análise"], datasets: [{ data: [indicators.justificadas || 0, indicators.injustificadas || 0, indicators.em_analise || 0], backgroundColor: [chartTheme.success, chartTheme.danger, chartTheme.warning], hoverOffset: 4, borderWidth: 0, cutout: "72%" }] }), [indicators, chartTheme]);
  const reasonOptions = useMemo(() => ({ indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: chartTheme.grid }, ticks: { precision: 0, color: chartTheme.text }, border: { display: false } }, y: { grid: { display: false }, ticks: { color: chartTheme.text, font: { weight: "600" } }, border: { display: false } } } }), [chartTheme]);

  return (
    <section className="absence-dashboard">
      <PageHeader
        section="Dashboards"
        title="Dashboard de Faltas"
        description="Indicadores de ocorrência, justificativa e velocidade de tratativa."
        actions={<>
          <div className="absence-period-label">
            <AppIcon name="calendar"  />
            <span>{formatPeriod(filters.period)}</span>
          </div>
          <Button type="button" icon={<AppIcon name="filter-filled" />} label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"} aria-label="Abrir filtros do dashboard" onClick={(event) => filterPanel.current?.toggle(event)} />
        </>}
      />

      <section className="absence-overview">
        <article className="absence-primary-kpi"><div className="absence-primary-icon"><AppIcon name="calendar-x"  /></div><div><span>Total no período</span><strong>{indicators.total || 0}</strong><small>{treatedPercentage}% das ocorrências já foram tratadas</small></div><div className="absence-progress"><span style={{ width: `${treatedPercentage}%` }} /></div></article>
        <div className="absence-kpi-grid">
          <article className="tm-dashboard-card is-warning"><span><AppIcon name="clock"  /> Pendentes</span><strong>{indicators.pendentes || 0}</strong><small>aguardando análise</small></article>
          <article className="tm-dashboard-card is-success"><span><AppIcon name="circle-check"  /> Tratadas</span><strong>{indicators.tratadas || 0}</strong><small>processo concluído</small></article>
          <article className="tm-dashboard-card is-danger"><span><AppIcon name="alert-circle"  /> Injustificadas</span><strong>{indicators.injustificadas || 0}</strong><small>classificação final</small></article>
          <article className="tm-dashboard-card is-neutral"><span><AppIcon name="stopwatch"  /> Tempo médio</span><strong>{formatDuration(indicators.tempo_medio_tratativa_horas)}</strong><small>até a tratativa</small></article>
        </div>
      </section>

      <section className="absence-analysis-grid">
        <article className="absence-dashboard-panel tm-dashboard-panel absence-reasons-panel"><header><div><span>Principais causas</span><h2>Ocorrências por motivo</h2></div><Tag value={`${indicators.total || 0} registros`} severity="success" rounded /></header><div className="absence-reason-chart">{reasonData.length ? <Chart type="bar" data={reasonChart} options={reasonOptions} style={{ height: "100%" }} /> : <EmptyChart text="Nenhuma ocorrência para os filtros atuais." />}</div></article>
        <article className="absence-dashboard-panel tm-dashboard-panel absence-classification-panel"><header><div><span>Resultado</span><h2>Classificação</h2></div></header><div className="absence-doughnut-wrap">{indicators.total ? <><Chart type="doughnut" data={classificationChart} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} /><div className="absence-doughnut-center"><strong>{indicators.total}</strong><span>faltas</span></div></> : <EmptyChart text="Sem dados no período." />}</div><div className="absence-classification-legend"><span className="is-success"><i />Justificadas<strong>{indicators.justificadas || 0}</strong></span><span className="is-danger"><i />Injustificadas<strong>{indicators.injustificadas || 0}</strong></span><span className="is-warning"><i />Em análise<strong>{indicators.em_analise || 0}</strong></span></div></article>
      </section>

      <section className="absence-detail-grid">
        <article className="absence-dashboard-panel tm-dashboard-panel absence-contract-ranking"><header><div><span>Concentração</span><h2>Contratos com mais faltas</h2></div></header><div className="absence-ranking-list">{contractData.map((item, index) => <div key={item.label}><em>{String(index + 1).padStart(2, "0")}</em><span><strong>{item.label}</strong><i><b style={{ width: `${item.total * 100 / maxContract}%` }} /></i></span><small>{item.total}</small></div>)}{!contractData.length && <EmptyChart text="Nenhum contrato para exibir." />}</div></article>
        <article className="absence-dashboard-panel tm-dashboard-panel absence-recent-panel"><header><div><span>Ocorrências recentes</span><h2>Últimas faltas do recorte</h2></div></header><Table data={data?.recentes || []} rows={7} emptyTitle="Nenhuma falta no período." tableStyle={{ minWidth: "700px" }} columns={[{ field: "data_falta", header: "Data", sortable: true, body: (row) => new Date(`${String(row.data_falta).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") }, { field: "colaborador", header: "Colaborador", sortable: true }, { field: "contrato", header: "Contrato", sortable: true }, { field: "motivo", header: "Motivo", sortable: true }, { field: "status", header: "Tratativa", body: (row) => <Tag value={row.status === "tratada" ? "TRATADA" : "PENDENTE"} severity={row.status === "tratada" ? "success" : "info"} /> }]} /></article>
      </section>

      <OverlayPanel ref={filterPanel} className="dashboard-filter-panel">
        <div className="dashboard-filter-title">
          <div><strong>Filtrar dashboard</strong><span>Combine os filtros para atualizar todos os indicadores e gráficos.</span></div>
          <Button type="button" icon={<AppIcon name="filter-off" />} label="Limpar filtros" text severity="secondary" onClick={clearFilters} />
        </div>
        <StandardFilterFields date={{ value: filters.period, onChange: (value) => setFilter("period", value) }} department={{ value: filters.department, options: asOptions(options.departamentos, "DPTO. "), onChange: (value) => setFilter("department", value) }} center={{ value: filters.contract, options: asOptions(options.contratos), onChange: (value) => setFilter("contract", value) }} />
        <div className="dashboard-filter-grid">
          <label><span>Situação</span><MultiSelect value={filters.status} options={[{ label: "Pendentes", value: "pendente" }, { label: "Tratadas", value: "tratada" }]} onChange={(event) => setFilter("status", event.value)} placeholder="Todas as situações" display="chip" showClear className="w-full" maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
          <label><span>Classificação</span><MultiSelect value={filters.classification} options={[{ label: "Justificadas", value: "justificada" }, { label: "Injustificadas", value: "injustificada" }, { label: "Em análise", value: "em_analise" }]} onChange={(event) => setFilter("classification", event.value)} placeholder="Todas as classificações" display="chip" showClear className="w-full" maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
          <label><span>Supervisor</span><MultiSelect value={filters.supervisor} options={asOptions(options.supervisores)} onChange={(event) => setFilter("supervisor", event.value)} placeholder="Todos os supervisores" display="chip" filter showClear className="w-full" maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
          <label className="is-wide"><span>Motivo</span><MultiSelect value={filters.reason} options={asOptions(options.motivos)} onChange={(event) => setFilter("reason", event.value)} placeholder="Todos os motivos" display="chip" filter showClear className="w-full" maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
          <label className="is-wide"><span>Colaborador</span><MultiSelect value={filters.collaborator} options={asOptions(options.colaboradores)} onChange={(event) => setFilter("collaborator", event.value)} placeholder="Todos os colaboradores" display="chip" filter showClear className="w-full" maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
        </div>
      </OverlayPanel>
    </section>
  );
}
