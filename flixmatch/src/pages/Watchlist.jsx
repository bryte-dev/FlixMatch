import { useEffect, useState } from "react";
import axios from "axios";

function Watchlist() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:3000/watchlist")
      .then(res => {
        console.log("Watchlist récupérée :", res.data);
        setMovies(res.data);
      })
      .catch(err => console.error("Erreur lors du chargement de la watchlist :", err));
  }, []);

  const moveToJunk = async (movieId) => {
    try {
      // Send request to move the movie to the junk list
      await axios.put(`http://localhost:3000/watchlist/${movieId}/junk`);

      // Immediately update the UI to remove the movie from the watchlist
      setMovies((prevMovies) => prevMovies.filter((movie) => movie.movie.id !== movieId));
    } catch (error) {
      console.error("Erreur lors du déplacement vers la corbeille", error);
    }
  };

  const toggleFavorite = async (movieId, currentFavorite) => {
    try {
      const newFavoriteStatus = !currentFavorite;
      console.log(`Mise à jour du favori pour ${movieId} -> ${newFavoriteStatus}`);

      await axios.put(`http://localhost:3000/watchlist/${movieId}/favorite`, { isFavorite: newFavoriteStatus });

      setMovies((prevMovies) => 
        prevMovies.map((entry) => 
          entry.movie.id === movieId ? { ...entry, isFavorite: newFavoriteStatus, status: "WATCHLIST" } : entry
        )
      );
    } catch (error) {
      console.error("Erreur lors de la mise à jour des favoris :", error);
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
                  className="text-xl text-gray-500 hover:text-green-500 mx-auto block mt-2"
                >
                  👁️
                </button>
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
