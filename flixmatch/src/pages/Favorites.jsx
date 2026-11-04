import axios from "axios";
import { FiStar } from "react-icons/fi";
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

function Favorites() {
  const library = useLibrary("/favorites");
  const paging = useIncremental(library.entries);
  const toast = useToast();
  const t = useT();
  const { isBusy, run } = useBusy();

  const removeFromFavorites = (entry) =>
    run(entry.movie.id, async () => {
      try {
        await axios.put(`${API_URL}/watchlist/${entry.movie.id}/favorite`, { isFavorite: false });
        library.removeEntry(entry.movie.id);
        toast("Retiré des favoris", "success");
      } catch (err) {
        toast(errorMessage(err, t("favRemoveFail")), "error");
      }
    });

  return (
    <LibraryView
      title={t("myFavorites")}
      library={library}
      empty={{
        icon: "⭐",
        title: t("favEmptyTitle"),
        text: t("favEmptyText"),
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
              pendingLabel={t("removing")}
              onClick={() => removeFromFavorites({ movie })}
              aria-label={t("removeFavAria", { title: movie.title })}
            >
              <FiStar aria-hidden="true" className="text-amber-400" /> {t("remove")}
            </Button>
          </MediaCard>
        ))}
      </MediaGrid>
      <ShowMore paging={paging} />
    </LibraryView>
  );
}

export default Favorites;
