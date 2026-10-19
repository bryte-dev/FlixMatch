// Adaptateur Letterboxd : export ZIP (watched.csv, diary.csv, ratings.csv, reviews.csv,
// watchlist.csv, likes/films.csv) ou CSV au format d'import Letterboxd (Title, Year, tmdbID, imdbID…),
// ce qui couvre aussi l'export Letterboxd de FlixMatch.
import { ImportCollector, baseName, pick, ratingFrom, toImdb, toInt, toYear } from "./model.js";
import { readRows } from "./rows.js";

const fileRole = (name) => {
  const lower = String(name || "").toLowerCase();
  if (/(^|\/)deleted\//.test(lower) || /(^|\/)lists\//.test(lower)) return null; // listes perso : format différent
  const base = baseName(lower);
  if (/^watchlist/.test(base)) return "watchlist";
  if (/likes\/films\.csv$/.test(lower)) return "likes";
  if (/^(watched|diary|ratings|reviews)\.csv$/.test(base)) return "seen";
  if (base.endsWith(".csv")) return "generic";
  return null;
};

export function parseLetterboxd(files) {
  const collector = new ImportCollector();
  for (const file of files) {
    const role = fileRole(file.name);
    if (!role) continue;
    const { rows } = readRows(file);
    for (const row of rows) {
      const title = pick(row, ["name", "title", "film", "film_title"]);
      if (!title && !row.tmdbid && !row.imdbid) continue;
      const watchlisted = role === "watchlist" || /^(true|yes|1)$/i.test(pick(row, ["watchlist", "watchlisted"]));
      collector.add({
        kind: "movie",
        title,
        year: toYear(pick(row, ["year", "release_year"])),
        ids: { tmdb: toInt(pick(row, ["tmdbid", "tmdb_id"])), imdb: toImdb(pick(row, ["imdbid", "imdb_id"])) },
        status: role === "likes" ? null : watchlisted ? "WATCHLIST" : "SEEN",
        favorite: role === "likes" || /^(true|yes|1)$/i.test(pick(row, ["liked", "favorite"])),
        rating: ratingFrom(pick(row, ["rating"]), 5) ?? ratingFrom(pick(row, ["rating10"]), 10),
        review: pick(row, ["review"]),
        watchedAt: pick(row, ["watched_date", "watcheddate", "date"]),
      });
    }
  }
  return collector.result();
}

export const letterboxdAdapter = {
  id: "letterboxd",
  label: "Letterboxd",
  hint: "Export Letterboxd (ZIP) : Settings → Import & Export → Export your data. Les fichiers CSV seuls sont aussi acceptés.",
  detect(files) {
    if (files.some((f) => /letterboxd_uri|letterboxd uri|boxd\.it/i.test(f.text.slice(0, 3000)))) return 0.95;
    if (files.some((f) => /^(watched|diary|ratings|watchlist)\.csv$/.test(baseName(f.name)))) return 0.7;
    if (files.some((f) => /^\uFEFF?"?title"?,"?year"?/i.test(f.text) && /tmdbid|imdbid|watcheddate/i.test(f.text.slice(0, 300)))) return 0.8;
    return 0;
  },
  parse: parseLetterboxd,
};
