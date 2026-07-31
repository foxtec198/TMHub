import { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import { Table } from "../../components/tables/Table";
import connect from "../../utils/request";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";

const EMPTY_FORM = { nome: "", ativa: true, usuario_ids: [], centro_custo_ids: [], departamentos: [] };

export function BranchSettings() {
  const [branches, setBranches] = useState([]);
  const [options, setOptions] = useState({ usuarios: [], centros_custo: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([connect.get("/filiais"), connect.get("/filiais/opcoes")])
      .then(([branchResponse, optionsResponse]) => {
        setBranches(Array.isArray(branchResponse.data) ? branchResponse.data : []);
        setOptions(optionsResponse.data || { usuarios: [], centros_custo: [] });
      })
      .catch((error) => showToast("error", "Filiais", error.response?.data || "Não foi possível carregar as filiais."));
  }, [refresh, showToast]);

  const departmentOptions = useMemo(() => [...new Set(options.centros_custo.map((center) => center.departamento).filter((value) => value != null))]
    .sort((a, b) => Number(a) - Number(b)).map((value) => ({ label: `DPTO. ${value}`, value })), [options.centros_custo]);
  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setDialog(true); };
  const openEdit = (branch) => {
    setEditingId(branch.id);
    setForm({ nome: branch.nome || "", ativa: branch.ativa !== false, usuario_ids: branch.usuario_ids || [], centro_custo_ids: branch.centro_custo_ids || [], departamentos: branch.departamentos || [] });
    setDialog(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (editingId) await connect.patch("/filiais", { id: editingId, ...form });
      else await connect.post("/filiais", form);
      setDialog(false);
      setRefresh((value) => value + 1);
      showToast("success", "Filiais", editingId ? "Filial atualizada." : "Filial criada.");
    } catch (error) {
      showToast("error", "Não foi possível salvar", error.response?.data || "Confira os dados informados.");
    } finally { setLoading(false); }
  };

  const columns = [
    { header: "Filial", field: "nome", sortable: true },
    { header: "Status", field: "ativa", body: (branch) => <Tag value={branch.ativa ? "ATIVA" : "INATIVA"} severity={branch.ativa ? "success" : "secondary"} /> },
    { header: "Usuários", body: (branch) => branch.usuario_ids?.length || 0 },
    { header: "Contratos", body: (branch) => branch.centro_custo_ids?.length || 0 },
    { header: "Departamentos", body: (branch) => branch.departamentos?.join(", ") || "—" },
    { header: "Ações", body: (branch) => <Button icon="pi pi-pencil" rounded text aria-label={`Editar ${branch.nome}`} onClick={() => openEdit(branch)} /> },
  ];

  return <div className="branch-settings-layout">
    <article className="settings-card branch-table-card">
      <div className="settings-card-title"><i className="pi pi-building" /><div><h2>Filiais</h2><p>Defina os usuários e contratos de cada unidade</p></div></div>
      <Table data={branches} columns={columns} search rows={5} rowsPerPageOptions={[5, 10, 25]} />
    </article>
    <aside className="settings-card branch-help-card">
      <div className="settings-card-title"><i className="pi pi-sitemap" /><div><h2>Escopo de acesso</h2><p>As filiais vinculadas ao usuário são unificadas</p></div></div>
      <p>Selecionar um departamento inclui todos os contratos dele. Depois você também pode ajustar os contratos individualmente.</p>
      <Button label="Nova filial" icon="pi pi-plus" onClick={openCreate} />
    </aside>

    <Dialog header={editingId ? "Editar filial" : "Nova filial"} visible={dialog} modal className="branch-dialog" onHide={() => setDialog(false)}>
      <form className="branch-form" onSubmit={save}>
        <label htmlFor="branch-name">Nome da filial</label>
        <InputText id="branch-name" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} required placeholder="Ex.: Filial Londrina" />
        <label htmlFor="branch-departments">Departamentos responsáveis</label>
        <MultiSelect inputId="branch-departments" value={form.departamentos} options={departmentOptions} onChange={(event) => setForm({ ...form, departamentos: event.value })} filter display="chip" placeholder="Selecione os departamentos" />
        <label htmlFor="branch-centers">Contratos responsáveis</label>
        <MultiSelect inputId="branch-centers" value={form.centro_custo_ids} options={options.centros_custo} optionValue="id" optionLabel="local" onChange={(event) => setForm({ ...form, centro_custo_ids: event.value })} filter display="chip" placeholder="Selecione os contratos" itemTemplate={(center) => <span>{center.local} <small>· DPTO. {center.departamento ?? "—"}</small></span>} />
        <label htmlFor="branch-users">Usuários com acesso</label>
        <MultiSelect inputId="branch-users" value={form.usuario_ids} options={options.usuarios} optionValue="id" optionLabel="nome" onChange={(event) => setForm({ ...form, usuario_ids: event.value })} filter display="chip" placeholder="Selecione os usuários" />
        <div className="branch-active"><div><strong>Filial ativa</strong><small>Filiais inativas não liberam dados aos usuários.</small></div><InputSwitch checked={form.ativa} onChange={(event) => setForm({ ...form, ativa: event.value })} /></div>
        <div className="dialog-actions"><Button type="button" label="Cancelar" text onClick={() => setDialog(false)} /><Button type="submit" label="Salvar filial" icon="pi pi-check" /></div>
      </form>
    </Dialog>
  </div>;
}
