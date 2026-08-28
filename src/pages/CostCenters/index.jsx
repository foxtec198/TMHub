import { AppIcon } from "../../components/icons/AppIcon";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { ProgressBar } from "primereact/progressbar";
import { Tag } from "primereact/tag";
import { PageHeader } from "../../components/PageHeader";
import { Table } from "../../components/tables/Table";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import "../Employees/employees.css";

const EMPTY = { empresa_id: null, numero: null, nome: "", capacidade_pessoas: null };

function CenterImport({ companies, onCompleted }) {
  const { showToast } = useToast(); const input = useRef(null);
  const [companyId, setCompanyId] = useState(null); const [file, setFile] = useState(null); const [job, setJob] = useState(null); const [upload, setUpload] = useState(0);
  useEffect(() => {
    if (!job?.id || !["queued", "processing"].includes(job.status)) return undefined;
    let active = true; const poll = async () => { try { const { data } = await connect.get(`/centro/importacoes/${job.id}`); if (!active) return; setJob(data); if (data.status === "completed") { showToast("success", "Centros de custo", `${data.centros_criados || 0} centro(s) criado(s) e ${data.centros_atualizados || 0} atualizado(s).`); onCompleted(); } if (data.status === "error") showToast("error", "Importação", data.erro || "Não foi possível concluir."); } catch { if (active) showToast("error", "Importação", "Não foi possível acompanhar a importação."); } };
    poll(); const timer = window.setInterval(poll, 900); return () => { active = false; window.clearInterval(timer); };
  }, [job?.id, job?.status, onCompleted, showToast]);
  const submit = async () => { if (!file || !companyId) return; try { const body = new FormData(); body.append("file", file); body.append("empresa_id", String(companyId)); const { data } = await connect.post("/centro/importar", body, { timeout: 120000, onUploadProgress: (event) => setUpload(Math.round((event.loaded || 0) / (event.total || file.size) * 100)) }); setJob(data); } catch (error) { showToast("error", "Importação", error.response?.data || "Não foi possível enviar a planilha."); } };
  const running = ["queued", "processing"].includes(job?.status);
  return <article className="entity-import-card"><div><AppIcon name="file-import" /><span><strong>Importar centros de custo</strong><small>Atualiza somente a empresa selecionada por empresa + número do centro.</small></span></div><Dropdown value={companyId} options={companies} optionLabel="label" optionValue="value" filter showClear disabled={running} placeholder="Empresa da importação *" onChange={(event) => setCompanyId(event.value)} /><div className="entity-import-card__drop" role="button" tabIndex={0} onClick={() => input.current?.click()}><input ref={input} hidden type="file" accept=".xls,.xlsx" onChange={(event) => { const selected = event.target.files?.[0]; if (selected && /\.(xls|xlsx)$/i.test(selected.name)) { setFile(selected); setJob(null); } else showToast("warn", "Arquivo inválido", "Use a planilha XLS/XLSX de centros."); }} /><AppIcon name={file ? "file-spreadsheet" : "cloud-upload"} /><strong>{file?.name || "Selecionar planilha XLS/XLSX"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Código e nome do centro de custo"}</small></div>{job && <div className="entity-import-card__progress"><span>{job.phase || "Preparando"}: {job.processados || 0} de {job.total || 0}</span><ProgressBar value={job.percentual ?? upload} showValue={false} /></div>}<Button label={running ? "Importação em andamento" : "Importar centros"} icon={<AppIcon name="upload" />} disabled={!file || !companyId || running} onClick={submit} /></article>;
}

export function CostCentersPage() {
  const { showToast } = useToast(); const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  const [rows, setRows] = useState([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(0); const [rowsPerPage, setRowsPerPage] = useState(50); const [loading, setLoading] = useState(true); const [search, setSearch] = useState(""); const [companies, setCompanies] = useState([]); const [visible, setVisible] = useState(false); const [importVisible, setImportVisible] = useState(false); const [form, setForm] = useState(EMPTY);
  const load = useCallback(async () => { try { setLoading(true); const { data } = await connect.get("/centro", { params: { paginado: true, page: page + 1, per_page: rowsPerPage, search: search || undefined } }); setRows(data.items || []); setTotal(data.total || 0); } catch (error) { showToast("error", "Centros de custo", error.response?.data || "Não foi possível carregar os centros."); } finally { setLoading(false); } }, [page, rowsPerPage, search, showToast]);
  useEffect(() => {
    const timer = window.setTimeout(() => { load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const reloadForScope = () => { setPage(0); load(); };
    window.addEventListener("tmhub:standard-filters-changed", reloadForScope);
    return () => window.removeEventListener("tmhub:standard-filters-changed", reloadForScope);
  }, [load]);
  useEffect(() => {
    if (!isAdmin) return;
    connect.get("/centro/empresas")
      .then(({ data }) => setCompanies((data || []).filter((item) => item.ativa).map((item) => ({ label: item.nome, value: item.id }))))
      .catch(() => {});
  }, [isAdmin]);
  const save = async () => { try { await (form.id ? connect.patch("/centro", form) : connect.post("/centro", form)); setVisible(false); setForm(EMPTY); showToast("success", "Centro de custo", form.id ? "Centro atualizado." : "Centro cadastrado."); load(); } catch (error) { showToast("error", "Centro de custo", error.response?.data || "Confira os dados informados."); } };
  const columns = [{ header: "Número", field: "numero", sortable: true }, { header: "Nome / local", field: "local", sortable: true }, { header: "Empresa", body: (row) => <Tag value={row.empresa_nome || "Sem empresa"} severity={row.empresa_nome ? "info" : "warning"} /> }, { header: "Departamento", body: (row) => row.departamento == null ? "—" : `DPTO. ${row.departamento}` }, { header: "Capacidade", body: (row) => row.capacidade_pessoas == null ? "—" : `${row.capacidade_pessoas} pessoa(s)` }, ...(isAdmin ? [{ header: "Ações", body: (row) => <Button icon={<AppIcon name="pencil" />} text rounded onClick={() => { setForm({ id: row.id, empresa_id: row.empresa_id, numero: row.numero, nome: row.nome || row.local || "", capacidade_pessoas: row.capacidade_pessoas ?? null }); setVisible(true); }} /> }] : [])];
  return <section className="entity-page"><PageHeader section="Estrutura" title="Centros de custo" description="Catálogo corporativo por empresa. O mesmo número pode existir em empresas diferentes." actions={isAdmin && <div className="entity-page__actions"><Button label="Importar" icon={<AppIcon name="upload" />} outlined onClick={() => setImportVisible(true)} /><Button label="Novo centro" icon={<AppIcon name="plus" />} onClick={() => { setForm(EMPTY); setVisible(true); }} /></div>} /><article className="entity-table-card"><div className="entity-table-card__header"><div><strong>Centros no escopo atual</strong><small>{total.toLocaleString("pt-BR")} registro(s)</small></div></div><Table data={rows} columns={columns} loading={loading} search searchValue={search} onSearchChange={(value) => { setPage(0); setSearch(value); }} remotePagination={{ totalRecords: total, first: page * rowsPerPage, onPageChange: (event) => { setPage(event.page); setRowsPerPage(event.rows); } }} rows={rowsPerPage} rowsPerPageOptions={[25, 50, 100]} tableStyle={{ minWidth: "820px" }} emptyTitle="Nenhum centro encontrado" emptyDescription="Ajuste a filial global ou a busca." /></article><Dialog header="Importar centros de custo" visible={importVisible} modal className="employee-dialog entity-import-dialog" onHide={() => setImportVisible(false)}><CenterImport companies={companies} onCompleted={() => { setImportVisible(false); load(); }} /></Dialog><Dialog header={form.id ? "Editar centro de custo" : "Novo centro de custo"} visible={visible} modal className="employee-dialog" onHide={() => setVisible(false)} footer={<div className="dialog-actions"><Button label="Cancelar" text onClick={() => setVisible(false)} /><Button label={form.id ? "Salvar" : "Cadastrar"} icon={<AppIcon name="check" />} disabled={!form.empresa_id || !form.numero || !form.nome.trim()} onClick={save} /></div>}><div className="employee-dialog__form"><label>Empresa *<Dropdown value={form.empresa_id} options={companies} optionLabel="label" optionValue="value" filter onChange={(event) => setForm({ ...form, empresa_id: event.value })} /></label><label>Número *<InputNumber value={form.numero} useGrouping={false} min={1} onValueChange={(event) => setForm({ ...form, numero: event.value })} /></label><label>Nome / local *<InputText value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} /></label><label>Capacidade (opcional)<InputNumber value={form.capacidade_pessoas} useGrouping={false} min={0} onValueChange={(event) => setForm({ ...form, capacidade_pessoas: event.value ?? null })} /></label></div></Dialog></section>;
}
