/**
 * Open-Meteo current weather for Paoli, PA. Free, no API key, CORS-friendly.
 * Docs: https://open-meteo.com/en/docs
 *
 * We cache for 15 minutes via Next's fetch revalidate so we don't hammer the
 * endpoint on every dashboard refresh.
 */

const PAOLI_LAT = 40.0432;
const PAOLI_LON = -75.4805;

export interface CurrentWeather {
  tempF: number;
  feelsLikeF: number;
  code: number;
  isDay: boolean;
  windMph: number;
  /** Human-readable summary for the WMO weather code, e.g. "Partly cloudy" */
  label: string;
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    is_day?: number;
    wind_speed_10m?: number;
  };
}

export async function getCurrentWeather(): Promise<CurrentWeather | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(PAOLI_LAT));
  url.searchParams.set("longitude", String(PAOLI_LON));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "weather_code",
      "is_day",
      "wind_speed_10m",
    ].join(","),
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "America/New_York");

  try {
    const res = await fetch(url.toString(), {
      // Cache 15 min — weather doesn't move that fast.
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OpenMeteoResponse;
    const cur = data.current;
    if (!cur) return null;
    const code = cur.weather_code ?? 0;
    return {
      tempF: Math.round(cur.temperature_2m ?? 0),
      feelsLikeF: Math.round(cur.apparent_temperature ?? 0),
      code,
      isDay: (cur.is_day ?? 1) === 1,
      windMph: Math.round(cur.wind_speed_10m ?? 0),
      label: wmoLabel(code),
    };
  } catch {
    return null;
  }
}

/** WMO weather interpretation codes — abbreviated to the most common ones. */
function wmoLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 71 && code <= 75) return "Snow";
  if (code === 77) return "Snow grains";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "—";
}

export function weatherGlyph(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "☀" : "☾";
  if (code === 1) return isDay ? "🌤" : "🌙";
  if (code === 2) return "⛅";
  if (code === 3) return "☁";
  if (code === 45 || code === 48) return "🌫";
  if (code >= 51 && code <= 67) return "🌧";
  if (code >= 71 && code <= 86) return "🌨";
  if (code >= 95) return "⛈";
  if (code >= 80 && code <= 82) return "🌦";
  return "·";
}
