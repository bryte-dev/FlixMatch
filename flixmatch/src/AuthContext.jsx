import { createContext, useState, useEffect } from "react";
import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL;
axios.defaults.baseURL = `${API_URL}`; // Assure-toi que l'URL est correcte
axios.defaults.withCredentials = true; // 🔥 Permet d'envoyer les cookies à chaque requête

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get(`${API_URL}/me`, { withCredentials: true });
        setUser(res.data);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = async (email, password) => {
    await axios.post(`${API_URL}/login`, { email, password }, { withCredentials: true });
    const res = await axios.get(`${API_URL}/me`, { withCredentials: true });
    setUser(res.data);
  };

  const logout = async () => {
    await axios.post(`${API_URL}/logout`, {}, { withCredentials: true });
    setUser(null);
  };

  const updateProfile = async (userData) => {
    try {
      await axios.put(`${API_URL}/account/update`, userData, { withCredentials: true });
      // Mettre à jour les données utilisateur localement
      setUser(prev => ({ ...prev, ...userData }));
      return true;
    } catch (error) {
      console.error("Erreur lors de la mise à jour du profil:", error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
