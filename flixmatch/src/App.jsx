import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Watchlist from "./pages/Watchlist";
import Junk from "./pages/Junk";
import Favorites from "./pages/Favorites";
import Navbar from "./components/Navbar";

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/junk" element={<Junk />} />
        <Route path="/favorites" element={<Favorites />} />
      </Routes>
    </>
  );
}

export default App;
