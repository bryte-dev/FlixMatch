import axios from "axios";
import { FiRotateCcw } from "react-icons/fi";
import { API_URL } from "../api";
import { useToast } from "../toastContext";
import { useT } from "%s";
import useBusy from "../hooks/useBusy";
import useLibrary from "../hooks/useLibrary";
import LibraryView from "../components/LibraryView";
import MediaCard from "../components/MediaCard";
import { Button, MediaGrid, ShowMore } from "../components/ui";
import useIncremental from "../hooks/useIncremental";
import { errorMessage, posterUrl } from "../utils";

function Junk() {
  const library = useLibrary("/junk");
  const paging = useIncremental(library.entries);
  const toast = useToast();
  const t = useT();
  const { isBusy, run } = useBusy();

  const restore = (movie) =>
    run(movie.id, async () => {
      try {
        await axios.put(`${API_URL}/junk/${movie.id}/restore`);
        library.removeEntry(movie.id);
        toast(t("restoredJunkToast", { title: movie.title }), "success");
      } catch (err) {
        toast(errorMessage(err, t("restoreJunkFail")), "error");
      }
    });

  return (
    <LibraryView
      title={t("trash")}
      subtitle={library.loading || library.error ? "" : t("junkSubtitle")}
      library={library}
      empty={{
        icon: "🗑️",
        title: t("junkEmptyTitle"),
        text: t("junkEmptyText"),
        actionTo: "/watchlist",
        actionLabel: t("openWatchlist"),
      }}
    >
      <MediaGrid>
        {paging.visible.map(({ movie }) => (
          <MediaCard
            key={movie.id}
            to={`/${movie.media_type}/${movie.tmdb_id}`}
            title={movie.title}
            poster={posterUrl(movie.poster_path)}
            subtitle={movie.media_type === "tv" ? t("tvShow") : t("movie")}
          >
            <Button
              size="sm"
              className="w-full"
              pending={isBusy(movie.id)}
              pendingLabel={t("restoring")}
              onClick={() => restore(movie)}
              aria-label={t("restoreAria", { title: movie.title })}
            >
              <FiRotateCcw aria-hidden="true" /> {t("restore")}
            </Button>
          </MediaCard>
        ))}
      </MediaGrid>
      <ShowMore paging={paging} />
    </LibraryView>
  );
}

export default Junk;
