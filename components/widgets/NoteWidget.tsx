"use client";

import { useEffect, useRef, useState } from "react";
import { registerWidget, type WidgetProps } from "@/lib/widgets";
import { useWidgetData } from "@/lib/board-context";

/** La note est l'unique élément de la liste de données du widget. */
type NoteContent = { text: string };

const SAVE_DELAY_MS = 800;

function Note({ dataId }: WidgetProps) {
  const { items, loading, error, add, update } = useWidgetData<NoteContent>(dataId);
  const stored = items[0];
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tant qu'on ne tape pas, on suit ce qui est en base (autres appareils).
  useEffect(() => {
    if (!dirty) setText(stored?.content.text ?? "");
  }, [stored, dirty]);

  // Enregistrement différé : on attend une pause dans la frappe.
  const onChange = (value: string) => {
    setText(value);
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (stored) await update(stored.id, { text: value });
      else await add({ text: value });
      setDirty(false);
    }, SAVE_DELAY_MS);
  };

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <>
      <textarea
        className="note"
        aria-label="Mot de la famille"
        placeholder={loading ? "Chargement…" : "Écrire un mot…"}
        maxLength={2000}
        disabled={loading}
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <div className="widget-error">{error}</div>}
    </>
  );
}

registerWidget({
  type: "note",
  name: "Mot de la famille",
  description: "Un pense-bête libre que tout le monde peut modifier.",
  source: "default",
  access: "note du foyer (lecture, écriture)",
  storesData: true,
  sizes: { min: [3, 1], default: [3, 2], max: [6, 3] },
  options: [],
  defaultOptions: {},
  defaultShowTitle: true,
  title: () => "Mot de la famille",
  Component: Note,
});
