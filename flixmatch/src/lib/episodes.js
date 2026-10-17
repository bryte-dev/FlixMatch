// Logique pure du suivi des séries (aucune dépendance React) : testée dans test/episodes.test.js
// `watched` est un Set de clés "saison-épisode". La saison 0 (spéciaux) forme une piste à part.

export const epKey = (season, episode) => `${season}-${episode}`;

export const parseKey = (k) => {
  const [seasonNumber, episodeNumber] = k.split("-").map(Number);
  return { seasonNumber, episodeNumber };
};

export const todayISO = (date = new Date()) => date.toISOString().slice(0, 10);

// Un épisode sans date connue est considéré comme diffusé ; une date future = pas encore diffusé
export const isAired = (episode, today = todayISO()) => !episode?.air_date || episode.air_date <= today;

const sameTrack = (a, b) => (a === 0) === (b === 0);

const compare = (a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber;

// Épisodes diffusés et non vus situés avant (saison, épisode). `episodesBySeason` : { n: [{ episode_number, air_date }] }
export function missingBefore(episodesBySeason, watched, season, episode, today = todayISO()) {
  const missing = [];
  for (const [key, episodes] of Object.entries(episodesBySeason)) {
    const s = Number(key);
    if (!sameTrack(s, season) || s > season) continue;
    for (const ep of episodes) {
      if (s === season && ep.episode_number >= episode) continue;
      if (isAired(ep, today) && !watched.has(epKey(s, ep.episode_number))) {
        missing.push({ seasonNumber: s, episodeNumber: ep.episode_number });
      }
    }
  }
  return missing.sort(compare);
}

// Saisons régulières précédentes qui ne sont pas entièrement vues (au sens des épisodes diffusés)
export function incompleteSeasonsBefore(episodesBySeason, watched, season, today = todayISO()) {
  if (season === 0) return [];
  return Object.keys(episodesBySeason)
    .map(Number)
    .filter((s) => s > 0 && s < season)
    .filter((s) => episodesBySeason[s].some((ep) => isAired(ep, today) && !watched.has(epKey(s, ep.episode_number))))
    .sort((a, b) => a - b);
}

// Épisodes déjà vus situés après (saison, épisode) dans la même piste
export function watchedAfter(watched, season, episode) {
  return [...watched]
    .map(parseKey)
    .filter((w) => sameTrack(w.seasonNumber, season) && (w.seasonNumber > season || (w.seasonNumber === season && w.episodeNumber > episode)))
    .sort(compare);
}

// Première saison régulière non terminée (d'après les compteurs) : sert au bouton « prochain épisode »
export function firstIncompleteSeason(seasons, watched) {
  const counts = {};
  watched.forEach((k) => {
    const { seasonNumber } = parseKey(k);
    counts[seasonNumber] = (counts[seasonNumber] || 0) + 1;
  });
  const regular = seasons.filter((s) => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
  return regular.find((s) => (counts[s.season_number] || 0) < s.episode_count)?.season_number ?? null;
}

export function nextUnwatched(episodes, watched, season, today = todayISO()) {
  return episodes.find((ep) => isAired(ep, today) && !watched.has(epKey(season, ep.episode_number))) || null;
}

// Dernier épisode vu (hors spéciaux) -> « S2·E5 »
export function lastWatchedLabel(watched) {
  const regular = [...watched].map(parseKey).filter((w) => w.seasonNumber > 0).sort(compare);
  const last = regular[regular.length - 1];
  return last ? `S${last.seasonNumber}·E${last.episodeNumber}` : null;
}

// Statut : à voir / en cours / terminé / abandonné (abandon choisi par l'utilisateur)
export function seriesStatus({ watchedRegular, totalRegular, abandoned = false }) {
  if (totalRegular > 0 && watchedRegular >= totalRegular) return "completed";
  if (abandoned) return "abandoned";
  return watchedRegular > 0 ? "in_progress" : "to_watch";
}

export const STATUS_LABELS = { to_watch: "À voir", in_progress: "En cours", completed: "Terminé", abandoned: "Abandonné" };
