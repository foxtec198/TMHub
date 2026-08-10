import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Droplets,
  Gauge,
  LoaderCircle,
  MapPin,
  Moon,
  RefreshCw,
  Snowflake,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { getWeather } from '../utils/weather';

const ICONS = {
  sun: Sun,
  cloud: Cloud,
  'cloud-sun': CloudSun,
  'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle,
  'cloud-rain': CloudRain,
  'cloud-rain-wind': CloudRainWind,
  'cloud-lightning': CloudLightning,
  snowflake: Snowflake,
};

const formatNumber = (value, maximumFractionDigits = 0) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(value)
    : '—';

export default function WeatherWidget({
  locationName = 'Localização atual',
  latitude,
  longitude,
  fallbackCoordinates,
  useGeolocation = latitude == null || longitude == null,
  className,
  compact = false,
  refreshInterval = 15 * 60 * 1000,
  onLoaded,
  onError,
}) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function load() {
      try {
        setError(null);
        if (!weather) setLoading(true);

        const result = await getWeather({
          latitude,
          longitude,
          fallbackCoordinates,
          useGeolocation,
          signal: controller.signal,
          cache: reloadKey === 0,
        });

        if (!mounted) return;
        setWeather(result);
        onLoaded?.(result);
      } catch (loadError) {
        if (!mounted || loadError?.name === 'AbortError') return;
        setError(loadError);
        onError?.(loadError);
      } finally {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
      controller.abort();
    };
  // As callbacks não disparam uma nova consulta; o reload é controlado pelas coordenadas e pela chave.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    latitude,
    longitude,
    fallbackCoordinates?.latitude,
    fallbackCoordinates?.longitude,
    useGeolocation,
    reloadKey,
  ]);

  useEffect(() => {
    if (!refreshInterval || refreshInterval < 60000) return undefined;
    const timer = window.setInterval(
      () => setReloadKey((value) => value + 1),
      refreshInterval,
    );
    return () => window.clearInterval(timer);
  }, [refreshInterval]);

  const theme = weather?.theme ?? {
    type: 'cloudy',
    time: weather?.isDay === false ? 'night' : 'day',
    key: weather?.isDay === false ? 'cloudy-night' : 'cloudy-day',
  };

  const WeatherIcon = useMemo(() => {
    if (theme.type === 'clear' && theme.time === 'night') return Moon;
    return ICONS[weather?.icon] ?? Cloud;
  }, [weather?.icon, theme.type, theme.time]);

  function refresh() {
    setRefreshing(true);
    setReloadKey((value) => value + 1);
  }

  if (loading) {
    return (
      <Widget className={className} $compact={compact} $themeKey="cloudy-day">
        <StateBox aria-busy="true">
          <LoaderCircle className="spin" size={28} />
          <span>Carregando clima…</span>
        </StateBox>
      </Widget>
    );
  }

  if (error && !weather) {
    return (
      <Widget className={className} $compact={compact} $themeKey="cloudy-day">
        <StateBox role="alert">
          <Cloud size={30} />
          <strong>Clima indisponível</strong>
          <span>{error.message}</span>
          <RetryButton type="button" onClick={refresh}>
            <RefreshCw size={15} /> Tentar novamente
          </RetryButton>
        </StateBox>
      </Widget>
    );
  }

  return (
    <Widget
      className={className}
      $compact={compact}
      $themeKey={theme.key}
      data-weather-theme={theme.key}
    >
      <MainCard>
        <Atmosphere aria-hidden="true">
          <span className="orb" />
          <span className="cloud cloud-one" />
          <span className="cloud cloud-two" />
          <span className="rain rain-one" />
          <span className="rain rain-two" />
          <span className="rain rain-three" />
          <span className="snow snow-one">•</span>
          <span className="snow snow-two">•</span>
          <span className="snow snow-three">•</span>
          <span className="lightning" />
        </Atmosphere>

        <WeatherVisual aria-hidden="true">
          <WeatherIcon size={compact ? 58 : 76} strokeWidth={1.35} />
        </WeatherVisual>

        <MainInfo>
          <Temperature>
            {formatNumber(weather.temperature)}
            <small>{weather.units.temperature}</small>
          </Temperature>
          <Condition>{weather.condition}</Condition>
          <Location title={locationName}>
            <MapPin size={14} /> {locationName}
          </Location>
        </MainInfo>

        <RefreshButton
          type="button"
          onClick={refresh}
          disabled={refreshing}
          aria-label="Atualizar clima"
          title="Atualizar clima"
        >
          <RefreshCw className={refreshing ? 'spin' : ''} size={17} />
        </RefreshButton>
      </MainCard>

      <DetailsCard>
        <PrimaryDetails>
          <Metric>
            <Droplets size={21} />
            <span>Umidade</span>
            <strong>{formatNumber(weather.humidity)}%</strong>
          </Metric>
          <Metric>
            <Wind size={21} />
            <span>Vento</span>
            <strong>{formatNumber(weather.windSpeed)} km/h</strong>
          </Metric>
        </PrimaryDetails>

        {!compact && (
          <SecondaryDetails>
            <Metric>
              <Gauge size={19} />
              <span>AQI</span>
              <strong>{formatNumber(weather.aqi)}</strong>
            </Metric>
            <Metric>
              <Thermometer size={19} />
              <span>Sensação</span>
              <strong>{formatNumber(weather.apparentTemperature)} °C</strong>
            </Metric>
            <Metric>
              <Gauge size={19} />
              <span>Pressão</span>
              <strong>{formatNumber(weather.pressure)} hPa</strong>
            </Metric>
          </SecondaryDetails>
        )}

        <StatusBar data-level={weather.aqiStatus.level}>
          Qualidade do ar: {weather.aqiStatus.label}
        </StatusBar>
      </DetailsCard>
    </Widget>
  );
}

// Mantido para as variações meteorológicas que ainda serão reativadas no widget.
// eslint-disable-next-line no-unused-vars
const themeCss = (key) => {
  if (key === 'clear-day') return `
    --sky-start: #38bdf8;
    --sky-end: #93c5fd;
    --detail-bg: color-mix(in srgb, var(--surface-ground, #eff6ff) 75%, #bfdbfe);
    --widget-text: #082f49;
    --widget-muted: #0c4a6e;
    --widget-border: rgb(255 255 255 / 34%);
    --visual-color: #fef3c7;
    --orb-color: #fbbf24;
  `;

  if (key === 'clear-night') return `
    --sky-start: #172554;
    --sky-end: #312e81;
    --detail-bg: color-mix(in srgb, var(--surface-ground, #111827) 82%, #312e81);
    --widget-text: #f8fafc;
    --widget-muted: #cbd5e1;
    --widget-border: rgb(255 255 255 / 15%);
    --visual-color: #fde68a;
    --orb-color: #f8fafc;
  `;

  if (key.startsWith('rain-')) return `
    --sky-start: #334155;
    --sky-end: #0f172a;
    --detail-bg: color-mix(in srgb, var(--surface-ground, #111827) 84%, #334155);
    --widget-text: #f8fafc;
    --widget-muted: #cbd5e1;
    --widget-border: rgb(255 255 255 / 14%);
    --visual-color: #7dd3fc;
    --cloud-color: rgb(226 232 240 / 35%);
    --particle-color: #7dd3fc;
  `;

  if (key.startsWith('storm-')) return `
    --sky-start: #312e81;
    --sky-end: #111827;
    --detail-bg: color-mix(in srgb, var(--surface-ground, #111827) 84%, #312e81);
    --widget-text: #f8fafc;
    --widget-muted: #d8b4fe;
    --widget-border: rgb(255 255 255 / 14%);
    --visual-color: #fde047;
    --cloud-color: rgb(226 232 240 / 24%);
    --particle-color: #c4b5fd;
  `;

  if (key.startsWith('snow-')) return `
    --sky-start: #dbeafe;
    --sky-end: #f8fafc;
    --detail-bg: color-mix(in srgb, var(--surface-ground, #f8fafc) 82%, #dbeafe);
    --widget-text: #1e3a5f;
    --widget-muted: #475569;
    --widget-border: rgb(148 163 184 / 35%);
    --visual-color: #2563eb;
    --cloud-color: rgb(255 255 255 / 78%);
    --particle-color: #ffffff;
  `;

  if (key.startsWith('fog-')) return `
    --sky-start: #94a3b8;
    --sky-end: #cbd5e1;
    --detail-bg: color-mix(in srgb, var(--surface-ground, #f1f5f9) 82%, #cbd5e1);
    --widget-text: #1e293b;
    --widget-muted: #475569;
    --widget-border: rgb(255 255 255 / 26%);
    --visual-color: #e2e8f0;
    --cloud-color: rgb(255 255 255 / 46%);
  `;

  return `
    --sky-start: #64748b;
    --sky-end: #334155;
    --detail-bg: color-mix(in srgb, var(--surface-ground, #e2e8f0) 82%, #94a3b8);
    --widget-text: #f8fafc;
    --widget-muted: #e2e8f0;
    --widget-border: rgb(255 255 255 / 16%);
    --visual-color: #e2e8f0;
    --cloud-color: rgb(255 255 255 / 36%);
  `;
};

// const Widget = styled.section`
//   --weather-accent: var(--primary-color, #22c55e);
//   --sky-start: var(--surface-card, #ffffff);
//   --sky-end: var(--surface-ground, #f3f4f6);
//   --detail-bg: var(--surface-ground, #f3f4f6);
//   --widget-text: var(--text-color, #1f2937);
//   --widget-muted: var(--text-color-secondary, #64748b);
//   --widget-border: var(--surface-border, #e5e7eb);
//   --visual-color: var(--weather-accent);
//   --cloud-color: rgb(255 255 255 / 42%);
//   --particle-color: #7dd3fc;

//   ${({ $themeKey }) => themeCss($themeKey)}

//   position: relative;
//   width: min(100%, ${({ $compact }) => ($compact ? '310px' : '360px')});
//   min-height: ${({ $compact }) => ($compact ? '150px' : '185px')};
//   color: var(--widget-text);
//   isolation: isolate;

//   &[data-weather-theme^='clear-'] .cloud,
//   &[data-weather-theme^='clear-'] .rain,
//   &[data-weather-theme^='clear-'] .snow,
//   &[data-weather-theme^='clear-'] .lightning {
//     opacity: 0;
//   }

//   &[data-weather-theme^='cloudy-'] .orb,
//   &[data-weather-theme^='fog-'] .orb,
//   &[data-weather-theme^='rain-'] .orb,
//   &[data-weather-theme^='storm-'] .orb,
//   &[data-weather-theme^='snow-'] .orb {
//     opacity: 0;
//   }

//   &[data-weather-theme^='rain-'] .rain {
//     opacity: 0.9;
//   }

//   &[data-weather-theme^='storm-'] .rain,
//   &[data-weather-theme^='storm-'] .lightning {
//     opacity: 0.95;
//   }

//   &[data-weather-theme^='snow-'] .snow {
//     opacity: 0.9;
//   }

//   &[data-weather-theme^='fog-'] .cloud {
//     width: 120px;
//     height: 9px;
//     opacity: 0.42;
//     filter: blur(3px);
//   }

//   .spin {
//     animation: weather-spin 0.8s linear infinite;
//   }

//   @keyframes weather-spin {
//     to { transform: rotate(360deg); }
//   }
// `;

const Widget = styled.section`
  --weather-surface: #ffffff;
  --weather-details-surface: #f5f7f6;
  --weather-text: var(--text-primary, #272323);
  --weather-muted: var(--text-secondary, #555);
  --weather-border: #dfe7e1;
  --weather-accent: var(--accent);
  --orb-color: #fbbf24;
  --weather-shadow: 0 12px 28px rgba(16, 69, 29, 0.12);
  
  position: relative;
  width: min(100%, ${({ $compact }) => ($compact ? '310px' : '360px')});
  height: 40dvh;
  color: var(--weather-text);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  
  :root[data-mode='dark'] & {
    --weather-surface: var(--dark-surface-1, #111);
    --weather-details-surface: var(--dark-surface-2, #222);
    --weather-text: var(--text-primary, #f3f6f4);
    --weather-muted: var(--text-secondary, #a9b0ab);
    --weather-border: var(--dark-border, #304035);
    --weather-accent: var(--accent);
    --orb-color: var(--accent);
    --weather-shadow: 0 14px 36px rgba(240, 229, 229, 0.74);
  }
`;

const MainCard = styled.div`
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 92px 1fr auto;
  align-items: center;
  min-height: 130px;
  color: #fff;
  padding: 18px;
  overflow: hidden;
  border: 1px solid var(--widget-border);
  border-radius: 24px;
  // background: linear-gradient(135deg, var(--sky-start), var(--sky-end));
  background: var(--primary-color);
  box-shadow: 0 14px 35px rgb(0 0 0 / 12%);
  transition: filter 180ms ease, transform 180ms ease;

  &:hover {
    filter: saturate(1.06);
    transform: translateY(-2px);
  }
`;

const Atmosphere = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0.9;

  .orb {
    position: absolute;
    top: 18px;
    right: 48px;
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: var(--orb-color);
    box-shadow: 0 0 30px color-mix(in srgb, var(--orb-color) 55%, transparent);
  }

  .cloud {
    position: absolute;
    width: 76px;
    height: 22px;
    border-radius: 999px;
    background: var(--cloud-color);
  }

  .cloud::before,
  .cloud::after {
    content: '';
    position: absolute;
    bottom: 0;
    border-radius: 50%;
    background: inherit;
  }

  .cloud::before {
    left: 13px;
    width: 32px;
    height: 32px;
  }

  .cloud::after {
    right: 11px;
    width: 40px;
    height: 40px;
  }

  .cloud-one {
    top: 38px;
    right: 24px;
  }

  .cloud-two {
    top: 82px;
    right: -14px;
    transform: scale(0.7);
    opacity: 0.65;
  }

  .rain {
    position: absolute;
    top: 79px;
    width: 2px;
    height: 18px;
    border-radius: 99px;
    background: var(--particle-color);
    transform: rotate(14deg);
    animation: weather-rain 1s linear infinite;
    opacity: 0;
  }

  .rain-one { right: 81px; animation-delay: -0.2s; }
  .rain-two { right: 60px; animation-delay: -0.55s; }
  .rain-three { right: 39px; animation-delay: -0.8s; }

  .snow {
    position: absolute;
    top: 67px;
    color: var(--particle-color);
    font-size: 22px;
    line-height: 1;
    animation: weather-snow 2.2s linear infinite;
    opacity: 0;
  }

  .snow-one { right: 82px; animation-delay: -0.4s; }
  .snow-two { right: 58px; animation-delay: -1.2s; }
  .snow-three { right: 34px; animation-delay: -1.8s; }

  .lightning {
    position: absolute;
    top: 69px;
    right: 55px;
    width: 13px;
    height: 34px;
    background: #fde047;
    clip-path: polygon(55% 0, 100% 0, 68% 40%, 100% 40%, 25% 100%, 42% 56%, 8% 56%);
    opacity: 0;
    animation: weather-lightning 3.8s steps(1) infinite;
  }

  @keyframes weather-rain {
    0% { transform: translateY(-5px) rotate(14deg); opacity: 0; }
    25% { opacity: 0.9; }
    100% { transform: translateY(40px) rotate(14deg); opacity: 0; }
  }

  @keyframes weather-snow {
    0% { transform: translate3d(0, -5px, 0); opacity: 0; }
    20% { opacity: 0.9; }
    100% { transform: translate3d(-10px, 42px, 0); opacity: 0; }
  }

  @keyframes weather-lightning {
    0%, 86%, 91%, 100% { opacity: 0; }
    87%, 89% { opacity: 1; }
  }
`;

const WeatherVisual = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  color: var(--visual-color);
  filter: drop-shadow(0 8px 14px rgb(0 0 0 / 12%));
`;

const MainInfo = styled.div`
  position: relative;
  z-index: 1;
  min-width: 0;
`;

const Temperature = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 3px;
  font-size: clamp(2rem, 5vw, 2.65rem);
  font-weight: 700;
  line-height: 1;

  small {
    margin-top: 4px;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--widget-muted);
  }
`;

const Condition = styled.div`
  margin-top: 6px;
  font-size: 0.86rem;
  color: var(--widget-muted);
`;

const Location = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  max-width: 170px;
  margin-top: 7px;
  overflow: hidden;
  font-size: 0.75rem;
  color: var(--widget-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RefreshButton = styled.button`
  position: relative;
  z-index: 1;
  align-self: start;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--widget-border);
  border-radius: 50%;
  background: rgb(255 255 255 / 10%);
  color: var(--widget-muted);
  cursor: pointer;

  &:hover { color: var(--widget-text); }
  &:disabled { cursor: wait; opacity: 0.65; }
`;

const DetailsCard = styled.div`
  position: relative;
  z-index: 1;
  width: calc(100% - 14px);
  margin: -22px auto 0;
  padding: 38px 16px 0;
  overflow: hidden;
  border: 1px solid var(--widget-border);
  border-radius: 0 0 25px 25px;
  background: var(--bg-primary);
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: ghostwhite;

  :root[data-mode='dark'] & {
    background: linear-gradient(135deg, #111, #222);
  }
`;

const PrimaryDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding-bottom: 14px;
  `;

const SecondaryDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 14px 0;
  border-top: 1px solid var(--widget-border);
  `;

const Metric = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 7px;
  align-items: center;
  min-width: 0;
  color: var(--visual-color);

  span,
  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 0.68rem;
    color: var(--widget-muted);
  }

  strong {
    grid-column: 2;
    font-size: 0.78rem;
    color: var(--widget-text);
    
  }
`;

const StatusBar = styled.div`
  margin-inline: -16px;
  padding: 9px 14px;
  text-align: center;
  font-size: 0.74rem;
  font-weight: 700;
  color: #102015;
  background: var(--weather-accent);

  &[data-level='moderate'] { background: #facc15; }
  &[data-level='poor'] { background: #fb923c; }
  &[data-level='very-poor'],
  &[data-level='extreme'] { background: #f87171; }
  &[data-level='unknown'] {
    background: var(--widget-border);
    color: var(--widget-text);
  }
`;

const StateBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 150px;
  padding: 20px;
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 24px;
  background: var(--surface-card, #ffffff);
  color: var(--text-color, #1f2937);
  text-align: center;
  
  :root[data-mode='dark'] & {
    background: black;
    border: 1px solid var(--accent);
    color: var(--text-color, #f1f1f1);
  }

  span {
    max-width: 280px;
    font-size: 0.8rem;
    color: var(--text-color-secondary, #64748b);
  }
`;

const RetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  padding: 8px 12px;
  border: 0;
  border-radius: 10px;
  background: var(--primary-color, #22c55e);
  color: var(--primary-color-text, #ffffff);
  font-weight: 600;
  cursor: pointer;
`;
