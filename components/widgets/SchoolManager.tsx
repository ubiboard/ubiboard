"use client";

import { useState } from "react";
import type { ManagerProps } from "@/lib/widgets";
import { useWidgetData } from "@/lib/board-context";
import type { DataItem } from "@/lib/board-types";
import { WEEKDAYS_FROM_MONDAY, WEEKDAY_NAMES } from "@/lib/tasks";
import { DEFAULT_SLOT_COLOR, SLOT_COLORS, isValidTime, toMinutes, type Slot } from "@/lib/timetable";
import Icon from "@/components/Icon";
import { ConfirmDialog } from "@/components/Modal";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Form = { name: string; start: string; end: string; color: string | null };

export default function SchoolManager({ dataId, saved }: ManagerProps) {
  const { items, loading, error, add, update, remove } = useWidgetData<Slot>(dataId);
  const [day, setDay] = useState(() => {
    const today = new Date().getDay();
    return today === 0 || today === 6 ? 1 : today; // le week-end, on ouvre sur le lundi
  });
  // null = liste ; "new" = création ; sinon le créneau en cours de modification.
  const [editing, setEditing] = useState<"new" | DataItem<Slot> | null>(null);
  const [form, setForm] = useState<Form>({ name: "", start: "08:30", end: "09:30", color: null });
  const [toDelete, setToDelete] = useState<DataItem<Slot> | null>(null);

  if (!saved) {
    return (
      <div className="info-box">
        <span className="strong">Widget pas encore enregistré</span>
        <span className="muted small">
          Fermez cette fenêtre et cliquez sur « Enregistrer » : vous pourrez ensuite ajouter des créneaux.
        </span>
      </div>
    );
  }

  const ofDay = items
    .filter((it) => it.content.day === day)
    .sort((a, b) => toMinutes(a.content.start) - toMinutes(b.content.start));

  /* ---------- Formulaire ---------- */

  if (editing) {
    const set = (patch: Partial<Form>) => setForm((prev) => ({ ...prev, ...patch }));
    const problem = !form.name.trim()
      ? "Donnez un nom au créneau."
      : !isValidTime(form.start) || !isValidTime(form.end)
        ? "Indiquez l’heure de début et l’heure de fin."
        : toMinutes(form.end) <= toMinutes(form.start)
          ? "L’heure de fin doit être après l’heure de début."
          : null;

    const submit = () => {
      if (problem) return;
      const slot: Slot = { day, start: form.start, end: form.end, name: form.name.trim(), color: form.color };
      if (editing === "new") add(slot);
      else update(editing.id, slot);
      setEditing(null);
    };

    return (
      <div className="task-form">
        <div className="muted">{capitalize(WEEKDAY_NAMES[day])}</div>
        <div>
          <label className="field-label" htmlFor="slot-name">Nom du créneau</label>
          <input
            id="slot-name"
            className="input block"
            autoFocus
            maxLength={60}
            placeholder="Piscine"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div className="task-repeat" style={{ marginTop: 0 }}>
          <label htmlFor="slot-start">De</label>
          <input id="slot-start" className="input task-time" type="time" step={300} value={form.start} onChange={(e) => set({ start: e.target.value })} />
          <label htmlFor="slot-end">à</label>
          <input id="slot-end" className="input task-time" type="time" step={300} value={form.end} onChange={(e) => set({ end: e.target.value })} />
        </div>
        <div>
          <div className="field-label">Couleur de fond</div>
          <div className="swatches" role="radiogroup" aria-label="Couleur de fond">
            {SLOT_COLORS.map((c) => (
              <button
                key={c.label}
                role="radio"
                aria-checked={form.color === c.value}
                aria-label={c.label}
                title={c.label}
                className={"swatch slot-swatch" + (form.color === c.value ? " on" : "")}
                style={{ background: c.value ?? DEFAULT_SLOT_COLOR }}
                onClick={() => set({ color: c.value })}
              />
            ))}
          </div>
        </div>
        {problem && <div className="dim small">{problem}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={() => setEditing(null)}>Annuler</button>
          <button className="btn btn-primary" disabled={!!problem} onClick={submit}>
            {editing === "new" ? "Ajouter le créneau" : "Enregistrer le créneau"}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Liste par jour ---------- */

  const openNew = () => {
    // Le nouveau créneau commence par défaut à la fin du dernier de la journée.
    const last = ofDay[ofDay.length - 1]?.content;
    const start = last ? last.end : "08:30";
    const endMin = Math.min(toMinutes(start) + 60, 23 * 60 + 55);
    const end = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
    setForm({ name: "", start, end, color: null });
    setEditing("new");
  };

  return (
    <div className="task-list">
      <div className="chips" role="tablist" aria-label="Jour de la semaine">
        {WEEKDAYS_FROM_MONDAY.map((d) => {
          const count = items.filter((it) => it.content.day === d).length;
          return (
            <button key={d} role="tab" aria-selected={day === d} className={"chip" + (day === d ? " on" : "")} onClick={() => setDay(d)}>
              {capitalize(WEEKDAY_NAMES[d]).slice(0, 3)}
              {count > 0 && <span className="chip-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {loading && <div className="dim small">Chargement…</div>}
      {!loading && ofDay.length === 0 && <div className="dim">Aucun créneau le {WEEKDAY_NAMES[day]}.</div>}
      {ofDay.map((item) => (
        <div key={item.id} className="task-row">
          <span className="slot-dot" style={{ background: item.content.color ?? DEFAULT_SLOT_COLOR }} />
          <div className="task-row-text">
            <span className="strong">{item.content.name}</span>
            <span className="muted small">{item.content.start} – {item.content.end}</span>
          </div>
          <button
            className="btn-icon"
            aria-label={`Modifier ${item.content.name}`}
            title="Modifier"
            onClick={() => {
              setForm({ name: item.content.name, start: item.content.start, end: item.content.end, color: item.content.color });
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
      <button className="btn btn-primary center" onClick={openNew}>
        <Icon name="plus" /> Ajouter un créneau le {WEEKDAY_NAMES[day]}
      </button>
      <div className="dim small">Un créneau ajouté, modifié ou supprimé ici est enregistré tout de suite.</div>

      {toDelete && (
        <ConfirmDialog
          title={`Supprimer « ${toDelete.content.name} » ?`}
          message={`Le créneau du ${WEEKDAY_NAMES[toDelete.content.day]} de ${toDelete.content.start} à ${toDelete.content.end} sera définitivement supprimé.`}
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
