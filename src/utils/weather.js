const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_API_URL =
  'https://air-quality-api.open-meteo.com/v1/air-quality';

const DEFAULT_CACHE_TTL = 15 * 60 * 1000;
const CACHE_PREFIX = 'tmhub:weather';

export class WeatherError extends Error {
  constructor(message, code = 'WEATHER_ERROR', cause) {
    super(message, { cause });
    this.name = 'WeatherError';
    this.code = code;
  }
}

export const WEATHER_CODES = {
  0: { label: 'Céu limpo', icon: 'sun' },
  1: { label: 'Predominantemente limpo', icon: 'sun' },
  2: { label: 'Parcialmente nublado', icon: 'cloud-sun' },
  3: { label: 'Nublado', icon: 'cloud' },

  45: { label: 'Nevoeiro', icon: 'cloud-fog' },
  48: { label: 'Nevoeiro com geada', icon: 'cloud-fog' },

  51: { label: 'Garoa leve', icon: 'cloud-drizzle' },
  53: { label: 'Garoa moderada', icon: 'cloud-drizzle' },
  55: { label: 'Garoa intensa', icon: 'cloud-drizzle' },
  56: { label: 'Garoa congelante leve', icon: 'cloud-drizzle' },
  57: { label: 'Garoa congelante intensa', icon: 'cloud-drizzle' },

  61: { label: 'Chuva leve', icon: 'cloud-rain' },
  63: { label: 'Chuva moderada', icon: 'cloud-rain' },
  65: { label: 'Chuva forte', icon: 'cloud-rain' },
  66: { label: 'Chuva congelante leve', icon: 'cloud-rain' },
  67: { label: 'Chuva congelante forte', icon: 'cloud-rain' },

  71: { label: 'Neve leve', icon: 'snowflake' },
  73: { label: 'Neve moderada', icon: 'snowflake' },
  75: { label: 'Neve forte', icon: 'snowflake' },
  77: { label: 'Grãos de neve', icon: 'snowflake' },

  80: { label: 'Pancadas de chuva leves', icon: 'cloud-rain-wind' },
  81: { label: 'Pancadas de chuva moderadas', icon: 'cloud-rain-wind' },
  82: { label: 'Pancadas de chuva fortes', icon: 'cloud-rain-wind' },

  85: { label: 'Pancadas de neve leves', icon: 'snowflake' },
  86: { label: 'Pancadas de neve fortes', icon: 'snowflake' },

  95: { label: 'Trovoada', icon: 'cloud-lightning' },
  96: { label: 'Trovoada com granizo leve', icon: 'cloud-lightning' },
  99: { label: 'Trovoada com granizo forte', icon: 'cloud-lightning' },
};

export function getWeatherTheme(code, isDay = true) {
  // Mapeia códigos meteorológicos no tema visual usado pelo widget.
  const time = isDay ? 'day' : 'night';

  if ([95, 96, 99].includes(code)) {
    return {
      type: 'storm',
      time,
      key: `storm-${time}`,
    };
  }

  if (
    [
      51,
      53,
      55,
      56,
      57,
      61,
      63,
      65,
      66,
      67,
      80,
      81,
      82,
    ].includes(code)
  ) {
    return {
      type: 'rain',
      time,
      key: `rain-${time}`,
    };
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return {
      type: 'snow',
      time,
      key: `snow-${time}`,
    };
  }

  if ([45, 48].includes(code)) {
    return {
      type: 'fog',
      time,
      key: `fog-${time}`,
    };
  }

  if ([2, 3].includes(code)) {
    return {
      type: 'cloudy',
      time,
      key: `cloudy-${time}`,
    };
  }

  return {
    type: 'clear',
    time,
    key: `clear-${time}`,
  };
}

export function getBrowserTimezone() {
  // Usa o fuso do navegador para alinhar consultas e horários exibidos.
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getWeatherCondition(code) {
  return (
    WEATHER_CODES[code] ?? {
      label: 'Condição indisponível',
      icon: 'cloud',
    }
  );
}

export function getAqiStatus(aqi) {
  // Traduz o índice de qualidade do ar para rótulo e severidade da interface.
  if (!Number.isFinite(aqi)) {
    return {
      label: 'Indisponível',
      level: 'unknown',
    };
  }

  if (aqi <= 20) {
    return {
      label: 'Excelente',
      level: 'excellent',
    };
  }

  if (aqi <= 40) {
    return {
      label: 'Boa',
      level: 'good',
    };
  }

  if (aqi <= 60) {
    return {
      label: 'Moderada',
      level: 'moderate',
    };
  }

  if (aqi <= 80) {
    return {
      label: 'Ruim',
      level: 'poor',
    };
  }

  if (aqi <= 100) {
    return {
      label: 'Muito ruim',
      level: 'very-poor',
    };
  }

  return {
    label: 'Extremamente ruim',
    level: 'extreme',
  };
}

export function getCurrentCoordinates(options = {}) {
  // Encapsula a geolocalização com limites adequados para consultas meteorológicas.
  const {
    enableHighAccuracy = false,
    timeout = 10000,
    maximumAge = DEFAULT_CACHE_TTL,
  } = options;

  if (!globalThis.navigator?.geolocation) {
    return Promise.reject(
      new WeatherError(
        'Geolocalização não suportada neste navegador.',
        'GEOLOCATION_UNAVAILABLE',
      ),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      },

      (error) => {
        const codes = {
          1: 'GEOLOCATION_DENIED',
          2: 'GEOLOCATION_UNAVAILABLE',
          3: 'GEOLOCATION_TIMEOUT',
        };

        reject(
          new WeatherError(
            error.message || 'Não foi possível obter sua localização.',
            codes[error.code] || 'GEOLOCATION_ERROR',
            error,
          ),
        );
      },

      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      },
    );
  });
}

function buildUrl(baseUrl, params) {
  // Ignora parâmetros vazios antes de montar a URL da API externa.
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      url.searchParams.set(
        key,
        Array.isArray(value) ? value.join(',') : String(value),
      );
    }
  });

  return url.toString();
}

function getCacheKey(latitude, longitude) {
  return [
    CACHE_PREFIX,
    latitude.toFixed(3),
    longitude.toFixed(3),
  ].join(':');
}

function readCache(key, ttl) {
  // Reutiliza uma resposta recente para reduzir chamadas e manter o widget ágil.
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (Date.now() - parsed.savedAt > ttl) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  // Continua funcionando mesmo quando o armazenamento local está indisponível.
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      }),
    );
  } catch {
    // Continua funcionando caso o localStorage esteja indisponível.
  }
}

async function requestJson(url, signal) {
  const response = await fetch(url, {
    signal,
  });

  if (!response.ok) {
    throw new WeatherError(
      `A API de clima respondeu com HTTP ${response.status}.`,
      'WEATHER_API_ERROR',
    );
  }

  return response.json();
}

export async function fetchWeatherByCoordinates({
  latitude,
  longitude,
  timezone = 'auto',
  signal,
  cache = true,
  cacheTtl = DEFAULT_CACHE_TTL,
} = {}) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new WeatherError(
      'Latitude e longitude válidas são obrigatórias.',
      'INVALID_COORDINATES',
    );
  }

  const cacheKey = getCacheKey(latitude, longitude);

  const cached = cache
    ? readCache(cacheKey, cacheTtl)
    : null;

  if (cached) {
    return cached;
  }

  const weatherUrl = buildUrl(WEATHER_API_URL, {
    latitude,
    longitude,
    timezone,
    forecast_days: 1,

    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'weather_code',
      'wind_speed_10m',
      'surface_pressure',
      'is_day',
    ],

    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
    ],
  });

  const airQualityUrl = buildUrl(AIR_QUALITY_API_URL, {
    latitude,
    longitude,
    timezone,
    current: ['european_aqi'],
  });

  try {
    const [weather, airQuality] = await Promise.all([
      requestJson(weatherUrl, signal),

      requestJson(airQualityUrl, signal).catch(() => null),
    ]);

    const current = weather.current ?? {};
    const code = current.weather_code;
    const condition = getWeatherCondition(code);

    const aqi =
      airQuality?.current?.european_aqi ?? null;

    const isDay = current.is_day === 1;

    const normalized = {
      coordinates: {
        latitude,
        longitude,
      },

      timezone:
        weather.timezone ?? getBrowserTimezone(),

      timezoneAbbreviation:
        weather.timezone_abbreviation ?? null,

      updatedAt:
        current.time ?? new Date().toISOString(),

      temperature:
        current.temperature_2m ?? null,

      apparentTemperature:
        current.apparent_temperature ?? null,

      humidity:
        current.relative_humidity_2m ?? null,

      windSpeed:
        current.wind_speed_10m ?? null,

      pressure:
        current.surface_pressure ?? null,

      weatherCode:
        code ?? null,

      condition:
        condition.label,

      icon:
        condition.icon,

      isDay,

      theme:
        getWeatherTheme(code, isDay),

      aqi,

      aqiStatus:
        getAqiStatus(aqi),

      today: {
        maxTemperature:
          weather.daily?.temperature_2m_max?.[0] ?? null,

        minTemperature:
          weather.daily?.temperature_2m_min?.[0] ?? null,

        precipitationProbability:
          weather.daily?.precipitation_probability_max?.[0] ?? null,
      },

      units: {
        temperature:
          weather.current_units?.temperature_2m ?? '°C',

        humidity:
          weather.current_units?.relative_humidity_2m ?? '%',

        windSpeed:
          weather.current_units?.wind_speed_10m ?? 'km/h',

        pressure:
          weather.current_units?.surface_pressure ?? 'hPa',
      },
    };

    if (cache) {
      writeCache(cacheKey, normalized);
    }

    return normalized;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }

    if (error instanceof WeatherError) {
      throw error;
    }

    throw new WeatherError(
      'Não foi possível carregar o clima.',
      'WEATHER_REQUEST_FAILED',
      error,
    );
  }
}

export async function getWeather({
  latitude,
  longitude,
  fallbackCoordinates,
  useGeolocation =
    latitude == null || longitude == null,
  ...options
} = {}) {
  let coordinates = {
    latitude,
    longitude,
  };

  const hasValidCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  if (!hasValidCoordinates) {
    if (useGeolocation) {
      try {
        coordinates =
          await getCurrentCoordinates();
      } catch (error) {
        if (!fallbackCoordinates) {
          throw error;
        }

        coordinates =
          fallbackCoordinates;
      }
    } else if (fallbackCoordinates) {
      coordinates =
        fallbackCoordinates;
    }
  }

  return fetchWeatherByCoordinates({
    ...coordinates,
    ...options,
  });
}