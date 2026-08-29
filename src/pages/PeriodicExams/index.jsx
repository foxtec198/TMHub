import { AppIcon, appIcon } from "../../components/icons/AppIcon";
import { StandardFilterFields } from "../../components/filters/StandardFilterFields";
import { StandardFilterButton } from "../../components/filters/StandardFilterButton";
// Controle de exames periódicos.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { SpeedDial } from "primereact/speeddial";
import { Tag } from "primereact/tag";
import { Tooltip } from "primereact/tooltip";

import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import "../../components/tables/index.css";
import "./styles.css";


const STATUS_OPTIONS = [
  { label: "A vencer", value: "a_vencer" },
  { label: "Pendente", value: "pendente" },
  { label: "Em andamento", value: "em_andamento" },
  { label: "Concluído", value: "concluido" },
];

const EDITABLE_STATUS_OPTIONS = STATUS_OPTIONS.slice(1);

function dateLabel(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "—";
}

function statusTag(status) {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  const severity = {
    a_vencer: "info",
    pendente: "warning",
    em_andamento: "secondary",
    concluido: "success",
  }[status] || "info";
  return <Tag value={option?.label || status} severity={severity} />;
}

function responsiveCell(label, content) {
  return <div className="tm-table-cell">
    <span className="tm-table-card-label">{label}</span>
    <div className="tm-table-card-value">{content ?? "—"}</div>
  </div>;
}

function errorMessage(error, fallback) {
  const response = error.response?.data;
  return typeof response === "string" ? response : response?.message || fallback;
}

export function PeriodicExams() {
  const { showToast } = useToast();
  const filterPanel = useRef(null);
  const fileInput = useRef(null);
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  const [records, setRecords] = useState([]);
  const [options, setOptions] = useState({});
  const [filters, setFilters] = useState({ status: [], departamento: [], supervisor: [], contrato: [], competencia: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ status: "pendente", observacao: "" });
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("concluido");
  const [bulkByFilter, setBulkByFilter] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  const params = useMemo(() => ({
    search: search.trim() || undefined,
    status: filters.status.join(",") || undefined,
    departamento: filters.departamento.join(",") || undefined,
    supervisor: filters.supervisor.join(",") || undefined,
    contrato: filters.contrato.join(",") || undefined,
    competencia: filters.competencia.join(",") || undefined,
  }), [filters, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await connect.get("/exames-periodicos", { params });
      setRecords(Array.isArray(data?.registros) ? data.registros : []);
      setOptions(data?.filtros || {});
    } catch (error) {
      showToast("error", "Exames periódicos", errorMessage(error, "Não foi possível carregar o controle."));
    } finally {
      setLoading(false);
    }
  }, [params, showToast]);

  useEffect(() => {
    // Agenda o carregamento após a montagem para não encadear renderizações.
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load, revision]);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    socketio.on("periodic_exam_update", refresh);
    return () => socketio.off("periodic_exam_update", refresh);
  }, []);

  const filterCount = Object.values(filters).filter((values) => values.length).length;
  const availableStatusOptions = useMemo(() => (
    (options.status || []).map((value) => STATUS_OPTIONS.find((option) => option.value === value)).filter(Boolean)
  ), [options.status]);
  const updateFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value || [] }));
  const clearFilters = () => setFilters({ status: [], departamento: [], supervisor: [], contrato: [], competencia: [] });

  const openEdit = (record) => {
    setEditing(record);
    setEditForm({ status: record.status, observacao: record.observacao || "" });
  };

  const saveEdit = async () => {
    try {
      await connect.patch(`/exames-periodicos/${editing.id}`, editForm);
      showToast("success", "Exame atualizado", "A tratativa foi registrada.");
      setEditing(null);
      setRevision((value) => value + 1);
    } catch (error) {
      showToast("error", "Exame periódico", errorMessage(error, "Não foi possível salvar a alteração."));
    }
  };

  const importSpreadsheet = async () => {
    const file = fileInput.current?.files?.[0];
    if (!file) return showToast("warn", "Planilha SST", "Selecione uma planilha .xlsx ou .xls.");
    if (file.size > 25 * 1024 * 1024) return showToast("warn", "Planilha SST", "O arquivo deve ter no máximo 25 MB.");
    const payload = new FormData();
    payload.append("file", file);
    setImporting(true);
    try {
      const { data } = await connect.post("/exames-periodicos/importar", payload, { timeout: 120000 });
      showToast("success", "Importação concluída", `${data.criados || 0} criado(s) e ${data.atualizados || 0} atualizado(s).`);
      setImportOpen(false);
      if (fileInput.current) fileInput.current.value = "";
      setRevision((value) => value + 1);
    } catch (error) {
      const details = error.response?.data?.errors?.slice(0, 3)?.join(" ");
      showToast("error", "Falha na importação", details || errorMessage(error, "Confira a planilha SST e tente novamente."));
    } finally {
      setImporting(false);
    }
  };

  const exportSpreadsheet = async () => {
    if (!records.length) return showToast("warn", "Exportação", "Não há exames para exportar com os filtros atuais.");
    setExporting(true);
    try {
      const { data } = await connect.get("/exames-periodicos/exportar", { params, responseType: "blob" });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "controle_exames_periodicos.xlsx";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      showToast("error", "Falha na exportação", errorMessage(error, "Não foi possível exportar os exames."));
    } finally {
      setExporting(false);
    }
  };

  const updateBulk = async () => {
    if (!selected.length && !bulkByFilter) return;
    try {
      const payload = bulkByFilter
        ? {
          departamento: filters.departamento[0],
          competencia: filters.competencia[0],
          status: bulkStatus,
        }
        : { ids: selected.map((record) => record.id), status: bulkStatus };
      const { data } = await connect.patch("/exames-periodicos/lote/status", payload);
      showToast("success", "Atualização em lote", `${data.total} exame(s) atualizado(s).`);
      setSelected([]);
      setBulkByFilter(false);
      setBulkOpen(false);
      setRevision((value) => value + 1);
    } catch (error) {
      showToast("error", "Atualização em lote", errorMessage(error, "Não foi possível atualizar os exames selecionados."));
    }
  };

  const deleteAll = async () => {
    try {
      const { data } = await connect.delete("/exames-periodicos/todos");
      showToast("success", "Exames excluídos", `${data.total} registro(s) foram removidos.`);
      setDeleteAllOpen(false);
      setSelected([]);
      setRevision((value) => value + 1);
    } catch (error) {
      showToast("error", "Exclusão", errorMessage(error, "Não foi possível excluir os exames."));
    }
  };

  const speedDialItems = [
    { label: "Importar planilha SST", icon: appIcon("upload"), command: () => setImportOpen(true) },
    { label: exporting ? "Exportando..." : "Exportar XLSX", icon: appIcon("file-spreadsheet"), disabled: exporting || !records.length, command: exportSpreadsheet },
  ];

  return <section className="periodic-exams-page">
    <PageHeader
      section="Recursos humanos"
      title="Exames periódicos"
      description="Acompanhe vencimentos, pendências e conclusões dos exames ocupacionais."
      actions={<>
        <StandardFilterButton panelRef={filterPanel} count={filterCount} />
        {selected.length > 0 && <Button icon={<AppIcon name="square-check" />} label={`Atualizar (${selected.length})`} onClick={() => { setBulkByFilter(false); setBulkOpen(true); }} />}
        {isAdmin && <Button icon={<AppIcon name="trash" />} label="Excluir tudo" severity="danger" outlined disabled={!records.length} onClick={() => setDeleteAllOpen(true)} />}
      </>}
    />

    <article className="periodic-exams-panel">
      <div className="periodic-exams-panel-head">
        <div><span>Controle operacional</span><h2>Exames importados</h2></div>
        <span>{records.length} registro(s)</span>
      </div>
      <div className="periodic-exams-search">
        <span className="p-input-icon-left">
          <AppIcon name="search"  />
          <InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar colaborador, matrícula ou contrato" />
        </span>
      </div>
      <DataTable value={records} loading={loading} dataKey="id" selection={selected} onSelectionChange={(event) => setSelected(event.value)} selectionMode="checkbox" metaKeySelection={false} paginator rows={15} rowsPerPageOptions={[15, 30, 50]} emptyMessage="Nenhum exame encontrado para o recorte selecionado." className="tm-responsive-table periodic-exams-table">
        <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
        <Column header="Colaborador" body={(row) => responsiveCell("Colaborador", <div className="periodic-exam-person"><strong>{row.colaborador}</strong><small>Matrícula {row.matricula}</small></div>)} sortable />
        <Column header="Contrato" body={(row) => responsiveCell("Contrato", <div className="periodic-exam-contract"><strong>{row.centro_custo || "—"}</strong><small>DPTO. {row.departamento || "—"}</small></div>)} />
        <Column header="Supervisor" body={(row) => responsiveCell("Supervisor", row.supervisor)} />
        <Column header="Exame" body={(row) => responsiveCell("Exame", <div className="periodic-exam-type"><strong>{row.tipo_exame}</strong><small>{row.resultado || "Sem resultado informado"}</small></div>)} />
        <Column header="Vencimento" body={(row) => responsiveCell("Vencimento", <div className={row.vencido ? "periodic-exam-due is-overdue" : "periodic-exam-due"}><strong>{dateLabel(row.data_vencimento)}</strong><small>{row.vencido ? `${Math.abs(row.dias_para_vencimento)} dia(s) em atraso` : `${row.dias_para_vencimento} dia(s)`}</small></div>)} sortable />
        <Column header="Situação" body={(row) => responsiveCell("Situação", statusTag(row.status))} />
        <Column header="Ações" body={(row) => responsiveCell("Ações", <Button icon={<AppIcon name="pencil" />} rounded text aria-label={`Editar exame de ${row.colaborador}`} onClick={() => openEdit(row)} />)} />
      </DataTable>
    </article>

    <OverlayPanel ref={filterPanel} className="periodic-exams-filter-panel">
      <div className="periodic-exams-filter-title"><div><strong>Filtrar exames</strong><span>A lista e os indicadores acompanham este recorte.</span></div><Button icon={<AppIcon name="filter-off" />} text rounded aria-label="Limpar filtros" onClick={clearFilters} /></div>
      <StandardFilterFields department={{ value: filters.departamento, options: options.departamento, onChange: (value) => updateFilter("departamento", value) }} center={{ value: filters.contrato, options: options.contrato, onChange: (value) => updateFilter("contrato", value) }} />
      <div className="periodic-exams-filters">
        <label><span>Situação</span><MultiSelect value={filters.status} options={availableStatusOptions} optionLabel="label" optionValue="value" onChange={(event) => updateFilter("status", event.value)} placeholder="Todas as situações" display="chip" /></label>
        <label><span>Supervisor</span><MultiSelect value={filters.supervisor} options={options.supervisor || []} onChange={(event) => updateFilter("supervisor", event.value)} placeholder="Todos os supervisores" display="chip" filter /></label>
        <label><span>Mês de vencimento</span><MultiSelect value={filters.competencia} options={(options.competencia || []).map((value) => ({ label: value.split("-").reverse().join("/"), value }))} optionLabel="label" optionValue="value" onChange={(event) => updateFilter("competencia", event.value)} placeholder="Todos os meses" display="chip" /></label>
      </div>
    </OverlayPanel>

    <div className="periodic-exams-speed-dial">
      <Tooltip target=".periodic-exams-speed-dial .p-speeddial-action" position="left" showDelay={150} />
      <SpeedDial model={speedDialItems} type="quarter-circle" direction="up-left" radius={132} showIcon={<AppIcon name="plus" />} hideIcon={<AppIcon name="x" />} aria-label="Ações de exames periódicos" />
    </div>

    <Dialog header={`Editar exame · ${editing?.colaborador || ""}`} visible={Boolean(editing)} modal className="periodic-exam-dialog" onHide={() => setEditing(null)} footer={<div className="periodic-exam-dialog-actions"><Button label="Cancelar" text onClick={() => setEditing(null)} /><Button label="Salvar alterações" icon={<AppIcon name="device-floppy" />} onClick={saveEdit} /></div>}>
      {editing && <div className="periodic-exam-form">
        <div className="periodic-exam-context"><strong>{editing.tipo_exame}</strong><span>{editing.centro_custo} · vence em {dateLabel(editing.data_vencimento)}</span></div>
        <label><span>Situação</span><Dropdown value={editForm.status} options={EDITABLE_STATUS_OPTIONS} optionLabel="label" optionValue="value" onChange={(event) => setEditForm((current) => ({ ...current, status: event.value }))} /></label>
        <label><span>Observação</span><InputTextarea value={editForm.observacao} onChange={(event) => setEditForm((current) => ({ ...current, observacao: event.target.value }))} rows={4} autoResize maxLength={500} /></label>
      </div>}
    </Dialog>

    <Dialog header="Importar relatório SST" visible={importOpen} modal className="periodic-exam-import-dialog" closable={!importing} onHide={() => !importing && setImportOpen(false)} footer={<div className="periodic-exam-dialog-actions"><Button label="Cancelar" text disabled={importing} onClick={() => setImportOpen(false)} /><Button label={importing ? "Importando..." : "Importar"} icon={<AppIcon name="upload" />} loading={importing} disabled={importing} onClick={importSpreadsheet} /></div>}>
      <div className="periodic-exam-import-content"><p>Use o relatório SST. A importação identifica o colaborador por empresa e matrícula, ignora afastados/demitidos e não duplica exames já cadastrados.</p><input ref={fileInput} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" disabled={importing} /></div>
    </Dialog>

    <Dialog header={bulkByFilter ? "Atualizar exames do recorte" : "Atualizar exames selecionados"} visible={bulkOpen} modal className="periodic-exam-bulk-dialog" onHide={() => setBulkOpen(false)} footer={<div className="periodic-exam-dialog-actions"><Button label="Cancelar" text onClick={() => setBulkOpen(false)} /><Button label="Confirmar" icon={<AppIcon name="check" />} onClick={updateBulk} /></div>}>
      <div className="periodic-exam-form"><p>{bulkByFilter ? `Todos os exames do departamento ${filters.departamento[0]} com vencimento em ${filters.competencia[0].split("-").reverse().join("/")}.` : `${selected.length} exame(s) selecionado(s).`}</p><label><span>Nova situação</span><Dropdown value={bulkStatus} options={EDITABLE_STATUS_OPTIONS} optionLabel="label" optionValue="value" onChange={(event) => setBulkStatus(event.value)} /></label></div>
    </Dialog>

    <Dialog header="Excluir todos os exames" visible={deleteAllOpen} modal className="periodic-exam-delete-dialog" onHide={() => setDeleteAllOpen(false)} footer={<div className="periodic-exam-dialog-actions"><Button label="Cancelar" text onClick={() => setDeleteAllOpen(false)} /><Button label="Excluir tudo" icon={<AppIcon name="trash" />} severity="danger" onClick={deleteAll} /></div>}>
      <p>Esta ação remove todos os exames importados do controle. Ela não pode ser desfeita.</p>
    </Dialog>
  </section>;
}
