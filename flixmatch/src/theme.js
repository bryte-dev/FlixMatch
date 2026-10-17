import { useEffect } from "react";
import { saveSettings, useSettings } from "./settings";

export const THEMES = [
  { id: "dark", label: "Sombre", color: "#0b0b0f" },
  { id: "light", label: "Clair", color: "#fbf6f3" },
  { id: "auto", label: "Auto (système)", color: null },
  { id: "hacker", label: "Hacker", color: "#000000", secret: true },
  { id: "neon", label: "Néon", color: "#08001a", secret: true },
  { id: "retro", label: "Cinéma rétro", color: "#17100a", secret: true },
];

const UNLOCK_KEY = "fm-unlocked";
export const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

export const isUnlocked = () => {
  try {
    return localStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
};

export const unlockThemes = () => {
  try {
    localStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    // ignoré
  }
  window.dispatchEvent(new Event("fm-unlocked"));
};

export const resolveTheme = (pref, prefersDark) => (pref === "auto" ? (prefersDark ? "dark" : "light") : pref);

export const applyTheme = (pref) => {
  const known = THEMES.some((t) => t.id === pref) ? pref : "dark";
  const resolved = resolveTheme(known, window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = resolved;
  const color = THEMES.find((t) => t.id === resolved)?.color || "#0b0b0f";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
};

// Applique le thème choisi (et suit le système en mode « auto »)
export function useTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "auto") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("auto");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
}

// Easter egg : Konami code (clavier) ou 7 appuis rapides sur le logo (mobile) débloquent les thèmes bonus
export function useKonami(onUnlock) {
  useEffect(() => {
    let index = 0;
    const onKey = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      index = key === KONAMI[index] ? index + 1 : key === KONAMI[0] ? 1 : 0;
      if (index === KONAMI.length) {
        index = 0;
        unlockThemes();
        saveSettings({ theme: "hacker" });
        onUnlock?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUnlock]);
}
