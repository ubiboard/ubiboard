"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { addItem, deleteItem, listItems, updateItem } from "@/app/actions";
import type { BoardRole, DataItem } from "@/lib/board-types";

type BoardInfo = { boardId: string; role: BoardRole };

const BoardContext = createContext<BoardInfo | null>(null);
export const BoardProvider = BoardContext.Provider;

export function useBoard(): BoardInfo {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard doit être utilisé dans un board.");
  return ctx;
}

const REFRESH_MS = 20_000;

/**
 * Les données d'un widget : la liste d'éléments identifiée par `dataId`,
 * stockée en base et commune à toutes les vues du board.
 *
 * Les modifications s'affichent tout de suite puis sont envoyées au serveur ;
 * la liste est relue régulièrement pour suivre les autres appareils.
 */
export function useWidgetData<T extends Record<string, unknown>>(dataId: string) {
  const { boardId } = useBoard();
  const [items, setItems] = useState<DataItem<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(0); // écritures en cours : on ne relit pas pendant ce temps

  const refresh = useCallback(async () => {
    if (pending.current > 0) return;
    try {
      const rows = (await listItems(boardId, dataId)) as DataItem<T>[];
      if (pending.current === 0) setItems(rows);
      setError(null);
    } catch {
      setError("Données indisponibles");
    } finally {
      setLoading(false);
    }
  }, [boardId, dataId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  /** Exécute une écriture ; en cas d'échec, on relit la liste pour annuler l'affichage optimiste. */
  const write = useCallback(
    async (job: () => Promise<unknown>) => {
      pending.current += 1;
      try {
        await job();
        setError(null);
      } catch {
        setError("Enregistrement impossible");
      } finally {
        pending.current -= 1;
        if (pending.current === 0) refresh();
      }
    },
    [refresh]
  );

  const add = useCallback(
    (content: T) => {
      const tempId = `tmp-${Date.now()}`;
      setItems((prev) => [...prev, { id: tempId, content }]);
      return write(async () => {
        const created = (await addItem(boardId, dataId, content)) as DataItem<T>;
        setItems((prev) => prev.map((it) => (it.id === tempId ? created : it)));
      });
    },
    [boardId, dataId, write]
  );

  const update = useCallback(
    (id: string, content: T) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { id, content } : it)));
      if (id.startsWith("tmp-")) return Promise.resolve(); // pas encore créé côté serveur
      return write(() => updateItem(boardId, id, content));
    },
    [boardId, write]
  );

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (id.startsWith("tmp-")) return Promise.resolve();
      return write(() => deleteItem(boardId, id));
    },
    [boardId, write]
  );

  return { items, loading, error, add, update, remove };
}
