const WAKE_WORDS = [
  "timo",
  "timo bot",
  "timo club",
  // Transcrições comuns do navegador para "Timo".
  // Não usar fragmentos como "mo" ou "ino": eles acordavam o assistente
  // no meio de palavras normais e deixavam o próximo comando inconsistente.
  "te amo",
  "time",
  "tino"
];

export function normalizeTimoTranscript(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SORTED_WAKE_WORDS = [...new Set(WAKE_WORDS.map(normalizeTimoTranscript) )]
.sort(
  (a, b) => b.length - a.length
);

export function findWakeWord(transcript) {
  const normalized =
    normalizeTimoTranscript(transcript);

  if (!normalized) {
    return null;
  }

  for (const wakeWord of SORTED_WAKE_WORDS) {
    const escaped = wakeWord.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const expression = new RegExp(
      `(^|\\s)${escaped}(?=\\s|$)`
    );

    if (expression.test(normalized)) {
      return wakeWord;
    }
  }

  return null;
}

export function commandAfterWakeWord(transcript) {
  const normalized = normalizeTimoTranscript(transcript);
  const wakeWord = findWakeWord(normalized);
  if (!wakeWord) { return null; }

  const escaped = wakeWord.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  return normalized
    .replace(new RegExp(
        `(^|\\s)${escaped}(?=\\s|$)`
      ),
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}
