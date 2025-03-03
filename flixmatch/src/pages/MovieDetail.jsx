import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

function MovieDetail() {
  const { tmdbId, type } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        console.log(`🔍 Requête envoyée à BACKEND: /tmdb/details/${tmdbId}/${type}`);
        const response = await axios.get(`http://localhost:3000/tmdb/details/${tmdbId}/${type}`);
        console.log("✅ Données reçues :", response.data); // Check ce qui arrive du backend
        setMovie(response.data);
      } catch (error) {
        console.error("❌ Erreur récupération des détails du film :", error);
      } finally {
        setLoading(false);
      }
    };

    if (tmdbId && type) fetchMovieDetails();
  }, [tmdbId, type]);

  if (loading) return <div className="text-center text-white p-10">⏳ Chargement...</div>;
  if (!movie) return <div className="text-center text-white p-10">❌ Aucune information disponible</div>;

  // 🛠️ Vérifie si l'API TMDB a des fournisseurs pour la France (ou autre)
const watchProviders = movie["watch/providers"]?.results?.FR || movie["watch/providers"]?.results?.US || null;

  const getDirectWatchLink = () => {
    if (watchProviders?.link) {
      return watchProviders.link; // 🔗 Lien officiel vers la page du film/série
    }
    return null;
};





  return (
    <div className="bg-gray-900 text-white min-h-screen p-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
        {/* 🖼️ Affiche */}
        <div className="md:col-span-1">
          <img
            src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "https://via.placeholder.com/500x750?text=Image+indisponible"}
            alt={movie.title || movie.name}
            className="rounded-lg w-full shadow-lg"
          />
        </div>

        {/* 🎥 Infos principales */}
        <div className="md:col-span-2 space-y-4">
          <h1 className="text-4xl font-bold">{movie.title || movie.name} ({new Date(movie.release_date || movie.first_air_date).getFullYear()})</h1>
          <p className="text-gray-400 italic">{movie.tagline || "Aucune tagline"}</p>
          <p className="mt-2 text-gray-300">{movie.overview || "Aucun synopsis disponible"}</p>
          
          {/* 📊 Détails */}
          <div className="grid grid-cols-2 gap-4 text-gray-300">
            <p><strong>⭐ IMDb :</strong> {movie.vote_average ? movie.vote_average.toFixed(1) + "/10" : "N/A"}</p>
            <p><strong>⏳ Durée :</strong> {movie.runtime ? movie.runtime + " min" : "Variable"}</p>
            <p><strong>💰 Budget :</strong> {movie.budget ? movie.budget.toLocaleString() + " $" : "Inconnu"}</p>
            <p><strong>🎬 Recette :</strong> {movie.revenue ? movie.revenue.toLocaleString() + " $" : "Inconnu"}</p>
          </div>

          {/* 📌 Genres */}
          <p className="mt-2"><strong>📌 Genres :</strong> {movie.genres?.map(g => g.name).join(", ") || "Inconnu"}</p>

          {/* 📺 Où regarder */}
          {watchProviders && (
  <div className="mt-4">
    <h2 className="text-xl font-semibold">📺 Où regarder :</h2>

    {/* 🔗 Lien principal vers la plateforme (si fourni par TMDB) */}
    {getDirectWatchLink() && (
      <a 
        href={getDirectWatchLink()} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block bg-blue-500 text-white text-center p-2 rounded-lg mt-2 hover:bg-blue-700 transition"
      >
        🔗 Voir sur la plateforme officielle
      </a>
    )}

    {/* 🎞️ Liste des plateformes (ex: Netflix, Disney+, etc.) */}
    {watchProviders.flatrate?.length > 0 && (
      <div className="flex space-x-4 mt-2">
        {watchProviders.flatrate.map(provider => (
          <a 
            key={provider.provider_id} 
            href={getDirectWatchLink()} // 🔗 Utilise le lien principal
            target="_blank" 
            rel="noopener noreferrer"
          >
            <img 
              src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} 
              alt={provider.provider_name} 
              className="w-16 h-16 rounded-lg shadow-md hover:scale-105 transition"
            />
          </a>
        ))}
      </div>
    )}
  </div>
)}
        </div>
      </div>

      {/* 🎭 Casting - FIXÉ POUR ÉVITER LES SCROLLBARS */}
      <div className="mt-10 max-w-5xl mx-auto">
        <h2 className="text-2xl font-semibold">🎭 Acteurs principaux :</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-3">
          {movie.credits?.cast.slice(0, 10).map(actor => (
            <a key={actor.id} href={`https://www.google.com/search?q=${actor.name}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center">
              <img src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : "https://via.placeholder.com/185x185?text=?"} alt={actor.name} className="w-28 h-28 rounded-full shadow-md hover:scale-110 transition" />
              <p className="text-sm text-blue-400 mt-2 text-center">{actor.name}</p>
            </a>
          ))}
        </div>
      </div>

      {/* 🎥 Bandes-annonces & vidéos */}
      {movie.videos?.results.length > 0 && (
        <div className="mt-10 max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold">🎥 Bandes-annonces & Extraits :</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {movie.videos.results
              .filter(video => ["Trailer", "Teaser", "Clip"].includes(video.type))
              .slice(0, 4)
              .map(video => (
                <iframe
                  key={video.id}
                  width="100%"
                  height="250"
                  src={`https://www.youtube.com/embed/${video.key}`}
                  title={video.name}
                  allowFullScreen
                  className="rounded-lg shadow-lg"
                ></iframe>
              ))}
          </div>
        </div>
      )}

      {/* 🖼️ Galerie d'images */}
      {movie.images?.backdrops.length > 0 && (
        <div className="mt-10 max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold">🖼️ Galerie :</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {movie.images.backdrops.slice(0, 6).map((img, index) => (
              <img key={index} src={`https://image.tmdb.org/t/p/w500${img.file_path}`} alt="Image du film" className="rounded-lg shadow-md hover:scale-105 transition" />
            ))}
          </div>
        </div>
      )}

      {/* 🔙 Bouton retour */}
      <div className="mt-10 max-w-5xl mx-auto text-center">
        <a href="/" className="bg-blue-500 hover:bg-blue-700 px-6 py-3 rounded-lg text-black font-semibold shadow-md transition">🔙 Retour à l'accueil</a>
      </div>
    </div>
  );
}

export default MovieDetail;
