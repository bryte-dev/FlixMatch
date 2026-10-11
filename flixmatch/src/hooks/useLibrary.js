import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../api";

// Charge une liste de l'utilisateur (/watchlist, /seen, /favorites, /junk)
export default function useLibrary(path) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    axios
      .get(`${API_URL}${path}`)
      .then((res) => active && setEntries(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error(`Erreur chargement ${path} :`, err);
        if (active) setError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const removeEntry = useCallback(
    (movieId) => setEntries((prev) => prev.filter((e) => e.movie.id !== movieId)),
    []
  );
  const patchEntry = useCallback(
    (movieId, patch) => setEntries((prev) => prev.map((e) => (e.movie.id === movieId ? { ...e, ...patch } : e))),
    []
  );

  return { entries, loading, error, reload, removeEntry, patchEntry };
}

// Nombre d'épisodes vus par série (tmdbSeriesId -> count)
export function useEpisodeCounts() {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    axios
      .get(`${API_URL}/episodes`)
      .then((res) => setCounts(Object.fromEntries(res.data.map((g) => [g.tmdbSeriesId, g.watchedCount]))))
      .catch(() => {});
  }, []);
  return counts;
}
