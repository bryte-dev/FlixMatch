import { ErrorState, GridSkeleton, PageHeader, EmptyState } from "./ui";

// Gabarit commun aux pages Watchlist / Favoris / Vus / Corbeille
export default function LibraryView({ title, subtitle, library, empty, children }) {
  const { entries, loading, error, reload } = library;
  return (
    <div className="page">
      <PageHeader title={title} subtitle={subtitle ?? (loading || error ? "" : `${entries.length} titre${entries.length > 1 ? "s" : ""}`)} />
      {loading ? (
        <GridSkeleton count={5} />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : entries.length === 0 ? (
        <EmptyState {...empty} />
      ) : (
        children
      )}
    </div>
  );
}
