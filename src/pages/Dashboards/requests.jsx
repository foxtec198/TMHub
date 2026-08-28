import { AppIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { StandardFilterButton } from "../../components/filters/StandardFilterButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";

import { DashCard } from "../../components/DashCard";
import { DashboardPanel } from "../../components/DashboardPanel";
import { PageHeader } from "../../components/PageHeader";
import { Placeholder } from "../../components/Placeholder";
import { Table } from "../../components/tables/Table";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";

import "./request.css";

const STATUS_META = {
  pending: { label: "Aberta", severity: "warning" },
  updated: { label: "Atualizada", severity: "info" },
  approved: { label: "Coberta", severity: "success" },
  reproved: { label: "Sem cobertura", severity: "danger" },
};

const FILTER_FIELDS = {
  empresa: (item) => item.empresa || "Sem empresa",
  filial: (item) => item.filial || "Sem filial",
  contrato: (item) => item.local,
  departamento: (item) => item.dpto,
  supervisor: (item) => item.supervisor || "Sem supervisor",
  motivo: (item) => item.motivo || "Não informado",
  status: (item) => item.status,
  colaborador: (item) => item.ausente,
};

function defaultPeriod() {
  const now = new Date();
  return [new Date(now.getFullYear(), now.getMonth(), 1), now];
}

function initialFilters() {
  return { empresa: [], filial: [], contrato: [], departamento: [], supervisor: [], motivo: [], status: [], colaborador: [] };
}

function dateParam(value) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value, withTime = false, chart = false) {
  const date = parseDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", chart
    ? { day: "2-digit", month: "2-digit"}
    : withTime
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(date).replace(",", " ·");
}

function dayKey(value) {
  const date = parseDate(value);
  return date ? dateParam(date) : "";
}

function firstAndLastName(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "—";
  return `${parts[0]} ${parts.at(-1)}`;
}

function statusMeta(status) {
  return STATUS_META[status] || { label: status || "Não informado", severity: "secondary" };
}

function filterRecords(records, filters, omittedField = null) {
  return records.filter((item) => Object.entries(FILTER_FIELDS).every(([field, getter]) => {
    if (field === omittedField || !filters[field]?.length) return true;
    return filters[field].includes(String(getter(item) ?? ""));
  }));
}

function makeOptions(records, filters, field) {
  const getter = FILTER_FIELDS[field];
  const values = new Set(
    filterRecords(records, filters, field)
      .map((item) => getter(item))
      .filter((value) => value !== undefined && value !== null && value !== ""),
  );

  return [...values]
    .map((value) => String(value))
    .sort((left, right) => left.localeCompare(right, "pt-BR", { numeric: true }))
    .map((value) => ({
      value,
      label: field === "departamento"
        ? `DPTO. ${value}`
        : field === "status"
          ? statusMeta(value).label
          : value,
    }));
}

function errorMessage(error) {
  const response = error.response?.data;
  if (typeof response === "string") return response;
  return response?.message || "Não foi possível carregar o dashboard de reposições.";
}

export function RequestReport() {
  const chartTheme = useChartTheme();
  const { showToast } = useToast();
  const filterPanel = useRef(null);
  const [period, setPeriod] = useState(defaultPeriod);
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision((current) => current + 1), []);
  const periodComplete = Boolean(period?.[0] && period?.[1]);
  const activeFilterCount = Object.values(filters).filter((value) => value?.length).length;

  useEffect(() => {
    if (!periodComplete) return undefined;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data: response } = await connect.post("/dash/reposicoes", {
          init: dateLabel(period[0]),
          end: dateLabel(period[1]),
        }, { signal: controller.signal });
        if (!controller.signal.aborted) setData(response);
      } catch (requestError) {
        if (controller.signal.aborted || requestError.code === "ERR_CANCELED") return;
        const message = errorMessage(requestError);
        setError(message);
        showToast("error", "Dashboard de Reposições", message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [period, periodComplete, revision, showToast]);

  useEffect(() => {
    socketio.on("new_request", reload);
    return () => socketio.off("new_request", reload);
  }, [reload]);

  const records = useMemo(() => [
    ...(data?.historico || []).map((item) => ({ ...item, recordType: "history" })),
    ...(data?.abertas_registros || []).map((item) => ({ ...item, recordType: "open" })),
  ], [data]);
  const filteredRecords = useMemo(() => filterRecords(records, filters), [records, filters]);
  const filteredReserveAbsences = useMemo(
    () => filterRecords(data?.faltas_reservas || [], filters),
    [data?.faltas_reservas, filters],
  );

  const filterOptions = useMemo(() => ({
    empresa: makeOptions(records, filters, "empresa"),
    filial: makeOptions(records, filters, "filial"),
    contrato: makeOptions(records, filters, "contrato"),
    departamento: makeOptions(records, filters, "departamento"),
    supervisor: makeOptions(records, filters, "supervisor"),
    motivo: makeOptions(records, filters, "motivo"),
    status: makeOptions(records, filters, "status"),
    colaborador: makeOptions(records, filters, "colaborador"),
  }), [records, filters]);

  const metrics = useMemo(() => {
    const open = filteredRecords.filter((item) => ["pending", "updated"].includes(item.status));
    const closed = filteredRecords.filter((item) => ["approved", "reproved"].includes(item.status));
    const covered = closed.filter((item) => item.status === "approved");
    const uncovered = closed.filter((item) => item.status === "reproved");
    const contractCount = filteredRecords.reduce((result, item) => {
      const label = item.local || "Contrato não identificado";
      result[label] = (result[label] || 0) + 1;
      return result;
    }, {});
    const [topContract = "Sem registros", topContractCount = 0] = Object.entries(contractCount)
      .sort(([, left], [, right]) => right - left)[0] || [];
    const today = dayKey(new Date());

    return {
      total: filteredRecords.length,
      open: open.length,
      covered: covered.length,
      uncovered: uncovered.length,
      coverageRate: closed.length ? Math.round((covered.length / closed.length) * 100) : 0,
      topContract,
      topContractCount,
      reserveAbsences: filteredReserveAbsences.length,
      reserveAbsencesToday: filteredReserveAbsences.filter((item) => dayKey(item.created_at) === today).length,
    };
  }, [filteredRecords, filteredReserveAbsences]);

  const daily = useMemo(() => {
    const byDay = filteredRecords.reduce((result, item) => {
      const key = dayKey(item.created_at);
      if (!key) return result;
      result[key] ||= { total: 0, covered: 0, uncovered: 0, open: 0 };
      result[key].total += 1;
      if (item.status === "approved") result[key].covered += 1;
      if (item.status === "reproved") result[key].uncovered += 1;
      if (["pending", "updated"].includes(item.status)) result[key].open += 1;
      return result;
    }, {});

    return Object.entries(byDay)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, values]) => ({ date, ...values }));
  }, [filteredRecords]);

  const departments = useMemo(() => Object.entries(filteredRecords.reduce((result, item) => {
    const key = String(item.dpto || "Não informado");
    result[key] ||= { total: 0, covered: 0, uncovered: 0, open: 0 };
    result[key].total += 1;
    if (item.status === "approved") result[key].covered += 1;
    if (item.status === "reproved") result[key].uncovered += 1;
    if (["pending", "updated"].includes(item.status)) result[key].open += 1;
    return result;
  }, {}))
    .sort(([, left], [, right]) => right.total - left.total), [filteredRecords]);

  const dailyChart = useMemo(() => ({
    labels: daily.map((item) => dateLabel(item.date, false, true)),
    datasets: [
      {
        label: "Requisições",
        data: daily.map((item) => item.total),
        borderColor: chartTheme.palette[0],
        backgroundColor: chartTheme.palette[0],
        pointBackgroundColor: chartTheme.palette[0],
        pointBorderColor: chartTheme.surface,
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: .38,
        borderWidth: 3,
        fill: false,
      },
    ],
  }), [chartTheme, daily]);

  const statusChart = useMemo(() => ({
    labels: ["Cobertas", "Sem cobertura", "Em aberto"],
    datasets: [{ data: [metrics.covered, metrics.uncovered, metrics.open], backgroundColor: [chartTheme.palette[1], chartTheme.palette[3], chartTheme.palette[2]], borderWidth: 0, hoverOffset: 5 }],
  }), [chartTheme, metrics]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: chartTheme.surface, titleColor: chartTheme.text, bodyColor: chartTheme.textSecondary },
    },
    scales: {
      x: { ticks: { color: chartTheme.textSecondary }, grid: { display: false }, border: { display: false } },
      y: { beginAtZero: true, ticks: { color: chartTheme.textSecondary, precision: 0 }, grid: { color: chartTheme.grid }, border: { display: false } },
    },
  }), [chartTheme]);
  const columns = useMemo(() => [
    { field: "created_at", header: "Data", mobileHeader: "Abertura", body: (row) => <time dateTime={row.created_at || undefined}>{dateLabel(row.created_at, true)}</time>, sortable: true, style: { minWidth: "9rem" } },
    { field: "ausente", header: "Ausente", mobileHeader: "Ausente", body: (row) => <strong>{firstAndLastName(row.ausente)}</strong>, sortable: true },
    {
      header: "Cobertura",
      mobileHeader: "Cobertura",
      field: "reserva",
      body: (row) => {
        const uncovered = row.status === "reproved" || row.reserva === "SEM COBERTURA" || !row.reserva;
        return <span className={`request-dashboard-coverage ${uncovered ? "is-uncovered" : "is-covered"}`}><AppIcon name={uncovered ? "circle-x" : "circle-check"} />{uncovered ? "Sem cobertura" : firstAndLastName(row.reserva)}</span>;
      },
      sortable: true,
    },
    { field: "local", header: "Contrato", mobileHeader: "Contrato", body: (row) => <div className="request-dashboard-contract"><strong>{row.local || "—"}</strong><small>{row.empresa || "Sem empresa"} · {row.filial || "Sem filial"} · DPTO. {row.dpto || "—"}</small></div>, sortable: true },
    { field: "supervisor", header: "Supervisor", mobileHeader: "Supervisor", body: (row) => firstAndLastName(row.supervisor), sortable: true },
    { header: "Motivo", mobileHeader: "Motivo", field: "motivo", sortable: true },
    { header: "Status", mobileHeader: "Status", body: (row) => { const meta = statusMeta(row.status); return <Tag value={meta.label} severity={meta.severity} rounded />; }, sortable: true },
  ], []);

  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value || [] }));
  const clearFilters = () => setFilters(initialFilters());

  return (
    <main className="request-dashboard">
      <PageHeader
        section="Dashboards"
        title="Dashboard de Reposições"
        description="Acompanhe coberturas, pendências e indisponibilidades de reservas no recorte selecionado."
        actions={<StandardFilterButton panelRef={filterPanel} count={activeFilterCount} />}
      />

      <OverlayPanel ref={filterPanel} className="request-dashboard-filter-panel">
        <div className="request-dashboard-filter-panel__heading"><div><strong>Filtros do dashboard</strong><span>As opções se ajustam ao recorte atual.</span></div><Button icon={<AppIcon name="filter-off" />} label="Limpar" text onClick={clearFilters} /></div>
        <StandardFilterFields date={{ value: period, onChange: setPeriod }} department={{ value: filters.departamento, options: filterOptions.departamento, onChange: (value) => setFilter("departamento", value) }} center={{ value: filters.contrato, options: filterOptions.contrato, onChange: (value) => setFilter("contrato", value) }} />
        <div className="request-dashboard-filter-grid">
          {[["supervisor", "Supervisor"], ["motivo", "Motivo"], ["status", "Status"], ["colaborador", "Colaborador"]].map(([field, label]) => <label key={field}><span>{label}</span><MultiSelect value={filters[field]} options={filterOptions[field]} optionLabel="label" optionValue="value" onChange={(event) => setFilter(field, event.value)} placeholder={`Todos: ${label.toLowerCase()}`} display="chip" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" panelClassName="dashboard-filter-dropdown" /></label>)}
        </div>
      </OverlayPanel>

      {loading && !data ? <Placeholder loading variant="dashboard" /> : error && !data ? (
        <Placeholder icon={<AppIcon name="alert-triangle" />} title="Não foi possível abrir o dashboard" description={error} action={<Button label="Tentar novamente" icon={<AppIcon name="refresh" />} outlined onClick={reload} />} />
      ) : <>
        <section className="request-dashboard__metrics" aria-label="Indicadores de reposições">
          <DashCard icon={<AppIcon name="list-check" />} title="Requisições" detail="no recorte selecionado" value={metrics.total} cont="100%" contSeverity="info" contClassName="request-metric-tag request-metric-tag-total" />
          <DashCard icon={<AppIcon name="clock" />} title="Em aberto" detail="aguardando decisão" value={metrics.open} tone="warning" cont={`${metrics.total ? Math.round((metrics.open / metrics.total) * 100) : 0}%`} contSeverity="warning" contClassName="request-metric-tag request-metric-tag-open" />
          <DashCard icon={<AppIcon name="circle-check" />} title="Cobertas" detail="decisões aprovadas" value={metrics.covered} tone="success" cont={`${metrics.coverageRate}%`} contSeverity="success" contClassName="request-metric-tag request-metric-tag-covered" />
          <DashCard icon={<AppIcon name="circle-x" />} title="Sem cobertura" detail="decisões reprovadas" value={metrics.uncovered} tone="danger" cont={`${metrics.total ? Math.round((metrics.uncovered / metrics.total) * 100) : 0}%`} contSeverity="danger" contClassName="request-metric-tag request-metric-tag-uncovered" />
          <DashCard icon={<AppIcon name="user-minus" />} title="Faltas de reservas" detail="no período selecionado" value={metrics.reserveAbsences} tone="danger" />
          <DashCard icon={<AppIcon name="calendar-x" />} title="Faltas de reservas" detail="registradas hoje" value={metrics.reserveAbsencesToday} tone="warning" />
        </section>

        <DashboardPanel className="request-dashboard-departments"><header><div><span>Departamentos</span><h2>Resumo por área</h2></div><small>{departments.length} departamento(s) no recorte</small></header>{departments.length ? <div className="request-dashboard-department-grid">{departments.map(([department, values]) => <article key={department}><header><strong>DPTO. {department}</strong><span>{values.total} requisição(ões)</span></header><div><span className="is-success">{values.covered} cobertas</span><span className="is-danger">{values.uncovered} sem cobertura</span><span className="is-warning">{values.open} abertas</span></div></article>)}</div> : <Placeholder variant="content" title="Nenhum departamento no recorte" />}</DashboardPanel>

        <section className="request-dashboard__analysis">
          <DashboardPanel className="request-dashboard-panel request-dashboard-panel--wide"><header><div><span>Volume</span><h2>Requisições por dia</h2></div><small>{metrics.total} registro(s) no recorte</small></header><div className="request-dashboard-chart">{daily.length ? <Chart type="line" data={dailyChart} options={chartOptions} /> : <Placeholder variant="chart" title="Sem requisições no período" description="Ajuste o período ou aguarde novos registros." />}</div></DashboardPanel>
          <DashboardPanel className="request-dashboard-panel request-dashboard-panel--status">
            <header>
              <div>
                <span>Cobertura</span>
                <h2>Situação das requisições</h2>
              </div>
            </header>
            <div className="request-dashboard-status-body">
              <div className="request-dashboard-doughnut">{metrics.total ? <><Chart type="doughnut" data={statusChart} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                <div>
                  <strong>{metrics.coverageRate}%</strong>
                  <span>cobertas</span>
                </div>
              </> :
                <Placeholder variant="chart" title="Sem dados de cobertura" />}
              </div>
              <div className="request-dashboard-status-legend">
                <span className="is-success">
                  <i />Cobertas
                  <strong>{metrics.covered}</strong>
                </span><span className="is-danger">
                  <i />Sem cobertura <strong>{metrics.uncovered}
                  </strong>
                </span>
                <span className="is-warning">
                  <i />Em aberto
                  <strong>{metrics.open}</strong>
                </span>
              </div>
            </div>
            <footer className="request-dashboard-top-contract flex flex-column">
              <div className="flex gap-1">
                <AppIcon name="map-pin"  />
                <span>Maior concentração:</span>
              </div>

              <div className="flex flex-column">
                <strong title={metrics.topContract}>{metrics.topContract}</strong>
                <small>{metrics.topContractCount} no período</small>
              </div>
            </footer>
          </DashboardPanel>

        </section>
        <DashboardPanel className="request-dashboard-table-panel"><header><div><span>Detalhamento</span><h2>Requisições do período</h2></div><small>Inclui decisões finalizadas e solicitações ainda abertas.</small></header><Table data={filteredRecords} columns={columns} loading={loading} rows={10} rowsPerPageOptions={[10, 25, 50, 100]} search emptyTitle={activeFilterCount ? "Nenhuma requisição corresponde aos filtros" : "Nenhuma requisição no período"} emptyDescription="Altere o período ou os filtros para encontrar registros." tableClassName="request-dashboard-table" /></DashboardPanel>
      </>}
    </main>
  );
}
