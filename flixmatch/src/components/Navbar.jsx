import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <nav className="bg-gray-900 text-white p-4 flex justify-between">
      <div>
        <Link to="/" className="mr-4">Home</Link>
        {user && (
          <>
            <Link to="/watchlist" className="mr-4">Watchlist</Link>
            <Link to="/favorites" className="mr-4">Favoris</Link>
            <Link to="/seen" className="mr-4">Vus</Link>
            <Link to="/junk" className="mr-4">Corbeille</Link>
          </>
        )}
      </div>
      <div>
        {user ? (
          <button onClick={logout} className="bg-red-500 px-3 py-1 rounded">Déconnexion</button>
        ) : (
          <>
            <Link to="/login" className="bg-blue-500 px-3 py-1 rounded mr-2">Connexion</Link>
            <Link to="/register" className="bg-green-500 px-3 py-1 rounded">S'inscrire</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
