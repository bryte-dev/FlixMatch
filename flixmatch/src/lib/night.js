// Règles pures de Movie Night (partagées par le serveur et testées sans base de données).

// Sans 0/O/1/I/L pour éviter les confusions à l'oral
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const DECK_SIZE = 40;

export function generateRoomCode(random = Math.random) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

// Accepte un code collé avec espaces/tirets ou un lien complet
export function normalizeCode(input) {
  const raw = String(input || "").trim().split("/").filter(Boolean).pop() || "";
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

// Match = tous les membres ont aimé le titre (et il y a au moins MIN_PLAYERS membres)
export function isMatch(likeCount, memberCount) {
  return memberCount >= MIN_PLAYERS && likeCount >= memberCount;
}

export function shuffle(list, random = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Fusionne des pages TMDB en un paquet sans doublon, mélangé, limité à `size`
export function buildDeck(pages, mediaType, size = DECK_SIZE, random = Math.random) {
  const seen = new Set();
  const cards = [];
  for (const item of pages.flat()) {
    if (!item?.id || seen.has(item.id) || !item.poster_path) continue;
    seen.add(item.id);
    cards.push({
      tmdbId: item.id,
      mediaType,
      title: String(item.title || item.name || "").slice(0, 200),
      posterPath: item.poster_path,
      overview: item.overview ? String(item.overview).slice(0, 600) : null,
      year: String(item.release_date || item.first_air_date || "").slice(0, 4) || null,
      rating: typeof item.vote_average === "number" ? item.vote_average : null,
    });
  }
  return shuffle(cards, random).slice(0, size).map((c, position) => ({ ...c, position }));
}
