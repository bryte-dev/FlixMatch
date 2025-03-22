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

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const response = await axios.get(`http://localhost:3000/tmdb/details/${tmdbId}/${type}`);
        setMovie(response.data);

        const recResponse = await axios.get(`http://localhost:3000/tmdb/recommendations/${tmdbId}/${type}`);
        setRecommendations(recResponse.data.results || []);

      } catch (error) {
        console.error("Erreur récupération des détails :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [tmdbId, type, refreshTrigger]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', height: '100vh' }}><CircularProgress /></Box>;
  if (!movie) return <Container sx={{ mt: 12, textAlign: 'center' }}><Typography variant="h5">Aucune info disponible</Typography></Container>;

  return (
    <Container maxWidth="lg" sx={{ mt: 12, mb: 8 }}>
      <Grid container spacing={4}>
        {/* Affiche */}
        <Grid item xs={12} md={4}>
          <Box sx={{ position: 'sticky', top: 100 }}>
            <img src={movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : "/default-movie.png"}
                 alt={movie.title || movie.name} 
                 style={{ width: '100%', borderRadius: 8, maxHeight: "600px", objectFit: "cover" }} />
            {isAuthenticated && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="contained" color="primary" startIcon={<BookmarkAddIcon />} fullWidth>Watchlist</Button>
                <Button variant="contained" color="secondary" startIcon={<FavoriteIcon />} fullWidth>Favoris</Button>
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
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Aucun avis pour le moment.
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

export default MovieDetail;
