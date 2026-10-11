import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "./api";

axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true; // Envoie le cookie d'authentification à chaque requête

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get("/me");
        setUser(res.data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    await axios.post("/login", { email, password });
    const res = await axios.get("/me");
    setUser(res.data);
  };

  const logout = async () => {
    await axios.post("/logout");
    setUser(null);
  };

  const updateProfile = async (userData) => {
    try {
      const res = await axios.put("/account/update", userData);
      setUser((prev) => ({ ...prev, ...(res.data?.user || userData) }));
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
