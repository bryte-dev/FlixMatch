import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../api";
import MediaCard from "../components/MediaCard";
import { EmptyState, ErrorState, GridSkeleton, MediaGrid, PageHeader } from "../components/ui";
import { mediaTitle, mediaYear, posterUrl } from "../utils";

const SearchResults = () => {
  const { query } = useParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(Boolean(query));
  const [error, setError] = useState(false);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await axios.get(`${API_URL}/tmdb/search/${encodeURIComponent(query)}`);
      setResults(response.data.filter((i) => i.media_type === "movie" || i.media_type === "tv"));
    } catch (err) {
      console.error("Erreur lors de la recherche :", err);
      setResults([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (query) fetchResults();
    else setLoading(false);
  }, [query, fetchResults]);

  return (
    <div className="page">
      <PageHeader title="Résultats de recherche" subtitle={query ? `Pour « ${query} »` : ""} />
      {!query ? (
        <EmptyState icon="🔎" title="Que cherches-tu ?" text="Utilise la barre de recherche en haut de page." />
      ) : loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorState message="La recherche a échoué." onRetry={fetchResults} />
      ) : results.length === 0 ? (
        <EmptyState icon="🤷" title="Aucun résultat" text="Essaie avec un autre titre ou une autre orthographe." actionTo="/advanced-search" actionLabel="Recherche avancée" />
      ) : (
        <MediaGrid>
          {results.map((item) => (
            <MediaCard
              key={`${item.media_type}-${item.id}`}
              to={`/${item.media_type}/${item.id}`}
              title={mediaTitle(item)}
              poster={posterUrl(item.poster_path)}
              subtitle={[item.media_type === "tv" ? "Série" : "Film", mediaYear(item)].filter(Boolean).join(" · ")}
            />
          ))}
        </MediaGrid>
      )}
    </div>
  );
};

export default SearchResults;
