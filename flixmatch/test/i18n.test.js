import test from "node:test";
import assert from "node:assert/strict";
import { DICT, LANGUAGES, RTL, translate } from "../src/lib/i18nData.js";

test("toutes les langues ont les mêmes clés que le français", () => {
  assert.deepEqual(Object.keys(DICT).sort(), Object.keys(LANGUAGES).sort());
  for (const [lang, d] of Object.entries(DICT)) assert.deepEqual(Object.keys(d).sort(), Object.keys(DICT.fr).sort(), lang);
});
test("repli sur le français et RTL arabe", () => {
  assert.equal(translate("xx", "home"), "Accueil");
  assert.equal(translate("en", "nope"), "nope");
  assert.ok(RTL.has("ar"));
});
