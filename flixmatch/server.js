import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

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
  if (!token) return res.status(401).json({ error: "Accès refusé" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: "Token invalide" });
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

// 🔹 Obtenir la watchlist de l'utilisateur
app.get("/watchlist", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const watchlist = await prisma.watchlist.findMany({
      where: { userId },
      include: { movie: true },
    });

    res.json(watchlist);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 🔹 Ajouter un film à la watchlist
app.post("/watchlist", authMiddleware, async (req, res) => {
  const { tmdb_id, title, media_type, poster_path } = req.body;
  const userId = req.userId;

  try {
    let movie = await prisma.movie.findUnique({ where: { tmdb_id } });

    if (!movie) {
      movie = await prisma.movie.create({
        data: { tmdb_id, title, media_type, poster_path },
      });
    }

    const existingEntry = await prisma.watchlist.findFirst({
      where: { movieId: movie.id, userId },
    });

    if (existingEntry) {
      return res.status(400).json({ error: "Ce film est déjà dans la watchlist" });
    }

    await prisma.watchlist.create({
      data: { movieId: movie.id, userId },
    });

    res.status(201).json({ message: "Film ajouté à la watchlist" });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 🔹 Marquer un film comme vu
app.put("/watchlist/:movieId/seen", authMiddleware, async (req, res) => {
  const { movieId } = req.params;
  const userId = req.userId;

  try {
    await prisma.watchlist.updateMany({
      where: { movieId: Number(movieId), userId },
      data: { status: "SEEN" },
    });

    res.status(200).json({ message: "Film marqué comme vu" });
  } catch (error) {
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

app.listen(3000, () => console.log("Serveur en marche sur http://localhost:3000"));
