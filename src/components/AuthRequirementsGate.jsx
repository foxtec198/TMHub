// React
import { useCallback, useEffect, useRef, useState } from "react";
// PrimeReact
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputMask } from "primereact/inputmask";
import { Password } from "primereact/password";

// Utilitários
import connect from "../utils/request";
import { socketio } from "../utils/socketio";
import { clearAccessToken, getAccessToken, setAccessToken } from "../utils/authSession";
// Contextos
import { useLoading } from "../contexts/LoadingContext";
import { useToast } from "../contexts/ToastContext";
// Estilos
import "./AuthRequirementsGate.css";

// Define as pendências que bloqueiam o acesso até serem resolvidas.
const emptyRequirements = {
  primeiro_acesso: false,
  cpf_pendente: false,
  foto_pendente: false,
  troca_senha_obrigatoria: false,
  senha_padrao: false,
  pendencia_obrigatoria: false,
  interacao_pendente: false,
};

// Normaliza e persiste as pendências que controlam o fluxo de acesso.
function persistRequirements(requirements) {
  const normalized = { ...emptyRequirements, ...(requirements || {}) };
  localStorage.setItem("auth_requirements", JSON.stringify(normalized));
  return normalized;
}

export function AuthRequirementsGate() {
  const [requirements, setRequirements] = useState(() => {
    try {
      return { ...emptyRequirements, ...JSON.parse(localStorage.getItem("auth_requirements") || "{}") };
    } catch {
      return emptyRequirements;
    }
  });
  const [cpf, setCpf] = useState("");
  const [photo, setPhoto] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const fileRef = useRef(null);
  const setLoading = useLoading();
  const { showToast } = useToast();

  // Aplica a resposta da API e reconecta o Socket.IO quando as pendências acabam.
  const applyResponse = useCallback((data) => {
    if (data?.cpf) setCpf(data.cpf);
    if (data?.foto_perfil) setPhoto(data.foto_perfil);
    const next = persistRequirements(data?.requirements || data);
    setRequirements(next);
    if (!next.interacao_pendente) {
      socketio.auth = { token: getAccessToken() };
      socketio.disconnect().connect();
      if (data?.foto_perfil) {
        window.dispatchEvent(new CustomEvent("tmhub:profile", {
          detail: {
            nome: localStorage.getItem("display_name") || "",
            foto_perfil: data.foto_perfil,
          },
        }));
      }
    }
  }, []);

  useEffect(() => {
    if (getAccessToken()) {
      connect.get("/usuarios/pendencias")
        .then(({ data }) => applyResponse(data))
        .catch(() => {});
    }
    const listener = (event) => applyResponse(event.detail || {});
    window.addEventListener("tmhub:auth-requirements", listener);
    return () => window.removeEventListener("tmhub:auth-requirements", listener);
  }, [applyResponse]);

  // Valida tipo e tamanho antes de converter a foto para prévia local.
  const selectPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1_500_000) {
      showToast("warn", "Foto inválida", "Use PNG, JPG ou WEBP de até 1,5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  // Atualiza o perfil pendente e libera a próxima etapa de acesso.
  const saveProfile = async () => {
    if (!cpf) {
      showToast("warn", "Cadastro incompleto", "Informe um CPF válido.");
      return;
    }
    setLoading(true);
    try {
      const payload = { cpf };
      if (photo) payload.foto_perfil = photo;
      const { data } = await connect.patch("/usuarios/onboarding/perfil", payload);
      if (data.foto_perfil) localStorage.setItem("profile_photo", data.foto_perfil);
      applyResponse(data);
      showToast("success", "Cadastro concluído", "CPF validado com sucesso.");
    } catch (error) {
      showToast("error", "Não foi possível concluir", error.response?.data || "Confira os dados informados.");
    } finally {
      setLoading(false);
    }
  };

  // Confere a confirmação antes de substituir a senha obrigatória.
  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      showToast("warn", "Senhas diferentes", "A confirmação deve ser igual à nova senha.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await connect.post("/usuarios/onboarding/senha", { nova_senha: newPassword });
      setAccessToken(data.access_token);
      setNewPassword("");
      setConfirmPassword("");
      applyResponse(data);
      showToast("success", "Senha atualizada", "As sessões anteriores foram invalidadas.");
    } catch (error) {
      showToast("error", "Não foi possível alterar", error.response?.data || "Confira a nova senha.");
    } finally {
      setLoading(false);
    }
  };

  const ignoreDefaultPassword = async () => {
    setLoading(true);
    try {
      const { data } = await connect.post("/usuarios/onboarding/senha-padrao/ignorar");
      applyResponse(data);
    } catch (error) {
      showToast("error", "Não foi possível continuar", error.response?.data || "Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Limpa a sessão quando o usuário decide interromper o cadastro obrigatório.
  const logout = () => {
    socketio.disconnect();
    clearAccessToken();
    localStorage.removeItem("auth_requirements");
    window.location.href = "/login";
  };

  const profileStep = requirements.cpf_pendente;
  const passwordStep = !profileStep && (requirements.troca_senha_obrigatoria || requirements.senha_padrao);

  return (
    <Dialog
      visible={Boolean(getAccessToken() && requirements.interacao_pendente)}
      onHide={() => {}}
      closable={false}
      closeOnEscape={false}
      dismissableMask={false}
      modal
      blockScroll
      draggable={false}
      className="auth-requirements-dialog"
      header={profileStep ? "Complete seu primeiro acesso" : "Proteja sua conta"}
    >
      {profileStep && (
        <div className="auth-requirements-content">
          <div className="auth-requirements-intro">
            <i className="pi pi-user-edit" />
            <div>
              <strong>Precisamos confirmar seus dados</strong>
              <span>O CPF é obrigatório. A foto de perfil é opcional.</span>
            </div>
          </div>
          <label>CPF
            <InputMask mask="999.999.999-99" value={cpf} onChange={(event) => setCpf(event.value || "")} placeholder="000.000.000-00" />
          </label>
          <div className="required-photo">
            <div className="required-photo-preview">
              {photo ? <img src={photo} alt="Prévia da foto de perfil" /> : <i className="pi pi-user" />}
            </div>
            <div>
              <strong>Foto de perfil <small>(opcional)</small></strong>
              <span>PNG, JPG ou WEBP de até 1,5 MB.</span>
              <Button label={photo ? "Trocar foto" : "Selecionar foto"} icon="pi pi-camera" outlined onClick={() => fileRef.current?.click()} />
              <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={selectPhoto} />
            </div>
          </div>
          <div className="auth-requirements-actions">
            <Button label="Sair" icon="pi pi-sign-out" text severity="secondary" onClick={logout} />
            <Button label="Salvar e continuar" icon="pi pi-arrow-right" iconPos="right" onClick={saveProfile} />
          </div>
        </div>
      )}

      {passwordStep && (
        <div className="auth-requirements-content">
          <div className={`auth-requirements-intro ${requirements.senha_padrao ? "is-warning" : ""}`}>
            <i className={requirements.senha_padrao ? "pi pi-info-circle" : "pi pi-shield"} />
            <div>
              <strong>{requirements.senha_padrao ? "Você ainda utiliza a senha padrão" : "Sua senha atual não atende aos requisitos"}</strong>
              <span>{requirements.senha_padrao ? "Recomendamos alterá-la agora. Você também pode continuar temporariamente." : "A alteração é obrigatória antes de acessar o sistema."}</span>
            </div>
          </div>
          <label>Nova senha
            <Password value={newPassword} onChange={(event) => setNewPassword(event.target.value)} toggleMask promptLabel="Digite uma senha" weakLabel="Fraca" mediumLabel="Média" strongLabel="Forte" />
          </label>
          <label>Confirmar nova senha
            <Password value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} feedback={false} toggleMask />
          </label>
          <small className="auth-password-rule"><i className="pi pi-info-circle" /> Use 8 ou mais caracteres, com maiúscula, minúscula, número e símbolo.</small>
          <div className="auth-requirements-actions">
            <Button label="Sair" icon="pi pi-sign-out" text severity="secondary" onClick={logout} />
            {requirements.senha_padrao && <Button label="Continuar por agora" text onClick={ignoreDefaultPassword} />}
            <Button label="Alterar senha" icon="pi pi-shield" onClick={changePassword} />
          </div>
        </div>
      )}
    </Dialog>
  );
}
