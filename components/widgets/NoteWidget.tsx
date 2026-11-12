"use client";

import { registerWidget } from "@/lib/widgets";
import { useStoredState } from "@/lib/hooks";
import { NOTE } from "@/lib/demo-data";

function Note() {
  const [note, setNote] = useStoredState<string>("ubiboard-note-v1", NOTE);
  return (
    <textarea
      className="note"
      aria-label="Mot de la famille"
      value={note}
      onChange={(e) => setNote(e.target.value)}
    />
  );
}

registerWidget({
  type: "note",
  name: "Mot de la famille",
  description: "Un pense-bête libre que tout le monde peut modifier.",
  source: "default",
  access: "note du foyer (lecture, écriture)",
  sizes: { min: [2, 1], default: [2, 2], max: [4, 3] },
  options: [],
  defaultOptions: {},
  defaultShowTitle: true,
  title: () => "Mot de la famille",
  Component: Note,
});
