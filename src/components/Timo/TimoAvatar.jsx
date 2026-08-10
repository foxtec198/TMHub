const STATE_LABELS = {
  idle: "Timo aguardando",
  listening: "Timo ouvindo passivamente",
  wake: "Timo foi chamado",
  processing: "Timo processando o comando",
  responding: "Timo respondeu visualmente",
  disabled: "Timo desativado",
  error: "Timo indisponível",
  unknown: "Timo não entendeu o comando",
};

function visorSymbol(state, manualDisabled) {
  if (manualDisabled) return "×";
  if (state === "unknown") return "?";
  if (state === "disabled" || state === "error") return "!";
  if (state === "idle" || state === "listening" || state === "processing") return "…";
  return "";
}

function TimoIllustration() {
  return (
    <svg className="timo-avatar-svg" viewBox="0 0 82 104" aria-hidden="true">
      <defs>
        <linearGradient id="timo-arm-gradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f9f9f9" />
          <stop offset="1" stopColor="#c9c9c9" />
        </linearGradient>
        <linearGradient id="timo-body-gradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fafafa" />
          <stop offset="1" stopColor="#c5c5c5" />
        </linearGradient>
      </defs>
      <ellipse className="timo-shadow" cx="41" cy="96" rx="11" ry="2.2" />
      <path className="timo-arm timo-arm-left" fill="url(#timo-arm-gradient)" d="M24.9 33c.77 5.07-5.2 20.66-5.2 20.66-.47 4.13-2.49 7.65-2.49 7.65C9.78 67.96 8.07 59.39 8.06 57.76 8.02 52.9 12.3 30.39 24.9 33Z" />
      <path className="timo-arm timo-arm-right" fill="url(#timo-arm-gradient)" d="M58.51 33c-.77 5.07 5.2 20.66 5.2 20.66.47 4.13 2.49 7.65 2.49 7.65 7.43 6.61 9.14-1.95 9.16-3.59.04-4.86-4.24-27.36-16.84-24.72Z" />
      <path className="timo-body" fill="url(#timo-body-gradient)" d="M64.46 40.02c0 9.25-8.31 38.56-23.31 38.46-14.98-.09-22.8-29.46-22.8-38.72 0-9.25 13.8-16.5 23.05-16.5 9.25 0 23.05 7.5 23.05 16.75Z" />
      <path className="timo-head" fill="url(#timo-body-gradient)" d="M58.1 26.45c0 10.73-11.32 4.89-17.23 4.83-5.87-.06-17.04 5.6-17.04-5.13C23.84 15.42 34.09 7.02 40.96 7.02c6.88 0 17.13 8.7 17.13 19.43Z" />
      <path className="timo-screen" fill="#1c3f54" d="M53.86 22.15c0 7.03-7.97 6.64-12.76 6.62-4.84-.02-12.84.22-12.84-6.81 0-7.03 7.66-8.86 12.8-8.86 5.14 0 12.8 2.02 12.8 9.05Z" />
      <text className="timo-mark" x="35" y="58" textAnchor="middle">T</text>
    </svg>
  );
}

export function TimoAvatar({ state, enabled, manualDisabled, onToggle }) {
  const isActive = enabled && state !== "disabled";
  const symbol = visorSymbol(state, manualDisabled);

  return (
    <button
      type="button"
      className={`timo-avatar timo-avatar--${state} ${isActive ? "is-active" : ""}`}
      onClick={onToggle}
      aria-label={isActive ? "Pausar escuta do Timo" : "Ativar escuta do Timo"}
      title={STATE_LABELS[state] || "Timo"}
    >
      <span className="timo-avatar-halo" aria-hidden="true" />
      <TimoIllustration />
      {symbol ? <span className={`timo-avatar-visor timo-avatar-visor--${state}`} aria-hidden="true">{symbol}</span> : null}
      {state === "processing" ? <span className="timo-avatar-dots" aria-label="Processando"><i /><i /><i /></span> : null}
      {state === "listening" ? <span className="timo-avatar-microphone" aria-hidden="true"><i className="pi pi-microphone" /></span> : null}
    </button>
  );
}
