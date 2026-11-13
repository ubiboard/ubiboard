"use client";

import { registerWidget, type WidgetProps } from "@/lib/widgets";
import { useWidgetData } from "@/lib/board-context";
import { useNow } from "@/lib/hooks";
import { DAYS_SHORT } from "@/lib/demo-data";
import { DEFAULT_SLOT_COLOR, buildAxis, toMinutes, type Slot } from "@/lib/timetable";
import SchoolManager from "./SchoolManager";

const HEAD_HEIGHT = 36; // en-tête de jour + marge

function School({ bodyHeight, options, dataId }: WidgetProps) {
  const { items, loading, error } = useWidgetData<Slot>(dataId);
  const now = useNow(60_000);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const week = options.span === "week";

  // Jours affichés, en décalage par rapport à aujourd'hui.
  let offsets = [0, 1];
  if (week) {
    const fromMonday = (now.getDay() + 6) % 7;
    const hasWeekend = items.some((it) => it.content.day === 6 || it.content.day === 0);
    offsets = Array.from({ length: hasWeekend ? 7 : 5 }, (_, k) => k - fromMonday);
  }
  const days = offsets.map((offset) => {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    const short = `${DAYS_SHORT[date.getDay()]} ${date.getDate()}`;
    return {
      offset,
      today: offset === 0,
      label: week ? short : `${offset === 0 ? "Aujourd’hui" : "Demain"} · ${short}`,
      slots: items.filter((it) => it.content.day === date.getDay()),
    };
  });

  // Un seul axe pour tous les jours affichés : les cours à la même heure sont alignés.
  const shown = days.flatMap((d) => d.slots.map((it) => it.content));
  const axis = buildAxis(shown, bodyHeight - HEAD_HEIGHT);

  if (loading) return <div className="dim small">Chargement…</div>;
  if (error) return <div className="widget-error">{error}</div>;
  if (items.length === 0) return <div className="dim small">Aucun créneau pour l’instant.</div>;

  return (
    <div className="school" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((day) => (
        <div key={day.offset} className="school-day">
          <div className={"day-head" + (day.today ? " today" : "")}>
            <span className="day-label ellipsis">{day.label}</span>
          </div>
          {day.slots.length === 0 ? (
            <div className="dim small">Rien de prévu</div>
          ) : (
            <div className="school-track" style={{ height: axis.height }}>
              {day.slots.map((it) => {
                const slot = it.content;
                const start = toMinutes(slot.start);
                const end = toMinutes(slot.end);
                const top = axis.y(start);
                const height = Math.max(axis.y(end) - top, 18);
                const current = day.today && nowMin >= start && nowMin < end;
                const past = day.today && nowMin >= end;
                return (
                  <div
                    key={it.id}
                    className={"slot" + (height < 42 ? " compact" : "") + (current ? " current" : "") + (past ? " past" : "")}
                    style={{ top, height, background: slot.color ?? DEFAULT_SLOT_COLOR }}
                    title={`${slot.start} – ${slot.end} · ${slot.name}`}
                  >
                    <span className="slot-time">{slot.start}–{slot.end}</span>
                    <span className="slot-name">{slot.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

registerWidget({
  type: "school",
  name: "Emploi du temps",
  description: "Les créneaux de la semaine, saisis à la main : aujourd’hui et demain, ou toute la semaine.",
  source: "default",
  access: "emploi du temps du board (lecture ; écriture par les administrateurs)",
  storesData: true,
  sizes: { min: [2, 2], default: [4, 3], max: [8, 5] },
  options: [
    { key: "who", label: "Pour qui", choices: "people" },
    {
      key: "span",
      label: "Affichage",
      choices: [
        { value: "2j", label: "Aujourd’hui et demain" },
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
