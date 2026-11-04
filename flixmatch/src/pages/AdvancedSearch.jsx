import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { track } from "../lib/analytics";
import { API_URL } from "../api";
import { useSettings } from "../settings";
import { useT } from "%s";
import { usePro } from "../proContext";
import ProBadge from "../components/ProBadge";
import MediaCard from "../components/MediaCard";
import { EmptyState, ErrorState, GridSkeleton, InfiniteSentinel, MediaGrid, PageHeader, Spinner, Tabs } from "../components/ui";
import { mediaTitle, mediaYear, posterUrl } from "../utils";

const EMPTY_FILTERS = { query: "", genre: "", year: "", minRating: "", maxDuration: "", originalLanguage: "", sort: "popularity", onlyMine: false };

const ORIGINAL_LANGS = ["fr", "en", "es", "de", "it", "pt", "ja", "ko", "zh", "hi", "tr", "ru"];
const langName = (uiLang, code) => {
  try {
    return new Intl.DisplayNames([uiLang], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
};

const Field = ({ label, children }) => (
  <label className="block text-sm font-medium text-zinc-300">
    <span className="mb-1 block">{label}</span>
    {children}
  </label>
);

function AdvancedSearch() {
  const settings = useSettings();
  const t = useT();
  const { openPro } = usePro();
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

  const handleFilterChange = (e) => {
    if (e.target.name === "onlyMine" && e.target.checked) openPro("provider_filters", { source: "advanced_search" });
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  };

  const hasMore = page > 0 && page < totalPages && !error;

  return (
    <div className="page">
      <PageHeader title={t("advancedSearch")} subtitle={t("advSubtitle")} />

      <Tabs tabs={[["movie", t("movies")], ["tv", t("seriesPlural")]]} value={type} onChange={setType} label={t("titleTypeLabel")} />

      <form className="surface mb-8 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
        <Field label={t("titleLabel")}>
          <input type="search" name="query" placeholder={t("titleLabel")} className="field" value={filters.query} onChange={handleFilterChange} />
        </Field>
        <Field label={t("genre")}>
          <select name="genre" className="field" value={filters.genre} onChange={handleFilterChange}>
            <option value="">{t("allGenres")}</option>
            {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label={t("year")}>
          <input type="number" inputMode="numeric" name="year" min="1900" max="2100" placeholder={t("yearPh")} className="field" value={filters.year} onChange={handleFilterChange} />
        </Field>
        <Field label={t("minRating")}>
          <input type="number" inputMode="decimal" name="minRating" min="0" max="10" step="0.5" placeholder={t("ratingPh")} className="field" value={filters.minRating} onChange={handleFilterChange} />
        </Field>
        <Field label={t("originalLang")}>
          <select name="originalLanguage" className="field" value={filters.originalLanguage} onChange={handleFilterChange}>
            <option value="">{t("allFem")}</option>
            {ORIGINAL_LANGS.map((code) => <option key={code} value={code}>{langName(settings.uiLang, code)}</option>)}
          </select>
        </Field>
        <Field label={t("maxDuration")}>
          <input type="number" inputMode="numeric" name="maxDuration" min="0" max="1000" placeholder={t("durationPh")} className="field" value={filters.maxDuration} onChange={handleFilterChange} />
        </Field>
        <Field label={t("sortBy")}>
          <select name="sort" className="field" value={filters.sort} onChange={handleFilterChange}>
            {[["popularity", t("sortPopularity")], ["rating", t("sortRating")], ["date", t("sortDate")]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-3 self-end pb-2 text-sm text-zinc-300">
          <input type="checkbox" name="onlyMine" className="h-5 w-5 accent-brand-500" checked={filters.onlyMine} disabled={settings.providers.length === 0} onChange={handleFilterChange} />
          {t("onMyPlatforms")}
          <ProBadge feature="provider_filters" source="advanced_search" />
        </label>
      </form>

      {loading && results.length === 0 ? (
        <GridSkeleton />
      ) : error && results.length === 0 ? (
        <ErrorState message={t("advError")} onRetry={() => fetchPage(1)} />
      ) : results.length === 0 ? (
        <EmptyState icon="🔎" title={t("noResults")} text={t("advEmptyText")} />
      ) : (
        <>
          <MediaGrid>
            {results.map((item) => (
              <MediaCard
                key={item.id}
                to={`/${type}/${item.id}`}
                title={mediaTitle(item)}
                poster={posterUrl(item.poster_path)}
                subtitle={[type === "tv" ? t("tvShow") : t("movie"), mediaYear(item)].filter(Boolean).join(" · ")}
                ratings={{ tmdb: item.vote_average, tmdbVotes: item.vote_count }}
              />
            ))}
          </MediaGrid>
          {loading && <div className="mt-6 flex justify-center text-brand-400" role="status" aria-label={t("loading")}><Spinner className="h-7 w-7" /></div>}
          <InfiniteSentinel disabled={!hasMore || loading} onVisible={() => fetchPage(page + 1)} />
        </>
      )}
    </div>
  );
}

export default AdvancedSearch;
