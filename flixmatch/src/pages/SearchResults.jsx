import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";

const SearchResults = () => {
    console.log("🔍 Query reçu dans SearchResults :", query);
  const { query } = useParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchResults = async () => {
      try {
        console.log("📡 Envoi de la requête à :", `${API_URL}/tmdb/search/${query}`);
        const response = await axios.get(`${API_URL}/tmdb/search/${query}`);
        console.log("✅ Résultats reçus :", response.data);
        setResults(response.data);
        console.log("🆕 Nouveaux résultats dans le state :", results); // 🔥 Test si l’état change
      } catch (error) {
        console.error("❌ Erreur lors de la recherche :", error);
      }
    };
  
    if (query) fetchResults();
  }, [query]);
  
  

  if (loading) return <div className="text-center text-white p-10">⏳ Chargement...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">🔎 Résultats de recherche</h1>
  
      {results.length === 0 ? (
        <p className="text-center">Aucun résultat trouvé.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {results.map((item) => (
            <div key={item.id} className="bg-gray-800 text-white p-4 rounded-lg">
              <img
                src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "https://via.placeholder.com/500x750?text=Pas+d'image" }
                alt={item.title || item.name}
                className="rounded-lg w-full"
              />
              <h2 className="text-lg font-bold mt-2 text-center">{item.title || item.name}</h2>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
