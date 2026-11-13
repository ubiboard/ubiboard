/**
 * Constantes de dates, et données factices de la météo en attendant un vrai
 * connecteur. La ville est fictive.
 */

export const CITY = "Paris";

export const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const DAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
export const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export type WeatherKind = "sun" | "cloud" | "rain";

export const WEATHER = {
  temp: 11,
  min: 8,
  max: 12,
  condition: "Averses faibles",
  kind: "rain" as WeatherKind,
  /** Prévisions des jours suivants (offset en jours). */
  forecast: [
    { offset: 1, hi: 12, lo: 7, kind: "cloud" },
    { offset: 2, hi: 10, lo: 6, kind: "rain" },
    { offset: 3, hi: 9, lo: 4, kind: "sun" },
    { offset: 4, hi: 11, lo: 5, kind: "cloud" },
    { offset: 5, hi: 10, lo: 6, kind: "rain" },
  ] as { offset: number; hi: number; lo: number; kind: WeatherKind }[],
};
