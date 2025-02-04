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
      const response = await axios.put(`http://localhost:3000/watchlist/${movieId}/junk`);
      alert(response.data.message);
  
      // Rafraîchir la liste des films après modification
      setMovies((prevMovies) => prevMovies.filter((movie) => movie.movie.id !== movieId));
    } catch (error) {
      console.error("Erreur lors du déplacement vers la corbeille", error);
      alert(error.response?.data?.message || "Erreur serveur");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Ma Watchlist</h1>
      {movies.length === 0 ? (
        <p>Aucun film dans la watchlist.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
{movies.map((entry) => (
  <div key={entry.movie.id} className="bg-gray-800 text-white p-4 rounded-lg">
    <img 
      src={`https://image.tmdb.org/t/p/w500${entry.movie.poster_path}`} 
      alt={entry.movie.title} 
      className="rounded-lg w-full"
    />
    <h2 className="text-lg font-bold mt-2">{entry.movie.title}</h2>
    <button
      onClick={() => moveToJunk(entry.movie.id)}
      className="mt-2 bg-red-500 text-white p-2 rounded-lg"
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

