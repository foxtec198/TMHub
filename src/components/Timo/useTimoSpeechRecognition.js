import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import {
  commandAfterWakeWord,
  findWakeWord,
  normalizeTimoTranscript
} from "./wakeWords";


const BLOCKING_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "not-found",
]);


const ERROR_MESSAGES = {
  "not-allowed":
    "Libere o acesso ao microfone para usar o Timo.",

  "service-not-allowed":
    "O reconhecimento de voz não está liberado neste navegador.",

  "audio-capture":
    "Não encontrei um microfone disponível.",

  "not-found":
    "Não encontrei um microfone disponível.",

  network:
    "A conexão com o reconhecimento de voz falhou.",
};


/*
 * Evita que o mesmo "Timo"
 * apareça em vários interim results
 * e acorde o assistente várias vezes.
 */
const WAKE_COOLDOWN = 900;


/*
 * Restart pequeno.
 *
 * Não deixa 450ms de buraco
 * entre uma sessão e outra.
 */
const RESTART_DELAY = 80;


function browserRecognition() {
  return (
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    null
  );
}


export function useTimoSpeechRecognition({
  onWakeWord,
  onFinalTranscript,
  onStateChange,
  onError
}) {

  const recognitionRef =
    useRef(null);

  const enabledRef =
    useRef(true);

  const runningRef =
    useRef(false);

  const restartTimerRef =
    useRef(null);

  const lastWakeRef =
    useRef(0);

  const awakeRef =
    useRef(false);


  const callbackRef =
    useRef({
      onWakeWord,
      onFinalTranscript,
      onStateChange,
      onError
    });


  const [available] =
    useState(() => {

      if (
        typeof window ===
        "undefined"
      ) {
        return false;
      }

      return Boolean(
        browserRecognition()
      );

    });


  const [enabled, setEnabled] =
    useState(() => {

      if (
        typeof window ===
        "undefined"
      ) {
        return false;
      }

      return Boolean(
        browserRecognition()
      );

    });


  /*
   * Atualiza callbacks sem recriar
   * SpeechRecognition.
   */
  useEffect(() => {

    callbackRef.current = {
      onWakeWord,
      onFinalTranscript,
      onStateChange,
      onError
    };

  }, [
    onWakeWord,
    onFinalTranscript,
    onStateChange,
    onError
  ]);


  const clearRestart =
    useCallback(() => {

      window.clearTimeout(
        restartTimerRef.current
      );

      restartTimerRef.current =
        null;

    }, []);


  const scheduleRestart =
    useCallback(
      (delay = RESTART_DELAY) => {

        clearRestart();


        if (
          !enabledRef.current ||
          !recognitionRef.current
        ) {
          return;
        }


        restartTimerRef.current =
          window.setTimeout(() => {

            if (
              !enabledRef.current ||
              runningRef.current
            ) {
              return;
            }


            try {

              recognitionRef.current
                .start();

            } catch (error) {

              /*
               * Chrome lança isso
               * se já estiver iniciando.
               */
              if (
                error?.name !==
                "InvalidStateError"
              ) {

                callbackRef.current
                  .onError?.(
                    "Não consegui reiniciar a escuta do Timo."
                  );

              }
            }

          }, delay);

      },
      [clearRestart]
    );


  /*
   * Chamado pelo TimoAssistant
   * depois que terminou de responder
   * ou quando timeout da wake acabar.
   */
  const resetWake =
    useCallback(() => {

      awakeRef.current =
        false;

      lastWakeRef.current =
        0;

    }, []);


  const stop =
    useCallback(() => {

      enabledRef.current =
        false;

      awakeRef.current =
        false;

      setEnabled(false);

      clearRestart();


      const recognition =
        recognitionRef.current;


      if (recognition) {

        try {

          recognition.abort();

        } catch {
          //
        }

      }


      runningRef.current =
        false;


      callbackRef.current
        .onStateChange?.(
          "disabled"
        );

    }, [clearRestart]);


  const detectWakeWord =
    useCallback(
      (result) => {

        /*
         * Se o Timo já acordou,
         * não precisamos continuar
         * caçando wake word.
         */
        if (awakeRef.current) {
          return false;
        }


        const now =
          Date.now();


        if (
          now -
          lastWakeRef.current <
          WAKE_COOLDOWN
        ) {
          return false;
        }


        /*
         * IMPORTANTÍSSIMO:
         *
         * testa TODAS as alternativas,
         * não somente result[0].
         */
        for (
          let alternativeIndex = 0;
          alternativeIndex <
          result.length;
          alternativeIndex += 1
        ) {

          const transcript =
            result[
              alternativeIndex
            ]?.transcript;


          if (!transcript) {
            continue;
          }


          const normalized =
            normalizeTimoTranscript(
              transcript
            );


          const wakeWord =
            findWakeWord(
              normalized
            );


          if (!wakeWord) {
            continue;
          }


          /*
           * ACHOU.
           *
           * Não interessa se
           * result.isFinal === false.
           */

          lastWakeRef.current =
            now;

          awakeRef.current =
            true;


          const inlineCommand =
            commandAfterWakeWord(
              normalized
            );


          callbackRef.current
            .onWakeWord?.(
              {
                wakeWord,
                transcript:
                  normalized,

                inlineCommand:
                  inlineCommand || "",

                final:
                  result.isFinal,

                confidence:
                  result[
                    alternativeIndex
                  ]?.confidence || 0
              }
            );


          return true;
        }


        return false;

      },
      []
    );


  const createRecognition =
    useCallback(() => {

      if (
        recognitionRef.current
      ) {
        return recognitionRef.current;
      }


      const Recognition =
        browserRecognition();


      if (!Recognition) {
        return null;
      }


      const recognition =
        new Recognition();


      recognition.lang =
        "pt-BR";


      /*
       * Mantém escuta aberta.
       */
      recognition.continuous =
        true;


      /*
       * ESSENCIAL PARA WAKE WORD.
       */
      recognition.interimResults =
        true;


      /*
       * Muito importante para "Timo".
       *
       * Às vezes:
       *
       * alternativa 0 = "time"
       * alternativa 1 = "timo"
       *
       * Se usamos apenas a primeira,
       * perdemos a wake.
       */
      recognition.maxAlternatives =
        5;


      recognition.onstart =
        () => {

          runningRef.current =
            true;


          callbackRef.current
            .onStateChange?.(
              awakeRef.current
                ? "wake"
                : "listening"
            );

        };


      recognition.onresult =
        (event) => {

          /*
           * Não fazemos console aqui.
           *
           * Essa função pode executar
           * dezenas de vezes por frase.
           */

          for (
            let index =
              event.resultIndex;

            index <
            event.results.length;

            index += 1
          ) {

            const result =
              event.results[index];


            /*
             * PRIMEIRO:
             *
             * caça wake word em qualquer
             * resultado parcial.
             */

            detectWakeWord(
              result
            );


            /*
             * SEGUNDO:
             *
             * se já acordou, resultados
             * finais passam a representar
             * possíveis comandos.
             */

            if (
              awakeRef.current &&
              result.isFinal
            ) {

              const transcript =
                result[0]?.transcript ||
                "";


              const normalized =
                normalizeTimoTranscript(
                  transcript
                );


              if (!normalized) {
                continue;
              }


              callbackRef.current
                .onFinalTranscript?.(
                  normalized
                );

            }
          }

        };


      recognition.onerror =
        (event) => {

          const code =
            event?.error ||
            "unknown";


          /*
           * Normais no funcionamento
           * contínuo.
           */
          if (
            code === "no-speech" ||
            code === "aborted"
          ) {
            return;
          }


          if (
            BLOCKING_ERRORS.has(
              code
            )
          ) {

            enabledRef.current =
              false;

            awakeRef.current =
              false;


            setEnabled(false);


            callbackRef.current
              .onStateChange?.(
                "disabled"
              );


            callbackRef.current
              .onError?.(
                ERROR_MESSAGES[
                  code
                ] ||
                "Não foi possível acessar o microfone.",

                "disabled"
              );


            return;
          }


          /*
           * Network não precisa matar
           * a escuta.
           *
           * onend vai tentar novamente.
           */
          callbackRef.current
            .onError?.(
              ERROR_MESSAGES[
                code
              ] ||
                "O reconhecimento de voz falhou.",

              "error"
            );

        };


      recognition.onend =
        () => {

          runningRef.current =
            false;


          if (
            enabledRef.current
          ) {

            scheduleRestart();

          }

        };


      recognitionRef.current =
        recognition;


      return recognition;

    },
    [
      detectWakeWord,
      scheduleRestart
    ]
  );


  const beginListening =
    useCallback(() => {

      if (!available) {

        callbackRef.current
          .onError?.(
            "Seu navegador não oferece reconhecimento de fala."
          );


        callbackRef.current
          .onStateChange?.(
            "disabled"
          );

        return;
      }


      enabledRef.current =
        true;


      setEnabled(true);


      createRecognition();


      scheduleRestart(0);

    }, [
      available,
      createRecognition,
      scheduleRestart
    ]);


  const start =
    useCallback(() => {

      beginListening();

    }, [beginListening]);


  useEffect(() => {

    beginListening();


    return () => {

      enabledRef.current =
        false;

      awakeRef.current =
        false;


      clearRestart();


      const recognition =
        recognitionRef.current;


      if (recognition) {

        recognition.onend =
          null;


        try {

          recognition.abort();

        } catch {
          //
        }

      }


      recognitionRef.current =
        null;

      runningRef.current =
        false;

    };

  }, [
    beginListening,
    clearRestart
  ]);


  return {
    available,
    enabled,

    start,
    stop,

    resetWake
  };
}