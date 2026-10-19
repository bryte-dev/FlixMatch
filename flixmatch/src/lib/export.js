// Construction des fichiers d'export à partir de GET /account/export (fonctions pures, testées)
//
// data = { exportedAt, account, library: [{ status, isFavorite, rating, abandoned, createdAt, movie }],
//          reviews: [{ rating, comment, createdAt, parentId, movie }], episodes: [{ tmdbSeriesId, seasonNumber, episodeNumber, watchedAt }] }

// Cellule CSV : guillemets si besoin + neutralisation des formules tableur (=, @, tabulation, retour chariot)
export const csvCell = (value) => {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (headers, rows) =>
  [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\r\n") + "\r\n";

const day = (iso) => (iso ? String(iso).slice(0, 10) : "");
const keyOf = (type, id) => `${type}:${id}`;

// Avis principal de l'utilisateur par titre (le plus récent)
const mainReviews = (reviews) => {
  const map = new Map();
  for (const r of reviews || []) {
    if (r.parentId != null || !r.movie) continue;
    const k = keyOf(r.movie.media_type, r.movie.tmdb_id);
    const prev = map.get(k);
    if (!prev || String(r.createdAt) > String(prev.createdAt)) map.set(k, r);
  }
  return map;
};

const episodesBySeries = (episodes) => {
  const map = new Map();
  for (const e of episodes || []) {
    if (!map.has(e.tmdbSeriesId)) map.set(e.tmdbSeriesId, []);
    map.get(e.tmdbSeriesId).push({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber, watchedAt: e.watchedAt });
  }
  return map;
};

export function buildFlixMatchExport(data, settings) {
  const reviewByKey = mainReviews(data.reviews);
  const episodes = episodesBySeries(data.episodes);
  const items = [];
  const seen = new Set();

  for (const entry of data.library || []) {
    const m = entry.movie;
    if (!m) continue;
    const k = keyOf(m.media_type, m.tmdb_id);
    seen.add(k);
    const review = reviewByKey.get(k);
    items.push({
      kind: m.media_type,
      title: m.title,
      ids: { tmdb: m.tmdb_id },
      posterPath: m.poster_path || null,
      status: entry.status,
      favorite: Boolean(entry.isFavorite),
      abandoned: Boolean(entry.abandoned),
      rating: entry.rating ?? review?.rating ?? null,
      addedAt: entry.createdAt || null,
      review: review ? { rating: review.rating, comment: review.comment, createdAt: review.createdAt } : null,
      episodes: m.media_type === "tv" ? episodes.get(m.tmdb_id) || [] : [],
    });
  }
  // Séries suivies uniquement via les épisodes (sans entrée de bibliothèque)
  for (const [seriesId, eps] of episodes) {
    if (seen.has(keyOf("tv", seriesId))) continue;
    items.push({ kind: "tv", title: null, ids: { tmdb: seriesId }, status: "WATCHLIST", favorite: false, rating: null, episodes: eps });
  }

  return {
    format: "flixmatch",
    version: 2,
    exportedAt: data.exportedAt || new Date().toISOString(),
    account: data.account || null,
    items,
    reviews: (data.reviews || []).map((r) => ({
      kind: r.movie?.media_type,
      tmdbId: r.movie?.tmdb_id,
      title: r.movie?.title,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      isReply: r.parentId != null,
    })),
    following: data.following || [],
    settings: settings || null,
  };
}

// Format d'import Letterboxd (films uniquement) : https://letterboxd.com/about/importing-data/
const LETTERBOXD_HEADERS = ["Title", "Year", "tmdbID", "WatchedDate", "Rating", "Review", "Tags"];

export function buildLetterboxdCsv(data, which = "watched") {
  const reviewByKey = mainReviews(data.reviews);
  const rows = [];
  for (const entry of data.library || []) {
    const m = entry.movie;
    if (!m || m.media_type !== "movie") continue;
    const wanted = which === "watchlist" ? entry.status === "WATCHLIST" : entry.status === "SEEN";
    if (!wanted) continue;
    const review = reviewByKey.get(keyOf("movie", m.tmdb_id));
    const rating = entry.rating ?? review?.rating ?? null;
    rows.push({
      Title: m.title,
      Year: "",
      tmdbID: m.tmdb_id,
      WatchedDate: which === "watched" ? day(entry.createdAt) : "",
      Rating: which === "watched" && rating ? rating : "",
      Review: which === "watched" ? review?.comment || "" : "",
      Tags: entry.isFavorite ? "flixmatch-favorite" : "",
    });
  }
  return toCsv(LETTERBOXD_HEADERS, rows);
}

// CSV compatible Trakt (films, séries, épisodes vus ; note sur 10)
const TRAKT_HEADERS = ["type", "title", "year", "tmdb_id", "imdb_id", "tvdb_id", "season", "episode", "watched_at", "watchlisted_at", "rating", "favorite"];

export function buildTraktCsv(data) {
  const reviewByKey = mainReviews(data.reviews);
  const titles = new Map();
  const rows = [];
  for (const entry of data.library || []) {
    const m = entry.movie;
    if (!m || (entry.status !== "SEEN" && entry.status !== "WATCHLIST")) continue;
    titles.set(m.tmdb_id + m.media_type, m.title);
    const rating = entry.rating ?? reviewByKey.get(keyOf(m.media_type, m.tmdb_id))?.rating ?? null;
    rows.push({
      type: m.media_type === "tv" ? "show" : "movie",
      title: m.title,
      tmdb_id: m.tmdb_id,
      watched_at: entry.status === "SEEN" ? entry.createdAt || "" : "",
      watchlisted_at: entry.status === "WATCHLIST" ? entry.createdAt || "" : "",
      rating: rating ? rating * 2 : "",
      favorite: entry.isFavorite ? "true" : "",
    });
  }
  for (const e of data.episodes || []) {
    rows.push({
      type: "episode",
      title: titles.get(e.tmdbSeriesId + "tv") || "",
      tmdb_id: e.tmdbSeriesId,
      season: e.seasonNumber,
      episode: e.episodeNumber,
      watched_at: e.watchedAt || "",
    });
  }
  return toCsv(TRAKT_HEADERS, rows);
}
