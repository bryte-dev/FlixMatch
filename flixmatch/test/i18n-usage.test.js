import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DICT } from "../src/lib/i18nData.js";

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(p) ? [p] : [];
  });

test("every statically used translation key exists in French", () => {
  const missing = [];
  for (const file of walk("src")) {
    if (file.endsWith("i18nData.js")) continue;
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/\bt\(\s*(?:[^"'`()]*\?\s*)?"([A-Za-z][A-Za-z0-9]*)"/g)) {
      if (!(m[1] in DICT.fr)) missing.push(`${file}: ${m[1]}`);
    }
    for (const m of src.matchAll(/\bt\([^"'`()]*\?\s*"[A-Za-z0-9]+"\s*:\s*"([A-Za-z][A-Za-z0-9]*)"/g)) {
      if (!(m[1] in DICT.fr)) missing.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});
