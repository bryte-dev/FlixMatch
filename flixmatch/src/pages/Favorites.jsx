import axios from "axios";
import { FiStar } from "react-icons/fi";
import { API_URL } from "../api";
import { useToast } from "../toastContext";
import useBusy from "../hooks/useBusy";
import useLibrary from "../hooks/useLibrary";
import LibraryView from "../components/LibraryView";
import MediaCard from "../components/MediaCard";
import { Button, MediaGrid } from "../components/ui";
import { errorMessage, posterUrl } from "../utils";

function Favorites() {
  const library = useLibrary("/favorites");
  const toast = useToast();
  const { isBusy, run } = useBusy();

  const removeFromFavorites = (entry) =>
    run(entry.movie.id, async () => {
      try {
        await axios.put(`${API_URL}/watchlist/${entry.movie.id}/favorite`, { isFavorite: false });
        library.removeEntry(entry.movie.id);
        toast("Retiré des favoris", "success");
      } catch (err) {
        toast(errorMessage(err, "Impossible de retirer des favoris"), "error");
      }
    });

  return (
    <LibraryView
      title="Mes favoris"
      library={library}
      empty={{
        icon: "⭐",
        title: "Aucun favori pour l'instant",
        text: "Marque un titre de ta watchlist avec l'étoile pour le retrouver ici.",
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
              pendingLabel="Retrait…"
              onClick={() => removeFromFavorites({ movie })}
              aria-label={`Retirer ${movie.title} des favoris`}
            >
              <FiStar aria-hidden="true" className="text-amber-400" /> Retirer
            </Button>
          </MediaCard>
        ))}
      </MediaGrid>
    </LibraryView>
  );
}

export default Favorites;
