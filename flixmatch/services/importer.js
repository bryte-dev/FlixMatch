// Import / export de bibliothèque côté serveur.
// - resolveItems : correspondance TMDB (id TMDB → IMDb/TVDB via /find → titre + année + type)
// - commitItems  : écriture idempotente (fusion sans jamais dégrader l'existant)
// - exportLibrary : toutes les données de l'utilisateur (RGPD)
import { candidateYear, pickBest } from "../src/lib/import/match.js";
import { normTitle } from "../src/lib/import/model.js";

export const MAX_RESOLVE_BATCH = 40;
export const MAX_COMMIT_BATCH = 50;
const MAX_EPISODES_PER_ITEM = 5000;
const MAX_INT = 2147483647;

const posInt = (v, max = MAX_INT) => (Number.isInteger(v) && v > 0 && v <= max ? v : null);
const kindOf = (v) => (v === "movie" || v === "tv" ? v : null);
const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const isoDate = (v) => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86400000 ? null : d;
};

// ---------- Validation des entrées ----------

export function sanitizeResolveItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const key = str(raw.key, 40);
  if (!key) return null;
  const ids = raw.ids && typeof raw.ids === "object" ? raw.ids : {};
  const imdb = typeof ids.imdb === "string" && /^tt\d{5,10}$/.test(ids.imdb) ? ids.imdb : null;
  const item = {
    key,
    kind: kindOf(raw.kind),
    title: str(raw.title, 300),
    year: posInt(raw.year, 2100),
    ids: { tmdb: posInt(ids.tmdb), imdb, tvdb: posInt(ids.tvdb) },
  };
  if (!item.title && !item.ids.tmdb && !item.ids.imdb && !item.ids.tvdb) return null;
  return item;
}

export function sanitizeCommitItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const tmdbId = posInt(raw.tmdbId);
  const mediaType = kindOf(raw.mediaType);
  const title = str(raw.title, 300);
  if (!tmdbId || !mediaType || !title) return null;
  const episodes = [];
  if (mediaType === "tv" && Array.isArray(raw.episodes)) {
    for (const e of raw.episodes.slice(0, MAX_EPISODES_PER_ITEM)) {
      const s = Number.isInteger(e?.seasonNumber) && e.seasonNumber >= 0 && e.seasonNumber <= 500 ? e.seasonNumber : null;
      const n = posInt(e?.episodeNumber, 10000);
      if (s !== null && n) episodes.push({ seasonNumber: s, episodeNumber: n, watchedAt: isoDate(e.watchedAt) });
    }
  }
  const rating = Number.isInteger(raw.rating) && raw.rating >= 1 && raw.rating <= 5 ? raw.rating : null;
  return {
    key: str(raw.key, 40) || String(tmdbId),
    tmdbId,
    mediaType,
    title,
    poster: typeof raw.poster === "string" && /^\/[\w.-]{1,200}$/.test(raw.poster) ? raw.poster : "",
    status: raw.status === "SEEN" || raw.status === "WATCHLIST" ? raw.status : "SEEN",
    favorite: raw.favorite === true,
    rating,
    review: str(raw.review, 2000),
    watchedAt: isoDate(raw.watchedAt),
    episodes,
  };
}

// ---------- Utilitaires ----------

async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

const summarize = (r, mediaType, via) => ({
  tmdbId: r.id,
  mediaType,
  title: r.title || r.name || r.original_title || r.original_name || "",
  poster: r.poster_path || "",
  year: candidateYear(r),
  via,
});

export function createImporter({ prisma, tmdbGet, getSeason, isAired }) {
  const cache = new Map();
  const CACHE_TTL = 6 * 60 * 60 * 1000;
  const cacheKey = (it) => JSON.stringify([it.kind, it.ids.tmdb, it.ids.imdb, it.ids.tvdb, normTitle(it.title), it.year]);

  const byId = async (id, kind) => {
    try {
      return summarize(await tmdbGet(`/${kind}/${id}`, { language: "en-US" }), kind, "tmdb");
    } catch (error) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  };

  // Résultats de /find, en respectant le type demandé (une série ne devient jamais un film)
  const viaFind = async (externalId, source, kind) => {
    const data = await tmdbGet(`/find/${externalId}`, { external_source: source, language: "en-US" });
    const order = kind === "movie" ? ["movie"] : kind === "tv" ? ["tv"] : ["tv", "movie"];
    for (const t of order) {
      const r = data?.[`${t}_results`]?.[0];
      if (r) return summarize(r, t, source === "imdb_id" ? "imdb" : "tvdb");
    }
    if (kind !== "movie") {
      // id d'épisode ou de saison : on remonte à la série
      const ep = data?.tv_episode_results?.[0] || data?.tv_season_results?.[0];
      if (ep?.show_id) return byId(ep.show_id, "tv");
    }
    return null;
  };

  const viaSearch = async (item) => {
    const kinds = item.kind ? [item.kind] : ["tv", "movie"];
    let best = null;
    for (const kind of kinds) {
      const yearParam = kind === "movie" ? "year" : "first_air_date_year";
      const attempts = item.year ? [{ [yearParam]: item.year }, {}] : [{}];
      for (const extra of attempts) {
        const data = await tmdbGet(`/search/${kind}`, { query: item.title, language: "en-US", include_adult: false, ...extra });
        const hit = pickBest(data?.results, item);
        if (hit && (!best || hit.score > best.score)) best = { ...hit, kind };
        if (best && best.score >= 120) break; // titre exact + bonne année : inutile d'élargir
      }
    }
    return best ? { ...summarize(best.result, best.kind, "title"), score: Math.round(best.score) } : null;
  };

  const resolveOne = async (item) => {
    const ck = cacheKey(item);
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;

    let match = null;
    if (item.ids.tmdb && item.kind) match = await byId(item.ids.tmdb, item.kind);
    if (!match && item.ids.imdb) match = await viaFind(item.ids.imdb, "imdb_id", item.kind);
    if (!match && item.ids.tvdb && item.kind !== "movie") match = await viaFind(item.ids.tvdb, "tvdb_id", item.kind);
    if (!match && item.title) match = await viaSearch(item);

    if (cache.size > 5000) cache.clear();
    cache.set(ck, { at: Date.now(), value: match });
    return match;
  };

  async function resolveItems(items) {
    return pool(items, 4, async (item) => {
      try {
        return { key: item.key, match: await resolveOne(item) };
      } catch (error) {
        // TMDB indisponible ou trop lent : l'élément est signalé, l'import peut être relancé
        return { key: item.key, match: null, error: error?.response?.status === 429 ? "rate_limited" : "tmdb_unavailable" };
      }
    });
  }

  // Épisodes réellement présents (et diffusés) chez TMDB ; les numérotations divergentes sont ignorées
  async function episodeRows(userId, item) {
    const bySeason = new Map();
    for (const e of item.episodes) {
      if (!bySeason.has(e.seasonNumber)) bySeason.set(e.seasonNumber, new Map());
      bySeason.get(e.seasonNumber).set(e.episodeNumber, e.watchedAt);
    }
    const rows = [];
    let skipped = 0;
    await pool([...bySeason], 3, async ([seasonNumber, wanted]) => {
      let season;
      try {
        season = await getSeason(item.tmdbId, seasonNumber);
      } catch {
        skipped += wanted.size;
        return;
      }
      const known = new Map(season.episodes.map((e) => [e.episode_number, e]));
      for (const [episodeNumber, watchedAt] of wanted) {
        const e = known.get(episodeNumber);
        if (!e || !isAired(e)) {
          skipped++;
          continue;
        }
        rows.push({
          userId,
          tmdbSeriesId: item.tmdbId,
          seasonNumber,
          episodeNumber,
          tmdbEpisodeId: e.id,
          name: e.name ? String(e.name).slice(0, 300) : null,
          runtime: e.runtime,
          ...(watchedAt ? { watchedAt } : {}),
        });
      }
    });
    return { rows, skipped };
  }

  async function commitOne(userId, item) {
    const movie = await prisma.movie.upsert({
      where: { tmdb_id_media_type: { tmdb_id: item.tmdbId, media_type: item.mediaType } },
      update: {},
      create: { tmdb_id: item.tmdbId, title: item.title, media_type: item.mediaType, poster_path: item.poster },
    });
    if (!movie.poster_path && item.poster) {
      await prisma.movie.update({ where: { id: movie.id }, data: { poster_path: item.poster } });
    }

    // Un film noté a forcément été vu
    const status = item.mediaType === "movie" && item.rating ? "SEEN" : item.status;
    const existing = await prisma.watchlist.findUnique({ where: { movieId_userId: { movieId: movie.id, userId } } });
    let libraryAction = "unchanged";
    if (!existing) {
      await prisma.watchlist.create({
        data: { movieId: movie.id, userId, status, isFavorite: item.favorite, rating: item.rating, ...(item.watchedAt ? { createdAt: item.watchedAt } : {}) },
      });
      libraryAction = "created";
    } else {
      const data = {};
      // On ne dégrade jamais : SEEN reste SEEN, la corbeille reste en corbeille
      if (existing.status === "IGNORED" || (existing.status === "WATCHLIST" && status === "SEEN")) data.status = status;
      if (item.favorite && !existing.isFavorite && existing.status !== "JUNK") data.isFavorite = true;
      if (item.rating && existing.rating == null) data.rating = item.rating;
      if (Object.keys(data).length > 0) {
        await prisma.watchlist.update({ where: { id: existing.id }, data });
        libraryAction = "updated";
      }
    }

    let episodesAdded = 0;
    let episodesSkipped = 0;
    if (item.episodes.length > 0) {
      const { rows, skipped } = await episodeRows(userId, item);
      episodesSkipped = skipped;
      if (rows.length > 0) episodesAdded = (await prisma.episodeWatch.createMany({ data: rows, skipDuplicates: true })).count;
    }

    let reviewAdded = false;
    if (item.review) {
      const hasReview = await prisma.review.count({ where: { userId, movieId: movie.id, parentId: null } });
      if (!hasReview) {
        await prisma.review.create({
          data: { userId, movieId: movie.id, rating: item.rating, comment: item.review, ...(item.watchedAt ? { createdAt: item.watchedAt } : {}) },
        });
        reviewAdded = true;
      }
    }
    return { libraryAction, episodesAdded, episodesSkipped, reviewAdded };
  }

  async function commitItems(userId, items) {
    const results = [];
    for (const item of items) {
      try {
        results.push({ key: item.key, ok: true, ...(await commitOne(userId, item)) });
      } catch (error) {
        console.error("❌ Import d'un élément :", error?.code || error?.message || "erreur inconnue");
        results.push({ key: item.key, ok: false });
      }
    }
    return results;
  }

  async function exportLibrary(userId) {
    const movieSelect = { select: { tmdb_id: true, title: true, media_type: true, poster_path: true } };
    const [account, library, reviews, episodes, following] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, username: true, privacyProfile: true, privacyLibrary: true, privacyActivity: true },
      }),
      prisma.watchlist.findMany({
        where: { userId },
        select: { status: true, isFavorite: true, rating: true, abandoned: true, createdAt: true, movie: movieSelect },
        orderBy: { createdAt: "asc" },
      }),
      prisma.review.findMany({
        where: { userId },
        select: { rating: true, comment: true, createdAt: true, parentId: true, movie: movieSelect },
        orderBy: { createdAt: "asc" },
      }),
      prisma.episodeWatch.findMany({
        where: { userId },
        select: { tmdbSeriesId: true, seasonNumber: true, episodeNumber: true, watchedAt: true, name: true },
        orderBy: [{ tmdbSeriesId: "asc" }, { seasonNumber: "asc" }, { episodeNumber: "asc" }],
      }),
      prisma.follow.findMany({
        where: { followerId: userId },
        select: { createdAt: true, following: { select: { id: true, username: true } } },
      }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      account,
      library,
      reviews,
      episodes,
      following: following.map((f) => ({ id: f.following.id, username: f.following.username, since: f.createdAt })),
    };
  }

  return { resolveItems, commitItems, exportLibrary };
}
