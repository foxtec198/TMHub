import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { AppIcon } from "../../components/icons/AppIcon";
import { PageHeader } from "../../components/PageHeader";
import connect from "../../utils/request";
import "./style.css";

const QUICK_COMMANDS = [
  { label: "Faltas hoje", command: "quantas faltas tivemos hoje", icon: "calendar-x" },
  { label: "Faltas pendentes", command: "quantas faltas estão pendentes", icon: "alert-circle" },
  { label: "Absenteísmo do mês", command: "qual o absenteísmo deste mês", icon: "percentage" },
  { label: "Reservas disponíveis", command: "quantas reservas estão disponíveis", icon: "users" },
  { label: "Quadro de lotação", command: "como está o quadro de lotação", icon: "chart-bar" },
  { label: "Vagas abertas", command: "quantas vagas estão abertas", icon: "briefcase" },
];

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function TimoAssistant() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [animation, setAnimation] = useState("idle");
  const [messages, setMessages] = useState([{ id: "welcome", role: "timo", text: "Olá! Sou o Timo. Escreva o que você quer consultar no TMHub ou escolha um comando rápido.", time: nowLabel() }]);
  const conversationRef = useRef(null);
  const animationTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    import("@google/model-viewer").then(({ ModelViewerElement }) => {
      ModelViewerElement.minimumRenderScale = 1;
      if (mounted) setModelReady(true);
    }).catch(() => { if (mounted) setModelFailed(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => () => window.clearTimeout(animationTimerRef.current), []);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const playTemporaryAnimation = (name, duration = 1800) => {
    window.clearTimeout(animationTimerRef.current);
    setAnimation(name);
    animationTimerRef.current = window.setTimeout(() => setAnimation("idle"), duration);
  };

  const playAnimationSequence = (steps) => {
    window.clearTimeout(animationTimerRef.current);
    const playStep = ([step, ...remaining]) => {
      if (!step) return;
      setAnimation(step.name);
      if (remaining.length) {
        animationTimerRef.current = window.setTimeout(() => playStep(remaining), step.duration);
      }
    };
    playStep(steps);
  };

  const send = async (command = text) => {
    const content = String(command || "").trim();
    if (!content || sending) return;
    setText("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: content, time: nowLabel() }]);
    try {
      setSending(true);
      window.clearTimeout(animationTimerRef.current);
      setAnimation("thinking");
      const { data } = await connect.post("/timo/process", { text: content }, { headers: { "X-Timo-Channel": "web-text" } });
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "timo", text: data?.message || "Consulta concluída.",
        time: nowLabel(), action: data?.action || null, understood: data?.understood !== false,
      }]);
      if (data?.understood === false) {
        playTemporaryAnimation("thinking", 1600);
      } else {
        playAnimationSequence([
          { name: "speaking", duration: 1900 },
          { name: "happy", duration: 1400 },
          { name: "idle" },
        ]);
      }
    } catch (error) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "timo", text: error.response?.data?.message || error.response?.data || "Não consegui concluir essa consulta agora.", time: nowLabel(), error: true,
      }]);
      playTemporaryAnimation("disabled", 1800);
    } finally { setSending(false); }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return <main className="timo-assistant-page">
    <PageHeader section="Assistente virtual" title="Timo" description="Consulte informações do TMHub por texto, com as mesmas permissões do seu usuário." />
    <section className="timo-assistant-shell">
      <aside className="timo-assistant-shortcuts">
        <header><span>COMANDOS RÁPIDOS</span><h2>O que você quer saber?</h2><p>As respostas usam os dados reais disponíveis no seu escopo.</p></header>
        <div>{QUICK_COMMANDS.map((item) => <button type="button" key={item.command} onClick={() => send(item.command)} disabled={sending}><AppIcon name={item.icon} /><span>{item.label}</span><AppIcon name="arrow-right" /></button>)}</div>
        <small><AppIcon name="shield" /> O Timo respeita suas empresas, filiais e permissões.</small>
      </aside>
      <div className="timo-assistant-main">
        <div className="timo-assistant-stage" aria-label="Timo em três dimensões">
          <div className="timo-assistant-orbit" />
          {modelFailed || !modelReady ? <img src="/timo-poster.png" alt="Timo" /> : <model-viewer className="timo-assistant-model" src="/timo.glb" poster="/timo-poster.png" alt="Timo em três dimensões" animation-name={animation} autoplay animation-crossfade-duration="350" interaction-prompt="none" camera-controls disable-zoom shadow-intensity="1" shadow-softness=".8" exposure="1.05" camera-orbit="0deg 80deg 105%" onLoad={() => playAnimationSequence([{ name: "wave", duration: 2400 }, { name: "idle" }])} onPointerDown={() => !sending && playTemporaryAnimation("dragging", 900)} onPointerUp={() => !sending && setAnimation("idle")} onError={() => setModelFailed(true)} />}
          <div className="timo-assistant-status"><i /> {animation === "thinking" ? "Consultando" : animation === "speaking" ? "Respondendo" : animation === "disabled" ? "Indisponível" : "Timo online"}</div>
        </div>
        <section className="timo-conversation" aria-label="Conversa com o Timo">
          <div className="timo-conversation__messages" ref={conversationRef}>{messages.map((message) => <article key={message.id} className={`timo-message is-${message.role}${message.error ? " is-error" : ""}`}>
            {message.role === "timo" && <span className="timo-message__avatar"><AppIcon name="sparkles" /></span>}
            <div><p>{message.text}</p>{message.action?.type === "navigate" && <Button label="Abrir tela" icon={<AppIcon name="external-link" />} text onClick={() => navigate(message.action.path)} />}<small>{message.role === "timo" ? "Timo" : "Você"} · {message.time}</small></div>
          </article>)}{sending && <article className="timo-message is-timo"><span className="timo-message__avatar"><AppIcon name="sparkles" /></span><div className="timo-typing" aria-label="Timo está consultando"><i /><i /><i /></div></article>}</div>
          <footer><div className="timo-composer"><InputTextarea value={text} onChange={(event) => setText(event.target.value)} onFocus={() => !sending && setAnimation("listening")} onBlur={() => !sending && setAnimation("idle")} onKeyDown={handleKeyDown} autoResize rows={1} maxLength={500} placeholder="Escreva uma pergunta ou comando para o Timo…" aria-label="Mensagem para o Timo" /><Button icon={<AppIcon name="send" />} rounded aria-label="Enviar mensagem" onClick={() => send()} loading={sending} disabled={!text.trim()} /></div><small>Enter para enviar · Shift + Enter para quebrar linha · Somente texto</small></footer>
        </section>
      </div>
    </section>
  </main>;
}
