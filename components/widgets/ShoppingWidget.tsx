"use client";

import { useState, type FormEvent } from "react";
import { registerWidget, rowsFit, type WidgetProps } from "@/lib/widgets";
import { useStoredState } from "@/lib/hooks";
import { SHOPPING, type ShoppingItem } from "@/lib/demo-data";
import Icon from "@/components/Icon";

function Shopping({ bodyHeight, options }: WidgetProps) {
  const [items, setItems] = useStoredState<ShoppingItem[]>("ubiboard-shopping-v1", SHOPPING);
  const [draft, setDraft] = useState("");

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

  return (
    <div className="shop">
      <div className="shop-items">
        {visible.map((it) => (
          <button key={it.id} className="row-btn" aria-pressed={it.done} onClick={() => toggle(it.id)}>
            <span className={"check" + (it.done ? " on" : "")}>
              {it.done && <Icon name="check" size={14} strokeWidth={3} color="var(--accent-ink)" />}
            </span>
            <span className={"ellipsis" + (it.done ? " struck" : "")}>{it.name}</span>
          </button>
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
