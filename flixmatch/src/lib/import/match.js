// Score de correspondance d'un résultat TMDB avec un titre importé (partagé navigateur / serveur)
import { normTitle } from "./model.js";

const ARTICLES = /^(the|a|an|le|la|les|l|un|une|des|der|die|das|el|los|las|il|lo)\s+/;
const stripArticle = (t) => t.replace(ARTICLES, "");

const tokens = (t) => new Set(t.split(" ").filter(Boolean));
const jaccard = (a, b) => {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
};

export const candidateYear = (c) => {
  const d = String(c?.release_date || c?.first_air_date || "");
  return /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null;
};

// 100 = titre identique ; 0 = aucun rapport
export function titleScore(candidateTitles, title) {
  const target = normTitle(title);
  if (!target) return 0;
  let best = 0;
  for (const raw of candidateTitles) {
    const t = normTitle(raw);
    if (!t) continue;
    if (t === target) return 100;
    if (stripArticle(t) === stripArticle(target)) best = Math.max(best, 90);
    const j = jaccard(t, target);
    if (j >= 0.75) best = Math.max(best, Math.round(80 * j));
    const [short, long] = t.length < target.length ? [t, target] : [target, t];
    if (short.length >= 4 && short.length / long.length >= 0.6 && long.includes(short)) best = Math.max(best, 50);
  }
  return best;
}

// Meilleur résultat TMDB pour { title, year } : { result, score } ou null si rien n'est assez fiable.
// L'année compte beaucoup (remakes, homonymes) ; la popularité ne sert qu'à départager.
export function pickBest(results, { title, year } = {}) {
  let best = null;
  (results || []).forEach((c, index) => {
    const ts = titleScore([c.title, c.name, c.original_title, c.original_name], title);
    if (ts === 0) return;
    let score = ts;
    const cy = candidateYear(c);
    if (year && cy) {
      const diff = Math.abs(cy - year);
      score += diff === 0 ? 30 : diff === 1 ? 15 : -40;
    } else if (year && !cy) score -= 5;
    score += Math.min(5, Math.log10((c.vote_count || 0) + 1)) - index * 0.1;
    if (!best || score > best.score) best = { result: c, score };
  });
  return best && best.score >= 60 ? best : null;
}
