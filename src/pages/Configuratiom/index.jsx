// Index of Config

// Utils
import { useEffect, useRef, useState } from "react";
import connect from "../../utils/request";
import { getInitials, storeProfile } from "../../utils/profile";
import { useToast } from "../../contexts/ToastContext";
import { useLoading } from "../../contexts/LoadingContext";
import { socketio } from "../../utils/socketio";

// Widgets
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputOtp } from "primereact/inputotp";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import { Avatar } from "primereact/avatar";
import { TabPanel, TabView } from "primereact/tabview";
import { PageHeader } from "../../components/PageHeader";
import { UsersSettings } from "./UsersSettings";
import { BranchSettings } from "./BranchSettings";
import { CollaboratorImportSettings } from "./EmployeeImportSettings";
import { NewsSettings } from "./NewsSettings";

// Styles
import "./settings.css";

// Mantida igual à validação do backend para feedback imediato no formulário.
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

export function Settings() {
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  // Perfil, preferência visual e estados dos fluxos de senha/e-mail.
  const [profile, setProfile] = useState({ nome: "", email: "", foto_perfil: null, tema: "light" });
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailDialog, setEmailDialog] = useState(false);
  const [otp, setOtp] = useState("");
  const fileRef = useRef(null);
  const { showToast } = useToast();
  const setLoading = useLoading();

  // A API é a fonte de verdade; o storage apenas alimenta o MainLayout rapidamente.
  useEffect(() => {
    connect.get("/usuarios/perfil").then(({ data }) => {
      setProfile(data);
      setDark(data.tema === "dark");
      storeProfile(data);
    }).catch(() => { });
  }, []);

  // Ponto único para alterações de nome, foto e senha.
  const save = async (payload, message) => {
    setLoading(true);
    try {
      const { data } = await connect.patch("/usuarios/perfil", payload);
      if (data.access_token) {
        sessionStorage.setItem("token", data.access_token);
        socketio.auth = { token: data.access_token };
        socketio.disconnect().connect();
      }
      setProfile(data);
      storeProfile(data);
      showToast("success", "Configurações", message);
      return true;
    } catch (error) {
      showToast("error", "Não foi possível salvar", error.response?.data || "Tente novamente.");
      return false;
    } finally { setLoading(false); }
  };

  // O atributo no elemento raiz ativa os seletores globais sem recarregar a página.
  const applyTheme = (enabled) => {
    setDark(enabled);
    localStorage.setItem("theme", enabled ? "dark" : "light");
    document.documentElement.dataset.theme = enabled ? "dark" : "light";
  };

  const changeTheme = async (enabled) => {
    const previous = dark;
    applyTheme(enabled);
    if (!(await save({ tema: enabled ? "dark" : "light" }, "Tema atualizado."))) {
      applyTheme(previous);
    }
  };

  // Valida tipo/tamanho antes de converter a imagem para a representação persistida.
  const changePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type) || file.size > 1_500_000) {
      showToast("warn", "Foto inválida", "Use PNG, JPG ou WEBP de até 1,5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => save({ foto_perfil: reader.result }, "Foto atualizada.");
    reader.readAsDataURL(file);
  };

  const changePassword = async () => {
    if (!strongPassword.test(newPassword)) return showToast("warn", "Senha fraca", "Use 8 ou mais caracteres, maiúscula, minúscula, número e caractere especial.");
    if (newPassword !== confirmPassword) return showToast("warn", "Senhas diferentes", "A confirmação deve ser igual à nova senha.");
    if (await save({ senha_atual: currentPassword, nova_senha: newPassword }, "Senha atualizada.")) {
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    }
  };

  // Primeiro passo do e-mail: solicita o OTP para o novo endereço.
  const requestCode = async () => {
    setLoading(true);
    try {
      await connect.post("/usuarios/email/codigo", { email: newEmail });
      setOtp(""); setEmailDialog(true);
      showToast("success", "Código enviado", "Confira o novo endereço de e-mail.");
    } catch (error) { showToast("error", "E-mail", error.response?.data || "Não foi possível enviar o código."); }
    finally { setLoading(false); }
  };

  // Segundo passo: confirma o OTP e somente então atualiza o perfil local.
  const confirmEmail = async () => {
    setLoading(true);
    try {
      const { data } = await connect.post("/usuarios/email/confirmar", { codigo: otp });
      setProfile(data); storeProfile(data); setEmailDialog(false); setNewEmail("");
      showToast("success", "E-mail alterado", "Seu novo e-mail foi confirmado.");
    } catch (error) { showToast("error", "Código inválido", error.response?.data || "Confira o código."); }
    finally { setLoading(false); }
  };

  // Cards separam preferências visuais de operações sensíveis da conta.
  return <section className="settings-page">
    <PageHeader section="Sistema" title="Configurações" description="Personalize seu perfil, acesso e aparência do TM Hub." />
    <TabView className="settings-tabs">
      <TabPanel header="Minha conta" leftIcon="pi pi-user mr-2">
        <div className="settings-grid">
          <div className="settings-column">
            <article className="settings-card profile-card">
              <div className="settings-card-title"><i className="pi pi-user" /><div><h2>Perfil</h2><p>Como você aparece no TM Hub</p></div></div>
              <div className="photo-row">
                <Avatar image={profile.foto_perfil || undefined} label={!profile.foto_perfil ? getInitials(profile.nome) : undefined} shape="circle" className="settings-avatar" />
                <div><Button label="Trocar foto" icon="pi pi-camera" outlined onClick={() => fileRef.current?.click()} /><input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={changePhoto} /><small>PNG, JPG ou WEBP · máximo 1,5 MB</small></div>
              </div>
              <label>Nome de usuário</label><div className="settings-inline"><InputText value={profile.nome || ""} onChange={(e) => setProfile({ ...profile, nome: e.target.value })} /><Button label="Salvar" onClick={() => save({ nome: profile.nome }, "Nome atualizado.")} /></div>
            </article>

            <article className="settings-card">
              <div className="settings-card-title"><i className="pi pi-envelope" /><div><h2>E-mail</h2><p>Atual: {profile.email || "Não informado"}</p></div></div>
              <label>Novo e-mail</label><div className="settings-inline"><InputText autoComplete="off" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="voce@empresa.com" /><Button label="Verificar" icon="pi pi-send" onClick={requestCode} /></div>
            </article>
          </div>

          <div className="settings-column">
            <article className="settings-card">
              <div className="settings-card-title"><i className="pi pi-palette" /><div><h2>Aparência</h2><p>Escolha o tema da interface</p></div></div>
              <div className="theme-option"><div><strong>Modo escuro</strong><span>Preto como base e verde como destaque</span></div><InputSwitch checked={dark} onChange={(e) => changeTheme(e.value)} /></div>
            </article>

            <article className="settings-card password-card">
              <div className="settings-card-title"><i className="pi pi-lock" /><div><h2>Alterar senha</h2><p>Proteja sua conta com uma senha forte</p></div></div>
              <div className="password-fields"><Password value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} feedback={false} toggleMask placeholder="Senha atual" /><Password value={newPassword} onChange={(e) => setNewPassword(e.target.value)} toggleMask placeholder="Nova senha" promptLabel="Digite uma senha" weakLabel="Fraca" mediumLabel="Média" strongLabel="Forte" /><Password value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} feedback={false} toggleMask placeholder="Confirmar nova senha" /></div>
              <p className="password-hint"><i className="pi pi-info-circle" /> Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial.</p>
              <Button label="Atualizar senha" icon="pi pi-shield" onClick={changePassword} />
            </article>
          </div>
        </div>
      </TabPanel>

      {isAdmin && <TabPanel header="Usuários" leftIcon="pi pi-users mr-2">
        <UsersSettings />
      </TabPanel>}
      {isAdmin && <TabPanel header="Filiais" leftIcon="pi pi-building mr-2">
        <BranchSettings />
      </TabPanel>}
      {isAdmin && <TabPanel header="Importar colaboradores" leftIcon="pi pi-upload mr-2">
        <CollaboratorImportSettings />
      </TabPanel>}
      {isAdmin && <TabPanel header="Notícias" leftIcon="pi pi-megaphone mr-2">
        <NewsSettings />
      </TabPanel>}
    </TabView>

    <Dialog header="Confirme seu novo e-mail" visible={emailDialog} onHide={() => setEmailDialog(false)} className="otp-dialog" modal>
      <p>Digite o código de 6 dígitos enviado para <strong>{newEmail}</strong>.</p>
      <InputOtp value={otp} onChange={(e) => setOtp(e.value)} integerOnly length={6} />
      <div className="dialog-actions"><Button label="Cancelar" text onClick={() => setEmailDialog(false)} /><Button label="Confirmar e-mail" disabled={String(otp).length !== 6} onClick={confirmEmail} /></div>
    </Dialog>
  </section>;
}
