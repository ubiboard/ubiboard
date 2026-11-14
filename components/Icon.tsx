import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudSnow,
  CloudSun,
  Moon,
  Search,
  Copy,
  CloudRain,
  House,
  LogOut,
  Minus,
  Move,
  MoveDiagonal2,
  Pencil,
  Plus,
  Repeat,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Sun,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

// Icônes Lucide (licence ISC), regroupées ici pour n'avoir qu'un point d'entrée.
const ICONS = {
  home: House,
  pencil: Pencil,
  plus: Plus,
  minus: Minus,
  close: X,
  check: Check,
  sliders: SlidersHorizontal,
  trash: Trash2,
  gear: Settings,
  move: Move,
  resize: MoveDiagonal2,
  back: ArrowLeft,
  calendar: Calendar,
  cart: ShoppingCart,
  repeat: Repeat,
  sun: Sun,
  cloud: Cloud,
  rain: CloudRain,
  moon: Moon,
  partly: CloudSun,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  snow: CloudSnow,
  storm: CloudLightning,
  search: Search,
  logout: LogOut,
  users: Users,
  copy: Copy,
  previous: ChevronLeft,
  next: ChevronRight,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

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
  const Glyph = ICONS[name];
  return <Glyph size={size} strokeWidth={strokeWidth} color={color} aria-hidden="true" />;
}
