import axios from "axios";
import { FiRotateCcw } from "react-icons/fi";
import { API_URL } from "../api";
import { useToast } from "../toastContext";
import useBusy from "../hooks/useBusy";
import useLibrary from "../hooks/useLibrary";
import LibraryView from "../components/LibraryView";
import MediaCard from "../components/MediaCard";
import { Button, MediaGrid } from "../components/ui";
import { errorMessage, posterUrl } from "../utils";

function Junk() {
  const library = useLibrary("/junk");
  const toast = useToast();
  const { isBusy, run } = useBusy();

  const restore = (movie) =>
    run(movie.id, async () => {
      try {
        await axios.put(`${API_URL}/junk/${movie.id}/restore`);
        library.removeEntry(movie.id);
        toast(`« ${movie.title} » restauré dans ta watchlist`, "success");
      } catch (err) {
        toast(errorMessage(err, "Impossible de restaurer ce titre"), "error");
      }
    });

  return (
    <LibraryView
      title="Corbeille"
      subtitle={library.loading || library.error ? "" : "Les titres que tu ne veux plus voir apparaître"}
      library={library}
      empty={{
        icon: "🗑️",
        title: "La corbeille est vide",
        text: "Les titres que tu écartes depuis ta watchlist apparaîtront ici.",
        actionTo: "/watchlist",
        actionLabel: "Ouvrir ma watchlist",
      }}
    >
      <MediaGrid>
        {library.entries.map(({ movie }) => (
          <MediaCard
            key={movie.id}
            to={`/${movie.media_type}/${movie.tmdb_id}`}
            title={movie.title}
            poster={posterUrl(movie.poster_path)}
            subtitle={movie.media_type === "tv" ? "Série" : "Film"}
          >
            <Button
              size="sm"
              className="w-full"
              pending={isBusy(movie.id)}
              pendingLabel="Restauration…"
              onClick={() => restore(movie)}
              aria-label={`Restaurer ${movie.title} dans la watchlist`}
            >
              <FiRotateCcw aria-hidden="true" /> Restaurer
            </Button>
          </MediaCard>
        ))}
      </MediaGrid>
    </LibraryView>
  );
}

export default Junk;
