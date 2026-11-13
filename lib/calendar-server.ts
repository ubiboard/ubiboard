import "server-only";
import { createHash } from "node:crypto";
import ICAL from "ical.js";
import type { CalendarEvent } from "@/lib/calendar";

/**
 * Lecture des agendas au format iCal : téléchargement, puis dépliage des
 * événements (récurrences, exceptions, fuseaux horaires) sur une période.
 */

const CACHE_MS = 5 * 60_000;
const MAX_BYTES = 5_000_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_OCCURRENCES = 5000; // garde-fou par événement récurrent
const DAY_MS = 86_400_000;

/**
 * Erreur dont le message peut être montré à l'utilisateur. Les autres erreurs
 * (celles de l'analyseur, par exemple) peuvent citer le contenu de l'agenda :
 * elles sont remplacées par un message générique.
 */
export class CalendarError extends Error {}

/* ---------- Adresse ---------- */

/**
 * Vérifie et normalise l'adresse d'un agenda. On n'accepte que du https vers
 * un nom de domaine public : le serveur ne doit pas pouvoir être envoyé vers
 * une adresse interne.
 */
export function normalizeCalendarUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim().replace(/^webcal:\/\//i, "https://"));
  } catch {
    throw new CalendarError("Le lien n'est pas une adresse valide.");
  }
  // En développement uniquement : un agenda de test servi par la machine locale.
  if (process.env.NODE_ENV !== "production" && process.env.CALENDAR_ALLOW_LOCAL === "1" && url.hostname === "localhost") {
    url.protocol = "http:"; // le serveur de test local ne parle pas https
    return url.toString();
  }
  const host = url.hostname.toLowerCase();
  const isIp = /^[\d.]+$/.test(host) || host.includes(":");
  const isLocal = host === "localhost" || !host.includes(".") || /\.(local|internal|lan|home|localhost)$/.test(host);
  if (url.protocol !== "https:" || isIp || isLocal || url.username || url.password) {
    throw new CalendarError("Le lien doit être une adresse https publique.");
  }
  return url.toString();
}

/* ---------- Téléchargement (avec cache court) ---------- */

const cache = new Map<string, { at: number; text: string }>();

async function fetchIcs(url: string): Promise<string> {
  const cacheKey = createHash("sha256").update(url).digest("hex");
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.text;

  let current = url;
  let response: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    response = await fetch(current, {
      redirect: "manual", // chaque redirection est revérifiée
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
      cache: "no-store",
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = normalizeCalendarUrl(new URL(location, current).toString());
      continue;
    }
    break;
  }
  if (!response || !response.ok) throw new CalendarError("L'agenda ne répond pas (lien expiré ou incorrect ?).");

  const text = await response.text();
  if (text.length > MAX_BYTES) throw new CalendarError("Agenda trop volumineux.");
  if (!text.includes("BEGIN:VCALENDAR")) throw new CalendarError("Ce lien ne renvoie pas un agenda au format iCal.");

  cache.set(cacheKey, { at: Date.now(), text });
  return text;
}

/* ---------- Dépliage des événements ---------- */

type IcalTime = { isDate: boolean; year: number; month: number; day: number; toJSDate: () => Date };

const pad = (n: number) => String(n).padStart(2, "0");
const dateOnly = (t: IcalTime) => `${t.year}-${pad(t.month)}-${pad(t.day)}`;

function toEvent(sourceId: string, uid: string, title: string, start: IcalTime, end: IcalTime | null): CalendarEvent {
  const allDay = start.isDate;
  const startValue = allDay ? dateOnly(start) : start.toJSDate().toISOString();
  const endValue = end ? (allDay ? dateOnly(end) : end.toJSDate().toISOString()) : startValue;
  return { id: `${sourceId}:${uid}:${startValue}`, sourceId, title: (title ?? "").trim() || "(sans titre)", allDay, start: startValue, end: endValue };
}

/**
 * Répare les fichiers iCal mal formés avant de les analyser. Certains
 * fournisseurs (Ecole Directe, par exemple) écrivent des retours à la ligne
 * bruts dans un texte : la suite du texte se retrouve seule sur une ligne, sans
 * nom de propriété, et l'analyseur la refuse. On la rattache à la ligne
 * précédente, comme un retour à la ligne à l'intérieur du texte.
 */
export function repairIcs(ics: string): string {
  const out: string[] = [];
  for (const line of ics.split(/\r?\n/)) {
    if (line === "") continue;
    const isContinuation = line.startsWith(" ") || line.startsWith("\t");
    const isProperty = /^[A-Za-z][A-Za-z0-9-]*[;:]/.test(line);
    if (isContinuation || isProperty || out.length === 0) out.push(line);
    else out.push(" \\n" + line); // ligne de continuation commençant par un « \n » littéral
  }
  return out.join("\r\n");
}

/** Les événements de cet agenda qui touchent la période [from, to[. */
export function expandEvents(sourceId: string, ics: string, from: Date, to: Date): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(repairIcs(ics)));
  for (const tz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);

  // Une marge d'un jour couvre les journées entières, dont le fuseau est celui du lecteur.
  const lo = from.getTime() - DAY_MS;
  const hi = to.getTime() + DAY_MS;
  const overlaps = (start: Date, end: Date | null) => start.getTime() < hi && (end ?? start).getTime() >= lo;

  // Les occurrences modifiées d'une série (RECURRENCE-ID) sont rattachées à leur événement principal.
  const mains = new Map<string, InstanceType<typeof ICAL.Component>>();
  const exceptions = new Map<string, InstanceType<typeof ICAL.Component>[]>();
  for (const vevent of root.getAllSubcomponents("vevent")) {
    const uid = String(vevent.getFirstPropertyValue("uid") ?? "");
    if (vevent.hasProperty("recurrence-id")) exceptions.set(uid, [...(exceptions.get(uid) ?? []), vevent]);
    else mains.set(uid, vevent);
  }

  const out: CalendarEvent[] = [];
  const cancelled = (c: InstanceType<typeof ICAL.Component>) => String(c.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED";

  for (const [uid, vevent] of mains) {
    if (cancelled(vevent)) continue;
    const event = new ICAL.Event(vevent, { exceptions: exceptions.get(uid) ?? [] });
    if (!event.startDate) continue;

    if (!event.isRecurring()) {
      if (overlaps(event.startDate.toJSDate(), event.endDate?.toJSDate() ?? null)) {
        out.push(toEvent(sourceId, uid, event.summary, event.startDate, event.endDate));
      }
      continue;
    }

    const iterator = event.iterator();
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const next = iterator.next();
      if (!next) break;
      if (next.toJSDate().getTime() >= hi) break;
      const occurrence = event.getOccurrenceDetails(next);
      if (cancelled(occurrence.item.component)) continue;
      if (overlaps(occurrence.startDate.toJSDate(), occurrence.endDate?.toJSDate() ?? null)) {
        out.push(toEvent(sourceId, uid, occurrence.item.summary, occurrence.startDate, occurrence.endDate));
      }
    }
  }

  // Occurrences modifiées dont la série principale n'est pas dans le fichier.
  for (const [uid, list] of exceptions) {
    if (mains.has(uid)) continue;
    for (const vevent of list) {
      if (cancelled(vevent)) continue;
      const event = new ICAL.Event(vevent);
      if (event.startDate && overlaps(event.startDate.toJSDate(), event.endDate?.toJSDate() ?? null)) {
        out.push(toEvent(sourceId, uid, event.summary, event.startDate, event.endDate));
      }
    }
  }
  return out;
}

export async function loadCalendarEvents(sourceId: string, url: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  return expandEvents(sourceId, await fetchIcs(url), from, to);
}
