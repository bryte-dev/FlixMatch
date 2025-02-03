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

app.listen(3000, () => console.log("Serveur en marche sur http://localhost:3000"));
