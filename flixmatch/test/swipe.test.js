import test from "node:test";
import assert from "node:assert/strict";
import { classifySwipe, swipeIndicators } from "../src/lib/swipe.js";

test("classifySwipe : seuils et directions", () => {
  assert.equal(classifySwipe(120, 0), "right");
  assert.equal(classifySwipe(-120, 10), "left");
  assert.equal(classifySwipe(10, -150), "up");
  assert.equal(classifySwipe(40, 5), null);
});

test("classifySwipe : un geste diagonal plutôt horizontal reste horizontal", () => {
  assert.equal(classifySwipe(200, -120), "right");
});

test("swipeIndicators : un seul indicateur actif à la fois", () => {
  const i = swipeIndicators(60, -10);
  assert.ok(i.right > 0 && i.left === 0 && i.up === 0);
  const u = swipeIndicators(5, -80);
  assert.ok(u.up > 0 && u.right === 0);
});
