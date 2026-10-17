// Matching TMDB + import par lots (côté navigateur, via l'API du serveur)
import axios from "axios";

const norm = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export const pickBest = (results, name, year) => {
  const target = norm(name);
  const scored = results.map((r, i) => {
    const titles = [r.title, r.name, r.original_title, r.original_name].map(norm);
    const date = (r.release_date || r.first_air_date || "").slice(0, 4);
    let score = titles.includes(target) ? 10 : titles.some((t) => t.includes(target) || target.includes(t)) ? 3 : 0;
    if (year && date && Number(date) === year) score += 4;
    return { r, score: score - i * 0.01 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score >= 3 ? scored[0].r : null;
};

export async function matchSeries(s, lang) {
  if (s.tmdbId) return s.tmdbId;
  if (s.tvdbId) {
    try {
      const res = await axios.get(`/tmdb/find/tvdb/${s.tvdbId}`);
      if (res.data.tv[0]) return res.data.tv[0].id;
    } catch {
      // on retombe sur le titre
    }
  }
  const res = await axios.get("/tmdb/search", { params: { query: s.name.slice(0, 200), type: "tv", lang } });
  return pickBest(res.data.results, s.name)?.id ?? null;
}

export async function matchMovie(m, lang) {
  if (m.tmdbId) return { id: m.tmdbId, title: m.name };
  if (m.imdbId) {
    try {
      const res = await axios.get(`/tmdb/find/imdb/${m.imdbId}`);
      if (res.data.movies[0]) return { id: res.data.movies[0].id, title: res.data.movies[0].title, poster: res.data.movies[0].poster_path };
    } catch {
      // titre
    }
  }
  const res = await axios.get("/tmdb/search", { params: { query: m.name.slice(0, 200), type: "movie", lang } });
  const best = pickBest(res.data.results, m.name, m.year);
  return best ? { id: best.id, title: best.title, poster: best.poster_path } : null;
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// onProgress({ done, total, current }) ; renvoie { imported, notFound: [], failed: [] }
export async function runImport(parsed, { lang, onProgress, signal }) {
  const total = parsed.series.length + parsed.movies.length;
  let done = 0;
  const report = { imported: { series: 0, episodes: 0, movies: 0 }, notFound: [], failed: [] };
  const tick = (current) => onProgress?.({ done: ++done, total, current });

  for (const s of parsed.series) {
    if (signal?.aborted) break;
    try {
      const id = await matchSeries(s, lang);
      if (!id) {
        report.notFound.push(`Série : ${s.name}`);
      } else {
        const details = await axios.get(`/tmdb/details/${id}/tv`);
        await axios.post("/watchlist", { tmdb_id: id, title: details.data.name || s.name, media_type: "tv", poster_path: details.data.poster_path || "" }).catch((e) => {
          if (!e.response?.data?.movieId) throw e;
        });
        for (const batch of chunk(s.episodes, 300)) {
          await axios.put(`/episodes/${id}/bulk`, { watched: true, episodes: batch.map(({ seasonNumber, episodeNumber }) => ({ seasonNumber, episodeNumber })) });
        }
        report.imported.series++;
        report.imported.episodes += s.episodes.length;
      }
    } catch {
      report.failed.push(`Série : ${s.name}`);
    }
    tick(s.name);
  }

  for (const m of parsed.movies) {
    if (signal?.aborted) break;
    try {
      const hit = await matchMovie(m, lang);
      if (!hit) report.notFound.push(`Film : ${m.name}`);
      else {
        let movieId;
        try {
          movieId = (await axios.post("/watchlist", { tmdb_id: hit.id, title: hit.title || m.name, media_type: "movie", poster_path: hit.poster || "" })).data.movieId;
        } catch (e) {
          movieId = e.response?.data?.movieId;
          if (!movieId) throw e;
        }
        await axios.put(`/watchlist/${movieId}/seen`);
        if (m.favorite) await axios.put(`/watchlist/${movieId}/favorite`, { isFavorite: true });
        report.imported.movies++;
      }
    } catch {
      report.failed.push(`Film : ${m.name}`);
    }
    tick(m.name);
  }
  return report;
}
