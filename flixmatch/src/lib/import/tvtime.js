// Adaptateur TV Time (export RGPD). Le format varie : on détecte les colonnes par leurs noms probables.
import { parseCsv } from "./csv.js";

const pick = (row, names) => {
  for (const n of names) if (row[n] !== undefined && row[n] !== "") return row[n];
  return "";
};
const num = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);
const year = (v) => (/^(\d{4})/.test(String(v)) ? Number(String(v).slice(0, 4)) : null);

const SERIES_NAME = ["series_name", "show_name", "tv_show_name", "show_title", "series_title", "tv_show", "show", "name"];
const MOVIE_NAME = ["movie_name", "movie_title", "film_name", "title"];
const SERIES_ID = ["series_id", "show_id", "tv_show_id", "tvdb_id", "tvdb_series_id"];
const MOVIE_ID = ["movie_id", "tmdb_id", "imdb_id", "film_id"];
const DATE = ["created_at", "watched_at", "updated_at", "date", "seen_at"];

// Entrée : [{ name, text }] (fichiers texte du ZIP). Sortie : { series, movies, stats }
export function parseTvTime(files) {
  const series = new Map();
  const movies = new Map();
  const favorites = new Set();

  const serie = (name, row) => {
    const key = name.toLowerCase();
    if (!series.has(key)) series.set(key, { name, tvdbId: null, tmdbId: null, episodes: new Map(), favorite: false });
    const s = series.get(key);
    const id = pick(row, SERIES_ID);
    if (id && num(id)) s.tvdbId = s.tvdbId || Number(id);
    return s;
  };

  for (const file of files) {
    const lower = file.name.toLowerCase();
    const base = lower.split("/").pop();
    let rows = [];
    if (lower.endsWith(".csv")) rows = parseCsv(file.text);
    else if (lower.endsWith(".json")) {
      try {
        const data = JSON.parse(file.text);
        rows = (Array.isArray(data) ? data : Object.values(data).find(Array.isArray) || []).map((r) =>
          Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [k.toLowerCase(), v == null ? "" : String(v)]))
        );
      } catch {
        continue;
      }
    } else continue;

    const isFavoriteFile = /favou?rite/.test(base);
    for (const row of rows) {
      const entity = pick(row, ["entity_type", "type", "object_type"]).toLowerCase();
      const seasonN = num(pick(row, ["season_number", "season", "season_no"]));
      const episodeN = num(pick(row, ["episode_number", "episode", "episode_no"]));
      const sName = pick(row, SERIES_NAME);
      const mName = pick(row, MOVIE_NAME);
      const date = pick(row, DATE);

      if (entity.includes("movie") || (!sName && mName && /movie|film/.test(base)) || (mName && !sName && entity === "")) {
        if (!mName || /(episode|series|show)/.test(entity)) continue;
        const key = mName.toLowerCase();
        const m = movies.get(key) || { name: mName, year: year(pick(row, ["release_date", "year"])), imdbId: null, tmdbId: null, watchedAt: date, favorite: false };
        const id = pick(row, MOVIE_ID);
        if (/^tt\d+$/.test(id)) m.imdbId = id;
        else if (num(id) && /tmdb/.test(Object.keys(row).join())) m.tmdbId = Number(id);
        if (isFavoriteFile) m.favorite = true;
        movies.set(key, m);
        continue;
      }
      if (!sName) continue;
      const s = serie(sName, row);
      if (isFavoriteFile) s.favorite = true;
      if (seasonN !== null && episodeN !== null && episodeN > 0) {
        const k = `${seasonN}-${episodeN}`;
        if (!s.episodes.has(k)) s.episodes.set(k, { seasonNumber: seasonN, episodeNumber: episodeN, watchedAt: date });
      }
      if (isFavoriteFile) favorites.add(s.name);
    }
  }

  const seriesList = [...series.values()].map((s) => ({ ...s, episodes: [...s.episodes.values()] }));
  const moviesList = [...movies.values()];
  return {
    series: seriesList,
    movies: moviesList,
    stats: {
      series: seriesList.length,
      episodes: seriesList.reduce((n, s) => n + s.episodes.length, 0),
      movies: moviesList.length,
      favorites: favorites.size + moviesList.filter((m) => m.favorite).length,
    },
  };
}

export const tvTimeAdapter = {
  id: "tvtime",
  label: "TV Time",
  accepts: "application/zip,.zip",
  async parse(files) {
    return parseTvTime(files);
  },
};
