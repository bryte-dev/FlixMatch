import { useEffect, useState } from "react";
import axios from "axios";

const Trending = () => {
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

  const addToWatchlist = (id) => {
    if (!watchlist.includes(id)) {
      setWatchlist([...watchlist, id]);
    }
  };

  const addToJunklist = (id) => {
    if (!junklist.includes(id)) {
      setJunklist([...junklist, id]);
    }
  };

  if (loading && page === 1) {
    return <div>Chargement...</div>;
  }

  return (
    <div>
      <h2>Tendances du moment</h2>
      <ul>
        {trendingData.length === 0 ? (
          <li>Aucune donnée à afficher</li>
        ) : (
          trendingData.map((item) => (
            <li key={item.id}>
              {item.title || item.name} - {item.media_type}
              <button onClick={() => addToWatchlist(item.id)}>Ajouter à Watchlist</button>
              <button onClick={() => addToJunklist(item.id)}>Ajouter à Junklist</button>
            </li>
          ))
        )}
      </ul>

      <h2>Films en Base</h2>
      <ul>
        {movies.length === 0 ? (
          <li>Aucun film en base</li>
        ) : (
          movies.map((movie) => (
            <li key={movie.id}>{movie.title}</li>
          ))
        )}
      </ul>

      {loading && <div>Chargement des données...</div>}
    </div>
  );
};

export default Trending;
