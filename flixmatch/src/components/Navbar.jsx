import { Link, NavLink, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../AuthContext";
import { FiHome, FiBookmark, FiStar, FiEye, FiTrash2, FiSliders, FiUser, FiMenu, FiX, FiLogOut } from "react-icons/fi";
import SearchBar from "./SearchBar";
import { useToast } from "../toastContext";

const PUBLIC_LINKS = [
  { to: "/", label: "Accueil", icon: FiHome, end: true },
  { to: "/advanced-search", label: "Recherche avancée", short: "Découvrir", icon: FiSliders },
];

const PRIVATE_LINKS = [
  { to: "/watchlist", label: "À voir", icon: FiBookmark },
  { to: "/favorites", label: "Favoris", icon: FiStar },
  { to: "/seen", label: "Vus", icon: FiEye },
  { to: "/junk", label: "Corbeille", icon: FiTrash2 },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-brand-500/15 text-brand-300" : "text-zinc-300 hover:bg-white/10 hover:text-white"
  }`;

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const links = user ? [...PUBLIC_LINKS.slice(0, 1), ...PRIVATE_LINKS, ...PUBLIC_LINKS.slice(1)] : PUBLIC_LINKS;
  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      closeMenu();
      navigate("/");
      toast("Tu es déconnecté.", "success");
    } catch {
      toast("La déconnexion a échoué.", "error");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/80 backdrop-blur-lg">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="FlixMatch, accueil">
          <img src="/FlixMatchLogo.png" alt="" className="h-9 w-9 lg:hidden" />
          <img src="/FlixMatch.png" alt="FlixMatch" className="hidden h-6 w-auto lg:block" />
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass} title={label}>
              <Icon aria-hidden="true" />
              <span className="hidden xl:inline">{label}</span>
              <span className="sr-only xl:hidden">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden w-full min-w-0 max-w-xs md:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {user ? (
            <>
              <NavLink to="/account" className={linkClass} title="Mon compte" aria-label="Mon compte">
                <FiUser aria-hidden="true" />
                <span className="hidden max-w-28 truncate lg:inline">{user.username || "Compte"}</span>
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn btn-ghost btn-sm hidden md:inline-flex"
                aria-label="Se déconnecter"
                title="Se déconnecter"
              >
                <FiLogOut aria-hidden="true" />
              </button>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login" className="btn btn-ghost btn-sm">Connexion</Link>
              <Link to="/register" className="btn btn-primary btn-sm">S&apos;inscrire</Link>
            </div>
          )}
          <button
            type="button"
            className="btn btn-ghost !px-2 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="menu-mobile" className="border-t border-white/10 bg-ink-900/95 px-4 pb-4 pt-3 md:hidden">
          <SearchBar onNavigate={closeMenu} className="mb-3" />
          <nav className="flex flex-col gap-1" aria-label="Navigation mobile">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass} onClick={closeMenu}>
                <Icon aria-hidden="true" /> {label}
              </NavLink>
            ))}
            {user ? (
              <>
                <NavLink to="/account" className={linkClass} onClick={closeMenu}>
                  <FiUser aria-hidden="true" /> Mon compte
                </NavLink>
                <button type="button" onClick={handleLogout} disabled={loggingOut} className="btn btn-secondary mt-2">
                  <FiLogOut aria-hidden="true" /> {loggingOut ? "Déconnexion…" : "Se déconnecter"}
                </button>
              </>
            ) : (
              <div className="mt-2 flex gap-2">
                <Link to="/login" onClick={closeMenu} className="btn btn-secondary flex-1">Connexion</Link>
                <Link to="/register" onClick={closeMenu} className="btn btn-primary flex-1">S&apos;inscrire</Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export default Navbar;
