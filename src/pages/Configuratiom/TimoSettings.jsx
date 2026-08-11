import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputSwitch } from "primereact/inputswitch";
import { InputTextarea } from "primereact/inputtextarea";
import { TabPanel, TabView } from "primereact/tabview";

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
  const [learningExamples, setLearningExamples] = useState([]);
  const [learningIntentOptions, setLearningIntentOptions] = useState([]);
  const [learningSelections, setLearningSelections] = useState({});
  const [approvedLearningCount, setApprovedLearningCount] = useState(0);
  const [reviewingLearningId, setReviewingLearningId] = useState(null);
  const [training, setTraining] = useState(false);
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
        setLearningExamples(data?.aprendizados || []);
        setLearningIntentOptions(data?.intents_disponiveis || []);
        setApprovedLearningCount(data?.aprendizados_aprovados || 0);
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

  async function reviewLearning(example, status) {
    const selectedIntent = learningSelections[example.id] || example.intent_sugerida;
    if (status === "aprovado" && !selectedIntent) {
      showToast("warn", "Aprendizado", "Selecione a intenção correta para aprovar a frase.");
      return;
    }

    setReviewingLearningId(example.id);
    try {
      await connect.patch(`/timo/aprendizados/${example.id}`, {
        status,
        intent: selectedIntent,
      });
      setLearningExamples((current) => current.filter((item) => item.id !== example.id));
      if (status === "aprovado") {
        setApprovedLearningCount((current) => current + 1);
      }
      showToast("success", "Aprendizado", status === "aprovado" ? "Frase aprovada para o próximo treino." : "Frase ignorada.");
    } catch (error) {
      showToast("error", "Aprendizado", errorMessage(error, "Não foi possível revisar a frase."));
    } finally {
      setReviewingLearningId(null);
    }
  }

  async function trainLearning() {
    setTraining(true);
    try {
      const { data } = await connect.post("/timo/aprendizados/treinar");
      showToast("success", "Aprendizado", data?.message || "Modelo treinado com as frases aprovadas.");
    } catch (error) {
      showToast("error", "Aprendizado", errorMessage(error, "Não foi possível treinar o modelo."));
    } finally {
      setTraining(false);
    }
  }

  function renderConfiguration(configuration) {
    return (
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
    );
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

      <TabView className="timo-settings__tabs">
        <TabPanel header="Consultas e análises" leftIcon="pi pi-chart-line mr-2">
          <p className="timo-settings__tab-description">Indicadores e respostas analíticas baseadas nos dados operacionais do seu escopo.</p>
          <div className="timo-settings__list">
            {configurations.filter((item) => item.categoria === "analises").map(renderConfiguration)}
          </div>
        </TabPanel>
        <TabPanel header="Navegação entre telas" leftIcon="pi pi-compass mr-2">
          <p className="timo-settings__tab-description">Comandos para abrir telas do TMHub. O acesso final continua respeitando a permissão de cada usuário.</p>
          <div className="timo-settings__list">
            {configurations.filter((item) => item.categoria === "telas").map(renderConfiguration)}
          </div>
        </TabPanel>
        <TabPanel header="Personalizados" leftIcon="pi pi-sparkles mr-2">
          <p className="timo-settings__tab-description">Frases criadas manualmente para respostas ou ações específicas.</p>
          <div className="timo-settings__list">
            {configurations.filter((item) => item.categoria === "personalizado").map(renderConfiguration)}
          </div>
        </TabPanel>
        <TabPanel header="Aprendizado" leftIcon="pi pi-graduation-cap mr-2">
          <div className="timo-learning__intro">
            <div>
              <h3>Frases para revisão</h3>
              <p>Somente comandos que o Timo não entendeu entram aqui. Revise a intenção e treine o modelo quando quiser aplicar as frases aprovadas.</p>
            </div>
            <Button
              label={`Treinar modelo${approvedLearningCount ? ` (${approvedLearningCount})` : ""}`}
              icon="pi pi-refresh"
              disabled={!approvedLearningCount}
              loading={training}
              onClick={trainLearning}
            />
          </div>
          <div className="timo-learning__list">
            {learningExamples.length ? learningExamples.map((example) => (
              <article className="timo-learning-card" key={example.id}>
                <div>
                  <code>“{example.texto}”</code>
                  <small>{example.ocorrencias} ocorrência(s) · confiança sugerida {Math.round((example.confianca || 0) * 100)}%</small>
                </div>
                <Dropdown
                  value={learningSelections[example.id] || example.intent_sugerida || null}
                  options={learningIntentOptions}
                  optionLabel="label"
                  optionValue="value"
                  filter
                  placeholder="Intenção correta"
                  onChange={(event) => setLearningSelections((current) => ({ ...current, [example.id]: event.value }))}
                />
                <div className="timo-learning-card__actions">
                  <Button label="Ignorar" text severity="secondary" disabled={reviewingLearningId === example.id} onClick={() => reviewLearning(example, "ignorado")} />
                  <Button label="Aprovar" icon="pi pi-check" loading={reviewingLearningId === example.id} onClick={() => reviewLearning(example, "aprovado")} />
                </div>
              </article>
            )) : (
              <div className="timo-learning__empty"><i className="pi pi-check-circle" /> Nenhuma frase aguardando revisão.</div>
            )}
          </div>
        </TabPanel>
      </TabView>

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
