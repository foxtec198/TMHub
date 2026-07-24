import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Chart } from "primereact/chart";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import "./absenceDashboard.css";

const ALL = "__all__";
const now = new Date();
const DEFAULT_FILTERS = {
  period: [new Date(now.getFullYear(), now.getMonth(), 1), now],
  status: ALL,
  classification: ALL,
  department: ALL,
  supervisor: ALL,
  reason: ALL,
  contract: ALL,
  collaborator: ALL,
};
const STATUS_OPTIONS = [{ label: "Todas", value: ALL }, { label: "Pendentes", value: "pendente" }, { label: "Tratadas", value: "tratada" }];
const CLASSIFICATION_OPTIONS = [{ label: "Todas", value: ALL }, { label: "Justificadas", value: "justificada" }, { label: "Injustificadas", value: "injustificada" }, { label: "Em análise", value: "em_analise" }];

function isoDate(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function duration(value) {
  if (value == null) return "—";
  return value >= 48 ? `${(value / 24).toFixed(1)} dias` : `${Number(value).toFixed(1)}h`;
}

function options(values = [], prefix = "") {
  return [{ label: "Todos", value: ALL }, ...((values || []).map((value) => ({ label: `${prefix}${value}`, value: String(value) })))];
}

function periodLabel(period) {
  if (!period?.[0] || !period?.[1]) return "Período incompleto";
  return `${period[0].toLocaleDateString("pt-BR")} — ${period[1].toLocaleDateString("pt-BR")}`;
}

function EmptyChart({ text }) {
  return <div className="absence-empty-chart"><i className="pi pi-chart-bar" /><span>{text}</span></div>;
}

export function AbsenceDashboard() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [data, setData] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const filterPanel = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    if (!filters.period?.[0] || !filters.period?.[1]) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = { inicio: isoDate(filters.period[0]), fim: isoDate(filters.period[1]) };
        const mappings = {
          status: "status", classification: "classificacao", department: "departamento",
          supervisor: "supervisor", reason: "motivo", contract: "contrato", collaborator: "colaborador",
        };
        Object.entries(mappings).forEach(([stateKey, paramKey]) => {
          if (filters[stateKey] !== ALL) params[paramKey] = filters[stateKey];
        });
        const response = await connect.get("/controle-faltas/dashboard", { params });
        if (!cancelled) setData(response.data);
      } catch (error) {
        if (!cancelled) showToast("error", "Dashboard de Faltas", error.response?.data || "Não foi possível carregar os indicadores.");
      } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [filters, refresh, setLoading, showToast]);

  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1);
    socketio.on("absence_control_update", reload);
    socketio.on("new_request", reload);
    return () => { socketio.off("absence_control_update", reload); socketio.off("new_request", reload); };
  }, []);

  const indicators = data?.indicadores || {};
  const filterOptions = data?.filtros || {};
  const activeFilterCount = ["status", "classification", "department", "supervisor", "reason", "contract", "collaborator"]
    .filter((key) => filters[key] !== ALL).length;
  const treatedPercentage = indicators.total ? Math.round((indicators.tratadas || 0) * 100 / indicators.total) : 0;
  const reasonData = (data?.motivos || []).slice(0, 7);
  const maxContract = Math.max(1, ...(data?.contratos || []).map((item) => item.total));

  const reasonChart = useMemo(() => ({
    labels: reasonData.map((item) => item.label),
    datasets: [{ label: "Ocorrências", data: reasonData.map((item) => item.total), backgroundColor: "#4bd66e", hoverBackgroundColor: "#6bea8a", borderRadius: 7, barThickness: 22 }],
  }), [reasonData]);
  const classificationChart = useMemo(() => ({
    labels: ["Justificadas", "Injustificadas", "Em análise"],
    datasets: [{
      data: [indicators.justificadas || 0, indicators.injustificadas || 0, indicators.em_analise || 0],
      backgroundColor: ["#4bd66e", "#ef5350", "#f5a524"],
      hoverOffset: 4,
      borderWidth: 0,
      cutout: "72%",
    }],
  }), [indicators.justificadas, indicators.injustificadas, indicators.em_analise]);
  const reasonOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, grid: { color: "rgba(130,145,135,.12)" }, ticks: { precision: 0, color: "#91a098" }, border: { display: false } },
      y: { grid: { display: false }, ticks: { color: "#c6d0ca", font: { weight: "600" } }, border: { display: false } },
    },
  };

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters({ ...DEFAULT_FILTERS, period: [...DEFAULT_FILTERS.period] });

  return <section className="absence-dashboard">
    <header className="absence-dashboard-heading">
      <div><span>Gestão de ponto</span><h1>Dashboard de Faltas</h1><p>Indicadores de ocorrência, justificativa e velocidade de tratativa.</p></div>
      <div className="absence-dashboard-actions">
        <div className="absence-period-label"><i className="pi pi-calendar" /><span>{periodLabel(filters.period)}</span></div>
        <Button icon="pi pi-filter-fill" label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"} onClick={(event) => filterPanel.current?.toggle(event)} />
        <Button icon="pi pi-refresh" label="Atualizar" outlined onClick={() => setRefresh((value) => value + 1)} />
      </div>
    </header>

    <section className="absence-overview">
      <article className="absence-primary-kpi">
        <div className="absence-primary-icon"><i className="pi pi-calendar-times" /></div>
        <div><span>Total no período</span><strong>{indicators.total || 0}</strong><small>{treatedPercentage}% das ocorrências já foram tratadas</small></div>
        <div className="absence-progress"><span style={{ width: `${treatedPercentage}%` }} /></div>
      </article>
      <div className="absence-kpi-grid">
        <article className="is-warning"><span><i className="pi pi-clock" /> Pendentes</span><strong>{indicators.pendentes || 0}</strong><small>aguardando análise</small></article>
        <article className="is-success"><span><i className="pi pi-check-circle" /> Tratadas</span><strong>{indicators.tratadas || 0}</strong><small>processo concluído</small></article>
        <article className="is-danger"><span><i className="pi pi-exclamation-circle" /> Injustificadas</span><strong>{indicators.injustificadas || 0}</strong><small>classificação final</small></article>
        <article className="is-neutral"><span><i className="pi pi-stopwatch" /> Tempo médio</span><strong>{duration(indicators.tempo_medio_tratativa_horas)}</strong><small>até a tratativa</small></article>
      </div>
    </section>

    <section className="absence-analysis-grid">
      <article className="absence-dashboard-panel absence-reasons-panel">
        <header><div><span>Principais causas</span><h2>Ocorrências por motivo</h2></div><Tag value={`${indicators.total || 0} registros`} severity="success" rounded /></header>
        <div className="absence-reason-chart">{reasonData.length ? <Chart type="bar" data={reasonChart} options={reasonOptions} style={{ height: "100%" }} /> : <EmptyChart text="Nenhuma ocorrência para os filtros atuais." />}</div>
      </article>
      <article className="absence-dashboard-panel absence-classification-panel">
        <header><div><span>Resultado</span><h2>Classificação</h2></div></header>
        <div className="absence-doughnut-wrap">
          {(indicators.total || 0) > 0 ? <>
            <Chart type="doughnut" data={classificationChart} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            <div className="absence-doughnut-center"><strong>{indicators.total || 0}</strong><span>faltas</span></div>
          </> : <EmptyChart text="Sem dados no período." />}
        </div>
        <div className="absence-classification-legend">
          <span className="is-success"><i />Justificadas<strong>{indicators.justificadas || 0}</strong></span>
          <span className="is-danger"><i />Injustificadas<strong>{indicators.injustificadas || 0}</strong></span>
          <span className="is-warning"><i />Em análise<strong>{indicators.em_analise || 0}</strong></span>
        </div>
      </article>
    </section>

    <section className="absence-detail-grid">
      <article className="absence-dashboard-panel absence-contract-ranking">
        <header><div><span>Concentração</span><h2>Contratos com mais faltas</h2></div></header>
        <div className="absence-ranking-list">
          {(data?.contratos || []).slice(0, 7).map((item, index) => <div key={item.label}>
            <em>{String(index + 1).padStart(2, "0")}</em>
            <span><strong>{item.label}</strong><i><b style={{ width: `${item.total * 100 / maxContract}%` }} /></i></span>
            <small>{item.total}</small>
          </div>)}
          {!data?.contratos?.length && <EmptyChart text="Nenhum contrato para exibir." />}
        </div>
      </article>

      <article className="absence-dashboard-panel absence-recent-panel">
        <header><div><span>Ocorrências recentes</span><h2>Últimas faltas do recorte</h2></div></header>
        <DataTable value={data?.recentes || []} paginator rows={7} stripedRows size="small" emptyMessage="Nenhuma falta no período.">
          <Column field="data_falta" header="Data" sortable body={(row) => new Date(`${String(row.data_falta).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")} />
          <Column field="colaborador" header="Colaborador" sortable />
          <Column field="contrato" header="Contrato" sortable />
          <Column field="motivo" header="Motivo" sortable />
          <Column field="status" header="Tratativa" body={(row) => <Tag value={row.status === "tratada" ? "TRATADA" : "PENDENTE"} severity={row.status === "tratada" ? "success" : "info"} />} />
        </DataTable>
      </article>
    </section>

    <OverlayPanel ref={filterPanel} className="dashboard-filter-panel">
      <div className="dashboard-filter-title"><div><strong>Filtrar dashboard</strong><span>Os indicadores e gráficos usam o mesmo recorte.</span></div><Button icon="pi pi-filter-slash" text rounded aria-label="Limpar filtros" onClick={clearFilters} /></div>
      <div className="dashboard-filter-grid">
        <label className="is-wide"><span>Período</span><Calendar value={filters.period} onChange={(event) => setFilter("period", event.value)} selectionMode="range" readOnlyInput hideOnRangeSelection dateFormat="dd/mm/yy" showIcon /></label>
        <label><span>Situação</span><Dropdown value={filters.status} options={STATUS_OPTIONS} onChange={(event) => setFilter("status", event.value)} /></label>
        <label><span>Classificação</span><Dropdown value={filters.classification} options={CLASSIFICATION_OPTIONS} onChange={(event) => setFilter("classification", event.value)} /></label>
        <label><span>Departamento</span><Dropdown value={filters.department} options={options(filterOptions.departamentos, "DPTO. ")} onChange={(event) => setFilter("department", event.value)} filter /></label>
        <label><span>Supervisor</span><Dropdown value={filters.supervisor} options={options(filterOptions.supervisores)} onChange={(event) => setFilter("supervisor", event.value)} filter /></label>
        <label className="is-wide"><span>Motivo</span><Dropdown value={filters.reason} options={options(filterOptions.motivos)} onChange={(event) => setFilter("reason", event.value)} filter /></label>
        <label className="is-wide"><span>Contrato</span><Dropdown value={filters.contract} options={options(filterOptions.contratos)} onChange={(event) => setFilter("contract", event.value)} filter /></label>
        <label className="is-wide"><span>Colaborador</span><Dropdown value={filters.collaborator} options={[{ label: "Todos", value: ALL }, ...((filterOptions.colaboradores || []).map((item) => typeof item === "object" && item !== null ? item : { label: item, value: String(item) }))]} onChange={(event) => setFilter("collaborator", event.value)} filter /></label>
      </div>
    </OverlayPanel>
  </section>;
}
