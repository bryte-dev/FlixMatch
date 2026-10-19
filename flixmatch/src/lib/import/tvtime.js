// Adaptateur TV Time (export RGPD, ZIP de CSV/JSON). Le format varie selon les années :
// les colonnes sont reconnues par leurs noms probables.
//
// Correctifs de correspondance :
// - une ligne n'est classée « film » que sur un indice explicite (entity_type, colonne movie_*,
//   nom de fichier) ; une colonne générique « name »/« title » ne suffit plus (les séries
//   finissaient en films) ;
// - les ids TV Time des séries sont des ids TVDB ; l'id interne d'un film TV Time n'est jamais
//   pris pour un id TMDB (seule une colonne tmdb_* explicite l'est).
import { ImportCollector, baseName, pick, toImdb, toInt, toKind, toYear } from "./model.js";
import { readRows } from "./rows.js";

const SERIES_NAME = ["series_name", "show_name", "tv_show_name", "show_title", "series_title", "tv_show", "show", "show_name_en", "tv_show_title"];
const MOVIE_NAME = ["movie_name", "movie_title", "film_name", "film_title", "movie"];
const GENERIC_NAME = ["name", "title"];
const SERIES_TVDB = ["tvdb_id", "tvdb_series_id", "series_id", "show_id", "tv_show_id", "show_tvdb_id"];
const IMDB = ["imdb_id", "imdb", "series_imdb_id", "show_imdb_id", "movie_imdb_id"];
const TMDB_TV = ["tmdb_id", "series_tmdb_id", "show_tmdb_id", "tv_show_tmdb_id"];
const TMDB_MOVIE = ["tmdb_id", "movie_tmdb_id"];
const SEASON = ["season_number", "season", "season_no", "episode_season_number"];
const EPISODE = ["episode_number", "episode", "episode_no", "number"];
const DATE = ["watched_at", "seen_at", "created_at", "updated_at", "date"];
const YEAR = ["year", "release_date", "release_year", "first_aired", "air_date"];
const ENTITY = ["entity_type", "object_type", "media_type", "type", "kind"];

const hasAny = (row, names) => names.some((n) => row[n] !== undefined && row[n] !== "");

// Indice de type tiré du nom de fichier (tracking-prod-records.csv ne dit rien, followed_tv_show.csv oui)
const fileKind = (base) => {
  if (/(tv_?show|series|episode|show)/.test(base)) return "tv";
  if (/(movie|film)/.test(base)) return "movie";
  return null;
};

const statusHint = (row, base) => {
  const v = `${pick(row, ["type", "action", "status", "list"])} ${base}`.toLowerCase();
  if (/(to_?watch|towatch|watch_?list|want|plan|follow)/.test(v) && !/(seen|watched|history)/.test(v)) return "WATCHLIST";
  if (/(watch|seen|history|record)/.test(v)) return "SEEN";
  return null;
};

export function classifyRow(row, base) {
  const entity = toKind(pick(row, ENTITY));
  if (entity) return entity;
  if (hasAny(row, SERIES_NAME) || (hasAny(row, SEASON) && hasAny(row, EPISODE))) return "tv";
  if (hasAny(row, MOVIE_NAME)) return "movie";
  return fileKind(base);
}

export function parseTvTime(files) {
  const collector = new ImportCollector();
  let skipped = 0;

  for (const file of files) {
    const base = baseName(file.name);
    const { rows } = readRows(file);
    const isFavoriteFile = /favou?rite/.test(base);

    for (const row of rows) {
      const kind = classifyRow(row, base);
      const date = pick(row, DATE);

      if (kind === "movie") {
        const title = pick(row, MOVIE_NAME) || pick(row, GENERIC_NAME);
        if (!title) continue;
        collector.add({
          kind: "movie",
          title,
          year: toYear(pick(row, YEAR)),
          ids: { imdb: toImdb(pick(row, IMDB)), tmdb: toInt(pick(row, TMDB_MOVIE)) },
          status: isFavoriteFile ? null : statusHint(row, base) || "SEEN",
          favorite: isFavoriteFile,
          watchedAt: date,
        });
        continue;
      }

      if (kind === "tv") {
        const title = pick(row, SERIES_NAME) || pick(row, GENERIC_NAME);
        const tvdb = toInt(pick(row, SERIES_TVDB));
        if (!title && !tvdb) continue;
        const season = toInt(pick(row, SEASON));
        const episode = toInt(pick(row, EPISODE));
        collector.add({
          kind: "tv",
          title,
          year: toYear(pick(row, ["series_year", "show_year", "first_aired"])),
          ids: { tvdb, imdb: toImdb(pick(row, IMDB)), tmdb: toInt(pick(row, TMDB_TV)) },
          favorite: isFavoriteFile,
          watchedAt: date,
          episodes: season !== null && episode ? [{ seasonNumber: season, episodeNumber: episode, watchedAt: date }] : [],
        });
        continue;
      }

      // Type inconnu : gardé seulement s'il y a un titre, la correspondance TMDB tranchera
      const title = pick(row, GENERIC_NAME);
      if (title) collector.add({ kind: null, title, year: toYear(pick(row, YEAR)), ids: { imdb: toImdb(pick(row, IMDB)) }, favorite: isFavoriteFile, watchedAt: date });
      else skipped++;
    }
  }

  const out = collector.result();
  return { ...out, stats: { ...out.stats, skipped } };
}

export const tvTimeAdapter = {
  id: "tvtime",
  label: "TV Time",
  hint: "Export RGPD TV Time (ZIP) : Paramètres → Confidentialité → Télécharger mes données.",
  detect(files) {
    const names = files.map((f) => baseName(f.name)).join(" ");
    if (/(tracking-prod|followed_tv_show|seen_episode|user_tv_show|tv_show)/.test(names)) return 0.9;
    return files.some((f) => /(series_name|show_name|tv_show_name)/i.test(f.text.slice(0, 2000))) ? 0.6 : 0.1;
  },
  parse: parseTvTime,
};
