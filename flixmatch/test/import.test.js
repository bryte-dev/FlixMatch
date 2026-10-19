import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseCsv } from "../src/lib/import/csv.js";
import { classifyRow, parseTvTime } from "../src/lib/import/tvtime.js";
import { parseLetterboxd } from "../src/lib/import/letterboxd.js";
import { parseTrakt } from "../src/lib/import/trakt.js";
import { parseFlixMatch } from "../src/lib/import/flixmatch.js";
import { detectAdapter } from "../src/lib/import/index.js";
import { ratingFrom } from "../src/lib/import/model.js";
import { pickBest } from "../src/lib/import/match.js";
import { buildCommitItems, commitBatches, needsReview } from "../src/lib/import/runner.js";
import { buildFlixMatchExport, buildLetterboxdCsv, buildTraktCsv, csvCell } from "../src/lib/export.js";
import { listZip } from "../src/lib/zip.js";

const csv = (rows) => rows.join("\n");
const byTitle = (r, title) => r.items.find((i) => i.title === title);

test("parseCsv : guillemets, BOM, point-virgule", () => {
  const out = parseCsv('\uFEFFSeries Name;Season\n"A; B";1\n');
  assert.deepEqual(out, [{ series_name: "A; B", season: "1" }]);
  assert.equal(parseCsv('a,b\n"x ""y""",2')[0].a, 'x "y"');
});

test("parseTvTime : épisodes (dédupliqués), films et favoris", () => {
  const files = [
    { name: "tracking-prod-records.csv", text: csv([
      "entity_type,series_name,season_number,episode_number,created_at",
      "episode,Dark,1,1,2020-01-01",
      "episode,Dark,1,2,2020-01-02",
      "episode,Dark,1,2,2020-01-03",
      "episode,Lost,0,1,2019-05-05",
      "movie,,,,",
    ]) },
    { name: "movies.csv", text: csv(["movie_name,created_at", "Inception,2021-02-02"]) },
    { name: "favorite_shows.csv", text: csv(["series_name", "Dark"]) },
  ];
  const r = parseTvTime(files);
  assert.equal(r.stats.series, 2);
  assert.equal(r.stats.episodes, 3);
  assert.equal(r.stats.movies, 1);
  assert.equal(byTitle(r, "Dark").favorite, true);
  assert.equal(byTitle(r, "Dark").kind, "tv");
  assert.equal(byTitle(r, "Inception").kind, "movie");
  assert.equal(byTitle(r, "Inception").status, "SEEN");
});

test("parseTvTime : une colonne générique « name » d'un fichier de séries reste une série (bug film/série)", () => {
  const r = parseTvTime([
    { name: "followed_tv_show.csv", text: csv(["name,tv_show_id", "The Office,73244", "Fargo,269613"]) },
  ]);
  assert.equal(r.stats.movies, 0);
  assert.equal(r.stats.series, 2);
  assert.equal(byTitle(r, "The Office").ids.tvdb, 73244);
});

test("parseTvTime : l'id interne d'un film TV Time n'est pas pris pour un id TMDB", () => {
  const r = parseTvTime([
    { name: "movies.csv", text: csv(["movie_name,movie_id,tmdb_rating", "Up,12345,8"]) },
  ]);
  assert.equal(byTitle(r, "Up").ids.tmdb, null);
});

test("classifyRow : indices de type", () => {
  assert.equal(classifyRow({ entity_type: "episode", name: "X" }, "records.csv"), "tv");
  assert.equal(classifyRow({ title: "X" }, "watched_movies.csv"), "movie");
  assert.equal(classifyRow({ title: "X" }, "records.csv"), null);
  assert.equal(classifyRow({ name: "X", season: "1", episode: "2" }, "x.csv"), "tv");
});

test("parseTvTime : JSON imbriqué et fichiers inconnus ignorés", () => {
  const r = parseTvTime([
    { name: "x.json", text: JSON.stringify([{ show: { name: "Fargo" }, season: 2, episode: 3 }]) },
    { name: "readme.txt", text: "hello" },
    { name: "bad.json", text: "{" },
  ]);
  assert.equal(r.stats.episodes, 1);
  assert.equal(r.items[0].title, "Fargo");
});

test("parseLetterboxd : vus, notes, avis, watchlist, likes", () => {
  const r = parseLetterboxd([
    { name: "watched.csv", text: csv(["Date,Name,Year,Letterboxd URI", "2023-01-01,Heat,1995,https://boxd.it/a"]) },
    { name: "ratings.csv", text: csv(["Date,Name,Year,Letterboxd URI,Rating", "2023-01-01,Heat,1995,https://boxd.it/a,4.5"]) },
    { name: "reviews.csv", text: csv(["Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date", '2023-01-02,Heat,1995,u,4.5,,"Great, tense",,2023-01-01']) },
    { name: "watchlist.csv", text: csv(["Date,Name,Year,Letterboxd URI", "2023-02-01,Dune,2021,u", "2023-02-01,Dune,1984,u"]) },
    { name: "likes/films.csv", text: csv(["Date,Name,Year,Letterboxd URI", "2023-01-03,Heat,1995,u"]) },
    { name: "lists/my-list.csv", text: "Letterboxd list export v7\nfoo" },
  ]);
  const heat = byTitle(r, "Heat");
  assert.equal(r.items.length, 3); // Dune 2021 et Dune 1984 restent distincts
  assert.equal(heat.status, "SEEN");
  assert.equal(heat.rating, 5);
  assert.equal(heat.review, "Great, tense");
  assert.equal(heat.favorite, true);
  assert.equal(r.items.filter((i) => i.status === "WATCHLIST").length, 2);
});

test("parseTrakt : JSON (watched-shows, ratings, watchlist, history)", () => {
  const show = { title: "Dark", year: 2017, ids: { trakt: 1, tvdb: 334824, imdb: "tt5753856", tmdb: 70523 } };
  const movie = { title: "Heat", year: 1995, ids: { trakt: 2, imdb: "tt0113277", tmdb: 949 } };
  const r = parseTrakt([
    { name: "watched-shows.json", text: JSON.stringify([{ show, seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }] }] }]) },
    { name: "history-episodes.json", text: JSON.stringify([{ type: "episode", watched_at: "2020-01-01T00:00:00Z", episode: { season: 1, number: 3 }, show }]) },
    { name: "ratings-movies.json", text: JSON.stringify([{ type: "movie", rating: 8, movie }]) },
    { name: "watchlist-movies.json", text: JSON.stringify([{ type: "movie", listed_at: "2021-01-01", movie: { title: "Dune", year: 2021, ids: { trakt: 3, tmdb: 438631 } } }]) },
  ]);
  const dark = byTitle(r, "Dark");
  assert.equal(dark.kind, "tv");
  assert.equal(dark.ids.tmdb, 70523);
  assert.equal(dark.episodes.length, 3);
  assert.equal(byTitle(r, "Heat").rating, 4);
  assert.equal(byTitle(r, "Dune").status, "WATCHLIST");
});

test("collecteur : même titre sans année mais ids TMDB différents = deux œuvres", () => {
  const out = parseFlixMatch([{ name: "f.json", text: JSON.stringify({ format: "flixmatch", version: 2, items: [
    { kind: "movie", title: "Dune", ids: { tmdb: 841 }, status: "SEEN" },
    { kind: "movie", title: "Dune", ids: { tmdb: 438631 }, status: "WATCHLIST" },
  ] }) }]);
  assert.equal(out.items.length, 2);
});

test("ratingFrom : conversions d'échelle", () => {
  assert.equal(ratingFrom("0.5", 5), 1);
  assert.equal(ratingFrom("3,5", 5), 4);
  assert.equal(ratingFrom(10, 10), 5);
  assert.equal(ratingFrom("", 10), null);
  assert.equal(ratingFrom(11, 10), null);
});

test("pickBest : titre exact + année, refuse les correspondances faibles", () => {
  const results = [
    { id: 1, title: "Dune", release_date: "1984-12-14", vote_count: 3000 },
    { id: 2, title: "Dune", release_date: "2021-09-15", vote_count: 10000 },
    { id: 3, title: "Dune: Part Two", release_date: "2024-02-27", vote_count: 5000 },
  ];
  assert.equal(pickBest(results, { title: "Dune", year: 1984 }).result.id, 1);
  assert.equal(pickBest(results, { title: "Dune", year: 2021 }).result.id, 2);
  assert.equal(pickBest([{ id: 9, title: "Titanic", release_date: "1997-01-01" }], { title: "It" }), null);
  assert.equal(pickBest([{ id: 7, name: "The Office", first_air_date: "2005-03-24" }], { title: "Office" }).result.id, 7);
});

test("buildCommitItems : fusion des doublons vers un même titre TMDB, séries uniquement avec épisodes", () => {
  const match = { tmdbId: 70523, mediaType: "tv", title: "Dark", poster: "/p.jpg", via: "tvdb" };
  const items = [
    { key: "a", kind: "tv", title: "Dark", status: "WATCHLIST", episodes: [{ seasonNumber: 1, episodeNumber: 1 }], match },
    { key: "b", kind: "tv", title: "DARK", status: "SEEN", favorite: true, episodes: [{ seasonNumber: 1, episodeNumber: 1 }, { seasonNumber: 1, episodeNumber: 2 }], match },
    { key: "c", kind: "movie", title: "Nope", match: null },
  ];
  const out = buildCommitItems(items);
  assert.equal(out.length, 1);
  assert.equal(out[0].status, "SEEN");
  assert.equal(out[0].favorite, true);
  assert.equal(out[0].episodes.length, 2);
  assert.equal(needsReview({ match: { via: "title", score: 90 } }), true);
  assert.equal(needsReview({ match: { via: "imdb" } }), false);
});

test("commitBatches : respecte le nombre et le coût par lot", () => {
  const many = Array.from({ length: 120 }, (_, i) => ({ key: `k${i}`, episodes: [] }));
  assert.deepEqual(commitBatches(many).map((b) => b.length), [50, 50, 20]);
  const heavy = Array.from({ length: 5 }, (_, i) => ({ key: `h${i}`, episodes: Array.from({ length: 2000 }, () => ({ seasonNumber: 1, episodeNumber: 1 })) }));
  assert.ok(commitBatches(heavy).every((b) => b.length <= 4));
});

const sampleExport = {
  exportedAt: "2026-10-19T00:00:00.000Z",
  account: { email: "a@b.c", username: "me" },
  library: [
    { status: "SEEN", isFavorite: true, rating: 4, abandoned: false, createdAt: "2024-01-01T00:00:00.000Z", movie: { tmdb_id: 949, title: "Heat", media_type: "movie", poster_path: "/h.jpg" } },
    { status: "WATCHLIST", isFavorite: false, rating: null, abandoned: false, createdAt: "2024-02-01T00:00:00.000Z", movie: { tmdb_id: 438631, title: "=Dune", media_type: "movie", poster_path: "" } },
    { status: "WATCHLIST", isFavorite: false, rating: null, abandoned: false, createdAt: "2024-03-01T00:00:00.000Z", movie: { tmdb_id: 70523, title: "Dark", media_type: "tv", poster_path: "" } },
    { status: "JUNK", isFavorite: false, rating: null, abandoned: false, createdAt: "2024-03-01T00:00:00.000Z", movie: { tmdb_id: 1, title: "Bad", media_type: "movie", poster_path: "" } },
  ],
  reviews: [{ rating: 4, comment: 'Classic, "tense"', createdAt: "2024-01-02T00:00:00.000Z", parentId: null, movie: { tmdb_id: 949, title: "Heat", media_type: "movie" } }],
  episodes: [
    { tmdbSeriesId: 70523, seasonNumber: 1, episodeNumber: 1, watchedAt: "2024-03-02T00:00:00.000Z" },
    { tmdbSeriesId: 1399, seasonNumber: 1, episodeNumber: 1, watchedAt: "2024-03-03T00:00:00.000Z" },
  ],
};

test("export FlixMatch : complet et réimportable (aller-retour)", () => {
  const out = buildFlixMatchExport(sampleExport, { theme: "dark" });
  assert.equal(out.format, "flixmatch");
  assert.equal(out.items.length, 5); // 4 entrées + 1 série suivie seulement via les épisodes
  assert.equal(out.items.find((i) => i.ids.tmdb === 70523).episodes.length, 1);
  assert.equal(out.items.find((i) => i.ids.tmdb === 949).review.comment, 'Classic, "tense"');

  const back = parseFlixMatch([{ name: "flixmatch-export.json", text: JSON.stringify(out) }]);
  assert.equal(back.items.length, 4); // la corbeille n'est pas réimportée
  const heat = back.items.find((i) => i.ids.tmdb === 949);
  assert.equal(heat.kind, "movie");
  assert.equal(heat.favorite, true);
  assert.equal(heat.rating, 4);
  assert.equal(heat.review, 'Classic, "tense"');
  assert.equal(detectAdapter([{ name: "x.json", text: JSON.stringify(out) }]).id, "flixmatch");
});

test("export Letterboxd : films seulement, réimportable", () => {
  const watched = buildLetterboxdCsv(sampleExport, "watched");
  const rows = parseCsv(watched);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tmdbid, "949");
  assert.equal(rows[0].rating, "4");
  const list = parseCsv(buildLetterboxdCsv(sampleExport, "watchlist"));
  assert.equal(list[0].title, "'=Dune"); // formule tableur neutralisée
  const back = parseLetterboxd([{ name: "flixmatch-letterboxd-watched.csv", text: watched }]);
  assert.equal(back.items[0].ids.tmdb, 949);
  assert.equal(back.items[0].rating, 4);
  assert.equal(detectAdapter([{ name: "flixmatch-letterboxd-watched.csv", text: watched }]).id, "letterboxd");
});

test("export Trakt : films, séries et épisodes, réimportable", () => {
  const text = buildTraktCsv(sampleExport);
  const rows = parseCsv(text);
  assert.equal(rows.filter((r) => r.type === "episode").length, 2);
  assert.equal(rows.find((r) => r.tmdb_id === "949").rating, "8");
  const back = parseTrakt([{ name: "flixmatch-trakt.csv", text }]);
  const dark = back.items.find((i) => i.ids.tmdb === 70523 && i.kind === "tv");
  assert.equal(dark.episodes.length, 1);
  assert.equal(back.items.find((i) => i.ids.tmdb === 949).rating, 4);
  assert.equal(detectAdapter([{ name: "flixmatch-trakt.csv", text }]).id, "trakt");
});

test("csvCell : échappement", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("@cmd"), "'@cmd");
  assert.equal(csvCell(null), "");
});

// construit un petit ZIP (deflate) en mémoire
function makeZip(name, content) {
  const data = deflateRawSync(Buffer.from(content));
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = local.length + nameBuf.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length + nameBuf.length, 12); eocd.writeUInt32LE(cdOffset, 16);
  const b = Buffer.concat([local, nameBuf, data, central, nameBuf, eocd]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

test("listZip : lit un fichier deflate", async () => {
  const entries = listZip(makeZip("a/b.csv", "x,y\n1,2"));
  assert.equal(entries[0].name, "a/b.csv");
  assert.equal(new TextDecoder().decode(await entries[0].read()), "x,y\n1,2");
  assert.throws(() => listZip(new ArrayBuffer(10)));
});
