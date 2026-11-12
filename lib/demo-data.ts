/**
 * Données factices, en attendant les vrais connecteurs (Google Calendar,
 * CalDAV, Pronote, météo...). Les prénoms et la ville sont fictifs.
 */

export const MEMBERS = ["Camille", "Alex", "Léo", "Jade"] as const;
export const KIDS = ["Léo", "Jade"] as const;
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

export type Slot = [start: string, end: string, subject: string];

const PRIMARY_HOURS: [string, string][] = [
  ["08:30", "09:30"], ["09:30", "10:45"], ["11:00", "12:00"], ["13:30", "14:30"], ["14:30", "16:00"],
];
const primary = (subjects: string[]): Slot[] =>
  subjects.map((s, i) => [PRIMARY_HOURS[i][0], PRIMARY_HOURS[i][1], s]);

/** Emploi du temps par enfant, puis par jour de la semaine (1 = lundi). */
export const SCHOOL: Record<string, Record<number, Slot[]>> = {
  Léo: {
    1: [["08:00", "09:00", "Maths"], ["09:00", "10:00", "Français"], ["10:10", "11:10", "Anglais"], ["11:10", "12:10", "EPS"], ["13:30", "14:30", "Histoire-géo"], ["14:30", "15:30", "SVT"]],
    2: [["08:00", "09:00", "Français"], ["09:00", "10:00", "Techno"], ["10:10", "11:10", "Maths"], ["11:10", "12:10", "Histoire-géo"], ["14:30", "15:30", "Anglais"]],
    3: [["08:00", "09:00", "Maths"], ["09:00", "10:00", "Physique"], ["10:10", "11:10", "Musique"]],
    4: [["08:00", "09:00", "Anglais"], ["09:00", "10:00", "Maths"], ["10:10", "11:10", "SVT"], ["11:10", "12:10", "Français"], ["13:30", "14:30", "EPS"], ["14:30", "15:30", "Arts plastiques"]],
    5: [["08:00", "09:00", "Histoire-géo"], ["09:00", "10:00", "Français"], ["10:10", "11:10", "Physique"], ["11:10", "12:10", "Maths"], ["13:30", "14:30", "Techno"]],
  },
  Jade: {
    1: primary(["Lecture", "Maths", "Anglais", "Sport", "Arts plastiques"]),
    2: primary(["Maths", "Écriture", "Sciences", "Lecture", "Histoire"]),
    4: primary(["Lecture", "Maths", "Musique", "Sport", "Géographie"]),
    5: primary(["Maths", "Dictée", "Anglais", "Sciences"]),
  },
};

/**
 * Corvées factices : le résultat affiché uniquement. Le vrai modèle
 * (rotations de rôles, responsabilités cochables ou non) reste à concevoir.
 */
export const CHORES: { name: string; who: string }[] = [
  { name: "Mettre la table", who: "Jade" },
  { name: "Débarrasser la table", who: "Léo" },
  { name: "Donner à manger au chat", who: "Jade" },
  { name: "Nettoyer l’aspirateur robot", who: "Alex" },
  { name: "Débarrasser le lave-vaisselle", who: "Léo" },
  { name: "Ranger le linge", who: "Camille" },
];

export type ShoppingItem = { id: string; name: string; done: boolean };

export const SHOPPING: ShoppingItem[] = [
  { id: "s1", name: "Lait", done: false },
  { id: "s2", name: "Pain", done: true },
  { id: "s3", name: "Pâtes", done: false },
  { id: "s4", name: "Pommes", done: false },
  { id: "s5", name: "Yaourts", done: false },
  { id: "s6", name: "Café", done: false },
  { id: "s7", name: "Liquide vaisselle", done: false },
];

export const NOTE = "Judo de Léo à 17 h 30 : penser au kimono !";
