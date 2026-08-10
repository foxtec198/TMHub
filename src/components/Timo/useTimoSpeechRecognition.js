import { useCallback, useEffect, useRef, useState } from "react";

const BLOCKING_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "not-found",
]);

const ERROR_MESSAGES = {
  "not-allowed": "Libere o acesso ao microfone para usar o Timo.",
  "service-not-allowed": "O reconhecimento de voz não está liberado neste navegador.",
  "audio-capture": "Não encontrei um microfone disponível.",
  "not-found": "Não encontrei um microfone disponível.",
  network: "A conexão com o reconhecimento de voz falhou. Vou tentar novamente.",
};

function browserRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useTimoSpeechRecognition({ onFinalTranscript, onStateChange, onError }) {
  const recognitionRef = useRef(null);
  const enabledRef = useRef(true);
  const runningRef = useRef(false);
  const restartTimerRef = useRef(null);
  const callbackRef = useRef({ onFinalTranscript, onStateChange, onError });
  const [available] = useState(() => typeof window !== "undefined" && Boolean(browserRecognition()));
  const [enabled, setEnabled] = useState(() => typeof window !== "undefined" && Boolean(browserRecognition()));

  useEffect(() => {
    callbackRef.current = { onFinalTranscript, onStateChange, onError };
  }, [onError, onFinalTranscript, onStateChange]);

  const clearRestart = useCallback(() => {
    window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }, []);

  const scheduleRestart = useCallback((delay = 450) => {
    clearRestart();
    if (!enabledRef.current || !recognitionRef.current) return;
    restartTimerRef.current = window.setTimeout(() => {
      if (!enabledRef.current || runningRef.current) return;
      try {
        recognitionRef.current.start();
      } catch (error) {
        if (error?.name !== "InvalidStateError") {
          callbackRef.current.onError?.("Não consegui reiniciar a escuta do Timo.");
        }
      }
    }, delay);
  }, [clearRestart]);

  const stop = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    clearRestart();
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.abort();
    runningRef.current = false;
    callbackRef.current.onStateChange?.("disabled");
  }, [clearRestart]);

  const beginListening = useCallback(() => {
    if (!available) {
      callbackRef.current.onError?.("Seu navegador não oferece reconhecimento de fala.");
      callbackRef.current.onStateChange?.("disabled");
      return;
    }

    enabledRef.current = true;
    if (!recognitionRef.current) {
      const Recognition = browserRecognition();
      const recognition = new Recognition();
      recognition.lang = "pt-BR";
      // Mantém uma única sessão aberta. O restart abaixo fica apenas como
      // contingência para browsers que encerram a engine por conta própria.
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        runningRef.current = true;
        callbackRef.current.onStateChange?.("listening");
      };

      recognition.onresult = (event) => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) {
            callbackRef.current.onFinalTranscript?.(result[0]?.transcript || "");
          }
        }
      };

      recognition.onerror = (event) => {
        const code = event?.error || "unknown";
        if (code === "no-speech" || code === "aborted") return;
        if (BLOCKING_ERRORS.has(code)) {
          enabledRef.current = false;
          setEnabled(false);
          callbackRef.current.onStateChange?.("disabled");
          callbackRef.current.onError?.(
            ERROR_MESSAGES[code] || "Não foi possível acessar o microfone.",
            "disabled",
          );
          return;
        }
        callbackRef.current.onError?.(
          ERROR_MESSAGES[code] || "O reconhecimento de voz falhou. Vou tentar novamente.",
          "error",
        );
      };

      recognition.onend = () => {
        runningRef.current = false;
        if (enabledRef.current) scheduleRestart();
      };

      recognitionRef.current = recognition;
    }

    scheduleRestart(0);
  }, [available, scheduleRestart]);

  const start = useCallback(() => {
    setEnabled(true);
    beginListening();
  }, [beginListening]);

  useEffect(() => {
    beginListening();
    return () => {
      enabledRef.current = false;
      clearRestart();
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onend = null;
        recognition.abort();
      }
      runningRef.current = false;
    };
  }, [beginListening, clearRestart]);

  return { available, enabled, start, stop };
}
