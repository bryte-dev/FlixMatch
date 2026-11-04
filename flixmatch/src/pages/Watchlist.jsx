import axios from "axios";
import { FiEye, FiStar, FiTrash2 } from "react-icons/fi";
import { API_URL } from "../api";
import { useToast } from "../toastContext";
import { useT } from "%s";
import useBusy from "../hooks/useBusy";
import useLibrary, { useEpisodeCounts } from "../hooks/useLibrary";
import LibraryView from "../components/LibraryView";
import MediaCard from "../components/MediaCard";
import { Button, MediaGrid, ShowMore } from "../components/ui";
import useIncremental from "../hooks/useIncremental";
import { errorMessage, posterUrl } from "../utils";

function Watchlist() {
  const library = useLibrary("/watchlist");
  const episodeCounts = useEpisodeCounts();
  const toast = useToast();
  const t = useT();
  const { isBusy, run } = useBusy();

  const entries = library.entries.filter((e) => e.status !== "SEEN" && e.status !== "JUNK");
  const paging = useIncremental(entries);

  const toggleFavorite = (entry) =>
    run(`fav-${entry.movie.id}`, async () => {
      const next = !entry.isFavorite;
      try {
        await axios.put(`${API_URL}/watchlist/${entry.movie.id}/favorite`, { isFavorite: next });
        library.patchEntry(entry.movie.id, { isFavorite: next });
        toast(next ? t("favAdded") : t("favRemoved"), "success");
      } catch (err) {
        toast(errorMessage(err, t("favToggleFail")), "error");
      }
    });

  const markAsSeen = (entry) =>
    run(`seen-${entry.movie.id}`, async () => {
      try {
        await axios.put(`${API_URL}/watchlist/${entry.movie.id}/seen`);
        library.removeEntry(entry.movie.id);
        toast(t("markedSeenToast", { title: entry.movie.title }), "success");
      } catch (err) {
        toast(errorMessage(err, t("markSeenFail")), "error");
      }
    });

  const moveToJunk = (entry) =>
    run(`junk-${entry.movie.id}`, async () => {
      try {
        await axios.put(`${API_URL}/watchlist/${entry.movie.id}/junk`);
        library.removeEntry(entry.movie.id);
        toast(t("trashedToast", { title: entry.movie.title }), "success");
      } catch (err) {
        toast(errorMessage(err, t("trashFail")), "error");
      }
    });

  return (
    <LibraryView
      title={t("myWatchlistTitle")}
      subtitle={library.loading || library.error ? "" : t(entries.length > 1 ? "toWatchMany" : "toWatchOne", { n: entries.length })}
      library={{ ...library, entries }}
      empty={{
        icon: "🍿",
        title: t("watchlistEmptyTitle"),
        text: t("watchlistEmptyText"),
        actionTo: "/",
        actionLabel: t("discoverTitles"),
      }}
    >
      <MediaGrid>
        {paging.visible.map((entry) => {
          const { movie } = entry;
          const watched = episodeCounts[movie.tmdb_id];
          return (
            <MediaCard
              key={movie.id}
              to={`/${movie.media_type}/${movie.tmdb_id}`}
              title={movie.title}
              poster={posterUrl(movie.poster_path)}
              subtitle={movie.media_type === "tv" ? (watched ? `${t("tvShow")} · ${t(watched > 1 ? "epSeenMany" : "epSeenOne", { n: watched })}` : t("tvShow")) : t("movie")}
              badge={entry.isFavorite ? "★ Favori" : null}
            >
              <Button
                size="sm"
                className="flex-1"
                variant="primary"
                pending={isBusy(`seen-${movie.id}`)}
                pendingLabel="…"
                onClick={() => markAsSeen(entry)}
                aria-label={t("markSeenAria", { title: movie.title })}
              >
                <FiEye aria-hidden="true" /> Vu
              </Button>
              <Button
                size="sm"
                pending={isBusy(`fav-${movie.id}`)}
                onClick={() => toggleFavorite(entry)}
                aria-pressed={entry.isFavorite}
                aria-label={entry.isFavorite ? t("removeFavAria", { title: movie.title }) : t("addFavAria", { title: movie.title })}
                className={entry.isFavorite ? "!text-amber-400" : ""}
              >
                <FiStar aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="danger"
                pending={isBusy(`junk-${movie.id}`)}
                onClick={() => moveToJunk(entry)}
                aria-label={t("trashAria", { title: movie.title })}
              >
                <FiTrash2 aria-hidden="true" />
              </Button>
            </MediaCard>
          );
        })}
      </MediaGrid>
      <ShowMore paging={paging} />
    </LibraryView>
  );
}

export default Watchlist;
