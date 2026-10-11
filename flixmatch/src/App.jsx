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
import Navbar from "./components/Navbar";
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

const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <ScrollToTop />
        <Navbar />
        <main id="contenu" className="flex flex-1 flex-col">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Home />} />
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
        <footer className="border-t border-white/10 py-6 text-center text-sm text-zinc-500">
          Créé par{" "}
          <a href="https://github.com/bryte-dev" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
            bryte-dev
          </a>
          {" · "}
          <a href="https://bryte-dev.github.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
            Site web
          </a>
          {" · "}Données et affiches fournies par TMDB
        </footer>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
