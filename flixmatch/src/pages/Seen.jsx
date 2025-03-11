import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function Seen() {
  const [movies, setMovies] = useState([]);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(3);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  
  // 🔥 Récupérer la liste des films vus
  useEffect(() => {
    const fetchSeenMovies = async () => {
      try {
        const res = await axios.get("http://localhost:3000/seen", { withCredentials: true });
        setMovies(res.data);
      } catch (error) {
        console.error("❌ Erreur récupération films vus :", error);
      }
    };

    fetchSeenMovies();
  }, [refreshTrigger]);

  // 🔥 Soumettre un avis
  const submitReview = async (e) => {
    e.preventDefault();
    if (!selectedMovie) {
      alert("Sélectionne un film avant de poster un avis !");
      return;
    }

    try {
      await axios.post(
        `http://localhost:3000/reviews/${selectedMovie}`,
        { rating, comment },
        { withCredentials: true }
      );

      alert("Avis posté !");
      setComment("");
      setRating(3);
      setSelectedMovie(null);
      setRefreshTrigger((prev) => !prev); // 🔄 Refresh les avis
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi de l'avis :", error);
      alert("Impossible de poster l'avis !");
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
            </div>
          ))}
        </div>
      )}

      {/* 🌟 Formulaire d'Avis */}
      {movies.length > 0 && (
        <div className="mt-8 p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl font-semibold text-center mb-4">📝 Laisser un avis</h2>

          <form onSubmit={submitReview} className="space-y-4">
            {/* Sélection du film */}
            <select
              className="w-full p-2 rounded bg-gray-700 text-white"
              value={selectedMovie || ""}
              onChange={(e) => setSelectedMovie(e.target.value)}
            >
              <option value="">Sélectionne un film</option>
              {movies.map((entry) => (
                <option key={entry.movie.id} value={entry.movie.id}>
                  {entry.movie.title}
                </option>
              ))}
            </select>

            {/* Note */}
            <label className="block text-white">⭐ Note (1-5) :</label>
            <input
              type="number"
              min="1"
              max="5"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="w-full p-2 rounded bg-gray-700 text-white"
            />

            {/* Commentaire */}
            <label className="block text-white">💬 Commentaire :</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-2 rounded bg-gray-700 text-white"
              rows="4"
              placeholder="Écris ton avis ici..."
            />

            {/* Bouton d'envoi */}
            <button type="submit" className="w-full bg-blue-500 hover:bg-blue-700 text-black px-4 py-2 rounded-lg">
              Envoyer l'avis 🚀
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Seen;