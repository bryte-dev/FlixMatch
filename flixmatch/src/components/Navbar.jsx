import { Link, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../AuthContext";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

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
          </>
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
