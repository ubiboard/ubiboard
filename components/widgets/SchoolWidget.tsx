"use client";

import { registerWidget, type WidgetProps } from "@/lib/widgets";
import { useNow } from "@/lib/hooks";
import { DAYS_SHORT, KIDS, SCHOOL } from "@/lib/demo-data";

const toMinutes = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3), 10);

function School({ w, bodyHeight, options }: WidgetProps) {
  const now = useNow(60_000);
  const week = options.span === "week";
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Décalages en jours par rapport à aujourd'hui : [0, 1] ou lundi → vendredi.
  let offsets = [0, 1];
  if (week) {
    const dow = now.getDay();
    const monday = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
    offsets = [0, 1, 2, 3, 4].map((k) => monday + k);
  }
  const stacked = week || w < 4;
  const limit = Math.max(2, Math.floor((bodyHeight - 36) / (stacked ? 58 : 44)));

  return (
    <div className="school" style={{ gridTemplateColumns: `repeat(${offsets.length}, minmax(0, 1fr))` }}>
      {offsets.map((offset) => {
        const d = new Date(now);
        d.setDate(now.getDate() + offset);
        const today = offset === 0;
        const short = `${DAYS_SHORT[d.getDay()]} ${d.getDate()}`;
        const label = week ? short : `${today ? "Aujourd’hui" : "Demain"} · ${short}`;
        const slots = SCHOOL[options.kid]?.[d.getDay()] ?? [];
        return (
          <div key={offset} className="school-day">
            <div className={"day-head" + (today ? " today" : "")}>
              <span className="day-label ellipsis">{label}</span>
            </div>
            {slots.length === 0 && <div className="dim small">Pas de cours</div>}
            {slots.slice(0, limit).map(([start, end, subject]) => {
              const current = today && nowMin >= toMinutes(start) && nowMin < toMinutes(end);
              const past = today && nowMin >= toMinutes(end);
              return (
                <div
                  key={start}
                  className={"slot" + (stacked ? " stacked" : "") + (current ? " current" : "") + (past ? " past" : "")}
                >
                  <span className="slot-time">{start}</span>
                  <span className="slot-name">{subject}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

registerWidget({
  type: "school",
  name: "Emploi du temps",
  description: "Aujourd’hui et demain, ou toute la semaine, pour chaque enfant.",
  source: "default",
  access: "emplois du temps (lecture)",
  sizes: { min: [2, 2], default: [4, 3], max: [8, 3] },
  options: [
    { key: "kid", label: "Enfant", choices: KIDS.map((k) => ({ value: k, label: k })) },
    {
      key: "span",
      label: "Affichage",
      choices: [
        { value: "2j", label: "Aujourd’hui et demain" },
        { value: "week", label: "Semaine" },
      ],
    },
  ],
  defaultOptions: { kid: KIDS[0], span: "2j" },
  defaultShowTitle: true,
  title: (o) => `Emploi du temps · ${o.kid}`,
  Component: School,
});
