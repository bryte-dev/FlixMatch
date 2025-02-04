import { useEffect, useState } from "react";
import axios from "axios";

const Home = () => {
  const [trendingData, setTrendingData] = useState([]);
  const [movies, setMovies] = useState([]); // Stocke les films de la BDD
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [watchlist, setWatchlist] = useState([]);
  const [junklist, setJunklist] = useState([]);

  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/trending/all/day?language=fr-CH&page=${page}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmYjQ0ZGM1ODRkMWU3YzYyZDA3MjAwNjIyZTUxZWMzMyIsIm5iZiI6MTczODA1MzkzMi42MTc5OTk4LCJzdWIiOiI2Nzk4OTkyYzNhZTM1NWM0Nzg4ZjViNzUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.4SkP12tF6GTnVC9rciojEakLBoEj94YtPRLdvokCYZA`, 
            },
          }
        );

        if (!response.ok) {
          throw new Error("Erreur de récupération des données");
        }

        const data = await response.json();

        if (data.results) {
          const shuffledResults = data.results.sort(() => 0.5 - Math.random());
          setTrendingData((prevData) => [...prevData, ...shuffledResults]);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [page]);

  // Fetch des films en base PostgreSQL
  useEffect(() => {
    axios.get("http://localhost:3000/")
      .then(res => setMovies(res.data))
      .catch(err => console.error(err));
  }, []);

  const handleScroll = () => {
    const bottom =
      window.innerHeight + document.documentElement.scrollTop ===
      document.documentElement.offsetHeight;
    if (bottom && !loading) {
      setPage((prevPage) => prevPage + 1);
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [loading]);

  const addToWatchlist = async (movie) => {
    try {
      const response = await axios.post("http://localhost:3000/watchlist", {
        tmdb_id: movie.id,
        title: movie.title || movie.name,
        media_type: movie.media_type,
        poster_path: movie.poster_path,  // On envoie l'affiche
      });
  
      alert(response.data.message);
    } catch (error) {
      console.error("Erreur lors de l'ajout à la watchlist", error);
      alert(error.response?.data?.message || "Erreur serveur");
    }
  };

  if (loading && page === 1) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Découvrir</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {trendingData.length === 0 ? (
          <div>Aucune donnée à afficher</div>
        ) : (
          trendingData.map((movie) => (
            <div key={movie.id} className="bg-gray-800 text-white p-4 rounded-lg">
              <img 
                src={`https://image.tmdb.org/t/p/w500/${movie.poster_path}`} 
                alt={movie.title} 
                className="rounded-lg w-full"
              />
              <h2 className="text-lg font-bold mt-2">{movie.title}</h2>
              <button
                onClick={() => addToWatchlist(movie)}
                className="mt-3 bg-blue-1000 text-black p-2 rounded-lg"
              >
              Ça m'intéresse !  
              </button>
            </div>
          ))
        )}
      </div>
      {loading && <div>Chargement des données...</div>}
    </div>
  );
};

export default Home;
