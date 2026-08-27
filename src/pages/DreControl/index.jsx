// Controle operacional da Demonstração do Resultado do Exercício.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { SpeedDial } from "primereact/speeddial";
import { Tooltip } from "primereact/tooltip";

import { PageHeader } from "../../components/PageHeader";
import { Table } from "../../components/tables/Table";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { can } from "../../utils/permissions";
import connect from "../../utils/request";
import "./styles.css";

const IMPORT_TYPES = [
  { label: "Histórico DRE · maio a julho/2026", value: "historico_dre" },
  { label: "Contratos e faturamento", value: "contratos" },
  { label: "Folha analítica", value: "folha" },
  { label: "Custos operacionais", value: "custos" },
  { label: "Glosas", value: "glosas" },
];

const MANUAL_CATEGORIES = [
  { label: "Receita bruta realizada", value: "rob" },
  { label: "Receita prevista", value: "receita_prevista" },
  { label: "Horas extras", value: "horas_extras" },
  { label: "Vale-alimentação", value: "valor_va" },
  { label: "Vale-transporte", value: "valor_vt" },
  { label: "Materiais", value: "materiais" },
  { label: "Uniformes", value: "uniformes" },
  { label: "EPIs", value: "epis" },
  { label: "Combustível", value: "combustivel" },
  { label: "Locação", value: "locacao" },
  { label: "Manutenção", value: "manutencao" },
  { label: "Máquinas e equipamentos", value: "maquinario" },
  { label: "Ajuste de custos", value: "ajuste_custos" },
];

function currentCompetence() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function currency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function compactCurrency(value) {
  const amount = Number(value || 0);
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (absolute < 1_000) return currency(amount);
  if (absolute < 1_000_000) return `${sign}R$ ${(absolute / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sign}R$ ${(absolute / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
}

function competenceLabel(value) {
  if (!value) return "—";
  const [year, month] = String(value).slice(0, 7).split("-");
  return year && month ? `${month}/${year}` : value;
}

function errorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  return error?.response ? fallback : "Não foi possível conectar ao servidor.";
}

function metric(label, value, detail, tone = "", signal = "+") {
  return <article className={`dre-summary__metric ${tone}`.trim()}>
    <span>{label}</span>
    <strong>{signal} {compactCurrency(Math.abs(Number(value || 0)))}</strong>
    <small>{detail}</small>
  </article>;
}

function detailMetric(label, value, tone = "is-expense", signal = "−") {
  return <div className={`dre-detail__item ${tone}`}>
    <span>{label}</span>
    <strong>{signal} {currency(Math.abs(Number(value || 0)))}</strong>
  </div>;
}

export function DreControl() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [filterOptions, setFilterOptions] = useState({ competencias: [], departamentos: [] });
  const [selectedCompetence, setSelectedCompetence] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [canDelete, setCanDelete] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importForm, setImportForm] = useState({ tipo: "", competencia: currentCompetence() });
  const [manualForm, setManualForm] = useState({ competencia: currentCompetence(), departamento: null, categoria: "", valor: null, descricao: "" });
  const fileInput = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  const canCreate = isAdmin && can("controle_dre", "create");

  const requestParams = useMemo(() => ({
    ...(selectedCompetence ? { competencia: selectedCompetence } : {}),
    ...(selectedBranchId ? { filial_id: selectedBranchId } : {}),
  }), [selectedBranchId, selectedCompetence]);

  const recordsByCompetence = useMemo(() => {
    const groups = new Map();
    records.forEach((record) => {
      const key = record.competencia?.slice(0, 7) || "sem-competencia";
      const current = groups.get(key) || [];
      current.push(record);
      groups.set(key, current);
    });
    return [...groups.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([competence, rows]) => ({
        competence,
        rows: [...rows].sort((first, second) => Number(first.departamento) - Number(second.departamento)),
      }));
  }, [records]);

  const competenceOptions = useMemo(() => (filterOptions.competencias || [])
    .slice()
    .sort()
    .map((value) => ({ label: competenceLabel(value), value })), [filterOptions.competencias]);

  const selectedDepartment = useMemo(
    () => records.find((record) => record.id === selectedDepartmentId) || records[0] || null,
    [records, selectedDepartmentId],
  );

  const plannedRevenue = Number(summary.previsto || 0);
  const realizedRevenue = Number(summary.rob || 0);
  const resultValue = Number(summary.margem || 0);
  const plannedCompletion = plannedRevenue > 0 ? (realizedRevenue / plannedRevenue) * 100 : 0;
  const plannedCompletionMeter = Math.max(0, Math.min(plannedCompletion, 100));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await connect.get("/dre", { params: requestParams });
      setRecords((Array.isArray(data?.registros) ? data.registros : []).map((record) => ({
        ...record,
        id: `${record.competencia}-${record.departamento}`,
      })));
      setSummary(data?.resumo || {});
      setFilterOptions(data?.filtros || { competencias: [], departamentos: [] });
      setBranches(Array.isArray(data?.filiais) ? data.filiais : []);
      setCanDelete(Boolean(data?.pode_excluir));
      if (data?.filial_selecionada && Number(data.filial_selecionada) !== Number(selectedBranchId)) {
        setSelectedBranchId(data.filial_selecionada);
      }
    } catch (error) {
      showToast("error", "Controle DRE", errorMessage(error, "Não foi possível carregar o demonstrativo."));
    } finally {
      setLoading(false);
    }
  }, [requestParams, selectedBranchId, setLoading, showToast]);

  // Carrega ao abrir a página e novamente somente quando os filtros mudam.
  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const openImport = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportForm({ tipo: "", competencia: currentCompetence() });
    setImportOpen(true);
  };

  const previewImport = async (file = importFile, form = importForm) => {
    if (!file || !form.tipo || !form.competencia) return;
    const payload = new FormData();
    payload.append("file", file);
    payload.append("tipo", form.tipo);
    payload.append("competencia", form.competencia);
    setPreviewLoading(true);
    try {
      const { data } = await connect.post("/dre/importar/previa", payload, { timeout: 120000 });
      setImportPreview(data);
    } catch (error) {
      setImportPreview({ error: errorMessage(error, "Não foi possível validar a planilha.") });
    } finally {
      setPreviewLoading(false);
    }
  };

  const selectImportFile = (event) => {
    const file = event.target.files?.[0] || null;
    setImportFile(file);
    setImportPreview(null);
    if (file) previewImport(file);
  };

  const changeImportField = (name, value) => {
    const next = { ...importForm, [name]: value };
    setImportForm(next);
    setImportPreview(null);
    if (importFile && next.tipo && next.competencia) previewImport(importFile, next);
  };

  const importSource = async () => {
    if (!importFile || !importForm.tipo || !importForm.competencia) {
      showToast("warn", "Importação", "Informe o tipo, a competência e a planilha.");
      return;
    }
    if (importPreview?.error) return;
    const payload = new FormData();
    payload.append("file", importFile);
    Object.entries(importForm).forEach(([key, value]) => payload.append(key, String(value)));
    setLoading(true);
    try {
      const { data } = await connect.post("/dre/importar", payload, { timeout: 120000 });
      showToast("success", "Importação concluída", data?.message || "A fonte foi incluída na DRE.");
      setImportOpen(false);
      await refreshData();
    } catch (error) {
      showToast("error", "Falha na importação", errorMessage(error, "Não foi possível importar a fonte."));
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedCompetence = async () => {
    if (!selectedCompetence) return;
    setLoading(true);
    try {
      const { data } = await connect.delete(`/dre/competencias/${selectedCompetence}`, {
        params: selectedBranchId ? { filial_id: selectedBranchId } : {},
      });
      showToast("success", "Competência excluída", data?.message || "Os dados foram excluídos.");
      setDeleteOpen(false);
      setSelectedCompetence(null);
      await refreshData();
    } catch (error) {
      showToast("error", "Excluir competência", errorMessage(error, "Não foi possível excluir os dados da competência."));
    } finally {
      setLoading(false);
    }
  };

  const generateBenefits = async () => {
    if (!importForm.competencia) return;
    const payload = new FormData();
    payload.append("competencia", importForm.competencia);
    setLoading(true);
    try {
      const { data } = await connect.post("/dre/beneficios/gerar", payload);
      showToast("success", "Benefícios gerados", data?.message || "Os benefícios foram registrados.");
      setBenefitsOpen(false);
      await refreshData();
    } catch (error) {
      showToast("error", "Benefícios", errorMessage(error, "Não foi possível gerar os benefícios."));
    } finally {
      setLoading(false);
    }
  };

  const createManualEntry = async () => {
    if (!manualForm.competencia || !manualForm.departamento || !manualForm.categoria || manualForm.valor === null) {
      showToast("warn", "Lançamento manual", "Preencha competência, departamento, categoria e valor.");
      return;
    }
    setLoading(true);
    try {
      await connect.post("/dre/manual", manualForm);
      showToast("success", "Lançamento manual", "O valor foi incluído no demonstrativo.");
      setManualOpen(false);
      await refreshData();
    } catch (error) {
      showToast("error", "Lançamento manual", errorMessage(error, "Não foi possível registrar o lançamento."));
    } finally {
      setLoading(false);
    }
  };

  const detailPanel = (record) => {
    if (!record) return <aside className="dre-department-detail dre-department-detail--empty">
      <i className="pi pi-chart-bar" />
      <strong>Selecione um departamento</strong>
      <span>Os valores detalhados da competência aparecerão aqui.</span>
    </aside>;

    return <aside className="dre-department-detail">
      <div className="dre-detail">
    <div className="dre-detail__heading">
      <div><span>DETALHE DO DEPARTAMENTO</span><strong>Departamento {record.departamento}</strong></div>
      <small>Competência {competenceLabel(record.competencia)}</small>
    </div>
    <section className="dre-detail__section is-planned">
      <div className="dre-detail__section-heading"><span>PREVISÃO DA COMPETÊNCIA</span><strong>Valor contratado antes do fechamento</strong></div>
      <div className="dre-detail__grid">
        {detailMetric("Faturamento previsto em contrato", record.receita_prevista, "is-planned", "+")}
      </div>
    </section>
      <section className="dre-detail__section is-income">
        <div className="dre-detail__section-heading"><span>RECEBIMENTOS REALIZADOS</span><strong>Entradas e receita operacional do mês</strong></div>
        <div className="dre-detail__grid">
          {detailMetric("Faturamento realizado", record.rob, "is-income", "+")}
          {detailMetric("Outros faturamentos", record.outros_faturamentos, "is-income", "+")}
          {detailMetric("Repactuação", record.repactuacao, "is-income", "+")}
          {detailMetric("Receita operacional líquida", record.rol, "is-income", "+")}
        </div>
      </section>
      <section className="dre-detail__section is-expense">
        <div className="dre-detail__section-heading"><span>CUSTOS TRIBUTÁRIOS</span><strong>Impostos e encargos incidentes sobre a operação</strong></div>
        <div className="dre-detail__grid">
          {detailMetric("Impostos", record.impostos)}
          {detailMetric("Encargos", record.composicao?.encargos)}
        </div>
      </section>
      <section className="dre-detail__section is-expense">
        <div className="dre-detail__section-heading"><span>CUSTOS DE RH</span><strong>Folha e benefícios</strong></div>
        <div className="dre-detail__grid">
          {detailMetric("Folha salarial", record.composicao?.salarios)}
          {detailMetric("Horas extras", record.composicao?.horas_extras)}
          {detailMetric("VA e VT", Number(record.composicao?.va || 0) + Number(record.composicao?.vt || 0))}
        </div>
      </section>
      <section className="dre-detail__section is-expense">
        <div className="dre-detail__section-heading"><span>CUSTOS OPERACIONAIS</span><strong>Materiais e serviços necessários à operação</strong></div>
        <div className="dre-detail__grid">
          {detailMetric("Glosas", record.glosas)}
          {detailMetric("Custos operacionais", record.custos_operacionais)}
          {detailMetric("Materiais", record.composicao?.materiais)}
          {detailMetric("Uniformes e EPIs", Number(record.composicao?.uniformes || 0) + Number(record.composicao?.epis || 0))}
          {detailMetric("Combustível", record.composicao?.combustivel)}
          {detailMetric("Locação, manutenção e máquinas", Number(record.composicao?.locacao || 0) + Number(record.composicao?.manutencao || 0) + Number(record.composicao?.maquinario || 0))}
          {detailMetric("Ajustes de custos", record.composicao?.ajuste_custos)}
        </div>
      </section>
      <section className={`dre-detail__section dre-detail__result ${Number(record.margem) < 0 ? "is-negative" : "is-income"}`}>
        <div className="dre-detail__section-heading"><span>RESULTADO</span><strong>Margem final do departamento</strong></div>
        <div className="dre-detail__grid">
          {detailMetric("Resultado do departamento", record.margem, Number(record.margem) < 0 ? "is-negative" : "is-income", Number(record.margem) < 0 ? "−" : "+")}
      </div>
    </section>
      </div>
    </aside>;
  };

  const columns = [
    { field: "departamento", header: "Departamento", mobileHeader: "Departamento", sortable: true, body: (row) => <div className={`dre-contract ${selectedDepartment?.id === row.id ? "is-selected" : ""}`}><strong>Departamento {row.departamento}</strong><small>Clique para visualizar no painel</small></div>, style: { minWidth: "16rem" } },
    { field: "rob", header: "Faturamento", mobileHeader: "Faturamento", body: (row) => <span className="dre-income">+ {currency(Math.abs(Number(row.rob || 0)))}</span>, style: { minWidth: "11rem" } },
    { field: "total_custos", header: "Custos", mobileHeader: "Custos", body: (row) => <span className="dre-expense">− {currency(Math.abs(Number(row.total_custos || 0)))}</span>, style: { minWidth: "11rem" } },
    { field: "margem", header: "Resultado", mobileHeader: "Resultado", body: (row) => <div className={Number(row.margem) < 0 ? "dre-result is-negative" : "dre-result is-positive"}><strong>{Number(row.margem) < 0 ? "−" : "+"} {currency(Math.abs(Number(row.margem || 0)))}</strong><small>{Number(row.percentual_margem || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% de margem</small></div>, style: { minWidth: "12rem" } },
  ];

  const speedDialItems = canCreate ? [
    { label: "Importar fonte", icon: "pi pi-upload", command: openImport },
    { label: "Gerar benefícios do cadastro", icon: "pi pi-wallet", command: () => setBenefitsOpen(true) },
    { label: "Lançamento manual", icon: "pi pi-plus", command: () => setManualOpen(true) },
  ] : [];

  return <section className="dre-page">
    <PageHeader
      section="Financeiro"
      title="DRE · Londrina"
      description="Acompanhe faturamento, custos e resultado por departamento e competência."
    />

    <div className="dre-selection-bar">
      {(isAdmin || branches.length > 1) && <label className="dre-competence-selector"><span>Filial</span><Dropdown value={selectedBranchId} options={branches} optionLabel="nome" optionValue="id" onChange={(event) => { setSelectedBranchId(event.value); setSelectedCompetence(null); }} placeholder="Selecione a filial" /></label>}
      <label className="dre-competence-selector"><span>Competência</span><Dropdown value={selectedCompetence} options={competenceOptions} optionLabel="label" optionValue="value" onChange={(event) => setSelectedCompetence(event.value || null)} placeholder="Todas as competências" showClear /></label>
      {canDelete && <Button label="Excluir competência" icon="pi pi-trash" severity="danger" outlined disabled={!selectedCompetence} onClick={() => setDeleteOpen(true)} />}
    </div>

    <section className="dre-executive-summary" aria-label="Leitura executiva da competência">
      <article className="dre-executive-summary__card is-planned">
        <div><span>ADERÊNCIA AO PLANEJADO</span><small>Faturamento realizado em relação ao contrato</small></div>
        <strong>{compactCurrency(realizedRevenue)}</strong>
        <div className="dre-executive-summary__comparison"><span>Previsto: {compactCurrency(plannedRevenue)}</span><b>{plannedRevenue > 0 ? `${plannedCompletion.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</b></div>
        <div className="dre-executive-summary__meter"><span style={{ width: `${plannedCompletionMeter}%` }} /></div>
      </article>
      <article className={`dre-executive-summary__card ${resultValue < 0 ? "is-negative" : "is-positive"}`}>
        <div><span>RESULTADO OPERACIONAL</span><small>Resultado líquido após custos, impostos e glosas</small></div>
        <strong>{resultValue < 0 ? "−" : "+"} {compactCurrency(Math.abs(resultValue))}</strong>
        <div className="dre-executive-summary__comparison"><span>Custos: {compactCurrency(summary.custos)}</span><b>{Number(summary.percentual_margem || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% de margem</b></div>
        <small>Glosas do recorte: {compactCurrency(summary.glosas)}</small>
      </article>
    </section>

    <section className="dre-workspace">
      <article className="dre-panel dre-workspace__list">
        <div className="dre-panel__heading"><div><span>DEPARTAMENTOS</span><h2>Resultado por departamento</h2></div><small>Ordem crescente · selecione uma linha para analisar</small></div>
        {recordsByCompetence.length ? recordsByCompetence.map(({ competence, rows }) => <div className="dre-workspace__month" key={competence}>
          <div className="dre-workspace__month-heading"><strong>{competenceLabel(competence)}</strong><span>{rows.length} departamento(s)</span></div>
          <Table
            data={rows}
            columns={columns}
            dataKey="id"
            onRowClick={(event) => setSelectedDepartmentId(event.data.id)}
            rows={10}
            rowsPerPageOptions={[10, 25, 50, 100]}
            tableClassName="dre-table"
            emptyMessage="Nenhum lançamento foi encontrado para esta competência."
          />
        </div>) : <Table data={[]} columns={columns} tableClassName="dre-table" emptyMessage="Nenhum lançamento foi encontrado para o recorte aplicado." />}
      </article>
      {detailPanel(selectedDepartment)}
    </section>

    <Dialog header="Importar fonte da DRE" visible={importOpen} modal className="dre-import-dialog" onHide={() => setImportOpen(false)}>
      <div className="dre-dialog-content">
        <div className="dre-import-note"><i className="pi pi-info-circle" /><span>A prévia valida a planilha antes de gravar. Um novo arquivo da mesma fonte substitui somente a versão ativa daquela competência.</span></div>
        <div className="dre-dialog-grid">
          <label><span>Tipo de fonte</span><Dropdown value={importForm.tipo} options={IMPORT_TYPES} optionLabel="label" optionValue="value" onChange={(event) => changeImportField("tipo", event.value)} placeholder="Selecione a fonte" /></label>
          <label><span>Competência</span><InputText type="month" value={importForm.competencia} onChange={(event) => changeImportField("competencia", event.target.value)} /></label>
        </div>
        <button type="button" className={`dre-dropzone ${importFile ? "has-file" : ""}`} onClick={() => fileInput.current?.click()}><input ref={fileInput} type="file" accept=".xlsx" onChange={selectImportFile} /><i className={`pi ${importFile ? "pi-file-check" : "pi-cloud-upload"}`} /><strong>{importFile?.name || "Selecionar planilha .xlsx"}</strong><span>{importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : "Nenhum dado será gravado antes da confirmação."}</span></button>
        {previewLoading && <div className="dre-preview is-loading"><i className="pi pi-spin pi-spinner" /><span>Lendo a planilha…</span></div>}
        {importPreview?.error && <div className="dre-preview is-error"><i className="pi pi-exclamation-triangle" /><span>{importPreview.error}</span></div>}
        {importPreview && !importPreview.error && <div className="dre-preview"><div><span>PRÉVIA DA IMPORTAÇÃO</span><strong>{importPreview.lancamentos} lançamento(s) em {importPreview.departamentos} departamento(s)</strong></div><small>{(importPreview.categorias || []).map((item) => `${item.nome}: ${currency(item.valor)}`).join(" · ")}</small></div>}
        <div className="dre-dialog-actions"><Button label="Cancelar" text onClick={() => setImportOpen(false)} /><Button label="Importar" icon="pi pi-check" onClick={importSource} disabled={!importFile || !importPreview || Boolean(importPreview.error) || previewLoading} /></div>
      </div>
    </Dialog>

    <Dialog header="Gerar benefícios do cadastro" visible={benefitsOpen} modal className="dre-simple-dialog" onHide={() => setBenefitsOpen(false)}><div className="dre-dialog-content"><p>Cria a fotografia mensal de VA e VT dos colaboradores ativos de Londrina. O VA usa o valor vigente no cadastro do colaborador e aplica o desconto empresarial de 20%.</p><label><span>Competência</span><InputText type="month" value={importForm.competencia} onChange={(event) => changeImportField("competencia", event.target.value)} /></label><div className="dre-dialog-actions"><Button label="Cancelar" text onClick={() => setBenefitsOpen(false)} /><Button label="Gerar benefícios" icon="pi pi-wallet" onClick={generateBenefits} /></div></div></Dialog>

    <Dialog header="Lançamento manual da DRE" visible={manualOpen} modal className="dre-manual-dialog" onHide={() => setManualOpen(false)}><div className="dre-dialog-content dre-dialog-grid"><label><span>Competência</span><InputText type="month" value={manualForm.competencia} onChange={(event) => setManualForm((current) => ({ ...current, competencia: event.target.value }))} /></label><label><span>Departamento</span><Dropdown value={manualForm.departamento} options={(filterOptions.departamentos || []).map((value) => ({ label: `DPTO. ${value}`, value }))} optionLabel="label" optionValue="value" onChange={(event) => setManualForm((current) => ({ ...current, departamento: event.value }))} placeholder="Selecione" /></label><label><span>Categoria</span><Dropdown value={manualForm.categoria} options={MANUAL_CATEGORIES} optionLabel="label" optionValue="value" onChange={(event) => setManualForm((current) => ({ ...current, categoria: event.value }))} placeholder="Selecionar categoria" /></label><label><span>Valor</span><InputNumber value={manualForm.valor} onValueChange={(event) => setManualForm((current) => ({ ...current, valor: event.value }))} mode="currency" currency="BRL" locale="pt-BR" /></label><label className="dre-dialog-wide"><span>Descrição</span><InputText value={manualForm.descricao} onChange={(event) => setManualForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Identifique a origem ou o motivo do lançamento" /></label><div className="dre-dialog-actions dre-dialog-wide"><Button label="Cancelar" text onClick={() => setManualOpen(false)} /><Button label="Salvar lançamento" icon="pi pi-save" onClick={createManualEntry} /></div></div></Dialog>

    <Dialog header="Excluir competência da DRE" visible={deleteOpen} modal className="dre-simple-dialog" onHide={() => setDeleteOpen(false)}><div className="dre-dialog-content"><div className="dre-delete-warning"><i className="pi pi-exclamation-triangle" /><div><strong>Excluir os dados de {competenceLabel(selectedCompetence)}?</strong><span>A ação remove somente esta competência da filial selecionada, incluindo suas fontes e lançamentos. Ela não altera colaboradores, departamentos ou os outros meses.</span></div></div><div className="dre-dialog-actions"><Button label="Cancelar" text onClick={() => setDeleteOpen(false)} /><Button label="Excluir dados" icon="pi pi-trash" severity="danger" onClick={deleteSelectedCompetence} /></div></div></Dialog>

    {speedDialItems.length > 0 && <div className="dre-speed-dial"><Tooltip target=".dre-speed-dial .p-speeddial-action" position="left" showDelay={150} /><SpeedDial model={speedDialItems} type="quarter-circle" direction="up-left" radius={110} showIcon="pi pi-plus" hideIcon="pi pi-times" aria-label="Ações da DRE" /></div>}
  </section>;
}
