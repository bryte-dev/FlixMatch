import { useEffect, useState } from "react";
import axios from "axios";

function Watchlist() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:3000/watchlist")
      .then(res => setMovies(res.data))
      .catch(err => console.error(err));
  }, []);

  const moveToJunk = async (movieId) => {
    try {
      await axios.put(`http://localhost:3000/watchlist/${movieId}/junk`);
      setMovies((prevMovies) => prevMovies.filter((movie) => movie.movie.id !== movieId));
    } catch (error) {
      console.error("Erreur lors du déplacement vers la corbeille", error);
    }
  };

  const toggleFavorite = async (movieId, currentFavorite) => {
    try {
      const newFavoriteStatus = !currentFavorite;
      await axios.put(`http://localhost:3000/watchlist/${movieId}/favorite`, { isFavorite: newFavoriteStatus });
  
      // 🔥 Correction : mise à jour propre de l'état
      setMovies((prevMovies) => 
        prevMovies.map((entry) => 
          entry.movie.id === movieId ? { ...entry, isFavorite: newFavoriteStatus } : entry
        )
      );
    } catch (error) {
      console.error("Erreur lors de la mise à jour des favoris", error);
    }
  };
  

  const markAsSeen = async (movieId) => {
    try {
      await axios.put(`http://localhost:3000/watchlist/${movieId}/seen`);
      setMovies((prevMovies) => prevMovies.map(movie =>
        movie.movie.id === movieId ? { ...movie, status: "SEEN" } : movie
      ));
    } catch (error) {
      console.error("Erreur lors du marquage comme vu", error);
    }
  };

  const updateRating = async (movieId, rating) => {
    try {
      await axios.put(`http://localhost:3000/watchlist/${movieId}/rating`, { rating });
      setMovies((prevMovies) => prevMovies.map(movie =>
        movie.movie.id === movieId ? { ...movie, rating } : movie
      ));
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la note", error);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Ma Watchlist</h1>
      {movies.length === 0 ? (
        <p className="text-center">Aucun film dans la watchlist.</p>
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

              {/* Bouton étoile pour favoris */}
              <button 
  onClick={() => toggleFavorite(entry.movie.id, entry.isFavorite)}
  className={`text-2xl block mx-auto transition-all duration-300 ${entry.isFavorite ? "text-yellow-500 scale-110" : "text-gray-500 hover:text-yellow-300"}`}
>
  ★
</button>


              {/* Bouton pour marquer comme vu */}
              {entry.status !== "SEEN" && (
                <button
                  onClick={() => markAsSeen(entry.movie.id)}
                  className="mt-2 bg-green-500 hover:bg-green-700 text-black px-4 py-2 rounded-lg w-full"
                >
                  Marquer comme vu
                </button>
              )}

              {/* Système de notation, visible uniquement si "SEEN" */}
              {entry.status === "SEEN" && (
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
              )}

              <button
                onClick={() => moveToJunk(entry.movie.id)}
                className="mt-2 bg-blue-500 hover:bg-blue-700 text-black px-4 py-2 rounded-lg w-full"
              >
                Mettre à la corbeille
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Watchlist;
