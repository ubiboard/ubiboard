import type { ComponentType } from "react";

/**
 * Registre central des widgets.
 *
 * Un widget = un plugin autonome affichable sur la grille. La définition
 * reprend la forme du futur manifeste de plugin (tailles, accès, réglages
 * déclaratifs) : la modale de configuration et le catalogue d'ajout sont
 * générés à partir d'elle, sans code spécifique par widget.
 */

/** Un réglage à choix unique, affiché sous forme de pastilles dans la modale. */
export type WidgetOption = {
  key: string;
  label: string;
  choices: { value: string; label: string }[];
};

export type WidgetOptions = Record<string, string>;

/** Ce que reçoit le composant d'un widget. */
export type WidgetProps = {
  /** Largeur et hauteur en cases de grille. */
  w: number;
  h: number;
  /** Hauteur utile en pixels (hors marges et titre), pour savoir combien de lignes afficher. */
  bodyHeight: number;
  options: WidgetOptions;
};

export type WidgetDefinition = {
  /** Identifiant unique du type de widget, ex. "clock". */
  type: string;
  name: string;
  description: string;
  source: "default" | "community";
  /** Ce à quoi le widget accède, affiché dans la boutique. */
  access: string;
  /** Tailles en cases de grille : [colonnes, lignes]. */
  sizes: {
    min: [number, number];
    default: [number, number];
    max: [number, number];
  };
  options: WidgetOption[];
  defaultOptions: WidgetOptions;
  /** Le titre est-il affiché par défaut à l'ajout ? */
  defaultShowTitle: boolean;
  /** Titre affiché en haut du widget (peut dépendre des réglages). */
  title: (options: WidgetOptions) => string;
  Component: ComponentType<WidgetProps>;
};

const REGISTRY: Record<string, WidgetDefinition> = {};

export function registerWidget(def: WidgetDefinition) {
  REGISTRY[def.type] = def;
}

export function getWidget(type: string): WidgetDefinition | undefined {
  return REGISTRY[type];
}

export function listWidgets(): WidgetDefinition[] {
  return Object.values(REGISTRY);
}

/** Nombre de lignes de liste (46 px) qui tiennent dans la hauteur utile. */
export function rowsFit(bodyHeight: number, reserved = 0, rowHeight = 46): number {
  return Math.max(1, Math.floor((bodyHeight - reserved) / rowHeight));
}
