// Règles des noms d'utilisateur, partagées entre le serveur et le formulaire (testées dans test/username.test.js)

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
const USERNAME_REGEX = /^[A-Za-z0-9_.-]+$/;
// Noms réservés : évitent l'usurpation de l'équipe / des pages du site
const RESERVED = new Set(["admin", "administrator", "flixmatch", "support", "moderator", "staff", "official", "root", "system"]);

// Clé d'unicité : insensible à la casse
export const usernameKey = (username) => String(username).trim().toLowerCase();

// Renvoie { ok: true, username } ou { ok: false, reason } (reason : clé de traduction)
export function validateUsername(value) {
  if (typeof value !== "string") return { ok: false, reason: "usernameInvalid" };
  const username = value.trim();
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) return { ok: false, reason: "usernameLength" };
  if (!USERNAME_REGEX.test(username)) return { ok: false, reason: "usernameChars" };
  // Au moins une lettre : /u/12345 reste réservé aux identifiants numériques
  if (!/[A-Za-z]/.test(username)) return { ok: false, reason: "usernameNeedsLetter" };
  if (RESERVED.has(usernameKey(username))) return { ok: false, reason: "usernameReserved" };
  return { ok: true, username };
}
