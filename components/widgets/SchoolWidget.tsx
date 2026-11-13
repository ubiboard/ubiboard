"use client";

import { useEffect, useState } from "react";
import { registerWidget, type WidgetProps } from "@/lib/widgets";
import { useWidgetData } from "@/lib/board-context";
import { useNow } from "@/lib/hooks";
import { DAYS_SHORT } from "@/lib/demo-data";
import { addDays, isOnDay, startOfDay } from "@/lib/calendar";
import { useCalendarEvents } from "@/lib/use-calendar-events";
import {
  DEFAULT_SLOT_COLOR,
  buildAxis,
  colorForTitle,
  isIcalLink,
  toMinutes,
  type SchoolItem,
  type Slot,
} from "@/lib/timetable";
import Icon from "@/components/Icon";
import SchoolManager from "./SchoolManager";

const BAR_HEIGHT = 44; // barre de navigation + marge
const HEAD_HEIGHT = 36; // en-tête de jour + marge
const BACK_TO_TODAY_MS = 2 * 60_000;

type View = "2j" | "week";

/** Un bloc à afficher : un créneau saisi à la main, ou un cours venu du lien iCal. */
type Block = { key: string; start: string; end: string; name: string; color: string | null };

const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

function School({ bodyHeight, options, dataId, setOption }: WidgetProps) {
  const { items, loading, error } = useWidgetData<SchoolItem>(dataId);
  const now = useNow(60_000);
  const today = startOfDay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // La liste mêle les créneaux saisis à la main et, éventuellement, un lien iCal.
  const manual = items.filter((it) => !isIcalLink(it.content)).map((it) => ({ id: it.id, slot: it.content as Slot }));
  const link = items.find((it) => isIcalLink(it.content));

  // Le type de vue est un réglage du widget, commun à tous les appareils du board.
  const view: View = options.span === "week" ? "week" : "2j";
  const setView = (next: View) => setOption("span", next);
  // Décalage par rapport à aujourd'hui : en jours (vue jours) ou en semaines (vue semaine).
  const [shift, setShift] = useState(0);
  const week = view === "week";

  // Un écran mural ne doit pas rester sur une autre semaine : retour à aujourd'hui après un moment.
  useEffect(() => {
    if (shift === 0) return;
    const timer = setTimeout(() => setShift(0), BACK_TO_TODAY_MS);
    return () => clearTimeout(timer);
  }, [shift]);

  // Premier jour affiché, et nombre de jours demandés au serveur (une semaine complète en vue semaine).
  const first = week ? addDays(today, -((now.getDay() + 6) % 7) + shift * 7) : addDays(today, shift);
  const span = week ? 7 : 2;
  const { events, errors, failed, loading: eventsLoading } = useCalendarEvents(dataId, first, addDays(first, span), link?.id ?? "", !!link);

  const allDays = Array.from({ length: span }, (_, i) => {
    const date = addDays(first, i);
    const offset = Math.round((date.getTime() - today.getTime()) / 86_400_000);
    const short = `${DAYS_SHORT[date.getDay()]} ${date.getDate()}`;
    const relative = offset === 0 ? "Aujourd’hui" : offset === 1 ? "Demain" : offset === -1 ? "Hier" : null;

    const blocks: Block[] = manual
      .filter(({ slot }) => slot.day === date.getDay())
      .map(({ id, slot }) => ({ key: id, start: slot.start, end: slot.end, name: slot.name, color: slot.color }));
    for (const event of events) {
      if (event.allDay || !isOnDay(event, date)) continue;
      const start = new Date(event.start);
      const end = new Date(event.end);
      // Un cours qui déborde sur la veille ou le lendemain est borné à la journée.
      blocks.push({
        key: event.id,
        start: start < date ? "00:00" : hhmm(start),
        end: end >= addDays(date, 1) ? "23:59" : hhmm(end),
        name: event.title === "(sans titre)" ? "" : event.title,
        color: colorForTitle(event.title),
      });
    }
    return { date, offset, today: offset === 0, label: !week && relative ? `${relative} · ${short}` : short, blocks };
  });

  // En vue semaine, le week-end n'apparaît que s'il a quelque chose.
  const weekendBusy = allDays.slice(5).some((d) => d.blocks.length > 0);
  const days = week && !weekendBusy ? allDays.slice(0, 5) : allDays;

  // Un seul axe pour tous les jours affichés : les cours à la même heure sont alignés.
  const axis = buildAxis(days.flatMap((d) => d.blocks), bodyHeight - BAR_HEIGHT - HEAD_HEIGHT);
  const empty = manual.length === 0 && !link;
  const problem = error ?? (failed ? "Emploi du temps indisponible pour le moment." : errors[0]?.message);

  return (
    <>
      <div className="school-bar">
        <button className="bar-btn" aria-label={week ? "Semaine précédente" : "Jour précédent"} title="Précédent" onClick={() => setShift(shift - 1)}>
          <Icon name="previous" size={18} />
        </button>
        <button className="bar-btn" aria-label={week ? "Semaine suivante" : "Jour suivant"} title="Suivant" onClick={() => setShift(shift + 1)}>
          <Icon name="next" size={18} />
        </button>
        {shift !== 0 && (
          <button className="bar-chip" onClick={() => setShift(0)}>Aujourd’hui</button>
        )}
        <div className="segmented" role="group" aria-label="Type de vue">
          <button aria-pressed={!week} className={!week ? "on" : ""} onClick={() => { setView("2j"); setShift(0); }}>Jours</button>
          <button aria-pressed={week} className={week ? "on" : ""} onClick={() => { setView("week"); setShift(0); }}>Semaine</button>
        </div>
      </div>

      {(loading || (eventsLoading && manual.length === 0)) && <div className="dim small">Chargement…</div>}
      {problem && <div className="widget-error" style={{ margin: "0 0 6px" }}>{problem}</div>}
      {!loading && empty && <div className="dim small">Aucun créneau pour l’instant.</div>}

      {!loading && !empty && (
        <div className="school" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => (
            <div key={day.offset} className="school-day">
              <div className={"day-head" + (day.today ? " today" : "")}>
                <span className="day-label ellipsis">{day.label}</span>
              </div>
              {day.blocks.length === 0 ? (
                <div className="dim small">Rien de prévu</div>
              ) : (
                <div className="school-track" style={{ height: axis.height }}>
                  {day.blocks.map((block) => {
                    const start = toMinutes(block.start);
                    const end = toMinutes(block.end);
                    const top = axis.y(start);
                    const height = Math.max(axis.y(end) - top, 18);
                    const current = day.today && nowMin >= start && nowMin < end;
                    const past = day.offset < 0 || (day.today && nowMin >= end);
                    return (
                      <div
                        key={block.key}
                        className={"slot" + (height < 42 ? " compact" : "") + (current ? " current" : "") + (past ? " past" : "")}
                        style={{ top, height, background: block.color ?? DEFAULT_SLOT_COLOR }}
                        title={`${block.start} – ${block.end} · ${block.name}`}
                      >
                        <span className="slot-time">{block.start}–{block.end}</span>
                        <span className="slot-name">{block.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

registerWidget({
  type: "school",
  name: "Emploi du temps",
  description: "Les créneaux de la semaine, saisis à la main ou synchronisés par un lien iCal (Ecole Directe…).",
  source: "default",
  access: "emploi du temps du board (lecture ; écriture par les administrateurs)",
  storesData: true,
  sizes: { min: [3, 2], default: [6, 3], max: [12, 5] },
  options: [
    { key: "who", label: "Pour qui", choices: "people" },
    {
      key: "span",
      label: "Vue",
      choices: [
        { value: "2j", label: "Jours" },
        { value: "week", label: "Semaine" },
      ],
    },
  ],
  defaultOptions: { who: "all", span: "2j" },
  defaultShowTitle: true,
  // Le nom de la personne choisie complète le titre.
  title: (options, people) => {
    const person = people.find((p) => p.userId === options.who);
    return "Emploi du temps" + (person ? ` · ${person.name}` : "");
  },
  Component: School,
  Manager: SchoolManager,
  managerTitle: "Emploi du temps",
});
