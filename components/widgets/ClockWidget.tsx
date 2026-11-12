"use client";

import { registerWidget, type WidgetProps } from "@/lib/widgets";
import { useNow } from "@/lib/hooks";
import { DAYS, MONTHS } from "@/lib/demo-data";

const pad = (n: number) => String(n).padStart(2, "0");

function Clock({ w, h, options }: WidgetProps) {
  const now = useNow(1000);
  const timeSize = h === 1 ? 56 : w >= 4 ? 132 : w === 3 ? 104 : 78;
  const dateSize = w >= 4 ? 26 : w === 3 ? 20 : 17;
  return (
    <div className="clock">
      <div className="clock-time" style={{ fontSize: timeSize }}>
        {pad(now.getHours())}:{pad(now.getMinutes())}
        {options.secs === "on" && <span className="clock-secs">:{pad(now.getSeconds())}</span>}
      </div>
      <div className="clock-date" style={{ fontSize: dateSize }}>
        {DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]}
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
  sizes: { min: [2, 1], default: [2, 1], max: [4, 2] },
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
