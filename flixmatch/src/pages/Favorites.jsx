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
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Mes Films Favoris</h1>
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

  