"use client";

import { useEffect, useState } from "react";
import { registerWidget, rowsFit, type WidgetProps } from "@/lib/widgets";
import { HeaderActions, useWidgetData } from "@/lib/board-context";
import { useCalendarEvents } from "@/lib/use-calendar-events";
import { useNow } from "@/lib/hooks";
import { DAYS, DAYS_SHORT, MONTHS } from "@/lib/dates";
import {
  CALENDAR_VIEWS,
  addDays,
  dayKey,
  eventsOn,
  mondayOf,
  sameDay,
  startOfDay,
  timeLabel,
  type CalendarEvent,
  type CalendarSource,
  type CalendarView,
} from "@/lib/calendar";
import Icon from "@/components/Icon";
import CalendarManager from "./CalendarManager";

const BACK_TO_TODAY_MS = 2 * 60_000;
const LIST_DAYS = 45; // la vue liste regarde un mois et demi devant elle

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Calendar({ w, bodyHeight, options, dataId }: WidgetProps) {
  const { items: sources, loading: sourcesLoading } = useWidgetData<CalendarSource>(dataId);
  const now = useNow(60_000);
  const today = startOfDay(now);

  const view: CalendarView = CALENDAR_VIEWS.some((v) => v.value === options.view) ? (options.view as CalendarView) : "week";
  // Décalage par rapport à aujourd'hui, dans l'unité de la vue (mois, semaines, jours).
  const [shift, setShift] = useState(0);

  // Le type de vue se règle dans la configuration du widget ; quand il change, on revient à aujourd'hui.
  useEffect(() => setShift(0), [view]);

  // Un écran mural ne doit pas rester sur une autre période : retour à aujourd'hui après un moment.
  useEffect(() => {
    if (shift === 0) return;
    const timer = setTimeout(() => setShift(0), BACK_TO_TODAY_MS);
    return () => clearTimeout(timer);
  }, [shift]);

  // Période affichée (et lue sur le serveur) selon la vue.
  let from: Date;
  let dayCount: number;
  let label: string;
  const monthStart = new Date(today.getFullYear(), today.getMonth() + shift, 1);
  if (view === "month") {
    from = mondayOf(monthStart);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    dayCount = Math.round((addDays(mondayOf(monthEnd), 7).getTime() - from.getTime()) / 86_400_000);
    label = `${capitalize(MONTHS[monthStart.getMonth()])} ${monthStart.getFullYear()}`;
  } else if (view === "week") {
    from = addDays(mondayOf(today), shift * 7);
    dayCount = 7;
    const last = addDays(from, 6);
    label = `${from.getDate()}${from.getMonth() === last.getMonth() ? "" : " " + MONTHS[from.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]}`;
  } else if (view === "day") {
    from = addDays(today, shift);
    dayCount = 1;
    label = `${DAYS[from.getDay()]} ${from.getDate()} ${MONTHS[from.getMonth()]}`;
  } else {
    from = addDays(today, shift * 7);
    dayCount = LIST_DAYS;
    label = shift === 0 ? "À venir" : `À partir du ${from.getDate()} ${MONTHS[from.getMonth()]}`;
  }
  const to = addDays(from, dayCount);

  const sourcesKey = sources.map((s) => s.id).join(",");
  const { events, errors, loading, failed } = useCalendarEvents(dataId, from, to, sourcesKey, sources.length > 0);
  const colorOf = (event: CalendarEvent) => sources.find((s) => s.id === event.sourceId)?.content.color ?? "#C9C9D1";
  const days = Array.from({ length: dayCount }, (_, i) => addDays(from, i));
  const available = bodyHeight;

  // Navigation en haut à droite du widget, sur la ligne du titre.
  const bar = (
    <HeaderActions>
      {w >= 5 && <span className="bar-label ellipsis">{label}</span>}
      {shift !== 0 && (
        <button className="bar-chip" onClick={() => setShift(0)}>{w >= 6 ? "Aujourd’hui" : "Auj."}</button>
      )}
      <button className="bar-btn" aria-label="Période précédente" title="Précédent" onClick={() => setShift(shift - 1)}>
        <Icon name="previous" size={16} />
      </button>
      <button className="bar-btn" aria-label="Période suivante" title="Suivant" onClick={() => setShift(shift + 1)}>
        <Icon name="next" size={16} />
      </button>
    </HeaderActions>
  );

  let content;
  if (sourcesLoading || (loading && events.length === 0)) {
    content = <div className="dim small">Chargement…</div>;
  } else if (sources.length === 0) {
    content = <div className="dim small">Aucun agenda connecté. Un administrateur peut en ajouter en mode édition.</div>;
  } else if (view === "month") {
    const weeks = dayCount / 7;
    const cellHeight = Math.floor((available - 24 - (weeks - 1) * 4) / weeks);
    const chips = Math.max(0, Math.floor((cellHeight - 22) / 17));
    content = (
      <div className="cal-month">
        <div className="cal-month-head">
          {days.slice(0, 7).map((d) => (
            <span key={d.getDay()}>{DAYS_SHORT[d.getDay()]}</span>
          ))}
        </div>
        <div className="cal-month-grid" style={{ gridAutoRows: cellHeight }}>
          {days.map((d) => {
            const list = eventsOn(events, d);
            const shown = list.length > chips ? list.slice(0, Math.max(0, chips - 1)) : list;
            return (
              <div
                key={dayKey(d)}
                className={"cal-cell" + (sameDay(d, today) ? " today" : "") + (d.getMonth() !== monthStart.getMonth() ? " other" : "")}
              >
                <span className="cal-cell-num">
                  {d.getDate()}
                  {/* Case trop basse pour des titres : une pastille par événement. */}
                  {chips === 0 &&
                    list.slice(0, 4).map((e) => (
                      <span key={e.id} className="dot small" style={{ background: colorOf(e) }} title={e.title} />
                    ))}
                </span>
                {chips > 0 && shown.map((e) => (
                  <span key={e.id} className="cal-chip" title={`${timeLabel(e, d)} ${e.title}`.trim()}>
                    <span className="dot small" style={{ background: colorOf(e) }} />
                    <span className="ellipsis">{e.title}</span>
                  </span>
                ))}
                {chips > 0 && list.length > shown.length && <span className="cal-more">+{list.length - shown.length}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  } else if (view === "week") {
    const perDay = Math.max(1, Math.floor((available - 40) / 52));
    content = (
      <div className="cal-days" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {days.map((d) => {
          const list = eventsOn(events, d);
          const shown = list.length > perDay ? list.slice(0, perDay - 1) : list;
          return (
            <div key={dayKey(d)} className="cal-day">
              <div className={"day-head" + (sameDay(d, today) ? " today" : "")}>
                <span className="day-label">{DAYS_SHORT[d.getDay()]}</span>
                <span className="day-num">{d.getDate()}</span>
              </div>
              {shown.map((e) => (
                <div key={e.id} className="card" title={e.title}>
                  <span className="card-time">
                    <span className="dot" style={{ background: colorOf(e) }} />
                    {timeLabel(e, d) || (e.allDay ? "Journée" : "Suite")}
                  </span>
                  <span className="card-name">{e.title}</span>
                </div>
              ))}
              {list.length > shown.length && <span className="cal-more">+{list.length - shown.length} autres</span>}
            </div>
          );
        })}
      </div>
    );
  } else {
    // Vues « jour » et « liste » : une ligne par événement.
    const rows = days.flatMap((d) => eventsOn(events, d).map((e) => ({ day: d, event: e })));
    const visible = rows.slice(0, rowsFit(available));
    const when = (d: Date) => {
      if (view === "day") return "";
      const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
      return diff === 0 ? "Auj." : diff === 1 ? "Dem." : `${DAYS_SHORT[d.getDay()]} ${d.getDate()}`;
    };
    content =
      rows.length === 0 ? (
        <div className="dim small">{view === "day" ? "Rien de prévu ce jour-là." : "Rien de prévu dans les prochaines semaines."}</div>
      ) : (
        <div className="list">
          {visible.map(({ day, event }) => (
            <div key={event.id + dayKey(day)} className="list-row">
              <span className="dot" style={{ background: colorOf(event) }} />
              <span className="muted small cal-when">
                {[when(day), timeLabel(event, day) || (event.allDay ? "journée" : "suite")].filter(Boolean).join(" ")}
              </span>
              <span className="ellipsis">{event.title}</span>
            </div>
          ))}
        </div>
      );
  }

  return (
    <>
      {bar}
      {(failed || errors.length > 0) && (
        <div className="widget-error" style={{ margin: "0 0 6px" }}>
          {failed ? "Agendas indisponibles pour le moment." : `${errors.length} agenda${errors.length > 1 ? "s" : ""} illisible${errors.length > 1 ? "s" : ""}.`}
        </div>
      )}
      {content}
    </>
  );
}

registerWidget({
  type: "calendar",
  name: "Calendrier",
  description: "Vos agendas Google ou autres (lien iCal), par mois, semaine, jour ou en liste.",
  source: "default",
  access: "agendas connectés (lecture, via le serveur)",
  storesData: true,
  sizes: { min: [3, 2], default: [9, 3], max: [12, 5] },
  options: [{ key: "view", label: "Vue", choices: CALENDAR_VIEWS }],
  defaultOptions: { view: "week" },
  defaultShowTitle: true,
  headerActions: true,
  title: () => "Calendrier",
  Component: Calendar,
  Manager: CalendarManager,
  managerTitle: "Calendrier",
});
