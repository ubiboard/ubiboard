"use client";

import { useState, type FormEvent } from "react";
import { registerWidget, rowsFit, type WidgetProps } from "@/lib/widgets";
import { useWidgetData } from "@/lib/board-context";
import type { DataItem } from "@/lib/board-types";
import Icon from "@/components/Icon";
import { ConfirmDialog } from "@/components/Modal";

/** Forme d'un article dans la liste de données du widget. */
type Article = { name: string; done: boolean };

function Shopping({ bodyHeight, options, dataId }: WidgetProps) {
  const { items, loading, error, add, update, remove } = useWidgetData<Article>(dataId);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<DataItem<Article> | null>(null);

  const visible = items
    .filter((it) => options.done === "show" || !it.content.done)
    .slice(0, rowsFit(bodyHeight, 52, 44));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    add({ name, done: false });
    setDraft("");
  };

  // Valide la modification en cours ; un texte vide laisse l'article inchangé.
  const commitEdit = () => {
    if (!editing) return;
    const name = editing.text.trim();
    const item = items.find((it) => it.id === editing.id);
    if (name && item && name !== item.content.name) update(item.id, { ...item.content, name });
    setEditing(null);
  };

  return (
    <div className="shop">
      <div className="shop-items">
        {loading && <div className="dim small">Chargement…</div>}
        {!loading && items.length === 0 && <div className="dim small">La liste est vide.</div>}
        {visible.map((it) => (
          <div key={it.id} className="shop-row">
            {editing?.id === it.id ? (
              <input
                className="input shop-edit"
                aria-label={`Modifier ${it.content.name}`}
                autoFocus
                value={editing.text}
                onChange={(e) => setEditing({ id: it.id, text: e.target.value })}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditing(null);
                }}
              />
            ) : (
              <>
                <button
                  className="row-btn"
                  aria-pressed={it.content.done}
                  onClick={() => update(it.id, { ...it.content, done: !it.content.done })}
                >
                  <span className={"check" + (it.content.done ? " on" : "")}>
                    {it.content.done && <Icon name="check" size={14} strokeWidth={3} color="var(--accent-ink)" />}
                  </span>
                  <span className={"ellipsis" + (it.content.done ? " struck" : "")}>{it.content.name}</span>
                </button>
                <button className="row-action" aria-label={`Modifier ${it.content.name}`} title="Modifier" onClick={() => setEditing({ id: it.id, text: it.content.name })}>
                  <Icon name="pencil" size={16} />
                </button>
                <button className="row-action" aria-label={`Supprimer ${it.content.name}`} title="Supprimer" onClick={() => setToDelete(it)}>
                  <Icon name="close" size={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      {error && <div className="widget-error">{error}</div>}
      <form className="shop-form" onSubmit={submit}>
        <input
          className="input"
          aria-label="Ajouter un article"
          placeholder="Ajouter un article"
          maxLength={200}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn-icon" aria-label="Ajouter l'article">
          <Icon name="plus" />
        </button>
      </form>
      {toDelete && (
        <ConfirmDialog
          title={`Supprimer « ${toDelete.content.name} » ?`}
          message="L’article sera retiré de la liste de courses."
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

registerWidget({
  type: "shopping",
  name: "Courses",
  description: "Liste partagée, avec ajout rapide.",
  source: "default",
  access: "liste de courses (lecture, écriture)",
  storesData: true,
  sizes: { min: [2, 2], default: [2, 3], max: [4, 5] },
  options: [
    {
      key: "done",
      label: "Articles cochés",
      choices: [
        { value: "show", label: "Afficher" },
        { value: "hide", label: "Masquer" },
      ],
    },
  ],
  defaultOptions: { done: "show" },
  defaultShowTitle: true,
  title: () => "Courses",
  Component: Shopping,
});
