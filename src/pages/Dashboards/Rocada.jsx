// React
import { useEffect, useMemo, useState } from "react";
// PrimeReact
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
// Utilitários
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
// Contextos
import { useToast } from "../../contexts/ToastContext";
// Componentes
import { PageHeader } from "../../components/PageHeader";
// Tema
import { useChartTheme } from "../../theme/useTheme";
// Estilos
import "./rocada.css";
import "./projects.css";

// Formata competências para os filtros e indicadores mensais.
const monthName = (value) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
  .format(new Date(`${value}T12:00:00`));

const rocadaPointGuidePlugin = {
  id: "rocada-point-guides",
  beforeDatasetsDraw(chart) {
    const { chartArea } = chart;
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    if (!chartArea || !meta?.data?.length || !dataset) return;
    const values = dataset.data.map(Number);

    const { ctx } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
    ctx.clip();
    ctx.strokeStyle = dataset.borderColor;
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    ctx.setLineDash([2, 4]);

    meta.data.forEach((point, index) => {
      const current = values[index];
      const previous = values[index - 1];
      const next = values[index + 1];
      const isPeak = index > 0
        && index < values.length - 1
        && Number.isFinite(current)
        && current >= previous
        && current >= next
        && (current > previous || current > next);

      if (point.skip || !isPeak) return;
      const { x, y } = point.getProps(["x", "y"], true);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
    });

    ctx.restore();
  },
};

// Converte os dias operacionais do mês em uma série visual de roçada.
function MonthChart({ month }) {
  const chartTheme = useChartTheme();
  const days = (month.dias || []).filter((day) => day.operacional);
  if (!days.length) return <div className="rocada-month-chart__empty">{month.futuro ? "Indicador será definido no mês" : "Sem dias operacionais registrados"}</div>;

  const chartData = {
    labels: days.map((day) => new Date(`${day.data}T12:00:00`).getDate()),
    datasets: [
      {
        label: "Trabalhados",
        data: days.map((day) => day.trabalhados),
        borderColor: chartTheme.palette[0],
        backgroundColor: chartTheme.palette[0],
        fill: false,
        borderDash: [2, 3],
        borderCapStyle: "round",
        borderJoinStyle: "round",
        borderWidth: 2.8,
        tension: .35,
        pointRadius: 2.8,
        pointHoverRadius: 4,
      },
      {
        type: "line",
        label: "Média mensal",
        data: days.map(() => month.media_trabalhados),
        borderColor: chartTheme.warning,
        borderWidth: 1.2,
        pointRadius: 0,
        borderDash: [4, 3],
      },
      {
        type: "line",
        label: "Média contratual",
        data: days.map(() => month.meta),
        borderColor: chartTheme.text,
        borderWidth: .8,
        pointRadius: 0,
        borderDash: [2, 3],
      },
      {
        type: "line",
        label: "Quadro médio",
        data: days.map(() => month.media_quadro),
        borderColor: chartTheme.info,
        borderWidth: 1,
        pointRadius: 0,
        borderDash: [6, 3],
      },
    ],
  };
  return <div className="rocada-month-chart"><Chart type="line" data={chartData} plugins={[rocadaPointGuidePlugin]} options={{
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false, grid: { display: false } },
      y: { display: false, beginAtZero: false, grid: { display: false } },
    },
  }} /></div>;
}

// Exibe o acompanhamento mensal de roçada e seus detalhes por competência.
export function RocadaDashboard({ endpoint = "/glosas/rocada" }) {
  const [data, setData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const { showToast } = useToast();

  // Carrega os indicadores conforme o ano selecionado.
  useEffect(() => {
    connect.get(endpoint)
      .then(({ data: response }) => {
        setData(response);
        const latestYear = response?.meses?.[0]?.competencia?.slice(0, 4);
        setSelectedYear((current) => current || latestYear || String(new Date().getFullYear()));
      })
      .catch((error) => showToast("error", "Roçada", error.response?.data || "Não foi possível carregar a métrica de Roçada."));
  }, [endpoint, refresh, showToast]);

  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1);
    socketio.on("disallowance_update", reload);
    return () => socketio.off("disallowance_update", reload);
  }, []);

  // Extrai anos únicos para o seletor sem alterar os dados recebidos.
  const years = useMemo(() => [...new Set((data?.meses || []).map((item) => item.competencia.slice(0, 4)))]
    .sort((left, right) => Number(right) - Number(left))
    .map((year) => ({ label: year, value: year })), [data]);
  const months = useMemo(() => (data?.meses || [])
    .filter((item) => item.competencia.startsWith(selectedYear || ""))
    .sort((left, right) => left.competencia.localeCompare(right.competencia)), [data, selectedYear]);

  // Busca o detalhamento somente quando o usuário abre uma competência.
  const openDetail = async (competencia) => {
    setLoadingDetail(true);
    try {
      const { data: response } = await connect.get(`${endpoint}/detalhe`, { params: { competencia: competencia.slice(0, 7) } });
      setDetail(response);
    } catch (error) {
      showToast("error", "Roçada", error.response?.data || "Não foi possível abrir o espelho mensal.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const summary = detail?.resumo;
  return <main className="project-dashboard">
    <section className="rocada-metric">
      <div className="flex justify-content-between align-items-center">
        <PageHeader
          section="Dashboards"
          title="Dashboard de Roçada"
          description="Meta contratual do DPTO 92: média mensal mínima de 72 colaboradores trabalhados."
        />
        <Dropdown value={selectedYear} options={years} onChange={(event) => setSelectedYear(event.value)} placeholder="Selecione o ano" />
      </div>

      {!months.length && <div className="rocada-metric__empty"><i className="pi pi-file-import" /><strong>Sem espelho de ponto da Roçada para este ano.</strong><span>Sem dados, consulte seu Administrator.</span></div>}
      <div className="rocada-month-grid">
        {months.map((month) => <article className={`rocada-month-card tm-dashboard-card ${month.futuro ? "is-future" : month.glosado == null ? "is-empty" : month.glosado ? "is-risk" : "is-safe"}`} key={month.competencia}>
          <div className="rocada-month-card__top"><span>{monthName(month.competencia)}</span><Tag value={month.situacao} severity={month.futuro ? "secondary" : month.glosado == null ? "info" : month.glosado ? "danger" : "success"} /></div>
          <strong>{month.tem_dados ? month.media_trabalhados.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}</strong>
          <span className="rocada-month-card__target">{month.tem_dados ? `média trabalhada · média contratual ${month.meta}` : month.futuro ? "o indicador será definido no mês" : "aguardando histórico do período"}</span>
          <MonthChart month={month} />
          <div className="rocada-month-card__stats"><span><i className="pi pi-calendar" /> {month.dias_operacionais} dias</span><span><i className="pi pi-chart-line" /> base {month.meta_padrao || 72}</span><span><i className="pi pi-user-minus" /> {month.media_faltantes} faltantes/dia</span></div>
          <Button label={month.futuro ? "Aguardando mês" : "Visualizar"} icon={month.futuro ? "pi pi-clock" : "pi pi-table"} text onClick={() => openDetail(month.competencia)} loading={loadingDetail} disabled={month.futuro} />
        </article>)}
      </div>

      <Dialog visible={Boolean(detail)} onHide={() => setDetail(null)} modal maximizable className="rocada-detail-dialog" header={`Espelho de Roçada · ${summary ? monthName(summary.competencia) : ""}`}>
        {summary && <>
          <div className="rocada-detail-summary">
            <span><small>Média de trabalhados</small><strong>{summary.media_trabalhados}</strong></span>
            <span><small>Média de faltantes</small><strong>{summary.media_faltantes}</strong></span>
            <span><small>Média contratual</small><strong>{summary.meta}</strong></span>
            <span><small>Dias operacionais</small><strong>{summary.dias_operacionais}</strong></span>
            <Tag value={summary.situacao} severity={summary.glosado ? "danger" : "success"} />
          </div>
          <DataTable value={detail.colaboradores} scrollable scrollHeight="55vh" stripedRows size="small" emptyMessage="Sem colaboradores no espelho deste mês.">
            <Column field="nome" header="Colaborador" frozen style={{ minWidth: "18rem" }} body={(row) => <strong>{row.nome}</strong>} />
            {(detail.colunas || []).map((column, index) => <Column key={column.data} header={column.dia} style={{ minWidth: "3.25rem", textAlign: "center" }} body={(row) => {
              const item = row.dias[index];
              if (!item?.operacional) return <i className="pi pi-minus rocada-day--off" />;
              return item.trabalhou
                ? <i className="pi pi-check-circle rocada-day--worked" title="Trabalhou" />
                : <i className="pi pi-times-circle rocada-day--absent" title={item.motivo || "Faltante"} />;
            }} />)}
          </DataTable>
        </>}
      </Dialog>
    </section>
  </main>
}
