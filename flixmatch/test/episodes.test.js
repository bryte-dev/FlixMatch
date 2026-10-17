import test from "node:test";
import assert from "node:assert/strict";
import {
  epKey, isAired, missingBefore, incompleteSeasonsBefore, watchedAfter,
  firstIncompleteSeason, nextUnwatched, lastWatchedLabel, seriesStatus,
} from "../src/lib/episodes.js";

const TODAY = "2025-06-01";
const eps = (n, air = "2020-01-01") => Array.from({ length: n }, (_, i) => ({ episode_number: i + 1, air_date: air }));
const data = { 0: eps(2), 1: eps(3), 2: eps(3), 3: [...eps(2), { episode_number: 3, air_date: "2099-01-01" }] };

test("missingBefore : épisodes précédents non vus (même saison et saisons précédentes)", () => {
  const watched = new Set([epKey(1, 1), epKey(1, 2), epKey(1, 3), epKey(2, 1)]);
  assert.deepEqual(missingBefore(data, watched, 2, 3, TODAY), [{ seasonNumber: 2, episodeNumber: 2 }]);
  assert.equal(missingBefore(data, watched, 1, 1, TODAY).length, 0);
});

test("missingBefore : saison 0 (spéciaux) est une piste séparée", () => {
  const none = new Set();
  assert.deepEqual(missingBefore(data, none, 0, 2, TODAY), [{ seasonNumber: 0, episodeNumber: 1 }]);
  assert.ok(missingBefore(data, none, 2, 1, TODAY).every((m) => m.seasonNumber === 1));
});

test("missingBefore : ignore les épisodes non diffusés", () => {
  assert.equal(isAired({ air_date: "2099-01-01" }, TODAY), false);
  assert.equal(isAired({ air_date: null }, TODAY), true);
  const watched = new Set();
  const m = missingBefore({ 3: data[3] }, watched, 3, 4, TODAY);
  assert.deepEqual(m.map((x) => x.episodeNumber), [1, 2]);
});

test("incompleteSeasonsBefore : marquer la saison 3 propose les saisons 1 et 2", () => {
  const watched = new Set([epKey(1, 1), epKey(1, 2), epKey(1, 3)]);
  assert.deepEqual(incompleteSeasonsBefore(data, watched, 3, TODAY), [2]);
  assert.deepEqual(incompleteSeasonsBefore(data, new Set(), 3, TODAY), [1, 2]);
  assert.deepEqual(incompleteSeasonsBefore(data, new Set(), 0, TODAY), []);
});

test("watchedAfter : décocher propose de décocher les suivants", () => {
  const watched = new Set([epKey(1, 1), epKey(1, 2), epKey(1, 3), epKey(2, 1), epKey(0, 1)]);
  assert.deepEqual(watchedAfter(watched, 1, 1).map((w) => epKey(w.seasonNumber, w.episodeNumber)), ["1-2", "1-3", "2-1"]);
  assert.deepEqual(watchedAfter(watched, 0, 0).map((w) => epKey(w.seasonNumber, w.episodeNumber)), ["0-1"]);
});

test("prochain épisode et progression", () => {
  const seasons = [{ season_number: 0, episode_count: 2 }, { season_number: 1, episode_count: 3 }, { season_number: 2, episode_count: 3 }];
  const watched = new Set([epKey(1, 1), epKey(1, 2), epKey(1, 3), epKey(2, 1)]);
  assert.equal(firstIncompleteSeason(seasons, watched), 2);
  assert.equal(nextUnwatched(data[2], watched, 2, TODAY).episode_number, 2);
  assert.equal(lastWatchedLabel(watched), "S2·E1");
  assert.equal(lastWatchedLabel(new Set([epKey(0, 1)])), null);
});

test("seriesStatus", () => {
  assert.equal(seriesStatus({ watchedRegular: 0, totalRegular: 10 }), "to_watch");
  assert.equal(seriesStatus({ watchedRegular: 3, totalRegular: 10 }), "in_progress");
  assert.equal(seriesStatus({ watchedRegular: 3, totalRegular: 10, abandoned: true }), "abandoned");
  assert.equal(seriesStatus({ watchedRegular: 10, totalRegular: 10, abandoned: true }), "completed");
});
