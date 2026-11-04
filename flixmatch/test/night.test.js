import test from "node:test";
import assert from "node:assert/strict";
import { CODE_ALPHABET, buildDeck, generateRoomCode, isMatch, normalizeCode } from "../src/lib/night.js";

test("code de salon : 6 caractères sans ambiguïté", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generateRoomCode();
    assert.equal(code.length, 6);
    assert.ok([...code].every((c) => CODE_ALPHABET.includes(c)));
  }
});

test("normalizeCode accepte un lien, des minuscules et des tirets", () => {
  assert.equal(normalizeCode("abc-234"), "ABC234");
  assert.equal(normalizeCode("https://flixmatch.app/movie-night/abc234"), "ABC234");
  assert.equal(normalizeCode("ABC23"), null);
  assert.equal(normalizeCode("ABCO12"), null);
  assert.equal(normalizeCode(null), null);
});

test("isMatch : tous les membres, au moins deux", () => {
  assert.equal(isMatch(2, 3), false);
  assert.equal(isMatch(3, 3), true);
  assert.equal(isMatch(1, 1), false);
  assert.equal(isMatch(0, 0), false);
});

test("buildDeck : sans doublon, sans affiche manquante, positions continues", () => {
  const page = [
    { id: 1, title: "A", poster_path: "/a.jpg", release_date: "2020-01-01" },
    { id: 1, title: "A bis", poster_path: "/a.jpg" },
    { id: 2, name: "B", poster_path: null },
    { id: 3, name: "C", poster_path: "/c.jpg", first_air_date: "2019-05-05", vote_average: 7.5 },
  ];
  const deck = buildDeck([page], "movie", 10, () => 0.5);
  assert.deepEqual(deck.map((c) => c.tmdbId).sort(), [1, 3]);
  assert.deepEqual(deck.map((c) => c.position), [0, 1]);
  assert.equal(deck.find((c) => c.tmdbId === 3).year, "2019");
  assert.equal(buildDeck([page], "movie", 1).length, 1);
});
