/**
 * Données factices, en attendant les vrais connecteurs (Google Calendar,
 * CalDAV, Pronote, météo...). Les prénoms et la ville sont fictifs.
 */

export const MEMBERS = ["Camille", "Alex", "Léo", "Jade"] as const;
export const CITY = "Paris";

export const MEMBER_COLORS: Record<string, string> = {
  Camille: "#7FB2FF",
  Alex: "#FFAB66",
  Léo: "#E59CF0",
  Jade: "#F5D76E",
  Famille: "#C9C9D1",
};

export const WHO_CHOICES = [
  { value: "Tous", label: "Tous" },
  ...MEMBERS.map((m) => ({ value: m as string, label: m as string })),
];

export const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const DAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
export const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export type CalendarEvent = { time: string; name: string; who: string };

/** Événements par jour, à partir d'aujourd'hui (index 0). */
export const EVENTS: CalendarEvent[][] = [
  [{ time: "17:30", name: "Judo", who: "Léo" }, { time: "19:00", name: "Dîner en famille", who: "Famille" }],
  [{ time: "08:30", name: "Dentiste", who: "Jade" }, { time: "18:30", name: "Cinéma", who: "Alex" }],
  [{ time: "10:00", name: "Marché", who: "Camille" }, { time: "15:00", name: "Match de foot", who: "Léo" }],
  [{ time: "12:30", name: "Déjeuner chez les grands-parents", who: "Famille" }],
  [{ time: "18:00", name: "Piscine", who: "Jade" }],
  [{ time: "19:00", name: "Réunion", who: "Camille" }, { time: "20:30", name: "Yoga", who: "Alex" }],
  [{ time: "14:00", name: "Danse", who: "Jade" }],
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
