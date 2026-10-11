const TMDB_IMG = "https://image.tmdb.org/t/p";

export const posterUrl = (path, size = "w500") => (path ? `${TMDB_IMG}/${size}${path}` : null);

export const mediaTitle = (item) => item?.title || item?.name || "Sans titre";

export const mediaYear = (item) => {
  const date = item?.release_date || item?.first_air_date;
  return date ? date.slice(0, 4) : "";
};

export const errorMessage = (error, fallback = "Une erreur est survenue") =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;

export const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
};
