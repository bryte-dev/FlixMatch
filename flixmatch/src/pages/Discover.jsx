import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FiHeart, FiEye, FiRotateCcw, FiSliders, FiX, FiBookmark } from "react-icons/fi";
import { API_URL } from "../api";
import { AuthContext } from "../AuthContext";
import { useToast } from "../toastContext";
import { useSettings } from "../settings";
import SwipeCard from "../components/SwipeCard";
import { BottomSheet, Button, EmptyState, ErrorState, Spinner } from "../components/ui";
import { errorMessage, mediaTitle, mediaYear, posterUrl } from "../utils";

const IGNORED_KEY = "fm-ignored";
const readIgnored = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(IGNORED_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
const writeIgnored = (set) => {
  try {
    localStorage.setItem(IGNORED_KEY, JSON.stringify([...set].slice(-2000)));
  } catch {
    // ignoré : stockage indisponible
  }
};

const keyOf = (item) => `${item.media_type}-${item.id}`;

function WhereToWatch({ item, region, myProviders }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let active = true;
    setInfo(null);
    axios
      .get(`${API_URL}/tmdb/watch/${item.media_type}/${item.id}`, { params: { region } })
      .then((res) => active && setInfo(res.data))
      .catch(() => active && setInfo({ flatrate: [], link: null }));
    return () => {
      active = false;
    };
  }, [item.id, item.media_type, region]);

  if (!info) return <div className="skeleton h-9 w-40" aria-hidden="true" />;
  if (info.flatrate.length === 0) {
    return <p className="text-xs text-zinc-400">Pas de streaming par abonnement trouvé ({region}).</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {info.flatrate.slice(0, 6).map((p) => (
        <img
          key={p.provider_id}
          src={posterUrl(p.logo_path, "w92")}
          alt={p.provider_name}
          title={p.provider_name}
          loading="lazy"
          className={`h-9 w-9 rounded-lg ${myProviders.includes(p.provider_id) ? "ring-2 ring-brand-400" : "opacity-70"}`}
        />
      ))}
      {info.link && (
        <a href={info.link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-300 underline">
          Voir les offres
        </a>
      )}
    </div>
  );
}

export default function Discover() {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const navigate = useNavigate();
  const settings = useSettings();
  const cardRef = useRef(null);

  const [filters, setFilters] = useState({ type: "movie", genre: "", onlyMine: false });
  const [genres, setGenres] = useState([]);
  const [queue, setQueue] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [libraryIds, setLibraryIds] = useState(new Set());
  const [ignored, setIgnored] = useState(readIgnored);
  const [history, setHistory] = useState([]);
  const [sheet, setSheet] = useState(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    axios.get(`${API_URL}/tmdb/genres`).then((r) => setGenres(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setLibraryIds(new Set());
      return;
    }
    Promise.all([axios.get(`${API_URL}/watchlist`), axios.get(`${API_URL}/junk`)])
      .then(([w, j]) => setLibraryIds(new Set([...w.data, ...j.data].map((e) => e.movie.tmdb_id))))
      .catch(() => {});
  }, [user]);

  const providersParam = filters.onlyMine && settings.providers.length ? settings.providers.join("|") : "";

  const loadMore = useCallback(
    async (nextPage) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(false);
      try {
        const res = await axios.get(`${API_URL}/tmdb/discover`, {
          params: {
            type: filters.type,
            genre: filters.genre || undefined,
            providers: providersParam || undefined,
            region: settings.region,
            lang: settings.metaLang,
            adult: settings.adult,
            page: nextPage,
          },
        });
        const fresh = res.data.results || [];
        setExhausted(nextPage >= (res.data.total_pages || 1) || fresh.length === 0);
        setPage(nextPage);
        setQueue((prev) => {
          const seen = new Set(prev.map(keyOf));
          return [...prev, ...fresh.filter((i) => !seen.has(keyOf(i)))];
        });
      } catch {
        setError(true);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [filters.type, filters.genre, providersParam, settings.region, settings.metaLang, settings.adult]
  );

  // Nouveau paquet quand les filtres changent
  useEffect(() => {
    setQueue([]);
    setHistory([]);
    setExhausted(false);
    loadingRef.current = false;
    loadMore(1);
  }, [loadMore]);

  const deck = useMemo(
    () => queue.filter((i) => !libraryIds.has(i.id) && !ignored.has(keyOf(i))),
    [queue, libraryIds, ignored]
  );

  useEffect(() => {
    if (deck.length < 5 && !loading && !error && !exhausted && page > 0) loadMore(page + 1);
  }, [deck.length, loading, error, exhausted, page, loadMore]);

  const top = deck[0];

  const addToLibrary = async (item, direction) => {
    const res = await axios
      .post(`${API_URL}/watchlist`, {
        tmdb_id: item.id,
        title: mediaTitle(item),
        media_type: item.media_type,
        poster_path: item.poster_path || "",
      })
      .catch((err) => {
        if (err.response?.data?.movieId) return err; // déjà présent : on continue avec son id
        throw err;
      });
    const movieId = res.data?.movieId || res.response?.data?.movieId;
    if (direction === "up") await axios.put(`${API_URL}/watchlist/${movieId}/seen`);
    else if (settings.swipeAction === "favorites") await axios.put(`${API_URL}/watchlist/${movieId}/favorite`, { isFavorite: true });
    return movieId;
  };

  const handleSwipe = async (direction) => {
    const item = top;
    if (!item) return;
    if (direction === "left") {
      const next = new Set(ignored).add(keyOf(item));
      setIgnored(next);
      writeIgnored(next);
      setHistory((h) => [...h, { item, direction }]);
      return;
    }
    if (!user) {
      toast("Connecte-toi pour enregistrer tes choix.", "info");
      navigate("/login");
      return;
    }
    setLibraryIds((prev) => new Set(prev).add(item.id));
    try {
      const movieId = await addToLibrary(item, direction);
      setHistory((h) => [...h, { item, direction, movieId }]);
      const label = direction === "up" ? "marqué comme vu" : settings.swipeAction === "favorites" ? "ajouté aux favoris" : "ajouté à ta watchlist";
      toast(`« ${mediaTitle(item)} » ${label}`, "success");
    } catch (err) {
      setLibraryIds((prev) => {
        const copy = new Set(prev);
        copy.delete(item.id);
        return copy;
      });
      toast(errorMessage(err, "Action impossible"), "error");
    }
  };

  const undo = async () => {
    const last = history[history.length - 1];
    if (!last) return;
    try {
      if (last.direction === "left") {
        const next = new Set(ignored);
        next.delete(keyOf(last.item));
        setIgnored(next);
        writeIgnored(next);
      } else {
        await axios.delete(`${API_URL}/watchlist/${last.movieId}`);
        setLibraryIds((prev) => {
          const copy = new Set(prev);
          copy.delete(last.item.id);
          return copy;
        });
      }
      setHistory((h) => h.slice(0, -1));
    } catch (err) {
      toast(errorMessage(err, "Impossible d'annuler"), "error");
    }
  };

  // Clavier : ← ignorer, → action, ↑ déjà vu, Z annuler
  useEffect(() => {
    const onKey = (e) => {
      if (sheet || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up" };
      if (map[e.key]) {
        e.preventDefault();
        cardRef.current?.trigger(map[e.key]);
      } else if (e.key.toLowerCase() === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const rightLabel = settings.swipeAction === "favorites" ? "Favoris" : "Watchlist";
  const RightIcon = settings.swipeAction === "favorites" ? FiHeart : FiBookmark;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Découverte</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setSheet(true)} aria-label="Filtres"><FiSliders aria-hidden="true" /> Filtres</Button>
        </div>
      </div>

      <div className="relative mb-4 w-full flex-1" style={{ minHeight: "min(60dvh, 560px)" }}>
        {top ? (
          <>
            {deck[1] && (
              <div className="surface absolute inset-0 scale-95 overflow-hidden opacity-70" aria-hidden="true">
                <img src={posterUrl(deck[1].poster_path, "w342") || "/default-movie.png"} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <SwipeCard key={keyOf(top)} ref={cardRef} onSwipe={handleSwipe}>
              <article className="surface relative h-full w-full overflow-hidden" aria-label={mediaTitle(top)}>
                <img
                  src={posterUrl(top.poster_path, "w780") || "/default-movie.png"}
                  alt={`Affiche de ${mediaTitle(top)}`}
                  draggable={false}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-16 text-white">
                  <h2 className="text-xl font-bold leading-tight">{mediaTitle(top)}</h2>
                  <p className="mb-1 text-xs text-zinc-300">
                    {[top.media_type === "tv" ? "Série" : "Film", mediaYear(top), top.vote_average ? `★ ${top.vote_average.toFixed(1)} TMDB` : ""].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mb-2 line-clamp-2 text-xs text-zinc-300">{top.overview}</p>
                  <WhereToWatch item={top} region={settings.region} myProviders={settings.providers} />
                </div>
              </article>
            </SwipeCard>
          </>
        ) : loading ? (
          <div className="surface flex h-full items-center justify-center text-brand-400" role="status" aria-label="Chargement"><Spinner className="h-8 w-8" /></div>
        ) : error ? (
          <ErrorState message="Impossible de charger des titres." onRetry={() => loadMore(Math.max(page + 1, 1))} />
        ) : (
          <EmptyState icon="🎉" title="Tu as tout vu !" text="Change les filtres pour découvrir d'autres titres." />
        )}
      </div>

      <div className="flex items-center justify-center gap-3" role="group" aria-label="Actions">
        <Button onClick={undo} disabled={history.length === 0} aria-label="Annuler le dernier choix" title="Annuler (Z)"><FiRotateCcw aria-hidden="true" /></Button>
        <Button variant="danger" onClick={() => cardRef.current?.trigger("left")} disabled={!top} aria-label="Ignorer (flèche gauche)"><FiX aria-hidden="true" /> Ignorer</Button>
        <Button onClick={() => cardRef.current?.trigger("up")} disabled={!top} aria-label="Déjà vu (flèche haut)"><FiEye aria-hidden="true" /> Vu</Button>
        <Button variant="primary" onClick={() => cardRef.current?.trigger("right")} disabled={!top} aria-label={`${rightLabel} (flèche droite)`}><RightIcon aria-hidden="true" /> {rightLabel}</Button>
      </div>
      <p className="mt-3 text-center text-xs text-zinc-500">
        ← ignorer · → {rightLabel.toLowerCase()} · ↑ déjà vu · Z annuler ·{" "}
        <Link to="/settings" className="underline">changer l&apos;action</Link>
      </p>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Filtres">
        <div className="space-y-4">
          <div className="flex gap-2" role="group" aria-label="Type">
            {[["movie", "Films"], ["tv", "Séries"]].map(([value, label]) => (
              <Button key={value} variant={filters.type === value ? "primary" : "secondary"} className="flex-1" aria-pressed={filters.type === value} onClick={() => setFilters((f) => ({ ...f, type: value }))}>{label}</Button>
            ))}
          </div>
          <label className="block text-sm font-medium">
            <span className="mb-1 block">Genre</span>
            <select className="field" value={filters.genre} onChange={(e) => setFilters((f) => ({ ...f, genre: e.target.value }))}>
              <option value="">Tous les genres</option>
              {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={filters.onlyMine} disabled={settings.providers.length === 0} onChange={(e) => setFilters((f) => ({ ...f, onlyMine: e.target.checked }))} />
            Seulement mes plateformes {settings.providers.length === 0 && <Link to="/settings" className="underline">(à choisir dans les paramètres)</Link>}
          </label>
          <Button variant="primary" className="w-full" onClick={() => setSheet(false)}>Appliquer</Button>
        </div>
      </BottomSheet>
    </div>
  );
}
