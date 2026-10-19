import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { track } from "../lib/analytics";
import { API_URL } from "../api";
import { useSettings } from "../settings";
import { resultKey } from "../lib/searchMerge";
import MediaCard from "../components/MediaCard";
import { EmptyState, ErrorState, GridSkeleton, InfiniteSentinel, MediaGrid, PageHeader, Spinner, Tabs } from "../components/ui";
import { mediaTitle, mediaYear, posterUrl } from "../utils";

const TABS = [["all", "Tout"], ["movie", "Films"], ["tv", "Séries"], ["person", "Personnes"]];

const cardProps = (item) => {
  if (item.media_type === "person") {
    const work = (item.known_for || [])[0];
    return {
      to: work ? `/${work.media_type}/${work.id}` : "/",
      title: item.name,
      poster: posterUrl(item.profile_path),
      subtitle: (item.known_for || []).map(mediaTitle).slice(0, 2).join(", ") || item.known_for_department || "Personne",
    };
  }
  return {
    to: `/${item.media_type}/${item.id}`,
    title: mediaTitle(item),
    poster: posterUrl(item.poster_path),
    subtitle: [item.media_type === "tv" ? "Série" : "Film", mediaYear(item)].filter(Boolean).join(" · "),
    ratings: { tmdb: item.vote_average, tmdbVotes: item.vote_count },
  };
};

const SearchResults = () => {
  const { query } = useParams();
  const { metaLang } = useSettings();
  const [tab, setTab] = useState("all");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(Boolean(query));
  const [error, setError] = useState(false);
  const busy = useRef(false);
  // Génération de recherche : une réponse d'une recherche précédente (onglet/filtres changés) est ignorée
  const generation = useRef(0);

  const fetchPage = useCallback(
    async (nextPage) => {
      if (busy.current) return;
      busy.current = true;
      const gen = generation.current;
      setLoading(true);
      setError(false);
      try {
        const res = await axios.get(`${API_URL}/tmdb/search`, { params: { query, type: tab, page: nextPage, lang: metaLang } });
        if (gen !== generation.current) return;
        if (nextPage === 1) track("search_performed", { query: String(query || "").toLowerCase().slice(0, 60), type: tab, results_count: res.data.total_results ?? res.data.results?.length ?? 0 });
        setTotalPages(res.data.total_pages || 1);
        setPage(nextPage);
        setResults((prev) => {
          const seen = new Set(nextPage === 1 ? [] : prev.map(resultKey));
          const base = nextPage === 1 ? [] : prev;
          return [...base, ...res.data.results.filter((r) => !seen.has(resultKey(r)))];
        });
      } catch (err) {
        if (gen !== generation.current) return;
        console.error("Erreur lors de la recherche :", err);
        setError(true);
      } finally {
        if (gen === generation.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [query, tab, metaLang]
  );

  useEffect(() => {
    generation.current += 1;
    setResults([]);
    setPage(0);
    busy.current = false;
    if (query) fetchPage(1);
    else setLoading(false);
  }, [query, fetchPage]);

  const hasMore = page > 0 && page < totalPages && !error;

  return (
    <div className="page">
      <PageHeader title="Résultats de recherche" subtitle={query ? `Pour « ${query} » (toutes langues)` : ""} />
      {query && <Tabs tabs={TABS} value={tab} onChange={setTab} label="Type de résultats" />}
      {!query ? (
        <EmptyState icon="🔎" title="Que cherches-tu ?" text="Utilise la barre de recherche en haut de page." />
      ) : loading && results.length === 0 ? (
        <GridSkeleton />
      ) : error && results.length === 0 ? (
        <ErrorState message="La recherche a échoué." onRetry={() => fetchPage(1)} />
      ) : results.length === 0 ? (
        <EmptyState icon="🤷" title="Aucun résultat" text="Essaie avec un autre titre ou une autre orthographe." actionTo="/advanced-search" actionLabel="Recherche avancée" />
      ) : (
        <>
          <MediaGrid>
            {results.map((item) => (
              <MediaCard key={resultKey(item)} {...cardProps(item)} />
            ))}
          </MediaGrid>
          {loading && <div className="mt-6 flex justify-center text-brand-400" role="status" aria-label="Chargement"><Spinner className="h-7 w-7" /></div>}
          <InfiniteSentinel disabled={!hasMore || loading} onVisible={() => fetchPage(page + 1)} />
        </>
      )}
    </div>
  );
};

export default SearchResults;
