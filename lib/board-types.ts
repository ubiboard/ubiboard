// Types partagés entre le serveur et le navigateur (aucune dépendance serveur ici).

export type BoardRole = "admin" | "member";

export type Cell = { i: string; x: number; y: number; w: number; h: number };

export type PlacedWidget = {
  /** Identifiant de l'instance (on peut avoir deux horloges). */
  id: string;
  type: string;
  showTitle: boolean;
  /** Titre personnalisé ; null = titre par défaut du widget. */
  title: string | null;
  options: Record<string, string>;
  /** Identifiant de la liste de données du widget. */
  dataId: string;
};

/** Espace autour des widgets : aéré, normal, ou compact (les widgets se touchent). */
export type Density = "roomy" | "normal" | "compact";
export const DENSITIES: Density[] = ["roomy", "normal", "compact"];

/** Réglages d'écran d'une vue : atténuation, anti-rémanence, taille de la grille et densité. */
export type ScreenSettings = {
  dim: boolean;
  drift: boolean;
  /** Nombre de colonnes de la grille. */
  cols: number;
  /** Nombre de lignes visibles sans défilement. */
  rows: number;
  density: Density;
};

export const GRID_DEFAULT = { cols: 12, rows: 5 };
export const GRID_LIMITS = { cols: { min: 4, max: 24 }, rows: { min: 3, max: 16 } };

const intIn = (value: unknown, range: { min: number; max: number }, fallback: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= range.min && value <= range.max ? value : fallback;

/** Réglages d'écran complets et valides, quelle que soit la forme reçue (ancienne vue, saisie…). */
export function normalizeScreen(raw: Partial<ScreenSettings> | null | undefined): ScreenSettings {
  return {
    dim: !!raw?.dim,
    drift: !!raw?.drift,
    cols: intIn(raw?.cols, GRID_LIMITS.cols, GRID_DEFAULT.cols),
    rows: intIn(raw?.rows, GRID_LIMITS.rows, GRID_DEFAULT.rows),
    density: DENSITIES.includes(raw?.density as Density) ? (raw?.density as Density) : "normal",
  };
}

/** Une vue : les widgets, leur placement et les réglages d'écran. */
export type BoardState = {
  widgets: PlacedWidget[];
  layout: Cell[];
  screen: ScreenSettings;
};

/** Un élément de données d'un widget (un article, une note…). */
export type DataItem<T = Record<string, unknown>> = { id: string; content: T };

/** Une personne du board : un compte qui y a accès. */
export type Person = { userId: string; name: string; role: BoardRole; color: string };

/** Couleurs proposées pour les personnes (lisibles sur fond noir). */
export const PERSON_COLORS = [
  "#7FB2FF",
  "#FFAB66",
  "#E59CF0",
  "#F5D76E",
  "#8FE3B8",
  "#FF9B8A",
  "#8FDDE3",
  "#C9C9D1",
];
