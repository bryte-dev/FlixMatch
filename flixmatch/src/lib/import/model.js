// Modèle commun à tous les adaptateurs d'import (TV Time, Letterboxd, Trakt, FlixMatch).
// Chaque adaptateur produit des « items » normalisés, fusionnés par un ImportCollector :
// { key, kind: "movie"|"tv"|null, title, year, ids: { tmdb, imdb, tvdb }, status: "SEEN"|"WATCHLIST",
//   favorite, rating (1-5), review, watchedAt (ISO), episodes: [{ seasonNumber, episodeNumber, watchedAt }] }

export const normTitle = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const toInt = (value) => {
  const s = String(value ?? "").trim();
  return /^\d{1,10}$/.test(s) && Number(s) <= 2147483647 ? Number(s) : null;
};

export const toYear = (value) => {
  const m = /^(\d{4})/.exec(String(value ?? "").trim());
  const y = m ? Number(m[1]) : null;
  return y && y >= 1870 && y <= 2100 ? y : null;
};

export const toImdb = (value) => {
  const m = /\b(tt\d{5,10})\b/.exec(String(value ?? ""));
  return m ? m[1] : null;
};

export const toDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// Convertit une note (échelle /scale, décimale « , » ou « . ») vers l'échelle FlixMatch 1-5
export const ratingFrom = (value, scale) => {
  const n = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > scale) return null;
  return Math.min(5, Math.max(1, Math.round((n * 5) / scale)));
};

// Type de média déduit d'un libellé (« episode », « tv_show », « movie »…)
export const toKind = (value) => {
  const v = String(value ?? "").toLowerCase();
  if (/(^|[^a-z])(tv|shows?|series|serie|episodes?|seasons?)([^a-z]|$)/.test(v)) return "tv";
  if (/(^|[^a-z])(movies?|films?)([^a-z]|$)/.test(v)) return "movie";
  return null;
};

const STATUS_RANK = { WATCHLIST: 1, SEEN: 2 };
const MAX_REVIEW = 2000;

export class ImportCollector {
  constructor() {
    this.items = [];
    this.aliases = new Map();
  }

  aliasKeys(kind, ids, title, year) {
    const k = kind || "?";
    const keys = [];
    if (ids.tmdb) keys.push(`tmdb:${k}:${ids.tmdb}`);
    if (ids.imdb) keys.push(`imdb:${ids.imdb}`);
    if (ids.tvdb) keys.push(`tvdb:${ids.tvdb}`);
    const t = normTitle(title);
    if (t) {
      if (year) keys.push(`t:${k}:${t}:${year}`);
      keys.push(`t:${k}:${t}:`);
    }
    return keys;
  }

  add(raw) {
    const ids = { tmdb: toInt(raw.ids?.tmdb), imdb: toImdb(raw.ids?.imdb), tvdb: toInt(raw.ids?.tvdb) };
    const title = String(raw.title ?? "").trim().slice(0, 300);
    const kind = raw.kind === "movie" || raw.kind === "tv" ? raw.kind : null;
    const year = toYear(raw.year);
    if (!title && !ids.tmdb && !ids.imdb && !ids.tvdb) return null;

    let item = null;
    for (const key of this.aliasKeys(kind, ids, title, year)) {
      const found = this.aliases.get(key);
      // Restent distinctes : deux œuvres de même titre mais d'années, de types ou d'identifiants différents
      const idConflict = ["tmdb", "imdb", "tvdb"].some((k) => ids[k] && found?.ids[k] && ids[k] !== found.ids[k]);
      if (found && !idConflict && !(year && found.year && found.year !== year) && !(kind && found.kind && found.kind !== kind)) {
        item = found;
        break;
      }
    }
    if (!item) {
      item = { key: `i${this.items.length}`, kind, title, year, ids: { ...ids }, status: null, favorite: false, rating: null, review: null, watchedAt: null, episodes: new Map() };
      this.items.push(item);
    }

    item.kind = item.kind || kind;
    item.title = item.title || title;
    item.year = item.year || year;
    for (const k of ["tmdb", "imdb", "tvdb"]) item.ids[k] = item.ids[k] || ids[k];
    if (raw.status && (STATUS_RANK[raw.status] || 0) > (STATUS_RANK[item.status] || 0)) item.status = raw.status;
    if (raw.favorite) item.favorite = true;
    if (raw.rating >= 1 && raw.rating <= 5) item.rating = Math.round(raw.rating);
    const review = String(raw.review ?? "").trim();
    if (review && (!item.review || review.length > item.review.length)) item.review = review.slice(0, MAX_REVIEW);
    const watchedAt = toDate(raw.watchedAt);
    if (watchedAt && (!item.watchedAt || watchedAt > item.watchedAt)) item.watchedAt = watchedAt;
    for (const ep of raw.episodes || []) {
      const s = toInt(ep.seasonNumber ?? ep.season);
      const e = toInt(ep.episodeNumber ?? ep.episode ?? ep.number);
      if (s === null || !e || s > 500) continue;
      const k = `${s}-${e}`;
      if (!item.episodes.has(k)) item.episodes.set(k, { seasonNumber: s, episodeNumber: e, watchedAt: toDate(ep.watchedAt) });
    }

    for (const key of this.aliasKeys(item.kind, item.ids, item.title, item.year)) {
      if (!this.aliases.has(key)) this.aliases.set(key, item);
    }
    return item;
  }

  result() {
    const items = this.items.map((it) => {
      const episodes = [...it.episodes.values()];
      const kind = it.kind || (episodes.length > 0 ? "tv" : null);
      // Une série avec des épisodes vus est « en cours » (watchlist) sauf statut explicite
      const status = it.status || (kind === "tv" ? "WATCHLIST" : "SEEN");
      return { ...it, kind, status, episodes };
    });
    return { items, stats: statsOf(items) };
  }
}

export function statsOf(items) {
  return {
    movies: items.filter((i) => i.kind === "movie").length,
    series: items.filter((i) => i.kind === "tv").length,
    unknown: items.filter((i) => !i.kind).length,
    episodes: items.reduce((n, i) => n + (i.episodes?.length || 0), 0),
    favorites: items.filter((i) => i.favorite).length,
    ratings: items.filter((i) => i.rating).length,
    reviews: items.filter((i) => i.review).length,
    watchlist: items.filter((i) => i.status === "WATCHLIST").length,
  };
}

// Ligne « plate » : clés en minuscules (espaces/tirets → _), objets imbriqués aplatis en parent_enfant
export function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = (prefix ? `${prefix}_${k}` : k).toLowerCase().replace(/[\s-]+/g, "_");
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else if (!Array.isArray(v)) out[key] = v == null ? "" : String(v);
  }
  return out;
}

export const baseName = (name) => String(name || "").toLowerCase().split("/").pop();

// Première valeur non vide parmi plusieurs colonnes possibles
export const pick = (row, names) => {
  for (const n of names) if (row[n] !== undefined && row[n] !== null && row[n] !== "") return row[n];
  return "";
};

// Tableau d'objets contenu dans un JSON (racine ou première propriété tableau)
export const jsonRecords = (text) => {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    return Object.values(data || {}).find(Array.isArray) || [];
  } catch {
    return null;
  }
};
