import { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import { CollaboratorDropdown } from "../../components/CollaboratorDropdown";
import connect from "../../utils/request";
import { socketio } from "../../utils/socketio";
import { can } from "../../utils/permissions";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import "./styles.css";
import "./contrast.css";

const COVERAGE_OPTIONS = [
  { label: "Em análise", value: "em_analise" },
  { label: "Coberta (justificada)", value: "coberta" },
  { label: "Descoberta (injustificada)", value: "descoberta" },
];
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
  valor_diaria: 180,
  justificativa: "",
  observacao: "",
};

function isoDate(value) {
  if (!value) return null;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function coverageTag(value) {
  if (value === "coberta") return <Tag value="COBERTA" severity="success" />;
  if (value === "descoberta") return <Tag value="DESCOBERTA" severity="danger" />;
  return <Tag value="EM ANÁLISE" severity="warning" />;
}

export function DisallowanceControl() {
  const today = new Date();
  const [period, setPeriod] = useState(() => [
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
    new Date(today.getFullYear(), today.getMonth(), 0),
  ]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [centers, setCenters] = useState([]);
  const [search, setSearch] = useState("");
  const [coverage, setCoverage] = useState("__all__");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [refresh, setRefresh] = useState(0);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canCreate = can("controle_glosas", "create");
  const canEdit = can("controle_glosas", "edit");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [{ data }, centersResponse] = await Promise.all([
          connect.get("/glosas", { params: period?.[0] && period?.[1] ? { inicio: isoDate(period[0]), fim: isoDate(period[1]) } : {} }),
          connect.get("/centro"),
        ]);
        if (!cancelled) {
          setRecords(Array.isArray(data?.registros) ? data.registros : []);
          setSummary(data?.resumo || {});
          setCenters((Array.isArray(centersResponse.data) ? centersResponse.data : []).map((item) => ({
            label: `${item.id} - ${item.local}`,
            value: item.id,
          })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true })));
        }
      } catch (error) {
        if (!cancelled) showToast("error", "Controle de Glosas", error.response?.data || "Não foi possível carregar as glosas.");
      }
    };
    load();
    return () => { cancelled = true; };
  }, [period, refresh, showToast]);

  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1);
    socketio.on("disallowance_update", reload);
    return () => socketio.off("disallowance_update", reload);
  }, []);

  const filtered = useMemo(() => records.filter((record) => {
    if (coverage !== "__all__" && record.cobertura !== coverage) return false;
    const term = search.trim().toLowerCase();
    return !term || [record.contrato, record.colaborador, record.matricula, record.justificativa]
      .some((value) => String(value || "").toLowerCase().includes(term));
  }), [records, search, coverage]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      competencia: period?.[0] || new Date(today.getFullYear(), today.getMonth() - 1, 1),
      data_falta: period?.[0] || new Date(),
    });
  };

  const openEdit = (record) => {
    const days = Number(record.quantidade_dias || 1);
    const hours = record.quantidade_horas ?? Number((days * 8).toFixed(2));
    const isDpto269 = String(record.departamento) === "269" || String(record.centro_custo_id) === "269";
    const defaultRate = isDpto269 ? 182.02 : 180;
    setEditing(record);
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
      quantidade_horas: hours,
      valor_diaria: record.valor_diaria ?? defaultRate,
      justificativa: record.justificativa || "",
      observacao: record.observacao || "",
    });
  };

  const close = () => { setEditing(null); setForm(EMPTY_FORM); };

  const save = async (event) => {
    event.preventDefault();
    if (!form.competencia || !form.data_falta || (!form.colaborador_id && !form.colaborador_nome)) {
      return showToast("warn", "Campos obrigatórios", "Informe a competência, data da falta e selecione o colaborador.");
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        competencia: isoDate(form.competencia),
        data_falta: isoDate(form.data_falta),
      };
      if (editing) await connect.patch("/glosas", { id: editing.id, ...payload });
      else await connect.post("/glosas", payload);
      showToast("success", "Controle de Glosas", editing ? "Glosa atualizada." : "Glosa registrada.");
      close();
      setRefresh((value) => value + 1);
    } catch (error) {
      showToast("error", "Não foi possível salvar", error.response?.data || "Confira os dados informados.");
    } finally { setLoading(false); }
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
    } finally { setLoading(false); }
  };

  return <section className="glosa-page">
    <header className="glosa-heading">
      <div><span>Gestão contratual</span><h1>Controle de Glosas</h1><p>Acompanhe coberturas, valores em análise e perdas por competência.</p></div>
      <div className="glosa-heading-actions">
        <Calendar value={period} onChange={(event) => setPeriod(event.value)} selectionMode="range" dateFormat="dd/mm/yy" showIcon readOnlyInput hideOnRangeSelection />
        <Button label="Atualizar" icon="pi pi-refresh" outlined onClick={() => setRefresh((value) => value + 1)} />
        {canCreate && <Button label="Nova glosa" icon="pi pi-plus" onClick={openCreate} />}
      </div>
    </header>

    <div className="glosa-summary">
      <article><i className="pi pi-file" /><div><small>Registros</small><strong>{summary.total_registros || 0}</strong><span>{summary.dias || 0} dia(s)</span></div></article>
      <article><i className="pi pi-wallet" /><div><small>Valor apontado</small><strong>{money(summary.valor_total)}</strong><span>no período</span></div></article>
      <article className="is-success"><i className="pi pi-shield" /><div><small>Coberto</small><strong>{money(summary.valor_coberto)}</strong><span>justificado</span></div></article>
      <article className="is-danger"><i className="pi pi-exclamation-triangle" /><div><small>Descoberto</small><strong>{money(summary.valor_descoberto)}</strong><span>perda confirmada</span></div></article>
      <article className="is-warning"><i className="pi pi-clock" /><div><small>Em análise</small><strong>{money(summary.valor_em_analise)}</strong><span>aguardando tratativa</span></div></article>
    </div>

    <article className="glosa-panel">
      <div className="glosa-toolbar">
        <span className="p-input-icon-left"><i className="pi pi-search" /><InputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contrato, colaborador ou justificativa" /></span>
        <Dropdown value={coverage} options={[{ label: "Todas as situações", value: "__all__" }, ...COVERAGE_OPTIONS]} onChange={(event) => setCoverage(event.value)} />
      </div>
      <DataTable value={filtered} paginator rows={10} rowsPerPageOptions={[10, 25, 50, 100]} stripedRows size="small" dataKey="id" emptyMessage="Nenhuma glosa encontrada para o período.">
        <Column field="competencia" header="Competência" sortable body={(row) => new Date(`${row.competencia}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} />
        <Column field="data_falta" header="Falta" sortable body={(row) => new Date(`${row.data_falta}T12:00:00`).toLocaleDateString("pt-BR")} />
        <Column field="contrato" header="Contrato" sortable body={(row) => <div className="glosa-main-cell"><strong>{row.contrato}</strong><small>DPTO. {row.departamento ?? "—"}</small></div>} />
        <Column field="colaborador" header="Colaborador" body={(row) => <div className="glosa-main-cell"><strong>{row.colaborador || "Não informado"}</strong><small>{row.matricula ? `Matrícula ${row.matricula}` : "Sem matrícula"}</small></div>} />
        <Column field="cobertura" header="Situação" sortable body={(row) => coverageTag(row.cobertura)} />
        <Column field="quantidade_dias" header="Tempo" sortable body={(row) => `${row.quantidade_dias}d (${row.quantidade_horas ?? (row.quantidade_dias * 8).toFixed(1)}h)`} />
        <Column field="valor_diaria" header="Diária" body={(row) => money(row.valor_diaria)} />
        <Column field="valor_total" header="Valor" sortable body={(row) => <strong>{money(row.valor_total)}</strong>} />
        {canEdit && <Column header="Ações" body={(row) => <div className="glosa-actions"><Button icon="pi pi-pencil" rounded text aria-label="Editar glosa" onClick={() => openEdit(row)} /><Button icon="pi pi-trash" severity="danger" rounded text aria-label="Excluir glosa" onClick={() => remove(row)} /></div>} />}
      </DataTable>
    </article>

    <Dialog header={editing ? "Editar glosa" : "Registrar glosa"} visible={Boolean(editing) || Boolean(form.competencia)} modal className="glosa-dialog" onHide={close}>
      <form className="glosa-form" onSubmit={save}>
        <label><span>Competência</span><Calendar value={form.competencia} onChange={(event) => setForm({ ...form, competencia: event.value })} view="month" dateFormat="mm/yy" showIcon /></label>
        <label><span>Data da falta</span><Calendar value={form.data_falta} onChange={(event) => setForm({ ...form, data_falta: event.value })} dateFormat="dd/mm/yy" showIcon /></label>
        <label className="is-wide">
          <span>Colaborador</span>
          <CollaboratorDropdown
            value={form.colaborador_id}
            selectedOption={
              form.colaborador_id
                ? { id: form.colaborador_id, nome: form.colaborador_nome, matricula: form.colaborador_matricula }
                : null
            }
            onChange={(colabId, colabObj) => {
              if (colabObj) {
                const isDpto269 = String(colabObj.departamento) === "269" || String(colabObj.centro_id) === "269";
                const autoRate = colabObj.valor_diaria_glosa != null ? Number(colabObj.valor_diaria_glosa) : (isDpto269 ? 182.02 : 180.00);
                setForm((prev) => ({
                  ...prev,
                  colaborador_id: colabId,
                  colaborador_nome: colabObj.nome || "",
                  colaborador_matricula: colabObj.matricula || "",
                  centro_custo_id: colabObj.centro_id || null,
                  contrato_nome: colabObj.centro_local || "",
                  departamento: colabObj.departamento || "",
                  valor_diaria: autoRate,
                }));
              } else {
                setForm((prev) => ({
                  ...prev,
                  colaborador_id: null,
                  colaborador_nome: "",
                  colaborador_matricula: "",
                  centro_custo_id: null,
                  contrato_nome: "",
                  departamento: "",
                  valor_diaria: 180,
                }));
              }
            }}
            placeholder="Selecione um colaborador"
          />
        </label>

        {(form.colaborador_id || form.colaborador_nome) && (
          <div className="glosa-colab-card is-wide">
            <div className="glosa-colab-card-header">
              <i className="pi pi-user" />
              <strong>{form.colaborador_nome}</strong>
            </div>
            <div className="glosa-colab-card-details">
              <span><i className="pi pi-id-card" /> <strong>Matrícula:</strong> {form.colaborador_matricula || "Sem matrícula"}</span>
              <span><i className="pi pi-building" /> <strong>Contrato:</strong> {form.contrato_nome || (form.centro_custo_id ? `ID ${form.centro_custo_id}` : "Não informado")} {form.departamento ? `(DPTO. ${form.departamento})` : ""}</span>
              <span><i className="pi pi-dollar" /> <strong>Diária Padrão:</strong> R$ {Number(form.valor_diaria || 180).toFixed(2)}</span>
            </div>
          </div>
        )}
        <label className="is-wide"><span>Situação da cobertura</span><Dropdown value={form.cobertura} options={COVERAGE_OPTIONS} onChange={(event) => setForm({ ...form, cobertura: event.value })} /></label>
        <label>
          <span>Quantidade de dias</span>
          <InputNumber
            value={form.quantidade_dias}
            onValueChange={(event) => {
              const days = event.value != null ? event.value : null;
              const hours = days != null ? Number((days * 8).toFixed(2)) : null;
              setForm((prev) => ({ ...prev, quantidade_dias: days, quantidade_horas: hours }));
            }}
            min={0.01}
            minFractionDigits={0}
            maxFractionDigits={4}
          />
        </label>
        <label>
          <span>Quantidade de horas (8h/dia)</span>
          <InputNumber
            value={form.quantidade_horas}
            onValueChange={(event) => {
              const hours = event.value != null ? event.value : null;
              const days = hours != null ? Number((hours / 8).toFixed(4)) : null;
              setForm((prev) => ({ ...prev, quantidade_horas: hours, quantidade_dias: days }));
            }}
            min={0.01}
            minFractionDigits={0}
            maxFractionDigits={2}
            suffix=" h"
          />
        </label>
        <label className="is-wide"><span>Valor por dia (Integral 8h)</span><InputNumber value={form.valor_diaria} onValueChange={(event) => setForm({ ...form, valor_diaria: event.value })} mode="currency" currency="BRL" locale="pt-BR" min={0.01} /></label>
        <div className="glosa-calculated is-wide"><span>Valor total calculado</span><strong>{money(Number(form.quantidade_dias || 0) * Number(form.valor_diaria || 0))}</strong></div>
        <label className="is-wide"><span>Justificativa</span><InputTextarea value={form.justificativa} onChange={(event) => setForm({ ...form, justificativa: event.target.value })} rows={3} autoResize /></label>
        <label className="is-wide"><span>Observação</span><InputTextarea value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} rows={3} autoResize /></label>
        <div className="dialog-actions is-wide"><Button type="button" label="Cancelar" text onClick={close} /><Button type="submit" label={editing ? "Salvar alterações" : "Registrar glosa"} icon="pi pi-check" /></div>
      </form>
    </Dialog>
  </section>;
}
