"use client";

import { useEffect, useState } from "react";

/** Date courante, rafraîchie à intervalle régulier. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Un choix d'affichage mémorisé sur cet appareil (par exemple le type de vue
 * d'un widget). Tant que rien n'a été choisi ici, on suit la valeur par défaut.
 */
export function useDeviceChoice<T extends string>(key: string, fallback: T): [T, (value: T) => void] {
  const [chosen, setChosen] = useState<T | null>(null);

  useEffect(() => {
    try {
      setChosen(window.localStorage.getItem(key) as T | null);
    } catch {
      /* stockage indisponible : on garde la valeur par défaut */
    }
  }, [key]);

  const choose = (value: T) => {
    setChosen(value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* le choix vaut alors jusqu'au rechargement */
    }
  };

  return [chosen ?? fallback, choose];
}
