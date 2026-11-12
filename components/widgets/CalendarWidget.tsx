"use client";

import { registerWidget, rowsFit, type WidgetProps } from "@/lib/widgets";
import { useNow } from "@/lib/hooks";
import { DAYS_SHORT, EVENTS, MEMBER_COLORS, WHO_CHOICES } from "@/lib/demo-data";

function Calendar({ w, h, bodyHeight, options }: WidgetProps) {
  const now = useNow(60_000);
  const who = options.who;
  const days = EVENTS.map((events, offset) => {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    return {
      offset,
      label: DAYS_SHORT[d.getDay()],
      num: d.getDate(),
      events: events.filter((e) => who === "Tous" || e.who === "Famille" || e.who === who),
    };
  });

  // Large : une colonne par jour. Étroit : liste des prochains événements.
  if (w >= 4) {
    const dayCount = w >= 7 ? 7 : 5;
    const perDay = h >= 4 ? 5 : h === 3 ? 3 : 2;
    return (
      <div className="cal-days" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }}>
        {days.slice(0, dayCount).map((d) => (
          <div key={d.offset} className="cal-day">
            <div className={"day-head" + (d.offset === 0 ? " today" : "")}>
              <span className="day-label">{d.label}</span>
              <span className="day-num">{d.num}</span>
            </div>
            {d.events.slice(0, perDay).map((e) => (
              <div key={e.time + e.name} className="card">
                <span className="card-time">
                  <span className="dot" style={{ background: MEMBER_COLORS[e.who] }} />
                  {e.time}
                </span>
                <span className="card-name">{e.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const upcoming = days.flatMap((d) =>
    d.events.map((e) => ({
      ...e,
      when: (d.offset === 0 ? "Auj." : d.offset === 1 ? "Dem." : `${d.label} ${d.num}`) + " " + e.time,
    }))
  );
  return (
    <div className="list">
      {upcoming.slice(0, rowsFit(bodyHeight)).map((e) => (
        <div key={e.when + e.name} className="list-row">
          <span className="dot" style={{ background: MEMBER_COLORS[e.who] }} />
          <span className="muted small" style={{ width: 78, flex: "none" }}>{e.when}</span>
          <span className="ellipsis">{e.name}</span>
        </div>
      ))}
    </div>
  );
}

registerWidget({
  type: "calendar",
  name: "Calendrier",
  description: "L’agenda de toute la famille, filtrable par membre.",
  source: "default",
  access: "agenda du foyer (lecture)",
  sizes: { min: [2, 2], default: [4, 3], max: [8, 5] },
  options: [{ key: "who", label: "Membre affiché", choices: WHO_CHOICES }],
  defaultOptions: { who: "Tous" },
  defaultShowTitle: true,
  title: (o) => "Calendrier" + (o.who === "Tous" ? "" : ` · ${o.who}`),
  Component: Calendar,
});
