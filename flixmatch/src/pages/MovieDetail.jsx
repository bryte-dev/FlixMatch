import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Grid, 
  Button, 
  Chip, 
  Avatar, 
  CircularProgress,
  Rating,
  TextField,
  Divider
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import StarIcon from '@mui/icons-material/Star';
import SendIcon from '@mui/icons-material/Send';


function MovieDetail() {
  const { tmdbId, type } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [hasSeen, setHasSeen] = useState(false);
  const [replies, setReplies] = useState({});
  const [replyCursors, setReplyCursors] = useState({});
  const [loadingReplies, setLoadingReplies] = useState({});


  
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
        console.log("✅ Avis récupérés :", res.data); // Debug
  
        if (res.data && Array.isArray(res.data.reviews)) {
          setReviews(res.data.reviews); // 🛠️ On met reviews.reviews !
          setAverageRating(res.data.avgRating);
        } else {
          console.error("❌ Erreur : reviews n'est pas un tableau :", res.data);
        }
      } catch (error) {
        console.error("❌ Erreur récupération avis :", error);
      }
    };
  
    fetchReviews();
  }, [tmdbId, refreshTrigger]);

  useEffect(() => {
    const fetchAllReplies = async () => {
      try {
        const repliesMap = {}; // Stocker les réponses par reviewId
        for (const review of reviews) {
          if (!review.parentId) {
            const res = await axios.get(`http://localhost:3000/reviews/${review.id}/replies`);
            repliesMap[review.id] = res.data.replies || [];
          }
        }
        setReplies(repliesMap);
      } catch (error) {
        console.error("❌ Erreur chargement des réponses :", error);
      }
    };
  
    if (reviews.length > 0) {
      fetchAllReplies();
    }
  }, [reviews]);
  
  
  
  useEffect(() => {
    const checkIfSeen = async () => {
      try {
        const res = await axios.get("http://localhost:3000/seen", { withCredentials: true });
        const seenMovies = res.data;
        console.log("🎥 Films vus récupérés :", seenMovies);
        const movieIsSeen = seenMovies.some((entry) => entry.movie.tmdb_id === Number(tmdbId));
        console.log(`🔍 Ce film (${tmdbId}) est-il dans les vus ?`, movieIsSeen);
        setHasSeen(movieIsSeen);
      } catch (error) {
        console.error("❌ Erreur vérification films vus :", error);
      }
    };
  
    if (isAuthenticated) {
      checkIfSeen();
    }
  }, [isAuthenticated, tmdbId]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress />
    </Box>
  );
  
  if (!movie) return (
    <Container sx={{ mt: 12, textAlign: 'center' }}>
      <Typography variant="h5">❌ Aucune information disponible</Typography>
    </Container>
  );

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
  

// 🔥 Poster une réponse
const submitReply = async (parentReviewId) => {
  if (!replyInputs[parentReviewId]) {
    alert("Écris une réponse avant de poster !");
    return;
  }

  try {
    const res = await axios.post(
      `http://localhost:3000/reviews`,
      {
        movieId: movie.id,
        comment: replyInputs[parentReviewId],
        parentId: parentReviewId,
      },
      { withCredentials: true }
    );

    const newReply = res.data.review;

    alert("Réponse postée !");

    setReplies((prev) => ({
      ...prev,
      [parentReviewId]: [...(prev[parentReviewId] || []), newReply], // 🔥 Ajoute proprement sans dupliquer
    }));

    setReplyInputs((prev) => ({ ...prev, [parentReviewId]: "" }));
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de la réponse :", error);
    alert("Impossible de poster la réponse !");
  }
};


const renderReplies = (reviewId, level = 0) => {
  const repliesList = replies[reviewId] || []; // 🔥 Évite undefined
  return (
    <Box sx={{ ml: level * 4, mt: 2 }}>
      {repliesList.map((reply) => (
        <Paper key={reply.id} sx={{ p: 3, mb: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            <strong>{reply.user?.email || "Utilisateur inconnu"}</strong>
          </Typography>
          <Typography variant="body1" sx={{ my: 1 }}>{reply.comment}</Typography>

          {/* 📩 Bouton pour afficher le formulaire de réponse */}
          {isAuthenticated && (
            <Box sx={{ mt: 2 }}>
              <Button
                size="small"
                onClick={() => setReplyInputs((prev) => ({ ...prev, [reply.id]: !prev[reply.id] }))}
                color="primary"
              >
                {replyInputs[reply.id] ? "Annuler" : "Répondre"}
              </Button>

              {replyInputs[reply.id] && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    value={replyInputs[reply.id] || ""}
                    onChange={(e) => setReplyInputs((prev) => ({ ...prev, [reply.id]: e.target.value }))}
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Répondre à ce commentaire..."
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  <Button
                    onClick={() => submitReply(reply.id)}
                    variant="contained"
                    color="primary"
                    endIcon={<SendIcon />}
                    fullWidth
                  >
                    Envoyer la réponse
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* 🔄 Affichage des sous-réponses */}
          {renderReplies(reply.id, level + 1)}
        </Paper>
      ))}
    </Box>
  );
};

  return (
    <Container maxWidth="lg" sx={{ mt: 12, mb: 8 }}>
      <Grid container spacing={4}>
        {/* 🖼️ Affiche */}
        <Grid item xs={12} md={4}>
          <Box sx={{ position: 'sticky', top: 100 }}>
            <img
              src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "/default-movie.png"}
              alt={movie.title || movie.name}
              style={{ width: '100%', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}
            />
            {isAuthenticated && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  onClick={() => addToWatchlist(movie)}
                  variant="contained"
                  color="primary"
                  startIcon={<BookmarkAddIcon />}
                  fullWidth
                  sx={{ mr: 1 }}
                >
                  Watchlist
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<FavoriteIcon />}
                  fullWidth
                  sx={{ ml: 1 }}
                >
                  Favoris
                </Button>
              </Box>
            )}
          </Box>
        </Grid>

        {/* 🎥 Infos principales */}
        <Grid item xs={12} md={8}>
          <Typography variant="h3" component="h1" gutterBottom>
            {movie.title || movie.name}
          </Typography>
          
          {movie.tagline && (
            <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontStyle: 'italic' }}>
              {movie.tagline}
            </Typography>
          )}
          
          {averageRating && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Rating 
                value={averageRating} 
                readOnly 
                precision={0.5}
                emptyIcon={<StarIcon style={{ opacity: 0.55 }} fontSize="inherit" />}
              />
              <Typography variant="body2" sx={{ ml: 1 }}>
                {averageRating.toFixed(1)}/5 ({reviews.length} avis)
              </Typography>
            </Box>
          )}

          <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {movie.genres?.map((genre) => (
              <Chip 
                key={genre.id} 
                label={genre.name} 
                variant="outlined" 
                size="small"
              />
            ))}
          </Box>

          <Typography variant="body1" paragraph>
            {movie.overview || "Aucune description disponible."}
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Date de sortie:</strong> {movie.release_date || movie.first_air_date || "Inconnue"}
            </Typography>
            {movie.runtime && (
              <Typography variant="subtitle1" gutterBottom>
                <strong>Durée:</strong> {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}min
              </Typography>
            )}
            {movie.vote_average && (
              <Typography variant="subtitle1" gutterBottom>
                <strong>Note TMDB:</strong> {movie.vote_average.toFixed(1)}/10
              </Typography>
            )}
          </Box>

          {/* 🔍 Où regarder */}
          {movie.watch_providers?.results?.FR && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>
                Où regarder
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {movie.watch_providers.results.FR.flatrate?.map((provider) => (
                  <a
                    key={provider.provider_id}
                    href={getProviderLink(provider, movie)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Avatar
                        src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                        alt={provider.provider_name}
                        sx={{ width: 50, height: 50, mb: 1 }}
                      />
                      <Typography variant="caption" align="center">
                        {provider.provider_name}
                      </Typography>
                    </Box>
                  </a>
                ))}
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(movie.title || movie.name)} streaming`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Button variant="outlined" size="small">
                    Rechercher sur Google
                  </Button>
                </a>
              </Box>
            </Box>
          )}

          {/* 👨‍👩‍👧‍👦 Casting */}
          {movie.credits?.cast && movie.credits.cast.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>
                Casting
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 2, pb: 2 }}>
                {movie.credits?.cast.slice(0, 10).map(actor => (
                  <a key={actor.id} href={`https://www.google.com/search?q=${actor.name}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 100 }}>
                      <Avatar
                        src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : "/default-actor.png"}
                        alt={actor.name}
                        sx={{ 
                          width: 80, 
                          height: 80, 
                          mb: 1,
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.1)' }
                        }}
                      />
                      <Typography variant="body2" color="primary" align="center" sx={{ 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {actor.name}
                      </Typography>
                    </Box>
                  </a>
                ))}
              </Box>
            </Box>
          )}

          {/* 🎬 Recommandations */}
          {recommendations.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>
                Recommandations
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 2, pb: 2 }}>
                {recommendations.map((rec) => (
                  <Link
                    key={rec.id}
                    to={`/${rec.media_type || type}/${rec.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Box sx={{ width: 150 }}>
                      <img
                        src={rec.poster_path ? `https://image.tmdb.org/t/p/w185${rec.poster_path}` : "/default-movie.png"}
                        alt={rec.title || rec.name}
                        style={{ 
                          width: '100%', 
                          borderRadius: 8,
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.05)' }
                        }}
                      />
                      <Typography variant="body2" color="text.primary" sx={{ mt: 1 }}>
                        {rec.title || rec.name}
                      </Typography>
                    </Box>
                  </Link>
                ))}
              </Box>
            </Box>
          )}

          {/* 💬 Avis et commentaires */}
          <Box sx={{ mt: 6 }}>
            <Typography variant="h5" gutterBottom>
              Avis et commentaires
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            {reviews.length > 0 ? (
              reviews.filter(r => !r.parentId).map((review) => (
                <Paper key={review.id} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1">
                      <strong>{review.user?.email || "Utilisateur inconnu"}</strong>
                    </Typography>
                    {review.rating && (
                      <Rating value={review.rating} readOnly size="small" />
                    )}
                  </Box>
                  
                  <Typography variant="body1" paragraph>
                    {review.comment}
                  </Typography>
                  
                  <Typography variant="caption" color="text.secondary">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </Typography>
                  
                  {/* Afficher les réponses */}
                  {renderReplies(review.id)}
                  
                  {/* Formulaire de réponse */}
                  {isAuthenticated && (
                    <Box sx={{ mt: 2 }}>
                      <Button
                        size="small"
                        onClick={() => setShowReplyInput(prev => ({ ...prev, [review.id]: !prev[review.id] }))}
                        color="primary"
                      >
                        {showReplyInput[review.id] ? "Annuler" : "Répondre"}
                      </Button>
                      
                      {showReplyInput[review.id] && (
                        <Box sx={{ mt: 2 }}>
                          <TextField
                            value={replyInputs[review.id] || ""}
                            onChange={(e) => setReplyInputs(prev => ({ ...prev, [review.id]: e.target.value }))}
                            fullWidth
                            multiline
                            rows={3}
                            placeholder="Votre réponse..."
                            variant="outlined"
                            sx={{ mb: 2 }}
                          />
                          <Button
                            onClick={() => submitReply(review.id)}
                            variant="contained"
                            color="primary"
                            endIcon={<SendIcon />}
                          >
                            Envoyer
                          </Button>
                        </Box>
                      )}
                    </Box>
                  )}
                </Paper>
              ))
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Aucun avis pour le moment. Soyez le premier à donner votre opinion !
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

export default MovieDetail;
