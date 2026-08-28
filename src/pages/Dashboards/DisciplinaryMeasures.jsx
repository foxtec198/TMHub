import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Skeleton } from "primereact/skeleton";
import { Tag } from "primereact/tag";

import { PageHeader } from "../../components/PageHeader";
import { Placeholder } from "../../components/Placeholder";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import connect from "../../utils/request";

import "./DisciplinaryMeasures.css";


const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const initialPeriod = () => {
  const today = new Date();
  return [new Date(today.getFullYear(), 0, 1), today];
};

const defaultFilters = () => ({
  period: initialPeriod(),
  department: [],
  costCenter: [],
  supervisor: [],
  collaborator: [],
  type: [],
  reason: [],
  origin: [],
});

function dateParam(value) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthLabel(value) {
  const [year, month] = String(value).split("-").map(Number);
  return `${MONTHS[month - 1]}/${String(year).slice(-2)}`;
}

function formatPeriod(period) {
  if (!period?.[0] || !period?.[1]) return "Período incompleto";
  return [
    period[0].toLocaleDateString("pt-BR"),
    period[1].toLocaleDateString("pt-BR"),
  ].join(" — ");
}

function errorMessage(error) {
  const response = error.response?.data;
  if (typeof response === "string") return response;
  return response?.message || "Não foi possível carregar os indicadores.";
}

function EmptyChart({ text }) {
  return <Placeholder variant="chart" icon={<AppIcon name="chart-bar" />} title={text} />;
}

function SummaryCard({ icon, label, value, detail, tone = "neutral" }) {
  return (
    <article className={`disciplinary-dashboard-card tm-dashboard-card is-${tone}`}>
      <span className="disciplinary-dashboard-card__icon">
        {typeof icon === "string" ? <AppIcon name={icon} /> : icon}
      </span>
      <span>
        <small>{label}</small>
        <strong>{Number(value || 0).toLocaleString("pt-BR")}</strong>
        <em>{detail}</em>
      </span>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="disciplinary-dashboard-loading" aria-busy="true">
      <div className="disciplinary-dashboard-summary">
        {Array.from({ length: 5 }, (_, index) => (
          <article className="disciplinary-dashboard-card tm-dashboard-card" key={index}>
            <Skeleton shape="circle" size="2.7rem" />
            <span>
              <Skeleton width="65%" height=".8rem" />
              <Skeleton width="45%" height="1.8rem" className="mt-2" />
              <Skeleton width="80%" height=".65rem" className="mt-2" />
            </span>
          </article>
        ))}
      </div>
      <div className="disciplinary-dashboard-loading-grid">
        <Skeleton height="23rem" borderRadius="16px" />
        <Skeleton height="23rem" borderRadius="16px" />
        <Skeleton height="20rem" borderRadius="16px" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="disciplinary-dashboard-error" role="alert">
      <AppIcon name="alert-triangle"  />
      <div>
        <strong>Não foi possível abrir o dashboard</strong>
        <span>{message}</span>
      </div>
      <Button
        type="button"
        icon={<AppIcon name="refresh" />}
        label="Tentar novamente"
        outlined
        onClick={onRetry}
      />
    </div>
  );
}

export function DisciplinaryMeasuresDashboard() {
  const chartTheme = useChartTheme();
  const chartThemeKey = `${chartTheme.theme}-${chartTheme.mode}`;
  const chartColors = useMemo(() => (
    chartTheme.theme === "pride"
      ? [chartTheme.palette[1], chartTheme.palette[4], chartTheme.palette[5]]
      : [chartTheme.palette[0], chartTheme.palette[1], chartTheme.palette[2]]
  ), [chartTheme]);
  const absenceColors = useMemo(() => {
    if (chartTheme.theme === "pride") {
      // Laranja x azul: extremos bem separados da paleta Orgulho.
      return [chartTheme.palette[1], chartTheme.palette[4]];
    }

    if (["cyberpunk", "christmas"].includes(chartTheme.theme)) {
      return [chartTheme.palette[1], chartTheme.palette[0]];
    }

    // No TMHub, vermelho semântico x verde institucional.
    return [chartTheme.palette[3], chartTheme.palette[0]];
  }, [chartTheme]);
  const filterPanel = useRef(null);
  const { showToast } = useToast();
  const [filters, setFilters] = useState(defaultFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const periodComplete = Boolean(filters.period?.[0] && filters.period?.[1]);

  useEffect(() => {
    if (!periodComplete) return undefined;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: response } = await connect.get(
          "/dash/medidas-disciplinares",
          {
            signal: controller.signal,
            params: {
              inicio: dateParam(filters.period[0]),
              fim: dateParam(filters.period[1]),
              departamento: filters.department.join(",") || undefined,
              centro_custo: filters.costCenter.join(",") || undefined,
              supervisor: filters.supervisor.join(",") || undefined,
              colaborador: filters.collaborator.join(",") || undefined,
              tipo: filters.type.join(",") || undefined,
              motivo: filters.reason.join(",") || undefined,
              origem: filters.origin.join(",") || undefined,
            },
          },
        );
        if (!controller.signal.aborted) {
          setData(response);
        }
      } catch (requestError) {
        if (controller.signal.aborted || requestError.code === "ERR_CANCELED") {
          return;
        }
        const message = errorMessage(requestError);
        setError(message);
        showToast("error", "Dashboard de Medidas Disciplinares", message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [filters, periodComplete, refresh, showToast]);

  const indicators = data?.indicadores || {};
  const options = data?.filtros || {};
  const monthly = useMemo(() => data?.mensal || [], [data]);
  const reasons = (data?.motivos || []).slice(0, 8);
  const departments = (data?.departamentos || []).slice(0, 10);
  const absenceComparisonMeta = data?.comparativo_faltas || {};
  const absenceComparison = useMemo(
    () => (data?.comparativo_faltas?.itens || []).slice(0, 12),
    [data],
  );
  const canViewAbsenceComparison = data?.comparativo_faltas?.autorizado !== false;
  const hasMonthlyData = monthly.some((item) => Number(item.total || 0) > 0);
  const activeFilterCount = [
    "department", "costCenter", "supervisor", "collaborator",
    "type", "reason", "origin",
  ].filter((key) => filters[key]?.length).length;

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value || [] }));
  };

  const monthlyChart = useMemo(() => ({
    labels: monthly.map((item) => monthLabel(item.mes)),
    datasets: [
      {
        label: "Advertências",
        data: monthly.map((item) => item.advertencias),
        backgroundColor: chartColors[0],
        hoverBackgroundColor: chartColors[0],
        borderRadius: 6,
        maxBarThickness: 38,
        categoryPercentage: .72,
        barPercentage: .86,
        yAxisID: "warnings",
        order: 2,
      },
      {
        type: "line",
        label: "Suspensões",
        data: monthly.map((item) => item.suspensoes || 0),
        borderColor: chartColors[2],
        backgroundColor: chartColors[2],
        borderWidth: 3,
        pointRadius: 4,
        pointBorderWidth: 0,
        pointBackgroundColor: chartColors[2],
        pointHoverRadius: 7,
        pointHoverBackgroundColor: chartColors[2],
        pointHoverBorderColor: chartColors[2],
        tension: .3,
        fill: false,
        yAxisID: "suspensions",
        order: 1,
      },
    ],
  }), [monthly, chartColors]);

  const reasonChart = useMemo(() => ({
    labels: reasons.map((item) => item.label),
    datasets: [{
      label: "Medidas",
      data: reasons.map((item) => item.total),
      backgroundColor: chartTheme.theme === "pride"
        ? reasons.map(
          (_, index) => chartTheme.palette[index % chartTheme.palette.length],
        )
        : chartColors[0],
      borderRadius: 6,
      maxBarThickness: 24,
    }],
  }), [reasons, chartColors, chartTheme]);

  const absenceComparisonChart = useMemo(() => ({
    labels: absenceComparison.map((item) => item.label),
    datasets: [
      {
        label: "Faltas injustificadas",
        data: absenceComparison.map((item) => item.faltas_injustificadas),
        backgroundColor: absenceColors[0],
        hoverBackgroundColor: absenceColors[0],
        borderRadius: 5,
        maxBarThickness: 22,
      },
      {
        label: "Advertências aplicadas",
        data: absenceComparison.map((item) => item.advertencias),
        backgroundColor: absenceColors[1],
        hoverBackgroundColor: absenceColors[1],
        borderRadius: 5,
        maxBarThickness: 22,
      },
    ],
  }), [absenceComparison, absenceColors]);

  const monthlyOptions = useMemo(() => ({
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: true },
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: { usePointStyle: true, boxWidth: 8, color: chartTheme.text },
      },
      tooltip: {
        backgroundColor: chartTheme.tooltipBackground,
        titleColor: chartTheme.text,
        bodyColor: chartTheme.text,
        borderColor: chartTheme.border,
        borderWidth: 1,
        filter: (context) => context.dataset.type === "line",
        callbacks: {
          title: (items) => items[0]?.label || "",
          label: (context) => {
            const item = monthly[context.dataIndex] || {};
            return [
              `Advertências: ${item.advertencias || 0}`,
              `Suspensões: ${item.suspensoes || 0}`,
              `Total de medidas: ${item.total || 0}`,
              `Dias suspensos: ${item.dias_suspensao || 0}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: chartTheme.text },
      },
      warnings: {
        beginAtZero: true,
        grid: { color: chartTheme.grid },
        border: { display: false },
        ticks: { precision: 0, color: chartTheme.text },
        title: { display: true, text: "Advertências", color: chartTheme.text },
      },
      suspensions: {
        position: "right",
        beginAtZero: true,
        grid: { display: false },
        border: { display: false },
        ticks: { precision: 0, color: chartTheme.text },
        title: { display: true, text: "Suspensões", color: chartTheme.text },
      },
    },
  }), [chartTheme, monthly]);

  const horizontalOptions = useMemo(() => ({
    maintainAspectRatio: false,
    indexAxis: "y",
    events: [],
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: chartTheme.grid },
        border: { display: false },
        ticks: { precision: 0, color: chartTheme.text },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: chartTheme.text, font: { weight: "600" } },
      },
    },
  }), [chartTheme]);

  const absenceComparisonOptions = useMemo(() => ({
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: true },
    plugins: {
      tooltip: {
        enabled: true,
        backgroundColor: chartTheme.tooltipBackground,
        titleColor: chartTheme.text,
        bodyColor: chartTheme.text,
        borderColor: chartTheme.border,
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        callbacks: {
          title: (items) => items[0]?.label || "",
          label: (context) => (
            `${context.dataset.label}: ${Number(context.parsed.y || 0).toLocaleString("pt-BR")}`
          ),
          afterBody: (items) => {
            const item = absenceComparison[items[0]?.dataIndex];
            if (!item) return [];

            const difference = Number(item.faltas_injustificadas || 0)
              - Number(item.advertencias || 0);
            const summary = [
              `Diferença: ${Math.abs(difference).toLocaleString("pt-BR")} ${difference >= 0 ? "faltas acima" : "advertências acima"}`,
            ];

            if (
              absenceComparisonMeta.nivel === "centro_custo"
              && item.supervisor
            ) {
              summary.push(`Supervisor: ${item.supervisor}`);
            }

            return summary;
          },
        },
      },
      legend: {
        position: "top",
        align: "end",
        labels: { usePointStyle: true, boxWidth: 8, color: chartTheme.text },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          autoSkip: false,
          minRotation: 45,
          maxRotation: 45,
          color: chartTheme.text,
          font: { size: 10, weight: "600" },
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: chartTheme.grid },
        border: { display: false },
        ticks: { precision: 0, color: chartTheme.text },
        title: { display: true, text: "Ocorrências", color: chartTheme.text },
      },
    },
  }), [absenceComparison, absenceComparisonMeta.nivel, chartTheme]);

  const suspensionPercentage = indicators.total
    ? Math.round(Number(indicators.suspensoes || 0) * 100 / indicators.total)
    : 0;
  const warningPercentage = indicators.total
    ? Math.round(Number(indicators.advertencias || 0) * 100 / indicators.total)
    : 0;
  const mainReason = reasons[0];
  const leadingDepartment = departments[0];
  const busiestMonth = useMemo(() => [...monthly]
    .sort((first, second) => (
      Number(second.total || 0) - Number(first.total || 0)
    ))[0], [monthly]);
  const summary = [
    { icon: appIcon("file-pencil"), label: "Total de medidas", value: indicators.total, detail: "no período selecionado", tone: "primary" },
    { icon: appIcon("info-circle"), label: "Advertências", value: indicators.advertencias, detail: "medidas registradas", tone: "info" },
    { icon: appIcon("pause"), label: "Suspensões", value: indicators.suspensoes, detail: `${suspensionPercentage}% do total`, tone: "warning" },
    { icon: appIcon("users"), label: "Colaboradores", value: indicators.colaboradores, detail: "pessoas distintas", tone: "success" },
    { icon: appIcon("calendar-time"), label: "Dias de suspensão", value: indicators.dias_suspensao, detail: "soma dos dias informados", tone: "danger" },
  ];

  return (
    <section className="disciplinary-dashboard">
      <PageHeader
        section="Dashboards"
        title="Medidas Disciplinares"
        description="Acompanhe advertências e suspensões por período, equipe, motivo e estrutura organizacional."
        actions={(
          <>
            <div className="disciplinary-dashboard-period">
              <AppIcon name="calendar"  />
              <span>{formatPeriod(filters.period)}</span>
            </div>
            <Button
              type="button"
              icon={<AppIcon name="filter-filled" />}
              label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"}
              onClick={(event) => filterPanel.current?.toggle(event)}
            />
            <Button
              type="button"
              icon={<AppIcon name="refresh" />}
              label="Atualizar"
              outlined
              loading={loading && Boolean(data)}
              onClick={() => setRefresh((value) => value + 1)}
            />
          </>
        )}
      />

      {!periodComplete && (
        <div className="disciplinary-dashboard-notice">
          <AppIcon name="calendar-x"  />
          <span>Selecione a data inicial e a data final.</span>
        </div>
      )}
      {periodComplete && loading && !data && <LoadingState />}
      {periodComplete && error && !data && !loading && (
        <ErrorState
          message={error}
          onRetry={() => setRefresh((value) => value + 1)}
        />
      )}

      {periodComplete && data && (
        <>
          {error && (
            <div className="disciplinary-dashboard-inline-error" role="alert">
              <AppIcon name="alert-circle"  />
              <span>{error}</span>
              <Button
                type="button"
                icon={<AppIcon name="refresh" />}
                label="Tentar novamente"
                text
                onClick={() => setRefresh((value) => value + 1)}
              />
            </div>
          )}

          <div className="disciplinary-dashboard-summary">
            {summary.map((item) => <SummaryCard key={item.label} {...item} />)}
          </div>

          <div className="disciplinary-dashboard-grid">
            <article className="disciplinary-dashboard-panel tm-dashboard-panel is-monthly">
              <header>
                <div>
                  <span>Evolução mensal</span>
                  <h2>Advertências x suspensões</h2>
                </div>
                <Tag
                  value={`${indicators.suspensoes || 0} suspensões`}
                  severity="info"
                  rounded
                />
              </header>
              <div className="disciplinary-dashboard-chart">
                {hasMonthlyData
                  ? (
                    <Chart
                      key={`monthly-${chartThemeKey}`}
                      type="bar"
                      data={monthlyChart}
                      options={monthlyOptions}
                    />
                  )
                  : <EmptyChart text="Nenhuma medida encontrada no período." />}
              </div>
            </article>

            <article className="disciplinary-dashboard-panel tm-dashboard-panel disciplinary-dashboard-insight">
              <span>Leitura executiva</span>
              <h2>
                {!indicators.total
                  ? "Sem medidas no período"
                  : suspensionPercentage >= 25
                    ? `Suspensões representam ${suspensionPercentage}% das medidas`
                    : `Advertências concentram ${warningPercentage}% das medidas`}
              </h2>
              <p>
                A leitura considera o período, as filiais selecionadas no menu
                principal e todos os filtros ativos deste dashboard.
              </p>

              <div className="disciplinary-dashboard-insight-item">
                <span>
                  <small>Motivo predominante</small>
                  <strong title={mainReason?.label}>
                    {mainReason?.label || "—"}
                  </strong>
                </span>
                <em>
                  {mainReason
                    ? `${mainReason.total} · ${mainReason.percentual}%`
                    : "Sem dados"}
                </em>
              </div>

              <div className="disciplinary-dashboard-insight-item">
                <span>
                  <small>Mês de maior volume</small>
                  <strong>
                    {busiestMonth?.total ? monthLabel(busiestMonth.mes) : "—"}
                  </strong>
                </span>
                <em>
                  {busiestMonth?.total
                    ? `${busiestMonth.total} medidas`
                    : "Sem dados"}
                </em>
              </div>

              <div className="disciplinary-dashboard-insight-item">
                <span>
                  <small>Departamento com maior volume</small>
                  <strong title={leadingDepartment?.label}>
                    {leadingDepartment?.label || "—"}
                  </strong>
                </span>
                <em>
                  {leadingDepartment
                    ? `${leadingDepartment.total} medidas`
                    : "Sem dados"}
                </em>
              </div>

            </article>

            <article className="disciplinary-dashboard-panel tm-dashboard-panel is-full disciplinary-dashboard-absence-comparison">
              <header>
                <div>
                  <span>Correlação operacional</span>
                  <h2>
                    {absenceComparisonMeta.nivel === "centro_custo"
                      ? "Faltas injustificadas x advertências no centro selecionado"
                      : "Faltas injustificadas x advertências por departamento"}
                  </h2>
                  <p>
                    {absenceComparisonMeta.nivel === "centro_custo"
                      ? `${absenceComparisonMeta.centro_custo || "Centro de custo"} · Supervisor responsável: ${absenceComparisonMeta.supervisor || "Não informado"}`
                      : "Departamentos pertencentes às filiais liberadas para o usuário."}
                  </p>
                </div>
                {canViewAbsenceComparison && (
                  <Tag
                    value={`${absenceComparison.length} ${absenceComparisonMeta.nivel === "centro_custo" ? "centro" : "departamentos"}`}
                    severity="info"
                    rounded
                  />
                )}
              </header>

              <div
                className="disciplinary-dashboard-chart"
                style={{ height: "26rem" }}
              >
                {!canViewAbsenceComparison
                  ? (
                    <EmptyChart text="Sua permissão atual não permite consultar os dados de faltas." />
                  )
                  : absenceComparison.length
                    ? (
                      <Chart
                        key={`absence-comparison-${chartThemeKey}`}
                        type="bar"
                        data={absenceComparisonChart}
                        options={absenceComparisonOptions}
                      />
                    )
                    : <EmptyChart text="Nenhuma falta injustificada ou advertência para comparar." />}
                </div>
            </article>

            <article className="disciplinary-dashboard-panel tm-dashboard-panel is-full is-reasons">
              <header><div><span>Principais causas</span><h2>Medidas por motivo</h2></div></header>
              <div className="disciplinary-dashboard-chart">
                {reasons.length
                  ? (
                    <Chart
                      key={`reasons-${chartThemeKey}`}
                      type="bar"
                      data={reasonChart}
                      options={horizontalOptions}
                    />
                  )
                  : <EmptyChart text="Nenhum motivo para exibir." />}
              </div>
            </article>
          </div>

          <article className="disciplinary-dashboard-offenders tm-dashboard-panel">
            <header>
              <div>
                <span>Recorrência</span>
                <h2>Top maiores ofensores</h2>
                <p>
                  Apenas colaboradores atualmente ativos, ordenados pelo maior
                  número de medidas no recorte atual.
                </p>
              </div>
              <Tag
                value={`${data.maiores_ofensores?.length || 0} colaboradores`}
                severity="danger"
                rounded
              />
            </header>

            <div className="disciplinary-dashboard-offender-list">
              {(data.maiores_ofensores || []).map((offender, index) => (
                <div
                  className="disciplinary-dashboard-offender-row"
                  key={offender.colaborador_id}
                >
                  <strong className="disciplinary-dashboard-offender-rank">
                    {String(index + 1).padStart(2, "0")}
                  </strong>

                  <div className="disciplinary-dashboard-offender-person">
                    <strong>{offender.colaborador}</strong>
                    <span>
                      Matrícula {offender.matricula || "—"} · {offender.contrato}
                    </span>
                  </div>

                  <div className="disciplinary-dashboard-offender-counts">
                    <span className="is-total">
                      <small>Total</small>
                      <strong>{offender.total}</strong>
                    </span>
                    <span className="is-warning">
                      <small>Advertências</small>
                      <strong>{offender.advertencias}</strong>
                    </span>
                    <span className="is-suspension">
                      <small>Suspensões</small>
                      <strong>{offender.suspensoes}</strong>
                    </span>
                  </div>
                </div>
              ))}

              {!data.maiores_ofensores?.length && (
                <EmptyChart text="Nenhum colaborador para classificar." />
              )}
            </div>
          </article>

        </>
      )}

      <OverlayPanel ref={filterPanel} className="dashboard-filter-panel">
        <div className="dashboard-filter-title">
          <div>
            <strong>Filtrar dashboard</strong>
            <span>Todos os indicadores usam o mesmo recorte. A unidade segue o menu principal.</span>
          </div>
          <Button
            type="button"
            icon={<AppIcon name="filter-off" />}
            label="Limpar filtros"
            text
            severity="secondary"
            onClick={() => setFilters(defaultFilters())}
          />
        </div>
        <StandardFilterFields date={{ value: filters.period, onChange: (value) => setFilter("period", value) }} department={{ value: filters.department, options: options.departamentos, onChange: (value) => setFilter("department", value) }} center={{ value: filters.costCenter, options: options.centros_custo, onChange: (value) => setFilter("costCenter", value) }} />
        <div className="dashboard-filter-grid">
          <label><span>Supervisor da época</span><MultiSelect value={filters.supervisor} options={options.supervisores || []} onChange={(event) => setFilter("supervisor", event.value)} placeholder="Todos os supervisores" display="chip" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
          <label><span>Colaborador</span><MultiSelect value={filters.collaborator} options={options.colaboradores || []} onChange={(event) => setFilter("collaborator", event.value)} placeholder="Todos os colaboradores" display="chip" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
          <label><span>Tipo da medida</span><MultiSelect value={filters.type} options={options.tipos || []} onChange={(event) => setFilter("type", event.value)} placeholder="Todos os tipos" display="chip" showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
          <label><span>Origem</span><MultiSelect value={filters.origin} options={options.origens || []} onChange={(event) => setFilter("origin", event.value)} placeholder="Todas as origens" display="chip" showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
          <label className="is-wide"><span>Motivo / alínea</span><MultiSelect value={filters.reason} options={options.motivos || []} onChange={(event) => setFilter("reason", event.value)} placeholder="Todos os motivos" display="chip" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
        </div>
      </OverlayPanel>
    </section>
  );
}
