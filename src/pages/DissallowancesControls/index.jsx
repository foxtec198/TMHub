import { AppIcon } from "../../components/icons/AppIcon";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import { can } from "../../utils/permissions";
import { exportDisallowancesXlsx } from "../../utils/exportDisallowancesXlsx";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import { PageHeader } from "../../components/PageHeader";
import { Table } from "../../components/tables/Table";
import "./styles.css";
import "./contrast.css";
import {
  CombinedFiltersProvider,
  CombinedMultiSelect,
  useCombinedFilters,
} from "../../contexts/CombinedFiltersContext";

const COVERAGE_OPTIONS = [
  { label: "Em análise", value: "em_analise" },
  { label: "Coberta", value: "coberta" },
  { label: "Parcialmente coberta", value: "parcial" },
  { label: "Descoberta", value: "descoberta" },
];

const FILTER_DEFINITIONS = {
  cobertura: {
    getValue: (record) => record.cobertura,
    options: COVERAGE_OPTIONS,
  },
  departamento: {
    getValue: (record) => (record.departamento == null || record.departamento === "")
      ? null
      : String(record.departamento),
    getLabel: (record) => `DPTO. ${record.departamento}`,
  },
  contrato: {
    getValue: (record) => record.centro_custo_id,
    getLabel: (record) => record.contrato || `Contrato ${record.centro_custo_id}`,
  },
  colaborador: {
    getValue: (record) => record.colaborador_id,
    getLabel: (record) => record.matricula
      ? `${record.matricula} - ${record.colaborador}`
      : record.colaborador,
  },
};

const EMPTY_FORM = {
  competencia: null,
  data_falta: null,
  centro_custo_id: null,
  contrato_nome: "",
  departamento: "",
  colaborador_id: null,
  colaborador_nome: "",
  colaborador_matricula: "",
  cobertura: "em_analise",
  quantidade_dias: 1,
  quantidade_horas: 8,
  quantidade_coberta_dias: 0,
  quantidade_coberta_horas: 0,
  valor_diaria: 180,
  justificativa: "",
  observacao: "",
  evidencia_url: null,
  evidencia_nome: "",
};

function defaultPeriod() {
  const today = new Date();
  return [
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
    new Date(today.getFullYear(), today.getMonth(), 0),
  ];
}

function isoDate(value) {
  if (!value) return null;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "—";
}

function coverageTag(value) {
  if (value === "coberta") return <Tag value="COBERTA" severity="success" />;
  if (value === "parcial") return <Tag value="PARCIAL" severity="info" />;
  if (value === "descoberta") return <Tag value="DESCOBERTA" severity="danger" />;
  return <Tag value="EM ANÁLISE" severity="warning" />;
}

function fileIsAllowed(file) {
  return Boolean(file) && (
    file.type === "application/pdf"
    || file.type.startsWith("image/")
    || /\.(pdf|png|jpe?g|webp)$/i.test(file.name || "")
  );
}

function requestErrorMessage(error, fallback) {
  const responseData = error?.response?.data;
  if (typeof responseData === "string" && responseData.trim()) return responseData;
  if (typeof responseData?.message === "string" && responseData.message.trim()) {
    return responseData.message;
  }
  if (error?.response?.status === 401) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  if (!error?.response) {
    return "Não foi possível conectar ao servidor. Verifique se a API está em execução.";
  }
  return fallback;
}

function normalizeRecord(record) {
  const totalDays = Number(record.quantidade_dias || 0);
  const totalHours = Number(record.quantidade_horas ?? totalDays * 8);
  const coveredDays = record.quantidade_coberta_dias != null
    ? Number(record.quantidade_coberta_dias)
    : record.cobertura === "coberta" ? totalDays : 0;
  const coveredHours = record.quantidade_coberta_horas != null
    ? Number(record.quantidade_coberta_horas)
    : coveredDays * 8;
  const totalValue = Number(record.valor_total || 0);
  const coveredValue = record.valor_coberto != null
    ? Number(record.valor_coberto)
    : record.cobertura === "coberta" ? totalValue : 0;
  const uncoveredValue = record.valor_descoberto != null
    ? Number(record.valor_descoberto)
    : ["descoberta", "parcial"].includes(record.cobertura) ? Math.max(0, totalValue - coveredValue) : 0;
  return {
    ...record,
    quantidade_dias: totalDays,
    quantidade_horas: totalHours,
    quantidade_coberta_dias: coveredDays,
    quantidade_coberta_horas: coveredHours,
    valor_total: totalValue,
    valor_coberto: coveredValue,
    valor_descoberto: uncoveredValue,
  };
}

function DisallowanceControlContent() {
  const [period, setPeriod] = useState(defaultPeriod);
  const [records, setRecords] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const filterPanel = useRef(null);
  const fileInput = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canCreate = can("controle_glosas", "create");
  const canEdit = can("controle_glosas", "edit");
  const dialogOpen = Boolean(editing) || Boolean(form.competencia);

  const requestParams = useMemo(() => {
    const params = {};
    if (period?.[0] && period?.[1]) {
      params.inicio = isoDate(period[0]);
      params.fim = isoDate(period[1]);
    }
    return params;
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    connect.get("/glosas", { params: requestParams })
      .then(({ data }) => {
        if (cancelled) return;
        setRecords((Array.isArray(data?.registros) ? data.registros : []).map(normalizeRecord));
      })
      .catch((error) => {
        if (!cancelled) showToast("error", "Controle de Glosas", error.response?.data || "Não foi possível carregar as glosas.");
      });
    return () => { cancelled = true; };
  }, [requestParams, refresh, showToast]);

  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1);
    socketio.on("disallowance_update", reload);
    return () => socketio.off("disallowance_update", reload);
  }, []);

  useEffect(() => {
    if (!dialogOpen || !["coberta", "parcial"].includes(form.cobertura)) return undefined;
    const handlePaste = (event) => {
      const pasted = Array.from(event.clipboardData?.files || []).find((file) => file.type.startsWith("image/"));
      if (!pasted) return;
      event.preventDefault();
      setEvidenceFile(new File([pasted], pasted.name || `evidencia-${Date.now()}.png`, { type: pasted.type }));
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [dialogOpen, form.cobertura]);

  const {
    filteredData: multiSelectFilteredRecords,
    options: filterOptions,
    activeFilterCount,
    clearFilters: clearMultiSelectFilters,
  } = useCombinedFilters(records);

  const filteredRecords = multiSelectFilteredRecords;

  const summary = useMemo(() => ({
    total_registros: filteredRecords.length,
    dias: Number(filteredRecords.reduce((total, record) => total + record.quantidade_dias, 0).toFixed(2)),
    valor_total: filteredRecords.reduce((total, record) => total + record.valor_total, 0),
    valor_coberto: filteredRecords.reduce((total, record) => total + record.valor_coberto, 0),
    valor_descoberto: filteredRecords
      .filter((record) => ["parcial", "descoberta"].includes(record.cobertura))
      .reduce((total, record) => total + record.valor_descoberto, 0),
    valor_em_analise: filteredRecords
      .filter((record) => record.cobertura === "em_analise")
      .reduce((total, record) => total + record.valor_total, 0),
  }), [filteredRecords]);

  const totalValue = Number(form.quantidade_dias || 0) * Number(form.valor_diaria || 0);
  const coveredDays = form.cobertura === "coberta"
    ? Number(form.quantidade_dias || 0)
    : form.cobertura === "parcial"
      ? Number(form.quantidade_coberta_dias || 0)
      : 0;
  const coveredValue = coveredDays * Number(form.valor_diaria || 0);
  const uncoveredValue = Math.max(0, totalValue - coveredValue);

  const openCreate = () => {
    const initialPeriod = period?.[0] || defaultPeriod()[0];
    setEditing(null);
    setEvidenceFile(null);
    setForm({
      ...EMPTY_FORM,
      competencia: initialPeriod,
      data_falta: initialPeriod,
    });
  };

  const openEdit = (record) => {
    const days = Number(record.quantidade_dias || 1);
    const covered = Number(record.quantidade_coberta_dias || 0);
    const isDepartment269 = String(record.departamento) === "269" || String(record.centro_custo_id) === "269";
    setEditing(record);
    setEvidenceFile(null);
    setForm({
      competencia: new Date(`${record.competencia}T12:00:00`),
      data_falta: new Date(`${record.data_falta}T12:00:00`),
      centro_custo_id: record.centro_custo_id,
      contrato_nome: record.contrato || "",
      departamento: record.departamento || "",
      colaborador_id: record.colaborador_id || null,
      colaborador_nome: record.colaborador || "",
      colaborador_matricula: record.matricula || "",
      cobertura: record.cobertura,
      quantidade_dias: days,
      quantidade_horas: record.quantidade_horas ?? Number((days * 8).toFixed(2)),
      quantidade_coberta_dias: covered,
      quantidade_coberta_horas: record.quantidade_coberta_horas ?? Number((covered * 8).toFixed(2)),
      valor_diaria: record.valor_diaria ?? (isDepartment269 ? 182.02 : 180),
      justificativa: record.justificativa || "",
      observacao: record.observacao || "",
      evidencia_url: record.evidencia_url,
      evidencia_nome: record.evidencia_nome || "",
    });
  };

  const close = () => {
    setEditing(null);
    setEvidenceFile(null);
    setForm(EMPTY_FORM);
  };

  const selectEvidence = (file) => {
    if (!file) return;
    if (!fileIsAllowed(file)) {
      showToast("warn", "Formato não permitido", "Envie uma imagem ou um arquivo PDF.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast("warn", "Arquivo muito grande", "A evidência deve ter no máximo 15 MB.");
      return;
    }
    setEvidenceFile(file);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.competencia || !form.data_falta || !form.colaborador_id) {
      return showToast("warn", "Campos obrigatórios", "Informe a competência, a data da falta e selecione o colaborador.");
    }
    setLoading(true);
    let recordId = editing?.id;
    try {
      const payload = {
        ...form,
        competencia: isoDate(form.competencia),
        data_falta: isoDate(form.data_falta),
      };
      delete payload.evidencia_url;
      delete payload.evidencia_nome;
      const response = editing
        ? await connect.patch("/glosas", { id: editing.id, ...payload })
        : await connect.post("/glosas", payload);
      recordId = recordId || response.data?.id;
    } catch (error) {
      showToast(
        "error",
        "Não foi possível salvar a glosa",
        requestErrorMessage(error, "Confira os dados informados."),
      );
      setLoading(false);
      return;
    }

    if (evidenceFile && recordId) {
      try {
        const evidencePayload = new FormData();
        evidencePayload.append("evidencia", evidenceFile, evidenceFile.name);
        await connect.post(`/glosas/${recordId}/evidencia`, evidencePayload);
      } catch (error) {
        // A glosa ja foi persistida. Mantem o dialogo em modo de edicao para
        // repetir o anexo sem criar outro registro.
        if (!editing) setEditing({ id: recordId, ...form });
        setRefresh((value) => value + 1);
        showToast(
          "warn",
          "Glosa salva, mas a evidência não foi enviada",
          requestErrorMessage(error, "Tente anexar o arquivo novamente."),
        );
        setLoading(false);
        return;
      }
    }

    try {
      showToast("success", "Controle de Glosas", editing ? "Glosa atualizada." : "Glosa registrada.");
      close();
      setRefresh((value) => value + 1);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (record) => {
    if (!window.confirm(`Excluir a glosa do contrato ${record.contrato}?`)) return;
    setLoading(true);
    try {
      await connect.delete("/glosas", { data: { id: record.id } });
      setRefresh((value) => value + 1);
      showToast("success", "Controle de Glosas", "Glosa excluída.");
    } catch (error) {
      showToast("error", "Não foi possível excluir", error.response?.data || "Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const removeEvidence = async () => {
    if (!editing?.id || !window.confirm("Remover a evidência salva desta glosa?")) return;
    setLoading(true);
    try {
      await connect.delete(`/glosas/${editing.id}/evidencia`);
      setForm((current) => ({ ...current, evidencia_url: null, evidencia_nome: "" }));
      setEditing((current) => ({ ...current, evidencia_url: null, evidencia_nome: "" }));
      showToast("success", "Evidência", "Evidência removida.");
      setRefresh((value) => value + 1);
    } catch (error) {
      showToast("error", "Evidência", error.response?.data || "Não foi possível remover a evidência.");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setPeriod(defaultPeriod());
    clearMultiSelectFilters();
  };

  const exportSpreadsheet = () => {
    try {
      exportDisallowancesXlsx(filteredRecords, summary);
      showToast("success", "Exportação concluída", "A planilha respeitou todos os filtros aplicados.");
    } catch {
      showToast("error", "Não foi possível exportar", "Tente novamente.");
    }
  };

  const columns = [
    {
      header: "Data",
      field: "data_falta",
      sortable: true,
      style: { width: "8rem" },
      body: (record) => formatDate(record.data_falta),
    },
    {
      header: "Colaborador",
      field: "colaborador",
      sortable: true,
      body: (record) => <div className="glosa-main-cell"><strong>{record.colaborador || "Não identificado"}</strong><small>Matrícula {record.matricula || "não informada"}</small></div>,
    },
    {
      header: "Contrato",
      field: "contrato",
      sortable: true,
      body: (record) => <div className="glosa-main-cell"><strong>{record.contrato || "Não informado"}</strong><small>{record.departamento ? `DPTO. ${record.departamento}` : "Departamento não informado"}</small></div>,
    },
    {
      header: "Cobertura",
      field: "cobertura",
      sortable: true,
      body: (record) => <div className="glosa-main-cell"><span>{coverageTag(record.cobertura)}</span>{record.cobertura_colaborador && <small>Por {record.cobertura_colaborador}</small>}</div>,
    },
    {
      header: "Apontamento",
      field: "quantidade_dias",
      sortable: true,
      body: (record) => <div className="glosa-main-cell"><strong>{record.quantidade_dias} dia(s)</strong><small>{record.quantidade_horas} hora(s)</small></div>,
    },
    {
      header: "Valores",
      field: "valor_total",
      sortable: true,
      body: (record) => <div className="glosa-main-cell"><strong>{money(record.valor_total)}</strong><small className={record.valor_descoberto > 0 ? "glosa-value-danger" : ""}>Saldo: {money(record.valor_descoberto)}</small></div>,
    },
    {
      header: "Evidência",
      field: "evidencia_nome",
      body: (record) => record.evidencia_url
        ? <Button icon={<AppIcon name="paperclip" />} label="Abrir" text size="small" onClick={() => window.open(record.evidencia_url, "_blank", "noopener,noreferrer")} />
        : <span className="glosa-no-evidence">Sem evidência</span>,
    },
    {
      header: "Ações",
      body: (record) => canEdit
        ? <div className="glosa-actions"><Button icon={<AppIcon name="pencil" />} rounded text aria-label="Editar glosa" onClick={() => openEdit(record)} /><Button icon={<AppIcon name="trash" />} rounded text severity="danger" aria-label="Excluir glosa" onClick={() => remove(record)} /></div>
        : "—",
      style: { width: "8rem" },
    },
  ];

  return <section className="glosa-page">
    <PageHeader
      section="Gestão contratual"
      title="Controle de Glosas"
      description="Acompanhe coberturas, valores em análise e perdas por competência."
      actions={<>
        <Button label={activeFilterCount ? `Filtros (${activeFilterCount})` : "Filtros"} icon={<AppIcon name="filter-filled" />} onClick={(event) => filterPanel.current?.toggle(event)} />
        <Button label="Exportar XLSX" icon={<AppIcon name="file-spreadsheet" />} outlined onClick={exportSpreadsheet} />
        {canCreate && <Button label="Nova glosa" icon={<AppIcon name="plus" />} onClick={openCreate} />}
      </>}
    />
    <OverlayPanel ref={filterPanel} className="glosa-filter-panel">
      <div className="glosa-filter-title">
        <div><strong>Filtrar glosas</strong><span>A exportação usa exatamente estes filtros.</span></div>
        <Button icon={<AppIcon name="filter-off" />} rounded text aria-label="Limpar filtros" onClick={clearFilters} />
      </div>
      <div className="glosa-filter-grid">
        <label className="is-wide"><span>Competência</span><Calendar value={period} onChange={(event) => setPeriod(event.value)} selectionMode="range" dateFormat="dd/mm/yy" showIcon readOnlyInput hideOnRangeSelection /></label>
        <CombinedMultiSelect name="cobertura" label="Situação" options={filterOptions.cobertura} placeholder="Todas as situações" />
        <CombinedMultiSelect name="departamento" label="Departamento" options={filterOptions.departamento} placeholder="Todos os departamentos" />
        <CombinedMultiSelect name="contrato" label="Contrato" options={filterOptions.contrato} placeholder="Todos os contratos" className="is-wide" />
        <CombinedMultiSelect name="colaborador" label="Colaborador" options={filterOptions.colaborador} placeholder="Todos os colaboradores" className="is-wide" />
      </div>
    </OverlayPanel>

    <Dialog header={editing ? "Editar glosa" : "Registrar glosa"} visible={dialogOpen} modal className="glosa-dialog" onHide={close}>
      <form className="glosa-form" onSubmit={save}>
        <label><span>Competência</span><Calendar value={form.competencia} onChange={(event) => setForm({ ...form, competencia: event.value })} view="month" dateFormat="mm/yy" showIcon /></label>
        <label><span>Data da falta</span><Calendar value={form.data_falta} onChange={(event) => setForm({ ...form, data_falta: event.value })} dateFormat="dd/mm/yy" showIcon /></label>
        <label className="is-wide">
          <span>Colaborador</span>
          <CollaboratorDropdown
            value={form.colaborador_id}
            selectedOption={form.colaborador_id ? { id: form.colaborador_id, nome: form.colaborador_nome, matricula: form.colaborador_matricula } : null}
            onChange={(employeeId, employee) => {
              if (!employee) {
                setForm((current) => ({ ...current, colaborador_id: null, colaborador_nome: "", colaborador_matricula: "", centro_custo_id: null, contrato_nome: "", departamento: "", valor_diaria: 180 }));
                return;
              }
              const isDepartment269 = String(employee.departamento) === "269" || String(employee.centro_id) === "269";
              const dailyRate = employee.valor_diaria_glosa != null ? Number(employee.valor_diaria_glosa) : (isDepartment269 ? 182.03 : 180);
              setForm((current) => ({
                ...current,
                colaborador_id: employeeId,
                colaborador_nome: employee.nome || "",
                colaborador_matricula: employee.matricula || "",
                centro_custo_id: employee.centro_id || null,
                contrato_nome: employee.centro_local || "",
                departamento: employee.departamento || "",
                valor_diaria: dailyRate,
              }));
            }}
            placeholder="Selecione ou pesquise um colaborador"
          />
        </label>

        {(form.colaborador_id || form.colaborador_nome) && <div className="glosa-colab-card is-wide">
          <div className="glosa-colab-card-header"><AppIcon name="user"  /><strong>{form.colaborador_nome}</strong></div>
          <div className="glosa-colab-card-details">
            <span><AppIcon name="id-badge"  /> <strong>Matrícula:</strong> {form.colaborador_matricula || "Sem matrícula"}</span>
            <span><AppIcon name="building"  /> <strong>Contrato:</strong> {form.contrato_nome || "Não informado"} {form.departamento ? `(DPTO. ${form.departamento})` : ""}</span>
            <span><AppIcon name="currency-dollar"  /> <strong>Diária padrão:</strong> {money(form.valor_diaria)}</span>
          </div>
        </div>}

        <label className="is-wide"><span>Situação da cobertura</span><Dropdown value={form.cobertura} options={COVERAGE_OPTIONS} onChange={(event) => setForm((current) => ({ ...current, cobertura: event.value, quantidade_coberta_dias: event.value === "coberta" ? current.quantidade_dias : 0, quantidade_coberta_horas: event.value === "coberta" ? current.quantidade_horas : 0 }))} /></label>
        <label><span>Quantidade de dias apontados</span><InputNumber value={form.quantidade_dias} onValueChange={(event) => { const days = event.value ?? null; setForm((current) => ({ ...current, quantidade_dias: days, quantidade_horas: days == null ? null : Number((days * 8).toFixed(2)) })); }} min={0.01} minFractionDigits={0} maxFractionDigits={4} /></label>
        <label><span>Horas apontadas (8h/dia)</span><InputNumber value={form.quantidade_horas} onValueChange={(event) => { const hours = event.value ?? null; setForm((current) => ({ ...current, quantidade_horas: hours, quantidade_dias: hours == null ? null : Number((hours / 8).toFixed(4)) })); }} min={0.01} minFractionDigits={0} maxFractionDigits={2} suffix=" h" /></label>

        {form.cobertura === "parcial" && <>
          <label><span>Dias cobertos</span><InputNumber value={form.quantidade_coberta_dias} onValueChange={(event) => { const days = event.value ?? null; setForm((current) => ({ ...current, quantidade_coberta_dias: days, quantidade_coberta_horas: days == null ? null : Number((days * 8).toFixed(2)) })); }} min={0.01} max={Math.max(0, Number(form.quantidade_dias || 0) - 0.0001)} minFractionDigits={0} maxFractionDigits={4} /></label>
          <label><span>Horas cobertas</span><InputNumber value={form.quantidade_coberta_horas} onValueChange={(event) => { const hours = event.value ?? null; setForm((current) => ({ ...current, quantidade_coberta_horas: hours, quantidade_coberta_dias: hours == null ? null : Number((hours / 8).toFixed(4)) })); }} min={0.01} max={Math.max(0, Number(form.quantidade_horas || 0) - 0.01)} minFractionDigits={0} maxFractionDigits={2} suffix=" h" /></label>
        </>}

        <label className="is-wide"><span>Valor por dia (integral 8h)</span><InputNumber value={form.valor_diaria} onValueChange={(event) => setForm({ ...form, valor_diaria: event.value })} mode="currency" currency="BRL" locale="pt-BR" min={0.01} /></label>
        <div className="glosa-calculation is-wide">
          <div><span>Valor apontado</span><strong>{money(totalValue)}</strong></div>
          <div className="is-covered"><span>Valor coberto</span><strong>{money(coveredValue)}</strong></div>
          <div className="is-uncovered"><span>Diferença / saldo</span><strong>{money(uncoveredValue)}</strong></div>
        </div>

        {["coberta", "parcial"].includes(form.cobertura) && <div className="glosa-evidence is-wide">
          <div className="glosa-evidence-heading"><div><strong>Evidência da cobertura</strong><span>PDF ou imagem de até 15 MB</span></div>{form.evidencia_url && <div><Button type="button" label="Abrir atual" icon={<AppIcon name="external-link" />} text size="small" onClick={() => window.open(form.evidencia_url, "_blank", "noopener,noreferrer")} /><Button type="button" label="Remover" icon={<AppIcon name="trash" />} severity="danger" text size="small" onClick={removeEvidence} /></div>}</div>
          <div
            className={`glosa-dropzone ${evidenceFile ? "has-file" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInput.current?.click(); }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); selectEvidence(event.dataTransfer.files?.[0]); }}
          >
            <input ref={fileInput} type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={(event) => selectEvidence(event.target.files?.[0])} />
            <AppIcon name={evidenceFile ? "circle-check" : "cloud-upload"} />
            <strong>{evidenceFile?.name || form.evidencia_nome || "Arraste, clique ou cole uma imagem com Ctrl + V"}</strong>
            <span>{evidenceFile ? `${(evidenceFile.size / 1024 / 1024).toFixed(2)} MB selecionado` : "Você também pode substituir a evidência já salva."}</span>
          </div>
        </div>}

        <label className="is-wide"><span>Justificativa</span><InputTextarea value={form.justificativa} onChange={(event) => setForm({ ...form, justificativa: event.target.value })} rows={3} autoResize /></label>
        <label className="is-wide"><span>Observação</span><InputTextarea value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} rows={3} autoResize /></label>
        <div className="dialog-actions is-wide"><Button type="button" label="Cancelar" text onClick={close} /><Button type="submit" label={editing ? "Salvar alterações" : "Registrar glosa"} icon={<AppIcon name="check" />} /></div>
      </form>
    </Dialog>
    <section className="glosa-summary">
      <article><AppIcon name="list"  /><div><small>Registros</small><strong>{summary.total_registros}</strong><span>no período selecionado</span></div></article>
      <article><AppIcon name="calendar"  /><div><small>Dias apontados</small><strong>{summary.dias}</strong><span>dias de glosa</span></div></article>
      <article><AppIcon name="wallet"  /><div><small>Valor total</small><strong>{money(summary.valor_total)}</strong><span>valor apontado</span></div></article>
      <article className="is-success"><AppIcon name="circle-check"  /><div><small>Valor coberto</small><strong>{money(summary.valor_coberto)}</strong><span>tratativas cobertas</span></div></article>
      <article className="is-danger"><AppIcon name="alert-triangle"  /><div><small>Saldo descoberto</small><strong>{money(summary.valor_descoberto)}</strong><span>exige acompanhamento</span></div></article>
    </section>

    <section className="glosa-panel">
      <Table
        data={filteredRecords}
        columns={columns}
        search
        rows={10}
        rowsPerPageOptions={[10, 25, 50, 100]}
        tableClassName="glosa-table"
      />
    </section>
  </section>;
}

export function DisallowanceControl() {
  return (
    <CombinedFiltersProvider definitions={FILTER_DEFINITIONS}>
      <DisallowanceControlContent />
    </CombinedFiltersProvider>
  );
}
