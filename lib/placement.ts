import { type Compactor, type Layout, type LayoutItem } from "react-grid-layout";

export type Cell = { i: string; x: number; y: number; w: number; h: number };

/** Le widget en cours de déplacement/redimensionnement et la disposition au moment où le geste a commencé. */
export type MoveSession = { id: string; origin: Cell[] };

const overlaps = (a: Cell, b: Cell) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Placement libre avec gestion des collisions.
 *
 * Hors geste : rien ne bouge, les trous sont permis.
 * Pendant un geste : la disposition est recalculée à chaque pas À PARTIR DE
 * CELLE D'ORIGINE. Les widgets recouverts par celui qu'on déplace sont poussés
 * vers le bas (en cascade) ; dès qu'ils ne sont plus recouverts, ils
 * retrouvent leur place d'origine.
 */
export function createPushCompactor(session: { current: MoveSession | null }): Compactor {
  return {
    type: null,
    allowOverlap: true, // la grille ne pousse rien elle-même : compact() s'en charge
    compact(layout: Layout): Layout {
      const move = session.current;
      const moving = move && layout.find((item) => item.i === move.id);
      if (!move || !moving) return layout;

      const placed: Cell[] = [moving];
      const positions = new Map<string, { x: number; y: number }>();

      // De haut en bas, pour que les poussées se propagent vers le bas.
      const others = move.origin
        .filter((cell) => cell.i !== move.id)
        .sort((a, b) => a.y - b.y || a.x - b.x);

      for (const origin of others) {
        const cell = { ...origin };
        for (;;) {
          const blockers = placed.filter((p) => overlaps(p, cell));
          if (blockers.length === 0) break;
          cell.y = Math.max(...blockers.map((p) => p.y + p.h));
        }
        placed.push(cell);
        positions.set(cell.i, { x: cell.x, y: cell.y });
      }

      return layout.map((item): LayoutItem => {
        const pos = positions.get(item.i);
        return pos ? { ...item, ...pos } : item;
      });
    },
  };
}
