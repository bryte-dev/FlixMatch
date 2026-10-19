import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { track } from "../lib/analytics";
import { API_URL } from "../api";
import { useSettings } from "../settings";
import MediaCard from "../components/MediaCard";
import { EmptyState, ErrorState, GridSkeleton, InfiniteSentinel, MediaGrid, PageHeader, Spinner, Tabs } from "../components/ui";
import { mediaTitle, mediaYear, posterUrl } from "../utils";

const EMPTY_FILTERS = { query: "", genre: "", year: "", minRating: "", maxDuration: "", originalLanguage: "", sort: "popularity", onlyMine: false };

const ORIGINAL_LANGS = { fr: "Français", en: "Anglais", es: "Espagnol", de: "Allemand", it: "Italien", pt: "Portugais", ja: "Japonais", ko: "Coréen", zh: "Chinois", hi: "Hindi", tr: "Turc", ru: "Russe" };
const SORTS = { popularity: "Popularité", rating: "Note", date: "Date de sortie" };

const Field = ({ label, children }) => (
  <label className="block text-sm font-medium text-zinc-300">
    <span className="mb-1 block">{label}</span>
    {children}
  </label>
);

function AdvancedSearch() {
  const settings = useSettings();
  const [type, setType] = useState("movie");
  const [genres, setGenres] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debounced, setDebounced] = useState(EMPTY_FILTERS);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  // Génération de recherche : une réponse d'une recherche précédente (onglet/filtres changés) est ignorée
  const generation = useRef(0);

  useEffect(() => {
    axios
      .get(`${API_URL}/tmdb/genres`)
      .then((res) => setGenres(res.data))
      .catch((err) => console.error("Erreur chargement genres :", err));
  }, []);

  // Évite une requête à chaque frappe
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(filters), 400);
    return () => clearTimeout(timer);
  }, [filters]);

  const fetchPage = useCallback(
    async (nextPage) => {
      if (busy.current) return;
      busy.current = true;
      const gen = generation.current;
      setLoading(true);
      setError(false);
      const { onlyMine, ...rest } = debounced;
      try {
        const res = await axios.get(`${API_URL}/tmdb/advanced-search`, {
          params: {
            ...rest,
            type,
            page: nextPage,
            lang: settings.metaLang,
            region: settings.region,
            providers: onlyMine && settings.providers.length ? settings.providers.join("|") : undefined,
          },
        });
        if (gen !== generation.current) return;
        if (nextPage === 1) {
          track("advanced_search_performed", {
            type,
            filters: Object.entries(rest).filter(([, v]) => v !== "" && v !== undefined && v !== null && v !== false).map(([k]) => k),
            only_my_providers: Boolean(onlyMine),
            results_count: res.data.total_results ?? 0,
          });
        }
        setTotalPages(res.data.total_pages || 1);
        setPage(nextPage);
        setResults((prev) => {
          const base = nextPage === 1 ? [] : prev;
          const seen = new Set(base.map((r) => r.id));
          return [...base, ...(res.data.results || []).filter((r) => !seen.has(r.id))];
        });
      } catch (err) {
        if (gen !== generation.current) return;
        console.error("Erreur recherche avancée :", err);
        if (nextPage === 1) setResults([]);
        setError(true);
      } finally {
        if (gen === generation.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [debounced, type, settings.metaLang, settings.region, settings.providers]
  );

  useEffect(() => {
    generation.current += 1;
    busy.current = false;
    setPage(0);
    fetchPage(1);
  }, [fetchPage]);

  const handleFilterChange = (e) =>
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const hasMore = page > 0 && page < totalPages && !error;

  return (
    <div className="page">
      <PageHeader title="Recherche avancée" subtitle="Filtre les films et séries par genre, année, note, plateforme, langue et durée." />

      <Tabs tabs={[["movie", "Films"], ["tv", "Séries"]]} value={type} onChange={setType} label="Type de titre" />

      <form className="surface mb-8 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="Titre">
          <input type="search" name="query" placeholder="Titre" className="field" value={filters.query} onChange={handleFilterChange} />
        </Field>
        <Field label="Genre">
          <select name="genre" className="field" value={filters.genre} onChange={handleFilterChange}>
            <option value="">Tous les genres</option>
            {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Année">
          <input type="number" inputMode="numeric" name="year" min="1900" max="2100" placeholder="ex. 2020" className="field" value={filters.year} onChange={handleFilterChange} />
        </Field>
        <Field label="Note minimale (0-10)">
          <input type="number" inputMode="decimal" name="minRating" min="0" max="10" step="0.5" placeholder="ex. 7" className="field" value={filters.minRating} onChange={handleFilterChange} />
        </Field>
        <Field label="Langue originale">
          <select name="originalLanguage" className="field" value={filters.originalLanguage} onChange={handleFilterChange}>
            <option value="">Toutes</option>
            {Object.entries(ORIGINAL_LANGS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </Field>
        <Field label="Durée max (min)">
          <input type="number" inputMode="numeric" name="maxDuration" min="0" max="1000" placeholder="ex. 120" className="field" value={filters.maxDuration} onChange={handleFilterChange} />
        </Field>
        <Field label="Trier par">
          <select name="sort" className="field" value={filters.sort} onChange={handleFilterChange}>
            {Object.entries(SORTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-3 self-end pb-2 text-sm text-zinc-300">
          <input type="checkbox" name="onlyMine" className="h-5 w-5 accent-brand-500" checked={filters.onlyMine} disabled={settings.providers.length === 0} onChange={handleFilterChange} />
          Sur mes plateformes
        </label>
      </form>

      {loading && results.length === 0 ? (
        <GridSkeleton />
      ) : error && results.length === 0 ? (
        <ErrorState message="Les filtres sont invalides ou TMDB est indisponible." onRetry={() => fetchPage(1)} />
      ) : results.length === 0 ? (
        <EmptyState icon="🔎" title="Aucun résultat" text="Assouplis tes filtres pour élargir la recherche." />
      ) : (
        <>
          <MediaGrid>
            {results.map((item) => (
              <MediaCard
                key={item.id}
                to={`/${type}/${item.id}`}
                title={mediaTitle(item)}
                poster={posterUrl(item.poster_path)}
                subtitle={[type === "tv" ? "Série" : "Film", mediaYear(item)].filter(Boolean).join(" · ")}
                ratings={{ tmdb: item.vote_average, tmdbVotes: item.vote_count }}
              />
            ))}
          </MediaGrid>
          {loading && <div className="mt-6 flex justify-center text-brand-400" role="status" aria-label="Chargement"><Spinner className="h-7 w-7" /></div>}
          <InfiniteSentinel disabled={!hasMore || loading} onVisible={() => fetchPage(page + 1)} />
        </>
      )}
    </div>
  );
}

export default AdvancedSearch;
