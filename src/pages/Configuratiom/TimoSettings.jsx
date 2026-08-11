import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputSwitch } from "primereact/inputswitch";
import { InputTextarea } from "primereact/inputtextarea";

import { useLoading } from "../../contexts/LoadingContext";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";


const ACTION_TYPES = [
  { label: "Somente mostrar o balão", value: "none" },
  { label: "Abrir uma tela", value: "navigate" },
];

const EMPTY_CUSTOM_COMMAND = {
  titulo: "",
  descricao: "",
  comando: "",
  resposta_template: "",
  acao_tipo: "none",
  acao_valor: null,
  ativo: true,
};


function errorMessage(error, fallback) {
  return error.response?.data?.message || error.response?.data || fallback;
}


export function TimoSettings({ timoActive, onToggleTimo }) {
  const [configurations, setConfigurations] = useState([]);
  const [navigationOptions, setNavigationOptions] = useState([]);
  const [savingIntent, setSavingIntent] = useState(null);
  const [customDialog, setCustomDialog] = useState(false);
  const [customCommand, setCustomCommand] = useState(EMPTY_CUSTOM_COMMAND);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const { showToast } = useToast();
  const setLoading = useLoading();

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const { data } = await connect.get("/timo/configuracoes");
        if (!active) return;
        setConfigurations(data?.configuracoes || []);
        setNavigationOptions(data?.acoes || []);
      } catch (error) {
        if (active) {
          showToast("error", "Timo", errorMessage(error, "Não foi possível carregar as automações do Timo."));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [setLoading, showToast]);

  function update(intent, field, value) {
    setConfigurations((current) => current.map((item) => (
      item.intent === intent
        ? {
          ...item,
          [field]: value,
          ...(field === "acao_tipo" && value === "none" ? { acao_valor: null } : {}),
        }
        : item
    )));
  }

  async function save(configuration) {
    setSavingIntent(configuration.intent);
    try {
      await connect.patch(`/timo/configuracoes/${configuration.intent}`, {
        ativo: configuration.ativo,
        resposta_template: configuration.resposta_template,
        acao_tipo: configuration.acao_tipo,
        acao_valor: configuration.acao_valor,
      });
      showToast("success", "Timo", "Automação atualizada.");
    } catch (error) {
      showToast("error", "Timo", errorMessage(error, "Não foi possível salvar a automação."));
    } finally {
      setSavingIntent(null);
    }
  }

  function changeCustom(field, value) {
    setCustomCommand((current) => ({
      ...current,
      [field]: value,
      ...(field === "acao_tipo" && value === "none" ? { acao_valor: null } : {}),
    }));
  }

  async function createCustomCommand() {
    setCreatingCustom(true);
    try {
      const { data } = await connect.post("/timo/configuracoes/comandos", customCommand);
      setConfigurations((current) => [...current, data.configuracao]);
      setCustomDialog(false);
      setCustomCommand(EMPTY_CUSTOM_COMMAND);
      showToast("success", "Timo", "Comando personalizado criado.");
    } catch (error) {
      showToast("error", "Timo", errorMessage(error, "Não foi possível criar o comando."));
    } finally {
      setCreatingCustom(false);
    }
  }

  async function removeCustomCommand(configuration) {
    setSavingIntent(configuration.intent);
    try {
      await connect.delete(`/timo/configuracoes/${configuration.intent}`);
      setConfigurations((current) => current.filter((item) => item.intent !== configuration.intent));
      showToast("success", "Timo", "Comando personalizado removido.");
    } catch (error) {
      showToast("error", "Timo", errorMessage(error, "Não foi possível remover o comando."));
    } finally {
      setSavingIntent(null);
    }
  }

  return (
    <section className="timo-settings">
      <div className="timo-settings__intro">
        <div>
          <h2>Automação do Timo</h2>
          <p>Defina o que cada intenção reconhecida mostra no balão e qual tela o assistente pode abrir.</p>
        </div>
        <div className="timo-settings__intro-actions">
          <span className={`timo-settings__status${timoActive ? " is-active" : ""}`}>
            <i className={`pi ${timoActive ? "pi-microphone" : "pi-microphone-slash"}`} aria-hidden="true" />
            {timoActive ? "Timo ativo" : "Timo desativado"}
          </span>
          <Button
            label={timoActive ? "Desativar Timo" : "Ativar Timo"}
            icon={timoActive ? "pi pi-pause" : "pi pi-play"}
            outlined={Boolean(timoActive)}
            onClick={onToggleTimo}
          />
          <Button label="Novo comando" icon="pi pi-plus" onClick={() => setCustomDialog(true)} />
        </div>
      </div>

      <div className="timo-settings__list">
        {configurations.map((configuration) => (
          <article className={`timo-intent-card${configuration.ativo ? "" : " is-disabled"}`} key={configuration.intent}>
            <header className="timo-intent-card__header">
              <div>
                <h3>{configuration.label}</h3>
                <code>{configuration.intent}</code>
                <p>{configuration.description}</p>
              </div>
              <label className="timo-intent-card__switch">
                <span>{configuration.ativo ? "Ativa" : "Desativada"}</span>
                <InputSwitch checked={configuration.ativo} onChange={(event) => update(configuration.intent, "ativo", event.value)} />
              </label>
            </header>

            <label className="timo-intent-card__field">
              <span>Resposta do balão</span>
              <InputTextarea
                rows={3}
                autoResize
                value={configuration.resposta_template}
                onChange={(event) => update(configuration.intent, "resposta_template", event.target.value)}
                placeholder="Mensagem que o Timo vai mostrar"
              />
              {configuration.comandos?.length ? (
                <small>Fale: {configuration.comandos.map((command) => `“${command}”`).join(" ou ")}</small>
              ) : null}
              {configuration.variaveis?.length ? (
                <small>Variáveis disponíveis: {configuration.variaveis.join(", ")}</small>
              ) : null}
            </label>

            <div className="timo-intent-card__actions">
              <label className="timo-intent-card__field">
                <span>Após responder</span>
                <Dropdown
                  value={configuration.acao_tipo}
                  options={ACTION_TYPES}
                  optionLabel="label"
                  optionValue="value"
                  onChange={(event) => update(configuration.intent, "acao_tipo", event.value)}
                />
              </label>

              {configuration.acao_tipo === "navigate" ? (
                <label className="timo-intent-card__field">
                  <span>Tela para abrir</span>
                  <Dropdown
                    value={configuration.acao_valor}
                    options={navigationOptions}
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Selecione uma tela"
                    onChange={(event) => update(configuration.intent, "acao_valor", event.value)}
                  />
                </label>
              ) : null}
            </div>

            <footer>
              {configuration.personalizado ? (
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  loading={savingIntent === configuration.intent}
                  onClick={() => removeCustomCommand(configuration)}
                  aria-label="Remover comando personalizado"
                  tooltip="Remover comando"
                />
              ) : null}
              <Button
                label="Salvar automação"
                icon="pi pi-save"
                loading={savingIntent === configuration.intent}
                onClick={() => save(configuration)}
              />
            </footer>
          </article>
        ))}
      </div>

      <Dialog
        header="Novo comando do Timo"
        visible={customDialog}
        modal
        className="timo-command-dialog"
        onHide={() => !creatingCustom && setCustomDialog(false)}
      >
        <div className="timo-command-form">
          <label>
            <span>Nome do comando</span>
            <InputText value={customCommand.titulo} onChange={(event) => changeCustom("titulo", event.target.value)} placeholder="Ex.: Abrir Controle de Glosas" />
          </label>
          <label>
            <span>Frase que o Timo deve reconhecer</span>
            <InputText value={customCommand.comando} onChange={(event) => changeCustom("comando", event.target.value)} placeholder="Ex.: abrir controle de glosas" />
          </label>
          <label className="is-wide">
            <span>Descrição</span>
            <InputText value={customCommand.descricao} onChange={(event) => changeCustom("descricao", event.target.value)} placeholder="Explique rapidamente o que esse comando faz" />
          </label>
          <label className="is-wide">
            <span>Resposta do balão</span>
            <InputTextarea rows={3} autoResize value={customCommand.resposta_template} onChange={(event) => changeCustom("resposta_template", event.target.value)} placeholder="Ex.: Abrindo o Controle de Glosas." />
          </label>
          <label>
            <span>Após responder</span>
            <Dropdown value={customCommand.acao_tipo} options={ACTION_TYPES} optionLabel="label" optionValue="value" onChange={(event) => changeCustom("acao_tipo", event.value)} />
          </label>
          {customCommand.acao_tipo === "navigate" ? (
            <label>
              <span>Tela para abrir</span>
              <Dropdown value={customCommand.acao_valor} options={navigationOptions} optionLabel="label" optionValue="value" placeholder="Selecione uma tela" onChange={(event) => changeCustom("acao_valor", event.value)} />
            </label>
          ) : null}
        </div>
        <div className="dialog-actions">
          <Button label="Cancelar" text disabled={creatingCustom} onClick={() => setCustomDialog(false)} />
          <Button label="Criar comando" icon="pi pi-check" loading={creatingCustom} onClick={createCustomCommand} />
        </div>
      </Dialog>
    </section>
  );
}
