import { AppIcon } from "../../components/icons/AppIcon";
// Index of Config

// Utils
import { useEffect, useMemo, useRef, useState } from "react";
import connect from "../../utils/request";
import { storeProfile } from "../../utils/profile";
import { useToast } from "../../contexts/ToastContext";
import { useLoading } from "../../contexts/LoadingContext";
import { socketio } from "../../utils/socketio";
import { setAccessToken } from "../../utils/authSession";
import { useTheme } from "../../theme/useTheme";
import { getAvailableThemeOptions, MODE_OPTIONS } from "../../theme/themes";

// Widgets
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputOtp } from "primereact/inputotp";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import { Checkbox } from "primereact/checkbox";
import { TabPanel, TabView } from "primereact/tabview";
import { PageHeader } from "../../components/PageHeader";
import { UserAvatar } from "../../components/UserAvatar";
import { UsersSettings } from "./UsersSettings";
import { BranchSettings } from "./BranchSettings";
import { CapacityDepartmentSettings } from "./CapacityDepartmentSettings";
import { NewsSettings } from "./NewsSettings";
import { TMOpsAccessSettings } from "./TMOpsAccessSettings";
import { TimoSettings } from "./TimoSettings";
import { UsageControlSettings } from "./UsageControlSettings";

// Styles
import "./settings.css";

// Mantida igual à validação do backend para feedback imediato no formulário.
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

const ADORNMENT_NAMES = {
  adorno_halloween: "Halloween",
  adorno_natal: "Natal",
  adorno_gptw: "Great Place to Work",
  adorno_aniversario: "Aniversário",
  adorno_orgulho: "Orgulho",
  adorno_conquista: "Conquista",
};

export function Settings() {
  const isAdmin = String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  // Perfil, preferência visual e estados dos fluxos de senha/e-mail.
  const [profile, setProfile] = useState({ nome: "", email: "", foto_perfil: null, tema: "tmhub", modo_tema: "light", timo_tela_inicial: false, timo_cenario: "workshop" });
  const { theme, mode, particlesEnabled, setTheme, setMode, setParticlesEnabled } = useTheme();
  const availableThemes = useMemo(
    () => getAvailableThemeOptions(profile.temas_disponiveis),
    [profile.temas_disponiveis],
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailDialog, setEmailDialog] = useState(false);
  const [otp, setOtp] = useState("");
  const [ownedAdornments, setOwnedAdornments] = useState([]);
  const [adornmentsLoading, setAdornmentsLoading] = useState(true);
  const [adornmentSaving, setAdornmentSaving] = useState(null);
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const fileRef = useRef(null);
  const { showToast } = useToast();
  const setLoading = useLoading();

  // A API é a fonte de verdade; o storage apenas alimenta o MainLayout rapidamente.
  useEffect(() => {
    connect.get("/usuarios/perfil").then(({ data }) => {
      setProfile(data);
      storeProfile(data);
    }).catch((error) => showToast(
      "error",
      error.response?.status === 403 ? "Sem permissão" : "Configurações",
      error.response?.data || "Não foi possível carregar seu perfil.",
    ));

    connect.get("/marketplace/adornos").then(({ data }) => {
      setOwnedAdornments(data?.adornos || []);
    }).catch((error) => showToast(
      "error",
      "Adornos",
      error.response?.data || "Não foi possível carregar seus adornos.",
    )).finally(() => setAdornmentsLoading(false));
  }, [showToast]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    connect.get("/usuarios/manutencao")
      .then(({ data }) => {
        if (active) setMaintenanceActive(Boolean(data?.manutencao_ativa));
      })
      .catch(() => {
        if (active) showToast("error", "Manutenção", "Não foi possível carregar o estado da operação.");
      });
    return () => { active = false; };
  }, [isAdmin, showToast]);

  // Ponto único para alterações de nome, foto e senha.
  const save = async (payload, message) => {
    setLoading(true);
    try {
      const { data } = await connect.patch("/usuarios/perfil", payload);
      if (data.access_token) {
        setAccessToken(data.access_token);
        // eslint-disable-next-line react-hooks/immutability -- Socket.IO requires updating auth before reconnecting.
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

  const changeTheme = async (nextTheme) => {
    if (nextTheme === theme) return;
    const previous = theme;
    setTheme(nextTheme);
    if (!(await save({ tema: nextTheme }, "Tema atualizado."))) {
      setTheme(previous);
    }
  };

  const changeMode = async (nextMode) => {
    if (nextMode === mode) return;
    const previous = mode;
    setMode(nextMode);
    if (!(await save({ modo_tema: nextMode }, "Modo de exibição atualizado."))) {
      setMode(previous);
    }
  };

  const changeParticles = async (enabled) => {
    const previous = particlesEnabled;
    setParticlesEnabled(enabled);
    if (!(await save({ particulas_ativas: enabled }, enabled ? "Partículas ativadas." : "Partículas desativadas."))) {
      setParticlesEnabled(previous);
    }
  };

  const changeTimoHome = async (enabled) => {
    const previous = Boolean(profile.timo_tela_inicial);
    const nextProfile = { ...profile, timo_tela_inicial: enabled };
    setProfile(nextProfile);
    storeProfile(nextProfile);
    if (!(await save({ timo_tela_inicial: enabled }, enabled ? "O Timo será sua tela inicial." : "A tela inicial padrão foi restaurada."))) {
      const restoredProfile = { ...profile, timo_tela_inicial: previous };
      setProfile(restoredProfile);
      storeProfile(restoredProfile);
    }
  };

  const changeMaintenance = async (active) => {
    setMaintenanceSaving(true);
    try {
      const { data } = await connect.patch("/usuarios/manutencao", { manutencao_ativa: active });
      setMaintenanceActive(Boolean(data?.manutencao_ativa));
      showToast(
        "success",
        "Manutenção",
        active ? "Operação bloqueada para usuários não administradores." : "Operação liberada.",
      );
    } catch (error) {
      showToast("error", "Manutenção", error.response?.data || "Não foi possível alterar a operação.");
    } finally {
      setMaintenanceSaving(false);
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

  const removeAdornment = async () => {
    if (!profile.adorno_foto) return;
    setAdornmentSaving("remove");
    try {
      await connect.patch("/marketplace/equipar", { categoria: "adorno", produto_id: null });
      const nextProfile = { ...profile, adorno_foto: null };
      setProfile(nextProfile);
      setOwnedAdornments((current) => current.map((item) => ({ ...item, equipado: false })));
      storeProfile(nextProfile);
      showToast("success", "Adorno removido", "Sua foto voltou ao formato padrão.");
    } catch (error) {
      showToast("error", "Adorno", error.response?.data || "Não foi possível remover o adorno.");
    } finally {
      setAdornmentSaving(null);
    }
  };

  const equipAdornment = async (adornment) => {
    if (adornment.equipado) return;
    setAdornmentSaving(adornment.id);
    try {
      await connect.patch("/marketplace/equipar", { categoria: "adorno", produto_id: adornment.id });
      const nextProfile = { ...profile, adorno_foto: adornment.codigo };
      setProfile(nextProfile);
      setOwnedAdornments((current) => current.map((item) => ({
        ...item,
        equipado: item.id === adornment.id,
      })));
      storeProfile(nextProfile);
      showToast("success", "Adorno equipado", `${adornment.nome} está em uso.`);
    } catch (error) {
      showToast("error", "Adorno", error.response?.data || "Não foi possível equipar o adorno.");
    } finally {
      setAdornmentSaving(null);
    }
  };

  // Cards separam preferências visuais de operações sensíveis da conta.
  return <section className="settings-page">
    <PageHeader section="Sistema" title="Configurações" description="Personalize seu perfil, acesso e aparência do TM Hub." />
    <TabView>
      <TabPanel header="Minha conta" leftIcon={<AppIcon name="user" className="mr-2" />}>
        <div className="settings-grid">
          <div className="settings-column">
            <article className="settings-card profile-card">
              <div className="settings-card-title"><AppIcon name="user"  /><div><h2>Perfil</h2><p>Como você aparece no TM Hub</p></div></div>
              <div className="photo-row">
                <UserAvatar user={profile} className="settings-avatar" />
                <div><Button label="Trocar foto" icon={<AppIcon name="camera" />} outlined onClick={() => fileRef.current?.click()} /><input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={changePhoto} /><small>PNG, JPG ou WEBP · máximo 1,5 MB</small></div>
              </div>
              <label>Nome de usuário</label><div className="settings-inline"><InputText value={profile.nome || ""} onChange={(e) => setProfile({ ...profile, nome: e.target.value })} /><Button label="Salvar" onClick={() => save({ nome: profile.nome }, "Nome atualizado.")} /></div>
            </article>

            <article className="settings-card">
              <div className="settings-card-title"><AppIcon name="mail"  /><div><h2>E-mail</h2><p>Atual: {profile.email || "Não informado"}</p></div></div>
              <label>Novo e-mail</label><div className="settings-inline"><InputText autoComplete="off" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="voce@empresa.com" /><Button label="Verificar" icon={<AppIcon name="send" />} onClick={requestCode} /></div>
            </article>

            <article className="settings-card">
              <div className="settings-card-title"><AppIcon name="sparkles" /><div><h2>Adorno</h2><p>Personalização exibida ao redor da sua foto.</p></div></div>
              <div className="adornment-profile-row">
                <UserAvatar user={profile} className="adornment-profile-preview" />
                <div className="adornment-profile-copy">
                  <span>Adorno atual</span>
                  <strong>{ADORNMENT_NAMES[profile.adorno_foto] || (profile.adorno_foto ? "Adorno personalizado" : "Nenhum adorno equipado")}</strong>
                  <small>{profile.adorno_foto ? "Você pode removê-lo sem perder o item adquirido." : "Equipe um adorno pela Loja de Edinhos."}</small>
                </div>
                {profile.adorno_foto && (
                  <Button
                    label="Remover"
                    icon={<AppIcon name="x" />}
                    severity="danger"
                    outlined
                    loading={adornmentSaving === "remove"}
                    disabled={adornmentSaving !== null}
                    onClick={removeAdornment}
                  />
                )}
              </div>
              <div className="adornment-profile-collection">
                <div className="adornment-profile-collection__title">
                  <strong>Seus adornos</strong>
                  <small>Escolha qualquer item que você já adquiriu.</small>
                </div>
                {adornmentsLoading ? (
                  <small className="adornment-profile-empty">Carregando sua coleção…</small>
                ) : ownedAdornments.length ? (
                  <div className="adornment-profile-grid">
                    {ownedAdornments.map((adornment) => (
                      <article className={adornment.equipado ? "is-equipped" : ""} key={adornment.id}>
                        <UserAvatar user={profile} adorno_foto={adornment.codigo} className="adornment-profile-item-preview" />
                        <div><strong>{adornment.nome}</strong><small>{adornment.equipado ? "Equipado agora" : "Disponível na coleção"}</small></div>
                        <Button
                          label={adornment.equipado ? "Equipado" : "Equipar"}
                          icon={<AppIcon name="check" />}
                          outlined={!adornment.equipado}
                          disabled={adornment.equipado || adornmentSaving !== null}
                          loading={adornmentSaving === adornment.id}
                          onClick={() => equipAdornment(adornment)}
                        />
                      </article>
                    ))}
                  </div>
                ) : (
                  <small className="adornment-profile-empty">Você ainda não possui adornos. Os itens comprados aparecerão aqui.</small>
                )}
              </div>
            </article>

            {isAdmin && (
              <article className="settings-card">
                <div className="settings-card-title"><AppIcon name="tool"  /><div><h2>Manutenção da operação</h2><p>Bloqueia o uso do TM Hub para usuários não administradores.</p></div></div>
                <div className="align-items-center flex justify-content-between ">
                  <div>
                    <strong>{maintenanceActive ? "Manutenção ativa" : "Operação liberada"}</strong>
                    <br />
                    <small>{maintenanceActive ? "Administradores continuam com acesso." : "Todos os usuários autorizados podem operar normalmente."}</small>
                  </div>
                  <div className="flex gap-2">
                    <Checkbox
                      inputId="maintenance-mode"
                      binary
                      checked={maintenanceActive}
                      disabled={maintenanceSaving}
                      onChange={(event) => changeMaintenance(Boolean(event.checked))}
                    />
                    <label htmlFor="maintenance-mode">Ativar manutenção</label>
                  </div>
                </div>
              </article>
            )}
          </div>

          <div className="settings-column">
            <article className="settings-card">
              <div className="settings-card-title"><AppIcon name="palette"  /><div><h2>Aparência</h2><p>Combine luminosidade e identidade visual</p></div></div>
              <span className="appearance-label">Modo de exibição</span>
              <div className="mode-grid" role="radiogroup" aria-label="Modo de exibição">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`mode-card mode-card--${option.id}${mode === option.id ? " is-selected" : ""}`}
                    onClick={() => changeMode(option.id)}
                    role="radio"
                    aria-checked={mode === option.id}
                  >
                    <AppIcon name={option.icon} />
                    <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    {mode === option.id && <AppIcon name="circle-check" className="mode-card__check" aria-hidden="true"  />}
                  </button>
                ))}
              </div>
              <section>
                <span className="appearance-label">Identidade visual</span>
                <div className="theme-grid" role="radiogroup" aria-label="Identidade visual">
                  {availableThemes.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`theme-card theme-card--${option.id}${theme === option.id ? " is-selected" : ""}`}
                        style={{
                          "--theme-card-bg": option.card?.[0],
                          "--theme-card-text": option.card?.[1],
                          "--theme-card-muted": option.card?.[2],
                          "--theme-card-border": option.card?.[3],
                          "--theme-card-accent": option.card?.[4],
                        }}
                        onClick={() => changeTheme(option.id)}
                        role="radio"
                        aria-checked={theme === option.id}
                      >
                        <span className="theme-card__heading"><AppIcon name={option.icon} /><strong>{option.label}</strong></span>
                        <span
                          className="theme-card__preview"
                          aria-hidden="true"
                          style={{ gridTemplateColumns: `repeat(${option.preview?.length || 4}, minmax(0, 1fr))` }}
                        >
                          {(option.preview || []).map((color, index) => (
                            <i key={`${option.id}-${index}`} style={{ background: color }} />
                          ))}
                        </span>
                        <small>{option.description}</small>
                        {theme === option.id && <AppIcon name="circle-check" className="theme-card__check" aria-hidden="true"  />}
                      </button>
                  ))}
                </div>
              </section>
              <div className="appearance-effects">
                <div>
                  <strong>Partículas ambientais</strong>
                  <small>Detalhes leves de cor no fundo. Você pode desligar para priorizar desempenho.</small>
                </div>
                <Checkbox
                  inputId="appearance-particles"
                  binary
                  checked={particlesEnabled}
                  onChange={(event) => changeParticles(Boolean(event.checked))}
                />
              </div>
              <div className="appearance-effects">
                <div>
                  <strong>Timo como tela inicial</strong>
                  <small>Ao entrar no TM Hub e ao clicar na marca, abra diretamente o ambiente do Timo.</small>
                </div>
                <Checkbox
                  inputId="timo-home-screen"
                  binary
                  checked={Boolean(profile.timo_tela_inicial)}
                  onChange={(event) => changeTimoHome(Boolean(event.checked))}
                />
              </div>
            </article>

            <article className="settings-card password-card">
              <div className="settings-card-title"><AppIcon name="lock"  /><div><h2>Alterar senha</h2><p>Proteja sua conta com uma senha forte</p></div></div>
              <div className="password-fields"><Password value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} feedback={false} toggleMask placeholder="Senha atual" /><Password value={newPassword} onChange={(e) => setNewPassword(e.target.value)} toggleMask placeholder="Nova senha" promptLabel="Digite uma senha" weakLabel="Fraca" mediumLabel="Média" strongLabel="Forte" /><Password value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} feedback={false} toggleMask placeholder="Confirmar nova senha" /></div>
              <p className="password-hint"><AppIcon name="info-circle"  /> Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial.</p>
              <Button label="Atualizar senha" icon={<AppIcon name="shield" />} onClick={changePassword} />
            </article>
          </div>
        </div>
      </TabPanel>

      {isAdmin && <TabPanel header="Usuários" leftIcon={<AppIcon name="users" className="mr-2" />}>
        <UsersSettings />
      </TabPanel>}
      {isAdmin && <TabPanel header="Filiais" leftIcon={<AppIcon name="building" className="mr-2" />}>
        <BranchSettings />
      </TabPanel>}
      {isAdmin && <TabPanel header="Planejamento" leftIcon={<AppIcon name="adjustments-horizontal" className="mr-2" />}>
        <CapacityDepartmentSettings />
      </TabPanel>}
      {isAdmin && <TabPanel header="TM Ops" leftIcon={<AppIcon name="calendar-time" className="mr-2" />}>
        <TMOpsAccessSettings />
      </TabPanel>}
      {isAdmin && <TabPanel header="Timo" leftIcon={<AppIcon name="sparkles" className="mr-2" />}>
        <TimoSettings />
      </TabPanel>}
      {isAdmin && <TabPanel header="Notícias" leftIcon={<AppIcon name="speakerphone" className="mr-2" />}>
        <NewsSettings />
      </TabPanel>}
      {isAdmin && <TabPanel header="Uso do TMHub" leftIcon={<AppIcon name="chart-line" className="mr-2" />}>
        <UsageControlSettings />
      </TabPanel>}
    </TabView>

    <Dialog header="Confirme seu novo e-mail" visible={emailDialog} onHide={() => setEmailDialog(false)} className="otp-dialog" modal>
      <p>Digite o código de 6 dígitos enviado para <strong>{newEmail}</strong>.</p>
      <InputOtp value={otp} onChange={(e) => setOtp(e.value)} integerOnly length={6} />
      <div className="dialog-actions"><Button label="Cancelar" text onClick={() => setEmailDialog(false)} /><Button label="Confirmar e-mail" disabled={String(otp).length !== 6} onClick={confirmEmail} /></div>
    </Dialog>
  </section>;
}
