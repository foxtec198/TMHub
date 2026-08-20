import { useEffect, useRef, useState } from "react";
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
  const [usersStatus, setUsersStatus] = useState("loading");
  const [usersError, setUsersError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [userDialog, setUserDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [signatureDialog, setSignatureDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [spreadsheet, setSpreadsheet] = useState(null);
  const [signatureUserId, setSignatureUserId] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState("");
  const [signatureCrop, setSignatureCrop] = useState(null);
  const [importing, setImporting] = useState(false);
  const [registeringSignature, setRegisteringSignature] = useState(false);
  const fileInput = useRef(null);
  const signatureFileInput = useRef(null);
  const signatureCropStart = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();
  const canManage = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";

  useEffect(() => {
    async function loadUsers() {
      setUsersStatus("loading");
      setUsersError("");
      try {
        const { data } = await connect.get("/usuarios", { params: { detail: 1 } });
        setUsers(Array.isArray(data) ? data : []);
        setUsersStatus("ready");
      } catch (error) {
        const message = error.response?.status === 403 ? "Você não possui permissão para listar usuários." : error.response?.data || "Não foi possível listar os usuários.";
        setUsersError(message);
        setUsersStatus("error");
        showToast("error", "Usuários", message);
      }
    }
    loadUsers();
    if (canManage) {
      connect.get("/filiais").then(({ data }) => setBranches((Array.isArray(data) ? data : []).filter((branch) => branch.ativa))).catch((error) => showToast("error", "Filiais", error.response?.data || "Não foi possível carregar as filiais dos usuários."));
      connect.get("/usuarios/permissoes/catalogo").then(({ data }) => setPermissionCatalog(Array.isArray(data) ? data : [])).catch((error) => showToast("error", "Permissões", error.response?.data || "Não foi possível carregar o catálogo de permissões."));
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

  const openSignatureRegistration = () => {
    setSignatureUserId(null);
    setSignatureFile(null);
    if (signaturePreview) URL.revokeObjectURL(signaturePreview);
    setSignaturePreview("");
    setSignatureCrop(null);
    if (signatureFileInput.current) signatureFileInput.current.value = "";
    setSignatureDialog(true);
  };

  const selectSignatureFile = (file) => {
    if (signaturePreview) URL.revokeObjectURL(signaturePreview);
    setSignatureFile(file || null);
    setSignatureCrop(null);
    setSignaturePreview(file?.type?.startsWith("image/") ? URL.createObjectURL(file) : "");
  };

  const cropPoint = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const startSignatureCrop = (event) => {
    const point = cropPoint(event);
    signatureCropStart.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSignatureCrop({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const updateSignatureCrop = (event) => {
    if (!signatureCropStart.current) return;
    const point = cropPoint(event);
    const start = signatureCropStart.current;
    setSignatureCrop({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  };

  const finishSignatureCrop = (event) => {
    if (!signatureCropStart.current) return;
    signatureCropStart.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
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

  const registerSignature = async (event) => {
    event.preventDefault();
    if (!signatureUserId) return showToast("warn", "Assinatura", "Selecione o usuário titular da assinatura.");
    if (!signatureFile) return showToast("warn", "Assinatura", "Selecione um arquivo de assinatura.");
    if (signatureFile.size > 5 * 1024 * 1024) return showToast("warn", "Assinatura", "O arquivo deve ter no máximo 5 MB.");

    const data = new FormData();
    data.append("arquivo", signatureFile);
    if (signaturePreview && (!signatureCrop || signatureCrop.width < .03 || signatureCrop.height < .03)) {
      return showToast("warn", "Assinatura", "Arraste uma área que contenha somente a assinatura.");
    }
    if (signatureCrop) data.append("recorte", JSON.stringify(signatureCrop));
    setRegisteringSignature(true);
    try {
      const { data: response } = await connect.post(`/usuarios/${signatureUserId}/assinatura-cadastrada`, data, { timeout: 120000 });
      showToast("success", "Assinatura", response?.message || "Assinatura cadastrada com sucesso.");
      setSignatureDialog(false);
      setSignatureFile(null);
      if (signatureFileInput.current) signatureFileInput.current.value = "";
      setRefresh((current) => current + 1);
    } catch (error) {
      showToast("error", "Assinatura", error.response?.data || "Não foi possível cadastrar a assinatura.");
    } finally {
      setRegisteringSignature(false);
    }
  };

  const speedDialItems = [
    { label: "Criar uma conta", icon: "pi pi-user-plus", command: openCreate },
    { label: "Vincular assinatura", icon: "pi pi-pencil", command: openSignatureRegistration },
    { label: "Importar arquivo XLSX", icon: "pi pi-file-excel", command: () => setBulkDialog(true) },
  ];

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
    { header: "Último acesso", field: "last_login", body: (user) => formatDate(user.last_login) },
    { header: "Perfil", field: "role", body: (user) => <Tag value={user.role || "USER"} severity={user.role === "ADMIN" ? "success" : "secondary"} /> },
    { header: "Assinatura", body: (user) => <Tag value={user.assinatura_cadastrada ? "CADASTRADA" : "NÃO CADASTRADA"} severity={user.assinatura_cadastrada ? "success" : "secondary"} /> },
    { header: "Filiais", body: (user) => user.filial_ids?.length || 0 },
    { header: "Telas", body: (user) => user.permissions?.filter((permission) => permission.view).length || 0 },
    ...(canManage ? [{
      header: "Ações",
      body: (user) => <Button icon="pi pi-pencil" rounded text aria-label={`Editar ${user.nome}`} onClick={() => openEdit(user)} />,
    }] : []),
  ];

  return <div>
    <article className="settings-card users-table-card">
      <div className="settings-card-title"><i className="pi pi-users" /><div><h2>Usuários cadastrados</h2><p>Contas com acesso ao TM Hub</p></div></div>
      {usersStatus === "loading" && <div className="settings-feedback"><i className="pi pi-spin pi-spinner" /> Carregando usuários...</div>}
      {usersStatus === "error" && <div className="settings-feedback is-error"><i className="pi pi-exclamation-triangle" /><span>{usersError}</span><Button label="Tentar novamente" text onClick={() => setRefresh((value) => value + 1)} /></div>}
      {usersStatus === "ready" && users.length > 0 && <Table data={users} columns={columns} search rows={5} rowsPerPageOptions={[3, 5, 10, 50, 100]} />}
      {usersStatus === "ready" && users.length === 0 && <div className="settings-feedback">Nenhum usuário cadastrado.</div>}
    </article>

    <div className="users-speed-dial">
      <SpeedDial model={speedDialItems} direction="up" showIcon="pi pi-plus" hideIcon="pi pi-times" aria-label="Ações de usuários" />
    </div>

    <Dialog header={editingId ? "Editar usuário" : "Criar usuário"} visible={userDialog} modal className="user-dialog" onHide={() => setUserDialog(false)}>
      <form className="user-form flex flex-column gap-4 mt-4" onSubmit={saveUser}>
        <FloatLabel><InputText id="user-name" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} required /><label htmlFor="user-name">Nome</label></FloatLabel>

        <div className="flex flex-wrap gap-3 mt-3">
          <FloatLabel className="flex-grow-1" style={{ flexBasis: '100px' }}><InputText id="user-cpf" value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} maxLength={14} /><label htmlFor="user-cpf">CPF (opcional)</label></FloatLabel>
          <FloatLabel className="flex-grow-1" style={{ flexBasis: '100px' }}><InputText id="user-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><label htmlFor="user-email">E-mail</label></FloatLabel>
        </div>

        <div className="flex flex-wrap gap-3 mt-3">
          <FloatLabel className="flex-grow-1" style={{ flexBasis: '100px' }}><Dropdown inputId="user-role" value={form.role} options={ROLE_OPTIONS} onChange={(event) => setForm({ ...form, role: event.value })} /><label htmlFor="user-role">Perfil</label></FloatLabel>
          <FloatLabel className="flex-grow-1" style={{ flexBasis: '100px' }}><MultiSelect inputId="user-branches0" className="w-full" value={form.filial_ids} options={branches} optionValue="id" optionLabel="nome" onChange={(event) => setForm({ ...form, filial_ids: event.value })} display="chip" filter /><label htmlFor="user-branches">Filiais com acesso</label></FloatLabel>
        </div>

        <FloatLabel className="mt-3"><Password autoComplete="off" aria-autocomplete="off" inputId="user-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} toggleMask feedback={!editingId} required={!editingId} /><label htmlFor="user-password">{editingId ? "Nova senha (opcional)" : "Senha"}</label></FloatLabel>


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

    <Dialog header="Cadastrar assinatura" visible={signatureDialog} modal className="user-dialog" closable={!registeringSignature} closeOnEscape={!registeringSignature} onHide={() => !registeringSignature && setSignatureDialog(false)}>
      <form className="registered-signature-form" onSubmit={registerSignature}>
        <p>A assinatura será tratada e salva em PNG transparente para uso nos documentos do sistema.</p>
        <label htmlFor="signature-user">Usuário titular</label>
        <Dropdown
          inputId="signature-user"
          value={signatureUserId}
          options={users}
          optionLabel="nome"
          optionValue="id"
          filter
          placeholder="Selecione o usuário"
          disabled={registeringSignature}
          onChange={(event) => setSignatureUserId(event.value)}
        />
        <label htmlFor="signature-file">Arquivo da assinatura</label>
        <input
          ref={signatureFileInput}
          id="signature-file"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf"
          disabled={registeringSignature}
          onChange={(event) => selectSignatureFile(event.target.files?.[0] || null)}
        />
        <small>PNG, JPG, JPEG, WEBP ou PDF · máximo de 5 MB. Em PDF, será utilizada a primeira página.</small>
        {signatureFile && <small className="registered-signature-file">Arquivo selecionado: {signatureFile.name}</small>}
        {signaturePreview && <div className="registered-signature-crop">
          <strong>Recorte a assinatura</strong>
          <small>Arraste sobre o traço, sem incluir as bordas do papel ou o fundo da foto.</small>
          <div
            className="registered-signature-crop__canvas"
            onPointerDown={startSignatureCrop}
            onPointerMove={updateSignatureCrop}
            onPointerUp={finishSignatureCrop}
            onPointerCancel={finishSignatureCrop}
          >
            <img src={signaturePreview} alt="Prévia do arquivo de assinatura" draggable="false" />
            {signatureCrop && <span className="registered-signature-crop__selection" style={{ left: `${signatureCrop.x * 100}%`, top: `${signatureCrop.y * 100}%`, width: `${signatureCrop.width * 100}%`, height: `${signatureCrop.height * 100}%` }} />}
          </div>
        </div>}
        <div className="dialog-actions"><Button type="button" label="Cancelar" text disabled={registeringSignature} onClick={() => setSignatureDialog(false)} /><Button type="submit" label="Cadastrar assinatura" icon="pi pi-check" loading={registeringSignature} disabled={!signatureUserId || !signatureFile || registeringSignature} /></div>
      </form>
    </Dialog>
  </div>;
}
