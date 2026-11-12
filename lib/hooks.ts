"use client";

import { useCallback, useEffect, useState } from "react";

/** Date courante, rafraîchie à intervalle régulier. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const EVENT = "ubiboard-store";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * État partagé persistant en localStorage, synchronisé entre tous les
 * widgets qui utilisent la même clé (ex. deux widgets Courses).
 * À remplacer par un vrai backend pour le multi-appareil.
 */
export function useStoredState<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const sync = () => setValue(read(key, initial));
    sync();
    const onCustom = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) sync();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) sync();
    };
    window.addEventListener(EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* stockage indisponible : l'état reste en mémoire */
      }
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key]
  );

  return [value, update];
}
