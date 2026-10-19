import { tvTimeAdapter } from "./tvtime.js";
import { letterboxdAdapter } from "./letterboxd.js";
import { traktAdapter } from "./trakt.js";
import { flixMatchAdapter } from "./flixmatch.js";

// Adaptateurs d'import : même interface { id, label, hint, detect(files) -> 0..1, parse(files) -> { items, stats } }
export const ADAPTERS = [tvTimeAdapter, letterboxdAdapter, traktAdapter, flixMatchAdapter];

export const adapterById = (id) => ADAPTERS.find((a) => a.id === id) || null;

// Choisit l'adaptateur le plus probable pour un ensemble de fichiers [{ name, text }]
export function detectAdapter(files) {
  let best = null;
  for (const adapter of ADAPTERS) {
    const score = adapter.detect(files);
    if (!best || score > best.score) best = { adapter, score };
  }
  return best && best.score >= 0.5 ? best.adapter : null;
}
