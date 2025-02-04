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

// Ajouter un film à la watchlist
app.post("/watchlist", async (req, res) => {
  const { tmdb_id, title, media_type, poster_path } = req.body;
  
  const existingEntry = await prisma.watchlist.findUnique({
    where: { movieId: tmdb_id },
  });
  if (existingEntry) {
    return res.status(400).json({ message: "Ce film est déjà dans la watchlist" });
  }
  
  try {
    let movie = await prisma.movie.findUnique({ where: { tmdb_id } });

    if (!movie) {
      movie = await prisma.movie.create({
        data: { tmdb_id, title, media_type, poster_path },
      });
    }

    await prisma.watchlist.create({ data: { movieId: movie.id } });

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

    // Mettre à jour le statut du film à JUNK
    const updatedEntry = await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { status: "JUNK" },
    });

    res.status(200).json({ message: "Film déplacé vers la corbeille" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.listen(3000, () => console.log("Serveur en marche sur http://localhost:3000"));
