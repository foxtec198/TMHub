import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import { FloatLabel } from "primereact/floatlabel";
import { SpeedDial } from "primereact/speeddial";
import { Tag } from "primereact/tag";
import { MultiSelect } from "primereact/multiselect";
import { InputSwitch } from "primereact/inputswitch";
import { Checkbox } from "primereact/checkbox";
import { Table } from "../../components/tables/Table";
import connect from "../../utils/request";
import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";

const EMPTY_FORM = { nome: "", cpf: "", email: "", role: "USER", password: "", filial_ids: [], gerencia_faltas: false, permissions: [] };
const ROLE_OPTIONS = [
  { label: "Supervisor", value: "SUPERVISOR" },
  { label: "Gerente", value: "GERENTE" },
  { label: "Usuário", value: "USER" },
  { label: "Administrador", value: "ADMIN" },
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

export function UsersSettings() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [permissionCatalog, setPermissionCatalog] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [userDialog, setUserDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [spreadsheet, setSpreadsheet] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canManage = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data } = await connect.get("/usuarios", { params: { detail: 1 } });
        setUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        showToast("error", "Usuários", error.response?.data || "Não foi possível listar os usuários.");
      }
    }
    loadUsers();
    if (canManage) {
      connect.get("/filiais").then(({ data }) => setBranches((Array.isArray(data) ? data : []).filter((branch) => branch.ativa))).catch(() => {});
      connect.get("/usuarios/permissoes/catalogo").then(({ data }) => setPermissionCatalog(Array.isArray(data) ? data : [])).catch(() => {});
    }
  }, [canManage, refresh, showToast]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setUserDialog(true);
  };

  const openEdit = (user) => {
    setEditingId(user.id);
    setForm({ nome: user.nome || "", cpf: user.cpf || "", email: user.email || "", role: user.role || "USER", password: "", filial_ids: user.filial_ids || [], gerencia_faltas: Boolean(user.gerencia_faltas), permissions: user.permissions || [] });
    setUserDialog(true);
  };

  const saveUser = async (event) => {
    event.preventDefault();
    const payload = { ...form };
    if (editingId && !payload.password) delete payload.password;

    setLoading(true);
    try {
      if (editingId) await connect.patch("/usuarios", { id: editingId, ...payload });
      else await connect.post("/usuarios", payload);
      showToast("success", "Usuários", editingId ? "Usuário atualizado." : "Usuário criado.");
      setUserDialog(false);
      setRefresh((current) => current + 1);
    } catch (error) {
      showToast("error", "Não foi possível salvar", error.response?.data || "Confira os dados informados.");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const { data } = await connect.get("/usuarios/modelo-importacao", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "modelo_importacao_usuarios.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast("error", "Modelo da planilha", error.response?.data || "Não foi possível baixar o modelo.");
    }
  };

  const importUsers = async (event) => {
    event.preventDefault();
    if (!spreadsheet) return showToast("warn", "Planilha", "Selecione um arquivo .xlsx.");
    if (spreadsheet.size > 10 * 1024 * 1024) return showToast("warn", "Planilha", "O arquivo deve ter no máximo 10 MB.");

    const data = new FormData();
    data.append("file", spreadsheet);
    setImporting(true);
    try {
      const response = await connect.post("/usuarios/importar", data, { timeout: 120000 });
      showToast("success", "Importação concluída", response.data?.message || "Usuários importados.");
      setBulkDialog(false);
      setSpreadsheet(null);
      if (fileInput.current) fileInput.current.value = "";
      setRefresh((current) => current + 1);
    } catch (error) {
      const response = error.response?.data;
      const details = Array.isArray(response?.errors) ? response.errors.slice(0, 3).join(" ") : null;
      const message = typeof response === "string" ? response : response?.message;
      showToast("error", "Falha na importação", details || message || (error.code === "ECONNABORTED" ? "A importação excedeu o tempo limite." : "Confira a planilha."));
    } finally {
      setImporting(false);
    }
  };

  const speedDialItems = useMemo(() => [
    { label: "Criar um usuário", icon: "pi pi-user-plus", command: openCreate },
    { label: "Importar planilha", icon: "pi pi-file-excel", command: () => setBulkDialog(true) },
  ], []);

  const permissionValue = (screen, action) => Boolean(form.permissions.find((item) => item.screen === screen)?.[action]);

  const setPermission = (screen, action, checked) => {
    const current = form.permissions.find((item) => item.screen === screen) || { screen, view: false, create: false, edit: false };
    const updated = { ...current, [action]: checked };
    if ((action === "create" || action === "edit") && checked) updated.view = true;
    if (action === "view" && !checked) {
      updated.create = false;
      updated.edit = false;
    }
    setForm({
      ...form,
      permissions: [...form.permissions.filter((item) => item.screen !== screen), updated],
    });
  };

  const columns = [
    { header: "Nome", field: "nome", sortable: true },
    { header: "E-mail", field: "email", body: (user) => user.email || "—" },
    { header: "CPF", field: "cpf", body: (user) => user.cpf || "Restrito" },
    { header: "Perfil", field: "role", body: (user) => <Tag value={user.role || "USER"} severity={user.role === "ADMIN" ? "success" : "secondary"} /> },
    { header: "Filiais", body: (user) => user.filial_ids?.length || 0 },
    { header: "Telas", body: (user) => user.permissions?.filter((permission) => permission.view).length || 0 },
    { header: "Controle de faltas", body: (user) => <Tag value={user.gerencia_faltas ? "RESPONSÁVEL" : "SEM ACESSO"} severity={user.gerencia_faltas ? "success" : "secondary"} /> },
    { header: "Último acesso", field: "last_login", body: (user) => formatDate(user.last_login) },
    ...(canManage ? [{
      header: "Ações",
      body: (user) => <Button icon="pi pi-pencil" rounded text aria-label={`Editar ${user.nome}`} onClick={() => openEdit(user)} />,
    }] : []),
  ];

  return <div className="users-settings-layout">
    <article className="settings-card users-table-card">
      <div className="settings-card-title"><i className="pi pi-users" /><div><h2>Usuários cadastrados</h2><p>Contas com acesso ao TM Hub</p></div></div>
      <Table data={users} columns={columns} search rows={5} rowsPerPageOptions={[3, 5, 10, 50, 100]} />
    </article>

    <aside className="settings-card users-actions-card">
      <div className="settings-card-title"><i className="pi pi-user-plus" /><div><h2>Gerenciar acessos</h2><p>{canManage ? "Crie uma conta ou importe a planilha padrão" : "Somente administradores podem alterar contas"}</p></div></div>
      {canManage ? <>
        <p>Use o botão abaixo para escolher entre cadastro individual e importação em massa.</p>
        <div className="users-speed-dial"><SpeedDial model={speedDialItems} direction="up" showIcon="pi pi-plus" hideIcon="pi pi-times" /></div>
      </> : <div className="users-readonly"><i className="pi pi-lock" /><span>Você possui acesso somente à listagem.</span></div>}
    </aside>

    <Dialog header={editingId ? "Editar usuário" : "Criar usuário"} visible={userDialog} modal className="user-dialog" onHide={() => setUserDialog(false)}>
      <form className="user-form flex flex-column gap-4 mt-4" onSubmit={saveUser}>
        <FloatLabel><InputText id="user-name" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} required /><label htmlFor="user-name">Nome</label></FloatLabel>
        <FloatLabel><InputText id="user-cpf" value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} maxLength={14} /><label htmlFor="user-cpf">CPF (opcional)</label></FloatLabel>
        <FloatLabel><InputText id="user-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><label htmlFor="user-email">E-mail</label></FloatLabel>
        <FloatLabel><Dropdown inputId="user-role" value={form.role} options={ROLE_OPTIONS} onChange={(event) => setForm({ ...form, role: event.value })} /><label htmlFor="user-role">Perfil</label></FloatLabel>
        <FloatLabel><MultiSelect inputId="user-branches" value={form.filial_ids} options={branches} optionValue="id" optionLabel="nome" onChange={(event) => setForm({ ...form, filial_ids: event.value })} display="chip" filter /><label htmlFor="user-branches">Filiais com acesso</label></FloatLabel>
        <div className="theme-option"><div><strong>Responsável pelo Controle de Faltas</strong><span>Permite analisar e concluir tratativas de faltas nas filiais vinculadas.</span></div><InputSwitch checked={form.gerencia_faltas} onChange={(event) => setForm({ ...form, gerencia_faltas: event.value })} /></div>
        <section className="permission-editor">
          <header><div><strong>Telas e permissões</strong><span>Criação ou alteração habilitam automaticamente a visualização.</span></div></header>
          <div className="permission-table">
            <div className="permission-row permission-head"><span>Tela</span><span>Ver</span><span>Criar</span><span>Alterar</span></div>
            {permissionCatalog.map((item) => <div className="permission-row" key={item.key}>
              <span><small>{item.group}</small><strong>{item.label}</strong></span>
              {["view", "create", "edit"].map((action) => <span key={action}>
                {item.actions.includes(action) ? <Checkbox
                  inputId={`${item.key}-${action}`}
                  checked={form.role === "ADMIN" || permissionValue(item.key, action)}
                  disabled={form.role === "ADMIN"}
                  onChange={(event) => setPermission(item.key, action, event.checked)}
                /> : <i className="pi pi-minus permission-unavailable" />}
              </span>)}
            </div>)}
          </div>
          {form.role === "ADMIN" && <small className="permission-admin-note"><i className="pi pi-shield" /> Administradores possuem acesso total.</small>}
        </section>
        <FloatLabel><Password inputId="user-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} toggleMask feedback={!editingId} required={!editingId} /><label htmlFor="user-password">{editingId ? "Nova senha (opcional)" : "Senha"}</label></FloatLabel>
        <div className="dialog-actions"><Button type="button" label="Cancelar" text onClick={() => setUserDialog(false)} /><Button type="submit" label={editingId ? "Salvar alterações" : "Criar usuário"} icon="pi pi-check" /></div>
      </form>
    </Dialog>

    <Dialog header="Importar usuários" visible={bulkDialog} modal className="user-dialog" closable={!importing} closeOnEscape={!importing} onHide={() => !importing && setBulkDialog(false)}>
      <form className="bulk-user-form" onSubmit={importUsers}>
        <p>A importação é transacional: se alguma linha estiver inválida, nenhum usuário será criado.</p>
        <Button type="button" label="Baixar planilha modelo" icon="pi pi-download" outlined onClick={downloadTemplate} disabled={importing} />
        <input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={importing} onChange={(event) => setSpreadsheet(event.target.files?.[0] || null)} />
        {spreadsheet ? <small>Arquivo selecionado: {spreadsheet.name}</small> : null}
        <div className="dialog-actions"><Button type="button" label="Cancelar" text disabled={importing} onClick={() => setBulkDialog(false)} /><Button type="submit" label={importing ? "Importando..." : "Importar usuários"} icon="pi pi-upload" loading={importing} disabled={!spreadsheet || importing} /></div>
      </form>
    </Dialog>
  </div>;
}
