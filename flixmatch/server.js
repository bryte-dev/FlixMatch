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
      where: { status: "WATCHLIST" }, // Assure-toi qu'on récupère bien tous les films, même sans isFavorite
      include: { movie: true },
    });

    res.json(watchlist);
  } catch (error) {
    console.error("Erreur lors de la récupération de la watchlist :", error);
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
      data: { status: "JUNK", isFavorite: false },
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
    const updatedMovie = await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { isFavorite },
    });

    res.status(200).json({ message: "Favoris mis à jour", updatedMovie });
  } catch (error) {
    console.error("Erreur lors de la mise à jour des favoris :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});



app.put("/favorites/:movieId/remove", async (req, res) => {
  const { movieId } = req.params;

  try {
    const updatedMovie = await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { isFavorite: false, status: "WATCHLIST" }, // 🔥 Assure-toi qu'il reste en WATCHLIST
    });

    res.status(200).json({ message: "Film retiré des favoris et maintenu dans la Watchlist", updatedMovie });
  } catch (error) {
    console.error("Erreur lors du retrait des favoris :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});



app.get("/favorites", async (req, res) => {
  try {
    const favorites = await prisma.watchlist.findMany({
      where: { isFavorite: true }, // On récupère uniquement les favoris
      include: { movie: true }, // Inclure les infos du film
    });

    res.json(favorites);
  } catch (error) {
    console.error("Erreur lors de la récupération des favoris :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// Route pour marquer un film comme vu
app.put("/watchlist/:movieId/seen", async (req, res) => {
  const { movieId } = req.params;

  try {
    // Mettre à jour le statut du film
    await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { status: "SEEN" },
    });

    res.status(200).json({ message: "Film marqué comme vu et déplacé vers Seen" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour retirer un film vu
app.put("/seen/:movieId/remove", async (req, res) => {
  const { movieId } = req.params;

  try {
    // Mettre à jour le statut du film
    await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { status: "WATCHLIST" },
    });

    res.status(200).json({ message: "Film marqué comme vu et déplacé vers Seen" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour récupérer les films vus
app.get("/seen", async (req, res) => {
  try {
    const seenMovies = await prisma.watchlist.findMany({
      where: { status: "SEEN" },
      include: { movie: true },
    });

    res.json(seenMovies);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Mettre à jour la note et l'avis dans la page Seen
app.put("/seen/:movieId/rating", async (req, res) => {
  const { movieId } = req.params;
  const { rating } = req.body;

  try {
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "La note doit être entre 1 et 5." });
    }

    const updatedMovie = await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { rating: rating },
    });

    res.status(200).json({ message: "Note mise à jour", updatedMovie });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du rating", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Mettre à jour l'avis du film
app.put("/seen/:movieId/review", async (req, res) => {
  const { movieId } = req.params;
  const { review } = req.body;

  try {
    const updatedMovie = await prisma.watchlist.update({
      where: { movieId: Number(movieId) },
      data: { review: review },
    });

    res.status(200).json({ message: "Avis mis à jour", updatedMovie });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'avis", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


app.listen(3000, () => console.log("Serveur en marche sur http://localhost:3000"));
