// Service IMDb via OMDb (https://www.omdbapi.com). Isolé ici pour pouvoir être remplacé plus tard
// (ex. un fournisseur sous licence commerciale). Renvoie toujours null si indisponible : l'app ne casse jamais.
import axios from "axios";

const TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 2000;
const cache = new Map();

export const isOmdbConfigured = () => Boolean(process.env.OMDB_API_KEY);

export const parseOmdb = (data) => {
  if (!data || data.Response === "False") return null;
  const rating = Number(data.imdbRating);
  if (!Number.isFinite(rating) || rating <= 0) return null;
  const votes = Number(String(data.imdbVotes || "").replace(/,/g, ""));
  return { rating, votes: Number.isFinite(votes) ? votes : null };
};

// imdbId : "tt0111161" -> { rating: 9.3, votes: 2900000 } ou null
export async function getImdbRating(imdbId) {
  if (!isOmdbConfigured() || !/^tt\d{5,10}$/.test(imdbId || "")) return null;
  const hit = cache.get(imdbId);
  if (hit && Date.now() < hit.expires) return hit.value;

  let value = null;
  let ttl = TTL_MS;
  try {
    const res = await axios.get("https://www.omdbapi.com/", {
      params: { i: imdbId, apikey: process.env.OMDB_API_KEY },
      timeout: 4000,
    });
    value = parseOmdb(res.data);
  } catch {
    ttl = MISS_TTL_MS; // indisponible / quota : on réessaiera plus tard
  }
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(imdbId, { value, expires: Date.now() + ttl });
  return value;
}
