import { Link, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../AuthContext";
import axios from "axios";

// Styles CSS intégrés directement dans le composant
const styles = `
  /* Styles de base pour la navbar */
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: #111111;
    color: white;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: transform 0.3s ease;
    z-index: 50;
    width: 100%;
    box-sizing: border-box;
    height: 60px; /* Hauteur fixe pour éviter les sauts */
  }

  .navbar-hidden {
    transform: translateY(-100%);
  }

  .navbar-visible {
    transform: translateY(0);
  }

  /* Navigation links */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 4rem;
    height: 40px; /* Hauteur fixe pour alignement */
  }

  .nav-link {
    transition: filter 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-link:hover {
    filter: drop-shadow(0 0 10px rgba(255,123,134,1));
  }

  .nav-link img {
    width: 2.5rem;
    height: 2.5rem;
  }

  /* Suppression de toutes les bordures de focus */
  *:focus {
    outline: none !important;
    box-shadow: none !important;
    border-color: transparent !important;
  }

  /* Logo styles */
  .logo-container {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  .logo-desktop {
    width: 320px;
    transition: filter 0.2s ease;
  }

  .logo-mobile {
    display: none;
    width: 40px;
    height: 40px;
    transition: filter 0.2s ease;
  }

  .logo-desktop:hover,
  .logo-mobile:hover {
    filter: drop-shadow(0 0 10px rgba(255,123,134,1));
  }

  /* Search bar */
  .search-container {
    position: relative;
  }

  .search-input {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    width: 26rem;
    border: none;
  }

  .search-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(255,123,134,0.3);
  }

  .search-results {
    position: absolute;
    left: 0;
    right: 0;
    background-color: #1a1a1a;
    border-radius: 0.5rem;
    margin-top: 0.5rem;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 60;
  }

  .search-result-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    transition: background-color 0.2s ease;
    color: white;
    text-decoration: none;
  }

  .search-result-item:hover {
    background-color: rgba(255,123,134,0.1);
  }

  .search-result-image {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    object-fit: cover;
    margin-right: 0.75rem;
  }

  .search-result-title {
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Hamburger button */
  .hamburger-button {
    display: none;
    flex-direction: column;
    justify-content: space-between;
    width: 30px;
    height: 20px;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    z-index: 10;
  }

  .hamburger-line {
    width: 30px;
    height: 3px;
    background-color: rgba(255,123,134,1);
    transition: all 0.3s ease;
    border-radius: 2px;
  }

  .hamburger-button.open .hamburger-line:nth-child(1) {
    transform: translateY(8px) rotate(45deg);
  }

  .hamburger-button.open .hamburger-line:nth-child(2) {
    opacity: 0;
  }

  .hamburger-button.open .hamburger-line:nth-child(3) {
    transform: translateY(-8px) rotate(-45deg);
  }

  /* Mobile menu */
  .mobile-menu {
    display: none;
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    background-color: #111111;
    padding: 1rem;
    z-index: 40;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
    width: 100%;
    box-sizing: border-box;
  }

  .mobile-menu.open {
    max-height: calc(100vh - 60px);
    overflow-y: auto;
  }

  .mobile-menu-link {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    color: white;
    text-decoration: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .mobile-menu-link:last-child {
    border-bottom: none;
  }

  .mobile-menu-link img {
    width: 1.5rem;
    height: 1.5rem;
    margin-right: 1rem;
  }

  .mobile-menu-link:hover {
    background-color: rgba(255,123,134,0.1);
  }

  /* Alignement des éléments en mode desktop */
  .navbar-left, .navbar-right {
    display: flex;
    align-items: center;
    height: 40px; /* Hauteur fixe pour alignement */
  }

  .navbar-left {
    justify-content: flex-start;
  }

  .navbar-right {
    justify-content: flex-end;
  }

  /* Boutons de connexion */
  .auth-buttons {
    display: flex;
    gap: 0.5rem;
    height: 40px; /* Hauteur fixe pour alignement */
    align-items: center;
  }

  .auth-button {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    color: white;
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 36px; /* Hauteur fixe pour alignement */
  }

  .login-button {
    background-color: #3b82f6;
  }

  .register-button {
    background-color: #10b981;
  }

  /* Fix pour le problème de scroll sur mobile */
  body.has-mobile-menu-open {
    overflow: hidden;
  }

  /* Media queries - Approche simplifiée */
  @media (max-width: 1453px) {
    .nav-links, .search-container, .desktop-buttons {
      display: none;
    }
    
    .hamburger-button {
      display: flex;
    }
    
    .mobile-menu {
      display: block;
    }
    
    .logo-desktop {
      display: none;
    }
    
    .logo-mobile {
      display: block;
    }
    
    /* Fix pour éviter l'apparition d'un bout de navbar après scroll */
    .navbar {
      transform: translateY(0) !important;
      transition: none;
      height: 60px; /* Hauteur fixe pour éviter les sauts */
    }
    
    .navbar-hidden {
      transform: translateY(-100%) !important;
      transition: transform 0.3s ease;
    }
    
    /* Fix pour la barre noire résiduelle */
    .mobile-menu:not(.open) {
      max-height: 0 !important;
      padding: 0;
      border: none;
      margin: 0;
      overflow: hidden;
    }
    
    /* Assurer que le menu est complètement caché quand fermé */
    .mobile-menu {
      transition: max-height 0.3s ease, padding 0.3s ease;
    }
  }
`;

const Navbar = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);

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

  // Gérer le scroll du body quand le menu mobile est ouvert
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('has-mobile-menu-open');
    } else {
      document.body.classList.remove('has-mobile-menu-open');
    }
    
    return () => {
      document.body.classList.remove('has-mobile-menu-open');
    };
  }, [mobileMenuOpen]);

  // Nettoyer complètement le menu mobile quand il est fermé
  useEffect(() => {
    if (mobileMenuRef.current) {
      if (!mobileMenuOpen) {
        // Assurer que le menu est complètement caché
        setTimeout(() => {
          if (mobileMenuRef.current) {
            mobileMenuRef.current.style.display = mobileMenuOpen ? 'block' : 'none';
          }
        }, 300); // Attendre la fin de l'animation
      } else {
        mobileMenuRef.current.style.display = 'block';
      }
    }
  }, [mobileMenuOpen]);

  // Injecter les styles CSS dans le document
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = styles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <>
      <nav
        className={`navbar ${showNavbar ? 'navbar-visible' : 'navbar-hidden'}`}
        onMouseEnter={() => setShowNavbar(true)}
      >
        {/* Partie gauche: liens ou hamburger */}
        <div className="navbar-left">
          {/* Hamburger pour mobile */}
          <button 
            className={`hamburger-button ${mobileMenuOpen ? 'open' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <div className="hamburger-line"></div>
            <div className="hamburger-line"></div>
            <div className="hamburger-line"></div>
          </button>
          
          {/* Liens pour desktop */}
          <div className="nav-links">
            <Link to="/" className="nav-link">
              <img src="/public/hause.png" alt="Accueil" />
            </Link>
            {user && (
              <>
                <Link to="/watchlist" className="nav-link">
                  <img src="/public/pin.png" alt="À voir" />
                </Link>
                <Link to="/favorites" className="nav-link">
                  <img src="/public/sterne.png" alt="Favoris" />
                </Link>
                <Link to="/seen" className="nav-link">
                  <img src="/public/eye.png" alt="Déjà vu" />
                </Link>
                <Link to="/junk" className="nav-link">
                  <img src="/public/korb.png" alt="Corbeille" />
                </Link>
                <Link to="/advanced-search" className="nav-link">
                  <img src="/public/lens.png" alt="Recherche avancée" />
                </Link>
              </>
            )}
          </div>
        </div>
        
        {/* Logo centré */}
        <div className="logo-container">
          <Link to="/">
            <img 
              src="/public/Flixmatch.png" 
              alt="FlixMatch"
              className="logo-desktop" 
            />
            <img 
              src="/public/FlixmatchLogo.png" 
              alt="FlixMatch"
              className="logo-mobile" 
            />
          </Link>
        </div>
        
        {/* Partie droite: recherche et profil */}
        <div className="navbar-right">
          {/* Barre de recherche */}
          <div className="search-container" ref={searchRef}>
            <input
              type="text"
              placeholder="Rechercher un film, série ou acteur..."
              className="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowResults(true)}
            />

            {/* Résultats de recherche */}
            {showResults && results.length > 0 && (
              <div className="search-results">
                {results.map((item) => (
                  <Link
                    key={item.id}
                    to={`/${item.media_type || "person"}/${item.id}`}
                    className="search-result-item"
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
                      className="search-result-image"
                    />
                    <span className="search-result-title">{item.title || item.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Profil ou boutons de connexion */}
          <div className="desktop-buttons">
            {user ? (
              <Link to="/account" className="nav-link">
                <img src="/public/profile.png" alt="Mon compte" />
              </Link>
            ) : (
              <div className="auth-buttons">
                <Link to="/login" className="auth-button login-button">
                  🔑 Connexion
                </Link>
                <Link to="/register" className="auth-button register-button">
                  📝 S'inscrire
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
      
      {/* Menu mobile */}
      <div 
        ref={mobileMenuRef}
        className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
        style={{ display: mobileMenuOpen ? 'block' : 'none' }}
      >
        {/* Barre de recherche mobile */}
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Rechercher..."
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: '#333', color: 'white', border: 'none' }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          
          {/* Résultats de recherche mobile */}
          {showResults && results.length > 0 && (
            <div style={{ marginTop: '0.5rem', backgroundColor: '#222', borderRadius: '0.25rem', maxHeight: '60vh', overflowY: 'auto' }}>
              {results.map((item) => (
                <Link
                  key={item.id}
                  to={`/${item.media_type || "person"}/${item.id}`}
                  style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', color: 'white', textDecoration: 'none', borderBottom: '1px solid #333' }}
                  onClick={() => {
                    setQuery("");
                    setShowResults(false);
                    setMobileMenuOpen(false);
                  }}
                >
                  <img
                    src={item.poster_path || item.profile_path ? 
                      `https://image.tmdb.org/t/p/w92${item.poster_path || item.profile_path}` 
                      : "https://via.placeholder.com/92x138?text=?"}
                    alt={item.title || item.name}
                    style={{ width: '2rem', height: '2rem', borderRadius: '50%', marginRight: '0.5rem' }}
                  />
                  <span>{item.title || item.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        
        {/* Liens de navigation mobile */}
        <Link to="/" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
          <img src="/public/hause.png" alt="Accueil" />
          <span>Accueil</span>
        </Link>
        
        {user ? (
          <>
            <Link to="/watchlist" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
              <img src="/public/pin.png" alt="À voir" />
              <span>À voir</span>
            </Link>
            <Link to="/favorites" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
              <img src="/public/sterne.png" alt="Favoris" />
              <span>Favoris</span>
            </Link>
            <Link to="/seen" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
              <img src="/public/eye.png" alt="Déjà vu" />
              <span>Déjà vu</span>
            </Link>
            <Link to="/junk" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
              <img src="/public/korb.png" alt="Corbeille" />
              <span>Corbeille</span>
            </Link>
            <Link to="/advanced-search" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
              <img src="/public/lens.png" alt="Recherche avancée" />
              <span>Recherche avancée</span>
            </Link>
            <Link to="/account" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
              <img src="/public/profile.png" alt="Mon compte" />
              <span>Mon compte</span>
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
              <img src="/public/profile.png" alt="Connexion" />
              <span>Connexion</span>
            </Link>
            <Link to="/register" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>
              <img src="/public/profile.png" alt="S'inscrire" />
              <span>S'inscrire</span>
            </Link>
          </>
        )}
      </div>
    </>
  );
};

export default Navbar;
