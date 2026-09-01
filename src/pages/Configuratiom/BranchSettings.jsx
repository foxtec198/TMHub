import { AppIcon } from "../../components/icons/AppIcon";
import { useEffect, useState } from "react";
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
import { SpeedDial } from "primereact/speeddial";
import { CostCenterMultiSelect } from "../../components/CostCenterDropdown";

const EMPTY_FORM = { nome: "", ativa: true, usuario_ids: [], centro_custo_ids: [], departamentos: [] };

export function BranchSettings() {
  const [branches, setBranches] = useState([]);
  const [options, setOptions] = useState({ usuarios: [], departamentos: [] });
  const [selectedCenterOptions, setSelectedCenterOptions] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const setLoading = useLoading();
  const { showToast } = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    setLoadError("");
    Promise.all([connect.get("/filiais", { skipStandardFilters: true }), connect.get("/filiais/opcoes", { skipStandardFilters: true })])
      .then(([branchResponse, optionsResponse]) => {
        setBranches(Array.isArray(branchResponse.data) ? branchResponse.data : []);
        setOptions({
          usuarios: Array.isArray(optionsResponse.data?.usuarios) ? optionsResponse.data.usuarios : [],
          departamentos: Array.isArray(optionsResponse.data?.departamentos) ? optionsResponse.data.departamentos : [],
        });
        setStatus("ready");
      })
      .catch((error) => {
        const message = error.response?.status === 403
          ? "Você não possui permissão para configurar filiais."
          : error.response?.data || "Não foi possível carregar filiais, departamentos e usuários.";
        setLoadError(message);
        setStatus("error");
        showToast("error", "Filiais", message);
      });
  }, [refresh, showToast]);

  const departmentOptions = options.departamentos.map((value) => ({ label: `DPTO. ${value}`, value }));
  const changeDepartments = (departments) => {
    const selectedDepartments = new Set((departments || []).map(Number));
    const remainingCenters = selectedCenterOptions.filter(
      (center) => !selectedDepartments.has(Number(center.departamento)),
    );
    setSelectedCenterOptions(remainingCenters);
    setForm((current) => ({
      ...current,
      departamentos: departments || [],
      centro_custo_ids: remainingCenters.map((center) => center.id),
    }));
  };
  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setSelectedCenterOptions([]); setDialog(true); };
  const openEdit = (branch) => {
    setEditingId(branch.id);
    setForm({ nome: branch.nome || "", ativa: branch.ativa !== false, usuario_ids: branch.usuario_ids || [], centro_custo_ids: branch.centro_custo_ids || [], departamentos: branch.departamentos || [] });
    setSelectedCenterOptions(branch.centros_custo || []);
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
    { header: "Contratos no escopo", body: (branch) => branch.centros_custo_total ?? branch.centro_custo_ids?.length ?? 0 },
    { header: "Adicionais", body: (branch) => branch.centro_custo_ids?.length || 0 },
    { header: "Departamentos", class: 'text-truncate', body: (branch) => branch.departamentos?.join(", ") || "—" },
    { header: "Ações", body: (branch) => <Button icon={<AppIcon name="pencil" />} rounded text aria-label={`Editar ${branch.nome}`} onClick={() => openEdit(branch)} /> },
  ];

  return <div>
    {/* Article da TABELA de filiais  */}
    <article className="settings-card branch-table-card">
      <div className="settings-card-title"><AppIcon name="building"  /><div><h2>Filiais</h2><p>Combine departamentos completos com contratos específicos</p></div></div>
      {status === "loading" && <div className="settings-feedback"><AppIcon name="loader-2"  /> Carregando filiais e vínculos...</div>}
      {status === "error" && <div className="settings-feedback is-error"><AppIcon name="alert-triangle"  /><span>{loadError}</span><Button label="Tentar novamente" text onClick={() => setRefresh((value) => value + 1)} /></div>}
      {status === "ready" && branches.length > 0 && <Table data={branches} columns={columns} search rows={5} rowsPerPageOptions={[5, 10, 25]} />}
      {status === "ready" && branches.length === 0 && <div className="settings-feedback">Nenhuma filial cadastrada.</div>}
    </article>


    {/* Button para criar filias */}
    <div className="users-speed-dial"><SpeedDial onClick={openCreate} direction="up" showIcon={<AppIcon name="plus" />} /></div>

    {/* Dialog de criação de filiais */}
    <Dialog header={editingId ? "Editar filial" : "Nova filial"} visible={dialog} modal className="branch-dialog" onHide={() => setDialog(false)}>
      <form className="branch-form" onSubmit={save}>
        <label htmlFor="branch-name">Nome da filial</label>
        <InputText id="branch-name" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} required placeholder="Ex.: Filial Londrina" />
        <label htmlFor="branch-departments">Departamentos responsáveis</label>
        <MultiSelect inputId="branch-departments" value={form.departamentos} options={departmentOptions} onChange={(event) => changeDepartments(event.value)} filter display="chip" placeholder="Selecione os departamentos" />
        <label htmlFor="branch-centers">Contratos adicionais</label>
        <CostCenterMultiSelect inputId="branch-centers" value={form.centro_custo_ids} selectedOptions={selectedCenterOptions} excludeDepartments={form.departamentos} skipStandardFilters onChange={(value, centers) => { setForm({ ...form, centro_custo_ids: value }); setSelectedCenterOptions(centers); }} placeholder="Busque contratos de outros departamentos" />
        <small>Os contratos dos departamentos selecionados já estão incluídos e não são repetidos aqui. Este campo mostra apenas contratos adicionais de outros departamentos.</small>
        <label htmlFor="branch-users">Usuários com acesso</label>
        <MultiSelect inputId="branch-users" value={form.usuario_ids} options={options.usuarios} optionValue="id" optionLabel="nome" onChange={(event) => setForm({ ...form, usuario_ids: event.value })} filter display="chip" placeholder="Selecione os usuários" />
        <div className="branch-active"><div><strong>Filial ativa</strong><small>Filiais inativas não liberam dados aos usuários.</small></div><InputSwitch checked={form.ativa} onChange={(event) => setForm({ ...form, ativa: event.value })} /></div>
        <div className="dialog-actions"><Button type="button" label="Cancelar" text onClick={() => setDialog(false)} /><Button type="submit" label="Salvar filial" icon={<AppIcon name="check" />} /></div>
      </form>
    </Dialog>
  </div>;
}
