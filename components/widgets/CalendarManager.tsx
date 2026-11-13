"use client";

import { useEffect, useState } from "react";
import { getCalendarEvents } from "@/app/actions";
import type { ManagerProps } from "@/lib/widgets";
import { useBoard, useWidgetData } from "@/lib/board-context";
import { PERSON_COLORS, type DataItem } from "@/lib/board-types";
import type { CalendarSource } from "@/lib/calendar";
import Icon from "@/components/Icon";
import { ConfirmDialog } from "@/components/Modal";

/** Ce que le formulaire envoie : le lien n'est transmis que s'il vient d'être saisi. */
type SourceInput = CalendarSource & { url?: string };

type Form = { name: string; url: string; color: string };

export default function CalendarManager({ dataId, saved }: ManagerProps) {
  const { boardId } = useBoard();
  const { items, loading, error, add, update, remove } = useWidgetData<SourceInput>(dataId);
  // null = liste ; "new" = ajout ; sinon l'agenda en cours de modification.
  const [editing, setEditing] = useState<"new" | DataItem<SourceInput> | null>(null);
  const [form, setForm] = useState<Form>({ name: "", url: "", color: PERSON_COLORS[0] });
  const [toDelete, setToDelete] = useState<DataItem<SourceInput> | null>(null);
  // Agendas que le serveur n'arrive pas à lire, avec la raison.
  const [problems, setProblems] = useState<Record<string, string>>({});

  // On vérifie que chaque agenda est lisible, à l'ouverture et après chaque changement.
  const signature = items.map((it) => it.id).join(",");
  useEffect(() => {
    if (!saved || items.length === 0) return;
    let cancelled = false;
    const now = new Date();
    getCalendarEvents(boardId, dataId, now.toISOString(), new Date(now.getTime() + 86_400_000).toISOString())
      .then((result) => {
        if (!cancelled) setProblems(Object.fromEntries(result.errors.map((e) => [e.sourceId, e.message])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, dataId, saved, signature]);

  if (!saved) {
    return (
      <div className="info-box">
        <span className="strong">Widget pas encore enregistré</span>
        <span className="muted small">
          Fermez cette fenêtre et cliquez sur « Enregistrer » : vous pourrez ensuite connecter des agendas.
        </span>
      </div>
    );
  }

  /* ---------- Formulaire ---------- */

  if (editing) {
    const isNew = editing === "new";
    const set = (patch: Partial<Form>) => setForm((prev) => ({ ...prev, ...patch }));
    const link = form.url.trim();
    const problem = !form.name.trim()
      ? "Donnez un nom à l’agenda."
      : isNew && !link
        ? "Collez le lien iCal de l’agenda."
        : link && !/^(https|webcal):\/\//i.test(link)
          ? "Le lien doit commencer par https://"
          : null;

    const submit = () => {
      if (problem) return;
      const source: SourceInput = { name: form.name.trim(), color: form.color, ...(link ? { url: link } : {}) };
      if (isNew) add(source);
      else update(editing.id, source);
      setEditing(null);
    };

    return (
      <div className="task-form">
        <div>
          <label className="field-label" htmlFor="cal-name">Nom de l’agenda</label>
          <input id="cal-name" className="input block" autoFocus maxLength={60} placeholder="Famille" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <label className="field-label" htmlFor="cal-url">Lien iCal</label>
          <input
            id="cal-url"
            className="input block"
            type="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={isNew ? "https://calendar.google.com/calendar/ical/…/basic.ics" : "Lien enregistré : laisser vide pour le conserver"}
            value={form.url}
            onChange={(e) => set({ url: e.target.value })}
          />
          <div className="dim small" style={{ marginTop: 8 }}>
            Dans Google Agenda sur ordinateur : Paramètres, puis l’agenda voulu, « Intégrer l’agenda », « Adresse secrète
            au format iCal ». Le lien est chiffré avant d’être enregistré et n’est plus jamais affiché ensuite.
          </div>
        </div>
        <div>
          <div className="field-label">Couleur</div>
          <div className="swatches" role="radiogroup" aria-label="Couleur de l’agenda">
            {PERSON_COLORS.map((color) => (
              <button
                key={color}
                role="radio"
                aria-checked={form.color === color}
                aria-label={color}
                className={"swatch" + (form.color === color ? " on" : "")}
                style={{ background: color }}
                onClick={() => set({ color })}
              />
            ))}
          </div>
        </div>
        {problem && <div className="dim small">{problem}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={() => setEditing(null)}>Annuler</button>
          <button className="btn btn-primary" disabled={!!problem} onClick={submit}>
            {isNew ? "Connecter l’agenda" : "Enregistrer l’agenda"}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Liste des agendas ---------- */

  return (
    <div className="task-list">
      {loading && <div className="dim small">Chargement…</div>}
      {!loading && items.length === 0 && <div className="dim">Aucun agenda connecté pour l’instant.</div>}
      {items.map((item) => (
        <div key={item.id} className="task-row">
          <span className="slot-dot round" style={{ background: item.content.color }} />
          <div className="task-row-text">
            <span className="strong">{item.content.name}</span>
            {problems[item.id] ? (
              <span className="widget-error" style={{ marginTop: 0 }}>{problems[item.id]}</span>
            ) : (
              <span className="muted small">Lien iCal enregistré</span>
            )}
          </div>
          <button
            className="btn-icon"
            aria-label={`Modifier ${item.content.name}`}
            title="Modifier"
            onClick={() => {
              setForm({ name: item.content.name, url: "", color: item.content.color });
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
          // Couleur proposée : la première qui n'est pas déjà prise.
          const used = new Set(items.map((it) => it.content.color));
          setForm({ name: "", url: "", color: PERSON_COLORS.find((c) => !used.has(c)) ?? PERSON_COLORS[0] });
          setEditing("new");
        }}
      >
        <Icon name="plus" /> Connecter un agenda
      </button>
      <div className="dim small">Un agenda connecté, modifié ou supprimé ici est enregistré tout de suite.</div>

      {toDelete && (
        <ConfirmDialog
          title={`Supprimer « ${toDelete.content.name} » ?`}
          message="L’agenda ne sera plus affiché et son lien sera effacé. Rien n’est supprimé dans l’agenda lui-même."
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
