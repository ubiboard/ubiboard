"use client";

import { useEffect, useState } from "react";
import { fetchWeather, type Weather } from "@/lib/weather";

/** Date courante, rafraîchie à intervalle régulier. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export type Size = { width: number; height: number };

/** Taille en pixels d'un élément, suivie en continu. Nulle avant la première mesure. */
export function useSize<T extends HTMLElement>(): [(node: T | null) => void, Size | null] {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    if (!node) return;
    const measure = () => {
      const width = Math.floor(node.clientWidth);
      const height = Math.floor(node.clientHeight);
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, size];
}

/**
 * La météo d'un lieu, relue toutes les quinze minutes et au retour sur la page.
 * En cas d'échec, la dernière météo lue reste affichée.
 */
export function useWeather(lat: number | null, lon: number | null): { weather: Weather | null; failed: boolean } {
  const [state, setState] = useState<{ key: string; weather: Weather | null; failed: boolean }>({
    key: "",
    weather: null,
    failed: false,
  });
  const key = lat === null || lon === null ? "" : `${lat},${lon}`;

  useEffect(() => {
    if (lat === null || lon === null) return;
    let stopped = false;
    const load = () => {
      fetchWeather(lat, lon).then(
        (weather) => {
          if (!stopped) setState({ key, weather, failed: false });
        },
        () => {
          if (!stopped) setState((prev) => ({ key, weather: prev.key === key ? prev.weather : null, failed: true }));
        }
      );
    };
    const loadIfVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    const timer = setInterval(loadIfVisible, 15 * 60_000);
    document.addEventListener("visibilitychange", loadIfVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", loadIfVisible);
    };
  }, [lat, lon, key]);

  // Tant que la météo du nouveau lieu n'est pas arrivée, on n'affiche pas celle de l'ancien.
  return state.key === key ? { weather: state.weather, failed: state.failed } : { weather: null, failed: false };
}
