import axios from "axios";

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";

export const getTrendingMovies = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/trending/all/day?language=en-US`, {
      params: { api_key: API_KEY }
    });
    return response.data.results;
  } catch (error) {
    console.error("Erreur TMDB:", error);
    return [];
  }
};
