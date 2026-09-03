import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { Divider } from "primereact/divider";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Paginator } from "primereact/paginator";
import { Tag } from "primereact/tag";

import { StandardFilterButton } from "../../components/filters/StandardFilterButton";
import { AppIcon } from "../../components/icons/AppIcon";
import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../contexts/ToastContext";
import { can } from "../../utils/permissions";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import "../../components/tables/index.css";
import "./styles.css";

const INDICATORS = [
  { label: "Intrajornada", value: "intrajornada" },
  { label: "Interjornada", value: "interjornada" },
  { label: "Escala 6x1 / 5x2", value: "escala" },
];
const LINK_STATUS = [
  { label: "Vinculado", value: "vinculado" },
  { label: "Pendente", value: "pendente" },
];
const emptyFilters = () => ({ types: [], links: [], contracts: [], departments: [], period: null });

function dateParam(value) {
  if (!value) return undefined;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(value) {
  const [year, month, day] = String(value || "").slice(0, 10).split("-");
  return year ? `${day}/${month}/${year}` : "—";
}

function errorMessage(error, fallback) {
  const response = error.response?.data;
  return typeof response === "string" ? response : response?.message || fallback;
}

function indicatorTag(type) {
  const severity = { intrajornada: "warning", interjornada: "danger", escala: "danger" }[type] || "info";
  const label = INDICATORS.find((item) => item.value === type)?.label || type;
  return <Tag value={label} severity={severity} />;
}

function Metric({ label, value, detail, tone, icon }) {
  return <article className={`journey-metric is-${tone}`}><span><AppIcon name={icon} /></span><div><small>{label}</small><strong>{value}</strong><em>{detail}</em></div></article>;
}

export function JourneyControl() {
  const { showToast } = useToast();
  const filterPanel = useRef(null);
  const requestSequence = useRef(0);
  const [data, setData] = useState({ registros: [], resumo: {}, ultima_importacao: null });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ first: 0, rows: 25, sortField: "data", sortOrder: -1 });
  const [filters, setFilters] = useState(emptyFilters);
  const [filterOptions, setFilterOptions] = useState({ contracts: [], departments: [] });
  const filterOptionsLoaded = useRef(false);
  const filterOptionsRequest = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [registration, setRegistration] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = can("controle_jornadas", "edit");

  const params = useMemo(() => ({
    search: search.trim() || undefined,
    tipo: filters.types.join(",") || undefined,
    vinculo: filters.links.join(",") || undefined,
    contrato: filters.contracts.join(",") || undefined,
    departamento: filters.departments.join(",") || undefined,
    inicio: dateParam(filters.period?.[0]),
    fim: dateParam(filters.period?.[1]),
    page: Math.floor(pagination.first / pagination.rows) + 1,
    per_page: pagination.rows,
    ordenar: pagination.sortField,
    direcao: pagination.sortOrder === 1 ? "asc" : "desc",
  }), [filters, pagination, search]);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const { data: payload } = await connect.get("/jornadas", { params });
      if (sequence === requestSequence.current) setData(payload || { registros: [], resumo: {}, ultima_importacao: null });
    } catch (error) {
      if (sequence === requestSequence.current) showToast("error", "Controle de Jornadas", errorMessage(error, "Não foi possível carregar os ofensores."));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [params, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load, revision]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPagination((current) => ({ ...current, first: 0 }));
      setSearch(searchInput.trim());
    }, 450);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    socketio.on("journey_update", refresh);
    return () => socketio.off("journey_update", refresh);
  }, []);

  const ensureFilterOptions = useCallback(async () => {
    if (filterOptionsLoaded.current) return true;
    if (filterOptionsRequest.current) return filterOptionsRequest.current;
    filterOptionsRequest.current = connect.get("/jornadas/opcoes-filtros")
      .then(({ data: options }) => {
        setFilterOptions({ contracts: options?.contratos || [], departments: options?.departamentos || [] });
        filterOptionsLoaded.current = true;
        return true;
      })
      .catch((error) => {
        showToast("error", "Filtros", errorMessage(error, "Não foi possível carregar as opções dos filtros."));
        return false;
      })
      .finally(() => { filterOptionsRequest.current = null; });
    return filterOptionsRequest.current;
  }, [showToast]);

  const updateFilter = (name, value) => {
    setPagination((current) => ({ ...current, first: 0 }));
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const exportReport = async () => {
    setExporting(true);
    try {
      const { data: file } = await connect.get("/jornadas/exportar", { params, responseType: "blob" });
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ofensores_de_jornada.xlsx";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      showToast("error", "Exportação", errorMessage(error, "Não há ofensores no recorte selecionado."));
    } finally {
      setExporting(false);
    }
  };

  const openEdit = (record) => {
    setEditing(record);
    setRegistration(record.matricula || "");
  };

  const saveLink = async () => {
    setSaving(true);
    try {
      await connect.patch(`/jornadas/${editing.id}`, { matricula: registration });
      showToast("success", "Registro atualizado", "O vínculo manual foi salvo.");
      setEditing(null);
      setRevision((value) => value + 1);
    } catch (error) {
      showToast("error", "Vínculo manual", errorMessage(error, "Não foi possível atualizar a jornada."));
    } finally {
      setSaving(false);
    }
  };

  const summary = data.resumo || {};
  const lastImport = data.ultima_importacao;
  const records = data.registros || [];
  const activeFilterCount = [
    filters.types.length,
    filters.links.length,
    filters.contracts.length,
    filters.departments.length,
    Boolean(filters.period?.[0]),
  ].filter(Boolean).length;
  return <section className="journey-control-page">
    <PageHeader
      section="Recursos humanos"
      title="Ofensores de jornada"
      description="Consolide as infrações já apontadas no relatório de Auditoria/Jornadas do PontoMais."
      actions={<div className="journey-header-actions">
        <Button label={exporting ? "Exportando..." : "Exportar XLSX"} icon={<AppIcon name="file-spreadsheet" />} outlined disabled={exporting || !data.registros?.length} onClick={exportReport} />
        <StandardFilterButton panelRef={filterPanel} count={activeFilterCount} ariaLabel="Abrir filtros de ofensores de jornada" onBeforeToggle={ensureFilterOptions} />
      </div>}
    />

    <div className="journey-import-status"><AppIcon name="clock" /><span>{lastImport ? <>Última importação: <strong>{dateLabel(lastImport.data_referencia)}</strong> · {lastImport.arquivo}</> : "Nenhum relatório Jornadas foi importado ainda."}</span></div>

    <div className="journey-metrics">
      <Metric label="Intrajornada" value={summary.intrajornada || 0} detail="apontada no relatório" tone="warning" icon="coffee" />
      <Metric label="Interjornada" value={summary.interjornada || 0} detail="apontada no relatório" tone="danger" icon="moon" />
      <Metric label="Escala" value={summary.escala || 0} detail="apontada no relatório" tone="danger" icon="calendar-x" />
      <Metric label="Vínculos pendentes" value={summary.vinculos_pendentes || 0} detail="matrículas para completar" tone="neutral" icon="id-badge" />
    </div>

    <article className="journey-panel">
      <header><div><span>Demonstrativo operacional</span><h2>{summary.total || 0} ocorrência(s) · {summary.colaboradores || 0} colaborador(es)</h2></div><small>Consulta paginada</small></header>
      <div className="journey-toolbar">
        <span className="p-input-icon-left journey-search"><AppIcon name="search" className="journey-search-icon" size={18} /><InputText value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar colaborador, matrícula ou contrato" aria-label="Pesquisar colaborador, matrícula ou contrato" /></span>
      </div>
      <div className="journey-records">{loading ? <div className="journey-list-loading">Atualizando ofensores…</div> : records.length ? records.map((record) => <article className="journey-tab-record" key={record.id}><div className="journey-tab-record__date">{indicatorTag(record.tipo)}<small>{dateLabel(record.data)}</small></div><div className="journey-tab-record__person"><strong>{record.colaborador}</strong><small>{record.matricula ? `Matrícula ${record.matricula}` : "Matrícula pendente"}</small></div><div className="journey-tab-record__detail"><span>MOTIVO</span><strong>{record.descricao_valor || record.detalhe || "—"}</strong></div><div className="journey-tab-record__contract"><strong>{record.contrato || "—"}</strong><small>{record.departamento ? `DPTO. ${record.departamento}` : "Departamento não informado"}</small></div><div className="journey-tab-record__actions"><Tag value={record.vinculo_status === "vinculado" ? "Vinculado" : "Pendente"} severity={record.vinculo_status === "vinculado" ? "success" : "warning"} />{canEdit && <Button icon={<AppIcon name="pencil" />} text rounded aria-label={`Completar vínculo de ${record.colaborador}`} onClick={() => openEdit(record)} />}</div></article>) : <div className="journey-list-empty">Nenhum ofensor encontrado no recorte.</div>}<Paginator first={pagination.first} rows={pagination.rows} totalRecords={Number(data.total) || 0} rowsPerPageOptions={[10, 25, 50, 100]} onPageChange={(event) => setPagination((current) => ({ ...current, first: Math.max(0, Number(event.first) || 0), rows: Math.max(10, Number(event.rows) || current.rows) }))} template="RowsPerPageDropdown CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink" currentPageReportTemplate="Mostrando {first} até {last} de {totalRecords}" /></div>
    </article>

    <OverlayPanel ref={filterPanel} className="dashboard-filter-panel journey-filter-panel">
      <div className="dashboard-filter-title"><div><strong>Filtrar ofensores de jornada</strong><span>As alterações são aplicadas automaticamente ao demonstrativo e à exportação.</span></div><Button icon={<AppIcon name="filter-off" />} label="Limpar filtros" text severity="secondary" onClick={() => { setPagination((current) => ({ ...current, first: 0 })); setFilters(emptyFilters()); }} /></div>
      <Divider />
      <div className="dashboard-filter-grid journey-filter-grid">
        <label className="is-wide"><span>PERÍODO DA OCORRÊNCIA</span><Calendar value={filters.period} onChange={(event) => updateFilter("period", event.value)} selectionMode="range" dateFormat="dd/mm/yy" readOnlyInput showIcon showButtonBar hideOnRangeSelection placeholder="Selecione o período" /></label>
        <label><span>INDICADORES</span><MultiSelect value={filters.types} options={INDICATORS} optionLabel="label" optionValue="value" onChange={(event) => updateFilter("types", event.value || [])} placeholder="Todos os indicadores" display="chip" showClear /></label>
        <label><span>VÍNCULO</span><MultiSelect value={filters.links} options={LINK_STATUS} optionLabel="label" optionValue="value" onChange={(event) => updateFilter("links", event.value || [])} placeholder="Todos os vínculos" display="chip" showClear /></label>
        <label><span>CONTRATO</span><MultiSelect value={filters.contracts} options={filterOptions.contracts} optionLabel="label" optionValue="value" onChange={(event) => updateFilter("contracts", event.value || [])} placeholder="Todos os contratos" display="chip" filter showClear maxSelectedLabels={1} selectedItemsLabel="{0} selecionados" /></label>
        <label><span>DEPARTAMENTO</span><MultiSelect value={filters.departments} options={filterOptions.departments} optionLabel="label" optionValue="value" onChange={(event) => updateFilter("departments", event.value || [])} placeholder="Todos os departamentos" display="chip" filter showClear maxSelectedLabels={1} selectedItemsLabel="{0} selecionados" /></label>
      </div>
    </OverlayPanel>

    <Dialog header={`Completar vínculo · ${editing?.colaborador || ""}`} visible={Boolean(editing)} modal className="journey-link-dialog" onHide={() => !saving && setEditing(null)} footer={<div className="journey-dialog-actions"><Button label="Cancelar" text disabled={saving} onClick={() => setEditing(null)} /><Button label="Salvar vínculo" icon={<AppIcon name="device-floppy" />} loading={saving} onClick={saveLink} /></div>}>
      {editing && <div className="journey-link-content"><p>Se a matrícula existir na base de colaboradores, o vínculo será concluído automaticamente. Cadastre a matrícula primeiro, caso ela ainda não exista.</p><label><span>Matrícula</span><InputText value={registration} onChange={(event) => setRegistration(event.target.value)} placeholder="Informe a matrícula" /></label></div>}
    </Dialog>
  </section>;
}
