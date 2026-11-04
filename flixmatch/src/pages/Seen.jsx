import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FiRotateCcw } from "react-icons/fi";
import { API_URL } from "../api";
import { useToast } from "../toastContext";
import { useT } from "%s";
import useBusy from "../hooks/useBusy";
import useLibrary, { useEpisodeCounts } from "../hooks/useLibrary";
import LibraryView from "../components/LibraryView";
import { Button, StarRating, ShowMore } from "../components/ui";
import useIncremental from "../hooks/useIncremental";
import { errorMessage, posterUrl } from "../utils";

function Seen() {
  const library = useLibrary("/seen");
  const paging = useIncremental(library.entries);
  const episodeCounts = useEpisodeCounts();
  const toast = useToast();
  const t = useT();
  const { isBusy, run } = useBusy();
  const [drafts, setDrafts] = useState({});
  const [openForm, setOpenForm] = useState(null);

  const draftOf = (id) => drafts[id] || { rating: 0, comment: "" };
  const setDraft = (id, patch) => setDrafts((prev) => ({ ...prev, [id]: { ...draftOf(id), ...patch } }));

  const rate = (movie, rating) =>
    run(`rate-${movie.id}`, async () => {
      try {
        await axios.put(`${API_URL}/seen/${movie.id}/rating`, { rating });
        library.patchEntry(movie.id, { rating });
        toast("Note enregistrée", "success");
      } catch (err) {
        toast(errorMessage(err, t("rateSaveFail")), "error");
      }
    });

  const submitReview = (movie) => {
    const { rating, comment } = draftOf(movie.id);
    if (!rating) return toast("Choisis une note avant de publier ton avis", "error");
    if (!comment.trim()) return toast("Écris un avis avant de le publier", "error");
    return run(`review-${movie.id}`, async () => {
      try {
        await axios.post(`${API_URL}/reviews/${movie.id}`, { rating, comment: comment.trim() });
        library.patchEntry(movie.id, { rating });
        setDrafts((prev) => ({ ...prev, [movie.id]: { rating: 0, comment: "" } }));
        setOpenForm(null);
        toast("Avis publié — retrouve-le sur la fiche du titre", "success");
      } catch (err) {
        toast(errorMessage(err, t("reviewPublishFail")), "error");
      }
    });
  };

  const restore = (movie) =>
    run(`restore-${movie.id}`, async () => {
      try {
        await axios.put(`${API_URL}/seen/${movie.id}/remove`);
        library.removeEntry(movie.id);
        toast(t("restoredToWatchlistToast", { title: movie.title }), "success");
      } catch (err) {
        toast(errorMessage(err, t("restoreToWatchlistFail")), "error");
      }
    });

  return (
    <LibraryView
      title={t("seenTitle")}
      library={library}
      empty={{
        icon: "👀",
        title: t("seenEmptyTitle"),
        text: t("seenEmptyText"),
        actionTo: "/watchlist",
        actionLabel: t("openWatchlist"),
      }}
    >
      <ul className="grid gap-4 lg:grid-cols-2">
        {paging.visible.map((entry) => {
          const { movie } = entry;
          const draft = draftOf(movie.id);
          const watched = episodeCounts[movie.tmdb_id];
          const poster = posterUrl(movie.poster_path, "w342");
          return (
            <li key={movie.id} className="surface flex gap-4 p-4">
              <Link to={`/${movie.media_type}/${movie.tmdb_id}`} className="shrink-0" aria-label={movie.title}>
                <img
                  src={poster || "/default-movie.png"}
                  alt={`Affiche de ${movie.title}`}
                  loading="lazy"
                  className="aspect-[2/3] w-24 rounded-lg bg-ink-700 object-cover sm:w-28"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold" title={movie.title}>
                    <Link to={`/${movie.media_type}/${movie.tmdb_id}`} className="hover:text-brand-300">{movie.title}</Link>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    {movie.media_type === "tv"
                      ? `${t("tvShow")}${watched ? ` · ${t(watched > 1 ? "epSeenMany" : "epSeenOne", { n: watched })}` : ""}`
                      : t("movie")}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{t("myRating")}</p>
                  <StarRating value={entry.rating || 0} onChange={(r) => rate(movie, r)} pending={isBusy(`rate-${movie.id}`)} label={t("myRating")} />
                </div>

                {openForm === movie.id ? (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitReview(movie);
                    }}
                  >
                    <StarRating value={draft.rating} onChange={(rating) => setDraft(movie.id, { rating })} label={t("reviewRatingLabel")} />
                    <label className="sr-only" htmlFor={`comment-${movie.id}`}>{t("yourReviewOn", { title: movie.title })}</label>
                    <textarea
                      id={`comment-${movie.id}`}
                      rows={3}
                      maxLength={2000}
                      value={draft.comment}
                      onChange={(e) => setDraft(movie.id, { comment: e.target.value })}
                      placeholder={t("yourReviewPh")}
                      className="field resize-y"
                    />
                    <div className="flex gap-2">
                      <Button type="submit" variant="primary" size="sm" pending={isBusy(`review-${movie.id}`)} pendingLabel={t("publishing")}>
                        {t("publish")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpenForm(null)}>{t("cancel")}</Button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setOpenForm(movie.id)}>{t("writeReview")}</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      pending={isBusy(`restore-${movie.id}`)}
                      pendingLabel="…"
                      onClick={() => restore(movie)}
                    >
                      <FiRotateCcw aria-hidden="true" /> {t("backToWatchlist")}
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ShowMore paging={paging} />
    </LibraryView>
  );
}

export default Seen;
