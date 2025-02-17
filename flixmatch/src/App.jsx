import { Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, AuthContext } from "./AuthContext";
import { useContext } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Watchlist from "./pages/Watchlist";
import Favorites from "./pages/Favorites";
import Seen from "./pages/Seen";
import Junk from "./pages/Junk";
import Register from "./pages/Register";
import Navbar from "./components/Navbar"; // 🔥 Vérifie que le chemin est bon

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
        <Route path="/watchlist" element={<PrivateRoute><Watchlist /></PrivateRoute>} />
        <Route path="/favorites" element={<PrivateRoute><Favorites /></PrivateRoute>} />
        <Route path="/seen" element={<PrivateRoute><Seen /></PrivateRoute>} />
        <Route path="/junk" element={<PrivateRoute><Junk /></PrivateRoute>} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
