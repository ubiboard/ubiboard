"use client";

import { registerWidget, type WidgetProps } from "@/lib/widgets";
import { useNow } from "@/lib/hooks";
import { DAYS, MONTHS } from "@/lib/demo-data";

const pad = (n: number) => String(n).padStart(2, "0");

function Clock({ w, h, options }: WidgetProps) {
  const now = useNow(1000);
  const narrow = w <= 2;
  const timeSize = narrow ? 44 : h === 1 ? 56 : w >= 6 ? 132 : w >= 4 ? 104 : 78;
  const dateSize = narrow ? 14 : w >= 6 ? 26 : w >= 4 ? 20 : 17;
  // Sur une seule colonne : pas de secondes, date abrégée.
  const date = narrow
    ? now.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
    : `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  return (
    <div className="clock">
      <div className="clock-time" style={{ fontSize: timeSize }}>
        {pad(now.getHours())}:{pad(now.getMinutes())}
        {options.secs === "on" && !narrow && <span className="clock-secs">:{pad(now.getSeconds())}</span>}
      </div>
      <div className="clock-date" style={{ fontSize: dateSize }}>
        {date}
      </div>
    </div>
  );
}

registerWidget({
  type: "clock",
  name: "Horloge",
  description: "Heure et date, lisibles de loin.",
  source: "default",
  access: "aucun",
  sizes: { min: [2, 1], default: [3, 1], max: [6, 2] },
  options: [
    {
      key: "secs",
      label: "Secondes",
      choices: [
        { value: "off", label: "Non" },
        { value: "on", label: "Oui" },
      ],
    },
  ],
  defaultOptions: { secs: "off" },
  defaultShowTitle: false,
  title: () => "Horloge",
  Component: Clock,
});
