import "./ql.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";

import { PageHeader } from "../../components/PageHeader";
import { Table } from "../../components/tables/Table";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";

const initialFilters = () => ({ departamentos: [] });

function SummaryCard({ icon, label, value, detail, tone = "neutral" }) {
  return <article className={`ql-summary-card tm-dashboard-card is-${tone}`}>
    <span className="ql-summary-card__icon"><i className={icon} /></span>
    <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
  </article>;
}

const statusSeverity = (status) => ({
  COMPLETO: "success",
  ACIMA: "info",
  DEFICIT: "danger",
  SEM_META: "secondary",
}[status] || "secondary");

const statusLabel = (status) => ({
  COMPLETO: "NO QUADRO",
  ACIMA: "ACIMA DA META",
  DEFICIT: "DÉFICIT",
  SEM_META: "SEM META",
}[status] || "—");

export function QLDashboard() {
  const chartTheme = useChartTheme();
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [refresh, setRefresh] = useState(0);
  const filterPanel = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1);
    socketio.on("ql_update", reload);
    window.addEventListener("tmhub:filiais-changed", reload);
    return () => {
      socketio.off("ql_update", reload);
      window.removeEventListener("tmhub:filiais-changed", reload);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    connect.get("/dash/ql", {
      params: filters.departamentos.length
        ? { departamento: filters.departamentos.join(",") }
        : undefined,
    })
      .then(({ data: response }) => {
        if (!cancelled) setData(response);
      })
      .catch((error) => {
        if (!cancelled) showToast(
          "error",
          "Dashboard de QL",
          error.response?.data || "Não foi possível carregar o quadro de lotação.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters, refresh, setLoading, showToast]);

  const summary = data?.resumo || {};
  const options = data?.filtros?.departamentos || [];
  const evolution = data?.evolucao || [];
  const chartData = useMemo(() => ({
    labels: evolution.map((row) => new Date(`${row.data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })),
    datasets: [
      {
        label: "Colaboradores trabalhando",
        data: evolution.map((row) => row.colaboradores_ativos),
        borderColor: chartTheme.success,
        backgroundColor: `${chartTheme.success}33`,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
      {
        label: "Meta de QL",
        data: evolution.map((row) => row.capacidade_esperada),
        borderColor: chartTheme.warning,
        backgroundColor: `${chartTheme.warning}18`,
        fill: false,
        tension: 0.35,
        borderDash: [6, 5],
        pointRadius: 2,
      },
    ],
  }), [chartTheme, evolution]);

  const departmentColumns = [
    { header: "Departamento", body: (row) => <strong>DPTO. {row.departamento}</strong>, sortable: true },
    { header: "Colaboradores", field: "colaboradores_ativos", sortable: true },
    {
      header: "Meta de QL",
      body: (row) => row.capacidade_esperada ?? <span className="ql-muted">Não definida</span>,
      sortable: true,
    },
    {
      header: "Saldo",
      body: (row) => row.saldo == null
        ? <span className="ql-muted">—</span>
        : <span className={row.saldo < 0 ? "ql-negative" : "ql-positive"}>{row.saldo > 0 ? "+" : ""}{row.saldo}</span>,
      sortable: true,
    },
    { header: "Centros de custo", field: "centros_quantidade", sortable: true },
    {
      header: "Situação",
      body: (row) => <Tag value={statusLabel(row.situacao)} severity={statusSeverity(row.situacao)} />,
    },
  ];

  const filterCount = filters.departamentos.length;
  return <main className="ql-dashboard">
    <PageHeader
      section="Dashboards"
      title="Dashboard de QL"
      description="Acompanhe o quadro de lotação por departamento e a evolução diária do efetivo."
      actions={<>
        <Button icon="pi pi-refresh" label="Atualizar" outlined onClick={() => setRefresh((value) => value + 1)} />
        <Button
          icon="pi pi-filter-fill"
          label={filterCount ? `Filtros (${filterCount})` : "Filtros"}
          onClick={(event) => filterPanel.current?.toggle(event)}
        />
      </>}
    />

    <section className="ql-summary-grid">
      <SummaryCard icon="pi pi-users" label="Trabalhando" value={summary.colaboradores_ativos || 0} detail="quadro atual no recorte" tone="success" />
      <SummaryCard icon="pi pi-bullseye" label="Meta de QL" value={summary.capacidade_esperada || 0} detail={`${summary.departamentos_sem_meta || 0} departamento(s) sem meta`} tone="info" />
      <SummaryCard icon="pi pi-exclamation-circle" label="Déficit" value={summary.deficit || 0} detail="pessoas abaixo da meta" tone="danger" />
      <SummaryCard icon="pi pi-arrow-up-right" label="Excedente" value={summary.excedente || 0} detail={`${summary.departamentos || 0} departamento(s) no recorte`} tone="warning" />
    </section>

    <section className="ql-dashboard-grid">
      <article className="ql-panel tm-dashboard-panel ql-chart-panel">
        <header><div><span>Histórico diário</span><h2>Evolução do quadro</h2></div><small>Hoje é atualizado em tempo real; os dias anteriores ficam congelados.</small></header>
        <div className="ql-chart">
          {evolution.length ? <Chart type="line" data={chartData} options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: chartTheme.text, usePointStyle: true } } },
            scales: {
              x: { grid: { color: chartTheme.grid }, ticks: { color: chartTheme.text } },
              y: { beginAtZero: true, grid: { color: chartTheme.grid }, ticks: { color: chartTheme.text, precision: 0 } },
            },
          }} /> : <div className="ql-empty"><i className="pi pi-chart-line" />O histórico diário começa a ser salvo a partir de hoje.</div>}
        </div>
      </article>
      <article className="ql-panel tm-dashboard-panel ql-insight-panel">
        <span>Leitura do dia</span>
        <h2>{summary.deficit ? "Há departamentos abaixo da meta" : "Quadro dentro do planejado"}</h2>
        <p>O painel considera somente colaboradores com situação <strong>trabalhando</strong>, respeitando a filial global selecionada.</p>
        <dl><div><dt>Filiais</dt><dd>{(data?.filiais || []).map((branch) => branch.nome).join(", ") || "—"}</dd></div><div><dt>Atualizado</dt><dd>{data?.atualizado_em ? new Date(data.atualizado_em).toLocaleString("pt-BR") : "—"}</dd></div></dl>
      </article>
    </section>

    <section className="ql-panel tm-dashboard-panel ql-table-panel">
      <header><div><span>Detalhamento</span><h2>Quadro por departamento</h2></div><small>Meta e efetivo atual por departamento ativo.</small></header>
      <Table data={data?.departamentos || []} columns={departmentColumns} search rows={10} rowsPerPageOptions={[10, 25, 50]} />
    </section>

    <OverlayPanel ref={filterPanel} className="dashboard-filter-panel">
      <div className="dashboard-filter-title">
        <div><strong>Filtrar dashboard</strong><span>As métricas, evolução e tabela respeitam o recorte selecionado.</span></div>
        <Button icon="pi pi-filter-slash" label="Limpar filtros" text severity="secondary" onClick={() => setFilters(initialFilters())} />
      </div>
      <div className="dashboard-filter-grid">
        <label className="is-wide"><span>Departamento</span><MultiSelect value={filters.departamentos} options={options} onChange={(event) => setFilters({ departamentos: event.value || [] })} placeholder="Todos os departamentos" display="chip" filter showClear className="w-full" maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
      </div>
    </OverlayPanel>
  </main>;
}
