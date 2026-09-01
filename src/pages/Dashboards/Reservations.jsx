import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { Dialog } from "primereact/dialog";
import { OverlayPanel } from "primereact/overlaypanel";

import { AppIcon } from "../../components/icons/AppIcon";
import { StandardFilterButton } from "../../components/filters/StandardFilterButton";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { DashCard } from "../../components/DashCard";
import { DashboardPanel } from "../../components/DashboardPanel";
import { PageHeader } from "../../components/PageHeader";
import { Placeholder } from "../../components/Placeholder";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import { exportReservationDashboardXlsx } from "../../utils/exportReservationDashboardXlsx";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";

import "./reservations.css";

const EMPTY_LIST = [];
const EXECUTIVE_PAGES = [
  { title: "Uso por departamento", caption: "Departamentos que mais receberam cobertura" },
  { title: "Uso por supervisor", caption: "Supervisores que mais acionaram volantes" },
];

function toApiDate(value) {
  if (!value) return undefined;
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}

function defaultPeriod() {
  // Cada acesso começa como uma fotografia do dia corrente. O filtro padrão
  // continua livre para o usuário consultar um dia ou período anterior.
  const today = new Date();
  return [today, new Date(today)];
}

function labelDepartment(value) {
  return value == null ? "—" : `DPTO. ${value}`;
}

function formatCoverageDate(value) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
}

export function ReservationDashboard() {
  const chartTheme = useChartTheme();
  const { showToast } = useToast();
  const filterPanel = useRef(null);
  const [period, setPeriod] = useState(defaultPeriod);
  const [filters, setFilters] = useState({ departamentos: [], centros: [] });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [executivePage, setExecutivePage] = useState(0);
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    const refresh = () => setReload((value) => value + 1);
    socketio.on("new_request", refresh);
    socketio.on("new_history", refresh);
    window.addEventListener("tmhub:filiais-changed", refresh);
    return () => {
      socketio.off("new_request", refresh);
      socketio.off("new_history", refresh);
      window.removeEventListener("tmhub:filiais-changed", refresh);
    };
  }, []);

  useEffect(() => {
    if (!period?.[1]) return undefined;
    let cancelled = false;
    // A troca do filtro aciona uma nova leitura do histórico consolidado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    connect.get("/dash/reservas", {
      params: {
        inicio: toApiDate(period[0]),
        fim: toApiDate(period[1]),
        departamento: filters.departamentos.join(",") || undefined,
        centro: filters.centros.join(",") || undefined,
      },
    })
      .then(({ data: response }) => {
        if (cancelled) return;
        setData(response);
      })
      .catch((error) => {
        if (!cancelled) showToast("error", "Dashboard de Reservas", error.response?.data || "Não foi possível carregar o histórico de reservas.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, period, reload, showToast]);

  const summary = data?.resumo || {};
  const records = data?.registros || EMPTY_LIST;
  const routes = data?.rotas || EMPTY_LIST;
  const selectedCoverageRecords = useMemo(() => {
    if (!selectedRoute) return EMPTY_LIST;
    return records.filter((record) => (
      record.origem?.departamento === selectedRoute.departamento_origem
      && record.origem?.nome === selectedRoute.origem
      && record.destino?.departamento === selectedRoute.departamento_destino
      && record.destino?.nome === selectedRoute.destino
    ));
  }, [records, selectedRoute]);
  const activeFilterCount = filters.departamentos.length + filters.centros.length;
  const departmentDistribution = useMemo(() => Object.values(routes.reduce((result, route) => {
    const department = route.departamento_destino ?? "Não informado";
    if (!result[department]) result[department] = { department, utilizacoes: 0 };
    result[department].utilizacoes += route.utilizacoes;
    return result;
  }, {})).sort((left, right) => right.utilizacoes - left.utilizacoes).slice(0, 8), [routes]);
  const executiveDepartments = useMemo(() => Object.values(routes.reduce((result, route) => {
    const destination = route.departamento_destino ?? "Não informado";
    if (!result[destination]) result[destination] = { department: destination, utilizacoes: 0, origins: {} };
    result[destination].utilizacoes += route.utilizacoes;
    const origin = route.departamento_origem ?? "Não informado";
    result[destination].origins[origin] = (result[destination].origins[origin] || 0) + route.utilizacoes;
    return result;
  }, {})).map((item) => {
    const [origin = "Não informado", originUses = 0] = Object.entries(item.origins).sort(([, left], [, right]) => right - left)[0] || [];
    return { ...item, origin, originUses };
  }).sort((left, right) => right.utilizacoes - left.utilizacoes).slice(0, 3), [routes]);
  const supervisorRanking = useMemo(() => {
    const supervisors = records.reduce((result, record) => {
      const supervisor = record.supervisor;
      if (!supervisor || supervisor === "Supervisor não identificado") return result;
      if (!result[supervisor]) result[supervisor] = { name: supervisor, utilizacoes: 0, ausentes: {}, departamentos: {} };
      result[supervisor].utilizacoes += 1;
      const absent = record.ausente || "Colaboradora não identificada";
      result[supervisor].ausentes[absent] = (result[supervisor].ausentes[absent] || 0) + 1;
      const department = record.destino?.departamento ?? "Não informado";
      result[supervisor].departamentos[department] = (result[supervisor].departamentos[department] || 0) + 1;
      return result;
    }, {});
    return Object.values(supervisors).map((item) => {
      const [ausente = "Colaboradora não identificada", cobertura = 0] = Object.entries(item.ausentes)
        .sort(([, left], [, right]) => right - left)[0] || [];
      const departamentos = Object.entries(item.departamentos)
        .map(([department, utilizacoes]) => ({ department, utilizacoes }))
        .sort((left, right) => right.utilizacoes - left.utilizacoes);
      return { ...item, ausente, cobertura, departamentos };
    }).sort((left, right) => right.utilizacoes - left.utilizacoes).slice(0, 3);
  }, [records]);
  const chartData = useMemo(() => ({
    labels: departmentDistribution.map((item) => labelDepartment(item.department)),
    datasets: [{
      label: "Utilizações",
      data: departmentDistribution.map((item) => item.utilizacoes),
      backgroundColor: departmentDistribution.map((_, index) => `${chartTheme.palette[index % chartTheme.palette.length]}99`),
      borderColor: departmentDistribution.map((_, index) => chartTheme.palette[index % chartTheme.palette.length]),
      borderWidth: 1.5,
    }],
  }), [chartTheme, departmentDistribution]);
  const chartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { color: chartTheme.text, usePointStyle: true } } },
    scales: { r: { beginAtZero: true, ticks: { display: false, precision: 0 }, grid: { color: chartTheme.grid }, angleLines: { color: chartTheme.grid }, pointLabels: { color: chartTheme.text, font: { size: 11 } } } },
  }), [chartTheme]);
  const clearFilters = () => setFilters({ departamentos: [], centros: [] });
  const activeExecutivePage = EXECUTIVE_PAGES[executivePage];
  const changeExecutivePage = (direction) => setExecutivePage((current) => (
    (current + direction + EXECUTIVE_PAGES.length) % EXECUTIVE_PAGES.length
  ));

  return <main className="reservation-dashboard">
    <PageHeader
      section="Dashboards"
      title="Reservas"
      description="Leitura consolidada das utilizações de volantes a partir do histórico de reposições."
      actions={<div className="reservation-dashboard__actions"><StandardFilterButton panelRef={filterPanel} count={activeFilterCount} /><Button label="Exportar XLSX" icon={<AppIcon name="file-spreadsheet" />} outlined disabled={!records.length} onClick={() => exportReservationDashboardXlsx(records, data.periodo)} /></div>}
    />

    <OverlayPanel ref={filterPanel} className="reservation-dashboard__filter-panel">
      <div className="reservation-dashboard__filter-heading"><div><strong>Filtros do dashboard</strong><span>Recorte por período, departamento e centro de custo de destino.</span></div><Button label="Limpar" icon={<AppIcon name="filter-off" />} text onClick={clearFilters} /></div>
      <StandardFilterFields
        date={{ value: period, onChange: setPeriod }}
        department={{ value: filters.departamentos, options: data?.filtros?.departamentos || EMPTY_LIST, onChange: (value) => setFilters((current) => ({ ...current, departamentos: value || [] })) }}
        center={{ value: filters.centros, options: data?.filtros?.centros || EMPTY_LIST, onChange: (value) => setFilters((current) => ({ ...current, centros: value || [] })) }}
      />
    </OverlayPanel>

    {loading && !data ? <Placeholder loading variant="dashboard" /> : !data ? <Placeholder icon={<AppIcon name="alert-triangle" />} title="Sem dados de reservas" description="Tente atualizar o painel." /> : <>
      <section className="reservation-dashboard__metrics">
        <DashCard icon={<AppIcon name="circle-check" />} title="Utilizações" detail="requisições aprovadas e abertas" value={summary.utilizacoes || 0} tone="success" />
        <DashCard icon={<AppIcon name="users" />} title="Volantes mobilizadas" detail="pessoas distintas no período" value={summary.volantes_mobilizadas || 0} tone="info" />
        <DashCard icon={<AppIcon name="arrows-exchange" />} title="Cessões entre DPTOS." detail="deslocamentos entre áreas" value={summary.cessoes_entre_departamentos || 0} tone="primary" />
        <DashCard icon={<AppIcon name="calendar-x" />} title="Ausências de volantes" detail="histórico de indisponibilidade" value={summary.ausencias_volantes || 0} tone="danger" />
        <DashCard icon={<AppIcon name="map-pin" />} title="Rotas acionadas" detail="origens e destinos distintos" value={summary.rotas_acionadas || 0} tone="warning" />
      </section>

      <section className="reservation-dashboard__analysis">
        <DashboardPanel className="reservation-dashboard__panel reservation-dashboard__chart"><header><div><span>Distribuição das coberturas</span><h2>Departamentos mais atendidos</h2></div><small>Participação de cada departamento de destino nas utilizações do período.</small></header><div>{departmentDistribution.length ? <Chart type="polarArea" data={chartData} options={chartOptions} style={{ width: "100%", height: "100%" }} /> : <Placeholder variant="chart" title="Nenhuma utilização encontrada" description="As alocações aprovadas ou ainda abertas aparecerão aqui." />}</div></DashboardPanel>
        <DashboardPanel className="reservation-dashboard__panel reservation-dashboard__insight"><header><div><span>Leitura executiva</span><h2>{activeExecutivePage.title}</h2></div></header><div className={`reservation-executive-page ${executivePage === 0 ? "is-departments" : ""}`} key={executivePage}><span>{activeExecutivePage.caption}</span>{executivePage === 0 && (executiveDepartments.length ? <div className="reservation-executive-ranking">{executiveDepartments.map((item) => <article key={item.department}><div><strong>{labelDepartment(item.department)}</strong><b>{item.utilizacoes}</b></div><p>Maior origem: <strong>{labelDepartment(item.origin)}</strong> · {item.originUses} utilização(ões)</p></article>)}</div> : <p>Não houve utilização de volante no recorte selecionado.</p>)}{executivePage === 1 && (supervisorRanking.length ? <div className="reservation-executive-ranking">{supervisorRanking.map((item) => <article key={item.name}><div><strong>{item.name}</strong><b>{item.utilizacoes}</b></div><p>Cobriu mais: <strong>{item.ausente}</strong> · {item.cobertura} vez(es)</p><section className="reservation-supervisor-departments"><span>Departamentos atendidos</span><div>{item.departamentos.map((department) => <small key={department.department}>{labelDepartment(department.department)} <em aria-hidden="true">|</em> <b>{department.utilizacoes}</b></small>)}</div></section></article>)}</div> : <p>O histórico deste período não possui supervisor identificado.</p>)}</div><div className="reservation-executive-pagination"><Button aria-label="Insight anterior" icon={<AppIcon name="chevron-left" />} text rounded onClick={() => changeExecutivePage(-1)} /><div className="reservation-executive-dots" aria-label={`Página ${executivePage + 1} de ${EXECUTIVE_PAGES.length}`}>{EXECUTIVE_PAGES.map((item, index) => <i key={item.title} className={index === executivePage ? "is-active" : ""} />)}</div><Button aria-label="Próximo insight" icon={<AppIcon name="chevron-right" />} text rounded onClick={() => changeExecutivePage(1)} /></div></DashboardPanel>
      </section>

      <DashboardPanel className="reservation-dashboard__panel reservation-dashboard__flow-panel"><header><div><span>Mapa de alocação</span><h2>Impacto por destino</h2></div><small>Uso de volantes da origem em relação à capacidade cadastrada no departamento.</small></header>{routes.length ? <div className="reservation-flow-grid">{routes.slice(0, 12).map((route) => <article className="reservation-impact-card is-clickable" key={`${route.departamento_origem}-${route.origem}-${route.departamento_destino}-${route.destino}`} role="button" tabIndex={0} aria-label={`Ver detalhes das coberturas para ${labelDepartment(route.departamento_destino)}`} onClick={() => setSelectedRoute(route)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedRoute(route); } }}><header><span>Origem: <b>{labelDepartment(route.departamento_origem)}</b></span><strong>{labelDepartment(route.departamento_destino)}</strong></header><p>{route.destino}</p><div className="reservation-impact-card__bar"><span><i style={{ width: `${route.total_reservas_origem ? Math.min(100, Math.round((route.volantes_utilizadas / route.total_reservas_origem) * 100)) : 0}%` }} /></span><b>{route.volantes_utilizadas} / {route.total_reservas_origem || "—"}</b></div><small className="reservation-impact-card__caption">Clique para ver as coberturas desta rota</small></article>)}</div> : <Placeholder variant="content" title="Nenhuma rota de cobertura" description="As movimentações aparecerão quando houver uma volante vinculada à requisição." />}</DashboardPanel>
      <Dialog visible={Boolean(selectedRoute)} modal draggable={false} showHeader={false} className="reservation-coverage-dialog" onHide={() => setSelectedRoute(null)}>{selectedRoute && <div className="reservation-coverage-details"><header><span>Detalhamento de cobertura</span><h2>{labelDepartment(selectedRoute.departamento_origem)} <AppIcon name="arrow-right" /> {labelDepartment(selectedRoute.departamento_destino)}</h2><p>{selectedRoute.destino}</p></header><div className="reservation-coverage-details__list">{selectedCoverageRecords.map((record) => <article key={record.id}><header><div><span>Colaboradora ausente</span><strong>{record.ausente}</strong></div><b className={record.status === "Aprovada" ? "is-approved" : "is-open"}>{record.status}</b></header><dl><div><dt><AppIcon name="user" /> Solicitante</dt><dd>{record.supervisor}</dd></div><div><dt><AppIcon name="calendar" /> Data</dt><dd>{formatCoverageDate(record.data)}</dd></div><div><dt><AppIcon name="users" /> Volante</dt><dd>{record.reserva} {record.matricula ? `· ${record.matricula}` : ""}</dd></div><div><dt><AppIcon name="building" /> Origem</dt><dd>{labelDepartment(record.origem?.departamento)} · {record.origem?.nome}</dd></div><div><dt><AppIcon name="map-pin" /> Destino</dt><dd>{labelDepartment(record.destino?.departamento)} · {record.destino?.nome}</dd></div><div><dt><AppIcon name="alert-circle" /> Motivo da ausência</dt><dd>{record.motivo}</dd></div></dl>{record.observacao ? <p className="reservation-coverage-details__note">{record.observacao}</p> : null}</article>)}</div>{!selectedCoverageRecords.length ? <Placeholder variant="content" title="Detalhes não encontrados" description="Esta rota não possui mais registros no filtro atual." /> : null}<footer><Button label="Sair" icon={<AppIcon name="x" />} outlined onClick={() => setSelectedRoute(null)} /></footer></div>}</Dialog>
    </>}
  </main>;
}
