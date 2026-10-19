// Adaptateur Trakt.tv :
// - JSON de l'export Trakt (watched-movies/shows, history-*, watchlist-*, ratings-*, favorites-*, comments-*) ;
// - CSV (colonnes type, title, year, tmdb_id, imdb_id, tvdb_id, season, episode, watched_at,
//   watchlisted_at/listed_at, rating sur 10), dont l'export Trakt de FlixMatch.
import { ImportCollector, baseName, pick, ratingFrom, toImdb, toInt, toKind, toYear } from "./model.js";
import { readRows } from "./rows.js";

const roleOf = (base) => {
  if (/watchlist/.test(base)) return "watchlist";
  if (/rating/.test(base)) return "ratings";
  if (/favou?rite/.test(base)) return "favorites";
  if (/comment|review/.test(base)) return "comments";
  if (/(watched|history|seen|playback)/.test(base)) return "watched";
  return null; // collection, listes… ignorés
};

const idsOf = (media) => ({ tmdb: media?.ids?.tmdb, imdb: media?.ids?.imdb, tvdb: media?.ids?.tvdb });

function addJsonRecord(collector, rec, role) {
  if (!rec || typeof rec !== "object") return;
  const type = rec.type || (rec.movie ? "movie" : rec.episode ? "episode" : rec.show ? "show" : null);
  const isMovie = type === "movie" && rec.movie;
  const media = isMovie ? rec.movie : rec.show;
  if (!media) return;
  // Notes et commentaires d'épisodes / saisons : non gérés par FlixMatch
  if ((role === "ratings" || role === "comments") && (type === "episode" || type === "season")) return;

  const date = rec.last_watched_at || rec.watched_at || rec.listed_at || rec.rated_at || rec.created_at;
  const episodes = [];
  if (!isMovie) {
    for (const season of rec.seasons || []) {
      for (const ep of season.episodes || []) episodes.push({ seasonNumber: season.number, episodeNumber: ep.number, watchedAt: ep.last_watched_at || date });
    }
    if (rec.episode) episodes.push({ seasonNumber: rec.episode.season, episodeNumber: rec.episode.number, watchedAt: rec.watched_at || date });
  }

  collector.add({
    kind: isMovie ? "movie" : "tv",
    title: media.title,
    year: media.year,
    ids: idsOf(media),
    status: role === "watchlist" ? "WATCHLIST" : role === "watched" ? (isMovie ? "SEEN" : null) : null,
    favorite: role === "favorites",
    rating: role === "ratings" ? ratingFrom(rec.rating, 10) : null,
    review: role === "comments" ? (typeof rec.comment === "string" ? rec.comment : rec.comment?.comment) : null,
    watchedAt: role === "watched" ? date : null,
    episodes,
  });
}

function addCsvRow(collector, row) {
  const kind = toKind(pick(row, ["type", "media_type", "kind"])) || (pick(row, ["season", "episode"]) ? "tv" : null);
  const isEpisode = /episode/i.test(pick(row, ["type"])) || (kind === "tv" && toInt(pick(row, ["episode", "episode_number"])));
  const watchedAt = pick(row, ["watched_at", "last_watched_at", "watcheddate"]);
  const watchlisted = pick(row, ["watchlisted_at", "listed_at", "watchlist_at"]) || /^(true|1|yes)$/i.test(pick(row, ["watchlist"]));
  collector.add({
    kind,
    title: pick(row, ["show_title", "title", "name"]),
    year: toYear(pick(row, ["year", "show_year"])),
    ids: {
      tmdb: toInt(pick(row, isEpisode ? ["show_tmdb_id", "tmdb_id", "tmdb"] : ["tmdb_id", "tmdb"])),
      imdb: toImdb(pick(row, isEpisode ? ["show_imdb_id"] : ["imdb_id", "imdb"])),
      tvdb: toInt(pick(row, isEpisode ? ["show_tvdb_id", "tvdb_id"] : ["tvdb_id", "tvdb"])),
    },
    status: watchedAt && kind === "movie" ? "SEEN" : watchlisted ? "WATCHLIST" : null,
    favorite: /^(true|1|yes)$/i.test(pick(row, ["favorite", "favorited"])),
    rating: isEpisode ? null : ratingFrom(pick(row, ["rating", "my_rating"]), 10),
    review: pick(row, ["review", "comment"]),
    watchedAt,
    episodes: isEpisode
      ? [{ seasonNumber: pick(row, ["season", "season_number"]), episodeNumber: pick(row, ["episode", "episode_number"]), watchedAt }]
      : [],
  });
}

export function parseTrakt(files) {
  const collector = new ImportCollector();
  for (const file of files) {
    const base = baseName(file.name);
    const { rows, records } = readRows(file);
    if (records) {
      const role = roleOf(base) || "watched";
      for (const rec of records) addJsonRecord(collector, rec, role);
    } else {
      for (const row of rows) addCsvRow(collector, row);
    }
  }
  return collector.result();
}

export const traktAdapter = {
  id: "trakt",
  label: "Trakt.tv",
  hint: "Export Trakt (ZIP de fichiers JSON) ou fichier CSV avec les colonnes type, title, year, tmdb_id/imdb_id.",
  detect(files) {
    if (files.some((f) => /"ids"\s*:\s*\{[^}]*"trakt"/.test(f.text.slice(0, 5000)))) return 0.95;
    if (files.some((f) => /(watched|history|watchlist|ratings)-(movies|shows|episodes)/.test(baseName(f.name)))) return 0.8;
    if (files.some((f) => /trakt|watchlisted_at|tvdb_id/i.test(f.text.slice(0, 300)) && /\btype\b/i.test(f.text.slice(0, 300)))) return 0.7;
    return 0;
  },
  parse: parseTrakt,
};
