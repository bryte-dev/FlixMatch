import { useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FiBookmark, FiCheck, FiPlus } from "react-icons/fi";
import { API_URL } from "../api";
import { AuthContext } from "../AuthContext";
import { useToast } from "../toastContext";
import useBusy from "../hooks/useBusy";
import MediaCard from "../components/MediaCard";
import { Button, EmptyState, ErrorState, GridSkeleton, MediaGrid, Spinner } from "../components/ui";
import { errorMessage, mediaTitle, mediaYear, posterUrl } from "../utils";

function Home() {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const { isBusy, run } = useBusy();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [libraryIds, setLibraryIds] = useState(new Set());

  const fetchTrending = useCallback(async (pageToLoad) => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API_URL}/tmdb/trending`, { params: { page: pageToLoad } });
      const fresh = (res.data.results || []).filter((i) => i.media_type === "movie" || i.media_type === "tv");
      setItems((prev) => [...new Map([...prev, ...fresh].map((i) => [`${i.media_type}-${i.id}`, i])).values()]);
    } catch (err) {
      console.error("Erreur tendances :", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending(page);
  }, [page, fetchTrending]);

  // Titres déjà présents dans la bibliothèque (watchlist, vus, corbeille)
  useEffect(() => {
    if (!user) {
      setLibraryIds(new Set());
      return;
    }
    Promise.all([axios.get(`${API_URL}/watchlist`), axios.get(`${API_URL}/junk`)])
      .then(([watchlist, junk]) =>
        setLibraryIds(new Set([...watchlist.data, ...junk.data].map((entry) => entry.movie.tmdb_id)))
      )
      .catch((err) => console.error("Erreur chargement bibliothèque :", err));
  }, [user]);

  const addToWatchlist = (item) =>
    run(item.id, async () => {
      try {
        await axios.post(`${API_URL}/watchlist`, {
          tmdb_id: item.id,
          title: mediaTitle(item),
          media_type: item.media_type,
          poster_path: item.poster_path || "",
        });
        setLibraryIds((prev) => new Set(prev).add(item.id));
        toast(`« ${mediaTitle(item)} » ajouté à ta watchlist`, "success");
      } catch (err) {
        toast(errorMessage(err, "Impossible d'ajouter à la watchlist"), "error");
      }
    });

  return (
    <div className="page">
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-700/40 via-ink-800 to-ink-900 px-6 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-300">Films &amp; séries</p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Trouve ton prochain <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">coup de cœur</span>
          </h1>
          <p className="mt-4 text-lg text-zinc-300">
            Explore les tendances du moment, garde ta watchlist, note ce que tu as vu et suis tes séries épisode par épisode.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/advanced-search" className="btn btn-primary">Explorer par filtres</Link>
            {user ? (
              <Link to="/watchlist" className="btn btn-secondary"><FiBookmark aria-hidden="true" /> Ma watchlist</Link>
            ) : (
              <Link to="/register" className="btn btn-secondary">Créer un compte gratuit</Link>
            )}
          </div>
        </div>
      </section>

      <h2 className="mb-5 text-2xl font-bold">Tendances du moment</h2>

      {error && items.length === 0 ? (
        <ErrorState message="Impossible de charger les tendances." onRetry={() => fetchTrending(page)} />
      ) : items.length === 0 && !loading ? (
        <EmptyState title="Rien à afficher" text="Aucune tendance disponible pour le moment." />
      ) : (
        <>
          <MediaGrid>
            {items.map((item) => {
              const inLibrary = libraryIds.has(item.id);
              return (
                <MediaCard
                  key={`${item.media_type}-${item.id}`}
                  to={`/${item.media_type}/${item.id}`}
                  title={mediaTitle(item)}
                  poster={posterUrl(item.poster_path)}
                  subtitle={[item.media_type === "tv" ? "Série" : "Film", mediaYear(item)].filter(Boolean).join(" · ")}
                  badge={item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : null}
                >
                  {user && (
                    <Button
                      variant={inLibrary ? "secondary" : "primary"}
                      size="sm"
                      className="w-full"
                      disabled={inLibrary}
                      pending={isBusy(item.id)}
                      pendingLabel="Ajout…"
                      onClick={() => addToWatchlist(item)}
                      aria-label={inLibrary ? `${mediaTitle(item)} est déjà dans ta bibliothèque` : `Ajouter ${mediaTitle(item)} à la watchlist`}
                    >
                      {inLibrary ? <><FiCheck aria-hidden="true" /> Dans ma liste</> : <><FiPlus aria-hidden="true" /> Watchlist</>}
                    </Button>
                  )}
                </MediaCard>
              );
            })}
          </MediaGrid>

          {loading && items.length > 0 && (
            <div className="mt-8 flex justify-center text-brand-400" role="status" aria-label="Chargement"><Spinner className="h-7 w-7" /></div>
          )}
          {loading && items.length === 0 && <GridSkeleton />}
          {error && items.length > 0 && (
            <p className="mt-6 text-center text-sm text-zinc-400" role="alert">Le chargement de la suite a échoué.</p>
          )}
          {items.length > 0 && !loading && (
            <div className="mt-8 flex justify-center">
              <Button onClick={() => (error ? fetchTrending(page) : setPage((p) => p + 1))}>{error ? "Réessayer" : "Voir plus de titres"}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Home;
