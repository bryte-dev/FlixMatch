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
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Défini à true par défaut
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [replies, setReplies] = useState({});
  const [replyCursors, setReplyCursors] = useState({});
  const [loadingReplies, setLoadingReplies] = useState({});
  const [replyInputs, setReplyInputs] = useState({}); // Stocke le texte des réponses
  const [showReplyInput, setShowReplyInput] = useState({}); // Stocke l'état d'affichage
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadedReviews, setLoadedReviews] = useState({}); // Pour éviter les chargements multiples
  const [checkingWatchlist, setCheckingWatchlist] = useState(false);

  // Vérifier l'authentification de l'utilisateur
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${process.env.VITE_API_URL}/auth/check`, { withCredentials: true });
        setIsAuthenticated(response.data.isAuthenticated || true);
      } catch (error) {
        console.error("Erreur vérification authentification:", error);
        setIsAuthenticated(true); // En cas d'erreur, on considère l'utilisateur comme authentifié
      }
    };
    
    checkAuth();
  }, []);

  // Charger les détails du film
  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const response = await axios.get(`${process.env.VITE_API_URL}/tmdb/details/${tmdbId}/${type}`);
        setMovie(response.data);

        const recResponse = await axios.get(`${process.env.VITE_API_URL}/tmdb/recommendations/${tmdbId}/${type}`);
        setRecommendations(recResponse.data.results || []);
      } catch (error) {
        console.error("Erreur récupération des détails :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [tmdbId, type]);

  // Vérifier si le film est dans la watchlist/favoris
  useEffect(() => {
    const checkWatchlistStatus = async () => {
      if (!isAuthenticated || !movie || checkingWatchlist) return;
      
      setCheckingWatchlist(true);
      
      try {
        // Vérifier dans la watchlist
        const watchlistResponse = await axios.get(`${process.env.VITE_API_URL}/watchlist`, 
          { withCredentials: true }
        );
        
        if (watchlistResponse.data && Array.isArray(watchlistResponse.data)) {
          // Chercher le film dans la watchlist
          const movieInWatchlist = watchlistResponse.data.find(
            item => item.tmdb_id === parseInt(tmdbId)
          );
          
          if (movieInWatchlist) {
            setInWatchlist(true);
            setIsFavorite(movieInWatchlist.isFavorite || false);
            console.log("✅ Film trouvé dans la watchlist:", movieInWatchlist);
          } else {
            setInWatchlist(false);
            setIsFavorite(false);
            console.log("❌ Film non trouvé dans la watchlist");
          }
        }
        
        // Vérifier dans les favoris
        const favoritesResponse = await axios.get(`${process.env.VITE_API_URL}/favorites`, 
          { withCredentials: true }
        );
        
        if (favoritesResponse.data && Array.isArray(favoritesResponse.data)) {
          // Chercher le film dans les favoris
          const movieInFavorites = favoritesResponse.data.find(
            item => item.tmdb_id === parseInt(tmdbId)
          );
          
          if (movieInFavorites) {
            setInWatchlist(true); // Si dans les favoris, forcément dans la watchlist
            setIsFavorite(true);
            console.log("✅ Film trouvé dans les favoris:", movieInFavorites);
          }
        }
      } catch (error) {
        console.error("Erreur vérification watchlist/favoris:", error);
      } finally {
        setCheckingWatchlist(false);
      }
    };
    
    checkWatchlistStatus();
  }, [isAuthenticated, movie, tmdbId, refreshTrigger]);

  // Charger les avis
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await axios.get(`${process.env.VITE_API_URL}/reviews/${tmdbId}`);
        
        if (res.data && Array.isArray(res.data.reviews)) {
          // Filtrer pour ne garder que les avis principaux (sans parentId)
          const mainReviews = res.data.reviews.filter(review => !review.parentId);
          setReviews(mainReviews);
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
  
  // Fonction pour récupérer les réponses
  const fetchReplies = async (reviewId) => {
    // Éviter de charger plusieurs fois les mêmes réponses
    if (loadingReplies[reviewId] || loadedReviews[reviewId]) return;
    
    setLoadingReplies(prev => ({ ...prev, [reviewId]: true }));
  
    try {
      const res = await axios.get(`${process.env.VITE_API_URL}/reviews/${reviewId}/replies`, {
        withCredentials: true
      });
  
      if (res.data && Array.isArray(res.data.replies)) {
        setReplies(prev => ({
          ...prev,
          [reviewId]: res.data.replies
        }));
        
        // Marquer comme chargé
        setLoadedReviews(prev => ({ ...prev, [reviewId]: true }));
      }
    } catch (error) {
      console.error("❌ Erreur récupération des réponses :", error);
    } finally {
      setLoadingReplies(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', height: '100vh' }}><CircularProgress /></Box>;
  if (!movie) return <Container sx={{ mt: 12, textAlign: 'center' }}><Typography variant="h5">Aucune info disponible</Typography></Container>;

  const handleAddToWatchlist = async () => {
    if (!isAuthenticated) {
      alert("Vous devez être connecté pour ajouter à votre watchlist");
      return;
    }
    
    try {
      await axios.post(
        `${process.env.VITE_API_URL}/watchlist`,
        { 
          tmdb_id: movie.id, 
          title: movie.title || movie.name, 
          media_type: type, 
          poster_path: movie.poster_path 
        },
        { withCredentials: true }
      );
      setInWatchlist(true);
      alert("Ajouté à votre watchlist avec succès!");
      // Déclencher une mise à jour pour rafraîchir les statuts
      setRefreshTrigger(prev => !prev);
    } catch (error) {
      console.error("Erreur ajout Watchlist :", error);
      alert("Erreur lors de l'ajout à la watchlist");
    }
  };

  const handleAddToFavorites = async () => {
    if (!isAuthenticated) {
      alert("Vous devez être connecté pour ajouter aux favoris");
      return;
    }
    
    if (!inWatchlist) {
      // Si pas dans la watchlist, on l'ajoute d'abord
      try {
        await axios.post(
          "${process.env.VITE_API_URL}/watchlist",
          { 
            tmdb_id: movie.id, 
            title: movie.title || movie.name, 
            media_type: type, 
            poster_path: movie.poster_path 
          },
          { withCredentials: true }
        );
        setInWatchlist(true);
      } catch (error) {
        console.error("Erreur ajout Watchlist :", error);
        alert("Erreur lors de l'ajout à la watchlist");
        return;
      }
    }
    
    try {
      await axios.put(
        `${process.env.VITE_API_URL}/watchlist/${movie.id}/favorite`,
        { isFavorite: true },
        { withCredentials: true }
      );
      setIsFavorite(true);
      alert("Ajouté à vos favoris avec succès!");
      // Déclencher une mise à jour pour rafraîchir les statuts
      setRefreshTrigger(prev => !prev);
    } catch (error) {
      console.error("Erreur ajout Favoris :", error);
      alert("Erreur lors de l'ajout aux favoris");
    }
  };

  const submitReply = async (parentReviewId) => {
    if (!replyInputs[parentReviewId]) {
      alert("Écris une réponse avant de poster !");
      return;
    }
    
    if (!isAuthenticated) {
      alert("Vous devez être connecté pour poster une réponse");
      return;
    }
  
    try {
      const res = await axios.post(
        `${process.env.VITE_API_URL}/reviews`,
        {
          movieId: movie.id,
          comment: replyInputs[parentReviewId],
          parentId: parentReviewId,
        },
        { withCredentials: true }
      );
  
      if (res.data && res.data.review) {
        // Ajouter la nouvelle réponse
        setReplies(prev => ({
          ...prev,
          [parentReviewId]: [...(prev[parentReviewId] || []), res.data.review]
        }));
        
        // Réinitialiser le formulaire
        setReplyInputs(prev => ({ ...prev, [parentReviewId]: "" }));
        setShowReplyInput(prev => ({ ...prev, [parentReviewId]: false }));
      }
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi de la réponse :", error);
      alert("Impossible de poster la réponse !");
    }
  };
  
  const renderReplies = (reviewId) => {
    // Charger les réponses si pas encore fait
    if (!loadedReviews[reviewId] && !loadingReplies[reviewId]) {
      fetchReplies(reviewId);
      return <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress size={20} /></Box>;
    }
    
    // Si chargement en cours
    if (loadingReplies[reviewId]) {
      return <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress size={20} /></Box>;
    }
    
    // Si pas de réponses
    if (!replies[reviewId] || replies[reviewId].length === 0) {
      return null;
    }
    
    return (
      <Box sx={{ ml: 4, mt: 2 }}>
        {replies[reviewId].map(reply => (
          <Paper key={reply.id} sx={{ p: 2, mb: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              <strong>{reply.user?.email || "Utilisateur inconnu"}</strong>
            </Typography>
            <Typography variant="body1" sx={{ my: 1 }}>{reply.comment}</Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(reply.createdAt).toLocaleDateString()}
            </Typography>
            
            {/* Bouton pour répondre */}
            {isAuthenticated && (
              <Box sx={{ mt: 2 }}>
                <Button
                  size="small"
                  onClick={() => setShowReplyInput(prev => ({ ...prev, [reply.id]: !prev[reply.id] }))}
                  color="primary"
                >
                  {showReplyInput[reply.id] ? "Annuler" : "Répondre"}
                </Button>
                
                {showReplyInput[reply.id] && (
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      value={replyInputs[reply.id] || ""}
                      onChange={(e) => setReplyInputs(prev => ({ ...prev, [reply.id]: e.target.value }))}
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
                    >
                      Envoyer
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        ))}
      </Box>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 12, mb: 8 }}>
      <Grid container spacing={4}>
        {/* Affiche */}
        <Grid item xs={12} md={4}>
          <Box sx={{ position: 'sticky', top: 100 }}>
            <img 
              src={movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : "/default-movie.png"}
              alt={movie.title || movie.name} 
              style={{ width: '100%', borderRadius: 8, maxHeight: "600px", objectFit: "cover" }} 
            />
            
            {/* Boutons sous l'affiche */}
            {isAuthenticated && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  startIcon={<BookmarkAddIcon />} 
                  fullWidth 
                  disabled={inWatchlist || checkingWatchlist}
                  onClick={handleAddToWatchlist}
                >
                  {checkingWatchlist ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : inWatchlist ? (
                    "Déjà dans la Watchlist"
                  ) : (
                    "Ajouter à la Watchlist"
                  )}
                </Button>

               
              </Box>
            )}
          </Box>
        </Grid>

        {/* Infos principales */}
        <Grid item xs={12} md={8}>
          <Typography variant="h3" component="h1" gutterBottom>{movie.title || movie.name}</Typography>
          {movie.tagline && <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontStyle: 'italic' }}>{movie.tagline}</Typography>}

          <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {movie.genres?.map((genre) => <Chip key={genre.id} label={genre.name} variant="outlined" size="small" />)}
          </Box>

          <Typography variant="body1" paragraph>{movie.overview || "Aucune description disponible."}</Typography>

          {/* Budget / Revenus / Réalisateur */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1"><strong>Date de sortie:</strong> {movie.release_date || movie.first_air_date || "Inconnue"}</Typography>
            {movie.runtime && <Typography variant="subtitle1"><strong>Durée:</strong> {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}min</Typography>}
            {type === "movie" && (
              <>
                <Typography variant="subtitle1"><strong>Budget:</strong> {movie.budget ? `${movie.budget.toLocaleString()} $` : "Inconnu"}</Typography>
                <Typography variant="subtitle1"><strong>Revenus:</strong> {movie.revenue ? `${movie.revenue.toLocaleString()} $` : "Inconnu"}</Typography>
                <Typography variant="subtitle1"><strong>Réalisateur:</strong> {movie.credits?.crew.filter(person => person.job === "Director").map(director => director.name).join(", ") || "Inconnu"}</Typography>
              </>
            )}
            {type === "tv" && <Typography variant="subtitle1"><strong>Créateur:</strong> {movie.created_by?.map(creator => creator.name).join(", ") || "Inconnu"}</Typography>}
          </Box>

          {/* Médias */}
          {movie.videos?.results.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>Médias</Typography>
              <Swiper spaceBetween={10} slidesPerView={1} navigation modules={[Navigation]} className="disable-select">
                {movie.videos.results.filter(video => ["Trailer", "Teaser", "Clip"].includes(video.type)).map(video => (
                  <SwiperSlide key={video.id}>
                    <iframe width="100%" height="400" src={`https://www.youtube.com/embed/${video.key}`} title={video.name} allowFullScreen></iframe>
                  </SwiperSlide>
                ))}
              </Swiper>
            </Box>
          )}

          {/* Casting */}
          {movie.credits?.cast?.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>Casting</Typography>
              <Swiper spaceBetween={10} slidesPerView={5} navigation modules={[Navigation]} className="disable-select">
                {movie.credits.cast.slice(0, 10).map(actor => (
                  <SwiperSlide key={actor.id}>
                    <a href={`https://www.google.com/search?q=${actor.name}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Avatar src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : "/default-actor.png"} sx={{ width: 110, height: 110 }} />
                        <Typography variant="body2" sx={{ textAlign: "center", mt: 1 }}>{actor.name}</Typography>
                      </Box>
                    </a>
                  </SwiperSlide>
                ))}
              </Swiper>
            </Box>
          )}

          {/* Recommandations */}
          {recommendations.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom>Recommandations</Typography>
              <Swiper spaceBetween={10} slidesPerView={4} navigation modules={[Navigation]} className="disable-select">
                {recommendations.map(rec => (
                  <SwiperSlide key={rec.id}>
                    <Link to={`/${rec.media_type || type}/${rec.id}`}>
                      <img src={rec.poster_path ? `https://image.tmdb.org/t/p/w500${rec.poster_path}` : "/default-movie.png"} alt={rec.title || rec.name} style={{ width: "100%", borderRadius: 8 }} />
                    </Link>
                  </SwiperSlide>
                ))}
              </Swiper>
            </Box>
          )}

          {/* Avis */}
          <Box sx={{ mt: 6 }}>
            <Typography variant="h5" gutterBottom>Avis et commentaires</Typography>
            <Divider sx={{ mb: 3 }} />

            {reviews.length > 0 ? (
              reviews.map((review) => (
                <Paper key={review.id} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Typography variant="subtitle1">
                    <strong>{review.user?.email || "Utilisateur inconnu"}</strong>
                  </Typography>
                  {review.rating && (
                    <Rating value={review.rating} readOnly size="small" />
                  )}
                  <Typography variant="body1" paragraph>{review.comment}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </Typography>

                  {/* Affichage des réponses */}
                  {renderReplies(review.id)}

                  {/* Formulaire pour répondre à un avis */}
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
                Aucun avis pour le moment.
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

export default MovieDetail;
