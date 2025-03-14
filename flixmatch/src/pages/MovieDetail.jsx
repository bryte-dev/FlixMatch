import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";


function MovieDetail() {
  const { tmdbId, type } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  
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

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        console.log(`🔍 Requête envoyée à BACKEND: /tmdb/details/${tmdbId}/${type}`);
        const response = await axios.get(`http://localhost:3000/tmdb/details/${tmdbId}/${type}`);
        console.log("✅ Données reçues :", response.data); // Check ce qui arrive du backend
        setMovie(response.data);

        const recResponse = await axios.get(`http://localhost:3000/tmdb/recommendations/${tmdbId}/${type}`);
        setRecommendations(recResponse.data.results || []);

      
      } catch (error) {
        console.error("❌ Erreur récupération des détails du film :", error);
      } finally {
        setLoading(false);
      }

      
    };

    if (tmdbId && type) fetchMovieDetails();
  }, [tmdbId, type, refreshTrigger]);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await axios.get(`http://localhost:3000/reviews/${tmdbId}`);
        console.log("✅ Avis récupérés :", res.data); // 🔍 Debug
        setReviews(res.data.reviews);
        setAverageRating(res.data.averageRating);
      } catch (error) {
        console.error("❌ Erreur récupération avis :", error);
      }
    };
  
    fetchReviews();
  }, [tmdbId]);

  if (loading) return <div className="text-center text-white p-10">⏳ Chargement...</div>;
  if (!movie) return <div className="text-center text-white p-10">❌ Aucune information disponible</div>;

  const getProviderLink = (provider, movie) => {
    const baseUrls = {
      "Netflix": `https://www.netflix.com/search?q=${encodeURIComponent(movie.title || movie.name)}`,
      "Disney+": `https://www.disneyplus.com/search?q=${encodeURIComponent(movie.title || movie.name)}`,
      "Amazon Prime Video": `https://www.amazon.com/s?k=${encodeURIComponent(movie.title || movie.name)}&i=instant-video`,
      "Apple TV": `https://tv.apple.com/search?q=${encodeURIComponent(movie.title || movie.name)}`,
      "Canal+": `https://www.canalplus.com/recherche?q=${encodeURIComponent(movie.title || movie.name)}`,
      "Crunchyroll": `https://www.crunchyroll.com/search?q=${encodeURIComponent(movie.title || movie.name)}`,
      "ADN": `https://animationdigitalnetwork.fr/search?q=${encodeURIComponent(movie.title || movie.name)}`,
      "HBO Max": `https://www.hbomax.com/search?q=${encodeURIComponent(movie.title || movie.name)}`
    };
  
    return provider.link || baseUrls[provider.provider_name] || `https://www.google.com/search?q=${encodeURIComponent(movie.title || movie.name)}+streaming`;
  };

  const addToWatchlist = async (movie) => {
    try {
      await axios.post("http://localhost:3000/watchlist", {
        tmdb_id: movie.id,
        title: movie.title || movie.name,
        media_type: movie.media_type || type,
        poster_path: movie.poster_path,
      }, { withCredentials: true });
  
      alert(`${movie.title || movie.name} ajouté à la Watchlist!`);
    } catch (error) {
      console.error("Erreur lors de l'ajout à la watchlist", error);
      alert("Impossible d'ajouter ce film à la watchlist.");
    }
  };
  


  return (
    <div className="bg-gray-900 text-white min-h-screen p-6 pt-20">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
        {/* 🖼️ Affiche */}
        <div className="md:col-span-1">
          <img
            src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "https://via.placeholder.com/500x750?text=Image+indisponible"}
            alt={movie.title || movie.name}
            className="rounded-lg w-full shadow-lg"
          />
              <div className="flex justify-between items-center mt-4">
              {isAuthenticated && (
              <button
        onClick={() => addToWatchlist(movie)}
        className="bg-blue-600 hover:bg-blue-700 text-black w-100 px-3 py-1 rounded-lg text-sm font-medium transition"
      >
        Ajouter à la Watchlist
      </button>
              )}
    </div>
        </div>


        {/* 🎥 Infos principales */}
        <div className="md:col-span-2 space-y-4">
          <h1 className="text-4xl font-bold">{movie.title || movie.name}</h1>
          <p className="text-gray-400 italic">{movie.tagline || "Aucune tagline"}</p>
          <p className="mt-2 text-gray-300">{movie.overview || "Aucun synopsis disponible"}</p>
          
          {/* 📊 Détails */}
          <div className="grid grid-cols-2 gap-4 text-gray-300">
            <p><strong>⭐ IMDb :</strong> {movie.vote_average ? movie.vote_average.toFixed(1) + "/10" : "N/A"}</p>
            {movie.flixmatchRating && (
              <p className="mt-2 text-lg font-semibold">
                ⭐ Note FlixMatch : {movie.flixmatchRating}/5 ({movie.reviews.length} avis)
              </p>
            )}
            <p><strong>⏳ Durée :</strong> {movie.runtime ? movie.runtime + " min" : "Variable"}</p>

          {/* 🎬 Budget et Recette - UNIQUEMENT pour les films */}
            {type === "movie" && (
            <>
              <p><strong>💰 Budget :</strong> {movie.budget ? movie.budget.toLocaleString() + " $" : "Inconnu"}</p>
              <p><strong>🎬 Recette :</strong> {movie.revenue ? movie.revenue.toLocaleString() + " $" : "Inconnu"}</p>
            </>
            )}

          {/* 🎥 Réalisateur pour un FILM - Creator pour une SÉRIE */}
          <p>
            <strong>{type === "movie" ? "🎥 Réalisateur" : "🎥 Créateur(s)"} : </strong>  
              {type === "movie"
                ? movie.credits?.crew.filter(person => person.job === "Director").map(director => director.name).join(", ") || "Inconnu"
                : movie.created_by?.map(creator => creator.name).join(", ") || "Inconnu"}
          </p>
          <p><strong>
    📅 Année de sortie : </strong>{new Date(movie.release_date || movie.first_air_date).getFullYear()}

          </p>
        </div>

          {/* 📌 Genres */}
          <p className="mt-2"><strong>📌 Genres :</strong> {movie.genres?.map(g => g.name).join(", ") || "Inconnu"}</p>

   {/* 📺 Où regarder */}
{movie["watch/providers"]?.results?.FR?.flatrate ? (
  <div className="mt-4">
    <h2 className="text-xl font-semibold">📺 Où regarder :</h2>
    <div className="flex space-x-4 mt-2">
      {movie["watch/providers"].results.FR.flatrate.map(provider => (
        <a 
          key={provider.provider_id} 
          href={getProviderLink(provider, movie)}
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center"
        >
          <img 
            src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} 
            alt={provider.provider_name} 
            className="w-16 h-16 rounded-lg shadow-md hover:scale-105 transition"
          />
          <p className="text-sm text-center text-gray-300">{provider.provider_name}</p>
        </a>
      ))}
    </div>
  </div>
) : (
  <div className="mt-4">
    <h2 className="text-xl font-semibold">📺 Où regarder :</h2>
    <a 
      href={`https://www.google.com/search?q=${encodeURIComponent(movie.title || movie.name)} streaming`}
      target="_blank" 
      rel="noopener noreferrer"
      className="text-blue-400 hover:underline block"
    >
      🔍 Rechercher sur Google
    </a>
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
              <img src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : "https://via.placeholder.com/185x185?text=?"} alt={actor.name} className="w-28 h-auto rounded-full shadow-md hover:scale-110 transition" />
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

{/* 🔥 Recommandations avec Swiper */}
{recommendations.length > 0 && (
  <div className="mt-10 max-w-5xl mx-auto">
    <h2 className="text-2xl font-semibold mb-4">🎯 Recommandations :</h2>
    <Swiper
      spaceBetween={10}
      slidesPerView={2}
      navigation={true}
      modules={[Navigation]}
      breakpoints={{
        640: { slidesPerView: 2 },
        768: { slidesPerView: 3 },
        1024: { slidesPerView: 4 },
      }}
      className="mySwiper"
    >
      {recommendations.map((rec) => (
        <SwiperSlide key={rec.id}>
          <div className="bg-gray-800 text-white p-4 rounded-lg">
            <Link to={`/${rec.media_type || type}/${rec.id}`} className="block hover:opacity-75">
              <img
                src={rec.poster_path ? `https://image.tmdb.org/t/p/w500${rec.poster_path}` : "https://via.placeholder.com/500x750?text=Image+indisponible"}
                alt={rec.title || rec.name}
                className="rounded-lg w-full"
              />
              <h3 className="text-lg font-bold mt-2 text-center">{rec.title || rec.name}</h3>
            </Link>

            {isAuthenticated && (
            <button
              onClick={() => addToWatchlist(rec)}
              className="mt-2 bg-blue-500 hover:bg-blue-700 text-black px-4 py-2 rounded-lg w-full"
            >
              Ajouter à Watchlist
            </button>
            )}
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  </div>
)}
{/* 📝 Section des Avis */}
{movie.reviews.length > 0 ? (
  <div className="mt-6">
    <h2 className="text-xl font-semibold">📝 Avis des utilisateurs :</h2>
    <div className="mt-3 space-y-4">
      {movie.reviews.map((review) => (
        <div key={review.id} className="bg-gray-800 p-4 rounded-lg">
          <p className="text-sm text-gray-300">
            <strong>{review.user.email}</strong> - ⭐ {review.rating}/5
          </p>
          <p className="mt-1">{review.comment}</p>
        </div>
      ))}
    </div>
  </div>
) : (
  <p className="mt-6 text-gray-400">Aucun avis pour l'instant.</p>
)}
 <div className="mt-6">
          <h2 className="text-xl font-semibold">📝 Avis des utilisateurs :</h2>
          <div className="mt-3 space-y-4">
            {reviews.count > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-300">
                    <strong>{review.user.email}</strong> - ⭐ {review.rating}/5
                  </p>
                  <p className="mt-1">{review.comment}</p>

                  {/* 🔄 Affichage des réponses aux avis */}
                  {review.replies.length > 0 && (
                    <div className="mt-3 bg-gray-700 p-3 rounded-lg">
                      <h3 className="text-sm font-semibold">💬 Réponses :</h3>
                      {review.replies.map((reply) => (
                        <p key={reply.id} className="text-gray-300 mt-1 text-sm">
                          <strong>{reply.user.email}</strong> : {reply.comment}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* 📩 Formulaire de réponse */}
                  {isAuthenticated && (
                    <div className="mt-3">
                      <textarea
                        value={replyInputs[review.id] || ""}
                        onChange={(e) => setReplyInputs((prev) => ({ ...prev, [review.id]: e.target.value }))}
                        className="w-full p-2 rounded bg-gray-600 text-white"
                        rows="2"
                        placeholder="Répondre à cet avis..."
                      />
                      <button
                        onClick={() => submitReply(review.id)}
                        className="mt-2 bg-blue-500 hover:bg-blue-700 text-black px-4 py-2 rounded-lg w-full"
                      >
                        Envoyer la réponse 🚀
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="mt-6 text-gray-400">Aucun avis pour l'instant.</p>
            )}
          </div>
        </div>

      {/* 🔙 Bouton retour */}
      <div className="mt-10 max-w-5xl mx-auto text-center">
        <a href="/" className="bg-blue-500 hover:bg-blue-700 px-6 py-3 rounded-lg text-black font-semibold shadow-md transition">🔙 Retour à l'accueil</a>
      </div>
    </div>
  );
}

export default MovieDetail;
