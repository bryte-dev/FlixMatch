import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function Seen() {
  const [movies, setMovies] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [reviews, setReviews] = useState({});
  const [ratings, setRatings] = useState({});

  // 🔥 Charger la liste des films vus
  useEffect(() => {
    const fetchSeenMovies = async () => {
      try {
        const res = await axios.get(`${process.env.VITE_API_URL}/seen`, { withCredentials: true });
        setMovies(res.data);
      } catch (error) {
        console.error("❌ Erreur récupération films vus :", error);
      }
    };

    fetchSeenMovies();
  }, [refreshTrigger]);

  // 🔥 Soumettre un avis pour un film spécifique
  const submitReview = async (movieId) => {
    if (!reviews[movieId]) {
      alert("Écris un avis avant de poster !");
      return;
    }

    try {
      await axios.post(
        `${process.env.VITE_API_URL}/reviews/${movieId}`,
        { rating: ratings[movieId] || 3, comment: reviews[movieId] },
        { withCredentials: true }
      );

      alert("Avis posté !");
      setReviews((prev) => ({ ...prev, [movieId]: "" }));
      setRatings((prev) => ({ ...prev, [movieId]: 3 }));
      setRefreshTrigger((prev) => !prev);
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi de l'avis :", error);
      alert("Impossible de poster l'avis !");
    }
  };

  // 🔄 Remettre un film en Watchlist
  const restoreToWatchlist = async (movieId) => {
    try {
      await axios.put(`${process.env.VITE_API_URL}/seen/${movieId}/remove`, {}, { withCredentials: true });
      alert("Film remis dans la Watchlist !");
      setRefreshTrigger((prev) => !prev);
    } catch (error) {
      console.error("❌ Erreur lors du retour en Watchlist :", error);
      alert("Impossible de remettre ce film en Watchlist.");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">📽️ Films vus</h1>

      {movies.length === 0 ? (
        <p className="text-center">Aucun film marqué comme vu.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {movies.map((entry) => (
            <div key={entry.movie.id} className="bg-gray-800 text-white p-4 rounded-lg">
              <Link to={`/${entry.movie.media_type}/${entry.movie.tmdb_id}`} className="block hover:opacity-75">
                <img
                  src={`https://image.tmdb.org/t/p/w500${entry.movie.poster_path}`}
                  alt={entry.movie.title}
                  className="rounded-lg w-full"
                />
                <h2 className="text-lg font-bold mt-2 text-center">{entry.movie.title}</h2>
              </Link>

              <p className="text-center text-gray-400 mt-2">⭐ Note : {entry.rating || "Non noté"}</p>

              {/* 🔥 Formulaire d'avis */}
              <div className="mt-4 p-2 bg-gray-700 rounded-lg">
                <h3 className="text-md font-semibold text-center mb-2">Donne ton avis</h3>

                {/* ⭐ Sélection des étoiles (effet visuel) */}
                <div className="flex justify-center space-x-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className={`text-2xl ${
                        star <= (ratings[entry.movie.id] || 3) ? "text-yellow-400" : "text-gray-500"
                      } transition-transform transform hover:scale-110`}
                      onClick={() => setRatings((prev) => ({ ...prev, [entry.movie.id]: star }))}
                    >
                      {star <= (ratings[entry.movie.id] || 3) ? "★" : "☆"}
                    </button>
                  ))}
                </div>

                {/* 📝 Zone de texte pour l'avis */}
                <textarea
                  value={reviews[entry.movie.id] || ""}
                  onChange={(e) =>
                    setReviews((prev) => ({ ...prev, [entry.movie.id]: e.target.value }))
                  }
                  className="w-full p-2 rounded bg-gray-600 text-white"
                  rows="2"
                  placeholder="Écris ton avis ici..."
                />

                {/* 🚀 Bouton d'envoi */}
                <button
                  onClick={() => submitReview(entry.movie.id)}
                  className="mt-2 bg-blue-500 hover:bg-blue-700 text-black px-4 py-2 rounded-lg w-full"
                >
                  Poster l'avis
                </button>
              </div>

              {/* 🔄 Bouton pour remettre en Watchlist */}
              <button
                onClick={() => restoreToWatchlist(entry.movie.id)}
                className="mt-2 bg-yellow-500 hover:bg-yellow-700 text-black px-4 py-2 rounded-lg w-full"
              >
                Remettre en Watchlist
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Seen;
