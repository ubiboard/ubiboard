/**
 * Modèle des tâches : récurrence et roulement.
 *
 * Tout est calculé à partir de la date de départ de la tâche et du calendrier,
 * sans historique : le roulement avance même si une tâche n'a pas été faite.
 * Les dates sont des jours civils (« AAAA-MM-JJ »), sans heure.
 */

export type RecurrenceUnit = "day" | "week" | "month" | "year";

export type Recurrence = {
  /** « Répéter chaque {every} {unit} », de 1 à 100. */
  every: number;
  unit: RecurrenceUnit;
  /** Unité « semaine » : jours concernés, 0 = dimanche … 6 = samedi. */
  weekdays?: number[];
  /** Unités « mois » et « année » : jour du mois, de 1 à 31. */
  monthDay?: number;
  /** Unité « année » : mois, 0 = janvier … 11 = décembre. */
  month?: number;
};

/** Quand le roulement passe à la personne suivante. */
export type RotationMode = "occurrence" | "day" | "week" | "month";

export type Task = {
  name: string;
  /** null = tâche ponctuelle : affichée tous les jours jusqu'à sa suppression. */
  recurrence: Recurrence | null;
  /** Jour de départ (création, ou dernière modification de la récurrence ou des personnes). */
  start: string;
  /** Identifiants des personnes affectées, dans l'ordre du roulement. */
  people: string[];
  rotation: RotationMode;
};

export const WEEKDAYS_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/* ---------- Dates : jours civils ---------- */

type Day = { y: number; m: number; d: number; num: number };

const DAY_MS = 86_400_000;
const dayNum = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m, d) / DAY_MS);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const weekdayOf = (num: number) => new Date(num * DAY_MS).getUTCDay();
/** Rang du jour dans une semaine qui commence le lundi (lundi = 0). */
const mondayRank = (weekday: number) => (weekday + 6) % 7;
const mondayOf = (num: number) => num - mondayRank(weekdayOf(num));

export function toIsoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(iso: string): Day {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d, num: dayNum(y, m - 1, d) };
}

/** Le jour du mois visé, ramené au dernier jour pour les mois trop courts. */
const dueDayIn = (y: number, m: number, monthDay: number) => Math.min(monthDay, daysInMonth(y, m));

/* ---------- Récurrence ---------- */

/**
 * Rang de l'occurrence du jour (0 pour la première depuis le départ), ou null
 * si la tâche n'est pas à faire ce jour-là.
 */
export function occurrenceIndex(task: Task, todayIso: string): number | null {
  const start = parseDay(task.start);
  const today = parseDay(todayIso);
  if (today.num < start.num) return null;

  const rec = task.recurrence;
  if (!rec) return today.num - start.num; // ponctuelle : tous les jours
  const every = Math.max(1, Math.floor(rec.every) || 1);

  if (rec.unit === "day") {
    const days = today.num - start.num;
    return days % every === 0 ? days / every : null;
  }

  if (rec.unit === "week") {
    const selected = (rec.weekdays ?? []).map(mondayRank);
    const weeks = (mondayOf(today.num) - mondayOf(start.num)) / 7;
    const todayRank = mondayRank(weekdayOf(today.num));
    if (weeks % every !== 0 || !selected.includes(todayRank)) return null;
    const startRank = mondayRank(weekdayOf(start.num));
    const before = selected.filter((r) => r < startRank).length; // jours passés avant le départ
    const upToToday = selected.filter((r) => r <= todayRank).length;
    return (weeks / every) * selected.length + upToToday - before - 1;
  }

  const monthDay = rec.monthDay ?? start.d;

  if (rec.unit === "month") {
    const months = (today.y - start.y) * 12 + (today.m - start.m);
    if (months % every !== 0 || today.d !== dueDayIn(today.y, today.m, monthDay)) return null;
    // Le mois de départ compte seulement si son jour n'était pas déjà passé.
    const firstCounts = dueDayIn(start.y, start.m, monthDay) >= start.d;
    return months / every - (firstCounts ? 0 : 1);
  }

  // Année
  const month = rec.month ?? start.m;
  const years = today.y - start.y;
  if (years % every !== 0 || today.m !== month || today.d !== dueDayIn(today.y, month, monthDay)) return null;
  const firstCounts = dayNum(start.y, month, dueDayIn(start.y, month, monthDay)) >= start.num;
  return years / every - (firstCounts ? 0 : 1);
}

/* ---------- Roulement ---------- */

/**
 * La personne responsable de la tâche ce jour-là, ou null si la tâche n'est
 * pas à faire. `known` limite le roulement aux personnes encore sur le board.
 */
export function assigneeOn(task: Task, todayIso: string, known?: Set<string>): string | null {
  const occurrence = occurrenceIndex(task, todayIso);
  if (occurrence === null) return null;
  const people = known ? task.people.filter((id) => known.has(id)) : task.people;
  if (people.length === 0) return null;

  const start = parseDay(task.start);
  const today = parseDay(todayIso);
  let turn = occurrence;
  if (task.rotation === "day") turn = today.num - start.num;
  // La semaine change le lundi, le mois le 1er.
  if (task.rotation === "week") turn = (mondayOf(today.num) - mondayOf(start.num)) / 7;
  if (task.rotation === "month") turn = (today.y - start.y) * 12 + (today.m - start.m);
  return people[((turn % people.length) + people.length) % people.length];
}

/* ---------- Phrases en clair ---------- */

function joinFr(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return parts.slice(0, -1).join(", ") + " et " + parts[parts.length - 1];
}

const dayLabel = (n: number) => (n === 1 ? "1er" : String(n));

/** Décrit la récurrence, par exemple « Chaque mercredi et vendredi ». */
export function describeRecurrence(rec: Recurrence | null): string {
  if (!rec) return "Tâche ponctuelle : affichée tous les jours jusqu’à sa suppression";
  const n = Math.max(1, Math.floor(rec.every) || 1);

  if (rec.unit === "day") return n === 1 ? "Chaque jour" : `Tous les ${n} jours`;

  if (rec.unit === "week") {
    const days = WEEKDAYS_FROM_MONDAY.filter((d) => (rec.weekdays ?? []).includes(d)).map((d) => WEEKDAY_NAMES[d]);
    if (days.length === 0) return "Choisissez au moins un jour";
    if (n === 1) return days.length === 7 ? "Chaque jour" : `Chaque ${joinFr(days)}`;
    return `Toutes les ${n} semaines, le ${joinFr(days)}`;
  }

  const day = dayLabel(rec.monthDay ?? 1);
  if (rec.unit === "month") return n === 1 ? `Chaque mois, le ${day}` : `Tous les ${n} mois, le ${day}`;

  const date = `${day} ${MONTH_NAMES[rec.month ?? 0]}`;
  return n === 1 ? `Chaque année, le ${date}` : `Tous les ${n} ans, le ${date}`;
}

export const ROTATION_LABELS: Record<RotationMode, string> = {
  occurrence: "À chaque fois",
  day: "Chaque jour",
  week: "Chaque semaine",
  month: "Chaque mois",
};

/** Décrit le roulement, par exemple « Léo puis Jade, changement chaque semaine (le lundi) ». */
export function describeRotation(names: string[], rotation: RotationMode): string {
  if (names.length === 0) return "Personne";
  if (names.length === 1) return names[0];
  const when: Record<RotationMode, string> = {
    occurrence: "à chaque fois",
    day: "chaque jour",
    week: "chaque semaine (le lundi)",
    month: "chaque mois (le 1er)",
  };
  return `${names.join(" puis ")}, changement ${when[rotation]}`;
}
