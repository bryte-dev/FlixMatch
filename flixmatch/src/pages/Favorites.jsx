import { useEffect, useState } from "react";
import axios from "axios";

function Favorites() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:3000/favorites")
      .then(res => {
        console.log("Favoris récupérés :", res.data);
        setMovies(res.data);
      })
      .catch(err => console.error("Erreur lors du chargement des favoris :", err));
  }, []);
  

  const removeFromFavorites = async (movieId) => {
    try {
      await axios.put(`http://localhost:3000/favorites/${movieId}/remove`);
      
      // Mettre à jour l'état local : retirer des favoris
      setMovies((prevMovies) => prevMovies.filter((movie) => movie.movie.id !== movieId));
  
      alert("Film retiré des favoris et remis dans la Watchlist !");
    } catch (error) {
      console.error("Erreur lors du retrait des favoris", error);
    }
  };
  

  const updateRating = async (movieId, rating) => {
    console.log(`🔍 Tentative d'update du rating FAVORIS : movieId=${movieId}, rating=${rating}`);
  
    try {
      const response = await axios.put(`http://localhost:3000/favorites/${movieId}/rating`, { rating });
  
      console.log("✅ Réponse serveur :", response.data);
  
      setMovies((prevMovies) =>
        prevMovies.map((entry) =>
          entry.movie.id === movieId ? { ...entry, rating: rating } : entry
        )
      );
    } catch (error) {
      console.error("❌ Erreur lors de la mise à jour du rating FAVORIS :", error);
    }
  };
  

  const updateReview = async (movieId, review) => {
    try {
      await axios.put(`http://localhost:3000/favorites/${movieId}/review`, { review });
      setMovies((prevMovies) => prevMovies.map(movie => 
        movie.movie.id === movieId ? { ...movie, review } : movie
      ));
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'avis", error);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">⭐ Mes Films Favoris</h1>
      {movies.length === 0 ? (
        <p>Aucun film en favori.</p>
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

              {/* Champ pour laisser un avis */}
              <textarea 
                className="w-full mt-2 p-2 bg-gray-700 text-white rounded"
                placeholder="Laisse un avis..."
                value={entry.review || ""}
                onChange={(e) => updateReview(entry.movie.id, e.target.value)}
              />

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

  