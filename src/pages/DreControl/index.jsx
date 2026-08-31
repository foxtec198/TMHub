// Controle operacional da Demonstração do Resultado do Exercício.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { SpeedDial } from "primereact/speeddial";
import { Tooltip } from "primereact/tooltip";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  ChartColumn,
  Check,
  ChevronDown,
  CloudUpload,
  FileCheck,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
  Upload,
  Wallet,
  X,
} from "lucide-react";

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
  { label: "Folha de pagamento · extratos do RH", value: "folha" },
  { label: "Custos operacionais", value: "custos" },
  { label: "Glosas", value: "glosas" },
];

const MANUAL_CATEGORIES = [
  { label: "Receita bruta realizada", value: "rob" },
  { label: "Receita prevista", value: "receita_prevista" },
  { label: "Impostos", value: "impostos" },
  { label: "Encargos", value: "encargos" },
  { label: "Glosa demonstrativa", value: "glosa_analitica" },
  { label: "Folha salarial", value: "salarios" },
  { label: "Horas extras", value: "horas_extras" },
  { label: "Vale-alimentação (valor nominal)", value: "valor_va" },
  { label: "Vale-transporte (custo total)", value: "valor_vt" },
  { label: "Materiais", value: "materiais" },
  { label: "Uniformes", value: "uniformes" },
  { label: "EPIs", value: "epis" },
  { label: "Combustível", value: "combustivel" },
  { label: "Locação", value: "locacao" },
  { label: "Manutenção", value: "manutencao" },
  { label: "Máquinas e equipamentos", value: "maquinario" },
  { label: "Ajuste de custos", value: "ajuste_custos" },
];

const DRE_VIEWS = [
  { label: "Resumo", value: "resumo", icon: ChartColumn },
  { label: "Recebimentos", value: "recebimentos", icon: ArrowDownRight },
  { label: "Custos", value: "custos", icon: ArrowUpRight },
  { label: "Previsão", value: "previsao", icon: Calendar },
];

const dropdownIcon = (iconProps) => <ChevronDown {...iconProps} size={16} />;

const BRANCH_MARGIN_GOAL = 20;

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

function detailMetric(label, value, tone = "is-expense", signal = "−") {
  return <div className={`dre-detail__item ${tone}`}>
    <span>{label}</span>
    <strong>{signal} {currency(Math.abs(Number(value || 0)))}</strong>
  </div>;
}

function detailGroup({ title, description, total, tone, signal = "−", children }) {
  return <details className={`dre-detail__group ${tone}`}>
    <summary>
      <div className="dre-detail__group-heading"><span>{title}</span><strong>{description}</strong></div>
      <div className="dre-detail__group-total"><b>{signal} {currency(Math.abs(Number(total || 0)))}</b><ChevronDown size={16} /></div>
    </summary>
    <div className="dre-detail__group-content"><div className="dre-detail__grid">{children}</div></div>
  </details>;
}

export function DreControl() {
  const [records, setRecords] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ competencias: [], departamentos: [] });
  const [selectedCompetence, setSelectedCompetence] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [canDelete, setCanDelete] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [activeView, setActiveView] = useState("resumo");
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const [importFiles, setImportFiles] = useState([]);
  const [importPreview, setImportPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importForm, setImportForm] = useState({ tipo: "", competencia: currentCompetence() });
  const [manualForm, setManualForm] = useState({ competencia: currentCompetence(), departamento: null, categoria: "", valor: null, descricao: "", substitui_importacao: true });
  const fileInput = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  const canCreate = isAdmin && can("controle_dre", "create");
  const selectedBranch = branches.find((branch) => Number(branch.id) === Number(selectedBranchId));
  const selectedCompany = companies.find((company) => Number(company.id) === Number(selectedCompanyId));

  const requestParams = useMemo(() => ({
    ...(selectedBranchId ? { filial_id: selectedBranchId } : {}),
    ...(selectedCompanyId ? { empresa_id: selectedCompanyId } : {}),
  }), [selectedBranchId, selectedCompanyId]);

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

  const effectiveSelectedCompetence = selectedCompetence
    && competenceOptions.some((item) => item.value === selectedCompetence)
    ? selectedCompetence
    : competenceOptions[competenceOptions.length - 1]?.value || null;

  const selectedCompetenceData = useMemo(() => (
    recordsByCompetence.find((item) => item.competence === effectiveSelectedCompetence)
    || recordsByCompetence[recordsByCompetence.length - 1]
    || null
  ), [effectiveSelectedCompetence, recordsByCompetence]);

  const displayedSummary = useMemo(() => {
    const rows = selectedCompetenceData?.rows || [];
    const totals = rows.reduce((current, record) => ({
      previsto: current.previsto + Number(record.receita_prevista || 0),
      rob: current.rob + Number(record.rob || 0),
      rol: current.rol + Number(record.rol || 0),
      glosas: current.glosas + Number(record.glosas || 0),
      custos: current.custos + Number(record.total_custos || 0),
      margem: current.margem + Number(record.margem || 0),
    }), { previsto: 0, rob: 0, rol: 0, glosas: 0, custos: 0, margem: 0 });

    return {
      ...totals,
      percentual_margem: totals.rol ? (totals.margem / totals.rol) * 100 : 0,
    };
  }, [selectedCompetenceData]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await connect.get("/dre", { params: requestParams });
      setRecords((Array.isArray(data?.registros) ? data.registros : []).map((record) => ({
        ...record,
        id: `${record.competencia}-${record.departamento}`,
      })));
      setFilterOptions(data?.filtros || { competencias: [], departamentos: [] });
      setBranches(Array.isArray(data?.filiais) ? data.filiais : []);
      setCompanies(Array.isArray(data?.empresas) ? data.empresas : []);
      setCanDelete(Boolean(data?.pode_excluir));
      if (data?.filial_selecionada && Number(data.filial_selecionada) !== Number(selectedBranchId)) {
        setSelectedBranchId(data.filial_selecionada);
      }
      if (data?.empresa_selecionada && Number(data.empresa_selecionada) !== Number(selectedCompanyId)) {
        setSelectedCompanyId(data.empresa_selecionada);
      }
    } catch (error) {
      showToast("error", "Controle DRE", errorMessage(error, "Não foi possível carregar o demonstrativo."));
    } finally {
      setLoading(false);
    }
  }, [requestParams, selectedBranchId, selectedCompanyId, setLoading, showToast]);

  // Carrega ao abrir a página e novamente somente quando os filtros mudam.
  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const toggleDepartment = (record) => {
    setExpandedRows((current) => {
      if (!current[record.id]) return { ...current, [record.id]: true };
      const remaining = { ...current };
      delete remaining[record.id];
      return remaining;
    });
  };

  const previewImport = async (files = importFiles, form = importForm) => {
    if (!files.length || !form.tipo || !form.competencia) return;
    const payload = new FormData();
    files.forEach((file) => payload.append("files", file));
    payload.append("tipo", form.tipo);
    payload.append("competencia", form.competencia);
    if (selectedBranchId) payload.append("filial_id", String(selectedBranchId));
    if (selectedCompanyId) payload.append("empresa_id", String(selectedCompanyId));
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
    const files = Array.from(event.target.files || []);
    setImportFiles(files);
    setImportPreview(null);
    if (files.length) previewImport(files);
  };

  const changeImportField = (name, value) => {
    const next = { ...importForm, [name]: value };
    setImportForm(next);
    setImportPreview(null);
    if (name === "tipo") {
      setImportFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (importFiles.length && next.tipo && next.competencia) previewImport(importFiles, next);
  };

  const importSource = async () => {
    if (!importFiles.length || !importForm.tipo || !importForm.competencia) {
      showToast("warn", "Importação", "Informe o tipo, a competência e a planilha.");
      return;
    }
    if (importPreview?.error) return;
    const payload = new FormData();
    importFiles.forEach((file) => payload.append("files", file));
    Object.entries(importForm).forEach(([key, value]) => payload.append(key, String(value)));
    if (selectedBranchId) payload.append("filial_id", String(selectedBranchId));
    if (selectedCompanyId) payload.append("empresa_id", String(selectedCompanyId));
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
    if (!effectiveSelectedCompetence) return;
    setLoading(true);
    try {
      const { data } = await connect.delete(`/dre/competencias/${effectiveSelectedCompetence}`, {
        params: requestParams,
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
    if (selectedBranchId) payload.append("filial_id", String(selectedBranchId));
    if (selectedCompanyId) payload.append("empresa_id", String(selectedCompanyId));
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
      const { data } = await connect.post("/dre/manual", {
        ...manualForm,
        filial_id: selectedBranchId,
        empresa_id: selectedCompanyId,
      });
      showToast("success", "Lançamento manual", data?.message || "O valor foi atualizado no demonstrativo.");
      setManualOpen(false);
      await refreshData();
    } catch (error) {
      showToast("error", "Lançamento manual", errorMessage(error, "Não foi possível registrar o lançamento."));
    } finally {
      setLoading(false);
    }
  };

  const operationalMargin = Number(displayedSummary.percentual_margem || 0);
  const operationalGoalProgress = Math.max(0, Math.min(
    (operationalMargin / BRANCH_MARGIN_GOAL) * 100,
    100,
  ));

  const detailTemplate = (record) => {
    const marginPercent = Number(record.percentual_margem || 0);
    const goalProgress = Math.max(0, Math.min((marginPercent / BRANCH_MARGIN_GOAL) * 100, 100));
    const goalTone = goalProgress < 40 ? "is-negative" : goalProgress < 80 ? "is-warning" : "is-income";
    const rhCosts = Number(record.composicao?.salarios || 0) + Number(record.composicao?.horas_extras || 0) + Number(record.composicao?.va || 0) + Number(record.composicao?.vt || 0);
    const taxCosts = Number(record.impostos || 0) + Number(record.composicao?.encargos || 0);
    const operationalCosts = Number(record.glosas || 0) + Number(record.custos_operacionais || 0) + Number(record.composicao?.materiais || 0) + Number(record.composicao?.uniformes || 0) + Number(record.composicao?.epis || 0) + Number(record.composicao?.combustivel || 0) + Number(record.composicao?.locacao || 0) + Number(record.composicao?.manutencao || 0) + Number(record.composicao?.maquinario || 0) + Number(record.composicao?.ajuste_custos || 0);

    return <div className="dre-detail">
      <div className="dre-detail__heading">
        <div><span>DETALHAMENTO DO DEPARTAMENTO</span><strong>Departamento {record.departamento}</strong></div>
        <small>Competência {competenceLabel(record.competencia)}</small>
      </div>
      <section className={`dre-detail__impact ${Number(record.margem) < 0 ? "is-negative" : "is-income"}`}>
        <div><span>RESULTADO DO DEPARTAMENTO</span><strong>{Number(record.margem) < 0 ? "−" : "+"} {currency(Math.abs(Number(record.margem || 0)))}</strong></div>
        <div className={`dre-detail__goal ${goalTone}`}><span>Margem de {marginPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% · meta de {BRANCH_MARGIN_GOAL}%</span><div className="dre-department-goal"><span style={{ width: `${goalProgress}%` }} /></div></div>
      </section>
      <div className="dre-detail__groups">
        {detailGroup({ title: "PREVISÃO", description: "Faturamento contratado", total: record.receita_prevista, tone: "is-planned", signal: "+", children: detailMetric("Faturamento previsto em contrato", record.receita_prevista, "is-planned", "+") })}
        {detailGroup({ title: "RECEITAS E FATURAMENTO", description: "Entradas e receita operacional do mês", total: record.rol, tone: "is-income", signal: "+", children: <>{detailMetric("Faturamento realizado", record.rob, "is-income", "+")}{detailMetric("Outros faturamentos", record.outros_faturamentos, "is-income", "+")}{detailMetric("Repactuação", record.repactuacao, "is-income", "+")}{detailMetric("Receita operacional líquida", record.rol, "is-income", "+")}</> })}
        {detailGroup({ title: "TRIBUTOS E ENCARGOS", description: "Obrigações incidentes sobre a operação", total: taxCosts, tone: "is-expense", children: <>{detailMetric("Impostos", record.impostos)}{detailMetric("Encargos", record.composicao?.encargos)}</> })}
        {detailGroup({ title: "RH E BENEFÍCIOS", description: "Folha, horas extras e benefícios", total: rhCosts, tone: "is-expense", children: <>{detailMetric("Folha salarial", record.composicao?.salarios)}{detailMetric("Horas extras", record.composicao?.horas_extras)}{detailMetric("Vale-alimentação", record.composicao?.va)}{detailMetric("Vale-transporte", record.composicao?.vt)}</> })}
        {detailGroup({ title: "OPERAÇÃO E GLOSAS", description: "Materiais, serviços e ajustes da operação", total: operationalCosts, tone: "is-expense", children: <>{detailMetric("Glosas", record.glosas)}{detailMetric("Custos operacionais", record.custos_operacionais)}{detailMetric("Materiais", record.composicao?.materiais)}{detailMetric("Uniformes e EPIs", Number(record.composicao?.uniformes || 0) + Number(record.composicao?.epis || 0))}{detailMetric("Combustível", record.composicao?.combustivel)}{detailMetric("Locação, manutenção e máquinas", Number(record.composicao?.locacao || 0) + Number(record.composicao?.manutencao || 0) + Number(record.composicao?.maquinario || 0))}{detailMetric("Ajustes de custos", record.composicao?.ajuste_custos)}</> })}
      </div>
    </div>;
  };

  const departmentColumn = { field: "departamento", header: "Departamento", mobileHeader: "Departamento", sortable: true, body: (row) => <div className="dre-contract"><strong>Departamento {row.departamento}</strong><small>Clique para detalhar</small></div>, style: { minWidth: "16rem" } };
  const marginGoalTemplate = (row) => {
    const marginPercent = Number(row.percentual_margem || 0);
    const goalProgress = Math.max(0, Math.min((marginPercent / BRANCH_MARGIN_GOAL) * 100, 100));
    const goalTone = goalProgress < 40 ? "is-negative" : goalProgress < 80 ? "is-warning" : "is-positive";

    return <div className={`dre-department-goal-cell ${goalTone}`}>
      <b>{marginPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</b>
      <div className="dre-department-goal" aria-label={`Margem de ${marginPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%, equivalente a ${goalProgress.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da meta de ${BRANCH_MARGIN_GOAL}%`}><span style={{ width: `${goalProgress}%` }} /></div>
    </div>;
  };

  const columns = activeView === "recebimentos" ? [
    departmentColumn,
    { field: "rob", header: "Faturamento", mobileHeader: "Faturamento", body: (row) => <span className="dre-income">+ {currency(Math.abs(Number(row.rob || 0)))}</span>, style: { minWidth: "11rem" } },
    { field: "outros_faturamentos", header: "Outros faturamentos", mobileHeader: "Outros", body: (row) => <span className="dre-income">+ {currency(Math.abs(Number(row.outros_faturamentos || 0)))}</span>, style: { minWidth: "11rem" } },
    { field: "repactuacao", header: "Repactuação", mobileHeader: "Repactuação", body: (row) => <span className="dre-income">+ {currency(Math.abs(Number(row.repactuacao || 0)))}</span>, style: { minWidth: "11rem" } },
    { field: "rol", header: "Receita líquida", mobileHeader: "Receita líquida", body: (row) => <span className="dre-income">+ {currency(Math.abs(Number(row.rol || 0)))}</span>, style: { minWidth: "11rem" } },
  ] : activeView === "custos" ? [
    departmentColumn,
    { field: "impostos", header: "Impostos", mobileHeader: "Impostos", body: (row) => <span className="dre-expense">− {currency(Math.abs(Number(row.impostos || 0)))}</span>, style: { minWidth: "11rem" } },
    { field: "glosas", header: "Glosas", mobileHeader: "Glosas", body: (row) => <span className="dre-expense">− {currency(Math.abs(Number(row.glosas || 0)))}</span>, style: { minWidth: "11rem" } },
    { field: "custos_operacionais", header: "Custos operacionais", mobileHeader: "Operacionais", body: (row) => <span className="dre-expense">− {currency(Math.abs(Number(row.custos_operacionais || 0)))}</span>, style: { minWidth: "12rem" } },
    { field: "total_custos", header: "Custos totais", mobileHeader: "Total", body: (row) => <span className="dre-expense">− {currency(Math.abs(Number(row.total_custos || 0)))}</span>, style: { minWidth: "11rem" } },
  ] : activeView === "previsao" ? [
    departmentColumn,
    { field: "receita_prevista", header: "Faturamento previsto", mobileHeader: "Previsto", body: (row) => <strong className="dre-planned dre-planned--value">+ {currency(Math.abs(Number(row.receita_prevista || 0)))}</strong>, style: { minWidth: "14rem" } },
    { field: "rob", header: "Faturamento realizado", mobileHeader: "Realizado", body: (row) => <span className="dre-income">+ {currency(Math.abs(Number(row.rob || 0)))}</span>, style: { minWidth: "14rem" } },
  ] : [
    departmentColumn,
    { field: "rob", header: "Faturamento", mobileHeader: "Faturamento", body: (row) => <span className="dre-income">+ {currency(Math.abs(Number(row.rob || 0)))}</span>, style: { minWidth: "11rem" } },
    { field: "total_custos", header: "Custos", mobileHeader: "Custos", body: (row) => <span className="dre-expense">− {currency(Math.abs(Number(row.total_custos || 0)))}</span>, style: { minWidth: "11rem" } },
    { field: "margem", header: "Resultado", mobileHeader: "Resultado", body: (row) => <div className={Number(row.margem) < 0 ? "dre-result is-negative" : "dre-result is-positive"}>
        <strong>{Number(row.margem) < 0 ? "−" : "+"} {currency(Math.abs(Number(row.margem || 0)))}</strong>
      </div>, style: { minWidth: "12rem" } },
    { field: "percentual_margem", header: "Meta", mobileHeader: "Meta", body: marginGoalTemplate, style: { minWidth: "9rem" } },
  ];

  const openManualEntry = () => {
    setManualForm({
      competencia: effectiveSelectedCompetence || currentCompetence(),
      departamento: null,
      categoria: "",
      valor: null,
      descricao: "",
      substitui_importacao: true,
    });
    setManualOpen(true);
  };

  const manualValueRule = manualForm.categoria === "valor_va"
    ? {
      label: "Valor nominal do VA",
      hint: manualForm.valor === null
        ? "O DRE aplicará automaticamente o desconto empresarial de 20% sobre o valor informado."
        : `Custo que será registrado na DRE: ${currency(Number(manualForm.valor) * 0.8)}.`,
    }
    : manualForm.categoria === "valor_vt"
      ? {
        label: "Custo total do VT",
        hint: "O valor informado será registrado integralmente na DRE, sem desconto automático.",
      }
      : {
        label: "Valor total após alteração",
        hint: "Informe o valor final da categoria para a competência e o departamento selecionados.",
      };

  const speedDialItems = canCreate ? [
    { label: "Importar fonte", icon: <Upload size={18} />, command: () => { setImportFiles([]); setImportPreview(null); setImportForm({ tipo: "", competencia: currentCompetence() }); setImportOpen(true); } },
    { label: "Gerar benefícios do cadastro", icon: <Wallet size={18} />, command: () => setBenefitsOpen(true) },
    { label: "Lançamento manual", icon: <Plus size={18} />, command: openManualEntry },
  ] : [];

  return <section className="dre-page">
    <PageHeader
      section="Financeiro"
      title={`DRE · ${selectedBranch?.nome || "Filial"}`}
      description={`Acompanhe faturamento, custos e resultado${selectedCompany ? ` da ${selectedCompany.nome}` : ""} por departamento e competência.`}
      actions={canDelete && <Button label="Excluir competência" icon={<Trash2 size={16} />} severity="danger" outlined disabled={!effectiveSelectedCompetence} onClick={() => setDeleteOpen(true)} />}
    />

    <section className="dre-executive-summary" aria-label="Leitura executiva da competência">
      <article className="dre-executive-summary__card is-income">
        <div><span>ADERÊNCIA AO PLANEJADO</span><small>Realizado em relação ao faturamento contratado</small></div>
        <strong>{compactCurrency(displayedSummary.rob)}</strong>
        <div className="dre-executive-summary__comparison"><span className="dre-planned">Previsto: {compactCurrency(displayedSummary.previsto)}</span><b>{Number(displayedSummary.previsto || 0) > 0 ? `${((Number(displayedSummary.rob || 0) / Number(displayedSummary.previsto || 0)) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</b></div>
        <div className="dre-executive-summary__meter"><span style={{ width: `${Math.min(100, Math.max(0, Number(displayedSummary.previsto || 0) > 0 ? (Number(displayedSummary.rob || 0) / Number(displayedSummary.previsto || 0)) * 100 : 0))}%` }} /></div>
      </article>
      <article className={`dre-executive-summary__card ${operationalMargin < 0 ? "is-negative" : operationalMargin >= BRANCH_MARGIN_GOAL ? "is-positive" : "is-warning"}`}>
        <div><span>RECEITA OPERACIONAL</span><small>Meta de margem da filial: {BRANCH_MARGIN_GOAL}%</small></div>
        <strong>{compactCurrency(displayedSummary.rol)}</strong>
        <div className="dre-executive-summary__comparison"><span>Resultado: {Number(displayedSummary.margem || 0) < 0 ? "−" : "+"} {compactCurrency(Math.abs(Number(displayedSummary.margem || 0)))}</span><b>{operationalMargin.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</b></div>
        <div className="dre-executive-summary__meter"><span style={{ width: `${operationalGoalProgress}%` }} /></div>
        <small>Custos: {compactCurrency(displayedSummary.custos)} · Glosas: {compactCurrency(displayedSummary.glosas)}</small>
      </article>
    </section>

    <div className="dre-selection-bar">
      {(isAdmin || branches.length > 1) && <label className="dre-competence-selector"><span>Filial</span><Dropdown value={selectedBranchId} options={branches} optionLabel="nome" optionValue="id" dropdownIcon={dropdownIcon} onChange={(event) => { setSelectedBranchId(event.value); setSelectedCompanyId(null); setSelectedCompetence(null); }} placeholder="Selecione a filial" /></label>}
      {(isAdmin || companies.length > 1) && <label className="dre-competence-selector"><span>Empresa</span><Dropdown value={selectedCompanyId} options={companies} optionLabel="nome" optionValue="id" dropdownIcon={dropdownIcon} onChange={(event) => { setSelectedCompanyId(event.value); setSelectedCompetence(null); }} placeholder="Selecione a empresa" /></label>}
      <label className="dre-competence-selector"><span>Competência</span><Dropdown value={effectiveSelectedCompetence} options={competenceOptions} optionLabel="label" optionValue="value" dropdownIcon={dropdownIcon} onChange={(event) => setSelectedCompetence(event.value)} placeholder="Selecione a competência" /></label>
    </div>

    <nav className="dre-view-tabs" aria-label="Visões do demonstrativo">
      {DRE_VIEWS.map((view) => { const Icon = view.icon; return <button key={view.value} type="button" className={activeView === view.value ? "is-active" : ""} onClick={() => setActiveView(view.value)}><Icon size={16} />{view.label}</button>; })}
    </nav>

    <section className="dre-execution-pipeline" aria-label="Fluxo financeiro da competência">
      <div className="dre-execution-pipeline__heading"><div><span>FECHAMENTO DA COMPETÊNCIA</span><strong>{effectiveSelectedCompetence ? competenceLabel(effectiveSelectedCompetence) : "Selecione uma competência"}</strong></div><small>Planejado, realizado, custos e resultado</small></div>
      <div className="dre-execution-pipeline__stages"><span className="is-planned">Planejado <b>{compactCurrency(displayedSummary.previsto)}</b></span><ArrowRight size={16} /><span className="is-income">Realizado <b>{compactCurrency(displayedSummary.rob)}</b></span><ArrowRight size={16} /><span className="is-expense">Custos <b>− {compactCurrency(displayedSummary.custos)}</b></span><ArrowRight size={16} /><span className={Number(displayedSummary.margem || 0) < 0 ? "is-negative" : "is-positive"}>Resultado <b>{Number(displayedSummary.margem || 0) < 0 ? "−" : "+"} {compactCurrency(Math.abs(Number(displayedSummary.margem || 0)))}</b></span></div>
    </section>

    {selectedCompetenceData ? <article className="dre-panel dre-month-panel">
      <div className="dre-panel__heading"><div><span>DEMONSTRATIVO OPERACIONAL</span><h2>{competenceLabel(selectedCompetenceData.competence)}</h2></div><small>{selectedCompetenceData.rows.length} departamento(s) · ordem crescente · clique para expandir</small></div>
      <Table
        data={selectedCompetenceData.rows}
        columns={columns}
        dataKey="id"
        expandedRows={expandedRows}
        onRowToggle={(event) => setExpandedRows(event.data)}
        onRowClick={(event) => toggleDepartment(event.data)}
        rowExpansionTemplate={detailTemplate}
        rows={10}
        rowsPerPageOptions={[10, 25, 50, 100]}
        tableClassName="dre-table"
        emptyMessage="Nenhum lançamento foi encontrado para esta competência."
      />
    </article> : <article className="dre-panel"><div className="dre-panel__heading"><div><span>DEMONSTRATIVO OPERACIONAL</span><h2>Resultado por departamento</h2></div></div><Table data={[]} columns={columns} tableClassName="dre-table" emptyMessage="Nenhum lançamento foi encontrado para o recorte aplicado." /></article>}

    <Dialog header="Importar fonte da DRE" visible={importOpen} modal className="dre-import-dialog" closeIcon={<X size={18} />} onHide={() => setImportOpen(false)}>
      <div className="dre-dialog-content">
        <div className="dre-import-note"><TriangleAlert size={18} /><span>A prévia valida a planilha antes de gravar. Um novo arquivo da mesma fonte substitui somente a versão ativa daquela competência.</span></div>
        <div className="dre-dialog-grid">
          <label><span>Tipo de fonte</span><Dropdown value={importForm.tipo} options={IMPORT_TYPES} optionLabel="label" optionValue="value" dropdownIcon={dropdownIcon} onChange={(event) => changeImportField("tipo", event.value)} placeholder="Selecione a fonte" /></label>
          <label><span>Competência</span><InputText type="month" value={importForm.competencia} onChange={(event) => changeImportField("competencia", event.target.value)} /></label>
        </div>
        <button type="button" className={`dre-dropzone ${importFiles.length ? "has-file" : ""}`} onClick={() => fileInput.current?.click()}><input ref={fileInput} type="file" accept=".xlsx" multiple={importForm.tipo === "folha"} onChange={selectImportFile} />{importFiles.length ? <FileCheck size={28} /> : <CloudUpload size={28} />}<strong>{importFiles.length ? `${importFiles.length} planilha(s) selecionada(s)` : "Selecionar planilha .xlsx"}</strong><span>{importFiles.length ? importFiles.map((file) => file.name).join(" · ") : importForm.tipo === "folha" ? "Selecione os extratos do RH do mesmo mês." : "Nenhum dado será gravado antes da confirmação."}</span></button>
        {previewLoading && <div className="dre-preview is-loading"><LoaderCircle className="dre-spin" size={18} /><span>Lendo a planilha…</span></div>}
        {importPreview?.error && <div className="dre-preview is-error"><TriangleAlert size={18} /><span>{importPreview.error}</span></div>}
        {importPreview && !importPreview.error && <div className="dre-preview"><div><span>PRÉVIA DA IMPORTAÇÃO</span><strong>{importPreview.lancamentos} lançamento(s) em {importPreview.departamentos} departamento(s)</strong></div><small>{(importPreview.categorias || []).map((item) => `${item.nome}: ${currency(item.valor)}`).join(" · ")}</small></div>}
        <div className="dre-dialog-actions"><Button label="Cancelar" text onClick={() => setImportOpen(false)} /><Button label="Importar" icon={<Check size={16} />} onClick={importSource} disabled={!importFiles.length || !importPreview || Boolean(importPreview.error) || previewLoading} /></div>
      </div>
    </Dialog>

    <Dialog header="Gerar benefícios do cadastro" visible={benefitsOpen} modal className="dre-simple-dialog" closeIcon={<X size={18} />} onHide={() => setBenefitsOpen(false)}><div className="dre-dialog-content"><p>Cria a fotografia mensal de VA e VT dos colaboradores ativos da empresa selecionada. O VA usa o valor vigente no cadastro do colaborador e aplica o desconto empresarial de 20%.</p><label><span>Competência</span><InputText type="month" value={importForm.competencia} onChange={(event) => changeImportField("competencia", event.target.value)} /></label><div className="dre-dialog-actions"><Button label="Cancelar" text onClick={() => setBenefitsOpen(false)} /><Button label="Gerar benefícios" icon={<Wallet size={16} />} onClick={generateBenefits} /></div></div></Dialog>

    <Dialog
      header="Lançamento manual da DRE"
      visible={manualOpen}
      modal
      className="dre-manual-dialog"
      closeIcon={<X size={18} />}
      onHide={() => setManualOpen(false)}
    >
      <div className="dre-dialog-content dre-dialog-grid">
        <label>
          <span>Competência</span>
          <InputText type="month" value={manualForm.competencia} onChange={(event) => setManualForm((current) => ({ ...current, competencia: event.target.value }))} />
        </label>
        <label>
          <span>Departamento</span>
          <Dropdown value={manualForm.departamento} options={(filterOptions.departamentos || []).map((value) => ({ label: `DPTO. ${value}`, value }))} optionLabel="label" optionValue="value" dropdownIcon={dropdownIcon} onChange={(event) => setManualForm((current) => ({ ...current, departamento: event.value }))} placeholder="Selecione" />
        </label>
        <label>
          <span>Categoria</span>
          <Dropdown value={manualForm.categoria} options={MANUAL_CATEGORIES} optionLabel="label" optionValue="value" dropdownIcon={dropdownIcon} onChange={(event) => setManualForm((current) => ({ ...current, categoria: event.value }))} placeholder="Selecionar categoria" />
        </label>
        <label>
          <span>{manualValueRule.label}</span>
          <InputNumber value={manualForm.valor} onValueChange={(event) => setManualForm((current) => ({ ...current, valor: event.value }))} mode="currency" currency="BRL" locale="pt-BR" />
          <small className="dre-manual-value-hint">{manualValueRule.hint}</small>
        </label>
        <div className="dre-manual-mode dre-dialog-wide">
          <label className="dre-checkbox">
            <input type="checkbox" checked={manualForm.substitui_importacao} onChange={(event) => setManualForm((current) => ({ ...current, substitui_importacao: event.target.checked }))} />
            <span>Substituir valor importado</span>
          </label>
          <small>{manualForm.substitui_importacao ? "O valor informado passa a ser o total da categoria nesta competência e departamento." : "O valor será somado ao total que já veio das fontes importadas."}</small>
        </div>
        <label className="dre-dialog-wide">
          <span>Descrição</span>
          <InputText value={manualForm.descricao} onChange={(event) => setManualForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Identifique a origem ou o motivo do lançamento" />
        </label>
        <div className="dre-dialog-actions dre-dialog-wide">
          <Button label="Cancelar" text onClick={() => setManualOpen(false)} />
          <Button label={manualForm.substitui_importacao ? "Substituir valor" : "Somar ajuste"} icon={<Save size={16} />} onClick={createManualEntry} />
        </div>
      </div>
    </Dialog>

    <Dialog header="Excluir competência da DRE" visible={deleteOpen} modal className="dre-simple-dialog" closeIcon={<X size={18} />} onHide={() => setDeleteOpen(false)}><div className="dre-dialog-content"><div className="dre-delete-warning"><TriangleAlert size={18} /><div><strong>Excluir os dados de {competenceLabel(effectiveSelectedCompetence)}?</strong><span>A ação remove somente esta competência da filial e empresa selecionadas, incluindo suas fontes e lançamentos. Ela não altera colaboradores, departamentos ou os outros meses.</span></div></div><div className="dre-dialog-actions"><Button label="Cancelar" text onClick={() => setDeleteOpen(false)} /><Button label="Excluir dados" icon={<Trash2 size={16} />} severity="danger" onClick={deleteSelectedCompetence} /></div></div></Dialog>

    {speedDialItems.length > 0 && <div className="dre-speed-dial"><Tooltip target=".dre-speed-dial .p-speeddial-action" position="left" showDelay={150} /><SpeedDial model={speedDialItems} type="quarter-circle" direction="up-left" radius={110} showIcon={<Plus size={20} />} hideIcon={<X size={20} />} aria-label="Ações da DRE" /></div>}
  </section>;
}
