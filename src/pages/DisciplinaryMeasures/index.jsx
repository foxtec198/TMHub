import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Divider } from "primereact/divider";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";

import { PageHeader } from "../../components/PageHeader";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { can } from "../../utils/permissions";
import connect from "../../utils/request";

import "./styles.css";

const ALINEA_LABELS = {
  a: "Improbidade",
  b: "Má conduta",
  c: "Negociação sem permissão",
  d: "Condenação criminal",
  e: "Desídia",
  f: "Embriaguez",
  g: "Violação de segredo",
  h: "Indisciplina/insubordinação",
  i: "Abandono de emprego",
  j: "Ofensa contra pessoa",
  k: "Ofensa à chefia",
  l: "Jogos de azar",
  m: "Perda de habilitação",
};

function alineaOption(...letters) {
  const prefix = letters.length === 1 ? "Alínea" : "Alíneas";
  return {
    value: `alinea_${letters.join("_")}`,
    label: `${prefix} ${letters.map((letter) => letter.toUpperCase()).join("/")} — ${letters.map((letter) => ALINEA_LABELS[letter]).join(" + ")}`,
  };
}

const DEFAULT_OPTIONS = {
  tipos: [
    { label: "Advertência", value: "advertencia" },
    { label: "Suspensão", value: "suspensao" },
  ],
  motivos: [
    ...Object.keys(ALINEA_LABELS).map((letter) => alineaOption(letter)),
    alineaOption("a", "e"),
    alineaOption("b", "h"),
    alineaOption("e", "h"),
    alineaOption("e", "k"),
  ],
};

const emptyFilters = () => ({
  busca: "",
  colaborador_id: [],
  supervisor: [],
  tipo: [],
  motivo: [],
  periodo: null,
});

function dateParam(value) {
  if (!value) return undefined;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

function errorMessage(error, fallback) {
  const data = error.response?.data;
  return typeof data === "string" ? data : data?.message || fallback;
}

export function DisciplinaryMeasures() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ total: 0, advertencias: 0, suspensoes: 0 });
  const [totalRecords, setTotalRecords] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [pagination, setPagination] = useState({ first: 0, rows: 10 });
  const [employees, setEmployees] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [refresh, setRefresh] = useState(0);
  const [importVisible, setImportVisible] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importReport, setImportReport] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const fileInput = useRef(null);
  const filterPanel = useRef(null);
  const filterOptionsLoaded = useRef(false);
  const filterOptionsRequest = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canCreate = can("controle_medidas_disciplinares", "create");
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setTableLoading(true);
      try {
        const { data } = await connect.get("/medidas-disciplinares", {
          signal: controller.signal,
          params: {
            page: Math.floor(pagination.first / pagination.rows) + 1,
            per_page: pagination.rows,
            busca: filters.busca || undefined,
            colaborador_id: filters.colaborador_id.join(",") || undefined,
            supervisor: filters.supervisor.join(",") || undefined,
            tipo: filters.tipo.join(",") || undefined,
            motivo: filters.motivo.join(",") || undefined,
            inicio: dateParam(filters.periodo?.[0]),
            fim: dateParam(filters.periodo?.[1]),
          },
        });
        if (controller.signal.aborted) return;
        setRecords(data.registros || []);
        setSummary(data.resumo || { total: 0, advertencias: 0, suspensoes: 0 });
        setTotalRecords(Number(data.paginacao?.total || 0));
        setOptions({ ...DEFAULT_OPTIONS, ...(data.opcoes || {}) });
      } catch (error) {
        if (controller.signal.aborted || error.code === "ERR_CANCELED") return;
        showToast("error", "Medidas disciplinares", errorMessage(error, "Não foi possível carregar os registros."));
      } finally {
        if (!controller.signal.aborted) setTableLoading(false);
      }
    }, filters.busca ? 350 : 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, pagination.first, pagination.rows, refresh, showToast]);

  const ensureFilterOptions = useCallback(async () => {
    if (filterOptionsLoaded.current) return true;
    if (filterOptionsRequest.current) return filterOptionsRequest.current;

    filterOptionsRequest.current = connect.get("/medidas-disciplinares/opcoes-filtros")
      .then(({ data }) => {
        setEmployees((data.colaboradores || []).map((employee) => ({
          label: `${employee.nome} · ${employee.matricula}`,
          value: employee.id,
        })));
        setSupervisors(data.supervisores || []);
        filterOptionsLoaded.current = true;
        return true;
      })
      .catch((error) => {
        showToast("error", "Filtros", errorMessage(error, "Não foi possível carregar as opções dos filtros."));
        return false;
      })
      .finally(() => {
        filterOptionsRequest.current = null;
      });

    return filterOptionsRequest.current;
  }, [showToast]);

  const updateFilter = useCallback((name, value) => {
    setPagination((current) => (current.first ? { ...current, first: 0 } : current));
    setFilters((current) => ({ ...current, [name]: value }));
  }, []);

  const openImport = () => {
    setImportReport(null);
    setImportFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setImportVisible(true);
  };

  const deleteAll = async () => {
    setLoading(true);
    try {
      const { data } = await connect.delete("/medidas-disciplinares/todos");
      filterOptionsLoaded.current = false;
      setPagination((current) => ({ ...current, first: 0 }));
      setRefresh((value) => value + 1);
      showToast("success", "Exclusão concluída", data.message || "Todos os registros foram excluídos.");
    } catch (error) {
      showToast("error", "Não foi possível excluir", errorMessage(error, "Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteAll = () => confirmDialog({
    header: "Excluir todas as medidas disciplinares",
    message: "Esta ação excluirá permanentemente todos os registros de medidas disciplinares. Deseja continuar?",
    icon: "pi pi-exclamation-triangle",
    acceptLabel: "Excluir tudo",
    rejectLabel: "Voltar",
    acceptClassName: "p-button-danger",
    defaultFocus: "reject",
    accept: deleteAll,
  });

  const importSpreadsheet = async () => {
    if (!importFile) {
      showToast("warn", "Importação", "Selecione uma planilha .xlsx.");
      return;
    }
    const payload = new FormData();
    payload.append("arquivo", importFile);
    setLoading(true);
    try {
      const { data } = await connect.post("/medidas-disciplinares/importar", payload, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setImportReport(data);
      filterOptionsLoaded.current = false;
      setRefresh((value) => value + 1);
      showToast("success", "Importação concluída", `${data.importadas} linha(s) importada(s) e ${data.rejeitadas} rejeitada(s).`);
    } catch (error) {
      showToast("error", "Falha na importação", errorMessage(error, "Não foi possível processar a planilha."));
    } finally {
      setLoading(false);
    }
  };

  const activeFilterCount = [
    Boolean(filters.busca.trim()),
    filters.colaborador_id.length > 0,
    filters.supervisor.length > 0,
    filters.tipo.length > 0,
    filters.motivo.length > 0,
    Boolean(filters.periodo?.[0]),
  ].filter(Boolean).length;

  return (
    <section className="disciplinary-page">
      <ConfirmDialog />
      <PageHeader
        section="Pessoas"
        title="Controle de Medidas Disciplinares"
        description="Histórico, acompanhamento e orientações para advertências e suspensões."
        actions={(
          <div className="disciplinary-header-actions">
            <Button
              type="button"
              icon="pi pi-filter-fill"
              label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"}
              outlined
              onClick={(event) => {
                ensureFilterOptions();
                filterPanel.current?.toggle(event);
              }}
            />
            {canCreate && <Button type="button" icon="pi pi-file-excel" label="Importar" onClick={openImport} />}
            {isAdmin && <Button type="button" icon="pi pi-trash" label="Excluir tudo" severity="danger" outlined onClick={confirmDeleteAll} />}
          </div>
        )}
      />

      <OverlayPanel ref={filterPanel} className="dashboard-filter-panel disciplinary-filter-panel">
        <div className="dashboard-filter-title">
          <div>
            <strong>Filtrar medidas disciplinares</strong>
            <span>As alterações são aplicadas automaticamente.</span>
          </div>
          <Button
            type="button"
            icon="pi pi-filter-slash"
            label="Limpar filtros"
            text
            severity="secondary"
            onClick={() => {
              setPagination((current) => ({ ...current, first: 0 }));
              setFilters(emptyFilters());
            }}
          />
        </div>
        <Divider />
        <div className="dashboard-filter-grid disciplinary-filter-grid">
          <label className="is-wide">
            <span>Busca</span>
            <span className="p-input-icon-left disciplinary-search">
              <i className="pi pi-search" />
              <InputText value={filters.busca} onChange={(event) => updateFilter("busca", event.target.value)} placeholder="Nome, matrícula, supervisor ou observação" />
            </span>
          </label>
          <label>
            <span>Colaboradores</span>
            <MultiSelect value={filters.colaborador_id} options={employees} onChange={(event) => updateFilter("colaborador_id", event.value)} placeholder="Todos os colaboradores" display="chip" filter maxSelectedLabels={1} />
          </label>
          <label>
            <span>Supervisores</span>
            <MultiSelect value={filters.supervisor} options={supervisors} onChange={(event) => updateFilter("supervisor", event.value)} placeholder="Todos os supervisores" display="chip" filter maxSelectedLabels={1} />
          </label>
          <label>
            <span>Tipos</span>
            <MultiSelect value={filters.tipo} options={options.tipos} onChange={(event) => updateFilter("tipo", event.value)} placeholder="Todos os tipos" display="chip" />
          </label>
          <label>
            <span>Alíneas</span>
            <MultiSelect value={filters.motivo} options={options.motivos} onChange={(event) => updateFilter("motivo", event.value)} placeholder="Todas as alíneas" display="chip" filter maxSelectedLabels={1} />
          </label>
          <label>
            <span>Período</span>
            <Calendar value={filters.periodo} onChange={(event) => updateFilter("periodo", event.value)} selectionMode="range" dateFormat="dd/mm/yy" placeholder="Selecione o período" showIcon showButtonBar readOnlyInput />
          </label>
        </div>
      </OverlayPanel>

      <div className="disciplinary-summary">
        <article><span>Registros exibidos</span><strong>{summary.total}</strong></article>
        <article><span>Advertências</span><strong>{summary.advertencias}</strong></article>
        <article><span>Suspensões</span><strong>{summary.suspensoes}</strong></article>
      </div>

      <DataTable value={records} loading={tableLoading} lazy paginator first={pagination.first} rows={pagination.rows} totalRecords={totalRecords} onPage={(event) => setPagination({ first: event.first, rows: event.rows })} rowsPerPageOptions={[10, 25, 50]} emptyMessage="Nenhuma medida disciplinar encontrada." stripedRows scrollable className="tm-responsive-table disciplinary-table">
        <Column field="data_medida" header="Data" body={(row) => formatDate(row.data_medida)} />
        <Column field="colaborador" header="Colaborador" body={(row) => <div className="disciplinary-employee"><strong>{row.colaborador}</strong><small>{row.matricula} · {row.centro_custo || "Sem contrato"}</small></div>} />
        <Column field="supervisor" header="Supervisor da época" body={(row) => row.supervisor || "Sem supervisor"} />
        <Column field="tipo_label" header="Medida" body={(row) => <Tag value={row.tipo_label} severity={row.tipo === "suspensao" ? "warning" : "info"} />} />
        <Column field="motivo_label" header="Alínea / motivo" />
        <Column field="quantidade_dias" header="Dias" body={(row) => row.quantidade_dias || "—"} />
        <Column field="origem" header="Origem" body={(row) => row.origem === "importacao" ? "Planilha" : "Manual"} />
      </DataTable>

      <Dialog visible={importVisible} onHide={() => setImportVisible(false)} header="Importar medidas disciplinares" modal className="disciplinary-import-dialog">
        <div className="disciplinary-import">
          <p>Selecione o relatório “Relação de Advertências e Suspensões”. A API padroniza as alíneas, vincula cada matrícula e grava o supervisor responsável no momento da importação.</p>
          <input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setImportFile(event.target.files?.[0] || null); setImportReport(null); }} />
          <Button label="Processar planilha" icon="pi pi-upload" disabled={!importFile} onClick={importSpreadsheet} />
          {importReport && <div className="disciplinary-import-report"><div className="disciplinary-counts"><div><span>Importadas</span><strong>{importReport.importadas}</strong></div><div><span>Rejeitadas</span><strong>{importReport.rejeitadas}</strong></div></div>{importReport.linhas_rejeitadas?.length > 0 && <DataTable value={importReport.linhas_rejeitadas} size="small" paginator rows={5}><Column field="linha" header="Linha" /><Column field="motivo" header="Motivo da rejeição" /></DataTable>}</div>}
        </div>
      </Dialog>
    </section>
  );
}
