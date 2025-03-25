import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { 
  TextField, 
  Box, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemAvatar, 
  Avatar, 
  Typography,
  Paper
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';

function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (query.length > 2) {
      axios
        .get(`https://api.themoviedb.org/3/search/multi?query=${query}&language=fr-FR`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_TMDB_API_KEY}` },
        })
        .then((res) => {
          setResults(res.data.results.slice(0, 6)); // On limite les résultats
          setShowResults(true);
        })
        .catch((err) => console.error("Erreur recherche :", err));
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [query]);

  // Fonction pour ouvrir une recherche Google pour un acteur dans une nouvelle page
  const handleActorClick = (item) => {
    // Rediriger vers la page de l'acteur
    window.open(`https://www.google.com/search?q=${encodeURIComponent(item.name)}`, '_blank');
  };

  return (
    <Box sx={{ position: 'relative', width: 300 }}>
      <TextField
        fullWidth
        placeholder="Rechercher un film, une série, un acteur..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        variant="outlined"
        size="small"
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'background.paper',
            borderRadius: 2,
          }
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      {showResults && (
        <Paper 
          elevation={3} 
          sx={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            width: '100%', 
            zIndex: 1000,
            mt: 0.5,
            maxHeight: 400,
            overflow: 'auto',
            borderRadius: 2
          }}
        >
          <List sx={{ p: 0 }}>
            {results.map((item) => (
              <ListItem 
                key={item.id}
                onClick={() => item.media_type === 'person' ? handleActorClick(item) : null}
                component={item.media_type === 'person' ? 'div' : Link}
                to={item.media_type === 'person' ? undefined : `/${item.media_type}/${item.id}`}
                sx={{ 
                  '&:hover': { 
                    backgroundColor: 'action.hover' 
                  },
                  textDecoration: 'none',
                  color: 'text.primary',
                  cursor: item.media_type === 'person' ? 'pointer' : 'default'
                }}
                divider
              >
                <ListItemAvatar>
                  <Avatar 
                    src={
                      item.poster_path || item.profile_path 
                        ? `https://image.tmdb.org/t/p/w92${item.poster_path || item.profile_path}` 
                        : item.media_type === 'person' 
                          ? '/default-actor.png' 
                          : '/default-movie.png'
                    }
                    alt={item.title || item.name}
                    variant={item.media_type === 'person' ? 'circular' : 'rounded'}
                  />
                </ListItemAvatar>
                <ListItemText 
                  primary={item.title || item.name}
                  secondary={
                    item.media_type === 'person' ? (
                      <Typography 
                        component="span" 
                        variant="body2" 
                        color="primary"
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                      >
                        Rechercher sur Google
                      </Typography>
                    ) : (
                      item.media_type === 'movie' ? 'Film' : 'Série TV'
                    )
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

export default SearchBar;
