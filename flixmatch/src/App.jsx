import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, AuthContext } from "./AuthContext";
import { useContext, useEffect } from "react";
import { ToastProvider } from "./components/Toast";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Watchlist from "./pages/Watchlist";
import Favorites from "./pages/Favorites";
import Seen from "./pages/Seen";
import AdvancedSearch from "./pages/AdvancedSearch";
import Junk from "./pages/Junk";
import Register from "./pages/Register";
import Account from "./pages/Account";
import Discover from "./pages/Discover";
import Settings from "./pages/Settings";
import Navbar from "./components/Navbar";
import TabBar from "./components/TabBar";
import { useKonami, useTheme } from "./theme";
import { useToast } from "./toastContext";
import SearchResults from "./pages/SearchResults";
import MovieDetail from "./pages/MovieDetail";
import { Spinner, EmptyState } from "./components/ui";

const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-brand-400" role="status" aria-label="Chargement">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
};

const NotFound = () => (
  <div className="page">
    <EmptyState icon="🧭" title="Page introuvable" text="Cette page n'existe pas (ou plus)." actionTo="/" actionLabel="Retour à l'accueil" />
  </div>
);

const Shell = () => {
  const toast = useToast();
  const { pathname } = useLocation();
  useTheme();
  useKonami(() => toast("🕹️ Konami ! Thèmes secrets débloqués (voir Paramètres).", "success"));
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <main id="contenu" key={pathname} className="page-enter flex flex-1 flex-col">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Home />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/search/:query" element={<SearchResults />} />
          <Route path="/watchlist" element={<PrivateRoute><Watchlist /></PrivateRoute>} />
          <Route path="/favorites" element={<PrivateRoute><Favorites /></PrivateRoute>} />
          <Route path="/seen" element={<PrivateRoute><Seen /></PrivateRoute>} />
          <Route path="/junk" element={<PrivateRoute><Junk /></PrivateRoute>} />
          <Route path="/account" element={<PrivateRoute><Account /></PrivateRoute>} />
          <Route path="/advanced-search" element={<AdvancedSearch />} />
          <Route path="/:type/:tmdbId" element={<MovieDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="border-t border-white/10 px-4 py-6 pb-24 text-center text-sm text-zinc-500 md:pb-6">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-3">
          <img
            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
            alt="TMDB"
            className="h-4 w-auto"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        </div>
        Créé par{" "}
        <a href="https://github.com/bryte-dev" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
          bryte-dev
        </a>
        {" · "}
        <a href="https://bryte-dev.github.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
          Site web
        </a>
        {" · "}Où regarder : données JustWatch via TMDB
      </footer>
      <TabBar />
    </>
  );
};

const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
