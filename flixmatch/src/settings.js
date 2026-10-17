import { useSyncExternalStore } from "react";

const STORAGE_KEY = "fm-settings";

export const DEFAULT_SETTINGS = {
  theme: "dark",
  swipeAction: "watchlist",
  region: "FR",
  providers: [],
  metaLang: "fr-FR",
  adult: false,
};

export const SWIPE_ACTIONS = {
  watchlist: "Ajouter à ma watchlist",
  favorites: "Ajouter à mes favoris",
};

const read = () => {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

let current = read();
const listeners = new Set();

export const getSettings = () => current;

export const saveSettings = (patch) => {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    if (patch.theme) localStorage.setItem("fm-theme", patch.theme);
  } catch {
    // stockage indisponible (navigation privée) : les réglages restent en mémoire
  }
  listeners.forEach((l) => l());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
