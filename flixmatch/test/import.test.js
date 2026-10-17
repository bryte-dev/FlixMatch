import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseCsv } from "../src/lib/import/csv.js";
import { parseTvTime } from "../src/lib/import/tvtime.js";
import { listZip } from "../src/lib/zip.js";

const csv = (rows) => rows.join("\n");

test("parseCsv : guillemets, BOM, point-virgule", () => {
  const out = parseCsv('\uFEFFSeries Name;Season\n"A; B";1\n');
  assert.deepEqual(out, [{ series_name: "A; B", season: "1" }]);
  assert.equal(parseCsv('a,b\n"x ""y""",2')[0].a, 'x "y"');
});

test("parseTvTime : épisodes (dédupliqués) et films", () => {
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
  assert.equal(r.series.find((s) => s.name === "Dark").favorite, true);
  assert.equal(r.movies[0].name, "Inception");
});

test("parseTvTime : JSON et fichiers inconnus ignorés", () => {
  const r = parseTvTime([
    { name: "x.json", text: JSON.stringify([{ show_name: "Fargo", season: 2, episode: 3 }]) },
    { name: "readme.txt", text: "hello" },
    { name: "bad.json", text: "{" },
  ]);
  assert.equal(r.stats.episodes, 1);
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
