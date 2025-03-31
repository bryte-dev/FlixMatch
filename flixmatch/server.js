import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import axios from "axios";
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Pour obtenir l'équivalent de __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
const prisma = new PrismaClient();


app.use(cors());

app.get('/api/config', (req, res) => {
  res.json({
    tmdbApiKey: process.env.TMDB_API_KEY
  });
});


app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || "ultra_secret_key";
const JWT_EXPIRES_IN = "7d"; // Durée du token

// Middleware pour logger les requêtes (aide au débogage)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// 🔥 Middleware d'auth
const authMiddleware = (req, res, next) => {
  // Accepter le token soit des cookies, soit du header Authorization
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  console.log("🧐 Token reçu :", token);

  if (!token) return res.status(401).json({ error: "Accès refusé, token manquant" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    console.log("✅ User ID authentifié :", req.userId);
    next();
  } catch (error) {
    console.error("❌ Erreur token:", error);
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
};

app.get("/me", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true },
  });

  if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

  res.json(user);
});


// 🔹 Inscription
app.post("/register", async (req, res) => {
  const { email, password, username } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { email, username, password: hashedPassword },
    });

    res.status(201).json({ message: "Utilisateur créé", userId: user.id });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'inscription", details: error.message });
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
    console.log(`🔍 Fetching details from TMDB: ${type}/${tmdbId}`);

    // 🔥 Récupérer les détails du film depuis TMDB
    const response = await axios.get(
      `https://api.themoviedb.org/3/${type}/${tmdbId}?language=fr-FR&append_to_response=credits,videos,images,watch/providers`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const movieDetails = response.data;

    // 🔥 Vérifier si le film existe dans la DB locale
    let movie = await prisma.movie.findUnique({
      where: { tmdb_id: Number(tmdbId) },
      include: {
        reviews: {
          include: { user: true }, // Inclure les auteurs des reviews
        },
      },
    });

    // 🔥 Si le film existe en local, calculer la moyenne des ratings
    let averageRating = null;
    if (movie && movie.reviews.length > 0) {
      const totalRatings = movie.reviews.reduce((sum, review) => sum + review.rating, 0);
      averageRating = (totalRatings / movie.reviews.length).toFixed(1);
    }

    res.json({
      ...movieDetails,
      flixmatchRating: averageRating, // 🔥 Ajoute la note moyenne locale
      reviews: movie ? movie.reviews : [],
    });

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

// 🔎 Route de recherche TMDB
app.get("/tmdb/search/:query", async (req, res) => {
  const { query } = req.params;

  try {
    console.log(`🔍 Recherche de : ${query}`);
    
    const response = await axios.get(
      `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&language=fr-FR`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data.results);
  } catch (error) {
    console.error("❌ Erreur recherche TMDB :", error?.response?.data || error);
    res.status(500).json({ error: "Erreur serveur TMDB" });
  }
});

// 📌 Charger les genres disponibles
app.get("/tmdb/genres", async (req, res) => {
  try {
    const response = await axios.get("https://api.themoviedb.org/3/genre/movie/list?language=fr-FR", {
      headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` },
    });
    res.json(response.data.genres);
  } catch (error) {
    console.error("❌ Erreur chargement genres :", error);
    res.status(500).json({ error: "Erreur serveur TMDB" });
  }
});

// 🔎 Recherche avancée
app.get("/tmdb/advanced-search", async (req, res) => {
  const { query, genre, year, minRating, maxDuration, page = 1 } = req.query;

  let filters = `language=fr-FR&page=${page}`;
  if (query) filters += `&query=${encodeURIComponent(query)}`;
  if (genre) filters += `&with_genres=${genre}`;
  if (year) filters += `&year=${year}`;
  if (minRating) filters += `&vote_average.gte=${minRating}`;
  if (maxDuration) filters += `&with_runtime.lte=${maxDuration}`;

  try {
    const response = await axios.get(`https://api.themoviedb.org/3/discover/movie?${filters}`, {
      headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` },
    });
    res.json(response.data);
  } catch (error) {
    console.error("❌ Erreur recherche avancée :", error);
    res.status(500).json({ error: "Erreur serveur TMDB" });
  }
});

app.post("/reviews", authMiddleware, async (req, res) => {
  const { movieId, comment, rating, parentId } = req.body;
  const userId = req.userId;

  console.log("📩 Requête reçue pour une review :", { movieId, comment, rating, parentId, userId });

  if (!comment) {
    return res.status(400).json({ error: "Le commentaire est requis" });
  }

  if (!userId) {
    return res.status(401).json({ error: "Utilisateur non authentifié" });
  }

  try {
    const reviewData = {
      comment,
      user: { connect: { id: userId } },
      movie: { connect: { tmdb_id: Number(movieId) } },
      parent: parentId ? { connect: { id: parentId } } : undefined,
      rating: parentId ? null : Number(rating), // ⬅️ ✅ Ne met PAS de rating si c'est une réponse
    };

    const review = await prisma.review.create({ data: reviewData });

    // 🔥 Mettre à jour la moyenne des notes SEULEMENT pour les avis principaux
    if (!parentId) {
      const avgRating = await prisma.review.aggregate({
        where: { movieId: Number(movieId), parentId: null }, // On exclut les réponses
        _avg: { rating: true },
        _count: { rating: true },
      });

      await prisma.movie.update({
        where: { tmdb_id: Number(movieId) },
        data: {
          rating: Math.round(avgRating._avg.rating * 10) / 10 || 0,
          ratingCount: avgRating._count.rating || 0,
        },
      });
    }

    res.status(201).json({ message: "Avis ajouté", review });
  } catch (error) {
    console.error("❌ Erreur ajout review :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


app.get("/reviews/:tmdbId", async (req, res) => {
  const { tmdbId } = req.params;

  try {
    const reviews = await prisma.review.findMany({
      where: { movie: { tmdb_id: Number(tmdbId) } }, 
      include: { user: true },
    });

    // Calculer la moyenne des notes
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    res.json({ reviews, avgRating });
  } catch (error) {
    console.error("❌ Erreur récupération avis :", error);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des avis" });
  }
});

app.post("/reviews/:movieId", authMiddleware, async (req, res) => {
  const { movieId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.userId;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "La note doit être entre 1 et 5." });
  }

  try {
    const review = await prisma.review.create({
      data: {
        movieId: Number(movieId),
        userId,
        rating: Number(rating),
        comment,
      },
    });

    res.status(201).json({ message: "Avis ajouté avec succès", review });
  } catch (error) {
    console.error("❌ Erreur ajout avis :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/reviews/:reviewId/replies", async (req, res) => {
  const { reviewId } = req.params;
  const { cursor, limit = 3 } = req.query; // `cursor` = dernière réponse chargée

  try {
    const replies = await prisma.review.findMany({
      where: { parentId: Number(reviewId) },
      include: {
        user: true,
        replies: {
          include: {
            user: true,
          },
          orderBy: { createdAt: "asc" },
          take: Number(limit),
        },
      },
      take: Number(limit) + 1, // On prend +1 pour voir s'il y a encore des réponses après
      ...(cursor ? { skip: 1, cursor: { id: Number(cursor) } } : {}), // Skip le premier si cursor
      orderBy: { createdAt: "asc" }, // Afficher du plus ancien au plus récent
    });

    const hasMore = replies.length > limit; // Vérifier s'il reste d'autres réponses
    if (hasMore) replies.pop(); // On enlève la réponse en trop

    res.json({ replies, hasMore, nextCursor: hasMore ? replies[replies.length - 1].id : null });
  } catch (error) {
    console.error("❌ Erreur récupération des réponses :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour mettre à jour le profil utilisateur
app.put("/account/update", authMiddleware, async (req, res) => {
  const { username } = req.body;
  const userId = req.userId;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { username },
    });

    res.status(200).json({ 
      message: "Profil mis à jour avec succès", 
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username
      }
    });
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du profil :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    tmdbKeyExists: Boolean(process.env.TMDB_API_KEY),
    tmdbKeyPrefix: process.env.TMDB_API_KEY ? `${process.env.TMDB_API_KEY.substring(0, 3)}...` : null
  });
});


// Servir les fichiers statiques du build
app.use(express.static(path.join(__dirname, 'dist')));

// Toutes les autres requêtes renvoient vers l'index.html (pour SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Démarrage du serveur
app.listen( () => {
  console.log(`Server running on port ${process.env.PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`TMDB API Key is ${process.env.TMDB_API_KEY ? 'defined' : 'NOT defined'}`);
  console.log(`Database URL is ${process.env.DATABASE_URL ? 'defined' : 'NOT defined'}`);
});

