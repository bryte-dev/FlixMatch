import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="p-4 bg-gray-800 text-white flex gap-4 top-0 w-full">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/watchlist" className="hover:underline">Watchlist</Link>
      <Link to="/junk" className="hover:underline">Junk</Link>
      <Link to="/favorites" className="hover:underline">Favoris</Link>
    </nav>
  );
}

export default Navbar;
