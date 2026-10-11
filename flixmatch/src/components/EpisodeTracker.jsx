import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import { API_URL } from "../api";
import { useToast } from "../toastContext";
import useBusy from "../hooks/useBusy";
import { Button, ErrorState, Spinner } from "./ui";
import { errorMessage, formatDate, posterUrl } from "../utils";

const key = (season, episode) => `${season}-${episode}`;

function ProgressBar({ done, total, label }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-white/10"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.min(done, total)}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

const seasonLabel = (season) =>
  season.season_number === 0 ? "Épisodes spéciaux" : season.name || `Saison ${season.season_number}`;

export default function EpisodeTracker({ seriesId, user }) {
  const toast = useToast();
  const { isBusy, run } = useBusy();

  const [seasons, setSeasons] = useState(null);
  const [seasonsError, setSeasonsError] = useState(false);
  const [watched, setWatched] = useState(new Set());
  const [episodesBySeason, setEpisodesBySeason] = useState({});
  const [episodesError, setEpisodesError] = useState({});
  const [open, setOpen] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);

  const loadSeasons = useCallback(async () => {
    setSeasonsError(false);
    setSeasons(null);
    try {
      const res = await axios.get(`${API_URL}/tmdb/tv/${seriesId}/seasons`);
      const list = (res.data.seasons || [])
        .filter((s) => s.episode_count > 0)
        .sort((a, b) => (a.season_number || 99999) - (b.season_number || 99999));
      setSeasons(list);
      setOpen(list.find((s) => s.season_number > 0)?.season_number ?? list[0]?.season_number ?? null);
    } catch (err) {
      console.error("Erreur saisons :", err);
      setSeasonsError(true);
    }
  }, [seriesId]);

  useEffect(() => {
    loadSeasons();
  }, [loadSeasons]);

  useEffect(() => {
    if (!user) {
      setWatched(new Set());
      return;
    }
    axios
      .get(`${API_URL}/episodes/${seriesId}`)
      .then((res) => setWatched(new Set(res.data.watched.map((w) => key(w.seasonNumber, w.episodeNumber)))))
      .catch(() => toast("Impossible de charger ta progression", "error"));
  }, [seriesId, user, toast]);

  const loadEpisodes = useCallback(
    async (seasonNumber) => {
      setEpisodesError((prev) => ({ ...prev, [seasonNumber]: false }));
      try {
        const res = await axios.get(`${API_URL}/tmdb/tv/${seriesId}/season/${seasonNumber}`);
        setEpisodesBySeason((prev) => ({ ...prev, [seasonNumber]: res.data.episodes }));
      } catch (err) {
        console.error("Erreur épisodes :", err);
        setEpisodesError((prev) => ({ ...prev, [seasonNumber]: true }));
      }
    },
    [seriesId]
  );

  useEffect(() => {
    if (open !== null && !episodesBySeason[open] && episodesError[open] === undefined) loadEpisodes(open);
  }, [open, episodesBySeason, episodesError, loadEpisodes]);

  const totalEpisodes = useMemo(() => (seasons || []).reduce((sum, s) => sum + s.episode_count, 0), [seasons]);
  const watchedPerSeason = useMemo(() => {
    const counts = {};
    watched.forEach((k) => {
      const season = k.split("-")[0];
      counts[season] = (counts[season] || 0) + 1;
    });
    return counts;
  }, [watched]);
  const watchedInSeason = (n) => watchedPerSeason[n] || 0;
  const watchedTotal = (seasons || []).reduce((sum, s) => sum + Math.min(watchedInSeason(s.season_number), s.episode_count), 0);

  const toggleEpisode = (seasonNumber, episodeNumber) =>
    run(key(seasonNumber, episodeNumber), async () => {
      const next = !watched.has(key(seasonNumber, episodeNumber));
      try {
        await axios.put(`${API_URL}/episodes/${seriesId}/${seasonNumber}/${episodeNumber}`, { watched: next });
        setWatched((prev) => {
          const copy = new Set(prev);
          if (next) copy.add(key(seasonNumber, episodeNumber));
          else copy.delete(key(seasonNumber, episodeNumber));
          return copy;
        });
      } catch (err) {
        toast(errorMessage(err, "Impossible de mettre à jour l'épisode"), "error");
      }
    });

  const setSeasonWatched = (seasonNumber, value) =>
    run(`season-${seasonNumber}`, async () => {
      try {
        const res = await axios.put(`${API_URL}/episodes/${seriesId}/season/${seasonNumber}`, { watched: value });
        setWatched((prev) => {
          const copy = new Set([...prev].filter((k) => !k.startsWith(`${seasonNumber}-`)));
          res.data.watched.forEach((w) => copy.add(key(w.seasonNumber, w.episodeNumber)));
          return copy;
        });
        setConfirmReset(null);
        toast(value ? "Saison marquée comme vue" : "Saison remise à zéro", "success");
      } catch (err) {
        toast(errorMessage(err, "Impossible de mettre à jour la saison"), "error");
      }
    });

  if (seasonsError) return <ErrorState message="Impossible de charger les saisons depuis TMDB." onRetry={loadSeasons} />;
  if (!seasons) {
    return (
      <div className="surface space-y-3 p-5" role="status" aria-label="Chargement des saisons">
        <div className="skeleton h-5 w-1/3" />
        <div className="skeleton h-2 w-full" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    );
  }
  if (seasons.length === 0) {
    return <div className="surface p-6 text-center text-zinc-400">Aucune saison ni aucun épisode n&apos;est disponible pour cette série.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold">Progression de la série</p>
          <p className="text-sm text-zinc-300" aria-live="polite">
            {user ? `${Math.min(watchedTotal, totalEpisodes)} / ${totalEpisodes} épisodes vus` : `${totalEpisodes} épisodes`}
          </p>
        </div>
        {user ? (
          <ProgressBar done={watchedTotal} total={totalEpisodes} label="Progression de la série" />
        ) : (
          <p className="text-sm text-zinc-400">
            <Link to="/login" className="font-semibold text-brand-300 hover:underline">Connecte-toi</Link> pour suivre les épisodes que tu as vus.
          </p>
        )}
      </div>

      {seasons.map((season) => {
        const n = season.season_number;
        const isOpen = open === n;
        const done = Math.min(watchedInSeason(n), season.episode_count);
        const complete = done >= season.episode_count;
        const episodes = episodesBySeason[n];
        return (
          <section key={n} className="surface overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/5"
              aria-expanded={isOpen}
              aria-controls={`season-${n}`}
              onClick={() => setOpen(isOpen ? null : n)}
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{seasonLabel(season)}</h3>
                <p className="text-xs text-zinc-400">
                  {user ? `${done} / ${season.episode_count} épisodes vus` : `${season.episode_count} épisodes`}
                  {season.air_date ? ` · ${season.air_date.slice(0, 4)}` : ""}
                </p>
                {user && <div className="mt-2 max-w-xs"><ProgressBar done={done} total={season.episode_count} label={`Progression ${seasonLabel(season)}`} /></div>}
              </div>
              {complete && user && <span className="chip !border-emerald-500/30 !text-emerald-300"><FiCheck aria-hidden="true" className="mr-1" />Vue</span>}
              <FiChevronDown aria-hidden="true" className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div id={`season-${n}`} className="border-t border-white/10 p-4">
                {user && (
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {!complete && (
                      <Button size="sm" variant="primary" pending={isBusy(`season-${n}`)} pendingLabel="Mise à jour…" onClick={() => setSeasonWatched(n, true)}>
                        Marquer la saison comme vue
                      </Button>
                    )}
                    {done > 0 &&
                      (confirmReset === n ? (
                        <>
                          <span className="text-sm text-zinc-300">Retirer tous les épisodes vus de cette saison ?</span>
                          <Button size="sm" variant="danger" pending={isBusy(`season-${n}`)} pendingLabel="…" onClick={() => setSeasonWatched(n, false)}>Oui, réinitialiser</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmReset(null)}>Annuler</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmReset(n)}>Tout marquer non vu</Button>
                      ))}
                  </div>
                )}

                {episodesError[n] ? (
                  <ErrorState message="Impossible de charger les épisodes." onRetry={() => loadEpisodes(n)} />
                ) : !episodes ? (
                  <div className="flex justify-center py-6 text-brand-400" role="status" aria-label="Chargement des épisodes"><Spinner className="h-6 w-6" /></div>
                ) : episodes.length === 0 ? (
                  <p className="text-center text-sm text-zinc-400">Aucun épisode disponible.</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {episodes.map((ep) => {
                      const isWatched = watched.has(key(n, ep.episode_number));
                      const still = posterUrl(ep.still_path, "w300");
                      return (
                        <li key={ep.id ?? ep.episode_number} className="flex items-center gap-3 py-3">
                          {still ? (
                            <img src={still} alt="" loading="lazy" className="hidden aspect-video w-32 shrink-0 rounded-lg bg-ink-700 object-cover sm:block" />
                          ) : (
                            <div className="hidden aspect-video w-32 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-2xl sm:flex" aria-hidden="true">🎞️</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`truncate font-medium ${isWatched ? "text-zinc-400" : ""}`}>
                              <span className="mr-2 text-brand-300">E{ep.episode_number}</span>
                              {ep.name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {[formatDate(ep.air_date), ep.runtime ? `${ep.runtime} min` : ""].filter(Boolean).join(" · ") || "Date inconnue"}
                            </p>
                            {ep.overview && <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{ep.overview}</p>}
                          </div>
                          {user && (
                            <Button
                              size="sm"
                              variant={isWatched ? "primary" : "secondary"}
                              pending={isBusy(key(n, ep.episode_number))}
                              onClick={() => toggleEpisode(n, ep.episode_number)}
                              aria-pressed={isWatched}
                              aria-label={`${isWatched ? "Marquer non vu" : "Marquer comme vu"} : épisode ${ep.episode_number}, ${ep.name}`}
                            >
                              <FiCheck aria-hidden="true" />
                              <span className="hidden sm:inline">{isWatched ? "Vu" : "Marquer vu"}</span>
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
