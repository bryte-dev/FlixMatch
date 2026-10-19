import test from "node:test";
import assert from "node:assert/strict";
import { createImporter, sanitizeCommitItem, sanitizeResolveItem } from "../services/importer.js";

test("sanitizeResolveItem / sanitizeCommitItem : validation stricte", () => {
  assert.equal(sanitizeResolveItem({ key: "a" }), null);
  assert.deepEqual(sanitizeResolveItem({ key: "a", kind: "film", title: " X ", ids: { imdb: "tt0113277", tmdb: -1 } }), {
    key: "a", kind: null, title: "X", year: null, ids: { tmdb: null, imdb: "tt0113277", tvdb: null },
  });
  assert.equal(sanitizeCommitItem({ tmdbId: 1, mediaType: "book", title: "X" }), null);
  const c = sanitizeCommitItem({
    key: "k", tmdbId: 5, mediaType: "tv", title: "S", poster: "javascript:alert(1)", status: "JUNK", rating: 9,
    episodes: [{ seasonNumber: 1, episodeNumber: 2 }, { seasonNumber: -1, episodeNumber: 1 }, { seasonNumber: 1, episodeNumber: 0 }],
  });
  assert.equal(c.poster, "");
  assert.equal(c.status, "SEEN");
  assert.equal(c.rating, null);
  assert.equal(c.episodes.length, 1);
});

// TMDB simulé : un même id 1399 existe en film ET en série
const fakeTmdb = async (route, params = {}) => {
  if (route === "/tv/1399") return { id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17", poster_path: "/got.jpg" };
  if (route === "/movie/1399") return { id: 1399, title: "Some Movie", release_date: "1990-01-01" };
  if (route.startsWith("/find/")) {
    if (params.external_source === "tvdb_id" && route === "/find/121361") return { tv_results: [{ id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17" }] };
    if (route === "/find/tt0944947") return { movie_results: [{ id: 42, title: "Wrong Movie" }], tv_results: [] };
    return {};
  }
  if (route === "/search/tv") return { results: [{ id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17", vote_count: 20000 }] };
  if (route === "/search/movie") return { results: [{ id: 77, title: "Game of Thrones", release_date: "2013-01-01" }] };
  throw Object.assign(new Error("not found"), { response: { status: 404 } });
};

test("resolveItems : le type demandé est respecté (une série ne devient jamais un film)", async () => {
  const importer = createImporter({ prisma: {}, tmdbGet: fakeTmdb, getSeason: async () => ({ episodes: [] }), isAired: () => true });
  const [byTvdb, byImdbWrongKind, byTitle, byTmdb] = await importer.resolveItems([
    { key: "a", kind: "tv", title: "GoT", year: null, ids: { tmdb: null, imdb: null, tvdb: 121361 } },
    { key: "b", kind: "tv", title: "Game of Thrones", year: 2011, ids: { tmdb: null, imdb: "tt0944947", tvdb: null } },
    { key: "c", kind: "tv", title: "Game of Thrones", year: null, ids: { tmdb: null, imdb: null, tvdb: null } },
    { key: "d", kind: "tv", title: "x", year: null, ids: { tmdb: 1399, imdb: null, tvdb: null } },
  ]);
  assert.deepEqual([byTvdb.match.mediaType, byTvdb.match.tmdbId, byTvdb.match.via], ["tv", 1399, "tvdb"]);
  // l'IMDb ne renvoie qu'un film : ignoré, repli sur la recherche par titre de série
  assert.deepEqual([byImdbWrongKind.match.mediaType, byImdbWrongKind.match.tmdbId, byImdbWrongKind.match.via], ["tv", 1399, "title"]);
  assert.equal(byTitle.match.mediaType, "tv");
  assert.equal(byTmdb.match.title, "Game of Thrones");
});

test("resolveItems : TMDB indisponible → élément signalé, pas d'exception", async () => {
  const importer = createImporter({ prisma: {}, tmdbGet: async () => { throw new Error("timeout"); }, getSeason: async () => ({ episodes: [] }), isAired: () => true });
  const [r] = await importer.resolveItems([{ key: "a", kind: "movie", title: "Heat", year: 1995, ids: {} }]);
  assert.equal(r.match, null);
  assert.equal(r.error, "tmdb_unavailable");
});

// Prisma simulé en mémoire (uniquement les appels utilisés par commitItems)
function fakePrisma() {
  const db = { movies: [], watchlist: [], episodes: [], reviews: [] };
  let id = 1;
  return {
    db,
    movie: {
      upsert: async ({ where, create }) => {
        const k = where.tmdb_id_media_type;
        let m = db.movies.find((x) => x.tmdb_id === k.tmdb_id && x.media_type === k.media_type);
        if (!m) db.movies.push((m = { id: id++, ...create }));
        return m;
      },
      update: async ({ where, data }) => Object.assign(db.movies.find((x) => x.id === where.id), data),
    },
    watchlist: {
      findUnique: async ({ where }) => db.watchlist.find((w) => w.movieId === where.movieId_userId.movieId && w.userId === where.movieId_userId.userId) || null,
      create: async ({ data }) => db.watchlist.push({ id: id++, isFavorite: false, rating: null, ...data }),
      update: async ({ where, data }) => Object.assign(db.watchlist.find((w) => w.id === where.id), data),
    },
    episodeWatch: {
      createMany: async ({ data }) => {
        let count = 0;
        for (const row of data) {
          if (db.episodes.some((e) => e.userId === row.userId && e.tmdbSeriesId === row.tmdbSeriesId && e.seasonNumber === row.seasonNumber && e.episodeNumber === row.episodeNumber)) continue;
          db.episodes.push(row);
          count++;
        }
        return { count };
      },
    },
    review: {
      count: async ({ where }) => db.reviews.filter((r) => r.userId === where.userId && r.movieId === where.movieId).length,
      create: async ({ data }) => db.reviews.push(data),
    },
  };
}

test("commitItems : collision d'id film/série, fusion sans dégradation, idempotence", async () => {
  const prisma = fakePrisma();
  const season = { episodes: [{ id: 11, episode_number: 1, air_date: "2011-04-17", runtime: 60 }, { id: 12, episode_number: 2, air_date: "2011-04-24", runtime: 60 }] };
  const importer = createImporter({ prisma, tmdbGet: fakeTmdb, getSeason: async () => season, isAired: () => true });

  // Un film 1399 existe déjà dans la bibliothèque, l'utilisateur l'a vu et noté
  await importer.commitItems(1, [sanitizeCommitItem({ key: "m", tmdbId: 1399, mediaType: "movie", title: "Some Movie", status: "SEEN", rating: 2 })]);

  const series = sanitizeCommitItem({
    key: "s", tmdbId: 1399, mediaType: "tv", title: "Game of Thrones", status: "WATCHLIST", favorite: true, review: "Top",
    episodes: [{ seasonNumber: 1, episodeNumber: 1 }, { seasonNumber: 1, episodeNumber: 2 }, { seasonNumber: 1, episodeNumber: 99 }],
  });
  const [first] = await importer.commitItems(1, [series]);
  assert.equal(first.libraryAction, "created");
  assert.equal(first.episodesAdded, 2);
  assert.equal(first.episodesSkipped, 1);
  assert.equal(prisma.db.movies.length, 2); // film et série distincts malgré le même id TMDB

  // Réimport : rien n'est dupliqué, une note importée n'écrase pas la note existante
  const [again] = await importer.commitItems(1, [series]);
  assert.equal(again.episodesAdded, 0);
  assert.equal(again.reviewAdded, false);
  await importer.commitItems(1, [sanitizeCommitItem({ key: "m2", tmdbId: 1399, mediaType: "movie", title: "Some Movie", status: "WATCHLIST", rating: 5 })]);
  const movieEntry = prisma.db.watchlist.find((w) => w.movieId === prisma.db.movies.find((m) => m.media_type === "movie").id);
  assert.equal(movieEntry.status, "SEEN");
  assert.equal(movieEntry.rating, 2);
  assert.equal(prisma.db.reviews.length, 1);
});
