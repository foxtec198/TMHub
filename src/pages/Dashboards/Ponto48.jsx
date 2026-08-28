import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Dialog } from "primereact/dialog";
import { Divider } from "primereact/divider";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";
import { TabPanel, TabView } from "primereact/tabview";
import { Table } from "../../components/tables/Table";
import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../contexts/ToastContext";
import { useChartTheme } from "../../theme/useTheme";
import connect from "../../utils/request";
import { Ponto48Adjustments } from "./Ponto48Adjustments";
import { Ponto48Mirror } from "./Ponto48Mirror";
import "./ponto48.css";

const EMPTY_FILTERS = { departamentos: [], centros: [], supervisores: [], vinculos: [], motivos: [], responsaveis: [] };
const EMPTY_DATA = { importacoes: [], importacao: null, resumo: {}, colaboradores: [] };

function formatMinutes(value) {
  const minutes = Number(value || 0);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}min`;
}

function formatPeriod(batch) {
  if (!batch) return "Sem período";
  const format = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
  return `${format(batch.periodo_inicio)} a ${format(batch.periodo_fim)}`;
}

function uniqueOptions(items, valueKey, labelKey = valueKey) {
  const values = new Map();
  items.forEach((item) => {
    const value = item[valueKey];
    const label = item[labelKey];
    if (value !== null && value !== undefined && label) values.set(value, { value, label: String(label) });
  });
  return [...values.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
}

function SummaryCard({ active, icon, label, value, detail, tone, onClick }) {
  return (
    <button type="button" className={`ponto48-card tm-dashboard-card is-${tone} ${active ? "is-active" : ""}`} onClick={onClick}>
      <span className="ponto48-card__icon">{typeof icon === "string" ? <AppIcon name={icon} /> : icon}</span>
      <span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span>
    </button>
  );
}

export function Ponto48Dashboard() {
  const chartTheme = useChartTheme();
  const filterPanel = useRef(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [detailEmployee, setDetailEmployee] = useState(null);
  const [importVisible, setImportVisible] = useState(false);
  const [absenteeismFile, setAbsenteeismFile] = useState(null);
  const [overtimeFile, setOvertimeFile] = useState(null);
  const [adjustmentsFile, setAdjustmentsFile] = useState(null);
  const [mirrorFile, setMirrorFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [dateRange, setDateRange] = useState(null);
  const [adjustmentRecords, setAdjustmentRecords] = useState([]);
  const [adjustmentsRefreshKey, setAdjustmentsRefreshKey] = useState(0);
  const [mirrorRefreshKey, setMirrorRefreshKey] = useState(0);
  const [clearing, setClearing] = useState(false);
  const { showToast } = useToast();
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

  const loadDashboard = async (batchId) => {
    try {
      setLoading(true);
      const response = await connect.get("/dash/ponto-48h", { params: batchId ? { importacao_id: batchId } : {} });
      const payload = response.data || EMPTY_DATA;
      setData(payload);
      setSelectedBatch(payload.importacao?.id || null);
    } catch (error) {
      showToast("error", "Ponto 48 horas", error.response?.data || "Não foi possível carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    connect.get("/dash/ponto-48h")
      .then((response) => {
        if (!active) return;
        const payload = response.data || EMPTY_DATA;
        setData(payload);
        setSelectedBatch(payload.importacao?.id || null);
      })
      .catch((error) => {
        if (active) showToast("error", "Ponto 48 horas", error.response?.data || "Não foi possível carregar o dashboard.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showToast]);

  useEffect(() => {
    let active = true;
    connect.get("/dash/ponto-48h/ajustes")
      .then((response) => {
        if (active) setAdjustmentRecords(response.data?.ajustes || []);
      })
      .catch(() => { if (active) setAdjustmentRecords([]); });
    return () => { active = false; };
  }, [adjustmentsRefreshKey]);

  const options = useMemo(() => {
    const combinedRecords = [...data.colaboradores, ...adjustmentRecords];
    return ({
    departamentos: uniqueOptions(combinedRecords, "departamento"),
    centros: uniqueOptions(combinedRecords, "centro_id", "centro"),
    supervisores: uniqueOptions(combinedRecords, "supervisor_id", "supervisor"),
    motivos: uniqueOptions(adjustmentRecords, "motivo"),
    responsaveis: uniqueOptions(adjustmentRecords, "ajustado_por"),
    vinculos: [
      { value: "matched", label: "Vinculados" },
      { value: "unmatched", label: "Não encontrados" },
      { value: "ambiguous", label: "Nome duplicado" },
    ],
  });
  }, [adjustmentRecords, data.colaboradores]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleUpperCase("pt-BR");
    return data.colaboradores.filter((employee) => {
      const matchesFilters = (
        (!filters.departamentos.length || filters.departamentos.includes(employee.departamento))
        && (!filters.centros.length || filters.centros.includes(employee.centro_id))
        && (!filters.supervisores.length || filters.supervisores.includes(employee.supervisor_id))
        && (!filters.vinculos.length || filters.vinculos.includes(employee.match_status))
      );
      const matchesSearch = !normalizedSearch || `${employee.nome} ${employee.matricula || ""}`.toLocaleUpperCase("pt-BR").includes(normalizedSearch);
      const matchesView = (
        view === "all"
        || (view === "offenders" && employee.dias_problematicos > 0)
        || (view === "correct" && employee.batidas_corretas > 0)
        || (view === "overtime" && employee.horas_extras_minutos > 0)
        || (view === "absence" && employee.ausencia_minutos > 0)
      );
      return matchesFilters && matchesSearch && matchesView;
    });
  }, [data.colaboradores, filters, search, view]);

  const filteredSummary = useMemo(() => filteredEmployees.reduce((summary, employee) => ({
    employees: summary.employees + 1,
    offenders: summary.offenders + Number(employee.dias_problematicos > 0),
    correct: summary.correct + employee.batidas_corretas,
    overtime: summary.overtime + employee.horas_extras_minutos,
    absence: summary.absence + employee.ausencia_minutos,
  }), { employees: 0, offenders: 0, correct: 0, overtime: 0, absence: 0 }), [filteredEmployees]);

  // A missing link means the CSV name was not uniquely associated with an employee record.
  // It is a registration/linkage warning and must not be presented as a punch inconsistency.
  const linkSummary = useMemo(() => data.colaboradores.reduce((summary, employee) => ({
    unmatched: summary.unmatched + Number(employee.match_status === "unmatched"),
    ambiguous: summary.ambiguous + Number(employee.match_status === "ambiguous"),
  }), { unmatched: 0, ambiguous: 0 }), [data.colaboradores]);

  const topOffenders = useMemo(() => [...filteredEmployees]
    .filter((employee) => employee.dias_problematicos > 0)
    .sort((a, b) => b.dias_problematicos - a.dias_problematicos || b.abs_percentual - a.abs_percentual || b.horas_extras_minutos - a.horas_extras_minutos)
    .slice(0, 10), [filteredEmployees]);

  const chartData = useMemo(() => ({
    labels: topOffenders.map((employee) => employee.nome),
    datasets: [
      { label: "Batidas ímpares", data: topOffenders.map((employee) => employee.batidas_impares), backgroundColor: "#f2b632", borderRadius: 6 },
      { label: "Outras irregularidades", data: topOffenders.map((employee) => Math.max(0, employee.batidas_irregulares - employee.batidas_impares)), backgroundColor: "#e5484d", borderRadius: 6 },
    ],
  }), [topOffenders]);

  const chartOptions = useMemo(() => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: chartTheme.text, padding: 18 },
      },
      tooltip: {
        titleColor: "#f7faf8",
        bodyColor: "#f7faf8",
        backgroundColor: chartTheme.tooltipBackground,
        borderColor: chartTheme.border,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { precision: 0, color: chartTheme.text },
        grid: { color: chartTheme.grid },
      },
      y: {
        ticks: { color: chartTheme.text, autoSkip: false },
        grid: { display: false },
      },
    },
  }), [chartTheme]);

  const columns = useMemo(() => [
    { field: "nome", header: "Colaborador", class: "text-truncate" },
    { field: "departamento", header: "DPTO." },
    { header: "Absenteísmo", body: (row) => <strong>{Number(row.abs_percentual || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong> },
    { header: "Ausência", body: (row) => formatMinutes(row.ausencia_minutos) },
    { header: "HE", body: (row) => formatMinutes(row.horas_extras_minutos) },
    { header: "Irregulares", body: (row) => <Tag value={row.batidas_irregulares} severity={row.batidas_irregulares ? "danger" : "success"} rounded /> },
    { header: "Corretas", body: (row) => <Tag value={row.batidas_corretas} severity="success" rounded /> },
    {
      header: "Vínculo",
      body: (row) => <Tag
        value={{ matched: "Vinculado", unmatched: "Não encontrado", ambiguous: "Nome duplicado" }[row.match_status] || row.match_status}
        severity={row.match_status === "matched" ? "success" : "warning"}
        rounded
      />,
    },
    { header: "Batidas", body: (row) => <Button label="Ver batidas" icon={<AppIcon name="eye" />} outlined size="small" aria-label={`Ver batidas de ${row.nome}`} onClick={() => setDetailEmployee(row)} /> },
  ], []);

  const activeFilterCount = Object.values(filters).filter((value) => value.length).length + Number(Boolean(dateRange?.[0]));

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setDateRange(null);
  };

  const importReports = async () => {
    if (!absenteeismFile || !overtimeFile || !adjustmentsFile || !mirrorFile) return showToast("warn", "Importação", "Selecione os quatro relatórios CSV.");
    try {
      setImporting(true);
      const uploadId = crypto.randomUUID();
      const reports = {
        absenteismo: absenteeismFile,
        horas_extras: overtimeFile,
        ajustes: adjustmentsFile,
        espelho: mirrorFile,
      };
      const chunkSize = 512 * 1024;
      const metadata = {};

      for (const [field, file] of Object.entries(reports)) {
        const total = Math.ceil(file.size / chunkSize);
        if (!total) throw new Error(`O arquivo ${file.name} está vazio.`);
        metadata[field] = { nome: file.name, total };
        for (let index = 0; index < total; index += 1) {
          await connect.post(
            "/dash/ponto-48h/importar/chunk",
            file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize)),
            {
              params: { upload_id: uploadId, arquivo: field, indice: index, total },
              headers: { "Content-Type": "application/octet-stream" },
            },
          );
        }
      }

      const response = await connect.post("/dash/ponto-48h/importar/finalizar", {
        upload_id: uploadId,
        arquivos: metadata,
      });
      showToast("success", "Importação concluída", response.data?.message || "Relatórios importados.");
      setImportVisible(false);
      setAbsenteeismFile(null);
      setOvertimeFile(null);
      setAdjustmentsFile(null);
      setMirrorFile(null);
      await loadDashboard(response.data?.importacao_id);
      setAdjustmentsRefreshKey((current) => current + 1);
      setMirrorRefreshKey((current) => current + 1);
    } catch (error) {
      showToast("error", "Falha na importação", error.response?.data || error.message || "Confira os arquivos enviados.");
    } finally {
      setImporting(false);
    }
  };

  const confirmClearImportedData = () => {
    if (!selectedBatch) return;
    confirmDialog({
      header: "Limpar dados importados",
      message: `Deseja remover absenteísmo, horas extras, ajustes e espelho da referência ${formatPeriod(data.importacao)}? Esta ação não pode ser desfeita.`,
      icon: appIcon("alert-triangle"),
      acceptLabel: "Sim, limpar dados",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: async () => {
        try {
          setClearing(true);
          const response = await connect.delete("/dash/ponto-48h/importar", {
            data: { importacao_id: selectedBatch },
          });
          showToast("success", "Dados removidos", response.data?.message || "Referência removida.");
          clearFilters();
          setView("all");
          await loadDashboard();
          setAdjustmentsRefreshKey((current) => current + 1);
          setMirrorRefreshKey((current) => current + 1);
        } catch (error) {
          showToast("error", "Falha ao limpar dados", error.response?.data || "Não foi possível remover a referência.");
        } finally {
          setClearing(false);
        }
      },
    });
  };

  return (
    <section className="ponto48-dashboard">
      <PageHeader
        section="Dashboards"
        title="Ponto 48 horas"
        description="Absenteísmo, horas extras e qualidade das batidas em uma única visão."
        actions={<>
          {data.importacoes.length ? <Dropdown value={selectedBatch} options={data.importacoes} optionValue="id" optionLabel="periodo_inicio" valueTemplate={() => formatPeriod(data.importacao)} itemTemplate={formatPeriod} onChange={(event) => loadDashboard(event.value)} /> : null}
          {isAdmin ? <Button icon={<AppIcon name="upload" />} label="Importar CSVs" outlined onClick={() => setImportVisible(true)} /> : null}
          {isAdmin && selectedBatch ? <Button icon={<AppIcon name="trash" />} label="Limpar dados" severity="danger" outlined loading={clearing} onClick={confirmClearImportedData} /> : null}
          <Button icon={<AppIcon name="filter-filled" />} label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"} onClick={(event) => filterPanel.current?.toggle(event)} />
        </>}
      />

      <OverlayPanel ref={filterPanel} className="ponto48-filter-panel">
        <div className="ponto48-filter-title"><div><strong>Filtrar Ponto 48 horas</strong><span>Um único conjunto de filtros para as duas abas.</span></div><Button icon={<AppIcon name="filter-off" />} text rounded onClick={clearFilters} /></div>
        <Divider />
        <StandardFilterFields date={{ value: dateRange, onChange: setDateRange }} department={{ value: filters.departamentos, options: options.departamentos, onChange: (value) => setFilters((current) => ({ ...current, departamentos: value })) }} center={{ value: filters.centros, options: options.centros, onChange: (value) => setFilters((current) => ({ ...current, centros: value })) }} />
        {[["supervisores", "Supervisores"], ["vinculos", "Vínculos por nome"], ["motivos", "Motivos dos ajustes"], ["responsaveis", "Responsáveis pelos ajustes"]].map(([name, label]) => (
          <label className="ponto48-filter-field" key={name}><span>{label}</span><MultiSelect value={filters[name]} options={options[name]} optionLabel="label" optionValue="value" display="chip" filter className="w-full" onChange={(event) => setFilters((current) => ({ ...current, [name]: event.value || [] }))} /></label>
        ))}
      </OverlayPanel>

      <TabView activeIndex={activeTab} onTabChange={(event) => setActiveTab(event.index)} className="ponto48-tabs">
        <TabPanel header="Absenteísmo e HE" leftIcon={<AppIcon name="chart-bar" className="mr-2" />}>
      <div className="ponto48-summary">
        <SummaryCard active={view === "all"} icon={<AppIcon name="users" />} label="Colaboradores" value={filteredSummary.employees} detail="visão integrada" tone="neutral" onClick={() => setView("all")} />
        <SummaryCard active={view === "offenders"} icon={<AppIcon name="alert-triangle" />} label="Ofensores" value={filteredSummary.offenders} detail="com batida irregular" tone="danger" onClick={() => setView("offenders")} />
        <SummaryCard active={view === "correct"} icon={<AppIcon name="circle-check" />} label="Batidas corretas" value={filteredSummary.correct} detail="registros regulares" tone="success" onClick={() => setView("correct")} />
        <SummaryCard active={view === "overtime"} icon={<AppIcon name="clock" />} label="Horas extras" value={formatMinutes(filteredSummary.overtime)} detail="no período" tone="warning" onClick={() => setView("overtime")} />
        <SummaryCard active={view === "absence"} icon={<AppIcon name="calendar-x" />} label="Ausências" value={formatMinutes(filteredSummary.absence)} detail="no período" tone="violet" onClick={() => setView("absence")} />
      </div>

      {!data.importacao && !loading ? (
        <div className="ponto48-empty"><AppIcon name="file-import"  /><h2>Nenhum relatório importado</h2><p>Importe os CSVs de absenteísmo e horas extras para iniciar a análise.</p>{isAdmin ? <Button label="Importar relatórios" icon={<AppIcon name="upload" />} onClick={() => setImportVisible(true)} /> : null}</div>
      ) : (
        <>
          <div className="ponto48-analysis">
            <article className="ponto48-panel tm-dashboard-panel ponto48-ranking"><header><div><span>Prioridade</span><h2>Maiores ofensores</h2></div><Tag value={formatPeriod(data.importacao)} severity="success" /></header><div className="ponto48-chart">{topOffenders.length ? <Chart type="bar" data={chartData} options={chartOptions} /> : <p>Nenhuma ocorrência para os filtros atuais.</p>}</div></article>
            <article className="ponto48-panel tm-dashboard-panel ponto48-insight"><span>Leitura combinada</span><h2>{filteredSummary.offenders ? `${filteredSummary.offenders} colaborador(es) exigem atenção` : "Batidas regulares no recorte"}</h2><p>O ranking prioriza irregularidades e apresenta absenteísmo e HE na mesma linha para apoiar a investigação.</p><div><strong>{data.resumo?.batidas_impares || 0}</strong><small>batidas ímpares</small></div><div className="ponto48-link-summary" title="Nomes do CSV sem correspondência única na tabela de colaboradores. Isso não representa inconsistência nas batidas."><strong>{data.resumo?.nao_vinculados || 0}</strong><span><small>sem vínculo automático</small><em>{linkSummary.unmatched} não encontrados · {linkSummary.ambiguous} duplicados</em></span></div></article>
          </div>

          <div className="ponto48-table-panel tm-dashboard-panel">
            <div className="ponto48-table-heading"><div><span>Detalhamento</span><h2>Colaboradores e registros</h2></div><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou matrícula" /></div>
            <Table data={filteredEmployees} columns={columns} rows={10} loading={loading} />
          </div>
        </>
      )}
        </TabPanel>
        <TabPanel header="Ajustes de ponto" leftIcon={<AppIcon name="pencil" className="mr-2" />}>
          <Ponto48Adjustments filters={filters} dateRange={dateRange} refreshKey={adjustmentsRefreshKey} referenceStart={data.importacao?.periodo_inicio} />
        </TabPanel>
        <TabPanel header="Espelho Ponto" leftIcon={<AppIcon name="id-badge" className="mr-2" />}>
          <Ponto48Mirror filters={filters} dateRange={dateRange} refreshKey={mirrorRefreshKey} referenceStart={data.importacao?.periodo_inicio} />
        </TabPanel>
      </TabView>

      <Dialog header={detailEmployee?.nome || "Detalhes do colaborador"} visible={!!detailEmployee} modal className="ponto48-detail-dialog" onHide={() => setDetailEmployee(null)}>
        {detailEmployee ? <><div className="ponto48-detail-summary"><div className="tm-dashboard-card"><span>Absenteísmo</span><strong>{detailEmployee.abs_percentual}%</strong></div><div className="tm-dashboard-card"><span>Horas extras</span><strong>{formatMinutes(detailEmployee.horas_extras_minutos)}</strong></div><div className="tm-dashboard-card"><span>Irregulares</span><strong>{detailEmployee.batidas_irregulares}</strong></div><div className="tm-dashboard-card"><span>Corretas</span><strong>{detailEmployee.batidas_corretas}</strong></div></div><div className="ponto48-records">{detailEmployee.registros.length ? detailEmployee.registros.map((record) => <article key={record.id} className={`tm-dashboard-card ${record.batida_irregular ? "is-irregular" : "is-correct"}`}><header><strong>{new Date(`${record.data}T00:00:00`).toLocaleDateString("pt-BR")}</strong><Tag value={record.batida_irregular ? "Irregular" : "Correta"} severity={record.batida_irregular ? "danger" : "success"} /></header><div className="ponto48-punches">{record.batidas.map((punch, index) => <span key={`${record.id}-${index}`}>{punch || "—"}</span>)}</div><footer><span>HE: {formatMinutes(record.horas_extras_minutos)}</span>{record.irregularidade ? <strong>{record.irregularidade}</strong> : null}</footer></article>) : <p>Não há registros diários de HE para este colaborador.</p>}</div></> : null}
      </Dialog>

      <ConfirmDialog />

      <Dialog header="Importar relatórios de ponto" visible={importVisible} modal className="ponto48-import-dialog" onHide={() => !importing && setImportVisible(false)}>
        <div className="ponto48-import-form"><p>Os quatro relatórios serão validados e atualizados juntos. Se um falhar, nenhum dado será substituído.</p><label><span>Relatório de absenteísmo</span><input type="file" accept=".csv,text/csv" onChange={(event) => setAbsenteeismFile(event.target.files?.[0] || null)} /></label><label><span>Relatório de horas extras</span><input type="file" accept=".csv,text/csv" onChange={(event) => setOvertimeFile(event.target.files?.[0] || null)} /></label><label><span>Relatório de ajustes</span><input type="file" accept=".csv,text/csv" onChange={(event) => setAdjustmentsFile(event.target.files?.[0] || null)} /></label><label><span>Relatório de Jornada (Espelho Ponto)</span><input type="file" accept=".csv,text/csv" onChange={(event) => setMirrorFile(event.target.files?.[0] || null)} /></label><Button label="Importar os quatro relatórios" icon={<AppIcon name="upload" />} loading={importing} onClick={importReports} /></div>
      </Dialog>
    </section>
  );
}
