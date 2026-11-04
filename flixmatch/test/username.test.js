import test from "node:test";
import assert from "node:assert/strict";
import { validateUsername, usernameKey } from "../src/lib/username.js";

test("noms valides, rognés et insensibles à la casse", () => {
  assert.deepEqual(validateUsername("  Bryte_dev "), { ok: true, username: "Bryte_dev" });
  assert.equal(usernameKey(" BrYtE "), "bryte");
  assert.ok(validateUsername("a.b-c_1").ok);
});

test("longueur 3 à 30", () => {
  assert.equal(validateUsername("ab").reason, "usernameLength");
  assert.equal(validateUsername("a".repeat(31)).reason, "usernameLength");
  assert.ok(validateUsername("a".repeat(30)).ok);
});

test("caractères, lettre obligatoire et noms réservés", () => {
  assert.equal(validateUsername("jean dupont").reason, "usernameChars");
  assert.equal(validateUsername("<script>").reason, "usernameChars");
  assert.equal(validateUsername("12345").reason, "usernameNeedsLetter");
  assert.equal(validateUsername("Admin").reason, "usernameReserved");
  assert.equal(validateUsername(null).reason, "usernameInvalid");
  assert.equal(validateUsername(42).reason, "usernameInvalid");
});
