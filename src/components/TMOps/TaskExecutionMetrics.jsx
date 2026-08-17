// Converte os valores brutos das métricas para formatos de leitura rápida.
const formatDuration = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

const formatDistance = (meters) => {
  const total = Math.max(0, Number(meters) || 0);
  if (total >= 1000) {
    return `${(total / 1000).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} km`;
  }
  return `${Math.round(total).toLocaleString("pt-BR")} m`;
};

export function TaskExecutionMetrics({ task, now }) {
  if (!task?.iniciada_em) return null;

  const calculatedAt = new Date(task.metricas_calculadas_em).getTime();
  const currentTime = Number(now) || calculatedAt;
  const liveSeconds = Number.isFinite(calculatedAt)
    ? Math.max(0, Math.floor((currentTime - calculatedAt) / 1000))
    : 0;
  const running = ["em_andamento", "pausada"].includes(task.status);
  const elapsedSeconds =
    Number(task.tempo_decorrido_segundos || 0) + (running ? liveSeconds : 0);
  const pausedSeconds =
    Number(task.tempo_pausado_segundos || 0) +
    (task.status === "pausada" ? liveSeconds : 0);

  return (
    <div className="tm-ops-execution-metrics" aria-label="Indicadores da execução">
      <div>
        <i className="pi pi-map-marker" />
        <span>Distância percorrida</span>
        <strong>{formatDistance(task.distancia_percorrida_metros)}</strong>
      </div>
      <div>
        <i className="pi pi-stopwatch" />
        <span>Tempo decorrido</span>
        <strong>{formatDuration(elapsedSeconds)}</strong>
      </div>
      <div>
        <i className="pi pi-pause-circle" />
        <span>Tempo em pausa</span>
        <strong>{formatDuration(pausedSeconds)}</strong>
      </div>
    </div>
  );
}
