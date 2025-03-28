import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function AdvancedSearch() {
  const [genres, setGenres] = useState([]);
  const [filters, setFilters] = useState({
    query: "",
    genre: "",
    year: "",
    minRating: "",
    maxDuration: "",
  });
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL;
  

  // 🔥 Charger les genres depuis TMDB
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const res = await axios.get(`${API_URL}/tmdb/genres`);
        setGenres(res.data);
      } catch (error) {
        console.error("Erreur chargement genres :", error);
      }
    };
    fetchGenres();
  }, []);

  // 🔎 Requête TMDB selon les filtres
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/tmdb/advanced-search`, {
          params: { ...filters, page },
        });
        setResults(res.data.results || []);
      } catch (error) {
        console.error("Erreur recherche avancée :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [filters, page]);

  // 🛠️ Gérer les changements de filtres
  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen p-6">
      <h1 className="text-3xl font-bold text-center mb-6">🔎 Recherche Avancée</h1>

      {/* 🎛️ Filtres */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <input type="text" name="query" placeholder="Titre / Acteur / Réalisateur"
          className="p-2 rounded border-1 border-white text-white" value={filters.query} onChange={handleFilterChange} />

        <select name="genre" className="p-2 rounded border-1 border-white text-white" onChange={handleFilterChange}>
          <option value="">🎭 Genre</option>
          {genres.map((g) => <option className="text-black" key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <input type="number" name="year" placeholder="📅 Année" className="p-2 rounded border-1 border-white text-white"
          value={filters.year} onChange={handleFilterChange} />

        <input type="number" name="minRating" placeholder="⭐ Note Min (1-10)"
          className="p-2 border-1 border-white rounded text-white" value={filters.minRating} onChange={handleFilterChange} />

        <input type="number" name="maxDuration" placeholder="⏳ Durée Max (min)" className="p-2 rounded border-1 border-white text-white"
          value={filters.maxDuration} onChange={handleFilterChange} />
      </div>

      {/* 🔄 Chargement */}
      {loading && <p className="text-center text-white">⏳ Chargement des résultats...</p>}

      {/* 🎥 Résultats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {results.map((item) => (
          <Link  key={item.id} to={`/${item.media_type || "movie"}/${item.id}`} 
            className="bg-gray-800 text-white p-4 rounded-lg block hover:opacity-75">
            <img src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
              : "https://via.placeholder.com/500x750?text=Pas+d'image"} alt={item.title || item.name}
              className="rounded-lg w-full" />
            <h2 className="text-lg font-bold mt-2 text-center">{item.title || item.name}</h2>
          </Link>
        ))}
      </div>

      {/* 📜 Pagination */}
      <div className="flex justify-center mt-6">
        <button className="bg-blue-500 hover:bg-blue-700 px-4 py-2 text-black rounded mr-2"
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={page === 1}>⬅️ Précédent</button>

        <button className="bg-blue-500 hover:bg-blue-700 px-4 py-2 text-black rounded"
          onClick={() => setPage((prev) => prev + 1)}>Suivant ➡️</button>
      </div>
    </div>
  );
}

export default AdvancedSearch;
