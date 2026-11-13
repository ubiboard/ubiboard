"use client";

import { registerWidget, type WidgetProps } from "@/lib/widgets";
import { useNow } from "@/lib/hooks";
import { CITY, DAYS, DAYS_SHORT, MONTHS, WEATHER, type WeatherKind } from "@/lib/demo-data";
import Icon from "@/components/Icon";

const pad = (n: number) => String(n).padStart(2, "0");

const KIND_COLOR: Record<WeatherKind, string> = {
  sun: "#F5D76E",
  cloud: "#A0A0A8",
  rain: "#7FB2FF",
};

/**
 * L'heure, la date et la météo dans un seul widget. Selon la place :
 * - étroit : l'heure, la date abrégée et la température ;
 * - une ligne : l'heure et la date à gauche, la météo du moment à droite ;
 * - plus haut : la météo passe dessous, avec les prévisions s'il reste de la place.
 */
function ClockWeather({ w, h, options }: WidgetProps) {
  const now = useNow(1000);
  const narrow = w <= 2;
  const tall = h >= 2;
  const showWeather = options.weather !== "off";

  const timeSize = narrow ? 44 : !tall ? 56 : w >= 6 ? 120 : w >= 4 ? 96 : 72;
  const dateSize = narrow ? 14 : w >= 6 && tall ? 24 : w >= 4 && tall ? 20 : 17;
  const date = narrow
    ? now.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
    : `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  const deg = (c: number) => (options.unit === "F" ? Math.round((c * 9) / 5 + 32) : c) + "°";
  const range = `Min ${deg(WEATHER.min)} · Max ${deg(WEATHER.max)}`;
  const iconSize = narrow ? 22 : tall ? 44 : 36;
  // Sur une seule ligne, le détail (conditions, min et max) ne tient qu'à partir de 4 colonnes.
  const showDetail = !narrow && (tall || w >= 4);

  // Prévisions : seulement quand le widget est assez haut.
  const forecastCount = !showWeather || !tall ? 0 : h >= 3 || w >= 6 ? (w >= 6 ? 5 : w >= 4 ? 4 : 3) : 0;
  const forecast = WEATHER.forecast.slice(0, forecastCount).map((f) => {
    const d = new Date(now);
    d.setDate(now.getDate() + f.offset);
    return { ...f, label: DAYS_SHORT[d.getDay()] };
  });

  const clock = (
    <div className="clock">
      <div className="clock-time" style={{ fontSize: timeSize }}>
        {pad(now.getHours())}:{pad(now.getMinutes())}
        {options.secs === "on" && !narrow && <span className="clock-secs">:{pad(now.getSeconds())}</span>}
      </div>
      <div className="clock-date" style={{ fontSize: dateSize }}>{date}</div>
    </div>
  );

  const weather = showWeather && (
    <div className={"cw-weather" + (narrow ? " narrow" : "")} title={`Météo · ${CITY}`}>
      <Icon name={WEATHER.kind} size={iconSize} strokeWidth={1.5} color={KIND_COLOR[WEATHER.kind]} />
      <span className="weather-temp" style={{ fontSize: narrow ? 20 : tall ? 44 : 36 }}>{deg(WEATHER.temp)}</span>
      {showDetail && (
        <span className="cw-weather-text muted">
          <span className="ellipsis">{WEATHER.condition}</span>
          <span className="ellipsis">{range}</span>
        </span>
      )}
    </div>
  );

  return (
    <div className={"cw" + (tall || narrow ? " stacked" : "")}>
      {clock}
      {weather}
      {forecast.length > 0 && (
        <div className="forecast-row" style={{ gridTemplateColumns: `repeat(${forecast.length}, minmax(0, 1fr))` }}>
          {forecast.map((f) => (
            <div key={f.offset} className="forecast-cell">
              <span className="dim small">{f.label}</span>
              <Icon name={f.kind} size={24} strokeWidth={1.6} color={KIND_COLOR[f.kind]} />
              <span className="strong">{deg(f.hi)}</span>
              <span className="dim small">{deg(f.lo)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

registerWidget({
  type: "clock",
  name: "Horloge et météo",
  description: "L’heure, la date et la météo du moment, lisibles de loin.",
  source: "default",
  access: "service météo (réseau)",
  sizes: { min: [2, 1], default: [3, 1], max: [6, 3] },
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
  Component: ClockWeather,
});
