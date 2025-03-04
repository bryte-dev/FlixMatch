import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function Junk() {
  const [movies, setMovies] = useState([]);

  // Récupère les films marqués comme "JUNK"
  useEffect(() => {
    const fetchJunk = async () => {
      try {
        const res = await axios.get("http://localhost:3000/junk", { withCredentials: true });
  
        console.log("✅ Données reçues (JUNK) :", res.data);
        if (Array.isArray(res.data)) {
          setMovies(res.data);
        } else {
          console.error("❌ Format inattendu :", res.data);
        }
  
      } catch (error) {
        console.error("❌ Erreur récupération films corbeille :", error.response?.data || error.message);
      }
    };
  
    fetchJunk();
  }, []);
  

  // Fonction pour restaurer un film (mettre son status à WATCHLIST)
  const restoreFromJunk = async (movieId) => {
    try {
      const response = await axios.put(`http://localhost:3000/junk/${movieId}/restore`);
      // Rafraîchir la liste en retirant le film restauré
      setMovies((prevMovies) => prevMovies.filter((entry) => entry.movie.id !== movieId));
    } catch (error) {
      console.error("Erreur lors du restore depuis la corbeille", error);
      alert(error.response?.data?.message || "Erreur serveur");
    }
  };

  return (
    <div className="p-4 pt-20">
      <h1 className="text-2xl font-bold mb-4 text-center">Ma Corbeille</h1>
      {movies.length === 0 ? (
        <p className="text-center">Aucun film dans la corbeille.</p>
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
              <button
                onClick={() => restoreFromJunk(entry.movie.id)}
                className="mt-2 bg-blue-500 hover:bg-blue-700 text-black px-4 py-2 rounded-lg w-full"
              >
                Restaurer dans la Watchlist
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Junk;
