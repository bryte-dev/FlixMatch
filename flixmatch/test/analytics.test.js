import test from "node:test";
import assert from "node:assert/strict";
import { analyticsConfigured, cleanPath, cleanProps, eventForRequest, routeTemplate, scrubText, track } from "../src/lib/analytics.js";

test("sans clé PostHog : inactif et sans erreur", () => {
  assert.equal(analyticsConfigured(), false);
  assert.doesNotThrow(() => track("anything", { a: 1 }));
});

test("cleanPath / routeTemplate : aucune donnée personnelle dans les routes", () => {
  assert.equal(cleanPath("/join/AbC123?x=1"), "/join/:code");
  assert.equal(cleanPath("/search/mon%20film#top"), "/search/:query");
  assert.equal(routeTemplate("https://flixmatch.onrender.com/watchlist/42/seen"), "/watchlist/:id/seen");
  assert.equal(routeTemplate("/tmdb/search/secret%20query?lang=fr"), "/tmdb/search");
  assert.equal(routeTemplate("/invite/xyz"), "/invite/:code");
  assert.equal(routeTemplate("/episodes/1399/1/2"), "/episodes/:id/:id/:id");
});

test("scrubText / cleanProps : emails et jetons masqués, types simples uniquement", () => {
  assert.equal(scrubText("contact a.b@c.de now"), "contact [email] now");
  assert.match(scrubText("token eyJhbGciOi.eyJ1c2VySWQiOjF9.abc"), /\[token\]/);
  assert.deepEqual(cleanProps({ a: "x", n: 2, b: true, o: { nested: 1 }, u: undefined, f: () => 1, l: ["q", 3] }), { a: "x", n: 2, b: true, l: ["q", 3] });
  assert.equal(cleanProps({ s: "ab ".repeat(200) }).s.length, 120);
  assert.equal(cleanProps({ s: "x".repeat(500) }).s, "[token]");
});

test("eventForRequest : appels API → événements produit", () => {
  assert.deepEqual(eventForRequest("post", "/watchlist", '{"tmdb_id":1}'), { name: "watchlist_added", props: undefined });
  assert.equal(eventForRequest("put", "/watchlist/12/favorite", { isFavorite: true }).name, "favorite_added");
  assert.equal(eventForRequest("put", "/watchlist/12/favorite", { isFavorite: false }).name, "favorite_removed");
  assert.deepEqual(eventForRequest("put", "/seen/3/rating", '{"rating":4}'), { name: "rating_set", props: { rating: 4 } });
  assert.deepEqual(eventForRequest("post", "/reviews", { parentId: 9, comment: "secret" }), { name: "review_posted", props: { is_reply: true, rating: undefined } });
  assert.equal(eventForRequest("put", "/episodes/1399/bulk", { watched: true }).props.scope, "bulk");
  assert.equal(eventForRequest("delete", "/account", {}).name, "account_deleted");
  assert.equal(eventForRequest("get", "/watchlist"), null);
  assert.equal(eventForRequest("post", "/login", { password: "x" }), null);
});
