// Fusion de résultats TMDB obtenus dans plusieurs langues : dédoublonnage par type + id.
// L'ordre de la première liste est conservé ; les champs manquants sont complétés par les listes suivantes.

const FIELDS = ["title", "name", "overview", "poster_path", "profile_path", "backdrop_path", "release_date", "first_air_date"];
const VALID_TYPES = new Set(["movie", "tv", "person"]);

export const resultKey = (item) => `${item.media_type}-${item.id}`;

export function mergeSearchResults(lists) {
  const merged = new Map();
  for (const list of lists) {
    for (const item of list || []) {
      if (!item || !VALID_TYPES.has(item.media_type) || item.id == null) continue;
      const key = resultKey(item);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...item });
        continue;
      }
      for (const field of FIELDS) {
        if (!existing[field] && item[field]) existing[field] = item[field];
      }
    }
  }
  return [...merged.values()];
}
