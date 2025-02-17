import { useEffect, useState } from "react";
import axios from "axios";

function Home() {
  const [trendingData, setTrendingData] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [junklist, setJunklist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(false);


  // Récupérer les films tendances depuis TMDB
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
          // Filtrer les doublons
          const uniqueResults = [...new Map(data.results.map((item) => [item.id, item])).values()];
          setTrendingData((prevData) => [...new Map([...prevData, ...uniqueResults].map((item) => [item.id, item])).values()]);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [page]);

  // Récupérer la watchlist depuis le backend
  useEffect(() => {
    axios.get("http://localhost:3000/watchlist", { withCredentials: true })
      .then(res => setWatchlist(res.data))
      .catch(err => console.error("Erreur récupération watchlist :", err));
  }, []);
  
  // Récupérer la junklist depuis le backend
  useEffect(() => {
    axios.get("http://localhost:3000/junk", { withCredentials: true })
      .then(res => setWatchlist(res.data))
      .catch(err => console.error("Erreur récupération watchlist :", err));
  }, []);
  

  // Vérifie si un film est dans la Watchlist ou Junklist
  const isInWatchlist = (tmdb_id) => watchlist.some((entry) => entry.movie.tmdb_id === tmdb_id);
  const isInJunk = (tmdb_id) => junklist.some((entry) => entry.movie.tmdb_id === tmdb_id);

  // Filtrer les films pour ne pas afficher ceux déjà en Watchlist ou Junklist
  const filteredTrendingData = trendingData.filter((item) => !isInWatchlist(item.id) && !isInJunk(item.id));

  // Ajoute un film à la watchlist
  const addToWatchlist = async (movie) => {
    if (isInWatchlist(movie.id)) {
      alert("Ce film est déjà dans la watchlist !");
      return;
    }
    try {
      const response = await axios.post("http://localhost:3000/watchlist", {
        tmdb_id: movie.id,
        title: movie.title || movie.name,
        media_type: movie.media_type,
        poster_path: movie.poster_path,
      });
  
      setWatchlist((prev) => [...prev, { movie }]); // Ajout direct en watchlist
      setRefreshTrigger((prev) => !prev); // 🔥 Force le refresh
    } catch (error) {
      console.error("Erreur lors de l'ajout à la watchlist", error);
      alert(error.response?.data?.message || "Erreur serveur");
    }
  };
  

// Gestion de l'infinite scroll
const handleScroll = () => {
  if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 50 && !loading) {
    setPage((prevPage) => prevPage + 1);
  }
};

useEffect(() => {
  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
}, [loading]);

return (
  <div className="p-4">
    <h1 className="text-2xl font-bold mb-4 text-center">Tendances du moment</h1>

    {filteredTrendingData.length === 0 ? (
      <p className="text-center">Aucune donnée à afficher</p>
    ) : (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filteredTrendingData.map((item) => (
          <div key={item.id} className="bg-gray-800 text-white p-4 rounded-lg">
            <img
              src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "https://via.placeholder.com/500x750?text=Pas+d'image"}
              alt={item.title || item.name}
              className="rounded-lg w-full"
            />
            <h2 className="text-lg font-bold mt-2 text-center">{item.title || item.name}</h2>
            <button
              onClick={() => addToWatchlist(item)}
              className="mt-2 bg-blue-500 hover:bg-blue-700 text-black px-4 py-2 rounded-lg w-full"
            >
              Ajouter à Watchlist
            </button>
          </div>
        ))}
      </div>
    )}

    {loading && <div className="text-center mt-4">Chargement des données...</div>}
  </div>
);
}

export default Home;