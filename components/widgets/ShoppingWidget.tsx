"use client";

import { useState, type FormEvent } from "react";
import { registerWidget, rowsFit, type WidgetProps } from "@/lib/widgets";
import { useStoredState } from "@/lib/hooks";
import { SHOPPING, type ShoppingItem } from "@/lib/demo-data";
import Icon from "@/components/Icon";
import { ConfirmDialog } from "@/components/Modal";

function Shopping({ bodyHeight, options }: WidgetProps) {
  const [items, setItems] = useStoredState<ShoppingItem[]>("ubiboard-shopping-v1", SHOPPING);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<ShoppingItem | null>(null);

  const visible = items
    .filter((it) => options.done === "show" || !it.done)
    .slice(0, rowsFit(bodyHeight, 52, 44));

  const toggle = (id: string) =>
    setItems(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setItems([...items, { id: `s${Date.now()}`, name, done: false }]);
    setDraft("");
  };

  // Valide la modification en cours ; un texte vide laisse l'article inchangé.
  const commitEdit = () => {
    if (!editing) return;
    const name = editing.text.trim();
    if (name) setItems(items.map((it) => (it.id === editing.id ? { ...it, name } : it)));
    setEditing(null);
  };

  return (
    <div className="shop">
      <div className="shop-items">
        {visible.map((it) => (
          <div key={it.id} className="shop-row">
            {editing?.id === it.id ? (
              <input
                className="input shop-edit"
                aria-label={`Modifier ${it.name}`}
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
                <button className="row-btn" aria-pressed={it.done} onClick={() => toggle(it.id)}>
                  <span className={"check" + (it.done ? " on" : "")}>
                    {it.done && <Icon name="check" size={14} strokeWidth={3} color="var(--accent-ink)" />}
                  </span>
                  <span className={"ellipsis" + (it.done ? " struck" : "")}>{it.name}</span>
                </button>
                <button className="row-action" aria-label={`Modifier ${it.name}`} title="Modifier" onClick={() => setEditing({ id: it.id, text: it.name })}>
                  <Icon name="pencil" size={16} />
                </button>
                <button className="row-action" aria-label={`Supprimer ${it.name}`} title="Supprimer" onClick={() => setToDelete(it)}>
                  <Icon name="close" size={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <form className="shop-form" onSubmit={submit}>
        <input
          className="input"
          aria-label="Ajouter un article"
          placeholder="Ajouter un article"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn-icon" aria-label="Ajouter l'article">
          <Icon name="plus" />
        </button>
      </form>
      {toDelete && (
        <ConfirmDialog
          title={`Supprimer « ${toDelete.name} » ?`}
          message="L’article sera retiré de la liste de courses."
          confirmLabel="Supprimer"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            setItems(items.filter((it) => it.id !== toDelete.id));
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
