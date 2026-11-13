"use client";

import { registerWidget, rowsFit, type WidgetProps } from "@/lib/widgets";
import { useBoard, useWidgetData } from "@/lib/board-context";
import { useNow } from "@/lib/hooks";
import { assigneeOn, toIsoDay, type Task } from "@/lib/tasks";
import TasksManager from "./TasksManager";

/**
 * Affiche qui doit faire quoi aujourd'hui. La récurrence et le roulement ne
 * se voient pas ici : ils se règlent dans la fenêtre de gestion (mode édition).
 */
function Tasks({ bodyHeight, options, dataId }: WidgetProps) {
  const { people } = useBoard();
  const { items, loading, error } = useWidgetData<Task>(dataId);
  const today = toIsoDay(useNow(60_000));

  const known = new Set(people.map((p) => p.userId));
  const filter = known.has(options.who) ? options.who : null; // sinon : tout le monde

  const rows = items
    .map((it) => ({ id: it.id, name: it.content.name, who: assigneeOn(it.content, today, known) }))
    .filter((row) => row.who !== null && (!filter || row.who === filter));

  if (loading) return <div className="dim small">Chargement…</div>;
  if (error) return <div className="widget-error">{error}</div>;
  if (rows.length === 0) {
    return <div className="dim small">{items.length === 0 ? "Aucune tâche pour l’instant." : "Rien à faire aujourd’hui."}</div>;
  }

  return (
    <div className="list">
      {rows.slice(0, rowsFit(bodyHeight)).map((row) => {
        const person = people.find((p) => p.userId === row.who);
        if (!person) return null;
        return (
          <div key={row.id} className="list-row">
            <span className="chore-name">{row.name}</span>
            <span className="badge" style={{ background: person.color }} title={person.name} aria-label={person.name}>
              {person.name.charAt(0).toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

registerWidget({
  // L'identifiant reste « chores » : c'est lui qui est enregistré en base.
  type: "chores",
  name: "Tâches",
  description: "Qui doit faire quoi aujourd’hui, avec récurrence et roulement.",
  source: "default",
  access: "tâches du board (lecture ; écriture par les administrateurs)",
  storesData: true,
  sizes: { min: [3, 2], default: [3, 3], max: [6, 5] },
  options: [{ key: "who", label: "Personne affichée", choices: "people" }],
  defaultOptions: { who: "all" },
  defaultShowTitle: true,
  title: () => "Tâches",
  Component: Tasks,
  Manager: TasksManager,
  managerTitle: "Tâches",
});
