import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import connect from "../../utils/request";
import { TimoAvatar } from "./TimoAvatar";
import { TimoBubble } from "./TimoBubble";
import { commandAfterWakeWord, normalizeTimoTranscript } from "./wakeWords";
import { useTimoSpeechRecognition } from "./useTimoSpeechRecognition";
import "./TimoAssistant.css";

const MIN_BUBBLE_TIME = 4200;
const MAX_BUBBLE_TIME = 13000;
const WAKE_TIMEOUT = 9000;
const DESKTOP_BREAKPOINT = "(min-width: 961px)";
const DESKTOP_POSITION_KEY = "timo_desktop_position";
const DRAG_REACTIONS = ["joy", "tickle", "pain"];

function readDesktopPosition() {
  try {
    const stored = JSON.parse(localStorage.getItem(DESKTOP_POSITION_KEY) || "null");
    if (Number.isFinite(stored?.left) && Number.isFinite(stored?.bottom)) return stored;
  } catch {
    // A posição é apenas uma preferência visual; use a posição padrão se ela estiver inválida.
  }
  return { left: 80, bottom: 16 };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function bubbleDuration(message) {
  return Math.min(MAX_BUBBLE_TIME, Math.max(MIN_BUBBLE_TIME, MIN_BUBBLE_TIME + String(message || "").length * 38));
}

export function TimoAssistant() {
  const navigate = useNavigate();
  const [state, setState] = useState("idle");
  const [bubble, setBubble] = useState(null);
  const [history, setHistory] = useState([]);
  const [manualDisabled, setManualDisabled] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_BREAKPOINT).matches);
  const [desktopPosition, setDesktopPosition] = useState(readDesktopPosition);
  const [dragReaction, setDragReaction] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const awaitingCommandRef = useRef(false);
  const wakeTimerRef = useRef(null);
  const bubbleTimerRef = useRef(null);
  const commandTimerRef = useRef(null);
  const processingRef = useRef(false);
  const dragRef = useRef(null);
  const suppressToggleRef = useRef(false);
  const desktopPositionRef = useRef(desktopPosition);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT);
    const syncViewport = () => setIsDesktop(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const dismissBubble = useCallback(() => {
    window.clearTimeout(bubbleTimerRef.current);
    setBubble(null);
    if (!processingRef.current && !awaitingCommandRef.current) setState("listening");
  }, []);

  const showBubble = useCallback((message, type = "info") => {
    const normalizedMessage = String(message || "Estou aqui.").trim();
    window.clearTimeout(bubbleTimerRef.current);
    setBubble({ message: normalizedMessage, type });
    setHistory((current) => [...current, { message: normalizedMessage, type, at: Date.now() }].slice(-5));
    bubbleTimerRef.current = window.setTimeout(dismissBubble, bubbleDuration(normalizedMessage));
  }, [dismissBubble]);

  const answer = useCallback((message, type = "info") => {
    const normalizedMessage = String(message || "Não consegui concluir esse comando agora.").trim();
    showBubble(normalizedMessage, type);
    setState(type === "error" ? "error" : "responding");
  }, [showBubble]);

  const processCommand = useCallback(async (transcript) => {
    const command = normalizeTimoTranscript(transcript);
    if (!command || processingRef.current) return;

    processingRef.current = true;
    awaitingCommandRef.current = false;
    window.clearTimeout(wakeTimerRef.current);
    setState("processing");

    try {
      const { data } = await connect.post("/timo/comandos", { command });
      if (data?.action?.type === "navigate" && data.action.path) {
        navigate(data.action.path);
      }
      const unknownCommand = data?.success === false;
      answer(data?.message, unknownCommand ? "warning" : "success");
      if (unknownCommand) setState("unknown");
    } catch (error) {
      answer(error.response?.data?.message || error.response?.data || "Não consegui fazer isso agora.", "error");
    } finally {
      processingRef.current = false;
    }
  }, [answer, navigate]);

  const handleFinalTranscript = useCallback((transcript) => {
    const normalized = normalizeTimoTranscript(transcript);
    if (!normalized || processingRef.current) return;

    if (!awaitingCommandRef.current) {
      console.info("[Timo] Escutou:", transcript);
    }

    if (awaitingCommandRef.current) {
      processCommand(normalized);
      return;
    }

    const inlineCommand = commandAfterWakeWord(normalized);
    if (inlineCommand === null) return;

    setState("wake");
    awaitingCommandRef.current = true;
    showBubble("Estou ouvindo. Pode falar.");
    window.clearTimeout(wakeTimerRef.current);
    wakeTimerRef.current = window.setTimeout(() => {
      awaitingCommandRef.current = false;
      if (!processingRef.current) setState("listening");
    }, WAKE_TIMEOUT);

    if (inlineCommand) {
      commandTimerRef.current = window.setTimeout(() => processCommand(inlineCommand), 260);
    }
  }, [processCommand, showBubble]);

  const handleRecognitionState = useCallback((nextState) => {
    if (!processingRef.current && !awaitingCommandRef.current && !bubble) {
      setState(nextState);
    }
  }, [bubble]);

  const handleRecognitionError = useCallback((message, nextState = "error") => {
    if (bubble) return;
    answer(message, nextState === "disabled" ? "warning" : "error");
    setState(nextState);
  }, [answer, bubble]);

  const { available, enabled, start, stop } = useTimoSpeechRecognition({
    onFinalTranscript: handleFinalTranscript,
    onStateChange: handleRecognitionState,
    onError: handleRecognitionError,
  });

  useEffect(() => () => {
    window.clearTimeout(wakeTimerRef.current);
    window.clearTimeout(bubbleTimerRef.current);
    window.clearTimeout(commandTimerRef.current);
  }, []);

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      suppressToggleRef.current = true;
      setIsDragging(true);
    }
    if (!suppressToggleRef.current) return;

    const margin = 12;
    const nextPosition = {
      left: clamp(drag.left + deltaX, margin, window.innerWidth - drag.width - margin),
      bottom: clamp(drag.bottom - deltaY, margin, window.innerHeight - drag.height - margin),
    };
    desktopPositionRef.current = nextPosition;
    setDesktopPosition(nextPosition);
  }, []);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;

    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    if (suppressToggleRef.current) {
      localStorage.setItem(DESKTOP_POSITION_KEY, JSON.stringify(desktopPositionRef.current));
      window.setTimeout(() => { suppressToggleRef.current = false; }, 0);
    }
    setIsDragging(false);
    setDragReaction(null);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback((event) => {
    if (!isDesktop || event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      left: bounds.left,
      bottom: window.innerHeight - bounds.bottom,
      width: bounds.width,
      height: bounds.height,
    };
    suppressToggleRef.current = false;
    setDragReaction(DRAG_REACTIONS[Math.floor(Math.random() * DRAG_REACTIONS.length)]);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag, { once: true });
  }, [finishDrag, handlePointerMove, isDesktop]);

  useEffect(() => () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", finishDrag);
  }, [finishDrag, handlePointerMove]);

  const toggle = () => {
    if (suppressToggleRef.current) return;
    if (!available) {
      answer("Seu navegador não oferece reconhecimento de fala.", "warning");
      setState("disabled");
      return;
    }
    if (enabled) {
      setManualDisabled(true);
      stop();
      window.clearTimeout(bubbleTimerRef.current);
      setBubble(null);
    } else {
      setManualDisabled(false);
      start();
    }
  };

  return (
    <div
      className={`timo-assistant ${isDragging ? "is-dragging" : ""}`}
      data-history-count={history.length}
      style={isDesktop ? { "--timo-left": `${desktopPosition.left}px`, "--timo-bottom": `${desktopPosition.bottom}px` } : undefined}
      onPointerDown={handlePointerDown}
    >
      <TimoBubble message={bubble?.message} type={bubble?.type} onClose={dismissBubble} />
      <TimoAvatar
        state={available ? state : "disabled"}
        enabled={enabled && available}
        manualDisabled={manualDisabled}
        dragReaction={isDragging ? dragReaction : null}
        onToggle={toggle}
      />
    </div>
  );
}
