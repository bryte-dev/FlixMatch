import { Link, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../AuthContext";
import axios from "axios";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  // 🔥 Gérer l'affichage de la navbar selon le scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < 50 || window.scrollY < lastScrollY) {
        setShowNavbar(true);
      } else {
        setShowNavbar(false);
      }
      setLastScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // 🔍 Recherche dynamique (films, séries & acteurs)
  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      try {
        const response = await axios.get(`http://localhost:3000/tmdb/search/${query}`);
        setResults(response.data);
        setShowResults(true);
      } catch (error) {
        console.error("❌ Erreur recherche :", error);
      }
    };

    const timeoutId = setTimeout(fetchResults, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  // 🔥 Cacher les résultats si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 bg-gray-900 text-white p-4 flex justify-between items-center transition-all duration-300 z-50 ${
        showNavbar ? "translate-y-0" : "-translate-y-full"
      }`}
      onMouseEnter={() => setShowNavbar(true)}
    >
      <div className="flex items-center space-x-6 text-lg font-semibold">
        <Link to="/" className="hover:text-blue-400 transition">🏠 Home</Link>
        {user && (
          <>
            <Link to="/watchlist" className="hover:text-blue-400 transition">📌 Watchlist</Link>
            <Link to="/favorites" className="hover:text-blue-400 transition">⭐ Favoris</Link>
            <Link to="/seen" className="hover:text-blue-400 transition">👁️ Vus</Link>
            <Link to="/junk" className="hover:text-blue-400 transition">🗑️ Corbeille</Link>
            <Link to="/advanced-search" className="hover:text-blue-400 transition">🔎 Recherche Avancée</Link>
            <Link to="/account" className="hover:text-blue-400 transition">👤 Mon Profil</Link>

          </>
        )}
      </div>

      {/* 🔍 BARRE DE RECHERCHE */}
      <div className="relative" ref={searchRef}>
        <input
          type="text"
          placeholder="Rechercher un film, série ou acteur..."
          className="px-4 py-2 rounded-lg text-white w-84"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
        />

        {/* 🔥 AFFICHAGE DES RÉSULTATS EN LIVE */}
        {showResults && results.length > 0 && (
          <div className="absolute left-0 w-84 bg-gray-800 text-white rounded-lg mt-2 shadow-lg max-h-80 overflow-y-auto custom-scrollbar">
            {results.map((item) => (
              <Link
                key={item.id}
                to={`/${item.media_type || "person"}/${item.id}`}
                className="flex items-center p-3 hover:bg-gray-700 transition rounded-lg"
                onClick={() => {
                  setQuery("");
                  setShowResults(false);
                }}
              >
                <img
                  src={item.poster_path || item.profile_path ? 
                    `https://image.tmdb.org/t/p/w92${item.poster_path || item.profile_path}` 
                    : "https://via.placeholder.com/92x138?text=?"}
                  alt={item.title || item.name}
                  className="w-12 h-18 rounded-full"
                />
                <span className="ml-3">{item.title || item.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        {user ? (
          <button onClick={handleLogout} className="bg-red-500 hover:bg-red-700 px-4 py-2 rounded-lg text-black font-semibold transition">
            🚪 Déconnexion
          </button>
        ) : (
          <>
            <Link to="/login" className="bg-blue-500 hover:bg-blue-700 px-4 py-2 rounded-lg mr-2">🔑 Connexion</Link>
            <Link to="/register" className="bg-green-500 hover:bg-green-700 px-4 py-2 rounded-lg">📝 S'inscrire</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
