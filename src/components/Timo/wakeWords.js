const WAKE_WORDS = [
  "timo", 
  "timo bot", 
  "time",
  "imo",
  "mo",
  "te amo",
  "time",
  "tino",
  "ino"
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

export function commandAfterWakeWord(transcript) {
  const normalized = normalizeTimoTranscript(transcript);
  const wakeWord = WAKE_WORDS.find((word) => {
    const expression = new RegExp(`(^|\\s)${word}(?=\\s|$)`);
    return expression.test(normalized);
  });

  if (!wakeWord) return null;

  return normalized
    .replace(new RegExp(`(^|\\s)${wakeWord}(?=\\s|$)`), " ")
    .replace(/\s+/g, " ")
    .trim();
}
