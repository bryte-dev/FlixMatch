import { createContext, useState, useEffect } from "react";
import axios from "axios";
axios.defaults.baseURL = "http://localhost:3000"; // Assure-toi que l'URL est correcte
axios.defaults.withCredentials = true; // 🔥 Permet d'envoyer les cookies à chaque requête

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    axios.get("http://localhost:3000/me", { withCredentials: true })
      .then(res => setUser(res.data))
      .catch(() => setUser(null));
  }, []);

  const login = async (email, password) => {
    await axios.post("http://localhost:3000/login", { email, password }, { withCredentials: true });
    const res = await axios.get("http://localhost:3000/me", { withCredentials: true });
    setUser(res.data);
  };

  const logout = async () => {
    await axios.post("http://localhost:3000/logout", {}, { withCredentials: true });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
