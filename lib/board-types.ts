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

export type ScreenSettings = { dim: boolean; drift: boolean };

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

export const GRID_COLS = 12;
