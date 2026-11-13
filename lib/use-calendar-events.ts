"use client";

import { useCallback, useEffect, useState } from "react";
import { getCalendarEvents } from "@/app/actions";
import { useBoard } from "@/lib/board-context";
import type { CalendarResult } from "@/lib/calendar";

const REFRESH_MS = 5 * 60_000;

/**
 * Les événements des agendas d'un widget sur une période, lus par le serveur
 * et relus régulièrement. `sourcesKey` change quand la liste des agendas
 * change, ce qui déclenche une relecture ; `enabled` évite tout appel quand le
 * widget n'a aucun agenda.
 */
export function useCalendarEvents(dataId: string, from: Date, to: Date, sourcesKey: string, enabled = true) {
  const { boardId } = useBoard();
  const [result, setResult] = useState<CalendarResult>({ events: [], errors: [] });
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const load = useCallback(async () => {
    if (!enabled) {
      setResult({ events: [], errors: [] });
      setLoading(false);
      return;
    }
    try {
      setResult(await getCalendarEvents(boardId, dataId, fromIso, toIso));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [boardId, dataId, fromIso, toIso, enabled]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, sourcesKey]);

  return { ...result, loading, failed };
}
