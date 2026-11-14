/**
 * Météo : lecture du service Open-Meteo (gratuit, sans clé ni compte).
 * Le navigateur l'interroge directement ; rien ne passe par le serveur UbiBoard.
 * Données Open-Meteo, licence CC BY 4.0.
 */

export type WeatherKind = "sun" | "moon" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export type WeatherDay = { date: string; code: number; min: number; max: number };

export type Weather = {
  /** Température actuelle, en °C. */
  temp: number;
  code: number;
  isDay: boolean;
  /** Aujourd'hui, puis les jours suivants. */
  days: WeatherDay[];
};

export type City = { name: string; detail: string; lat: number; lon: number };

/** Codes météo de l'OMM, tels que les renvoie Open-Meteo. */
const CODES: Record<number, [WeatherKind, string]> = {
  0: ["sun", "Ciel dégagé"],
  1: ["partly", "Peu nuageux"],
  2: ["partly", "Éclaircies"],
  3: ["cloud", "Couvert"],
  45: ["fog", "Brouillard"],
  48: ["fog", "Brouillard givrant"],
  51: ["drizzle", "Bruine légère"],
  53: ["drizzle", "Bruine"],
  55: ["drizzle", "Bruine forte"],
  56: ["drizzle", "Bruine verglaçante"],
  57: ["drizzle", "Bruine verglaçante"],
  61: ["rain", "Pluie faible"],
  63: ["rain", "Pluie"],
  65: ["rain", "Pluie forte"],
  66: ["rain", "Pluie verglaçante"],
  67: ["rain", "Pluie verglaçante"],
  71: ["snow", "Neige faible"],
  73: ["snow", "Neige"],
  75: ["snow", "Neige forte"],
  77: ["snow", "Grains de neige"],
  80: ["rain", "Averses faibles"],
  81: ["rain", "Averses"],
  82: ["rain", "Averses fortes"],
  85: ["snow", "Averses de neige"],
  86: ["snow", "Averses de neige"],
  95: ["storm", "Orage"],
  96: ["storm", "Orage et grêle"],
  99: ["storm", "Orage et grêle"],
};

export function weatherKind(code: number, isDay = true): WeatherKind {
  const kind = CODES[code]?.[0] ?? "cloud";
  return kind === "sun" && !isDay ? "moon" : kind;
}

export function weatherLabel(code: number): string {
  return CODES[code]?.[1] ?? "";
}

const FRESH_MS = 10 * 60_000;
const cache = new Map<string, { at: number; request: Promise<Weather> }>();

/** La météo d'un lieu. Un même lieu n'est pas redemandé avant dix minutes. */
export function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const key = `${lat},${lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.request;

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,weather_code,is_day" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
    "&timezone=auto&forecast_days=8";
  const request = fetch(url).then(async (res) => {
    if (!res.ok) throw new Error("Météo indisponible.");
    const json = await res.json();
    const daily = json.daily;
    return {
      temp: json.current.temperature_2m,
      code: json.current.weather_code,
      isDay: json.current.is_day === 1,
      days: (daily.time as string[]).map((date, k) => ({
        date,
        code: daily.weather_code[k],
        min: daily.temperature_2m_min[k],
        max: daily.temperature_2m_max[k],
      })),
    } satisfies Weather;
  });
  cache.set(key, { at: Date.now(), request });
  // Un échec ne reste pas en mémoire : la prochaine demande réessaie.
  request.catch(() => {
    if (cache.get(key)?.request === request) cache.delete(key);
  });
  return request;
}

/** Cherche des villes par leur nom. */
export async function searchCities(query: string, signal?: AbortSignal): Promise<City[]> {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(query)}&count=6&language=fr&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Recherche indisponible.");
  const json = await res.json();
  type Result = { name: string; latitude: number; longitude: number; admin1?: string; country?: string };
  return ((json.results ?? []) as Result[]).map((r) => ({
    name: r.name,
    detail: [r.admin1, r.country].filter((part) => part && part !== r.name).join(", "),
    // Deux décimales (environ un kilomètre) suffisent pour la météo.
    lat: Math.round(r.latitude * 100) / 100,
    lon: Math.round(r.longitude * 100) / 100,
  }));
}
