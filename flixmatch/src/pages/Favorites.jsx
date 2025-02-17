import { useEffect, useState } from "react";
import axios from "axios";

function Favorites() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const res = await axios.get("http://localhost:3000/favorites", { withCredentials: true });

        console.log("✅ Données reçues :", res.data); // 🔥 Debug
        if (Array.isArray(res.data)) {
          setMovies(res.data);
        } else {
          console.error("❌ Format inattendu :", res.data);
        }

      } catch (error) {
        console.error("❌ Erreur récupération favoris :", error.response?.data || error.message);
      }
    };

    fetchFavorites();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">⭐ Mes Films Favoris</h1>
      {movies.length === 0 ? (
        <p className="text-center">Aucun film en favori.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {movies.map((entry) => (
            <div key={entry.movie.id} className="bg-gray-800 text-white p-4 rounded-lg">
              <img 
                src={`https://image.tmdb.org/t/p/w500${entry.movie.poster_path}`} 
                alt={entry.movie.title} 
                className="rounded-lg w-full"
              />
              <h2 className="text-lg font-bold mt-2 text-center">{entry.movie.title}</h2>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Favorites;
