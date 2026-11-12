"use client";

import { registerWidget, rowsFit, type WidgetProps } from "@/lib/widgets";
import { CHORES, MEMBER_COLORS, WHO_CHOICES } from "@/lib/demo-data";

/**
 * Affichage seul, sur données factices. Le modèle de corvées (rotations de
 * rôles, responsabilités cochables ou non) et sa configuration sont à venir.
 */
function Chores({ bodyHeight, options }: WidgetProps) {
  const who = options.who;
  const items = CHORES.filter((c) => who === "Tous" || c.who === who).slice(0, rowsFit(bodyHeight));
  if (items.length === 0) return <div className="dim">Aucune corvée.</div>;
  return (
    <div className="list">
      {items.map((c) => (
        <div key={c.name} className="list-row">
          <span className="chore-name">{c.name}</span>
          <span className="badge" style={{ background: MEMBER_COLORS[c.who] }}>{c.who.charAt(0)}</span>
          <span className="chore-who" style={{ color: MEMBER_COLORS[c.who] }}>{c.who}</span>
        </div>
      ))}
    </div>
  );
}

registerWidget({
  type: "chores",
  name: "Corvées",
  description: "Qui est responsable de chaque tâche récurrente, d’un coup d’œil.",
  source: "default",
  access: "corvées du foyer (lecture, écriture)",
  sizes: { min: [2, 2], default: [2, 3], max: [4, 5] },
  options: [{ key: "who", label: "Membre affiché", choices: WHO_CHOICES }],
  defaultOptions: { who: "Tous" },
  defaultShowTitle: true,
  title: (o) => "Corvées" + (o.who === "Tous" ? "" : ` · ${o.who}`),
  Component: Chores,
});
