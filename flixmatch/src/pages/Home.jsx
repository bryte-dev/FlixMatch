import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function Home() {
  const [trendingData, setTrendingData] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [junklist, setJunklist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 🔥 Vérifier si l'utilisateur est connecté
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await axios.get("http://localhost:3000/me", { withCredentials: true });
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // 🔥 Charger la Watchlist & Junklist avant tout
  useEffect(() => {
    const fetchLists = async () => {
      try {
        const watchlistRes = await axios.get("http://localhost:3000/watchlist", { withCredentials: true });
        const junklistRes = await axios.get("http://localhost:3000/junk", { withCredentials: true });

        setWatchlist(watchlistRes.data);
        setJunklist(junklistRes.data);
      } catch (err) {
        console.error("Erreur récupération watchlist/junklist :", err);
      }
    };

    if (isAuthenticated) fetchLists();
  }, [isAuthenticated]);

  // 🔥 Charger les films tendances
  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/trending/all/day?language=fr-CH&page=${page}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_TMDB_API_KEY}`,
            },
          }
        );

        if (!response.ok) throw new Error("Erreur de récupération des données");

        const data = await response.json();
        if (data.results) {
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

  // 🔥 Filtrer les films déjà dans Watchlist ou Junklist
  const filteredTrendingData = trendingData.filter(
    (item) =>
      !watchlist.some((entry) => entry.movie.tmdb_id === item.id) &&
      !junklist.some((entry) => entry.movie.tmdb_id === item.id)
  );

  // 🔥 Ajouter un film à la Watchlist & le supprimer de la page
  const addToWatchlist = async (movie, event) => {
    event.stopPropagation(); // ⚠️ Empêche la navigation vers la page détails

    if (watchlist.some((entry) => entry.movie.tmdb_id === movie.id)) {
      alert("Ce film est déjà dans la watchlist !");
      return;
    }

    try {
      await axios.post("http://localhost:3000/watchlist", {
        tmdb_id: movie.id,
        title: movie.title || movie.name,
        media_type: movie.media_type,
        poster_path: movie.poster_path,
      });

      setWatchlist((prev) => [...prev, { movie }]); // Ajout direct en watchlist
      setTrendingData((prev) => prev.filter((item) => item.id !== movie.id)); // Suppression instantanée
    } catch (error) {
      console.error("Erreur lors de l'ajout à la watchlist", error);
      alert(error.response?.data?.message || "Erreur serveur");
    }
  };

  // 🔥 Infinite Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 50 && !loading) {
        setPage((prevPage) => prevPage + 1);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading]);

  return (
    <div className="p-4 pt-20">
      <h1 className="text-2xl font-bold mb-4 text-center">Tendances du moment</h1>

      {filteredTrendingData.length === 0 ? (
        <p className="text-center">Aucune donnée à afficher</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {filteredTrendingData.map((item) => (
            <div key={item.id} className="bg-gray-800 text-white p-4 rounded-lg relative">
              {/* Lien vers la page détails */}
              <Link to={`/${item.media_type}/${item.id}`} className="absolute inset-0 z-0"></Link>

              {/* Image du film */}
              <img
                src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "https://via.placeholder.com/500x750?text=Pas+d'image"}
                alt={item.title || item.name}
                className="rounded-lg w-full"
              />
              <h2 className="text-lg font-bold mt-2 text-center">{item.title || item.name}</h2>

              {/* Bouton Ajouter à la Watchlist */}
              {isAuthenticated && (
                <button
                  onClick={(event) => addToWatchlist(item, event)}
                  className="mt-2 bg-blue-500 hover:bg-blue-700 text-black px-4 py-2 rounded-lg w-full relative z-10"
                >
                  Ajouter à Watchlist
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && <div className="text-center mt-4">Chargement des données...</div>}
    </div>
  );
}

export default Home;
