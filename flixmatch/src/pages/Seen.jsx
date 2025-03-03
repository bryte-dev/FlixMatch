import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function Seen() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    const fetchSeen = async () => {
      try {
        const res = await axios.get("http://localhost:3000/seen", { withCredentials: true });
  
        console.log("✅ Données reçues (SEEN) :", res.data);
        if (Array.isArray(res.data)) {
          setMovies(res.data);
        } else {
          console.error("❌ Format inattendu :", res.data);
        }
  
      } catch (error) {
        console.error("❌ Erreur récupération films vus :", error.response?.data || error.message);
      }
    };
  
    fetchSeen();
  }, []);

  const removeFromSeen = async (movieId) => {
    try {
      await axios.put(`http://localhost:3000/seen/${movieId}/remove`, {}, { withCredentials: true });
  
      // 🔥 Supprime le film de la liste SEEN localement
      setMovies((prevMovies) => prevMovies.filter((movie) => movie.movie.id !== movieId));
  
    } catch (error) {
      console.error("❌ Erreur lors du retrait de SEEN :", error);
    }
  };
  
  const updateRating = async (movieId, rating) => {
    console.log(`🔍 Mise à jour du rating pour le film ${movieId} : ${rating}`);

    try {
      const response = await axios.put(`http://localhost:3000/seen/${movieId}/rating`, { rating });

      console.log("✅ Note mise à jour :", response.data);

      setMovies(prevMovies =>
        prevMovies.map(movie =>
          movie.movie.id === movieId ? { ...movie, rating } : movie
        )
      );
    } catch (error) {
      console.error("❌ Erreur lors de la mise à jour du rating", error);
    }
  };

  const updateReview = async (movieId, review) => {
    console.log(`🔍 Mise à jour de l'avis pour le film ${movieId}:`, review);

    try {
      const response = await axios.put(`http://localhost:3000/seen/${movieId}/review`, { review });

      setMovies(prevMovies =>
        prevMovies.map(movie =>
          movie.movie.id === movieId ? { ...movie, review } : movie
        )
      );
    } catch (error) {
      console.error("❌ Erreur lors de la mise à jour de l'avis", error);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Mes Films Déjà Regardés</h1>
      {movies.length === 0 ? (
        <p className="text-center">Aucun film vu.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {movies.map((entry) => (
            <div key={entry.movie.id} className="bg-gray-800 text-white p-4 rounded-lg">
              <Link to={`/${entry.movie.media_type}/${entry.movie.tmdb_id}`} className="bg-gray-800 text-white p-4 rounded-lg block hover:opacity-75"></Link>
              <img
                src={`https://image.tmdb.org/t/p/w500${entry.movie.poster_path}`}
                alt={entry.movie.title}
                className="rounded-lg w-full"
              />
              <h2 className="text-lg font-bold mt-2 text-center">{entry.movie.title}</h2>

              {/* Système de notation */}
              <div className="flex justify-center mt-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`text-2xl ${entry.rating >= star ? "text-yellow-500" : "text-gray-500"}`}
                    onClick={() => updateRating(entry.movie.id, star)}
                  >
                    ★
                  </button>
                ))}
              </div>
                
              <button
                  onClick={() => removeFromSeen(entry.movie.id)}
                  className="text-xl text-gray-500 hover:text-green-500 mx-auto block mt-2"
                >
                  Pas Vu
                </button>
              {/* Champ pour laisser un avis */}
              <textarea
                className="w-full mt-2 p-2 bg-gray-700 text-white rounded"
                placeholder="Laisse un avis..."
                value={entry.review || ""}
                onChange={(e) => updateReview(entry.movie.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Seen;
