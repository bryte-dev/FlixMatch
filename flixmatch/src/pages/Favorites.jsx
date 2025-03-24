import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function Favorites() {
  const [movies, setMovies] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  useEffect(() => {
    fetchFavorites();
  }, [refreshTrigger]);

  const fetchFavorites = async () => {
    try {
      const res = await axios.get("http://localhost:3000/favorites", { withCredentials: true });
      setMovies(res.data);
    } catch (error) {
      console.error("❌ Erreur récupération favoris :", error);
    }
  };

  // 🔥 Supprimer un film des favoris
  const removeFromFavorites = async (movieId) => {
    try {
      await axios.put(`http://localhost:3000/watchlist/${movieId}/favorite`, { isFavorite: false }, { withCredentials: true });
      setRefreshTrigger((prev) => !prev);
    } catch (error) {
      console.error("❌ Erreur suppression des favoris :", error);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">⭐ Mes Films Favoris</h1>

      {movies.length === 0 ? (
        <p className="text-center">Aucun film en favori.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {movies.map((entry) => (
            <div key={entry.movie.id} className="bg-gray-800 text-white p-4 rounded-lg">

              {/* 🔥 Image cliquable avec effet hover */}
              <Link to={`/${entry.movie.media_type}/${entry.movie.tmdb_id}`} className="block hover:opacity-75">
                <img 
                  src={`https://image.tmdb.org/t/p/w500${entry.movie.poster_path}`} 
                  alt={entry.movie.title} 
                  className="rounded-lg w-full"
                />
                <h2 className="text-lg font-bold mt-2 text-center">{entry.movie.title}</h2>
              </Link>

              {/* ❌ Bouton "Retirer des favoris" sous l'affiche */}
              <button
                onClick={() => removeFromFavorites(entry.movie.id)}
                className="mt-2 bg-red-500 hover:bg-red-700 text-black px-4 py-2 rounded-lg w-full"
              >
                Retirer des favoris
              </button>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Favorites;
