"use client";

import { useState } from "react";
import type { ManagerProps } from "@/lib/widgets";
import { useBoard, useWidgetData } from "@/lib/board-context";
import type { DataItem } from "@/lib/board-types";
import {
  MONTH_NAMES,
  ROTATION_LABELS,
  WEEKDAYS_FROM_MONDAY,
  WEEKDAY_NAMES,
  describeRecurrence,
  describeRotation,
  toIsoDay,
  type Recurrence,
  type RecurrenceUnit,
  type RotationMode,
  type Task,
} from "@/lib/tasks";
import Icon from "@/components/Icon";
import { ConfirmDialog } from "@/components/Modal";

const UNITS: { value: RecurrenceUnit; one: string; many: string }[] = [
  { value: "day", one: "jour", many: "jours" },
  { value: "week", one: "semaine", many: "semaines" },
  { value: "month", one: "mois", many: "mois" },
  { value: "year", one: "année", many: "années" },
];
const ROTATIONS: RotationMode[] = ["occurrence", "day", "week", "month"];

/** L'état du formulaire : tous les champs, même ceux que l'unité choisie n'utilise pas. */
type Form = {
  name: string;
  recurring: boolean;
  every: number;
  unit: RecurrenceUnit;
  weekdays: number[];
  monthDay: number;
  month: number;
  people: string[];
  rotation: RotationMode;
};

function emptyForm(): Form {
  const now = new Date();
  return {
    name: "",
    recurring: true,
    every: 1,
    unit: "week",
    weekdays: [now.getDay()], // le jour courant est sélectionné
    monthDay: now.getDate(),
    month: now.getMonth(),
    people: [],
    rotation: "occurrence",
  };
}

function formFromTask(task: Task): Form {
  const base = emptyForm();
  const rec = task.recurrence;
  return {
    ...base,
    name: task.name,
    recurring: !!rec,
    every: rec?.every ?? 1,
    unit: rec?.unit ?? "week",
    weekdays: rec?.weekdays ?? base.weekdays,
    monthDay: rec?.monthDay ?? base.monthDay,
    month: rec?.month ?? base.month,
    people: task.people,
    rotation: task.rotation,
  };
}

function recurrenceOf(form: Form): Recurrence | null {
  if (!form.recurring) return null;
  const every = Math.min(100, Math.max(1, Math.floor(form.every) || 1));
  if (form.unit === "day") return { every, unit: "day" };
  if (form.unit === "week") return { every, unit: "week", weekdays: [...form.weekdays].sort() };
  if (form.unit === "month") return { every, unit: "month", monthDay: form.monthDay };
  return { every, unit: "year", monthDay: form.monthDay, month: form.month };
}

export default function TasksManager({ dataId, saved }: ManagerProps) {
  const { people } = useBoard();
  const { items, loading, error, add, update, remove } = useWidgetData<Task>(dataId);
  // null = liste ; "new" = création ; sinon l'élément en cours de modification.
  const [editing, setEditing] = useState<"new" | DataItem<Task> | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [toDelete, setToDelete] = useState<DataItem<Task> | null>(null);

  const nameOf = (id: string) => people.find((p) => p.userId === id)?.name;
  const namesOf = (ids: string[]) => ids.map(nameOf).filter((n): n is string => !!n);

  if (!saved) {
    return (
      <div className="info-box">
        <span className="strong">Widget pas encore enregistré</span>
        <span className="muted small">
          Fermez cette fenêtre et cliquez sur « Enregistrer » : vous pourrez ensuite créer des tâches.
        </span>
      </div>
    );
  }

  /* ---------- Formulaire de création / modification ---------- */

  if (editing) {
    const recurrence = recurrenceOf(form);
    const set = (patch: Partial<Form>) => setForm((prev) => ({ ...prev, ...patch }));
    const problem = !form.name.trim()
      ? "Donnez un nom à la tâche."
      : form.people.length === 0
        ? "Affectez au moins une personne."
        : form.recurring && form.unit === "week" && form.weekdays.length === 0
          ? "Choisissez au moins un jour de la semaine."
          : null;

    const toggleWeekday = (day: number) =>
      set({ weekdays: form.weekdays.includes(day) ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day] });
    // L'ordre des clics donne l'ordre du roulement.
    const togglePerson = (id: string) =>
      set({ people: form.people.includes(id) ? form.people.filter((p) => p !== id) : [...form.people, id] });

    const submit = () => {
      if (problem) return;
      const previous = editing === "new" ? null : editing.content;
      const schedule = { recurrence, people: form.people, rotation: form.rotation };
      // Le roulement repart du premier quand la récurrence ou les personnes changent.
      const unchanged =
        previous &&
        JSON.stringify({ recurrence: previous.recurrence, people: previous.people, rotation: previous.rotation }) ===
          JSON.stringify(schedule);
      const task: Task = {
        name: form.name.trim(),
        ...schedule,
        start: unchanged ? previous.start : toIsoDay(new Date()),
      };
      if (editing === "new") add(task);
      else update(editing.id, task);
      setEditing(null);
    };

    const unitLabel = (u: (typeof UNITS)[number]) => (form.every > 1 ? u.many : u.one);

    return (
      <div className="task-form">
        <div>
          <label className="field-label" htmlFor="task-name">Nom de la tâche</label>
          <input
            id="task-name"
            className="input block"
            autoFocus
            maxLength={80}
            placeholder="Mettre la table"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>

        <div>
          <div className="field-label">Fréquence</div>
          <div className="chips">
            <button className={"chip" + (!form.recurring ? " on" : "")} aria-pressed={!form.recurring} onClick={() => set({ recurring: false })}>
              Ponctuelle
            </button>
            <button className={"chip" + (form.recurring ? " on" : "")} aria-pressed={form.recurring} onClick={() => set({ recurring: true })}>
              <Icon name="repeat" size={18} /> Récurrente
            </button>
          </div>

          {form.recurring && (
            <>
              <div className="task-repeat">
                <span>Répéter chaque</span>
                <input
                  className="input task-number"
                  type="number"
                  min={1}
                  max={100}
                  aria-label="Nombre"
                  value={form.every}
                  onChange={(e) => set({ every: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })}
                />
                <select className="input task-select" aria-label="Unité" value={form.unit} onChange={(e) => set({ unit: e.target.value as RecurrenceUnit })}>
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{unitLabel(u)}</option>
                  ))}
                </select>
              </div>

              {form.unit === "week" && (
                <div className="weekdays" role="group" aria-label="Jours de la semaine">
                  {WEEKDAYS_FROM_MONDAY.map((day) => (
                    <button
                      key={day}
                      className={"weekday" + (form.weekdays.includes(day) ? " on" : "")}
                      aria-pressed={form.weekdays.includes(day)}
                      aria-label={WEEKDAY_NAMES[day]}
                      title={WEEKDAY_NAMES[day]}
                      onClick={() => toggleWeekday(day)}
                    >
                      {WEEKDAY_NAMES[day].charAt(0).toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              {(form.unit === "month" || form.unit === "year") && (
                <div className="task-repeat">
                  <span>Le</span>
                  <select className="input task-select" aria-label="Jour du mois" value={form.monthDay} onChange={(e) => set({ monthDay: Number(e.target.value) })}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d === 1 ? "1er" : d}</option>
                    ))}
                  </select>
                  {form.unit === "year" && (
                    <select className="input task-select" aria-label="Mois" value={form.month} onChange={(e) => set({ month: Number(e.target.value) })}>
                      {MONTH_NAMES.map((m, i) => (
                        <option key={m} value={i}>{m}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {form.unit !== "day" && form.unit !== "week" && form.monthDay > 28 && (
                <div className="dim small">Les mois plus courts utilisent leur dernier jour.</div>
              )}
            </>
          )}
          <div className="task-phrase" aria-live="polite">{describeRecurrence(recurrence)}</div>
        </div>

        <div>
          <div className="field-label">Personnes</div>
          <div className="chips">
            {people.map((person) => {
              const rank = form.people.indexOf(person.userId);
              return (
                <button
                  key={person.userId}
                  className={"chip person-chip" + (rank >= 0 ? " on" : "")}
                  aria-pressed={rank >= 0}
                  onClick={() => togglePerson(person.userId)}
                >
                  <span className="badge" style={{ background: person.color }}>
                    {rank >= 0 && form.people.length > 1 ? rank + 1 : person.name.charAt(0).toUpperCase()}
                  </span>
                  {person.name}
                </button>
              );
            })}
          </div>

          {form.people.length > 1 && (
            <>
              <div className="field-label" style={{ marginTop: 18 }}>Le roulement change</div>
              <div className="chips">
                {ROTATIONS.map((mode) => (
                  <button key={mode} className={"chip" + (form.rotation === mode ? " on" : "")} aria-pressed={form.rotation === mode} onClick={() => set({ rotation: mode })}>
                    {ROTATION_LABELS[mode]}
                  </button>
                ))}
              </div>
            </>
          )}
          {form.people.length > 0 && (
            <div className="task-phrase" aria-live="polite">{describeRotation(namesOf(form.people), form.rotation)}</div>
          )}
        </div>

        {problem && <div className="dim small">{problem}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={() => setEditing(null)}>Annuler</button>
          <button className="btn btn-primary" disabled={!!problem} onClick={submit}>
            {editing === "new" ? "Créer la tâche" : "Enregistrer la tâche"}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Liste des tâches ---------- */

  return (
    <div className="task-list">
      {loading && <div className="dim small">Chargement…</div>}
      {!loading && items.length === 0 && <div className="dim">Aucune tâche pour l’instant.</div>}
      {items.map((item) => (
        <div key={item.id} className="task-row">
          <div className="task-row-text">
            <span className="strong">{item.content.name}</span>
            <span className="muted small">
              {item.content.recurrence ? describeRecurrence(item.content.recurrence) : "Ponctuelle"} ·{" "}
              {describeRotation(namesOf(item.content.people), item.content.rotation)}
            </span>
          </div>
          <button
            className="btn-icon"
            aria-label={`Modifier ${item.content.name}`}
            title="Modifier"
            onClick={() => {
              setForm(formFromTask(item.content));
              setEditing(item);
            }}
          >
            <Icon name="pencil" size={18} />
          </button>
          <button className="btn-icon" aria-label={`Supprimer ${item.content.name}`} title="Supprimer" onClick={() => setToDelete(item)}>
            <Icon name="trash" size={18} />
          </button>
        </div>
      ))}
      {error && <div className="widget-error">{error}</div>}
      <button
        className="btn btn-primary center"
        onClick={() => {
          setForm(emptyForm());
          setEditing("new");
        }}
      >
        <Icon name="plus" /> Nouvelle tâche
      </button>
      <div className="dim small">Une tâche créée, modifiée ou supprimée ici est enregistrée tout de suite.</div>

      {toDelete && (
        <ConfirmDialog
          title={`Supprimer « ${toDelete.content.name} » ?`}
          message="La tâche sera définitivement supprimée."
          confirmLabel="Supprimer"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            remove(toDelete.id);
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}
