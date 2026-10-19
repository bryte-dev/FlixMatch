// Adaptateur FlixMatch : format d'export natif (v2) et ancien export JSON (v1 : { watchlist, episodes }).
import { ImportCollector, jsonRecords } from "./model.js";

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export function parseFlixMatch(files) {
  const collector = new ImportCollector();
  for (const file of files) {
    if (!/\.json$/i.test(file.name)) continue;
    const data = parseJson(file.text);
    if (!data || typeof data !== "object") continue;

    if (data.format === "flixmatch" && Array.isArray(data.items)) {
      for (const it of data.items) {
        // La corbeille et les titres ignorés ne sont pas réimportés
        if (it.status !== "SEEN" && it.status !== "WATCHLIST") continue;
        collector.add({
          kind: it.kind,
          title: it.title,
          year: it.year,
          ids: { tmdb: it.ids?.tmdb ?? it.tmdbId, imdb: it.ids?.imdb, tvdb: it.ids?.tvdb },
          status: it.status,
          favorite: Boolean(it.favorite),
          rating: it.rating,
          review: it.review?.comment ?? (typeof it.review === "string" ? it.review : null),
          watchedAt: it.watchedAt || it.addedAt,
          episodes: it.episodes || [],
        });
      }
      continue;
    }

    // v1 : { exportedAt, watchlist: [{ status, isFavorite, rating, movie: { tmdb_id, title, media_type } }] }
    const entries = Array.isArray(data.watchlist) ? data.watchlist : jsonRecords(file.text) || [];
    for (const e of entries) {
      const movie = e?.movie;
      if (!movie?.tmdb_id || (e.status !== "SEEN" && e.status !== "WATCHLIST")) continue;
      collector.add({
        kind: movie.media_type,
        title: movie.title,
        ids: { tmdb: movie.tmdb_id },
        status: e.status,
        favorite: Boolean(e.isFavorite),
        rating: e.rating,
        watchedAt: e.createdAt,
      });
    }
  }
  return collector.result();
}

export const flixMatchAdapter = {
  id: "flixmatch",
  label: "FlixMatch",
  hint: "Fichier JSON exporté depuis FlixMatch (Réglages → Mes données).",
  detect(files) {
    if (files.some((f) => /"format"\s*:\s*"flixmatch"/.test(f.text.slice(0, 500)))) return 1;
    if (files.some((f) => /\.json$/i.test(f.name) && /"exportedAt"/.test(f.text.slice(0, 200)) && /"watchlist"/.test(f.text.slice(0, 2000)))) return 0.9;
    return 0;
  },
  parse: parseFlixMatch,
};
