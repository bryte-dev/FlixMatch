import test from "node:test";
import assert from "node:assert/strict";
import { mergeSearchResults } from "../src/lib/searchMerge.js";

test("fusion : déduplique par type + id et garde l'ordre de la première langue", () => {
  const fr = [{ id: 1, media_type: "movie", title: "Le Voyage" }, { id: 2, media_type: "tv", name: "La Série" }];
  const en = [{ id: 3, media_type: "movie", title: "Only English" }, { id: 1, media_type: "movie", title: "The Journey" }];
  const out = mergeSearchResults([fr, en]);
  assert.deepEqual(out.map((r) => `${r.media_type}-${r.id}`), ["movie-1", "tv-2", "movie-3"]);
  assert.equal(out[0].title, "Le Voyage");
});

test("fusion : un film et une série de même id restent distincts", () => {
  const out = mergeSearchResults([[{ id: 5, media_type: "movie" }], [{ id: 5, media_type: "tv" }]]);
  assert.equal(out.length, 2);
});

test("fusion : complète les champs manquants (affiche, résumé)", () => {
  const out = mergeSearchResults([
    [{ id: 1, media_type: "movie", title: "A", overview: "", poster_path: null }],
    [{ id: 1, media_type: "movie", title: "A", overview: "Résumé", poster_path: "/p.jpg" }],
  ]);
  assert.equal(out[0].overview, "Résumé");
  assert.equal(out[0].poster_path, "/p.jpg");
});

test("fusion : ignore les types inconnus et les listes vides", () => {
  assert.deepEqual(mergeSearchResults([null, [{ id: 1, media_type: "collection" }], []]), []);
});
