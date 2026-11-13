"use client";

import { useEffect, useState } from "react";
import { registerWidget, type WidgetProps } from "@/lib/widgets";
import { useWidgetData } from "@/lib/board-context";
import { useNow } from "@/lib/hooks";
import { DAYS_SHORT } from "@/lib/demo-data";
import { DEFAULT_SLOT_COLOR, buildAxis, toMinutes, type Slot } from "@/lib/timetable";
import Icon from "@/components/Icon";
import SchoolManager from "./SchoolManager";

const BAR_HEIGHT = 44; // barre de navigation + marge
const HEAD_HEIGHT = 36; // en-tête de jour + marge
const BACK_TO_TODAY_MS = 2 * 60_000;

type View = "2j" | "week";

function School({ bodyHeight, options, dataId, setOption }: WidgetProps) {
  const { items, loading, error } = useWidgetData<Slot>(dataId);
  const now = useNow(60_000);
  const nowMin = now.getHours() * 60 + now.getMinutes();

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

  // Jours affichés, en décalage par rapport à aujourd'hui.
  let offsets = [shift, shift + 1];
  if (week) {
    const fromMonday = (now.getDay() + 6) % 7;
    const hasWeekend = items.some((it) => it.content.day === 6 || it.content.day === 0);
    offsets = Array.from({ length: hasWeekend ? 7 : 5 }, (_, k) => k - fromMonday + shift * 7);
  }
  const days = offsets.map((offset) => {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    const short = `${DAYS_SHORT[date.getDay()]} ${date.getDate()}`;
    const relative = offset === 0 ? "Aujourd’hui" : offset === 1 ? "Demain" : offset === -1 ? "Hier" : null;
    return {
      offset,
      today: offset === 0,
      label: !week && relative ? `${relative} · ${short}` : short,
      slots: items.filter((it) => it.content.day === date.getDay()),
    };
  });

  // Un seul axe pour tous les jours affichés : les cours à la même heure sont alignés.
  const shown = days.flatMap((d) => d.slots.map((it) => it.content));
  const axis = buildAxis(shown, bodyHeight - BAR_HEIGHT - HEAD_HEIGHT);

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

      {loading && <div className="dim small">Chargement…</div>}
      {error && <div className="widget-error">{error}</div>}
      {!loading && !error && items.length === 0 && <div className="dim small">Aucun créneau pour l’instant.</div>}

      {!loading && !error && items.length > 0 && (
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
      )}
    </>
  );
}

registerWidget({
  type: "school",
  name: "Emploi du temps",
  description: "Les créneaux de la semaine, saisis à la main : par jours ou par semaine, avec navigation.",
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
