"use client";

import { registerWidget, type WidgetProps } from "@/lib/widgets";
import { useNow } from "@/lib/hooks";
import { CITY, DAYS_SHORT, WEATHER, type WeatherKind } from "@/lib/demo-data";
import Icon from "@/components/Icon";

const KIND_COLOR: Record<WeatherKind, string> = {
  sun: "#F5D76E",
  cloud: "#A0A0A8",
  rain: "#7FB2FF",
};

function Weather({ w, h, options }: WidgetProps) {
  const now = useNow(60_000);
  const deg = (c: number) => (options.unit === "F" ? Math.round((c * 9) / 5 + 32) : c) + "°";
  const tall = h >= 2;
  const narrow = w === 1;
  const big = narrow ? 32 : tall ? 56 : 40;
  const range = `Min ${deg(WEATHER.min)} · Max ${deg(WEATHER.max)}`;
  const forecastRow = w >= 4 && h >= 2;
  const forecastCol = !forecastRow && h >= 3;
  const days = WEATHER.forecast.slice(0, forecastRow ? 5 : 3).map((f) => {
    const d = new Date(now);
    d.setDate(now.getDate() + f.offset);
    return { ...f, label: DAYS_SHORT[d.getDay()] };
  });

  return (
    <div className="weather">
      <div className="weather-now" style={narrow ? { gap: 8 } : undefined}>
        <span style={{ display: "inline-flex", flex: "none" }}>
          <Icon name={WEATHER.kind} size={big} strokeWidth={1.5} color={KIND_COLOR[WEATHER.kind]} />
        </span>
        <div>
          <div className="weather-temp" style={{ fontSize: big }}>{deg(WEATHER.temp)}</div>
          {tall && !narrow && <div className="muted">{WEATHER.condition}</div>}
        </div>
        {!tall && !narrow && (
          <div className="weather-side muted">
            <span>{WEATHER.condition}</span>
            <span>{range}</span>
          </div>
        )}
      </div>
      {tall && <div className="muted">{narrow ? WEATHER.condition : range}</div>}
      {forecastRow && (
        <div className="forecast-row">
          {days.map((f) => (
            <div key={f.offset} className="forecast-cell">
              <span className="dim small">{f.label}</span>
              <Icon name={f.kind} size={28} strokeWidth={1.6} color={KIND_COLOR[f.kind]} />
              <span className="strong">{deg(f.hi)}</span>
              <span className="dim small">{deg(f.lo)}</span>
            </div>
          ))}
        </div>
      )}
      {forecastCol && (
        <div className="forecast-col">
          {days.map((f) => (
            <div key={f.offset} className="forecast-line">
              <span className="muted" style={{ width: 40 }}>{f.label}</span>
              <Icon name={f.kind} size={28} strokeWidth={1.6} color={KIND_COLOR[f.kind]} />
              <span className="strong" style={{ marginLeft: "auto" }}>{deg(f.hi)}</span>
              <span className="dim" style={{ width: 36, textAlign: "right" }}>{deg(f.lo)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

registerWidget({
  type: "weather",
  name: "Météo",
  description: "Conditions actuelles et prévisions pour votre ville.",
  source: "default",
  access: "service météo (réseau)",
  sizes: { min: [1, 1], default: [2, 1], max: [4, 3] },
  options: [
    {
      key: "unit",
      label: "Unité",
      choices: [
        { value: "C", label: "°C" },
        { value: "F", label: "°F" },
      ],
    },
  ],
  defaultOptions: { unit: "C" },
  defaultShowTitle: true,
  title: () => `Météo · ${CITY}`,
  Component: Weather,
});
