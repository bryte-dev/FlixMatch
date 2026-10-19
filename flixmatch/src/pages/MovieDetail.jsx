import RatingBadges from "../components/RatingBadges";
import { useCallback, useContext, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { FiBookmark, FiCheck, FiEye, FiRotateCcw, FiStar, FiTrash2 } from "react-icons/fi";
import { API_URL } from "../api";
import { AuthContext } from "../AuthContext";
import { useToast } from "../toastContext";
import useBusy from "../hooks/useBusy";
import EpisodeTracker from "../components/EpisodeTracker";
import ReviewSection from "../components/ReviewSection";
import { Button, EmptyState, ErrorState, StarRating } from "../components/ui";
import { errorMessage, mediaTitle, mediaYear, posterUrl } from "../utils";

function DetailSkeleton() {
  return (
    <div className="page" role="status" aria-label="Chargement">
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="skeleton aspect-[2/3] w-full max-w-xs self-center md:self-start" />
        <div className="flex-1 space-y-4">
          <div className="skeleton h-10 w-2/3" />
          <div className="skeleton h-5 w-1/3" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-10 w-1/2" />
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <section className="mt-12">
    <h2 className="mb-4 text-2xl font-bold">{title}</h2>
    {children}
  </section>
);

function MovieDetail() {
  const { tmdbId, type } = useParams();
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const { isBusy, run } = useBusy();

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [library, setLibrary] = useState({ inLibrary: false });
  const [average, setAverage] = useState(null);
  const [videoIndex, setVideoIndex] = useState(0);

  const validType = type === "movie" || type === "tv";
  const numericId = Number(tmdbId);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError(false);
    setMovie(null);
    setVideoIndex(0);
    try {
      const res = await axios.get(`${API_URL}/tmdb/details/${tmdbId}/${type}`);
      setMovie(res.data);
      setAverage(res.data.flixmatchRating != null ? Number(res.data.flixmatchRating) : null);
    } catch (err) {
      console.error("Erreur récupération des détails :", err);
      setError(true);
    } finally {
      setLoading(false);
    }
    axios
      .get(`${API_URL}/tmdb/recommendations/${tmdbId}/${type}`)
      .then((res) => setRecommendations((res.data.results || []).slice(0, 20)))
      .catch(() => setRecommendations([]));
  }, [tmdbId, type]);

  useEffect(() => {
    if (validType) loadDetails();
  }, [validType, loadDetails]);

  const refreshLibrary = useCallback(async () => {
    if (!user) return setLibrary({ inLibrary: false });
    try {
      const res = await axios.get(`${API_URL}/library/${tmdbId}`, { params: { type } });
      setLibrary(res.data);
    } catch (err) {
      console.error("Erreur statut bibliothèque :", err);
    }
  }, [user, tmdbId, type]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const title = movie ? mediaTitle(movie) : "";

  // Ajoute le titre à la bibliothèque si besoin et renvoie son identifiant interne
  const ensureInLibrary = async () => {
    if (library.inLibrary) return library.movieId;
    try {
      const res = await axios.post(`${API_URL}/watchlist`, {
        tmdb_id: movie.id,
        title,
        media_type: type,
        poster_path: movie.poster_path || "",
      });
      return res.data.movieId;
    } catch (err) {
      // Déjà présent (état local périmé) : on réutilise l'entrée existante
      if (err.response?.data?.movieId) return err.response.data.movieId;
      throw err;
    }
  };

  const perform = (key, successMessage, task, fallback) =>
    run(key, async () => {
      try {
        await task();
        await refreshLibrary();
        toast(successMessage, "success");
      } catch (err) {
        toast(errorMessage(err, fallback), "error");
      }
    });

  const addToWatchlist = () =>
    perform("watchlist", "Ajouté à ta watchlist", ensureInLibrary, "Impossible d'ajouter à la watchlist");

  const toggleFavorite = () =>
    perform(
      "favorite",
      library.isFavorite ? "Retiré des favoris" : "Ajouté aux favoris",
      async () => {
        const id = await ensureInLibrary();
        await axios.put(`${API_URL}/watchlist/${id}/favorite`, { isFavorite: !library.isFavorite });
      },
      "Impossible de modifier les favoris"
    );

  const toggleSeen = () => {
    const isSeen = library.status === "SEEN";
    return perform(
      "seen",
      isSeen ? "Remis dans ta watchlist" : "Marqué comme vu",
      async () => {
        const id = await ensureInLibrary();
        if (isSeen) await axios.put(`${API_URL}/seen/${id}/remove`);
        else {
          if (library.status === "JUNK") await axios.put(`${API_URL}/junk/${id}/restore`);
          await axios.put(`${API_URL}/watchlist/${id}/seen`);
        }
      },
      "Impossible de mettre à jour le statut"
    );
  };

  const toggleJunk = () => {
    const isJunk = library.status === "JUNK";
    return perform(
      "junk",
      isJunk ? "Restauré dans ta watchlist" : "Déplacé dans la corbeille",
      async () => {
        const id = await ensureInLibrary();
        await axios.put(`${API_URL}${isJunk ? `/junk/${id}/restore` : `/watchlist/${id}/junk`}`);
      },
      "Impossible de mettre à jour la corbeille"
    );
  };

  const rate = (rating) =>
    run("rating", async () => {
      try {
        await axios.put(`${API_URL}/seen/${library.movieId}/rating`, { rating });
        setLibrary((prev) => ({ ...prev, rating }));
        toast("Note enregistrée", "success");
      } catch (err) {
        toast(errorMessage(err, "Impossible d'enregistrer la note"), "error");
      }
    });

  if (!validType || Number.isNaN(numericId)) {
    return <div className="page"><EmptyState icon="🧭" title="Page introuvable" actionTo="/" actionLabel="Retour à l'accueil" /></div>;
  }
  if (loading) return <DetailSkeleton />;
  if (error || !movie) {
    return (
      <div className="page">
        <ErrorState message="Impossible de charger cette fiche. Elle n'existe peut-être pas." onRetry={loadDetails} />
      </div>
    );
  }

  const status = library.status;
  const isSeen = status === "SEEN";
  const isJunk = status === "JUNK";
  const backdrop = posterUrl(movie.backdrop_path, "w1280");
  const videos = (movie.videos?.results || []).filter((v) => v.site === "YouTube" && ["Trailer", "Teaser", "Clip"].includes(v.type));
  const cast = (movie.credits?.cast || []).slice(0, 15);
  const directors = (movie.credits?.crew || []).filter((p) => p.job === "Director").map((p) => p.name);
  const runtime = movie.runtime || movie.episode_run_time?.[0];
  const year = mediaYear(movie);

  return (
    <div>
      <div className="relative isolate overflow-hidden">
        {backdrop && (
          <>
            <img src={backdrop} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/80 to-ink-950/30" />
          </>
        )}
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row lg:px-8">
          <img
            src={posterUrl(movie.poster_path, "w500") || "/default-movie.png"}
            alt={`Affiche de ${title}`}
            className="aspect-[2/3] w-56 shrink-0 self-center rounded-2xl border border-white/10 bg-ink-700 object-cover shadow-2xl shadow-black/50 md:w-72 md:self-start"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              {title} {year && <span className="font-medium text-zinc-400">({year})</span>}
            </h1>
            {movie.tagline && <p className="mt-2 text-lg italic text-zinc-400">{movie.tagline}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="chip">{type === "tv" ? "Série" : "Film"}</span>
              <RatingBadges
                size="lg"
                imdb={movie.imdbRating}
                imdbVotes={movie.imdbVotes}
                tmdb={movie.vote_average}
                tmdbVotes={movie.vote_count}
                flixmatch={average != null ? average * 2 : null}
                flixmatchVotes={movie.flixmatchVotes}
              />
              {runtime ? <span className="chip">{Math.floor(runtime / 60) ? `${Math.floor(runtime / 60)}h ` : ""}{runtime % 60}min</span> : null}
              {type === "tv" && movie.number_of_seasons ? <span className="chip">{movie.number_of_seasons} saison{movie.number_of_seasons > 1 ? "s" : ""}</span> : null}
              {movie.genres?.map((g) => <span key={g.id} className="chip">{g.name}</span>)}
            </div>

            <p className="mt-6 max-w-3xl leading-relaxed text-zinc-200">{movie.overview || "Aucune description disponible."}</p>

            <dl className="mt-6 grid max-w-3xl gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="inline text-zinc-500">Sortie : </dt><dd className="inline">{movie.release_date || movie.first_air_date || "Inconnue"}</dd></div>
              {type === "movie" ? (
                <>
                  <div><dt className="inline text-zinc-500">Réalisation : </dt><dd className="inline">{directors.join(", ") || "Inconnue"}</dd></div>
                  <div><dt className="inline text-zinc-500">Budget : </dt><dd className="inline">{movie.budget ? `${movie.budget.toLocaleString("fr-FR")} $` : "Inconnu"}</dd></div>
                  <div><dt className="inline text-zinc-500">Recettes : </dt><dd className="inline">{movie.revenue ? `${movie.revenue.toLocaleString("fr-FR")} $` : "Inconnues"}</dd></div>
                </>
              ) : (
                <div><dt className="inline text-zinc-500">Création : </dt><dd className="inline">{movie.created_by?.map((c) => c.name).join(", ") || "Inconnue"}</dd></div>
              )}
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <>
                  {!library.inLibrary && (
                    <Button variant="primary" pending={isBusy("watchlist")} pendingLabel="Ajout…" onClick={addToWatchlist}>
                      <FiBookmark aria-hidden="true" /> Ajouter à la watchlist
                    </Button>
                  )}
                  {library.inLibrary && !isJunk && !isSeen && (
                    <span className="chip !border-emerald-500/30 !text-emerald-300"><FiCheck aria-hidden="true" className="mr-1" />Dans ta watchlist</span>
                  )}
                  <Button variant={isSeen ? "primary" : "secondary"} pending={isBusy("seen")} pendingLabel="…" onClick={toggleSeen} aria-pressed={isSeen}>
                    <FiEye aria-hidden="true" /> {isSeen ? "Vu" : "Marquer comme vu"}
                  </Button>
                  <Button
                    pending={isBusy("favorite")}
                    pendingLabel="…"
                    onClick={toggleFavorite}
                    aria-pressed={Boolean(library.isFavorite)}
                    disabled={isJunk}
                    className={library.isFavorite ? "!text-amber-400" : ""}
                  >
                    <FiStar aria-hidden="true" /> {library.isFavorite ? "Favori" : "Ajouter aux favoris"}
                  </Button>
                  {library.inLibrary && (
                    <Button variant="ghost" pending={isBusy("junk")} pendingLabel="…" onClick={toggleJunk}>
                      {isJunk ? <><FiRotateCcw aria-hidden="true" /> Restaurer</> : <><FiTrash2 aria-hidden="true" /> Corbeille</>}
                    </Button>
                  )}
                </>
              ) : (
                <Link to="/login" className="btn btn-primary">Connecte-toi pour suivre ce titre</Link>
              )}
            </div>

            {user && isSeen && (
              <div className="mt-5 flex items-center gap-3">
                <span className="text-sm text-zinc-400">Ma note</span>
                <StarRating value={library.rating || 0} onChange={rate} pending={isBusy("rating")} label="Ma note" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page !pt-0">
        {type === "tv" && (
          <Section title="Épisodes">
            <EpisodeTracker seriesId={numericId} user={user} />
          </Section>
        )}

        {videos.length > 0 && (
          <Section title="Bandes-annonces">
            <div className="surface overflow-hidden">
              <div className="aspect-video w-full bg-black">
                <iframe
                  key={videos[videoIndex].key}
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${videos[videoIndex].key}`}
                  title={videos[videoIndex].name}
                  loading="lazy"
                  allowFullScreen
                />
              </div>
              {videos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {videos.slice(0, 8).map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVideoIndex(i)}
                      aria-pressed={i === videoIndex}
                      className={`chip shrink-0 cursor-pointer transition hover:bg-white/10 ${i === videoIndex ? "!border-brand-400 !text-brand-300" : ""}`}
                    >
                      {v.type} · {v.name.length > 28 ? `${v.name.slice(0, 28)}…` : v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {cast.length > 0 && (
          <Section title="Casting">
            <ul className="flex snap-x gap-4 overflow-x-auto pb-3">
              {cast.map((actor) => (
                <li key={actor.id} className="w-28 shrink-0 snap-start text-center">
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(actor.name)}`} target="_blank" rel="noopener noreferrer" className="group block">
                    <img
                      src={posterUrl(actor.profile_path, "w185") || "/default-actor.png"}
                      alt=""
                      loading="lazy"
                      className="mx-auto h-28 w-28 rounded-full border border-white/10 bg-ink-700 object-cover transition group-hover:border-brand-400"
                    />
                    <p className="mt-2 truncate text-sm font-medium" title={actor.name}>{actor.name}</p>
                    {actor.character && <p className="truncate text-xs text-zinc-500" title={actor.character}>{actor.character}</p>}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {recommendations.length > 0 && (
          <Section title="Recommandations">
            <ul className="flex snap-x gap-4 overflow-x-auto pb-3">
              {recommendations.map((rec) => (
                <li key={rec.id} className="w-36 shrink-0 snap-start sm:w-40">
                  <Link to={`/${rec.media_type || type}/${rec.id}`} className="group block" title={mediaTitle(rec)}>
                    <img
                      src={posterUrl(rec.poster_path, "w342") || "/default-movie.png"}
                      alt={`Affiche de ${mediaTitle(rec)}`}
                      loading="lazy"
                      className="aspect-[2/3] w-full rounded-xl border border-white/10 bg-ink-700 object-cover transition duration-300 group-hover:-translate-y-1 group-hover:border-brand-400/50"
                    />
                    <p className="mt-2 truncate text-sm font-medium">{mediaTitle(rec)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="mt-12">
          <ReviewSection
            tmdbId={numericId}
            type={type}
            title={title}
            posterPath={movie.poster_path}
            user={user}
            onAverageChange={setAverage}
          />
        </div>
      </div>
    </div>
  );
}

export default MovieDetail;
