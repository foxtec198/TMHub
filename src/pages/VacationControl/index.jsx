import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { SpeedDial } from "primereact/speeddial";
import { Tag } from "primereact/tag";
import { Tooltip } from "primereact/tooltip";

import { PageHeader } from "../../components/PageHeader";
import { Table } from "../../components/tables/Table";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { can } from "../../utils/permissions";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import "./styles.css";

const EMPTY_FILTERS = {
  departamento: [],
  centro_custo_id: [],
  supervisor_id: [],
  situacao: [],
};

const STATUS_OPTIONS = [
  { label: "Concluída", value: "concluida" },
  { label: "Parcial", value: "parcial" },
  { label: "Disponível", value: "disponivel" },
  { label: "A vencer", value: "a_vencer" },
  { label: "Crítica", value: "critica" },
  { label: "Em dobro", value: "em_dobro" },
];

const STATUS_LABELS = {
  concluida: "CONCLUÍDA",
  parcial: "PARCIAL",
  disponivel: "DISPONÍVEL",
  a_vencer: "A VENCER",
  critica: "CRÍTICA",
  em_dobro: "EM DOBRO",
};

const STATUS_SEVERITIES = {
  concluida: "success",
  parcial: "info",
  disponivel: "secondary",
  a_vencer: "warning",
  critica: "danger",
  em_dobro: "danger",
};

function localDate(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function dateLabel(value) {
  return localDate(value)?.toLocaleDateString("pt-BR") || "—";
}

function isoDate(value) {
  if (!value) return null;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(value, days) {
  const result = localDate(value);
  if (!result) return null;
  result.setDate(result.getDate() + days);
  return result;
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function errorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.slice(0, 4).join(" ");
  return error?.response ? fallback : "Não foi possível conectar ao servidor.";
}

function VacationControlContent() {
  const [records, setRecords] = useState([]);
  const [provisioning, setProvisioning] = useState([]);
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const [summary, setSummary] = useState({});
  const [filterOptions, setFilterOptions] = useState({ departamentos: [], centros: [], supervisores: [] });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [activeView, setActiveView] = useState("historico");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [newLeave, setNewLeave] = useState({ data_inicio: null, dias_gozados: null });
  const [revision, setRevision] = useState(0);
  const filterPanel = useRef(null);
  const fileInput = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canCreate = can("controle_ferias", "create");
  const canEdit = can("controle_ferias", "edit");
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const requestParams = useMemo(() => {
    const params = {};
    if (debouncedSearch) params.busca = debouncedSearch;
    Object.entries(filters).forEach(([key, values]) => {
      if (values.length) params[key] = values.join(",");
    });
    return params;
  }, [debouncedSearch, filters]);

  const historyEmployees = useMemo(() => {
    const grouped = new Map();
    records.forEach((period) => {
      const employeeId = period.colaborador_id || period.matricula;
      const current = grouped.get(employeeId);
      if (current) {
        current.periodos.push(period);
        return;
      }
      grouped.set(employeeId, { ...period, id: `employee-${employeeId}`, periodos: [period] });
    });
    return [...grouped.values()]
      .map((employee) => ({
        ...employee,
        periodos: [...employee.periodos].sort((first, second) => String(second.periodo_aquisitivo_inicio).localeCompare(String(first.periodo_aquisitivo_inicio))),
      }))
      .sort((first, second) => String(first.nome || "").localeCompare(String(second.nome || "")));
  }, [records]);

  const loadData = useCallback(async () => {
    try {
      const { data } = await connect.get("/ferias", { params: requestParams });
      setRecords(Array.isArray(data?.registros) ? data.registros : []);
      setProvisioning(Array.isArray(data?.provisionamento) ? data.provisionamento : []);
      setSummary(data?.resumo || {});
      setFilterOptions(data?.filtros || { departamentos: [], centros: [], supervisores: [] });
    } catch (error) {
      showToast("error", "Controle de Férias", errorMessage(error, "Não foi possível carregar as férias."));
    }
  }, [requestParams, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData, revision]);

  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    socketio.on("vacation_update", reload);
    return () => socketio.off("vacation_update", reload);
  }, []);

  const activeFilterCount = Object.values(filters).filter((values) => values.length).length + Number(Boolean(search));
  const localDaysGozados = useMemo(
    () => (selectedPeriod?.gozos || []).reduce((total, leave) => total + Number(leave.dias_gozados || 0), 0),
    [selectedPeriod],
  );
  const localDaysAGozar = Math.max(0, Number(selectedPeriod?.dias_direito || 30) - localDaysGozados);
  const newLeaveEnd = useMemo(
    () => (newLeave.data_inicio && newLeave.dias_gozados ? addDays(newLeave.data_inicio, Number(newLeave.dias_gozados) - 1) : null),
    [newLeave.data_inicio, newLeave.dias_gozados],
  );

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    filterPanel.current?.hide();
  }

  async function importSpreadsheet() {
    if (!importFile) {
      showToast("warn", "Importação", "Selecione a planilha .xlsx.");
      return;
    }
    const payload = new FormData();
    payload.append("file", importFile);
    setLoading(true);
    try {
      const { data } = await connect.post("/ferias/importar", payload);
      showToast("success", "Importação concluída", data?.message || "Férias importadas.");
      if (data?.warnings?.length) {
        showToast("warn", "Lançamentos ignorados", data.warnings.slice(0, 3).join(" "));
      }
      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setRevision((value) => value + 1);
    } catch (error) {
      showToast("error", "Falha na importação", errorMessage(error, "Não foi possível importar a planilha."));
    } finally {
      setLoading(false);
    }
  }

  async function previewSpreadsheet(file) {
    setImportPreview(null);
    if (!file) return;
    const payload = new FormData();
    payload.append("file", file);
    setPreviewLoading(true);
    try {
      const { data } = await connect.post("/ferias/importar/previa", payload);
      setImportPreview(data);
    } catch (error) {
      setImportPreview({ error: errorMessage(error, "Não foi possível gerar a prévia da planilha.") });
    } finally {
      setPreviewLoading(false);
    }
  }

  function selectImportFile(event) {
    const file = event.target.files?.[0] || null;
    setImportFile(file);
    previewSpreadsheet(file);
  }

  async function exportSpreadsheet() {
    setLoading(true);
    try {
      const { data } = await connect.get("/ferias/export", { params: requestParams, responseType: "blob" });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "controle_de_ferias.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast("error", "Exportação", errorMessage(error, "Não foi possível exportar as férias."));
    } finally {
      setLoading(false);
    }
  }

  async function deleteAll() {
    setDeleteAllOpen(false);
    setLoading(true);
    try {
      const { data } = await connect.delete("/ferias/todos");
      showToast("success", "Controle de Férias", data?.message || "Registros removidos.");
      setRevision((value) => value + 1);
    } catch (error) {
      showToast("error", "Controle de Férias", errorMessage(error, "Não foi possível excluir os registros."));
    } finally {
      setLoading(false);
    }
  }

  function openDetail(record) {
    setSelectedPeriod({ ...record, gozos: (record.gozos || []).map((leave) => ({ ...leave })) });
    setNewLeave({ data_inicio: null, dias_gozados: null });
    setDetailOpen(true);
  }

  async function saveAllChanges() {
    if (!selectedPeriod) return;
    const hasNewLeaveData = newLeave.data_inicio || newLeave.dias_gozados;
    if (hasNewLeaveData && (!newLeave.data_inicio || !newLeave.dias_gozados)) {
      showToast("warn", "Novo gozo", "Informe a data inicial e a quantidade de dias do novo gozo.");
      return;
    }
    setLoading(true);
    try {
      for (const leave of selectedPeriod.gozos || []) {
        await connect.patch(`/ferias/gozos/${leave.id}`, {
          data_inicio: isoDate(localDate(leave.data_inicio)),
          dias_gozados: leave.dias_gozados,
          observacao: leave.observacao || "",
        });
      }
      if (hasNewLeaveData) {
        await connect.post(`/ferias/${selectedPeriod.id}/gozos`, {
          data_inicio: isoDate(newLeave.data_inicio),
          dias_gozados: newLeave.dias_gozados,
          dias_calculados_pagos: 0,
          pagamento_realizado: false,
          observacao: "Gozo programado pelo RH sem novo pagamento de férias ou VA.",
        });
      }
      await connect.patch(`/ferias/${selectedPeriod.id}`, { observacao_manual: selectedPeriod.observacao_manual || "" });
      showToast("success", "Férias", "Todas as alterações do período foram salvas.");
      setRevision((value) => value + 1);
      setDetailOpen(false);
    } catch (error) {
      showToast("error", "Férias", errorMessage(error, "Não foi possível salvar as alterações."));
    } finally {
      setLoading(false);
    }
  }

  const speedDialItems = [
    ...(canCreate ? [{ label: "Importar planilha", icon: appIcon("file-import"), command: () => setImportOpen(true) }] : []),
    { label: "Exportar controle", icon: appIcon("file-export"), command: exportSpreadsheet },
    ...(isAdmin ? [{ label: "Excluir todos os registros", icon: appIcon("trash"), command: () => setDeleteAllOpen(true) }] : []),
  ];

  function toggleEmployeePeriods(employeeId) {
    setExpandedEmployees((current) => {
      const next = { ...current };
      if (next[employeeId]) delete next[employeeId];
      else next[employeeId] = true;
      return next;
    });
  }

  function handleHistoryRowClick(event) {
    if (window.matchMedia("(max-width: 768px)").matches) {
      toggleEmployeePeriods(event.data.id);
    }
  }

  const employeeBody = (row) => <div className="vacation-main-cell"><strong title={row.nome}>{row.nome}</strong><small>Matrícula {row.matricula || "—"}</small></div>;
  const historyEmployeeBody = (row) => <div className="vacation-history-employee"><Button icon={<AppIcon name={expandedEmployees[row.id] ? "minus" : "plus"} />} text rounded aria-label={expandedEmployees[row.id] ? "Ocultar períodos" : "Mostrar períodos"} className="vacation-history-expand-button" onClick={(event) => { event.stopPropagation(); toggleEmployeePeriods(row.id); }} /><div className="vacation-main-cell"><strong title={row.nome}>{row.nome}</strong><small>Matrícula {row.matricula || "—"} · {row.periodos.length} período(s)</small></div></div>;
  const contractBody = (row) => <div className="vacation-main-cell"><strong title={row.centro_custo}>{row.centro_custo || "—"}</strong><small>DPTO. {row.departamento ?? "—"} · {row.supervisor || "Sem supervisor"}</small></div>;
  const periodBody = (row) => <div className="vacation-main-cell"><strong>{dateLabel(row.periodo_aquisitivo_inicio)} a {dateLabel(row.periodo_aquisitivo_fim)}</strong><small>Limite: {dateLabel(row.limite_concessivo)}</small></div>;
  const daysBody = (row) => <div className="vacation-days"><strong>{row.dias_gozados || 0} de {row.dias_direito || 30}</strong><small>{row.dias_a_gozar || 0} dia(s) a gozar</small></div>;
  const statusBody = (row) => <Tag className="vacation-status-tag" value={STATUS_LABELS[row.situacao] || row.situacao} severity={STATUS_SEVERITIES[row.situacao] || "secondary"} />;
  const historyColumns = [
    { field: "nome", header: "Colaborador", mobileHeader: "Colaborador", sortable: true, body: historyEmployeeBody, style: { minWidth: "18rem" } },
    { field: "centro_custo", header: "Contrato", mobileHeader: "Contrato", body: contractBody, style: { minWidth: "21rem" } },
    { header: "Períodos", mobileHeader: "Períodos", body: (row) => <div className="vacation-days"><strong>{row.periodos.length} registrado(s)</strong><small>{row.periodos.reduce((total, period) => total + Number(period.dias_gozados || 0), 0)} dia(s) gozados</small></div>, style: { minWidth: "12rem" } },
    { header: "Último período", mobileHeader: "Último período", body: (row) => periodBody(row.periodos[0]), style: { minWidth: "16rem" } },
  ];
  const historyExpansionTemplate = (employee) => <div className="vacation-history-periods"><div className="vacation-history-periods__heading"><strong>Períodos de férias registrados</strong><span>{employee.periodos.length} período(s) desde a admissão</span></div>{employee.periodos.map((period) => <div className="vacation-history-period" key={period.id}><div><span>Período aquisitivo</span><strong>{dateLabel(period.periodo_aquisitivo_inicio)} a {dateLabel(period.periodo_aquisitivo_fim)}</strong></div><div><span>Gozos</span><strong>{period.dias_gozados || 0} de {period.dias_direito || 30} dias</strong><small>{(period.gozos || []).map((leave) => `${dateLabel(leave.data_inicio)} a ${dateLabel(leave.data_fim)}`).join(" · ") || "Sem gozo informado"}</small></div><div><span>Situação</span>{statusBody(period)}</div>{canEdit && <Button label="Editar período" icon={<AppIcon name="pencil" />} outlined className="vacation-history-period__edit" onClick={() => openDetail(period)} />}</div>)}</div>;
  const provisioningColumns = [
    { field: "nome", header: "Colaborador", mobileHeader: "Colaborador", sortable: true, body: employeeBody, style: { minWidth: "19rem" } },
    { header: "Período aquisitivo", mobileHeader: "Período aquisitivo", body: periodBody, style: { minWidth: "16rem" } },
    { header: "Dias a gozar", mobileHeader: "Dias a gozar", body: daysBody, style: { minWidth: "11rem" } },
    { field: "limite_concessivo", header: "Limite concessivo", mobileHeader: "Limite concessivo", body: (row) => dateLabel(row.limite_concessivo), style: { minWidth: "10rem" } },
    { header: "Situação", mobileHeader: "Situação", body: statusBody, style: { minWidth: "9rem" } },
  ];

  return <section className="vacation-page">
    <PageHeader
      section="Recursos Humanos"
      title="Controle de Férias"
      description="Acompanhe o histórico, os dias a gozar e os períodos que precisam de programação."
      actions={<>
        <Button label={`Filtros${activeFilterCount ? ` (${activeFilterCount})` : ""}`} icon={<AppIcon name="filter" />} outlined onClick={(event) => filterPanel.current?.toggle(event)} />
      </>}
    />

    <div className="vacation-summary">
      <article><AppIcon name="history"  /><div><small>Histórico importado</small><strong>{summary.historico || 0}</strong><span>períodos registrados</span></div></article>
      <article><AppIcon name="calendar-plus"  /><div><small>A programar</small><strong>{summary.provisionamento || 0}</strong><span>com saldo de férias</span></div></article>
      <article className="is-warning"><AppIcon name="clock"  /><div><small>A vencer</small><strong>{summary.a_vencer || 0}</strong><span>até 90 dias</span></div></article>
      <article className="is-danger"><AppIcon name="alert-triangle"  /><div><small>Exigem atenção</small><strong>{summary.criticas || 0}</strong><span>críticas ou em dobro</span></div></article>
      <article className="is-success"><AppIcon name="wallet"  /><div><small>Férias líquidas</small><strong>{money(summary.custo_pago)}</strong><span>histórico filtrado</span></div></article>
    </div>

    <article className="vacation-panel">
      <div className="vacation-view-switcher" role="tablist" aria-label="Visualização do controle de férias">
        <Button label="Histórico mensal" icon={<AppIcon name="history" />} outlined={activeView !== "historico"} className={activeView === "historico" ? "is-active" : ""} onClick={() => setActiveView("historico")} aria-selected={activeView === "historico"} />
        <Button label="Provisionamento" icon={<AppIcon name="calendar-plus" />} outlined={activeView !== "provisionamento"} className={activeView === "provisionamento" ? "is-active" : ""} onClick={() => setActiveView("provisionamento")} aria-selected={activeView === "provisionamento"} />
      </div>

      {activeView === "historico" ? <>
        <div className="vacation-panel__heading"><div><span>HISTÓRICO MENSAL</span><h2>Férias registradas</h2></div><small>{historyEmployees.length} colaborador(es)</small></div>
        <Table data={historyEmployees} columns={historyColumns} dataKey="id" expandedRows={expandedEmployees} onRowToggle={(event) => setExpandedEmployees(event.data)} rowExpansionTemplate={historyExpansionTemplate} onRowClick={handleHistoryRowClick} rows={10} rowsPerPageOptions={[10, 25, 50, 100]} tableClassName="vacation-table vacation-history-table" emptyMessage="Nenhuma férias encontrada para o recorte aplicado." />
      </> : <>
        <div className="vacation-panel__heading"><div><span>PROVISIONAMENTO</span><h2>Períodos com saldo a programar</h2></div><small>{provisioning.length} período(s)</small></div>
        <Table data={provisioning} columns={provisioningColumns} rows={10} rowsPerPageOptions={[10, 25, 50]} tableClassName="vacation-table" emptyMessage="Nenhum período pendente de programação." />
      </>}
    </article>

    <OverlayPanel ref={filterPanel} className="vacation-filter-panel">
      <div className="vacation-filter-heading"><div><strong>Filtrar férias</strong><span>O histórico e o provisionamento acompanham este recorte.</span></div><Button icon={<AppIcon name="filter-off" />} rounded text aria-label="Limpar filtros" onClick={clearFilters} /></div>
      <div className="vacation-filter-grid">
        <label className="is-wide"><span>Buscar colaborador</span><span className="p-input-icon-left vacation-filter-search"><AppIcon name="search"  /><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, matrícula, contrato ou supervisor" /></span></label>
        <label><span>Departamento</span><MultiSelect value={filters.departamento} options={(filterOptions.departamentos || []).map((value) => ({ label: `DPTO. ${value}`, value }))} optionLabel="label" optionValue="value" onChange={(event) => setFilters((current) => ({ ...current, departamento: event.value || [] }))} placeholder="Todos os departamentos" display="chip" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
        <label><span>Contrato</span><MultiSelect value={filters.centro_custo_id} options={filterOptions.centros || []} optionLabel="label" optionValue="value" onChange={(event) => setFilters((current) => ({ ...current, centro_custo_id: event.value || [] }))} placeholder="Todos os contratos" display="chip" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
        <label><span>Supervisor</span><MultiSelect value={filters.supervisor_id} options={filterOptions.supervisores || []} optionLabel="label" optionValue="value" onChange={(event) => setFilters((current) => ({ ...current, supervisor_id: event.value || [] }))} placeholder="Todos os supervisores" display="chip" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
        <label><span>Situação</span><MultiSelect value={filters.situacao} options={STATUS_OPTIONS} optionLabel="label" optionValue="value" onChange={(event) => setFilters((current) => ({ ...current, situacao: event.value || [] }))} placeholder="Todas as situações" display="chip" filter showClear maxSelectedLabels={2} selectedItemsLabel="{0} selecionados" /></label>
      </div>
    </OverlayPanel>

    <Dialog header="Importar férias calculadas" visible={importOpen} modal className="vacation-import-dialog" onHide={() => { setImportOpen(false); setImportFile(null); setImportPreview(null); }}>
      <div className="vacation-import-content">
        <div className="vacation-import-note"><AppIcon name="info-circle"  /><span>Use a planilha “Relação de Férias Calculadas”. A prévia valida períodos, matrículas e escopo antes de qualquer gravação.</span></div>
        <button type="button" className={`vacation-dropzone ${importFile ? "has-file" : ""}`} onClick={() => fileInput.current?.click()}>
          <input ref={fileInput} type="file" accept=".xlsx" onChange={selectImportFile} />
          <AppIcon name={importFile ? "file-check" : "cloud-upload"} />
          <strong>{importFile?.name || "Selecionar planilha .xlsx"}</strong>
          <span>{importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : "Nenhum dado será gravado antes da confirmação."}</span>
        </button>

        {previewLoading && <div className="vacation-import-preview is-loading"><AppIcon name="loader-2"  /><span>Lendo e validando a planilha…</span></div>}
        {importPreview?.error && <div className="vacation-import-preview is-error"><AppIcon name="alert-triangle"  /><div><strong>Importação bloqueada</strong><span>{importPreview.error}</span></div></div>}
        {importPreview && !importPreview.error && <div className="vacation-import-preview">
          <div className="vacation-import-preview__heading"><div><span>PRÉVIA DA IMPORTAÇÃO</span><strong>{importPreview.total_periodos} período(s) encontrado(s)</strong></div><small>{importPreview.total_lancamentos} lançamento(s) na planilha</small></div>
          <div className="vacation-import-summary" aria-label="Resumo da importação">
            <div><AppIcon name="users"  /><span>Colaboradores</span><strong>{importPreview.resumo?.colaboradores || 0}</strong></div>
            <div><AppIcon name="calendar-plus"  /><span>Novos períodos</span><strong>{importPreview.resumo?.novos_periodos || 0}</strong></div>
            <div><AppIcon name="refresh"  /><span>Já cadastrados</span><strong>{importPreview.resumo?.periodos_atualizados || 0}</strong></div>
            <div><AppIcon name="copy"  /><span>Com mais de um gozo</span><strong>{importPreview.resumo?.gozos_fracionados || 0}</strong></div>
          </div>
          <div className="vacation-import-preview__range"><AppIcon name="calendar"  /><span>Períodos de gozo no arquivo</span><strong>{dateLabel(importPreview.resumo?.primeiro_gozo)} a {dateLabel(importPreview.resumo?.ultimo_gozo)}</strong></div>
        </div>}

        <div className="vacation-dialog-actions"><Button label="Cancelar" text onClick={() => setImportOpen(false)} /><Button label="Importar" icon={<AppIcon name="check" />} onClick={importSpreadsheet} disabled={!importFile || previewLoading || !importPreview || Boolean(importPreview.error)} /></div>
      </div>
    </Dialog>

    <Dialog header="Excluir todas as férias" visible={deleteAllOpen} modal dismissableMask draggable={false} className="vacation-delete-dialog" onHide={() => setDeleteAllOpen(false)}><div className="vacation-delete-content"><AppIcon name="alert-triangle"  /><div><strong>Excluir todos os períodos importados?</strong><p>Esta ação remove o histórico e os dias de gozo registrados. Os dados dos colaboradores e das faltas não serão alterados.</p></div></div><div className="vacation-dialog-actions"><Button label="Cancelar" outlined onClick={() => setDeleteAllOpen(false)} /><Button label="Excluir todos" icon={<AppIcon name="trash" />} severity="danger" onClick={deleteAll} /></div></Dialog>

    <Dialog header={`Férias · ${selectedPeriod?.nome || ""}`} visible={detailOpen} modal maximizable className="vacation-detail-dialog" onHide={() => setDetailOpen(false)}>
      {selectedPeriod && <div className="vacation-detail">
        <div className="vacation-detail-summary">
          <div><span>Período aquisitivo</span><strong>{dateLabel(selectedPeriod.periodo_aquisitivo_inicio)} a {dateLabel(selectedPeriod.periodo_aquisitivo_fim)}</strong></div>
          <div><span>Dias calculados/pagos</span><strong>{selectedPeriod.dias_direito || 30} dias</strong></div>
          <div><span>Dias efetivamente gozados</span><strong>{localDaysGozados} dias</strong></div>
          <div><span>Dias a gozar</span><strong>{localDaysAGozar} dias</strong></div>
        </div>

        <div className="vacation-payment-note"><AppIcon name="info-circle"  /><span>Pagamento de férias: {selectedPeriod.pagamento_ferias_integral ? "realizado integralmente" : "a confirmar"}. VA das férias: {selectedPeriod.va_ferias_integral_pago ? "já considerado no período" : "a confirmar"}. Alterar os dias efetivamente gozados não cria novo pagamento nem novo VA.</span></div>

        <div className="vacation-leaves">
          <div className="vacation-leaves__heading"><div><span>GOZOS REGISTRADOS</span><h3>Dias efetivamente tirados</h3></div></div>
          {(selectedPeriod.gozos || []).map((leave) => <div className="vacation-leave-row" key={leave.id}>
            <label><span>Início do gozo</span><Calendar value={localDate(leave.data_inicio)} onChange={(event) => setSelectedPeriod((current) => ({ ...current, gozos: current.gozos.map((item) => item.id === leave.id ? { ...item, data_inicio: isoDate(event.value) } : item) }))} dateFormat="dd/mm/yy" showIcon disabled={!canEdit} /></label>
            <label><span>Dias gozados</span><InputNumber value={leave.dias_gozados} onValueChange={(event) => setSelectedPeriod((current) => ({ ...current, gozos: current.gozos.map((item) => item.id === leave.id ? { ...item, dias_gozados: event.value } : item) }))} min={1} max={30} disabled={!canEdit} /></label>
            <div className="vacation-payment-field"><span>Pagamento de férias</span><strong>{leave.pagamento_realizado ? "Realizado" : "Sem novo pagamento"}</strong></div>
          </div>)}
        </div>

        {canEdit && localDaysAGozar > 0 && <div className="vacation-next-leave">
          <div className="vacation-next-leave__heading"><AppIcon name="calendar-plus"  /><div><span>NOVO GOZO</span><strong>{localDaysAGozar} dia(s) ainda disponíveis</strong><small>Cadastre o próximo período em que o colaborador efetivamente ficará de férias.</small></div></div>
          <div className="vacation-next-leave__fields">
            <label><span>Início do próximo gozo</span><Calendar value={newLeave.data_inicio} onChange={(event) => setNewLeave((current) => ({ ...current, data_inicio: event.value }))} dateFormat="dd/mm/yy" showIcon /></label>
            <label><span>Dias a gozar neste período</span><InputNumber value={newLeave.dias_gozados} onValueChange={(event) => setNewLeave((current) => ({ ...current, dias_gozados: event.value }))} min={1} max={localDaysAGozar} placeholder={`Até ${localDaysAGozar}`} /></label>
            <div className="vacation-next-leave__end"><span>Fim previsto</span><strong>{dateLabel(newLeaveEnd)}</strong><small>Sem novo pagamento de férias ou VA.</small></div>
          </div>
        </div>}

        <label className="vacation-observation"><span>Observação do RH</span><InputText value={selectedPeriod.observacao_manual || ""} onChange={(event) => setSelectedPeriod((current) => ({ ...current, observacao_manual: event.target.value }))} disabled={!canEdit} placeholder="Registre uma observação sobre o ajuste manual." /></label>
        {canEdit && <div className="vacation-dialog-actions"><Button label="Salvar alterações" icon={<AppIcon name="device-floppy" />} onClick={saveAllChanges} /></div>}
      </div>}
    </Dialog>

    {speedDialItems.length > 0 && <div className="vacation-speed-dial"><Tooltip className="vacation-speed-dial-tooltip" target=".vacation-speed-dial .p-speeddial-action" position="left" showDelay={150} /><SpeedDial model={speedDialItems} type="quarter-circle" direction="up-left" radius={110} showIcon={<AppIcon name="plus" />} hideIcon={<AppIcon name="x" />} aria-label="Ações de férias" /></div>}
  </section>;
}

export function VacationControl() {
  return <VacationControlContent />;
}
