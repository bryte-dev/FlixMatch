// Import en deux temps, via l'API du serveur :
// 1. resolveAll : correspondance TMDB par lots (aucune écriture) → aperçu trouvés / introuvables
// 2. commitAll  : écriture par lots des éléments confirmés (idempotent : relançable sans doublons)
import axios from "axios";

export const RESOLVE_BATCH = 40;
export const COMMIT_BATCH = 50;
const MAX_COMMIT_COST = 400;
const MAX_COMMIT_BYTES = 1_500_000;

const wait = (ms, signal) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// POST avec nouvelle tentative sur 429 / erreur réseau / 5xx (TMDB lent, serveur qui se réveille)
async function postWithRetry(url, body, signal, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      return (await axios.post(url, body, { signal, timeout: 120000 })).data;
    } catch (error) {
      const status = error.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (signal?.aborted || !retryable || attempt >= tries) throw error;
      await wait(status === 429 ? 15000 : 2000 * attempt, signal);
    }
  }
}

const resolvePayload = (it) => ({ key: it.key, kind: it.kind, title: it.title || null, year: it.year || null, ids: it.ids });

// Renvoie une copie des items avec { match, error } ; onProgress({ done, total })
export async function resolveAll(items, { onProgress, signal } = {}) {
  const out = [];
  let done = 0;
  for (const batch of chunk(items, RESOLVE_BATCH)) {
    if (signal?.aborted) break;
    let results = [];
    try {
      results = (await postWithRetry("/import/resolve", { items: batch.map(resolvePayload) }, signal)).results || [];
    } catch {
      if (signal?.aborted) break;
      results = batch.map((it) => ({ key: it.key, match: null, error: "network" }));
    }
    const byKey = new Map(results.map((r) => [r.key, r]));
    for (const it of batch) {
      const r = byKey.get(it.key);
      out.push({ ...it, match: r?.match || null, error: r?.error || null });
    }
    done += batch.length;
    onProgress?.({ done, total: items.length });
  }
  return out;
}

// Une correspondance par titre seul et peu sûre est signalée « à vérifier » dans l'aperçu
export const needsReview = (it) => it.match?.via === "title" && (it.match.score ?? 0) < 120;

const STATUS_RANK = { WATCHLIST: 1, SEEN: 2 };

// Éléments confirmés → payloads de commit (plusieurs imports vers le même titre TMDB sont fusionnés)
export function buildCommitItems(items) {
  const merged = new Map();
  for (const it of items) {
    if (!it.match) continue;
    const k = `${it.match.mediaType}:${it.match.tmdbId}`;
    const episodes = it.match.mediaType === "tv" ? it.episodes || [] : [];
    const prev = merged.get(k);
    if (!prev) {
      merged.set(k, {
        key: it.key,
        tmdbId: it.match.tmdbId,
        mediaType: it.match.mediaType,
        title: it.match.title || it.title,
        poster: it.match.poster || "",
        status: it.status === "WATCHLIST" ? "WATCHLIST" : "SEEN",
        favorite: Boolean(it.favorite),
        rating: it.rating || null,
        review: it.review || null,
        watchedAt: it.watchedAt || null,
        episodes: [...episodes],
        sources: [it.key],
      });
      continue;
    }
    if ((STATUS_RANK[it.status] || 0) > (STATUS_RANK[prev.status] || 0)) prev.status = it.status;
    prev.favorite = prev.favorite || Boolean(it.favorite);
    prev.rating = prev.rating || it.rating || null;
    prev.review = prev.review || it.review || null;
    if (it.watchedAt && (!prev.watchedAt || it.watchedAt > prev.watchedAt)) prev.watchedAt = it.watchedAt;
    const seen = new Set(prev.episodes.map((e) => `${e.seasonNumber}-${e.episodeNumber}`));
    for (const e of episodes) if (!seen.has(`${e.seasonNumber}-${e.episodeNumber}`)) prev.episodes.push(e);
    prev.sources.push(it.key);
  }
  return [...merged.values()];
}

// Lots limités en nombre, en « coût » (saisons à vérifier chez TMDB) et en taille
export function commitBatches(payloads) {
  const batches = [];
  let current = [];
  let cost = 0;
  let bytes = 0;
  for (const p of payloads) {
    const pCost = 1 + Math.ceil((p.episodes?.length || 0) / 20);
    const pBytes = JSON.stringify(p).length;
    if (current.length > 0 && (current.length >= COMMIT_BATCH || cost + pCost > MAX_COMMIT_COST || bytes + pBytes > MAX_COMMIT_BYTES)) {
      batches.push(current);
      current = [];
      cost = 0;
      bytes = 0;
    }
    current.push(p);
    cost += pCost;
    bytes += pBytes;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

// Renvoie un rapport { created, updated, unchanged, episodesAdded, episodesSkipped, reviews, failed: [titres] }
export async function commitAll(items, { onProgress, signal } = {}) {
  const payloads = buildCommitItems(items);
  const report = { created: 0, updated: 0, unchanged: 0, episodesAdded: 0, episodesSkipped: 0, reviews: 0, failed: [], aborted: false };
  let done = 0;
  for (const batch of commitBatches(payloads)) {
    if (signal?.aborted) {
      report.aborted = true;
      break;
    }
    const body = { items: batch.map((p) => ({ ...p, sources: undefined })) };
    let results;
    try {
      results = (await postWithRetry("/import/commit", body, signal)).results || [];
    } catch {
      if (signal?.aborted) {
        report.aborted = true;
        break;
      }
      results = batch.map((p) => ({ key: p.key, ok: false }));
    }
    const byKey = new Map(results.map((r) => [r.key, r]));
    for (const p of batch) {
      const r = byKey.get(p.key);
      if (!r?.ok) {
        report.failed.push(p.title);
        continue;
      }
      report[r.libraryAction] = (report[r.libraryAction] || 0) + 1;
      report.episodesAdded += r.episodesAdded || 0;
      report.episodesSkipped += r.episodesSkipped || 0;
      if (r.reviewAdded) report.reviews++;
    }
    done += batch.length;
    onProgress?.({ done, total: payloads.length, current: batch[batch.length - 1]?.title });
  }
  return report;
}
