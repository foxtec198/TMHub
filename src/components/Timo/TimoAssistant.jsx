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

    if (Number.isFinite(stored?.left) && Number.isFinite(stored?.bottom)) {
      return stored;
    }
  } catch {
    // Usa a posição padrão caso o valor salvo seja inválido.
  }

  return {
    left: 80,
    bottom: 16,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function bubbleDuration(message) {
  const length = String(message || "").length;

  return Math.min(
    MAX_BUBBLE_TIME,
    Math.max(MIN_BUBBLE_TIME, MIN_BUBBLE_TIME + length * 38)
  );
}

export function TimoAssistant() {
  const navigate = useNavigate();

  const [state, setState] = useState("idle");
  const [bubble, setBubble] = useState(null);
  const [history, setHistory] = useState([]);
  const [manualDisabled, setManualDisabled] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    window.matchMedia(DESKTOP_BREAKPOINT).matches
  );
  const [desktopPosition, setDesktopPosition] = useState(readDesktopPosition);
  const [dragReaction, setDragReaction] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const awaitingCommandRef = useRef(false);
  const wakeTimerRef = useRef(null);
  const bubbleTimerRef = useRef(null);
  const processingRef = useRef(false);

  const dragRef = useRef(null);
  const suppressToggleRef = useRef(false);
  const desktopPositionRef = useRef(desktopPosition);

  /*
   * O resetWake vem do hook, mas handleWakeWord precisa existir
   * antes da chamada do hook.
   *
   * Usamos uma ref para quebrar essa dependência circular.
   */
  const resetWakeRef = useRef(() => { });

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT);

    const syncViewport = () => {
      setIsDesktop(mediaQuery.matches);
    };

    syncViewport();

    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  const dismissBubble = useCallback(() => {
    window.clearTimeout(bubbleTimerRef.current);

    setBubble(null);

    if (!processingRef.current && !awaitingCommandRef.current) {
      setState("listening");
    }
  }, []);

  const showBubble = useCallback(
    (message, type = "info") => {
      const normalizedMessage = String(message || "Estou aqui.").trim();

      window.clearTimeout(bubbleTimerRef.current);

      setBubble({
        message: normalizedMessage,
        type,
      });

      setHistory((current) =>
        [
          ...current,
          {
            message: normalizedMessage,
            type,
            at: Date.now(),
          },
        ].slice(-5)
      );

      bubbleTimerRef.current = window.setTimeout(
        dismissBubble,
        bubbleDuration(normalizedMessage)
      );
    },
    [dismissBubble]
  );

  const answer = useCallback(
    (message, type = "info") => {
      const normalizedMessage = String(
        message || "Não consegui concluir esse comando agora."
      ).trim();

      showBubble(normalizedMessage, type);

      setState(type === "error" ? "error" : "responding");
    },
    [showBubble]
  );

  /*
   * Envia o comando para o backend.
   *
   * O backend continua responsável por:
   * - classificar a intent;
   * - extrair entidades;
   * - executar o handler;
   * - retornar mensagem/action.
   */
  const processCommand = useCallback(
    async (transcript) => {
      const command = normalizeTimoTranscript(transcript);

      if (!command || processingRef.current) {
        return;
      }

      processingRef.current = true;
      awaitingCommandRef.current = false;

      window.clearTimeout(wakeTimerRef.current);

      setState("processing");

      try {
        const { data } = await connect.post("/timo/process", {text:command });

        if (data?.action?.type === "navigate" && data.action.path) {
          navigate(data.action.path);
        }

        const unknownCommand = data?.success === false;

        answer(
          data?.message || "Comando concluído.",
          unknownCommand ? "warning" : "success"
        );

        if (unknownCommand) {
          setState("unknown");
        }
      } catch (error) {
        answer(
          error.response?.data?.message ||
          error.response?.data ||
          "Não consegui fazer isso agora.",
          "error"
        );
      } finally {
        processingRef.current = false;
        awaitingCommandRef.current = false;

        window.clearTimeout(wakeTimerRef.current);

        resetWakeRef.current();
      }
    },
    [answer, navigate]
  );

  /*
   * É chamado imediatamente pelo hook quando uma das wake words
   * aparece em qualquer resultado INTERIM ou FINAL.
   *
   * Portanto, não esperamos mais o SpeechRecognition finalizar
   * "Timo" para acordar o avatar.
   */
  const handleWakeWord = useCallback(
    () => {
      if (processingRef.current || awaitingCommandRef.current) {
        return;
      }

      awaitingCommandRef.current = true;

      setState("wake");

      showBubble("Estou ouvindo. Pode falar.");

      window.clearTimeout(wakeTimerRef.current);

      wakeTimerRef.current = window.setTimeout(() => {
        awaitingCommandRef.current = false;

        resetWakeRef.current();

        if (!processingRef.current) {
          setState("listening");
        }
      }, WAKE_TIMEOUT);

      /*
       * A wake word pode ser detectada em um resultado parcial. O comando só
       * é enviado quando o navegador confirmar o resultado final; enviar o
       * texto parcial fazia o Timo processar "quantas faltas" antes da frase
       * terminar e, depois, ignorar o restante por já estar processando.
       */
    },
    [showBubble]
  );

  /*
   * Resultado FINAL da fala.
   *
   * Só será tratado como comando se o Timo já tiver sido acordado.
   */
  const handleFinalTranscript = useCallback(
    (transcript) => {
      if (!awaitingCommandRef.current || processingRef.current) {
        return;
      }

      const normalized = normalizeTimoTranscript(transcript);

      if (!normalized) {
        return;
      }

      /*
       * Existem dois cenários.
       *
       * 1:
       * Interim detectou "Timo".
       * Final chegou como:
       *
       * "Timo quantas faltas tivemos hoje"
       *
       * Nesse caso removemos a wake word.
       *
       * 2:
       * Final chegou apenas como:
       *
       * "quantas faltas tivemos hoje"
       *
       * Nesse caso commandAfterWakeWord retorna null
       * e usamos o transcript inteiro.
       */
      const commandAfterWake = commandAfterWakeWord(normalized);

      const command =
        commandAfterWake === null
          ? normalized
          : commandAfterWake;

      /*
       * Pode acontecer do resultado final ser apenas:
       *
       * "Timo"
       *
       * Nesse caso não executamos nada.
       * Continuamos aguardando a próxima fala.
       */
      if (!command) {
        return;
      }

      processCommand(command);
    },
    [processCommand]
  );

  const handleRecognitionState = useCallback(
    (nextState) => {
      if (!processingRef.current && !awaitingCommandRef.current && !bubble) {
        setState(nextState);
      }
    },
    [bubble]
  );

  const handleRecognitionError = useCallback(
    (message, nextState = "error") => {
      if (bubble) {
        return;
      }

      answer(
        message,
        nextState === "disabled" ? "warning" : "error"
      );

      setState(nextState);
    },
    [answer, bubble]
  );

  const {
    available,
    enabled,
    start,
    stop,
    resetWake,
  } = useTimoSpeechRecognition({
    onWakeWord: handleWakeWord,
    onFinalTranscript: handleFinalTranscript,
    onStateChange: handleRecognitionState,
    onError: handleRecognitionError,
  });

  /*
   * Mantém a versão atual de resetWake disponível
   * para callbacks declarados antes da chamada do hook.
   */
  resetWakeRef.current = resetWake;

  useEffect(() => {
    return () => {
      window.clearTimeout(wakeTimerRef.current);
      window.clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  /*
   * ========================================
   * Drag do Timo
   * ========================================
   */

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      suppressToggleRef.current = true;
      setIsDragging(true);
    }

    if (!suppressToggleRef.current) {
      return;
    }

    const margin = 12;

    const nextPosition = {
      left: clamp(
        drag.left + deltaX,
        margin,
        window.innerWidth - drag.width - margin
      ),

      bottom: clamp(
        drag.bottom - deltaY,
        margin,
        window.innerHeight - drag.height - margin
      ),
    };

    desktopPositionRef.current = nextPosition;

    setDesktopPosition(nextPosition);
  }, []);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    dragRef.current = null;

    window.removeEventListener("pointermove", handlePointerMove);

    if (suppressToggleRef.current) {
      localStorage.setItem(
        DESKTOP_POSITION_KEY,
        JSON.stringify(desktopPositionRef.current)
      );

      window.setTimeout(() => {
        suppressToggleRef.current = false;
      }, 0);
    }

    setIsDragging(false);
    setDragReaction(null);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback(
    (event) => {
      if (!isDesktop || event.button !== 0) {
        return;
      }

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

      setDragReaction(
        DRAG_REACTIONS[
        Math.floor(Math.random() * DRAG_REACTIONS.length)
        ]
      );

      window.addEventListener("pointermove", handlePointerMove);

      window.addEventListener("pointerup", finishDrag, {
        once: true,
      });
    },
    [finishDrag, handlePointerMove, isDesktop]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
    };
  }, [finishDrag, handlePointerMove]);

  /*
   * ========================================
   * Liga / desliga escuta
   * ========================================
   */

  const toggle = () => {
    if (suppressToggleRef.current) {
      return;
    }

    if (!available) {
      answer(
        "Seu navegador não oferece reconhecimento de fala.",
        "warning"
      );

      setState("disabled");

      return;
    }

    if (enabled) {
      setManualDisabled(true);

      awaitingCommandRef.current = false;

      window.clearTimeout(wakeTimerRef.current);
      window.clearTimeout(bubbleTimerRef.current);

      resetWakeRef.current();

      stop();

      setBubble(null);

      return;
    }

    setManualDisabled(false);

    resetWakeRef.current();

    start();
  };

  return (
    <div
      className={`timo-assistant ${isDragging ? "is-dragging" : ""}`}
      data-history-count={history.length}
      style={
        isDesktop
          ? {
            "--timo-left": `${desktopPosition.left}px`,
            "--timo-bottom": `${desktopPosition.bottom}px`,
          }
          : undefined
      }
      onPointerDown={handlePointerDown}
    >
      <TimoBubble
        message={bubble?.message}
        type={bubble?.type}
        onClose={dismissBubble}
      />

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
