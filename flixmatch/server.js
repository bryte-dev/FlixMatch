import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// Route pour tester la connexion
app.get("/", async (req, res) => {
  const movies = await prisma.movie.findMany();
  res.json(movies);
});

// Mettre dans la Watchlist
app.post("/watchlist", async (req, res) => {
  const { tmdb_id, title, media_type, poster_path } = req.body;

  try {
    let movie = await prisma.movie.findUnique({ where: { tmdb_id } });

    if (!movie) {
      movie = await prisma.movie.create({
        data: { tmdb_id, title, media_type, poster_path },
      });
    }

    const existingEntry = await prisma.watchlist.findUnique({
      where: { movieId: movie.id },
    });

    if (existingEntry) {
      return res.status(400).json({ message: "Ce film est déjà dans la watchlist" });
    }

    await prisma.watchlist.create({
      data: { movieId: movie.id },
    });

    res.status(201).json({ message: "Film ajouté à la watchlist" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Obtenir la watchlist
app.get("/watchlist", async (req, res) => {
  try {
    const watchlist = await prisma.watchlist.findMany({
      where: { status: "WATCHLIST" },
      include: { movie: true },
    });

    res.json(watchlist);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Déplacer un film vers la corbeille (junklist)
app.put("/watchlist/:movieId/junk", async (req, res) => {
  const { movieId } = req.params;

  try {
    const watchlistEntry = await prisma.watchlist.findUnique({
      where: { movieId: Number(movieId) },
    });

    if (!watchlistEntry) {
      return res.status(404).json({ message: "Film non trouvé dans la watchlist" });
    }

    await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { status: "JUNK" },
    });

    res.status(200).json({ message: "Film déplacé vers la corbeille" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Obtenir la junklist
app.get("/junk", async (req, res) => {
  try {
    const junklist = await prisma.watchlist.findMany({
      where: { status: "JUNK" },
      include: { movie: true },
    });

    res.json(junklist);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Restaurer un film depuis la corbeille
app.put("/junk/:movieId/restore", async (req, res) => {
  const { movieId } = req.params;

  try {
    const junkEntry = await prisma.watchlist.findUnique({
      where: { movieId: Number(movieId) },
    });

    if (!junkEntry) {
      return res.status(404).json({ message: "Film non trouvé dans la corbeille" });
    }

    await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { status: "WATCHLIST" },
    });

    res.status(200).json({ message: "Film restauré dans la Watchlist" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.put("/watchlist/:movieId/favorite", async (req, res) => {
  const { movieId } = req.params;
  const { isFavorite } = req.body;

  try {
    const watchlistEntry = await prisma.watchlist.findUnique({
      where: { movieId: Number(movieId) },
    });

    if (!watchlistEntry) {
      return res.status(404).json({ message: "Film non trouvé dans la watchlist" });
    }

    // 🔥 Correction : Mise à jour correcte avec return des nouvelles données
    const updatedEntry = await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { isFavorite },
      include: { movie: true },
    });

    res.status(200).json(updatedEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// Marquer un film comme vu
app.put("/watchlist/:movieId/seen", async (req, res) => {
  const { movieId } = req.params;

  try {
    await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { status: "SEEN" },
    });

    res.status(200).json({ message: "Film marqué comme vu" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Noter un film (seulement s'il est marqué comme SEEN)
app.put("/watchlist/:movieId/rating", async (req, res) => {
  const { movieId } = req.params;
  const { rating } = req.body;

  try {
    const watchlistEntry = await prisma.watchlist.findUnique({
      where: { movieId: Number(movieId) },
    });

    if (!watchlistEntry) {
      return res.status(404).json({ message: "Film non trouvé dans la watchlist" });
    }

    if (watchlistEntry.status !== "SEEN") {
      return res.status(400).json({ message: "Tu dois d'abord marquer ce film comme vu avant de le noter" });
    }

    await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { rating: Number(rating) },
    });

    res.status(200).json({ message: "Note mise à jour" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


app.listen(3000, () => console.log("Serveur en marche sur http://localhost:3000"));
