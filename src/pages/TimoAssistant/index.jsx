import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { AppIcon } from "../../components/icons/AppIcon";
import { useToast } from "../../contexts/ToastContext";
import connect from "../../utils/request";
import { storeProfile } from "../../utils/profile";
import { getAccessToken } from "../../utils/authSession";
import { conversationHistory, conversationScope, timoNavigationPath } from "./conversation";
import "./style.css";

const QUICK_COMMANDS = [
  { label: "Faltas hoje", command: "quantas faltas tivemos hoje", icon: "calendar-x" },
  { label: "Faltas pendentes", command: "quantas faltas estão pendentes", icon: "alert-circle" },
  { label: "Absenteísmo", command: "qual o absenteísmo deste mês", icon: "percentage" },
  { label: "Reservas", command: "quantas reservas estão disponíveis", icon: "users" },
  { label: "Quadro de lotação", command: "como está o quadro de lotação", icon: "chart-bar" },
  { label: "Vagas abertas", command: "quantas vagas estão abertas", icon: "briefcase" },
];

const BASE_SCENARIOS = [
  { id: "workshop", label: "Oficina", description: "A base criativa do Timo", icon: "tool", image: "/timo-scenes/workshop.webp" },
  { id: "orbit", label: "Órbita", description: "Observatório sobre a Terra", icon: "rocket", image: "/timo-scenes/orbit.webp" },
  { id: "garden", label: "Jardim", description: "Refúgio bioluminescente", icon: "leaf", image: "/timo-scenes/garden.webp" },
];
const PREMIUM_SCENARIOS = [
  { id: "christmas", productCode: "timo_cenario_christmas", label: "Natal", description: "Oficina iluminada de Natal", icon: "gift", image: "/timo-scenes/christmas.webp" },
  { id: "halloween", productCode: "timo_cenario_halloween", label: "Halloween", description: "Uma noite misteriosamente divertida", icon: "moon", image: "/timo-scenes/halloween.webp" },
  { id: "muertos", productCode: "timo_cenario_muertos", label: "Día de los Muertos", description: "Jardim de cempasúchil", icon: "leaf", image: "/timo-scenes/muertos.webp" },
];
const ALL_SCENARIOS = [...BASE_SCENARIOS, ...PREMIUM_SCENARIOS];

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function TimoAssistant() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const worldRef = useRef(null);
  const modelViewerRef = useRef(null);
  const conversationRef = useRef(null);
  const animationTimerRef = useRef(null);
  const sendingRef = useRef(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [animation, setAnimation] = useState("idle");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scenesOpen, setScenesOpen] = useState(false);
  const [skin, setSkin] = useState(() => localStorage.getItem("timo_skin") || "default");
  const [scenarioId, setScenarioId] = useState(() => localStorage.getItem("timo_scene") || "workshop");
  const [ownedScenes, setOwnedScenes] = useState(new Map());
  const [savingScenario, setSavingScenario] = useState(false);
  const [messages, setMessages] = useState([{
    id: "welcome",
    role: "timo",
    text: "Olá! Eu sou o Timo. O que vamos descobrir hoje?",
    time: nowLabel(),
  }]);

  const scenario = ALL_SCENARIOS.find((item) => item.id === scenarioId) || BASE_SCENARIOS[0];
  const availableScenarios = useMemo(() => [
    ...BASE_SCENARIOS,
    ...PREMIUM_SCENARIOS
      .filter((item) => ownedScenes.has(item.productCode) || item.id === scenarioId)
      .map((item) => ({ ...item, productId: ownedScenes.get(item.productCode)?.id })),
  ], [ownedScenes, scenarioId]);
  const latestTimoMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "timo"),
    [messages],
  );
  const modelSource = skin === "timo_gold" ? "/timo-gold.glb?v=gold-1" : "/timo.glb?v=current-1";
  const modelPoster = skin === "timo_gold" ? "/timo-gold-poster.png" : "/timo-poster.png";

  useEffect(() => {
    let mounted = true;
    import("@google/model-viewer").then(({ ModelViewerElement }) => {
      ModelViewerElement.minimumRenderScale = 1;
      if (mounted) setViewerReady(true);
    }).catch(() => {
      if (mounted) setModelFailed(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => () => window.clearTimeout(animationTimerRef.current), []);

  useEffect(() => {
    let mounted = true;
    connect.get("/marketplace/cenarios").then(({ data }) => {
      if (!mounted) return;
      setOwnedScenes(new Map((data?.cenarios || []).map((item) => [item.codigo, item])));
    }).catch(() => {
      if (mounted) setOwnedScenes(new Map());
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const syncProfile = (event) => {
      setSkin(event.detail?.timo_skin || localStorage.getItem("timo_skin") || "default");
      setScenarioId(event.detail?.timo_cenario || localStorage.getItem("timo_scene") || "workshop");
    };
    window.addEventListener("tmhub:profile", syncProfile);
    return () => window.removeEventListener("tmhub:profile", syncProfile);
  }, []);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, historyOpen]);

  useEffect(() => {
    if (!viewerReady || !modelViewerRef.current) return undefined;
    const viewer = modelViewerRef.current;
    const handleLoad = () => {
      setModelLoaded(true);
      setModelFailed(false);
      setAnimation("idle");
    };
    const handleError = () => {
      setModelLoaded(false);
      setModelFailed(true);
    };
    setModelLoaded(false);
    setModelFailed(false);
    viewer.addEventListener("load", handleLoad);
    viewer.addEventListener("error", handleError);
    viewer.setAttribute("src", modelSource);
    return () => {
      viewer.removeEventListener("load", handleLoad);
      viewer.removeEventListener("error", handleError);
    };
  }, [modelSource, viewerReady]);

  const playTemporaryAnimation = (name, duration = 1800) => {
    window.clearTimeout(animationTimerRef.current);
    setAnimation(name);
    animationTimerRef.current = window.setTimeout(() => setAnimation("idle"), duration);
  };

  const selectScenario = async (nextScenario) => {
    if (savingScenario || nextScenario.id === scenarioId) {
      setScenesOpen(false);
      return;
    }
    const previousScenario = scenarioId;
    setScenarioId(nextScenario.id);
    setScenesOpen(false);
    localStorage.setItem("timo_scene", nextScenario.id);
    try {
      setSavingScenario(true);
      if (nextScenario.productId) {
        await connect.patch("/marketplace/equipar", { categoria: "timo_cenario", produto_id: nextScenario.productId });
      } else {
        await connect.patch("/usuarios/perfil", { timo_cenario: nextScenario.id });
      }
      const { data: profile } = await connect.get("/usuarios/perfil");
      storeProfile(profile);
    } catch (error) {
      setScenarioId(previousScenario);
      localStorage.setItem("timo_scene", previousScenario);
      showToast("error", "Cenário não alterado", error.response?.data?.message || error.response?.data || "Não foi possível aplicar o cenário agora.");
    } finally {
      setSavingScenario(false);
    }
  };

  const send = async (command = text) => {
    const content = String(command || "").trim();
    if (!content || sendingRef.current) return;
    sendingRef.current = true;
    const scope = conversationScope(localStorage, getAccessToken());
    const history = conversationHistory(messages, scope);
    setText("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: content, time: nowLabel(), scope }]);
    try {
      setSending(true);
      setAnimation("thinking");
      const { data } = await connect.post("/timo/process", {
        text: content, conversation: true, history,
      }, { headers: { "X-Timo-Channel": "web-text" }, timeout: 35000 });
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "timo", text: data?.message || "Consulta concluída.", time: nowLabel(), action: data?.action || null, understood: data?.understood !== false, scope,
      }]);
      playTemporaryAnimation(data?.understood === false ? "thinking" : "speaking", 1900);
      const destination = timoNavigationPath(data, scope, conversationScope(localStorage, getAccessToken()));
      if (destination) navigate(destination);
    } catch (error) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "timo", text: error.response?.data?.message || error.response?.data || "Não consegui concluir essa consulta agora.", time: nowLabel(), error: true, scope,
      }]);
      playTemporaryAnimation("disabled", 1800);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await worldRef.current?.requestFullscreen?.();
    else await document.exitFullscreen?.();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const statusLabel = modelFailed ? "Modo compatibilidade" : !modelLoaded ? "Preparando o Timo" : animation === "thinking" ? "Consultando" : animation === "speaking" ? "Respondendo" : animation === "disabled" ? "Indisponível" : "Timo online";

  return (
    <main className="timo-world-page">
      <section ref={worldRef} className={`timo-world timo-world--${scenario.id}`}>
        <img key={scenario.id} className="timo-world__scene" src={scenario.image} alt="" aria-hidden="true" />
        <div className="timo-world__shade" />
        <header className="timo-world__toolbar">
          <div className="timo-world__identity"><span><AppIcon name="sparkles" /></span><div><strong>TIMO</strong><small>{scenario.description}</small></div></div>
          <div className="timo-world__actions">
            <button type="button" onClick={() => setScenesOpen((open) => !open)} aria-label={`Cenário: ${scenario.label}`} aria-expanded={scenesOpen}><AppIcon name={scenario.icon} /><span>{scenario.label}</span><AppIcon name="chevron-down" /></button>
            <button type="button" className="is-icon" onClick={() => setHistoryOpen((open) => !open)} aria-label="Abrir histórico da conversa" title="Histórico"><AppIcon name="messages" /></button>
            <button type="button" className="is-icon" onClick={toggleFullscreen} aria-label="Alternar tela cheia" title="Tela cheia"><AppIcon name="maximize" /></button>
          </div>
          {scenesOpen && <div className="timo-scene-picker" role="menu" aria-label="Escolher cenário">{availableScenarios.map((item) => <button type="button" key={item.id} className={item.id === scenario.id ? "is-active" : ""} disabled={savingScenario} onClick={() => selectScenario(item)}><span style={{ backgroundImage: `url(${item.image})` }} /><div><strong>{item.label}</strong><small>{item.description}</small></div>{item.id === scenario.id && <AppIcon name="check" />}</button>)}</div>}
        </header>

        <section className="timo-world__center" aria-label="Timo em três dimensões">
          {latestTimoMessage && <article className={`timo-world-bubble${latestTimoMessage.error ? " is-error" : ""}`}><strong>Timo</strong><p>{sending ? "Só um instante, estou consultando isso para você…" : latestTimoMessage.text}</p></article>}
          <div className={`timo-model-wrap${modelLoaded ? " is-ready" : ""}${modelFailed ? " is-fallback" : ""}`}>
            <div className="timo-model-loading" aria-hidden={modelLoaded}><span className="timo-model-loading__halo" /><img src={modelPoster} alt="" />{!modelFailed && <small><i /><i /><i /> Carregando o Timo</small>}</div>
            {viewerReady && !modelFailed && <model-viewer ref={modelViewerRef} key={modelSource} className="timo-world-model" alt="Timo em três dimensões" animation-name={animation} autoplay animation-crossfade-duration="420" interaction-prompt="none" shadow-intensity="1.2" shadow-softness=".8" exposure="1.05" camera-orbit="0deg 80deg 105%" />}
          </div>
          <div className={`timo-world-status${modelFailed ? " is-warning" : ""}`}><i />{statusLabel}</div>
        </section>

        <div className="timo-world__bottom">
          <nav className="timo-quick-actions" aria-label="Comandos rápidos">{QUICK_COMMANDS.map((item) => <button type="button" key={item.command} onClick={() => send(item.command)} disabled={sending}><AppIcon name={item.icon} /><span>{item.label}</span></button>)}</nav>
          <div className="timo-world-composer"><InputTextarea value={text} onChange={(event) => setText(event.target.value)} onFocus={() => { if (!sending) setAnimation("listening"); }} onBlur={() => { if (!sending) setAnimation("idle"); }} onKeyDown={handleKeyDown} autoResize rows={1} maxLength={500} placeholder="Pergunte algo ao Timo…" aria-label="Mensagem para o Timo" /><Button icon={<AppIcon name="send" />} aria-label="Enviar mensagem" onClick={() => send()} loading={sending} disabled={!text.trim()} /></div>
          <small>Enter para enviar · O Timo respeita suas empresas, filiais e permissões.</small>
        </div>

        <aside className={`timo-history${historyOpen ? " is-open" : ""}`} aria-hidden={!historyOpen}>
          <header><div><span>CONVERSA</span><strong>Histórico com o Timo</strong></div><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Fechar histórico"><AppIcon name="x" /></button></header>
          <div ref={conversationRef}>{messages.map((message) => <article key={message.id} className={`timo-history-message is-${message.role}${message.error ? " is-error" : ""}`}><div><strong>{message.role === "timo" ? "Timo" : "Você"}</strong><small>{message.time}</small></div><p>{message.text}</p></article>)}</div>
        </aside>
      </section>
    </main>
  );
}
