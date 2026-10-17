import test from "node:test";
import assert from "node:assert/strict";
import { getImdbRating, parseOmdb } from "../services/omdb.js";

test("parseOmdb : note et votes", () => {
  assert.deepEqual(parseOmdb({ Response: "True", imdbRating: "8.1", imdbVotes: "1,234,567" }), { rating: 8.1, votes: 1234567 });
  assert.equal(parseOmdb({ Response: "True", imdbRating: "N/A" }), null);
  assert.equal(parseOmdb({ Response: "False" }), null);
});

test("getImdbRating : fallback propre sans clé ou avec identifiant invalide", async () => {
  const previous = process.env.OMDB_API_KEY;
  try {
    delete process.env.OMDB_API_KEY;
    assert.equal(await getImdbRating("tt0111161"), null);
    process.env.OMDB_API_KEY = "x";
    assert.equal(await getImdbRating("pas-un-id"), null);
  } finally {
    if (previous === undefined) delete process.env.OMDB_API_KEY;
    else process.env.OMDB_API_KEY = previous;
  }
});
