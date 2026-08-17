// React
import { useEffect, useMemo, useState } from "react";
// Mapa
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Traduz os eventos de geolocalização para os rótulos exibidos no mapa.
const EVENT_LABELS = {
  inicio: "Início",
  execucao: "Durante a execução",
  finalizacao: "Finalização",
};

function formatCapturedAt(value) {
  // Mantém um texto seguro quando a API não informa um horário válido.
  if (!value) return "Horário não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Horário não informado"
    : date.toLocaleString("pt-BR");
}

function MapViewport({ positions }) {
  const map = useMap();

  useEffect(() => {
    // Ajusta o enquadramento ao ponto único ou ao percurso completo da tarefa.
    if (positions.length === 1) {
      map.setView(positions[0], 19, { animate: false });
      return;
    }
    map.fitBounds(positions, { padding: [18, 18], maxZoom: 19, animate: false });
  }, [map, positions]);

  return null;
}

export function TaskGeolocationMap({ geolocations = [] }) {
  const [darkMode, setDarkMode] = useState(
    () => document.documentElement.dataset.mode === "dark",
  );

  useEffect(() => {
    // Observa o tema global para trocar a camada do mapa sem recarregar a página.
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setDarkMode(root.dataset.mode === "dark");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-mode"] });
    return () => observer.disconnect();
  }, []);

  const points = useMemo(
    // Descarta coordenadas inválidas antes de enviá-las ao Leaflet.
    () =>
      geolocations
        .filter(
          (location) =>
            Number.isFinite(Number(location.latitude)) &&
            Number.isFinite(Number(location.longitude)),
        )
        .map((location) => ({
          ...location,
          position: [Number(location.latitude), Number(location.longitude)],
        })),
    [geolocations],
  );
  const positions = useMemo(
    // Evita recriar a lista de posições enquanto os pontos não forem alterados.
    () => points.map((point) => point.position),
    [points],
  );

  if (!points.length) return null;

  const tileTheme = darkMode ? "dark_all" : "light_all";
  return (
    <section className="tm-ops-geolocation-map" aria-label="Percurso da tarefa">
      <header>
        <div>
          <span>Geolocalização</span>
          <strong>Percurso registrado</strong>
        </div>
        <small>{points.length} ponto{points.length === 1 ? "" : "s"}</small>
      </header>
      <MapContainer
        className="tm-ops-geolocation-map__canvas"
        center={positions[0]}
        zoom={19}
        minZoom={3}
        maxZoom={20}
        zoomSnap={0.5}
        zoomDelta={0.5}
        scrollWheelZoom
        wheelPxPerZoomLevel={80}
        doubleClickZoom
        attributionControl
      >
        <TileLayer
          key={tileTheme}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
          url={`https://{s}.basemaps.cartocdn.com/${tileTheme}/{z}/{x}/{y}{r}.png`}
        />
        <MapViewport positions={positions} />
        {positions.length > 1 && (
          <Polyline positions={positions} pathOptions={{ color: "#0b8244", weight: 5, opacity: 0.8 }} />
        )}
        {points.map((point, index) => {
          const isStart = index === 0;
          const isEnd = index === points.length - 1;
          return (
            <CircleMarker
              center={point.position}
              key={point.id || `${point.capturada_em}-${index}`}
              radius={isStart || isEnd ? 8 : 5}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: isStart ? "#168b4f" : isEnd ? "#d64545" : "#efad14",
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <strong>{EVENT_LABELS[point.tipo] || "Posição registrada"}</strong>
                <br />
                {formatCapturedAt(point.capturada_em)}
                {point.precisao_metros ? ` · precisão ${Math.round(point.precisao_metros)} m` : ""}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="tm-ops-geolocation-map__legend">
        <span><i className="is-start" />Início</span>
        <span><i className="is-route" />Percurso</span>
        <span><i className="is-end" />Finalização</span>
      </div>
    </section>
  );
}
