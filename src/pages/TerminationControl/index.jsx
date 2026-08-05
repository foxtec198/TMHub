import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";

import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import { PageHeader } from "../../components/PageHeader";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { can } from "../../utils/permissions";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import "./styles.css";


const REASON_OPTIONS = [
  { label: "Dispensa sem justa causa", value: "sem_justa_causa" },
  { label: "Pedido de demissão", value: "pedido_demissao" },
  { label: "Extinção por acordo", value: "acordo" },
  { label: "Dispensa por justa causa", value: "justa_causa" },
  { label: "Término de experiência / contrato determinado", value: "termino_contrato" },
];

const EXPERIENCE_REASON_OPTIONS = REASON_OPTIONS.filter(({ value }) =>
  ["pedido_demissao", "termino_contrato"].includes(value),
);
const EXPERIENCE_DAYS = 90;
const FGTS_BALANCE_DISABLED_REASONS = new Set(["pedido_demissao", "justa_causa"]);

const NOTICE_OPTIONS = [
  { label: "Indenizado", value: "indenizado" },
  { label: "Trabalhado", value: "trabalhado" },
  { label: "Descontado", value: "descontado" },
  { label: "Dispensado", value: "dispensado" },
  { label: "Não aplicável", value: "nao_aplicavel" },
];

const EMPTY_CALCULATION = {
  colaborador_id: null,
  colaborador: null,
  data_demissao: null,
  motivo: "sem_justa_causa",
  tipo_aviso: "indenizado",
  saldo_fgts: null,
  ferias_integrais: 0,
  ferias_em_dobro: 0,
  outras_verbas: 0,
  descontos: 0,
};

const EARNING_LABELS = {
  saldo_salario: "Saldo de salário",
  decimo_terceiro_proporcional: "13º proporcional",
  ferias_proporcionais: "Férias proporcionais",
  terco_ferias_proporcionais: "1/3 de férias proporcionais",
  ferias_integrais: "Férias integrais",
  terco_ferias_integrais: "1/3 de férias integrais",
  ferias_em_dobro: "Férias em dobro",
  terco_ferias_em_dobro: "1/3 de férias em dobro",
  aviso_previo_indenizado: "Aviso prévio indenizado",
  outras_verbas: "Outras verbas",
};

const DISCOUNT_LABELS = {
  descontos_informados: "Descontos informados",
  desconto_aviso_previo: "Desconto de aviso prévio",
  fgts_sobre_rescisao: "FGTS sobre verbas rescisórias",
  fgts_sobre_decimo_terceiro: "FGTS sobre o 13º proporcional",
};

function defaultPeriod() {
  const today = new Date();
  return [new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31)];
}

function isoDate(value) {
  if (!value) return null;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function localDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const raw = String(value).slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function addDays(value, days) {
  const result = localDate(value);
  if (!result) return null;
  result.setDate(result.getDate() + days);
  return result;
}

function completeYears(startValue, endValue) {
  const start = localDate(startValue);
  const end = localDate(endValue);
  if (!start || !end) return 0;
  let years = end.getFullYear() - start.getFullYear();
  if (
    end.getMonth() < start.getMonth()
    || (end.getMonth() === start.getMonth() && end.getDate() < start.getDate())
  ) years -= 1;
  return Math.max(0, years);
}

function dateLabel(value) {
  if (!value) return "—";
  return localDate(value)?.toLocaleDateString("pt-BR") || "—";
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function errorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.slice(0, 4).join(" ");
  if (!error?.response) return "Não foi possível conectar ao servidor.";
  return fallback;
}

function TerminationControlContent() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [filterOptions, setFilterOptions] = useState({ motivos: [], departamentos: [], centros: [], supervisores: [] });
  const [period, setPeriod] = useState(defaultPeriod);
  const [filters, setFilters] = useState({ motivo: null, departamento: null, centro_custo_id: null, supervisor_id: null });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [calculationOpen, setCalculationOpen] = useState(false);
  const [calculationForm, setCalculationForm] = useState(EMPTY_CALCULATION);
  const [calculation, setCalculation] = useState(null);
  const filterPanel = useRef(null);
  const fileInput = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canImport = can("controle_rescisoes", "create");
  const canEdit = can("controle_rescisoes", "edit");
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

  const admissionDate = useMemo(
    () => localDate(calculationForm.colaborador?.data_admissao),
    [calculationForm.colaborador?.data_admissao],
  );
  const experienceEndDate = useMemo(
    () => addDays(admissionDate, EXPERIENCE_DAYS - 1),
    [admissionDate],
  );
  const inExperiencePeriod = useMemo(() => {
    const dismissalDate = localDate(calculationForm.data_demissao);
    if (!admissionDate || !dismissalDate || !experienceEndDate) return false;
    return dismissalDate >= admissionDate && dismissalDate <= experienceEndDate;
  }, [admissionDate, calculationForm.data_demissao, experienceEndDate]);
  const reasonOptions = inExperiencePeriod ? EXPERIENCE_REASON_OPTIONS : REASON_OPTIONS;
  const fgtsBalanceDisabled = FGTS_BALANCE_DISABLED_REASONS.has(calculationForm.motivo);
  const noticeDaysPreview = useMemo(() => {
    if (!admissionDate || !calculationForm.data_demissao) return 30;
    return Math.min(90, 30 + (3 * completeYears(admissionDate, calculationForm.data_demissao)));
  }, [admissionDate, calculationForm.data_demissao]);
  const workedNoticeEndDate = useMemo(() => {
    const isEmployerDismissal = ["sem_justa_causa", "acordo"].includes(calculationForm.motivo);
    if (
      calculationForm.tipo_aviso !== "trabalhado"
      || !isEmployerDismissal
      || inExperiencePeriod
      || !calculationForm.data_demissao
    ) return null;
    return addDays(calculationForm.data_demissao, Math.max(0, noticeDaysPreview - 7));
  }, [calculationForm.data_demissao, calculationForm.motivo, calculationForm.tipo_aviso, inExperiencePeriod, noticeDaysPreview]);

  useEffect(() => {
    if (!inExperiencePeriod) return;
    setCalculationForm((current) => {
      const nextReason = ["pedido_demissao", "termino_contrato"].includes(current.motivo)
        ? current.motivo
        : "termino_contrato";
      if (current.motivo === nextReason && current.tipo_aviso === "nao_aplicavel") return current;
      return { ...current, motivo: nextReason, tipo_aviso: "nao_aplicavel" };
    });
    setCalculation(null);
  }, [inExperiencePeriod]);

  useEffect(() => {
    if (!fgtsBalanceDisabled) return;
    setCalculationForm((current) => (
      current.saldo_fgts === null ? current : { ...current, saldo_fgts: null }
    ));
    setCalculation(null);
  }, [fgtsBalanceDisabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const requestParams = useMemo(() => {
    const params = {};
    if (period?.[0]) params.inicio = isoDate(period[0]);
    if (period?.[1]) params.fim = isoDate(period[1]);
    if (debouncedSearch) params.busca = debouncedSearch;
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== "") params[key] = value;
    });
    return params;
  }, [debouncedSearch, filters, period]);

  const loadRecords = useCallback(async () => {
    try {
      const { data } = await connect.get("/rescisoes", { params: requestParams });
      setRecords(Array.isArray(data?.registros) ? data.registros : []);
      setSummary(data?.resumo || {});
      setFilterOptions(data?.filtros || { motivos: [], departamentos: [], centros: [], supervisores: [] });
    } catch (error) {
      showToast("error", "Controle de Rescisões", errorMessage(error, "Não foi possível carregar as rescisões."));
    }
  }, [requestParams, showToast]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords, revision]);

  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    socketio.on("termination_update", reload);
    return () => socketio.off("termination_update", reload);
  }, []);

  const activeFilterCount = Object.values(filters).filter((value) => value !== null && value !== "").length
    + (period?.[0] || period?.[1] ? 1 : 0);

  function clearFilters() {
    setPeriod(null);
    setFilters({ motivo: null, departamento: null, centro_custo_id: null, supervisor_id: null });
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
      const { data } = await connect.post("/rescisoes/importar", payload);
      showToast("success", "Importação concluída", data?.message || "Rescisões importadas.");
      setImportOpen(false);
      setImportFile(null);
      setRevision((value) => value + 1);
    } catch (error) {
      showToast("error", "Falha na importação", errorMessage(error, "Não foi possível importar a planilha."));
    } finally {
      setLoading(false);
    }
  }

  async function removeRecord(record) {
    if (!window.confirm(`Excluir a rescisão de ${record.nome} em ${dateLabel(record.data_demissao)}?`)) return;
    setLoading(true);
    try {
      await connect.delete(`/rescisoes/${record.id}`);
      showToast("success", "Controle de Rescisões", "Rescisão excluída.");
      setRevision((value) => value + 1);
    } catch (error) {
      showToast("error", "Controle de Rescisões", errorMessage(error, "Não foi possível excluir a rescisão."));
    } finally {
      setLoading(false);
    }
  }

  async function removeAllRecords() {
    setDeleteAllOpen(false);
    setLoading(true);
    try {
      const { data } = await connect.delete("/rescisoes/todos");
      showToast("success", "Controle de Rescisões", data?.message || "Todas as rescisões foram excluídas.");
      setRevision((value) => value + 1);
    } catch (error) {
      showToast("error", "Controle de Rescisões", errorMessage(error, "Não foi possível excluir todas as rescisões."));
    } finally {
      setLoading(false);
    }
  }

  function openCalculation() {
    setCalculationForm({ ...EMPTY_CALCULATION });
    setCalculation(null);
    setCalculationOpen(true);
  }

  function changeCalculationEmployee(employeeId, employee) {
    setCalculationForm((current) => ({
      ...current,
      colaborador_id: employeeId,
      colaborador: employee || null,
    }));
    setCalculation(null);
  }

  function changeCalculation(field, value) {
    setCalculationForm((current) => ({ ...current, [field]: value }));
    setCalculation(null);
  }

  async function calculateTermination() {
    if (!calculationForm.colaborador_id || !calculationForm.data_demissao) {
      showToast("warn", "Calcular rescisão", "Informe o colaborador e a data de demissão.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...calculationForm,
        colaborador: undefined,
        data_demissao: isoDate(calculationForm.data_demissao),
      };
      const { data } = await connect.post("/rescisoes/calcular", payload);
      setCalculation(data);
    } catch (error) {
      showToast("error", "Calcular rescisão", errorMessage(error, "Não foi possível calcular a provisão."));
    } finally {
      setLoading(false);
    }
  }

  const employeeBody = (row) => (
    <div className="termination-main-cell">
      <strong title={row.nome}>{row.nome}</strong>
      <small>Matrícula {row.matricula}</small>
    </div>
  );

  const contractBody = (row) => (
    <div className="termination-main-cell">
      <strong title={row.centro_custo}>{row.centro_custo}</strong>
      <small>DPTO. {row.departamento ?? "—"} · {row.supervisor}</small>
      {row.filiais?.length > 0 && <div className="termination-tags">{row.filiais.map((branch) => <Tag key={branch} value={branch} severity="success" rounded />)}</div>}
    </div>
  );

  const reasonBody = (row) => <span className="termination-reason" title={row.motivo_rescisao}>{row.motivo_rescisao}</span>;

  return (
    <section className="termination-page">
      <PageHeader
        section="Admissão"
        title="Controle de Rescisões"
        description="Acompanhe valores calculados por filial e simule provisões antes do desligamento."
        actions={<>
          <Button
            label={`Filtros${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
            icon="pi pi-filter"
            outlined
            onClick={(event) => filterPanel.current?.toggle(event)}
          />
          <Button label="Calcular rescisão" icon="pi pi-calculator" outlined onClick={openCalculation} />
          {canImport && <Button label="Importar planilha" icon="pi pi-file-import" onClick={() => setImportOpen(true)} />}
          {isAdmin && <Button label="Excluir tudo" icon="pi pi-trash" severity="danger" outlined disabled={!records.length} onClick={() => setDeleteAllOpen(true)} />}
        </>}
      />

      <div className="termination-summary">
        <article><i className="pi pi-users" /><div><small>Rescisões</small><strong>{summary.total || 0}</strong><span>no período filtrado</span></div></article>
        <article><i className="pi pi-arrow-up-right" /><div><small>Proventos</small><strong>{money(summary.proventos)}</strong><span>valor bruto</span></div></article>
        <article className="is-danger"><i className="pi pi-arrow-down-right" /><div><small>Descontos</small><strong>{money(summary.descontos)}</strong><span>retenções informadas</span></div></article>
        <article className="is-success"><i className="pi pi-wallet" /><div><small>Líquido</small><strong>{money(summary.liquido)}</strong><span>pago aos colaboradores</span></div></article>
        <article className="is-warning"><i className="pi pi-building-columns" /><div><small>FGTS rescisório</small><strong>{money(summary.fgts_rescisorio)}</strong><span>guia rescisória</span></div></article>
        <article><i className="pi pi-chart-line" /><div><small>Custo bruto</small><strong>{money(summary.custo_bruto)}</strong><span>proventos + FGTS</span></div></article>
      </div>

      <article className="termination-panel">
        <div className="termination-toolbar">
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, matrícula, motivo, contrato ou supervisor" />
          </span>
          <span>{records.length} registro(s)</span>
        </div>
        <DataTable
          value={records}
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50, 100]}
          stripedRows
          size="small"
          dataKey="id"
          scrollable
          emptyMessage="Nenhuma rescisão encontrada para os filtros aplicados."
          tableStyle={{ minWidth: "94rem" }}
        >
          <Column field="data_demissao" header="Demissão" sortable body={(row) => dateLabel(row.data_demissao)} style={{ minWidth: "8rem" }} />
          <Column field="nome" header="Colaborador" sortable body={employeeBody} style={{ minWidth: "17rem" }} />
          <Column field="centro_custo" header="Filial / contrato" body={contractBody} style={{ minWidth: "20rem" }} />
          <Column field="motivo_rescisao" header="Motivo" body={reasonBody} style={{ minWidth: "16rem", maxWidth: "20rem" }} />
          <Column field="data_admissao" header="Admissão" body={(row) => dateLabel(row.data_admissao)} style={{ minWidth: "8rem" }} />
          <Column field="aviso" header="Aviso" body={(row) => row.aviso || "—"} style={{ minWidth: "7rem" }} />
          <Column field="proventos" header="Proventos" sortable body={(row) => money(row.proventos)} style={{ minWidth: "9rem" }} />
          <Column field="descontos" header="Descontos" sortable body={(row) => money(row.descontos)} style={{ minWidth: "9rem" }} />
          <Column field="liquido" header="Líquido" sortable body={(row) => <strong>{money(row.liquido)}</strong>} style={{ minWidth: "9rem" }} />
          <Column field="fgts_rescisorio" header="FGTS rescisório" sortable body={(row) => money(row.fgts_rescisorio)} style={{ minWidth: "10rem" }} />
          {canEdit && <Column header="Ações" frozen alignFrozen="right" body={(row) => <Button icon="pi pi-trash" severity="danger" rounded text aria-label="Excluir rescisão" onClick={() => removeRecord(row)} />} style={{ width: "5rem" }} />}
        </DataTable>
      </article>

      <OverlayPanel ref={filterPanel} className="termination-filter-panel">
        <div className="termination-filter-heading">
          <div><strong>Filtrar rescisões</strong><span>Os indicadores acompanham este recorte.</span></div>
          <Button icon="pi pi-filter-slash" rounded text aria-label="Limpar filtros" onClick={clearFilters} />
        </div>
        <div className="termination-filter-grid">
          <label className="is-wide"><span>Período de demissão</span><Calendar value={period} onChange={(event) => setPeriod(event.value)} selectionMode="range" dateFormat="dd/mm/yy" showIcon readOnlyInput hideOnRangeSelection /></label>
          <label className="is-wide"><span>Motivo</span><Dropdown value={filters.motivo} options={(filterOptions.motivos || []).map((value) => ({ label: value, value }))} onChange={(event) => setFilters((current) => ({ ...current, motivo: event.value }))} placeholder="Todos os motivos" showClear filter /></label>
          <label><span>Departamento</span><Dropdown value={filters.departamento} options={(filterOptions.departamentos || []).map((value) => ({ label: `DPTO. ${value}`, value }))} onChange={(event) => setFilters((current) => ({ ...current, departamento: event.value }))} placeholder="Todos" showClear /></label>
          <label><span>Contrato</span><Dropdown value={filters.centro_custo_id} options={filterOptions.centros || []} onChange={(event) => setFilters((current) => ({ ...current, centro_custo_id: event.value }))} placeholder="Todos" showClear filter /></label>
          <label className="is-wide"><span>Supervisor</span><Dropdown value={filters.supervisor_id} options={filterOptions.supervisores || []} onChange={(event) => setFilters((current) => ({ ...current, supervisor_id: event.value }))} placeholder="Todos os supervisores" showClear filter /></label>
        </div>
      </OverlayPanel>

      <Dialog
        header="Excluir todas as rescisões"
        visible={deleteAllOpen}
        modal
        dismissableMask
        draggable={false}
        className="termination-delete-dialog"
        onHide={() => setDeleteAllOpen(false)}
      >
        <div className="termination-delete-content">
          <span className="termination-delete-icon" aria-hidden="true">
            <i className="pi pi-exclamation-triangle" />
          </span>
          <div>
            <strong>Confirma a exclusão de todos os dados?</strong>
            <p>Todas as rescisões importadas serão removidas permanentemente.</p>
            <div className="termination-delete-warning">
              <i className="pi pi-info-circle" />
              <span>A situação 8 dos colaboradores não será alterada. Esta ação não pode ser desfeita.</span>
            </div>
          </div>
        </div>
        <div className="termination-dialog-actions termination-delete-actions">
          <Button label="Cancelar" outlined onClick={() => setDeleteAllOpen(false)} />
          <Button label="Excluir todos" icon="pi pi-trash" severity="danger" onClick={removeAllRecords} autoFocus />
        </div>
      </Dialog>

      <Dialog header="Importar rescisões" visible={importOpen} modal className="termination-import-dialog" onHide={() => { setImportOpen(false); setImportFile(null); }}>
        <div className="termination-import-content">
          <div className="termination-import-note"><i className="pi pi-info-circle" /><span>Use a planilha “Relação de Rescisões Calculadas”. A matrícula vincula cada linha ao colaborador e define automaticamente filial, departamento, contrato e supervisor.</span></div>
          <button type="button" className={`termination-dropzone ${importFile ? "has-file" : ""}`} onClick={() => fileInput.current?.click()}>
            <input ref={fileInput} type="file" accept=".xlsx" onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
            <i className={`pi ${importFile ? "pi-file-check" : "pi-cloud-upload"}`} />
            <strong>{importFile?.name || "Selecionar planilha .xlsx"}</strong>
            <span>{importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : "A reimportação da mesma matrícula e data atualiza o registro existente."}</span>
          </button>
          <div className="termination-dialog-actions"><Button label="Cancelar" text onClick={() => setImportOpen(false)} /><Button label="Importar" icon="pi pi-check" onClick={importSpreadsheet} disabled={!importFile} /></div>
        </div>
      </Dialog>

      <Dialog header="Calcular rescisão" visible={calculationOpen} modal maximizable className="termination-calculation-dialog" onHide={() => setCalculationOpen(false)}>
        <div className="termination-calculation-layout">
          <div className="termination-calculation-form">
            <label className="is-wide">
              <span>Colaborador</span>
              <CollaboratorDropdown
                value={calculationForm.colaborador_id}
                selectedOption={calculationForm.colaborador}
                queryParams={{ com_local: true }}
                onChange={changeCalculationEmployee}
                placeholder="Pesquise por nome ou matrícula"
              />
            </label>
            <label>
              <span>{calculationForm.tipo_aviso === "trabalhado" ? "Data de início do aviso" : "Data prevista da demissão"}</span>
              <Calendar value={calculationForm.data_demissao} onChange={(event) => changeCalculation("data_demissao", event.value)} dateFormat="dd/mm/yy" showIcon />
            </label>
            <label><span>Motivo</span><Dropdown value={calculationForm.motivo} options={reasonOptions} onChange={(event) => changeCalculation("motivo", event.value)} /></label>
            <label>
              <span>Aviso prévio</span>
              <Dropdown
                value={calculationForm.tipo_aviso}
                options={NOTICE_OPTIONS}
                onChange={(event) => changeCalculation("tipo_aviso", event.value)}
                disabled={inExperiencePeriod}
              />
            </label>
            <label>
              <span>Saldo atual do FGTS</span>
              <InputNumber
                value={calculationForm.saldo_fgts}
                onValueChange={(event) => changeCalculation("saldo_fgts", event.value)}
                mode="currency"
                currency="BRL"
                locale="pt-BR"
                min={0}
                disabled={fgtsBalanceDisabled}
                placeholder={fgtsBalanceDisabled ? "Não aplicável ao motivo" : "Calculado automaticamente"}
              />
            </label>
            {inExperiencePeriod && (
              <div className="termination-calculation-info is-wide is-experience">
                <i className="pi pi-clock" />
                <div>
                  <strong>Colaborador em período de experiência</strong>
                  <span>Até {dateLabel(experienceEndDate)}. O motivo fica limitado a pedido de demissão ou término de experiência, sem aviso prévio.</span>
                </div>
              </div>
            )}
            {workedNoticeEndDate && (
              <div className="termination-calculation-info is-wide is-notice">
                <i className="pi pi-calendar" />
                <div>
                  <strong>Término previsto do aviso: {dateLabel(workedNoticeEndDate)}</strong>
                  <span>{noticeDaysPreview} dias de aviso − 7 dias de redução = {Math.max(0, noticeDaysPreview - 7)} dias trabalhados.</span>
                </div>
              </div>
            )}
            {fgtsBalanceDisabled && (
              <div className="termination-calculation-info is-wide is-restricted">
                <i className="pi pi-lock" />
                <div>
                  <strong>Saldo do FGTS não aplicável</strong>
                  <span>Para pedido de demissão ou justa causa, o saldo não participa do cálculo da multa.</span>
                </div>
              </div>
            )}
            <label><span>Férias integrais não gozadas</span><InputNumber value={calculationForm.ferias_integrais} onValueChange={(event) => changeCalculation("ferias_integrais", event.value || 0)} min={0} max={10} showButtons /></label>
            <label><span>Férias vencidas em dobro</span><InputNumber value={calculationForm.ferias_em_dobro} onValueChange={(event) => changeCalculation("ferias_em_dobro", event.value || 0)} min={0} max={10} showButtons /></label>
            <label><span>Outras verbas estimadas</span><InputNumber value={calculationForm.outras_verbas} onValueChange={(event) => changeCalculation("outras_verbas", event.value || 0)} mode="currency" currency="BRL" locale="pt-BR" min={0} /></label>
            <label><span>Descontos informados</span><InputNumber value={calculationForm.descontos} onValueChange={(event) => changeCalculation("descontos", event.value || 0)} mode="currency" currency="BRL" locale="pt-BR" min={0} /></label>
            <div className="termination-calculate-action is-wide"><Button label="Gerar provisão" icon="pi pi-calculator" onClick={calculateTermination} /></div>
          </div>

          <div className={`termination-calculation-result ${calculation ? "has-result" : ""}`}>
            {!calculation ? <div className="termination-result-empty"><i className="pi pi-calculator" /><strong>Memória de cálculo</strong><span>Preencha os dados para visualizar a provisão detalhada.</span></div> : <>
              <div className="termination-result-employee">
                <div>
                  <small>Colaborador</small>
                  <strong>{calculation.colaborador?.nome}</strong>
                  <span>Matrícula {calculation.colaborador?.matricula} · salário {money(calculation.colaborador?.salario)}</span>
                  {calculation.parametros?.periodo_experiencia && <span>Experiência até {dateLabel(calculation.parametros?.data_fim_experiencia)}</span>}
                  {calculation.parametros?.data_termino_aviso_trabalhado && (
                    <span className="termination-result-notice-date">
                      Término previsto do aviso: {dateLabel(calculation.parametros.data_termino_aviso_trabalhado)}
                    </span>
                  )}
                </div>
                <Tag value="ESTIMATIVA" severity="warning" />
              </div>
              <div className="termination-result-fgts-balance">
                <div>
                  <span>Saldo de FGTS utilizado</span>
                  <strong>{money(calculation.fgts?.saldo_utilizado)}</strong>
                </div>
                <small>
                  {calculation.fgts?.saldo_origem === "informado" ? "Saldo informado manualmente" : calculation.fgts?.saldo_origem === "desabilitado" ? "Saldo desabilitado para este motivo" : `${calculation.fgts?.meses_trabalhados_estimados || 0} meses estimados + FGTS proporcional do 13º`}
                </small>
              </div>
              <div className="termination-result-list">
                <div className="termination-result-section-title is-earning-title"><span>Proventos do colaborador</span></div>
                {Object.entries(calculation.verbas || {})
                  .filter(([, value]) => Number(value) !== 0)
                  .map(([key, value]) => (
                    <div className="is-earning" key={key}>
                      <span>{EARNING_LABELS[key] || key.replaceAll("_", " ")}</span>
                      <strong>+ {money(value)}</strong>
                    </div>
                  ))}

                {Number(calculation.descontos) > 0 && <div className="termination-result-section-title is-discount-title"><span>Descontos do colaborador</span></div>}
                {Object.entries(calculation.descontos_detalhados || {})
                  .filter(([, value]) => Number(value) !== 0)
                  .map(([key, value]) => (
                    <div className="is-discount" key={key}>
                      <span>{DISCOUNT_LABELS[key] || key.replaceAll("_", " ")}</span>
                      <strong>− {money(value)}</strong>
                    </div>
                  ))}

                {Number(calculation.multa_fgts_estimada) > 0 && <>
                  <div className="termination-result-section-title is-employer-title"><span>Encargos adicionais da empresa</span></div>
                  <div className="is-employer-charge"><span>Multa do FGTS ({calculation.parametros?.percentual_multa_fgts || 0}%)</span><strong>+ {money(calculation.multa_fgts_estimada)}</strong></div>
                </>}
              </div>
              <div className="termination-result-totals">
                <div className="is-positive"><span>Proventos</span><strong>+ {money(calculation.proventos)}</strong></div>
                <div className="is-negative"><span>Descontos</span><strong>− {money(calculation.descontos)}</strong></div>
                <div className="is-liquid"><span>Líquido estimado</span><strong>{money(calculation.liquido_estimado)}</strong></div>
                <div className="is-primary"><span>Custo estimado para a empresa</span><strong>{money(calculation.custo_empresa_estimado)}</strong></div>
              </div>
              <ul className="termination-result-notes">{(calculation.observacoes || []).map((note) => <li key={note}>{note}</li>)}</ul>
            </>}
          </div>
        </div>
      </Dialog>
    </section>
  );
}


export function TerminationControl() {
  return <TerminationControlContent />;
}
