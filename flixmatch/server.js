import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import axios from "axios";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || "ultra_secret_key";
const JWT_EXPIRES_IN = "7d"; // Durée du token

// 🔥 Middleware d'auth
const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  console.log("🧐 Token reçu :", token);

  if (!token) return res.status(401).json({ error: "Accès refusé, token manquant" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    console.log("✅ User ID authentifié :", req.userId);
    next();
  } catch (error) {
    console.error("❌ Erreur token:", error);
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
};



// 🔹 Inscription
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { email, password: hashedPassword },
    });

    res.status(201).json({ message: "Utilisateur créé", userId: user.id });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

// 🔹 Connexion
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ error: "Mot de passe incorrect" });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  });

  res.json({ message: "Connexion réussie", userId: user.id });
});

// 🔹 Déconnexion
app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Déconnexion réussie" });
});

// 🔹 Route protégée pour récupérer l'utilisateur connecté
app.get("/me", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true },
  });

  if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

  res.json(user);
});

// Route pour obtenir la watchlist de l'utilisateur
app.get("/watchlist", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    console.log("🔍 Récupération de la watchlist pour User ID :", userId);

    const watchlist = await prisma.watchlist.findMany({
      where: { userId, status: { not: "JUNK" } },
      include: { movie: true },
    });

    console.log("🎥 Films récupérés :", watchlist);
    res.json(watchlist);
  } catch (error) {
    console.error("❌ Erreur récupération watchlist :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});



// 🔹 Ajouter un film à la watchlist
app.post("/watchlist", authMiddleware, async (req, res) => {
  const { tmdb_id, title, media_type, poster_path } = req.body;
  const userId = req.userId;

  console.log("🔍 Données reçues :", req.body);
  console.log("👤 User ID récupéré :", userId);

  try {
    // Vérifie si le film existe déjà dans la base
    let movie = await prisma.movie.findUnique({ where: { tmdb_id: Number(tmdb_id) } });


    // S'il n'existe pas, on l'ajoute
    if (!movie) {
      movie = await prisma.movie.create({
        data: { tmdb_id, title, media_type, poster_path },
      });
      console.log("✅ Film ajouté dans `movie` :", movie);
    }

    // Vérifie si le film est déjà dans la watchlist de l'utilisateur
    const existingEntry = await prisma.watchlist.findFirst({
      where: { movieId: movie.id, userId },
    });

    if (existingEntry) {
      console.log("⚠️ Ce film est déjà dans la watchlist !");
      return res.status(400).json({ error: "Ce film est déjà dans la watchlist" });
    }

    // Ajout du film à la watchlist
    const watchlistEntry = await prisma.watchlist.create({
      data: { movieId: movie.id, userId },
    });

    console.log("✅ Film ajouté dans `watchlist` :", watchlistEntry);
    res.status(201).json({ message: "Film ajouté à la watchlist" });

  } catch (error) {
    console.error("❌ ERREUR SERVEUR :", error);
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
});



// 🔹 Marquer un film comme vu
app.put("/watchlist/:movieId/seen", authMiddleware, async (req, res) => {
  const { movieId } = req.params;
  const userId = req.userId;

  try {
    // Vérifier que le film est bien dans la watchlist du bon user
    const watchlistEntry = await prisma.watchlist.findFirst({
      where: { movieId: Number(movieId), userId },
    });

    if (!watchlistEntry) {
      return res.status(404).json({ error: "Ce film n'est pas dans ta watchlist." });
    }

    // Mettre à jour le statut du film à "SEEN"
    await prisma.watchlist.updateMany({
      where: { movieId: Number(movieId), userId },
      data: { status: "SEEN" },
    });

    res.status(200).json({ message: "Film marqué comme vu et retiré de la watchlist" });

  } catch (error) {
    console.error("❌ Erreur lors du marquage comme vu :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});



// 🔹 Remove un film marqué comme vu
app.put("/seen/:movieId/remove", authMiddleware, async (req, res) => {
  const { movieId } = req.params;
  const userId = req.userId;

  try {
    await prisma.watchlist.updateMany({
      where: { movieId: Number(movieId), userId },
      data: { status: "WATCHLIST" },
    });

    res.status(200).json({ message: "Film retiré de SEEN et remis dans la Watchlist" });
  } catch (error) {
    console.error("❌ Erreur lors du retrait de SEEN :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


app.get("/seen", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    console.log("🔍 Récupération des films vus pour User ID :", userId);

    const seenMovies = await prisma.watchlist.findMany({
      where: { userId, status: "SEEN" }, // 🔥 Vérifie bien que le statut est "SEEN"
      include: { movie: true },
    });

    console.log("🎥 Films vus récupérés :", seenMovies);
    res.json(seenMovies);
  } catch (error) {
    console.error("❌ Erreur récupération films vus :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// RATING

app.put("/seen/:movieId/rating", authMiddleware, async (req, res) => {
  const { movieId } = req.params;
  const { rating } = req.body;
  const userId = req.userId;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "La note doit être entre 1 et 5." });
  }

  try {
    // Vérifie si le film est bien dans la Watchlist et s'il est SEEN
    const watchlistEntry = await prisma.watchlist.findFirst({
      where: { movieId: Number(movieId), userId, status: "SEEN" },
    });

    if (!watchlistEntry) {
      return res.status(400).json({ error: "Ce film n'est pas marqué comme vu." });
    }

    // Met à jour la note (rating)
    const updatedMovie = await prisma.watchlist.updateMany({
      where: { movieId: Number(movieId), userId },
      data: { rating: Number(rating) },
    });

    res.status(200).json({ message: "Note mise à jour", updatedMovie });
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du rating :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// 🔹 Mettre un film dans les favoris
app.put("/watchlist/:movieId/favorite", authMiddleware, async (req, res) => {
  const { movieId } = req.params;
  const { isFavorite } = req.body;
  const userId = req.userId;

  try {
    const updatedMovie = await prisma.watchlist.updateMany({
      where: { movieId: Number(movieId), userId },
      data: { isFavorite },
    });

    res.status(200).json({ message: "Favoris mis à jour", updatedMovie });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/favorites", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    console.log("🔍 Récupération des favoris pour User ID :", userId);

    const favorites = await prisma.watchlist.findMany({
      where: { userId, isFavorite: true }, // 🔥 Vérifie bien que isFavorite est TRUE
      include: { movie: true },
    });

    console.log("🎥 Films favoris récupérés :", favorites);
    res.json(favorites);
  } catch (error) {
    console.error("❌ Erreur récupération favoris :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 🔹 Déplacer un film vers la corbeille
app.put("/watchlist/:movieId/junk", authMiddleware, async (req, res) => {
  const { movieId } = req.params;
  const userId = req.userId;

  try {
    await prisma.watchlist.updateMany({
      where: { movieId: Number(movieId), userId },
      data: { status: "JUNK", isFavorite: false },
    });

    res.status(200).json({ message: "Film déplacé vers la corbeille" });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/junk", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    console.log("🔍 Récupération des films dans la corbeille pour User ID :", userId);

    const junkMovies = await prisma.watchlist.findMany({
      where: { userId, status: "JUNK" }, // 🔥 Vérifie bien que le statut est "JUNK"
      include: { movie: true },
    });

    console.log("🗑️ Films dans la corbeille :", junkMovies);
    res.json(junkMovies);
  } catch (error) {
    console.error("❌ Erreur récupération films corbeille :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// 🔹 Restaurer un film depuis la corbeille
app.put("/junk/:movieId/restore", authMiddleware, async (req, res) => {
  const { movieId } = req.params;
  const userId = req.userId;

  try {
    await prisma.watchlist.updateMany({
      where: { movieId: Number(movieId), userId },
      data: { status: "WATCHLIST" },
    });

    res.status(200).json({ message: "Film restauré dans la Watchlist" });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

//Get les details des movies

app.get("/tmdb/details/:tmdbId/:type", async (req, res) => {
  const { tmdbId, type } = req.params;

  if (!["movie", "tv"].includes(type)) {
    return res.status(400).json({ error: "Type invalide, doit être 'movie' ou 'tv'" });
  }

  try {
    console.log(`🔍 Fetching details from TMDB: ${type}/${tmdbId}`); // LOG pour voir ce qui est appelé

    const response = await axios.get(
      `https://api.themoviedb.org/3/${type}/${tmdbId}?language=fr-FR&append_to_response=credits,videos,images,watch/providers`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ TMDB API RESPONSE:", response.data); // 🔥 Check ici si TMDB renvoie bien les données
    res.json(response.data);
  } catch (error) {
    console.error("❌ Erreur récupération TMDB :", error?.response?.data || error);
    res.status(500).json({ error: "Erreur serveur TMDB" });
  }
});

// Recommendations (dans movie details)

app.get("/tmdb/recommendations/:tmdbId/:type", async (req, res) => {
  const { tmdbId, type } = req.params;

  if (!["movie", "tv"].includes(type)) {
    return res.status(400).json({ error: "Type invalide, doit être 'movie' ou 'tv'" });
  }

  try {
    console.log(`🔍 Fetching REAL recommendations for: ${type}/${tmdbId}`);

    const response = await axios.get(
      `https://api.themoviedb.org/3/${type}/${tmdbId}/recommendations?language=fr-FR`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("❌ Erreur récupération recommandations TMDB :", error?.response?.data || error);
    res.status(500).json({ error: "Erreur serveur TMDB" });
  }
});

app.listen(3000, () => console.log("Serveur en marche sur http://localhost:3000"));
