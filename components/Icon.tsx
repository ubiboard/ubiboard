import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  home: <><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-6h4v6" /></>,
  pencil: <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  move: <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />,
  resize: <path d="M20 10v10H10M20 20L9 9" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M8 3v4M16 3v4" /></>,
  cart: <><path d="M3 4h2.5l2.2 10.5h10L20 7H7" /><circle cx="9.5" cy="19" r="1.3" /><circle cx="16.5" cy="19" r="1.3" /></>,
  repeat: <><path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3" /><path d="M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>,
  cloud: <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5a4.25 4.25 0 0 1 0 8.5H7z" />,
  rain: <><path d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 5.5a4.25 4.25 0 0 1 .5 8.5H7z" /><path d="M8 17.5l-1 2.5M12 17.5l-1 2.5M16 17.5l-1 2.5" /></>,
};

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  color = "currentColor",
}: {
  name: IconName;
  size?: number | string;
  strokeWidth?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
