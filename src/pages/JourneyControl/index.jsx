import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
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

function dateLabel(value) {
  const [year, month, day] = String(value || "").slice(0, 10).split("-");
  return year ? `${day}/${month}/${year}` : "—";
}

function errorMessage(error, fallback) {
  const response = error.response?.data;
  return typeof response === "string" ? response : response?.message || fallback;
}

function responsiveCell(label, content) {
  return <div className="tm-table-cell"><span className="tm-table-card-label">{label}</span><div className="tm-table-card-value">{content ?? "—"}</div></div>;
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
  const [data, setData] = useState({ registros: [], resumo: {}, ultima_importacao: null });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [registration, setRegistration] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = can("controle_jornadas", "edit");

  const params = useMemo(() => ({ search: search.trim() || undefined, tipo: types.join(",") || undefined }), [search, types]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: payload } = await connect.get("/jornadas", { params });
      setData(payload || { registros: [], resumo: {}, ultima_importacao: null });
    } catch (error) {
      showToast("error", "Controle de Jornadas", errorMessage(error, "Não foi possível carregar os ofensores."));
    } finally {
      setLoading(false);
    }
  }, [params, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load, revision]);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    socketio.on("journey_update", refresh);
    return () => socketio.off("journey_update", refresh);
  }, []);

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
  return <section className="journey-control-page">
    <PageHeader
      section="Recursos humanos"
      title="Ofensores de jornada"
      description="Consolide as infrações já apontadas no relatório de Auditoria/Jornadas do PontoMais."
      actions={<div className="journey-header-actions">
        <Button label={exporting ? "Exportando..." : "Exportar XLSX"} icon={<AppIcon name="file-spreadsheet" />} outlined disabled={exporting || !data.registros?.length} onClick={exportReport} />
        <StandardFilterButton panelRef={filterPanel} count={types.length} ariaLabel="Abrir filtros de ofensores de jornada" />
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
      <header><div><span>Demonstrativo operacional</span><h2>{summary.total || 0} ocorrência(s) · {summary.colaboradores || 0} colaborador(es)</h2></div></header>
      <div className="journey-toolbar">
        <span className="p-input-icon-left journey-search"><AppIcon name="search" className="journey-search-icon" size={18} /><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar colaborador, matrícula ou contrato" aria-label="Pesquisar colaborador, matrícula ou contrato" /></span>
      </div>
      <DataTable value={data.registros || []} loading={loading} dataKey={(row) => `${row.id}-${row.tipo}`} paginator rows={15} rowsPerPageOptions={[15, 30, 50]} emptyMessage="Nenhum ofensor encontrado no recorte." className="tm-responsive-table journey-table">
        <Column header="Indicador" body={(row) => responsiveCell("Indicador", indicatorTag(row.tipo))} sortable />
        <Column header="Data" body={(row) => responsiveCell("Data", dateLabel(row.data))} sortable />
        <Column header="Colaborador" body={(row) => responsiveCell("Colaborador", <div className="journey-person"><strong>{row.colaborador}</strong><small>{row.matricula ? `Matrícula ${row.matricula}` : "Matrícula pendente"}</small></div>)} sortable />
        <Column header="Contrato" body={(row) => responsiveCell("Contrato", <div className="journey-contract"><strong>{row.contrato || "—"}</strong><small>DPTO. {row.departamento || "—"}</small></div>)} />
        <Column header="Resultado" body={(row) => responsiveCell("Resultado", <div className="journey-detail"><strong>{row.detalhe}</strong><small>Conforme resultado do relatório de auditoria</small></div>)} />
        <Column header="Vínculo" body={(row) => responsiveCell("Vínculo", <Tag value={row.vinculo_status === "vinculado" ? "Vinculado" : "Pendente"} severity={row.vinculo_status === "vinculado" ? "success" : "warning"} />)} />
        {canEdit && <Column header="Ações" body={(row) => responsiveCell("Ações", <Button icon={<AppIcon name="pencil" />} text rounded aria-label={`Vincular ${row.colaborador}`} onClick={() => openEdit(row)} />)} />}
      </DataTable>
    </article>

    <OverlayPanel ref={filterPanel} className="journey-filter-panel">
      <div className="journey-filter-title"><div><strong>Filtrar ofensores de jornada</strong><span>Os indicadores e o demonstrativo acompanham o recorte selecionado.</span></div><Button icon={<AppIcon name="filter-off" />} label="Limpar filtros" text severity="secondary" onClick={() => setTypes([])} /></div>
      <label className="journey-filter-field"><span>Indicadores</span><MultiSelect value={types} options={INDICATORS} optionLabel="label" optionValue="value" onChange={(event) => setTypes(event.value || [])} placeholder="Todos os indicadores" display="chip" /></label>
    </OverlayPanel>

    <Dialog header={`Completar vínculo · ${editing?.colaborador || ""}`} visible={Boolean(editing)} modal className="journey-link-dialog" onHide={() => !saving && setEditing(null)} footer={<div className="journey-dialog-actions"><Button label="Cancelar" text disabled={saving} onClick={() => setEditing(null)} /><Button label="Salvar vínculo" icon={<AppIcon name="device-floppy" />} loading={saving} onClick={saveLink} /></div>}>
      {editing && <div className="journey-link-content"><p>Se a matrícula existir na base de colaboradores, o vínculo será concluído automaticamente. Cadastre a matrícula primeiro, caso ela ainda não exista.</p><label><span>Matrícula</span><InputText value={registration} onChange={(event) => setRegistration(event.target.value)} placeholder="Informe a matrícula" /></label></div>}
    </Dialog>
  </section>;
}
