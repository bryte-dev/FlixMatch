// src/services/tmdb.js
const BASE_URL = 'https://api.themoviedb.org/3';
let apiKey = null;

// Fonction pour récupérer la clé API du serveur
const getApiKey = async () => {
  if (apiKey) return apiKey;
  
  try {
    console.log('Fetching API key from server...');
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error(`Failed to fetch API key: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.tmdbApiKey) {
      console.error('No API key received from server');
      throw new Error('API key not found');
    }
    
    console.log('API key received successfully');
    apiKey = data.tmdbApiKey;
    return apiKey;
  } catch (error) {
    console.error('Failed to get API key:', error);
    throw error;
  }
};

export const getTrendingMovies = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/trending/all/day?language=en-US`, {
      params: { api_key: await getApiKey() }
    });
    return response.data.results;
  } catch (error) {
    console.error("Erreur TMDB:", error);
    return [];
  }
};
