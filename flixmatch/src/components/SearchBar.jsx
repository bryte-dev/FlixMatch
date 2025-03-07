import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (query.length > 2) {
      axios
        .get(`https://api.themoviedb.org/3/search/multi?query=${query}&language=fr-FR`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_TMDB_API_KEY}` },
        })
        .then((res) => {
          setResults(res.data.results.slice(0, 6)); // On limite les résultats
          setShowResults(true);
        })
        .catch((err) => console.error("Erreur recherche :", err));
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Rechercher un film, une série..."
        className="p-2 w-64 text-black rounded-lg focus:outline-none"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {showResults && (
        <div className="absolute top-10 left-0 bg-gray-800 w-64 rounded-lg shadow-lg">
          {results.map((item) => (
            <Link
              key={item.id}
              to={`/${item.media_type}/${item.id}`}
              className="block p-2 hover:bg-gray-700"
            >
              {item.title || item.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
