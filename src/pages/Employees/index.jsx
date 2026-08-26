import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { Paginator } from "primereact/paginator";
import { ProgressBar } from "primereact/progressbar";
import { Tag } from "primereact/tag";
import { PageHeader } from "../../components/PageHeader";
import { Table } from "../../components/tables/Table";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import "./employees.css";

const EMPTY_FILTERS = { empresas: [], departamentos: [], centros: [], cargos: [], situacoes: [] };
const CHUNK = 512 * 1024;

function date(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("pt-BR");
}

function ImportEmployees({ onCompleted }) {
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(null);
  const [file, setFile] = useState(null);
  const [job, setJob] = useState(null);
  const [stage, setStage] = useState("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    connect.get("/importacao-colaboradores/empresas").then(({ data }) => {
      setCompanies((Array.isArray(data) ? data : []).filter((item) => item.ativa).map((item) => ({ label: item.nome, value: item.id })));
    }).catch(() => showToast("error", "Empresas", "Não foi possível carregar as empresas."));
  }, [showToast]);

  useEffect(() => {
    if (!job?.id || !["uploading", "processing"].includes(stage)) return undefined;
    let active = true;
    const poll = async () => {
      try {
        const { data } = await connect.get(`/importacao-colaboradores/${job.id}`);
        if (!active) return;
        setJob(data);
        if (data.status === "completed") {
          setStage("completed");
          showToast("success", "Importação concluída", `${data.colaboradores_criados || 0} criado(s) e ${data.colaboradores_atualizados || 0} atualizado(s).`);
          onCompleted?.();
        }
        if (data.status === "error") { setStage("error"); showToast("error", "Importação", data.erro || "Não foi possível concluir a importação."); }
      } catch { if (active) { setStage("error"); showToast("error", "Importação", "Não foi possível acompanhar a importação."); } }
    };
    poll(); const timer = window.setInterval(poll, 900);
    return () => { active = false; window.clearInterval(timer); };
  }, [job?.id, stage, showToast, onCompleted]);

  const choose = (selected) => {
    if (!selected) return;
    if (!/\.(xls|xlsx)$/i.test(selected.name)) return showToast("warn", "Arquivo inválido", "Use o relatório de colaboradores em XLS ou XLSX.");
    setFile(selected); setJob(null); setStage("idle"); setProgress(0);
  };

  const upload = async () => {
    if (!file || !companyId) return;
    setStage("uploading"); setProgress(0);
    try {
      const chunks = Math.ceil(file.size / CHUNK);
      const { data: created } = await connect.post("/importacao-colaboradores/upload/iniciar", { filename: file.name, size: file.size, chunks, empresa_id: companyId });
      setJob(created);
      for (let index = 0; index < chunks; index += 1) {
        const start = index * CHUNK;
        const payload = new FormData(); payload.append("chunk", file.slice(start, Math.min(file.size, start + CHUNK)), `${file.name}.part`); payload.append("index", String(index));
        await connect.post(`/importacao-colaboradores/${created.id}/parte`, payload, { timeout: 120000, onUploadProgress: (event) => setProgress(Math.round(Math.min(file.size, start + (event.loaded || 0)) / file.size * 100)) });
      }
      const { data } = await connect.post(`/importacao-colaboradores/${created.id}/concluir`, null, { timeout: 120000 });
      setJob(data); setStage("processing"); setProgress(100);
    } catch (error) { setStage("error"); showToast("error", "Importação", error.response?.data || "Não foi possível enviar o relatório."); }
  };

  const running = ["uploading", "processing"].includes(stage);
  const percent = stage === "uploading" ? progress : Number(job?.percentual || 0);
  const label = stage === "uploading" ? `Enviando arquivo: ${progress}%` : `${job?.phase || "Preparando"}: ${job?.processados || 0} de ${job?.total || 0}`;
  return <article className="entity-import-card">
    <div><i className="pi pi-upload" /><span><strong>Importar colaboradores</strong><small>O arquivo atualiza colaboradores apenas na empresa escolhida. Centros são resolvidos pelo código já cadastrado.</small></span></div>
    <Dropdown value={companyId} options={companies} filter showClear disabled={running} onChange={(event) => setCompanyId(event.value)} placeholder="Empresa da importação *" />
    <div className="entity-import-card__drop" role="button" tabIndex={0} onClick={() => !running && fileRef.current?.click()} onKeyDown={(event) => event.key === "Enter" && fileRef.current?.click()}>
      <input ref={fileRef} hidden type="file" accept=".xls,.xlsx" onChange={(event) => choose(event.target.files?.[0])} />
      <i className={`pi ${file ? "pi-file-excel" : "pi-cloud-upload"}`} /><strong>{file?.name || "Selecionar relatório XLS/XLSX"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "RELAÇÃO DE EMPREGADOS II"}</small>
    </div>
    {stage !== "idle" && <div className="entity-import-card__progress"><span>{label}</span><ProgressBar value={percent} showValue={false} /></div>}
    {job?.status === "completed" && <small className="entity-import-card__result">Cargos criados: {job.cargos_criados || 0} · Ignorados: {job.colaboradores_ignorados || 0} · Duplicidades: {job.duplicidades || 0}</small>}
    <Button label={running ? "Importação em andamento" : "Iniciar importação"} icon="pi pi-upload" disabled={!file || !companyId || running} onClick={upload} />
  </article>;
}

export function EmployeesPage() {
  const { showToast } = useToast();
  const overlay = useRef(null);
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [options, setOptions] = useState({ empresas: [], departamentos: [], centros: [], cargos: [], situacoes: [] });
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]); const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0); const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); const [form, setForm] = useState({});
  const [importVisible, setImportVisible] = useState(false);

  const query = useMemo(() => ({ paginado: true, page: page + 1, per_page: 50, search: search || undefined,
    empresa_ids: filters.empresas.join(",") || undefined, departamentos: filters.departamentos.join(",") || undefined,
    centro_ids: filters.centros.join(",") || undefined, cargo_ids: filters.cargos.join(",") || undefined,
    situacao_ids: filters.situacoes.join(",") || undefined }), [filters, page, search]);

  const load = useCallback(async () => {
    try { setLoading(true); const { data } = await connect.get("/funcionarios", { params: query }); setRows(data.items || []); setTotal(data.total || 0); }
    catch (error) { showToast("error", "Colaboradores", error.response?.data || "Não foi possível carregar os colaboradores."); }
    finally { setLoading(false); }
  }, [query, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => { load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => { connect.get("/funcionarios/filtros").then(({ data }) => setOptions(data || {})).catch(() => {}); }, []);

  const exportRows = async () => {
    try { const { data } = await connect.get("/funcionarios/exportar", { params: query, responseType: "blob" }); const url = URL.createObjectURL(data); const link = document.createElement("a"); link.href = url; link.download = "colaboradores.xlsx"; link.click(); URL.revokeObjectURL(url); }
    catch { showToast("error", "Exportação", "Não foi possível exportar os colaboradores filtrados."); }
  };
  const save = async () => {
    try { await connect.patch(`/funcionarios/${editing.id}`, form); setEditing(null); showToast("success", "Colaborador", "Cadastro atualizado."); load(); }
    catch (error) { showToast("error", "Colaborador", error.response?.data || "Confira os dados informados."); }
  };
  const columns = [
    { header: "Matrícula", field: "matricula", sortable: true }, { header: "Colaborador", field: "nome", sortable: true },
    { header: "Situação", field: "situacao", body: (row) => <Tag value={row.situacao || "Não informada"} severity={Number(row.situacao_id) === 1 ? "success" : "secondary"} /> },
    { header: "Cargo", field: "cargo" }, { header: "Empresa", field: "empresa_nome" }, { header: "Departamento", body: (row) => row.departamento == null ? "—" : `DPTO. ${row.departamento}` },
    { header: "Centro de custo", body: (row) => `${row.centro_numero || "—"} - ${row.centro_local || "Sem local"}` }, { header: "Admissão", body: (row) => date(row.data_admissao) },
    ...(isAdmin ? [{ header: "Ações", body: (row) => <Button icon="pi pi-pencil" text rounded aria-label={`Editar ${row.nome}`} onClick={() => { setEditing(row); setForm({ nome: row.nome || "", cargo_id: row.cargo_id || null, situacao_id: row.situacao_id || null, centro_id: row.centro_id || null }); }} /> }] : []),
  ];
  const activeFilters = Object.values(filters).filter((value) => value.length).length;

  return <section className="entity-page">
    <PageHeader section="RH" title="Colaboradores" description="Consulte os colaboradores da filial selecionada. Dados sensíveis não são exibidos." actions={<div className="entity-page__actions">{isAdmin && <Button label="Importar" icon="pi pi-upload" outlined onClick={() => setImportVisible(true)} />}<Button label="Exportar" icon="pi pi-file-excel" outlined onClick={exportRows} /><Button label={activeFilters ? `Filtros (${activeFilters})` : "Filtros"} icon="pi pi-filter-fill" onClick={(event) => overlay.current?.toggle(event)} /></div>} />
    <article className="entity-table-card"><div className="entity-table-card__header"><div><strong>Base de colaboradores</strong><small>{total.toLocaleString("pt-BR")} registro(s) no escopo atual</small></div><InputText value={search} onChange={(event) => { setPage(0); setSearch(event.target.value); }} placeholder="Buscar nome, matrícula, cargo ou centro" /></div><Table data={rows} columns={columns} loading={loading} mode="scroll" tableStyle={{ minWidth: "1080px" }} emptyTitle="Nenhum colaborador encontrado" emptyDescription="Ajuste os filtros ou a filial global." /><Paginator first={page * 50} rows={50} totalRecords={total} onPageChange={(event) => setPage(event.page)} /></article>
    <OverlayPanel ref={overlay} className="entity-filter-panel"><div className="entity-filter-panel__head"><strong>Filtros de colaboradores</strong><Button icon="pi pi-filter-slash" text rounded onClick={() => { setPage(0); setFilters(EMPTY_FILTERS); }} /></div>{[["empresas", "Empresas"], ["departamentos", "Departamentos"], ["centros", "Centros de custo"], ["cargos", "Cargos"], ["situacoes", "Situações"]].map(([key, label]) => <label key={key}><span>{label}</span><MultiSelect value={filters[key]} options={options[key] || []} optionLabel="label" optionValue="value" filter display="chip" placeholder={`Todos os ${label.toLowerCase()}`} onChange={(event) => { setPage(0); setFilters((current) => ({ ...current, [key]: event.value || [] })); }} /></label>)}</OverlayPanel>
    <Dialog header="Importar colaboradores" visible={importVisible} modal className="employee-dialog entity-import-dialog" onHide={() => setImportVisible(false)}><ImportEmployees onCompleted={() => { setImportVisible(false); load(); }} /></Dialog>
    <Dialog header={`Editar ${editing?.nome || "colaborador"}`} visible={Boolean(editing)} modal className="employee-dialog" onHide={() => setEditing(null)} footer={<div className="dialog-actions"><Button label="Cancelar" text onClick={() => setEditing(null)} /><Button label="Salvar" icon="pi pi-check" onClick={save} /></div>}><div className="employee-dialog__form"><label>Nome<InputText value={form.nome || ""} onChange={(event) => setForm({ ...form, nome: event.target.value })} /></label><label>Cargo<Dropdown value={form.cargo_id} options={options.cargos || []} optionLabel="label" optionValue="value" filter showClear onChange={(event) => setForm({ ...form, cargo_id: event.value })} /></label><label>Situação<Dropdown value={form.situacao_id} options={options.situacoes || []} optionLabel="label" optionValue="value" filter showClear onChange={(event) => setForm({ ...form, situacao_id: event.value })} /></label><label>Centro de custo<Dropdown value={form.centro_id} options={options.centros || []} optionLabel="label" optionValue="value" filter showClear onChange={(event) => setForm({ ...form, centro_id: event.value })} /></label></div></Dialog>
  </section>;
}
