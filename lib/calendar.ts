// Calendrier : types et calculs de dates partagés entre le serveur et le navigateur.

/** Un agenda connecté, tel que le navigateur le voit : le lien n'en fait jamais partie. */
export type CalendarSource = { name: string; color: string; hasUrl?: boolean };

export type CalendarEvent = {
  id: string;
  /** Identifiant de l'agenda (l'élément de données) d'où vient l'événement. */
  sourceId: string;
  title: string;
  allDay: boolean;
  /**
   * Événement daté : instants ISO. Journée entière : jours « AAAA-MM-JJ »,
   * la fin étant exclue (un événement du 14 seul finit le 15).
   */
  start: string;
  end: string;
};

export type CalendarResult = {
  events: CalendarEvent[];
  /** Agendas qui n'ont pas pu être lus. */
  errors: { sourceId: string; message: string }[];
};

export type CalendarView = "month" | "week" | "day" | "list";

export const CALENDAR_VIEWS: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Mois" },
  { value: "week", label: "Semaine" },
  { value: "day", label: "Jour" },
  { value: "list", label: "Liste" },
];

/* ---------- Dates locales ---------- */

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Le lundi de la semaine de cette date. */
export const mondayOf = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));

export const dayKey = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);

/** L'événement touche-t-il ce jour (local) ? Un événement sur plusieurs jours apparaît chaque jour. */
export function isOnDay(event: CalendarEvent, day: Date): boolean {
  if (event.allDay) {
    const key = dayKey(day);
    return event.start <= key && key < (event.end > event.start ? event.end : dayKey(addDays(new Date(event.start + "T00:00:00"), 1)));
  }
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(day, 1).getTime();
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  return end > start ? start < dayEnd && end > dayStart : start >= dayStart && start < dayEnd;
}

/** Les événements d'un jour : journées entières d'abord, puis par heure de début. */
export function eventsOn(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => isOnDay(e, day))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

/** Heure de début affichée pour ce jour : vide pour une journée entière ou un événement commencé la veille. */
export function timeLabel(event: CalendarEvent, day: Date): string {
  if (event.allDay) return "";
  const start = new Date(event.start);
  if (!sameDay(start, day)) return "";
  return start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
