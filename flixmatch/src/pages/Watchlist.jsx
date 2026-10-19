import axios from "axios";
import { FiEye, FiStar, FiTrash2 } from "react-icons/fi";
import { API_URL } from "../api";
import { useToast } from "../toastContext";
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
  const { isBusy, run } = useBusy();

  const entries = library.entries.filter((e) => e.status !== "SEEN" && e.status !== "JUNK");
  const paging = useIncremental(entries);

  const toggleFavorite = (entry) =>
    run(`fav-${entry.movie.id}`, async () => {
      const next = !entry.isFavorite;
      try {
        await axios.put(`${API_URL}/watchlist/${entry.movie.id}/favorite`, { isFavorite: next });
        library.patchEntry(entry.movie.id, { isFavorite: next });
        toast(next ? "Ajouté aux favoris" : "Retiré des favoris", "success");
      } catch (err) {
        toast(errorMessage(err, "Impossible de modifier les favoris"), "error");
      }
    });

  const markAsSeen = (entry) =>
    run(`seen-${entry.movie.id}`, async () => {
      try {
        await axios.put(`${API_URL}/watchlist/${entry.movie.id}/seen`);
        library.removeEntry(entry.movie.id);
        toast(`« ${entry.movie.title} » marqué comme vu`, "success");
      } catch (err) {
        toast(errorMessage(err, "Impossible de marquer comme vu"), "error");
      }
    });

  const moveToJunk = (entry) =>
    run(`junk-${entry.movie.id}`, async () => {
      try {
        await axios.put(`${API_URL}/watchlist/${entry.movie.id}/junk`);
        library.removeEntry(entry.movie.id);
        toast(`« ${entry.movie.title} » déplacé dans la corbeille`, "success");
      } catch (err) {
        toast(errorMessage(err, "Impossible de déplacer vers la corbeille"), "error");
      }
    });

  return (
    <LibraryView
      title="Ma watchlist"
      subtitle={library.loading || library.error ? "" : `${entries.length} titre${entries.length > 1 ? "s" : ""} à regarder`}
      library={{ ...library, entries }}
      empty={{
        icon: "🍿",
        title: "Ta watchlist est vide",
        text: "Ajoute des films et séries depuis les tendances ou la recherche pour les retrouver ici.",
        actionTo: "/",
        actionLabel: "Découvrir des titres",
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
              subtitle={movie.media_type === "tv" ? (watched ? `Série · ${watched} épisode${watched > 1 ? "s" : ""} vu${watched > 1 ? "s" : ""}` : "Série") : "Film"}
              badge={entry.isFavorite ? "★ Favori" : null}
            >
              <Button
                size="sm"
                className="flex-1"
                variant="primary"
                pending={isBusy(`seen-${movie.id}`)}
                pendingLabel="…"
                onClick={() => markAsSeen(entry)}
                aria-label={`Marquer ${movie.title} comme vu`}
              >
                <FiEye aria-hidden="true" /> Vu
              </Button>
              <Button
                size="sm"
                pending={isBusy(`fav-${movie.id}`)}
                onClick={() => toggleFavorite(entry)}
                aria-pressed={entry.isFavorite}
                aria-label={entry.isFavorite ? `Retirer ${movie.title} des favoris` : `Ajouter ${movie.title} aux favoris`}
                className={entry.isFavorite ? "!text-amber-400" : ""}
              >
                <FiStar aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="danger"
                pending={isBusy(`junk-${movie.id}`)}
                onClick={() => moveToJunk(entry)}
                aria-label={`Mettre ${movie.title} à la corbeille`}
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
