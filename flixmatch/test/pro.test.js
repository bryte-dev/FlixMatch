import test from "node:test";
import assert from "node:assert/strict";
import { FREE_NIGHT_ROOMS_PER_DAY, PRO_FEATURES, PRO_PRICE_USD, hasProAccess, intentProps, proFakeDoorEnabled, roomsCreatedToday } from "../src/lib/pro.js";
import { DICT } from "../src/lib/i18nData.js";

test("fake door : actif par défaut, tout reste accessible pendant la bêta", () => {
  assert.equal(proFakeDoorEnabled(), true);
  assert.equal(hasProAccess(), true);
  assert.equal(PRO_PRICE_USD, 3.99);
});

test("propriétés de l'événement intent_to_purchase_pro", () => {
  assert.deepEqual(intentProps("night_rooms", "movie_night_create", "entry"), { feature: "night_rooms", source: "movie_night_create", stage: "entry", price_usd: 3.99, beta: true });
});

test("chaque fonctionnalité Pro a un libellé dans les 14 langues", () => {
  for (const { labelKey } of Object.values(PRO_FEATURES)) for (const lang of Object.keys(DICT)) assert.ok(DICT[lang][labelKey], `${lang}.${labelKey}`);
});

test("texte de la modale anglais conforme", () => {
  assert.equal(`${DICT.en.proModalTitle} ${DICT.en.proModalText}`, "🎉 You unlocked a FlixMatch Pro feature! This feature is free during the Beta and will cost ~$3.99/month at official launch.");
});

test("roomsCreatedToday compte seulement mes salons des dernières 24 h", () => {
  const now = Date.now();
  const rooms = [
    { host: { id: 1 }, createdAt: new Date(now - 1000).toISOString() },
    { host: { id: 1 }, createdAt: new Date(now - 25 * 3600 * 1000).toISOString() },
    { host: { id: 2 }, createdAt: new Date(now - 1000).toISOString() },
  ];
  assert.equal(roomsCreatedToday(rooms, 1, now), 1);
  assert.equal(roomsCreatedToday(null, 1, now), 0);
  assert.ok(FREE_NIGHT_ROOMS_PER_DAY >= 1);
});
