import { AppIcon } from "../../components/icons/AppIcon";
import { StandardFilterButton } from "../../components/filters/StandardFilterButton";
import { MultiSelect } from "primereact/multiselect";
import { Calendar } from "primereact/calendar";
import "./ql.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { OverlayPanel } from "primereact/overlaypanel";

import { PageHeader } from "../../components/PageHeader";
import { Table } from "../../components/tables/Table";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";

const currentMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const initialFilters = () => ({ departamentos: [], mes: currentMonth() });

function SummaryCard({ icon, label, value, detail, tone = "neutral" }) {
  return <article className={`ql-summary-card tm-dashboard-card is-${tone}`}>
    <span className="ql-summary-card__icon">{typeof icon === "string" ? <AppIcon name={icon} /> : icon}</span>
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
  SEM_DADOS: "SEM DADOS",
}[status] || "—");

function DailyMetaReal({ meta, real, status }) {
  return <span className={`ql-daily-value is-${statusSeverity(status)}`}>
    <strong>{meta ?? "—"}</strong>
    <span className="ql-daily-value__separator">x</span>
    <b>{real ?? "—"}</b>
  </span>;
}

export function QLDashboard() {
  const chartTheme = useChartTheme();
  const [data, setData] = useState(null);
  const [dailyData, setDailyData] = useState(null);
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
    const params = {
      departamento_empresa: filters.departamentos.join(",") || undefined,
    };
    const month = `${filters.mes.getFullYear()}-${String(filters.mes.getMonth() + 1).padStart(2, "0")}`;
    Promise.all([
      connect.get("/dash/ql", { params }),
      connect.get("/dash/ql/diario", { params: { ...params, mes: month } }),
    ])
      .then(([overview, daily]) => {
        if (!cancelled) {
          setData(overview.data);
          setDailyData(daily.data);
        }
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
  const evolution = useMemo(() => data?.evolucao || [], [data?.evolucao]);
  const qlDepartmentOptions = useMemo(() => {
    const values = [
      ...(data?.filtros?.departamentos || []),
      ...(dailyData?.filtros?.departamentos || []),
    ];
    return [...new Map(values.map((option) => [String(option.value), option])).values()];
  }, [data?.filtros?.departamentos, dailyData?.filtros?.departamentos]);
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

  const dailyRows = dailyData?.departamentos || [];
  const dailyColumns = useMemo(() => [
    {
      header: "DPTO",
      field: "departamento",
      body: (row) => <span><strong>DPTO. {row.departamento}</strong><small className="ql-company-label">{row.empresa_nome}</small></span>,
      sortable: true,
      style: { minWidth: "8rem" },
    },
    ...(dailyData?.dias || []).map((day) => ({
      header: `Dia ${new Date(`${day}T12:00:00`).getDate()}`,
      field: day,
      body: (row) => {
        const value = row.dias?.find((item) => item.data === day);
        return <DailyMetaReal
          meta={value?.capacidade_esperada}
          real={value?.colaboradores_ativos}
          status={value?.situacao}
        />;
      },
      style: { minWidth: "8.25rem" },
    })),
    {
      header: "Média final",
      field: "percentual",
      body: (row) => <strong className={`ql-daily-average is-${statusSeverity(row.situacao_mes)}`}>
        {row.percentual == null
          ? statusLabel(row.situacao_mes)
          : `${Number(row.percentual).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
      </strong>,
      sortable: true,
      style: { minWidth: "9rem" },
    },
  ], [dailyData?.dias]);

  // Formata o departamento para exibição (apenas número, sem filial)
  const departmentOptions = useMemo(() => {
    if (!qlDepartmentOptions?.length) return [];
    return qlDepartmentOptions.map(option => {
      // O valor é no formato "empresa_id:departamento"
      const [empresaId, deptNum] = String(option.value || "").split(":");
      return {
        label: deptNum || option.label,
        value: option.value,
      };
    });
  }, [qlDepartmentOptions]);

  const filterCount = filters.departamentos.length;
  return <main className="ql-dashboard p-4">
    <PageHeader
      section="Dashboards"
      title="Dashboard de QL"
      description="Acompanhe o quadro de lotação por departamento e a evolução diária do efetivo."
      actions={<>
        <StandardFilterButton panelRef={filterPanel} count={filterCount} />
      </>}
    />

    <section className="ql-summary-grid">
      <SummaryCard icon={<AppIcon name="users" />} label="Trabalhando" value={summary.colaboradores_ativos || 0} detail="quadro atual no recorte" tone="success" />
      <SummaryCard icon={<AppIcon name="target" />} label="Meta de QL" value={summary.capacidade_esperada || 0} detail={`${summary.departamentos_sem_meta || 0} departamento(s) sem meta`} tone="info" />
      <SummaryCard icon={<AppIcon name="alert-circle" />} label="Déficit" value={summary.deficit || 0} detail="pessoas abaixo da meta" tone="danger" />
      <SummaryCard icon={<AppIcon name="arrow-up-right" />} label="Excedente" value={summary.excedente || 0} detail={`${summary.departamentos || 0} departamento(s) no recorte`} tone="warning" />
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
          }} /> : <div className="ql-empty"><AppIcon name="chart-line"  />O histórico diário começa a ser salvo a partir de hoje.</div>}
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
      <header><div><span>Detalhamento diário</span><h2>Meta x real por departamento</h2></div><small>O consolidado usa somente os dias já registrados no mês selecionado.</small></header>
      <Table
        data={dailyRows}
        columns={dailyColumns}
        search
        rows={10}
        rowsPerPageOptions={[10, 25, 50]}
        tableClassName="ql-daily-table"
        tableStyle={{ minWidth: `${Math.max((dailyColumns.length * 135) + 150, 900)}px` }}
      />
    </section>

    <OverlayPanel ref={filterPanel} className="dashboard-filter-panel ql-filter-panel">
      <div className="dashboard-filter-title">
        <div><strong>Filtrar dashboard</strong><span>As métricas, evolução e tabela respeitam o recorte selecionado.</span></div>
        <Button icon={<AppIcon name="filter-off" />} label="Limpar filtros" text severity="secondary" onClick={() => setFilters(initialFilters())} />
      </div>
      <div className="standard-filter-fields">
        <div className="standard-filter-fields__toolbar"><strong>Filtros</strong></div>
        <label className="is-wide"><span>DATA</span>
          <Calendar 
            value={filters.mes} 
            onChange={(event) => setFilters((current) => ({ ...current, mes: event.value || currentMonth() }))} 
            selectionMode="single" 
            view="month" 
            dateFormat="mm/yy" 
            readOnlyInput 
            showIcon 
            showButtonBar 
            placeholder="Selecione o mês" 
          />
        </label>
        <label><span>DPTO</span>
          <MultiSelect 
            value={filters.departamentos || []} 
            options={departmentOptions} 
            optionLabel="label" 
            optionValue="value" 
            onChange={(event) => setFilters((current) => ({ ...current, departamentos: event.value || [] }))} 
            placeholder="Todos os departamentos" 
            display="comma" 
            filter 
            showClear 
            maxSelectedLabels={2} 
            selectedItemsLabel="{0} selecionados" 
          />
        </label>
      </div>
    </OverlayPanel>
  </main>;
}
