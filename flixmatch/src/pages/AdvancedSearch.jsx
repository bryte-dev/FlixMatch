import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../api";
import MediaCard from "../components/MediaCard";
import { Button, EmptyState, ErrorState, GridSkeleton, MediaGrid, PageHeader } from "../components/ui";
import { mediaTitle, mediaYear, posterUrl } from "../utils";

const EMPTY_FILTERS = { query: "", genre: "", year: "", minRating: "", maxDuration: "" };

const Field = ({ label, children }) => (
  <label className="block text-sm font-medium text-zinc-300">
    <span className="mb-1 block">{label}</span>
    {children}
  </label>
);

function AdvancedSearch() {
  const [genres, setGenres] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debounced, setDebounced] = useState(EMPTY_FILTERS);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/tmdb/genres`)
      .then((res) => setGenres(res.data))
      .catch((err) => console.error("Erreur chargement genres :", err));
  }, []);

  // Évite une requête à chaque frappe
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(filters);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    axios
      .get(`${API_URL}/tmdb/advanced-search`, { params: { ...debounced, page } })
      .then((res) => active && setResults(res.data.results || []))
      .catch((err) => {
        console.error("Erreur recherche avancée :", err);
        if (active) {
          setResults([]);
          setError(true);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced, page]);

  const handleFilterChange = (e) => setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <div className="page">
      <PageHeader title="Recherche avancée" subtitle="Filtre les films par genre, année, note et durée." />

      <form className="surface mb-8 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
        <Field label="Titre">
          <input type="text" name="query" placeholder="Titre d'un film" className="field" value={filters.query} onChange={handleFilterChange} />
        </Field>
        <Field label="Genre">
          <select name="genre" className="field" value={filters.genre} onChange={handleFilterChange}>
            <option value="">Tous les genres</option>
            {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Année">
          <input type="number" name="year" min="1900" max="2100" placeholder="ex. 2020" className="field" value={filters.year} onChange={handleFilterChange} />
        </Field>
        <Field label="Note minimale (0-10)">
          <input type="number" name="minRating" min="0" max="10" step="0.5" placeholder="ex. 7" className="field" value={filters.minRating} onChange={handleFilterChange} />
        </Field>
        <Field label="Durée max (min)">
          <input type="number" name="maxDuration" min="0" max="1000" placeholder="ex. 120" className="field" value={filters.maxDuration} onChange={handleFilterChange} />
        </Field>
      </form>

      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorState message="Les filtres sont invalides ou TMDB est indisponible." onRetry={() => setFilters({ ...filters })} />
      ) : results.length === 0 ? (
        <EmptyState icon="🔎" title="Aucun résultat" text="Assouplis tes filtres pour élargir la recherche." />
      ) : (
        <MediaGrid>
          {results.map((item) => (
            <MediaCard
              key={item.id}
              to={`/movie/${item.id}`}
              title={mediaTitle(item)}
              poster={posterUrl(item.poster_path)}
              subtitle={["Film", mediaYear(item)].filter(Boolean).join(" · ")}
              badge={item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : null}
            />
          ))}
        </MediaGrid>
      )}

      <div className="mt-8 flex items-center justify-center gap-3">
        <Button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1 || loading}>← Précédent</Button>
        <span className="text-sm text-zinc-400" aria-live="polite">Page {page}</span>
        <Button onClick={() => setPage((p) => p + 1)} disabled={loading || results.length === 0}>Suivant →</Button>
      </div>
    </div>
  );
}

export default AdvancedSearch;
