import { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import { Table } from "../../components/tables/Table";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import connect from "../../utils/request";

const EMPTY_DATA = { importacoes: [], importacao: null, resumo: {}, colaboradores: [] };
const EMPTY_FILTERS = { departamentos: [], centros: [], supervisores: [], vinculos: [], motivos: [], responsaveis: [] };

function formatMinutes(value, signed = false) {
  const original = Number(value || 0);
  const prefix = signed && original > 0 ? "+" : original < 0 ? "-" : "";
  const minutes = Math.abs(original);
  return `${prefix}${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}min`;
}

function formatPeriod(batch) {
  if (!batch) return "Sem período";
  const format = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
  return `${format(batch.periodo_inicio)} a ${format(batch.periodo_fim)}`;
}

function MirrorCard({ active, icon, label, value, detail, tone, onClick }) {
  return (
    <button type="button" className={`ponto48-card is-${tone} ${active ? "is-active" : ""}`} onClick={onClick}>
      <span className="ponto48-card__icon"><i className={icon} /></span>
      <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
    </button>
  );
}

function recalculateEmployee(employee, dateRange) {
  const start = dateRange?.[0] ? new Date(dateRange[0]).setHours(0, 0, 0, 0) : null;
  const endDate = dateRange?.[1] || dateRange?.[0];
  const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;
  const records = employee.registros.filter((record) => {
    const date = new Date(`${record.data}T00:00:00`);
    return (!start || date >= start) && (!end || date <= end);
  });
  const latest = records[records.length - 1];
  return records.reduce((result, record) => ({
    ...result,
    credito_minutos: result.credito_minutos + record.credito_minutos,
    debito_minutos: result.debito_minutos + record.debito_minutos,
    intervalo_minutos: result.intervalo_minutos + record.intervalo_minutos,
    horas_normais_minutos: result.horas_normais_minutos + record.horas_normais_minutos,
    horas_extras_minutos: result.horas_extras_minutos + record.horas_extras_minutos,
    adicional_noturno_minutos: result.adicional_noturno_minutos + record.adicional_noturno_minutos,
    dias_batida_impar: result.dias_batida_impar + Number(record.batida_impar),
    dias_sem_batida: result.dias_sem_batida + Number(record.quantidade_batidas === 0),
  }), {
    ...employee,
    registros: records,
    credito_minutos: 0,
    debito_minutos: 0,
    intervalo_minutos: 0,
    horas_normais_minutos: 0,
    horas_extras_minutos: 0,
    adicional_noturno_minutos: 0,
    saldo_final_minutos: latest?.saldo_minutos || 0,
    dias_batida_impar: 0,
    dias_sem_batida: 0,
  });
}

export function Ponto48Mirror({ filters = EMPTY_FILTERS, dateRange = null, refreshKey = 0, referenceStart = null }) {
  const chartTheme = useChartTheme();
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    connect.get("/dash/ponto-48h/espelho")
      .then(async (response) => {
        if (!active) return;
        let payload = response.data || EMPTY_DATA;
        const matchingBatch = referenceStart
          ? payload.importacoes?.find((batch) => batch.periodo_inicio === referenceStart)
          : null;
        if (matchingBatch && matchingBatch.id !== payload.importacao?.id) {
          const matchingResponse = await connect.get("/dash/ponto-48h/espelho", { params: { importacao_id: matchingBatch.id } });
          if (!active) return;
          payload = matchingResponse.data || EMPTY_DATA;
        }
        setData(payload);
      })
      .catch((error) => {
        if (active) showToast("error", "Espelho Ponto", error.response?.data || "Não foi possível carregar o espelho.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [referenceStart, refreshKey, showToast]);

  const scopedEmployees = useMemo(() => data.colaboradores
    .map((employee) => recalculateEmployee(employee, dateRange))
    .filter((employee) => employee.registros.length), [data.colaboradores, dateRange]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleUpperCase("pt-BR");
    return scopedEmployees.filter((employee) => {
      const matchesFilters = (
        (!filters.departamentos.length || filters.departamentos.includes(employee.departamento))
        && (!filters.centros.length || filters.centros.includes(employee.centro_id))
        && (!filters.supervisores.length || filters.supervisores.includes(employee.supervisor_id))
        && (!filters.vinculos.length || filters.vinculos.includes(employee.match_status))
      );
      const matchesSearch = !normalizedSearch || `${employee.nome} ${employee.matricula || ""}`.toLocaleUpperCase("pt-BR").includes(normalizedSearch);
      const matchesView = (
        view === "all"
        || (view === "negative" && employee.saldo_final_minutos < 0)
        || (view === "positive" && employee.saldo_final_minutos > 0)
        || (view === "odd" && employee.dias_batida_impar > 0)
        || (view === "debit" && employee.debito_minutos > 0)
      );
      return matchesFilters && matchesSearch && matchesView;
    });
  }, [filters, scopedEmployees, search, view]);

  const summary = useMemo(() => filteredEmployees.reduce((result, employee) => ({
    employees: result.employees + 1,
    negative: result.negative + Number(employee.saldo_final_minutos < 0),
    positive: result.positive + Number(employee.saldo_final_minutos > 0),
    odd: result.odd + employee.dias_batida_impar,
    debit: result.debit + employee.debito_minutos,
    credit: result.credit + employee.credito_minutos,
    normal: result.normal + employee.horas_normais_minutos,
    overtime: result.overtime + employee.horas_extras_minutos,
  }), { employees: 0, negative: 0, positive: 0, odd: 0, debit: 0, credit: 0, normal: 0, overtime: 0 }), [filteredEmployees]);

  const negativeBalances = useMemo(() => [...filteredEmployees]
    .filter((employee) => employee.saldo_final_minutos < 0)
    .sort((a, b) => a.saldo_final_minutos - b.saldo_final_minutos)
    .slice(0, 10), [filteredEmployees]);

  const chartData = useMemo(() => ({
    labels: negativeBalances.map((employee) => employee.nome),
    datasets: [{ label: "Saldo em minutos", data: negativeBalances.map((employee) => employee.saldo_final_minutos), backgroundColor: chartTheme.danger, borderRadius: 6 }],
  }), [negativeBalances, chartTheme]);

  const chartOptions = useMemo(() => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: chartTheme.text, callback: (value) => formatMinutes(value, true) }, grid: { color: chartTheme.grid } },
      y: { ticks: { color: chartTheme.text, autoSkip: false }, grid: { display: false } },
    },
  }), [chartTheme]);

  const columns = useMemo(() => [
    { field: "nome", header: "Colaborador", class: "text-truncate" },
    { field: "departamento", header: "DPTO." },
    { header: "Normais", body: (row) => formatMinutes(row.horas_normais_minutos) },
    { header: "Crédito", body: (row) => formatMinutes(row.credito_minutos) },
    { header: "Débito", body: (row) => formatMinutes(row.debito_minutos) },
    { header: "HE", body: (row) => formatMinutes(row.horas_extras_minutos) },
    { header: "Saldo", body: (row) => <Tag value={formatMinutes(row.saldo_final_minutos, true)} severity={row.saldo_final_minutos < 0 ? "danger" : row.saldo_final_minutos > 0 ? "success" : "secondary"} rounded /> },
    { header: "Ímpares", body: (row) => <Tag value={row.dias_batida_impar} severity={row.dias_batida_impar ? "danger" : "success"} rounded /> },
    { header: "Espelho", body: (row) => <Button label="Visualizar" icon="pi pi-eye" size="small" outlined onClick={() => setDetail(row)} /> },
  ], []);

  return (
    <div className="ponto48-mirror">
      {!data.importacao && !loading ? (
        <div className="ponto48-empty"><i className="pi pi-id-card" /><h2>Nenhum espelho importado</h2><p>Use a importação conjunta no topo para carregar os quatro relatórios.</p></div>
      ) : (
        <>
          <div className="ponto48-summary">
            <MirrorCard active={view === "all"} icon="pi pi-users" label="Colaboradores" value={summary.employees} detail="com jornada no período" tone="neutral" onClick={() => setView("all")} />
            <MirrorCard active={view === "negative"} icon="pi pi-arrow-down" label="Saldo negativo" value={summary.negative} detail="colaboradores em débito" tone="danger" onClick={() => setView("negative")} />
            <MirrorCard active={view === "positive"} icon="pi pi-arrow-up" label="Saldo positivo" value={summary.positive} detail="colaboradores em crédito" tone="success" onClick={() => setView("positive")} />
            <MirrorCard active={view === "odd"} icon="pi pi-exclamation-triangle" label="Batidas ímpares" value={summary.odd} detail="dias para conferir" tone="warning" onClick={() => setView("odd")} />
            <MirrorCard active={view === "debit"} icon="pi pi-clock" label="Débitos" value={formatMinutes(summary.debit)} detail="horas debitadas" tone="violet" onClick={() => setView("debit")} />
          </div>

          <div className="ponto48-analysis">
            <article className="ponto48-panel ponto48-ranking"><header><div><span>Banco de horas</span><h2>Maiores saldos negativos</h2></div><Tag value={formatPeriod(data.importacao)} severity="success" /></header><div className="ponto48-chart">{negativeBalances.length ? <Chart type="bar" data={chartData} options={chartOptions} /> : <p>Nenhum saldo negativo para os filtros atuais.</p>}</div></article>
            <article className="ponto48-panel ponto48-insight"><span>Resumo da jornada</span><h2>{formatMinutes(summary.normal)}</h2><p>Total de horas normais no recorte selecionado.</p><div><strong>{formatMinutes(summary.credit)}</strong><small>créditos</small></div><div><strong>{formatMinutes(summary.overtime)}</strong><small>horas extras</small></div></article>
          </div>

          <div className="ponto48-table-panel">
            <div className="ponto48-table-heading"><div><span>Espelho consolidado</span><h2>Jornada por colaborador</h2></div><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou matrícula" /></div>
            <Table data={filteredEmployees} columns={columns} rows={10} loading={loading} />
          </div>
        </>
      )}

      <Dialog header={detail ? `Espelho de ${detail.nome}` : "Espelho Ponto"} visible={!!detail} modal className="ponto48-mirror-dialog" onHide={() => setDetail(null)}>
        {detail ? <><div className="ponto48-detail-summary"><div><span>Horas normais</span><strong>{formatMinutes(detail.horas_normais_minutos)}</strong></div><div><span>Créditos</span><strong>{formatMinutes(detail.credito_minutos)}</strong></div><div><span>Débitos</span><strong>{formatMinutes(detail.debito_minutos)}</strong></div><div><span>Saldo final</span><strong>{formatMinutes(detail.saldo_final_minutos, true)}</strong></div></div><div className="ponto48-mirror-records">{detail.registros.map((record) => <article key={record.id} className={record.batida_impar ? "is-irregular" : ""}><header><strong>{new Date(`${record.data}T00:00:00`).toLocaleDateString("pt-BR")}</strong><Tag value={formatMinutes(record.saldo_minutos, true)} severity={record.saldo_minutos < 0 ? "danger" : record.saldo_minutos > 0 ? "success" : "secondary"} /></header><div className="ponto48-punches">{record.batidas.map((punch, index) => <span key={`${record.id}-${index}`}>{punch || "—"}</span>)}</div><footer><span>Normal: {formatMinutes(record.horas_normais_minutos)}</span><span>Crédito: {formatMinutes(record.credito_minutos)}</span><span>Débito: {formatMinutes(record.debito_minutos)}</span>{record.motivo ? <strong>{record.motivo}</strong> : null}</footer></article>)}</div></> : null}
      </Dialog>
    </div>
  );
}
