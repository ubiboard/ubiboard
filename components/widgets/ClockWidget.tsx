"use client";

import { useEffect, useState } from "react";
import { registerWidget, type SettingsProps, type WidgetProps } from "@/lib/widgets";
import { useNow, useSize, useWeather } from "@/lib/hooks";
import { DAYS, DAYS_SHORT, MONTHS } from "@/lib/dates";
import { searchCities, weatherKind, weatherLabel, type City, type WeatherDay, type WeatherKind } from "@/lib/weather";
import Icon from "@/components/Icon";

const pad = (n: number) => String(n).padStart(2, "0");

const KIND_COLOR: Record<WeatherKind, string> = {
  sun: "#F5D76E",
  moon: "#C9C9D1",
  partly: "#F5D76E",
  cloud: "#A0A0A8",
  fog: "#A0A0A8",
  drizzle: "#7FB2FF",
  rain: "#7FB2FF",
  snow: "#E6E6E9",
  storm: "#FFAB66",
};

/* ------------------------------------------------------------------ */
/* Mise en page                                                        */
/* ------------------------------------------------------------------ */

/*
 * Le widget mesure sa taille en pixels et choisit la disposition qui montre le
 * plus de choses : d'abord les prévisions, puis la météo du moment, et enfin
 * l'heure la plus grande possible. Trois dispositions sont comparées :
 * - "stack"  : l'heure, la météo du moment dessous, les prévisions dessous ;
 * - "side"   : l'heure à gauche, la météo du moment à droite, les prévisions dessous ;
 * - "inline" : tout sur une ligne (widget large et bas).
 */

/** Largeur de « 00:00 » et de « :00 » (secondes), en multiples de la taille de l'heure. */
const TIME_EM = 2.62;
const SECS_EM = 0.63;
const MAX_TIME = 200;
const MIN_TIME = 28;
const GAP = 8; // entre deux blocs
const SIDE_GAP = 16; // entre deux blocs côte à côte
const FORECAST_EDGE = 9; // filet et marge au-dessus des prévisions
const COND_LINE = 17 + GAP; // ligne des conditions, avec son espacement
const MAX_DAYS = 7;
const CELL_MIN = 58; // largeur minimale d'un jour en colonne
const CELL_GAP = 6;
const CELLS_HEIGHT = 66;
const ALL_CELLS = MAX_DAYS * CELL_MIN + (MAX_DAYS - 1) * CELL_GAP;

type Forecast = { form: "cells" | "list"; count: number; rowHeight: number };
type Plan = {
  mode: "stack" | "side" | "inline";
  /** Tailles de l'heure, de la date et de la température du moment. */
  time: number;
  date: number;
  now: number;
  showNow: boolean;
  /** Disposition "stack" : conditions et min/max à côté de la température. */
  rich: boolean;
  /** Disposition "stack" étroite : conditions sur leur propre ligne. */
  cond: boolean;
  forecast: Forecast | null;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const dateSize = (time: number) => clamp(Math.round(time * 0.24), 13, 26);
const clockHeight = (time: number) => Math.ceil(time * 0.9 + 3 + dateSize(time) * 1.25);
const cellsFor = (width: number) => Math.min(MAX_DAYS, Math.floor((width + CELL_GAP) / (CELL_MIN + CELL_GAP)));

/** Les prévisions qui tiennent dans cette place : en colonnes, ou en lignes quand on en montre plus ainsi. */
function pickForecast(width: number, room: number): Forecast | null {
  const cells = cellsFor(width);
  const narrow = cells < 3;
  const rows = Math.min(MAX_DAYS, Math.floor(room / (narrow ? 24 : 26)));
  const list: Forecast | null =
    rows < 1 ? null : { form: "list", count: rows, rowHeight: Math.min(44, Math.floor(room / rows)) };
  if (narrow || rows >= MAX_DAYS || rows > cells) return list;
  return room >= CELLS_HEIGHT ? { form: "cells", count: cells, rowHeight: Math.min(room, 132) } : list;
}

function planStack(W: number, H: number, em: number, weather: boolean): Plan {
  const top = Math.min(MAX_TIME, Math.floor(W / em));
  const low = Math.min(top, MIN_TIME);
  const rich = W >= 230;
  const base = { mode: "stack" as const, rich, cond: false, forecast: null };
  const narrowForecast = cellsFor(W) < 3;
  const minForecast = FORECAST_EDGE + (narrowForecast ? 48 : CELLS_HEIGHT);

  for (const want of weather ? (["forecast", "now", "clock"] as const) : (["clock"] as const)) {
    for (let time = top; time >= low; time -= 2) {
      const clock = clockHeight(time);
      const now = rich ? clamp(Math.round(time * 0.4), 28, 56) : 20;
      const nowHeight = rich ? Math.max(now, 36) : 26;
      const sizes = { ...base, time, date: dateSize(time), now };
      if (want === "clock") {
        if (clock <= H || time - 2 < low) return { ...sizes, showNow: false };
      } else if (want === "now") {
        const left = H - clock - GAP - nowHeight;
        if (left >= 0) return { ...sizes, showNow: true, cond: !rich && left >= COND_LINE };
      } else if (clock + GAP + nowHeight + GAP + minForecast <= H) {
        const room = H - clock - nowHeight - 2 * GAP - FORECAST_EDGE;
        const forecast = pickForecast(W, room);
        if (!forecast) continue;
        // La ligne des conditions ne prend pas la place d'un jour de prévisions.
        const withCond = rich ? null : pickForecast(W, room - COND_LINE);
        if (withCond && withCond.count >= forecast.count) return { ...sizes, showNow: true, cond: true, forecast: withCond };
        return { ...sizes, showNow: true, forecast };
      }
    }
  }
  return { ...base, time: low, date: dateSize(low), now: 20, showNow: false };
}

/** Largeur réservée à la météo du moment, à droite de l'heure. */
const nowSize = (time: number) => clamp(Math.round(time * 0.5), 26, 56);
const nowWidth = (now: number) => Math.max(Math.round(now * 2.9), 112);

function planSide(W: number, H: number, em: number): Plan | null {
  const base = { mode: "side" as const, rich: false, cond: false, showNow: true };
  for (const withForecast of [true, false]) {
    for (let time = MAX_TIME; time >= 32; time -= 2) {
      const now = nowSize(time);
      if (time * em + SIDE_GAP + nowWidth(now) > W) continue;
      const row = Math.max(clockHeight(time), now + 38);
      const sizes = { ...base, time, date: dateSize(time), now };
      if (!withForecast) {
        if (row <= H) return { ...sizes, forecast: null };
      } else if (row + GAP + FORECAST_EDGE + CELLS_HEIGHT <= H) {
        const forecast = pickForecast(W, H - row - GAP - FORECAST_EDGE);
        if (forecast) return { ...sizes, forecast };
      }
    }
  }
  return null;
}

function planInline(W: number, H: number, em: number): Plan | null {
  for (let time = MAX_TIME; time >= 32; time -= 2) {
    const now = nowSize(time);
    if (time * em + nowWidth(now) + ALL_CELLS + 2 * SIDE_GAP + 12 > W) continue;
    if (Math.max(clockHeight(time), now + 38) > H) continue;
    return {
      mode: "inline",
      time,
      date: dateSize(time),
      now,
      showNow: true,
      rich: false,
      cond: false,
      forecast: { form: "cells", count: MAX_DAYS, rowHeight: Math.min(H, 132) },
    };
  }
  return null;
}

function planLayout(W: number, H: number, secs: boolean, weather: boolean): Plan {
  const em = TIME_EM + (secs ? SECS_EM : 0);
  const stack = planStack(W, H, em, weather);
  if (!weather) return stack;
  const candidates = [planSide(W, H, em), stack, planInline(W, H, em)].filter((p): p is Plan => p !== null);
  // Le plus d'informations d'abord ; à égalité, l'heure la plus grande.
  const score = (p: Plan) => (p.forecast ? 2000 : 0) + (p.showNow ? 1000 : 0) + p.time;
  return candidates.reduce((best, p) => (score(p) > score(best) ? p : best));
}

/** La date la plus complète qui tient dans cette largeur. */
function dateText(now: Date, size: number, width: number): string {
  const day = DAYS[now.getDay()];
  const shortMonth = now.toLocaleDateString("fr-FR", { month: "short" });
  const forms = [
    `${day} ${now.getDate()} ${MONTHS[now.getMonth()]}`,
    `${day} ${now.getDate()} ${shortMonth}`,
    `${DAYS_SHORT[now.getDay()]}. ${now.getDate()} ${shortMonth}`,
  ];
  return forms.find((text) => text.length * size * 0.54 <= width) ?? forms[2];
}

/* ------------------------------------------------------------------ */
/* Affichage                                                           */
/* ------------------------------------------------------------------ */

const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function ClockWeather({ options }: WidgetProps) {
  const now = useNow(1000);
  const [ref, size] = useSize<HTMLDivElement>();

  const lat = Number.parseFloat(options.lat ?? "");
  const lon = Number.parseFloat(options.lon ?? "");
  const hasCity = Number.isFinite(lat) && Number.isFinite(lon);
  const wanted = options.weather !== "off";
  const { weather, failed } = useWeather(wanted && hasCity ? lat : null, wanted && hasCity ? lon : null);

  if (!size) return <div className="cw" ref={ref} />;
  const { width: W, height: H } = size;
  const secs = options.secs === "on";
  const plan = planLayout(W, H, secs, !!weather);

  const deg = (c: number) => Math.round(options.unit === "F" ? (c * 9) / 5 + 32 : c) + "°";
  const range = (day: WeatherDay, tight = false) => (
    <span className="cw-range">
      <span className="dim">{deg(day.min)}{tight ? "/" : " / "}</span>
      {deg(day.max)}
    </span>
  );

  const clockWidth = plan.mode === "stack" ? W : W - SIDE_GAP - (plan.mode === "side" ? 112 : nowWidth(plan.now) + ALL_CELLS);
  const clock = (
    <div className="clock">
      <div className="clock-time" style={{ fontSize: plan.time }}>
        {pad(now.getHours())}:{pad(now.getMinutes())}
        {secs && <span className="clock-secs">:{pad(now.getSeconds())}</span>}
      </div>
      <div className="clock-date" style={{ fontSize: plan.date }}>{dateText(now, plan.date, clockWidth)}</div>
    </div>
  );

  // Sans météo à afficher : l'heure seule, avec un mot d'explication s'il y a la place.
  if (!weather) {
    const hint = !wanted ? "" : !hasCity ? (W >= 230 ? "Ville à choisir dans les réglages" : "Ville à choisir") : failed ? "Météo indisponible" : "";
    return (
      <div className="cw stack" ref={ref}>
        {clock}
        {hint && H - clockHeight(plan.time) >= 24 && <div className="cw-line dim ellipsis">{hint}</div>}
      </div>
    );
  }

  // Aujourd'hui dans la liste des jours (elle peut dater d'avant minuit).
  const todayIndex = Math.max(0, weather.days.findIndex((d) => d.date === isoDay(now)));
  const today = weather.days[todayIndex];
  const kind = weatherKind(weather.code, weather.isDay);
  const label = weatherLabel(weather.code);
  const title = `Météo · ${options.city ?? ""}`;
  const icon = (px: number) => <Icon name={kind} size={px} strokeWidth={1.5} color={KIND_COLOR[kind]} />;
  const temp = (px: number) => <span className="weather-temp" style={{ fontSize: px }}>{deg(weather.temp)}</span>;

  let nowBlock = null;
  if (plan.showNow && plan.mode !== "stack") {
    nowBlock = (
      <div className="cw-now column" title={title}>
        <div className="cw-now-main">{icon(plan.now)}{temp(plan.now)}</div>
        <span className="cw-line muted ellipsis">{label}</span>
        <span className="cw-line">{range(today)}</span>
      </div>
    );
  } else if (plan.showNow && plan.rich) {
    nowBlock = (
      <div className="cw-now" title={title}>
        {icon(plan.now)}
        {temp(plan.now)}
        <div className="cw-now-text">
          <span className="cw-line muted ellipsis">{label}</span>
          <span className="cw-line">{range(today)}</span>
        </div>
      </div>
    );
  } else if (plan.showNow) {
    nowBlock = (
      <>
        <div className="cw-now tight" title={title}>
          {icon(20)}
          {temp(20)}
          <span className="cw-line">{range(today, true)}</span>
        </div>
        {plan.cond && <div className="cw-line muted ellipsis">{label}</div>}
      </>
    );
  }

  let forecast = null;
  if (plan.forecast) {
    const { form, count, rowHeight } = plan.forecast;
    const days = weather.days.slice(todayIndex + 1, todayIndex + 1 + count).map((day) => {
      const [y, m, d] = day.date.split("-").map(Number);
      const weekday = new Date(y, m - 1, d).getDay();
      return { ...day, weekday, kind: weatherKind(day.code) };
    });
    if (form === "cells") {
      const cellsWidth = plan.mode === "inline" ? ALL_CELLS : W;
      const fullDay = (cellsWidth - (count - 1) * CELL_GAP) / count >= 84;
      forecast = (
        <div
          className={"cw-forecast cells" + (plan.mode === "inline" ? " beside" : "")}
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, height: plan.mode === "inline" ? undefined : rowHeight + FORECAST_EDGE }}
        >
          {days.map((day) => (
            <div key={day.date} className={"cw-cell" + (rowHeight >= 96 ? " roomy" : "")} title={weatherLabel(day.code)}>
              <span className="muted ellipsis">{fullDay ? DAYS[day.weekday] : DAYS_SHORT[day.weekday] + "."}</span>
              <Icon name={day.kind} size={rowHeight >= 96 ? 30 : 22} strokeWidth={1.6} color={KIND_COLOR[day.kind]} />
              {rowHeight >= 96 && fullDay && <span className="cw-cell-label dim ellipsis">{weatherLabel(day.code)}</span>}
              {range(day, true)}
            </div>
          ))}
        </div>
      );
    } else {
      const font = rowHeight >= 36 ? 16 : rowHeight >= 28 ? 14 : 13;
      const fullDay = W >= 200;
      forecast = (
        <div className={"cw-forecast list" + (fullDay ? "" : " tight")} style={{ fontSize: font }}>
          {days.map((day) => (
            <div key={day.date} className="cw-row" style={{ height: rowHeight }} title={weatherLabel(day.code)}>
              <span className={"cw-row-day muted" + (fullDay ? " full" : "")}>
                {fullDay ? DAYS[day.weekday] : DAYS_SHORT[day.weekday] + "."}
              </span>
              <Icon name={day.kind} size={font + 6} strokeWidth={1.6} color={KIND_COLOR[day.kind]} />
              {W >= 340 && <span className="cw-row-label dim ellipsis">{weatherLabel(day.code)}</span>}
              {range(day, !fullDay)}
            </div>
          ))}
        </div>
      );
    }
  }

  if (plan.mode === "stack") {
    return (
      <div className="cw stack" ref={ref}>
        {clock}
        {nowBlock}
        {forecast}
      </div>
    );
  }
  if (plan.mode === "inline") {
    return (
      <div className="cw inline" ref={ref}>
        {clock}
        {nowBlock}
        {forecast}
      </div>
    );
  }
  return (
    <div className="cw stack" ref={ref}>
      <div className="cw-top">
        {clock}
        {nowBlock}
      </div>
      {forecast}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Réglage de la ville                                                 */
/* ------------------------------------------------------------------ */

function ClockSettings({ options, setOptions }: SettingsProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[] | null>(null);
  const [failed, setFailed] = useState(false);
  const search = query.trim();

  useEffect(() => {
    if (search.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCities(search, controller.signal).then(
        (found) => {
          setResults(found);
          setFailed(false);
        },
        () => {
          if (!controller.signal.aborted) setFailed(true);
        }
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const choose = (city: City) => {
    setOptions({ city: city.name, cityDetail: city.detail, lat: String(city.lat), lon: String(city.lon) });
    setQuery("");
    setResults(null);
  };

  return (
    <div>
      <label className="field-label" htmlFor="clock-city">Ville de la météo</label>
      <div className="city-current">
        {options.city ? (
          <>
            <span className="strong">{options.city}</span>
            {options.cityDetail && <span className="muted small">{options.cityDetail}</span>}
          </>
        ) : (
          <span className="muted">Aucune ville choisie : la météo n’est pas affichée.</span>
        )}
      </div>
      <input
        id="clock-city"
        className="input block"
        placeholder={options.city ? "Chercher une autre ville…" : "Chercher une ville…"}
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {search.length >= 2 && failed && <div className="save-error city-note" role="alert">Recherche impossible. Vérifiez la connexion.</div>}
      {search.length >= 2 && !failed && results?.length === 0 && <div className="muted small city-note">Aucune ville trouvée.</div>}
      {search.length >= 2 && !failed && !!results?.length && (
        <div className="city-results">
          {results.map((city) => (
            <button key={`${city.lat},${city.lon},${city.name}`} className="city-result" onClick={() => choose(city)}>
              <span className="strong">{city.name}</span>
              <span className="muted small ellipsis">{city.detail}</span>
            </button>
          ))}
        </div>
      )}
      <div className="dim small city-note">Météo et recherche de ville : Open-Meteo.</div>
    </div>
  );
}

registerWidget({
  type: "clock",
  name: "Horloge et météo",
  description: "L’heure, la date, la météo du moment et les prévisions de la ville choisie.",
  source: "default",
  access: "service météo Open-Meteo (réseau)",
  sizes: { min: [1, 1], default: [3, 1], max: [6, 3] },
  options: [
    {
      key: "secs",
      label: "Secondes",
      choices: [
        { value: "off", label: "Non" },
        { value: "on", label: "Oui" },
      ],
    },
    {
      key: "weather",
      label: "Météo",
      choices: [
        { value: "on", label: "Afficher" },
        { value: "off", label: "Masquer" },
      ],
    },
    {
      key: "unit",
      label: "Unité",
      choices: [
        { value: "C", label: "°C" },
        { value: "F", label: "°F" },
      ],
    },
  ],
  defaultOptions: { secs: "off", weather: "on", unit: "C" },
  defaultShowTitle: false,
  title: () => "Horloge et météo",
  Settings: ClockSettings,
  Component: ClockWeather,
});
