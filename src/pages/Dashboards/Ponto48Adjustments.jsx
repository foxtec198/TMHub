// React
import { useEffect, useMemo, useState } from "react";
// PrimeReact
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
// Componentes
import { Table } from "../../components/tables/Table";
// Contextos
import { useToast } from "../../contexts/ToastContext";
// Tema
import { useChartTheme } from "../../theme/useTheme";
// Utilitários
import connect from "../../utils/request";

// Evita estados indefinidos enquanto os dados dos ajustes são carregados.
const EMPTY_DATA = { importacoes: [], importacao: null, resumo: {}, ajustes: [] };
const EMPTY_FILTERS = { departamentos: [], centros: [], supervisores: [], vinculos: [], motivos: [], responsaveis: [] };

function formatPeriod(batch) {
  if (!batch) return "Sem período";
  const format = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
  return `${format(batch.periodo_inicio)} a ${format(batch.periodo_fim)}`;
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  return new Date(withTime ? value : `${value}T00:00:00`).toLocaleString("pt-BR", withTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" });
}

function formatDuration(value) {
  const minutes = Number(value || 0);
  if (minutes < 60) return `${minutes}min`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}min`;
}

function AdjustmentCard({ active, icon, label, value, detail, tone, onClick }) {
  return (
    <button type="button" className={`ponto48-card tm-dashboard-card is-${tone} ${active ? "is-active" : ""}`} onClick={onClick}>
      <span className="ponto48-card__icon"><i className={icon} /></span>
      <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
    </button>
  );
}

// Apresenta ajustes importados e seus impactos no período filtrado.
export function Ponto48Adjustments({ filters = EMPTY_FILTERS, dateRange = null, refreshKey = 0, referenceStart = null }) {
  const chartTheme = useChartTheme();
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    connect.get("/dash/ponto-48h/ajustes")
      .then(async (response) => {
        if (!active) return;
        let payload = response.data || EMPTY_DATA;
        const matchingBatch = referenceStart
          ? payload.importacoes?.find((batch) => batch.periodo_inicio === referenceStart)
          : null;
        if (matchingBatch && matchingBatch.id !== payload.importacao?.id) {
          const matchingResponse = await connect.get("/dash/ponto-48h/ajustes", {
            params: { importacao_id: matchingBatch.id },
          });
          if (!active) return;
          payload = matchingResponse.data || EMPTY_DATA;
        }
        setData(payload);
      })
      .catch((error) => {
        if (active) showToast("error", "Ajustes de ponto", error.response?.data || "Não foi possível carregar os ajustes.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [referenceStart, refreshKey, showToast]);

  // Mantém apenas ajustes compatíveis com filtros de vínculo e período.
  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleUpperCase("pt-BR");
    return data.ajustes.filter((record) => {
      const recordDate = new Date(`${record.data}T00:00:00`);
      const start = dateRange?.[0] ? new Date(dateRange[0]).setHours(0, 0, 0, 0) : null;
      const endDate = dateRange?.[1] || dateRange?.[0];
      const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;
      const matchesDate = (!start || recordDate >= start) && (!end || recordDate <= end);
      const matchesFilters = (
        (!filters.motivos.length || filters.motivos.includes(record.motivo))
        && (!filters.responsaveis.length || filters.responsaveis.includes(record.ajustado_por))
        && (!filters.vinculos.length || filters.vinculos.includes(record.match_status))
        && (!filters.departamentos.length || filters.departamentos.includes(record.departamento))
        && (!filters.centros.length || filters.centros.includes(record.centro_id))
        && (!filters.supervisores.length || filters.supervisores.includes(record.supervisor_id))
      );
      const matchesSearch = !normalizedSearch || `${record.nome} ${record.matricula || ""} ${record.motivo || ""}`
        .toLocaleUpperCase("pt-BR").includes(normalizedSearch);
      const matchesView = (
        view === "all"
        || (view === "requests" && record.solicitacao)
        || (view === "direct" && !record.solicitacao)
        || (view === "odd" && record.batida_impar)
        || (view === "empty" && record.quantidade_batidas === 0)
      );
      return matchesDate && matchesFilters && matchesSearch && matchesView;
    });
  }, [data.ajustes, dateRange, filters, search, view]);

  // Resume volume, duração e situação dos ajustes exibidos.
  const summary = useMemo(() => {
    const employees = new Set();
    let totalDelay = 0;
    let delayCount = 0;
    filteredRecords.forEach((record) => {
      employees.add(record.colaborador_id ? `employee:${record.colaborador_id}` : `name:${record.nome}`);
      if (record.tempo_ajuste_minutos !== null) {
        totalDelay += record.tempo_ajuste_minutos;
        delayCount += 1;
      }
    });
    return {
      adjustments: filteredRecords.length,
      employees: employees.size,
      requests: filteredRecords.filter((item) => item.solicitacao).length,
      direct: filteredRecords.filter((item) => !item.solicitacao).length,
      odd: filteredRecords.filter((item) => item.batida_impar).length,
      empty: filteredRecords.filter((item) => item.quantidade_batidas === 0).length,
      averageDelay: delayCount ? Math.round(totalDelay / delayCount) : 0,
    };
  }, [filteredRecords]);

  // Agrupa ocorrências por motivo para compor o ranking do painel.
  const reasonRanking = useMemo(() => {
    const counts = new Map();
    filteredRecords.forEach((record) => counts.set(record.motivo || "Sem motivo", (counts.get(record.motivo || "Sem motivo") || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filteredRecords]);

  // Identifica o colaborador com maior volume de ajustes no recorte.
  const topAdjuster = useMemo(() => {
    const counts = new Map();
    filteredRecords.forEach((record) => {
      const name = record.ajustado_por || "Não informado";
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || ["—", 0];
  }, [filteredRecords]);

  const chartData = useMemo(() => ({
    labels: reasonRanking.map(([reason]) => reason),
    datasets: [{ label: "Ajustes", data: reasonRanking.map(([, count]) => count), backgroundColor: chartTheme.palette[0], borderRadius: 6 }],
  }), [reasonRanking, chartTheme]);

  const chartOptions = useMemo(() => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0, color: chartTheme.text }, grid: { color: chartTheme.grid } },
      y: { ticks: { color: chartTheme.text, autoSkip: false }, grid: { display: false } },
    },
  }), [chartTheme]);

  const columns = useMemo(() => [
    { field: "nome", header: "Colaborador", class: "text-truncate" },
    { header: "Data", body: (row) => formatDate(row.data) },
    { field: "motivo", header: "Motivo" },
    { field: "ajustado_por", header: "Ajustado por" },
    { header: "Origem", body: (row) => <Tag value={row.solicitacao ? "Solicitação" : "Direto"} severity={row.solicitacao ? "info" : "secondary"} /> },
    { header: "Batidas", body: (row) => <Tag value={row.quantidade_batidas} severity={row.batida_impar ? "danger" : "success"} rounded /> },
    { header: "Tempo", body: (row) => formatDuration(row.tempo_ajuste_minutos) },
    { header: "Detalhes", body: (row) => <Button label="Visualizar" icon="pi pi-eye" size="small" outlined onClick={() => setDetail(row)} /> },
  ], []);

  return (
    <div className="ponto48-adjustments">
      {!data.importacao && !loading ? (
        <div className="ponto48-empty"><i className="pi pi-file-edit" /><h2>Nenhum ajuste importado</h2><p>Use a importação conjunta no topo para carregar os três relatórios.</p></div>
      ) : (
        <>
          <div className="ponto48-summary ponto48-adjustments-summary">
            <AdjustmentCard active={view === "all"} icon="pi pi-pencil" label="Ajustes" value={summary.adjustments} detail={`${summary.employees} colaboradores`} tone="neutral" onClick={() => setView("all")} />
            <AdjustmentCard active={view === "requests"} icon="pi pi-send" label="Solicitações" value={summary.requests} detail="enviadas pelo colaborador" tone="success" onClick={() => setView("requests")} />
            <AdjustmentCard active={view === "direct"} icon="pi pi-user-edit" label="Ajustes diretos" value={summary.direct} detail="sem solicitação" tone="violet" onClick={() => setView("direct")} />
            <AdjustmentCard active={view === "odd"} icon="pi pi-exclamation-triangle" label="Batidas ímpares" value={summary.odd} detail="exigem conferência" tone="danger" onClick={() => setView("odd")} />
            <AdjustmentCard active={view === "empty"} icon="pi pi-minus-circle" label="Sem batidas" value={summary.empty} detail="folgas e compensações" tone="warning" onClick={() => setView("empty")} />
          </div>

          <div className="ponto48-analysis">
            <article className="ponto48-panel tm-dashboard-panel ponto48-ranking"><header><div><span>Frequência</span><h2>Principais motivos</h2></div><Tag value={formatPeriod(data.importacao)} severity="success" /></header><div className="ponto48-chart">{reasonRanking.length ? <Chart type="bar" data={chartData} options={chartOptions} /> : <p>Nenhum ajuste para os filtros atuais.</p>}</div></article>
            <article className="ponto48-panel tm-dashboard-panel ponto48-insight"><span>Leitura dos ajustes</span><h2>{topAdjuster[0]}</h2><p>Responsável com maior volume no recorte atual: {topAdjuster[1]} ajuste(s).</p><div><strong>{formatDuration(summary.averageDelay)}</strong><small>tempo médio de tratamento</small></div><div><strong>{data.resumo?.nao_vinculados || 0}</strong><small>registros sem vínculo automático</small></div></article>
          </div>

          <div className="ponto48-table-panel tm-dashboard-panel">
            <div className="ponto48-table-heading"><div><span>Detalhamento</span><h2>Registros ajustados</h2></div><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, matrícula ou motivo" /></div>
            <Table data={filteredRecords} columns={columns} rows={10} loading={loading} />
          </div>
        </>
      )}

      <Dialog header={detail ? `Ajuste de ${detail.nome}` : "Detalhes do ajuste"} visible={!!detail} modal className="ponto48-adjustment-dialog" onHide={() => setDetail(null)}>
        {detail ? <div className="ponto48-adjustment-detail"><div className="ponto48-detail-summary"><div className="tm-dashboard-card"><span>Data ajustada</span><strong>{formatDate(detail.data)}</strong></div><div className="tm-dashboard-card"><span>Origem</span><strong>{detail.solicitacao ? "Solicitação" : "Direto"}</strong></div><div className="tm-dashboard-card"><span>Batidas</span><strong>{detail.quantidade_batidas}</strong></div><div className="tm-dashboard-card"><span>Tratamento</span><strong>{formatDuration(detail.tempo_ajuste_minutos)}</strong></div></div><section className="tm-dashboard-panel"><span>Batidas registradas</span><div className="ponto48-punches">{detail.batidas.map((punch, index) => <span key={`${detail.id}-${index}`}>{punch || "—"}</span>)}</div></section><dl><div><dt>Motivo</dt><dd>{detail.motivo || "Não informado"}</dd></div><div><dt>Ajustado/aprovado por</dt><dd>{detail.ajustado_por || "Não informado"}</dd></div><div><dt>Criado em</dt><dd>{formatDate(detail.solicitado_em, true)}</dd></div><div><dt>Alterado em</dt><dd>{formatDate(detail.alterado_em, true)}</dd></div></dl></div> : null}
      </Dialog>
    </div>
  );
}
