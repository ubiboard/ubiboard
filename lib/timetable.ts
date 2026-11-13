/**
 * Emploi du temps : des créneaux par jour de la semaine, et le calcul de leur
 * position à l'écran.
 */

export type Slot = {
  /** Jour de la semaine, 0 = dimanche … 6 = samedi. */
  day: number;
  /** Heures au format « HH:MM ». */
  start: string;
  end: string;
  name: string;
  /** Couleur de fond ; null = le gris par défaut. */
  color: string | null;
};

/** Le lien iCal qui synchronise l'emploi du temps. Le navigateur ne reçoit jamais le lien lui-même. */
export type IcalLink = { kind: "ical"; hasUrl?: boolean; url?: string };

/** Un élément de la liste de données du widget. */
export type SchoolItem = Slot | IcalLink;

export const isIcalLink = (item: SchoolItem): item is IcalLink => (item as IcalLink).kind === "ical";

/** Couleurs de fond proposées pour un créneau (sombres, le texte reste clair). */
export const SLOT_COLORS: { value: string | null; label: string }[] = [
  { value: null, label: "Gris" },
  { value: "#1c2c4a", label: "Bleu" },
  { value: "#17382b", label: "Vert" },
  { value: "#3d3413", label: "Jaune" },
  { value: "#43280f", label: "Orange" },
  { value: "#44201f", label: "Rouge" },
  { value: "#3a2145", label: "Violet" },
  { value: "#12383b", label: "Turquoise" },
];

export const DEFAULT_SLOT_COLOR = "#131316";

/**
 * Une couleur stable pour un cours synchronisé : la même matière a toujours la
 * même couleur, sans que personne ait à la choisir.
 */
export function colorForTitle(title: string): string | null {
  const palette = SLOT_COLORS.slice(1); // sans le gris, réservé aux créneaux sans intitulé
  const key = title.trim().toLowerCase();
  if (!key || key === "(sans titre)") return null;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return palette[hash % palette.length].value;
}

export const toMinutes = (time: string) => parseInt(time.slice(0, 2), 10) * 60 + parseInt(time.slice(3, 5), 10);

export const isValidTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

export type Axis = {
  /** Hauteur totale en pixels. */
  height: number;
  /** Position verticale d'une heure (en minutes depuis minuit). */
  y: (minutes: number) => number;
};

/**
 * Construit l'axe vertical commun à tous les jours affichés.
 *
 * - Un créneau occupe une hauteur proportionnelle à sa durée : deux heures
 *   prennent deux fois plus de place qu'une heure.
 * - Deux créneaux à la même heure sont à la même hauteur d'un jour à l'autre.
 * - Une plage où AUCUN des jours affichés n'a de cours est réduite à un petit
 *   espace fixe : on voit qu'il y a un trou, sans lui donner toute sa durée.
 */
export function buildAxis(
  slots: Pick<Slot, "start" | "end">[],
  available: number,
  { gap = 14, minScale = 0.3, maxScale = 1.3 } = {}
): Axis {
  const ranges = slots
    .map((s) => [toMinutes(s.start), toMinutes(s.end)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  if (ranges.length === 0) return { height: 0, y: () => 0 };

  // Plages occupées par au moins un jour, fusionnées.
  const busy: [number, number][] = [];
  for (const [a, b] of ranges) {
    const last = busy[busy.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else busy.push([a, b]);
  }

  const minutes = busy.reduce((sum, [a, b]) => sum + (b - a), 0);
  const gaps = busy.length - 1;
  const scale = Math.min(maxScale, Math.max(minScale, (available - gaps * gap) / minutes));

  const tops: number[] = [];
  let cursor = 0;
  for (const [a, b] of busy) {
    tops.push(cursor);
    cursor += (b - a) * scale + gap;
  }

  return {
    height: cursor - gap,
    y: (t) => {
      // Dernière plage qui commence avant (ou à) cette heure.
      let i = 0;
      while (i < busy.length - 1 && t >= busy[i + 1][0]) i++;
      const [a, b] = busy[i];
      return tops[i] + (Math.min(Math.max(t, a), b) - a) * scale;
    },
  };
}
