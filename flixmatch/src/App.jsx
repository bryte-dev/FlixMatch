import { Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, AuthContext } from "./AuthContext";
import { useContext } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Watchlist from "./pages/Watchlist";
import Favorites from "./pages/Favorites";
import Seen from "./pages/Seen";
import AdvancedSearch from "./pages/AdvancedSearch";
import Junk from "./pages/Junk";
import Register from "./pages/Register";
import Account from "./pages/Account";
import Navbar from "./components/Navbar"; // 🔥 Vérifie que le chemin est bon
import SearchResults from "./pages/SearchResults";
import MovieDetail from "./pages/MovieDetail";

const PrivateRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? children : <Navigate to="/login" />;
};

const App = () => {
  return (
    <AuthProvider>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/search/:query" element={<SearchResults />} />
        <Route path="/watchlist" element={<PrivateRoute><Watchlist /></PrivateRoute>} />
        <Route path="/favorites" element={<PrivateRoute><Favorites /></PrivateRoute>} />
        <Route path="/:type/:tmdbId" element={<MovieDetail />} />
        <Route path="/seen" element={<PrivateRoute><Seen /></PrivateRoute>} />
        <Route path="/junk" element={<PrivateRoute><Junk /></PrivateRoute>} />
        <Route path="/account" element={<PrivateRoute><Account /></PrivateRoute>} />
        <Route path="/advanced-search" element={<AdvancedSearch />} />
      </Routes>
      <footer className="text-center text-sm text-gray-400 py-6">
        Créé par{" "}
        <a
          href="https://github.com/bryte-dev"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white"
        >
          bryte-dev
        </a>
        {" · "}
        <a
          href="https://bryte-dev.github.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white"
        >
          Site web
        </a>
      </footer>
    </AuthProvider>
  );
};

export default App;
