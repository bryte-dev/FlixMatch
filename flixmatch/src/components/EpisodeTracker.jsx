import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import { API_URL } from "../api";
import { useT, tr } from "../i18n";
import { useToast } from "../toastContext";
import useBusy from "../hooks/useBusy";
import { BottomSheet, Button, ErrorState, Spinner } from "./ui";
import {
  STATUS_LABELS, epKey, firstIncompleteSeason, incompleteSeasonsBefore, isAired, lastWatchedLabel,
  missingBefore, nextUnwatched, seriesStatus, watchedAfter,
} from "../lib/episodes";
import { errorMessage, formatDate, posterUrl } from "../utils";

const key = epKey;

const ABANDONED_KEY = "fm-abandoned";
const readAbandoned = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(ABANDONED_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

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
  season.season_number === 0 ? tr("epSpecials") : season.name || tr("epSeasonN", { n: season.season_number });

export default function EpisodeTracker({ seriesId, user, title = "", posterPath = "" }) {
  const toast = useToast();
  const t = useT();
  const { isBusy, run } = useBusy();

  const [seasons, setSeasons] = useState(null);
  const [seasonsError, setSeasonsError] = useState(false);
  const [watched, setWatched] = useState(new Set());
  const [episodesBySeason, setEpisodesBySeason] = useState({});
  const [episodesError, setEpisodesError] = useState({});
  const [open, setOpen] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [abandonedSet, setAbandonedSet] = useState(readAbandoned);

  // L'abandon est stocké côté serveur (visible sur tous les appareils) ; le stockage local ne sert que d'ancien repli
  useEffect(() => {
    if (!user) return;
    axios
      .get(`${API_URL}/library/abandoned`)
      .then((res) => setAbandonedSet((prev) => new Set([...prev, ...res.data.map(Number)])))
      .catch(() => {});
  }, [user]);
  const abandoned = abandonedSet.has(Number(seriesId));

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
  const regularSeasons = (seasons || []).filter((s) => s.season_number > 0);
  const totalRegular = regularSeasons.reduce((sum, s) => sum + s.episode_count, 0);
  const watchedRegular = regularSeasons.reduce((sum, s) => sum + Math.min(watchedInSeason(s.season_number), s.episode_count), 0);
  const status = seriesStatus({ watchedRegular, totalRegular, abandoned });
  const lastLabel = lastWatchedLabel(watched);

  // Charge (si besoin) les épisodes des saisons demandées et renvoie la table complète
  const ensureEpisodes = async (seasonNumbers) => {
    const merged = { ...episodesBySeason };
    await Promise.all(
      seasonNumbers
        .filter((n) => !merged[n])
        .map(async (n) => {
          const res = await axios.get(`${API_URL}/tmdb/tv/${seriesId}/season/${n}`);
          merged[n] = res.data.episodes;
        })
    );
    setEpisodesBySeason(merged);
    return merged;
  };

  const applyBulk = async (items, value) => {
    const res = await axios.put(`${API_URL}/episodes/${seriesId}/bulk`, { watched: value, episodes: items });
    setWatched(new Set(res.data.watched.map((w) => key(w.seasonNumber, w.episodeNumber))));
  };

  const seasonNumbers = (seasons || []).map((s) => s.season_number);
  const airedItems = (map, n) => (map[n] || []).filter((ep) => isAired(ep)).map((ep) => ({ seasonNumber: n, episodeNumber: ep.episode_number }));

  const failure = (err, fallback) => toast(errorMessage(err, fallback), "error");

  const toggleEpisode = (seasonNumber, episodeNumber) =>
    run(key(seasonNumber, episodeNumber), async () => {
      const next = !watched.has(key(seasonNumber, episodeNumber));
      const single = [{ seasonNumber, episodeNumber }];
      try {
        if (next) {
          const map = await ensureEpisodes(seasonNumbers.filter((n) => (n === 0) === (seasonNumber === 0) && n <= seasonNumber));
          const missing = missingBefore(map, watched, seasonNumber, episodeNumber);
          if (missing.length > 0) {
            setSheet({
              title: t("epPrevTitle"),
              text: t("epPrevText", { n: missing.length, s: seasonNumber, e: episodeNumber }),
              options: [
                { label: t("epAllN", { n: missing.length + 1 }), variant: "primary", action: () => applyBulk([...missing, ...single], true) },
                { label: t("epOnlyThis"), action: () => applyBulk(single, true) },
              ],
            });
            return;
          }
          await applyBulk(single, true);
          return;
        }
        const following = watchedAfter(watched, seasonNumber, episodeNumber);
        if (following.length > 0) {
          setSheet({
            title: t("epFollowTitle"),
            text: t("epFollowText", { n: following.length }),
            options: [
              { label: t("epUncheckFollowing", { n: following.length }), variant: "danger", action: () => applyBulk([...single, ...following], false) },
              { label: t("epOnlyThis"), action: () => applyBulk(single, false) },
            ],
          });
          return;
        }
        await applyBulk(single, false);
      } catch (err) {
        failure(err, t("epUpdateFail"));
      }
    });

  const setSeasonWatched = (seasonNumber, value) =>
    run(`season-${seasonNumber}`, async () => {
      try {
        if (value) {
          const map = await ensureEpisodes(seasonNumbers.filter((n) => n <= seasonNumber && (n > 0 || seasonNumber === 0)));
          const previous = incompleteSeasonsBefore(map, watched, seasonNumber);
          const own = airedItems(map, seasonNumber);
          if (previous.length > 0) {
            const prevItems = previous.flatMap((n) => airedItems(map, n).filter((i) => !watched.has(key(i.seasonNumber, i.episodeNumber))));
            const range = previous.length === 1 ? `${previous[0]}` : `${previous[0]}–${previous[previous.length - 1]}`;
            setSheet({
              title: t("epPrevSeasonsTitle"),
              text: t("epPrevSeasonsText", { range }),
              options: [
                { label: t("epYesAll"), variant: "primary", action: () => applyBulk([...prevItems, ...own], true) },
                { label: t("epOnlySeason"), action: () => applyBulk(own, true) },
              ],
            });
            return;
          }
          await applyBulk(own, true);
          toast(t("epSeasonDone"), "success");
        } else {
          await axios.put(`${API_URL}/episodes/${seriesId}/season/${seasonNumber}`, { watched: false });
          setWatched((prev) => new Set([...prev].filter((k) => !k.startsWith(`${seasonNumber}-`))));
          setConfirmReset(null);
          toast(t("epSeasonReset"), "success");
        }
      } catch (err) {
        failure(err, t("epSeasonFail"));
      }
    });

  const markSeries = () =>
    run("series", async () => {
      try {
        const regular = seasonNumbers.filter((n) => n > 0);
        const map = await ensureEpisodes(regular);
        const items = regular.flatMap((n) => airedItems(map, n)).filter((i) => !watched.has(key(i.seasonNumber, i.episodeNumber)));
        if (items.length === 0) return;
        setSheet({
          title: t("epSeriesTitle"),
          text: t("epSeriesText", { n: items.length }),
          options: [{ label: t("epYesSeries"), variant: "primary", action: () => applyBulk(items, true) }],
        });
      } catch (err) {
        failure(err, t("epSeriesLoadFail"));
      }
    });

  const goNext = () =>
    run("next", async () => {
      const n = firstIncompleteSeason(seasons, watched);
      if (n === null) return toast(t("epAllSeen"), "success");
      try {
        const map = await ensureEpisodes([n]);
        const ep = nextUnwatched(map[n], watched, n);
        setOpen(n);
        if (!ep) return toast(t("epNoneAired"), "info");
        toast(t("epNext", { s: n, e: ep.episode_number, name: ep.name }), "info");
        setTimeout(() => document.getElementById(`ep-${n}-${ep.episode_number}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 100);
      } catch (err) {
        failure(err, t("epNextFail"));
      }
    });

  const toggleAbandoned = () =>
    run("abandon", async () => {
      const id = Number(seriesId);
      const next = new Set(abandonedSet);
      const value = !next.has(id);
      if (value) next.add(id);
      else next.delete(id);
      try {
        await axios.put(`${API_URL}/library/abandoned`, {
          abandoned: value,
          tmdb_id: id,
          media_type: "tv",
          title: title || `TMDB ${id}`,
          poster_path: posterPath || "",
        });
        setAbandonedSet(next);
        try {
          localStorage.setItem(ABANDONED_KEY, JSON.stringify([...next]));
        } catch {
          // stockage indisponible
        }
      } catch (err) {
        failure(err, t("epStateFail"));
      }
    });

  const runSheetAction = async (action) => {
    setSheet(null);
    try {
      await action();
      toast(t("epProgressUpdated"), "success");
    } catch (err) {
      failure(err, t("epProgressFail"));
    }
  };

  if (seasonsError) return <ErrorState message="Impossible de charger les saisons depuis TMDB." onRetry={loadSeasons} />;
  if (!seasons) {
    return (
      <div className="surface space-y-3 p-5" role="status" aria-label={t("epLoadingSeasons")}>
        <div className="skeleton h-5 w-1/3" />
        <div className="skeleton h-2 w-full" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    );
  }
  if (seasons.length === 0) {
    return <div className="surface p-6 text-center text-zinc-400">{t("epNoSeasons")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            Progression de la série
            {user && <span className="chip" data-status={status}>{STATUS_LABELS[status]}</span>}
            {user && lastLabel && <span className="chip">{lastLabel}</span>}
          </p>
          <p className="text-sm text-zinc-300" aria-live="polite">
            {user ? t("epSeenCount", { done: Math.min(watchedTotal, totalEpisodes), total: totalEpisodes }) : t("epTotal", { n: totalEpisodes })}
          </p>
        </div>
        {user ? (
          <>
            <ProgressBar done={watchedTotal} total={totalEpisodes} label={t("epSeriesProgress")} />
            <div className="mt-3 flex flex-wrap gap-2">
              {status !== "completed" && <Button size="sm" variant="primary" pending={isBusy("next")} onClick={goNext}>{t("epNextBtn")}</Button>}
              {status !== "completed" && <Button size="sm" pending={isBusy("series")} onClick={markSeries}>{t("epMarkSeries")}</Button>}
              {status !== "completed" && <Button size="sm" variant="ghost" aria-pressed={abandoned} onClick={toggleAbandoned}>{abandoned ? t("epResume") : t("epAbandon")}</Button>}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-400">
            <Link to="/login" className="font-semibold text-brand-300 hover:underline">{t("rvLogin")}</Link>{t("epLoginPost")}
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
                  {user ? t("epSeenCount", { done, total: season.episode_count }) : t("epTotal", { n: season.episode_count })}
                  {season.air_date ? ` · ${season.air_date.slice(0, 4)}` : ""}
                </p>
                {user && <div className="mt-2 max-w-xs"><ProgressBar done={done} total={season.episode_count} label={seasonLabel(season)} /></div>}
              </div>
              {complete && user && <span className="chip !border-emerald-500/30 !text-emerald-300"><FiCheck aria-hidden="true" className="mr-1" />Vue</span>}
              <FiChevronDown aria-hidden="true" className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div id={`season-${n}`} className="border-t border-white/10 p-4">
                {user && (
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {!complete && (
                      <Button size="sm" variant="primary" pending={isBusy(`season-${n}`)} pendingLabel={t("epUpdating")} onClick={() => setSeasonWatched(n, true)}>
                        Marquer la saison comme vue
                      </Button>
                    )}
                    {done > 0 &&
                      (confirmReset === n ? (
                        <>
                          <span className="text-sm text-zinc-300">{t("epResetSeasonQ")}</span>
                          <Button size="sm" variant="danger" pending={isBusy(`season-${n}`)} pendingLabel="…" onClick={() => setSeasonWatched(n, false)}>{t("epYesReset")}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmReset(null)}>{t("cancel")}</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmReset(n)}>Tout marquer non vu</Button>
                      ))}
                  </div>
                )}

                {episodesError[n] ? (
                  <ErrorState message={t("epLoadFail")} onRetry={() => loadEpisodes(n)} />
                ) : !episodes ? (
                  <div className="flex justify-center py-6 text-brand-400" role="status" aria-label={t("epLoadingEps")}><Spinner className="h-6 w-6" /></div>
                ) : episodes.length === 0 ? (
                  <p className="text-center text-sm text-zinc-400">{t("epNoEps")}</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {episodes.map((ep) => {
                      const isWatched = watched.has(key(n, ep.episode_number));
                      const aired = isAired(ep);
                      const still = posterUrl(ep.still_path, "w300");
                      return (
                        <li key={ep.id ?? ep.episode_number} id={`ep-${n}-${ep.episode_number}`} className="flex items-center gap-3 py-3">
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
                              {[formatDate(ep.air_date), ep.runtime ? `${ep.runtime} min` : "", aired ? "" : t("epNotAired")].filter(Boolean).join(" · ") || t("epDateUnknown")}
                            </p>
                            {ep.overview && <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{ep.overview}</p>}
                          </div>
                          {user && (
                            <Button
                              size="sm"
                              variant={isWatched ? "primary" : "secondary"}
                              pending={isBusy(key(n, ep.episode_number))}
                              disabled={!aired && !isWatched}
                              onClick={() => toggleEpisode(n, ep.episode_number)}
                              aria-pressed={isWatched}
                              aria-label={t(isWatched ? "epMarkUnseenAria" : "epMarkSeenAria", { e: ep.episode_number, name: ep.name })}
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
      <BottomSheet open={Boolean(sheet)} onClose={() => setSheet(null)} title={sheet?.title || ""}>
        <p className="mb-4 text-sm text-zinc-300">{sheet?.text}</p>
        <div className="flex flex-col gap-2">
          {sheet?.options.map((o) => (
            <Button key={o.label} variant={o.variant || "secondary"} onClick={() => runSheetAction(o.action)}>{o.label}</Button>
          ))}
          <Button variant="ghost" onClick={() => setSheet(null)}>{t("cancel")}</Button>
        </div>
      </BottomSheet>
    </div>
  );
}
