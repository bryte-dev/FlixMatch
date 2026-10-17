import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import axios from "axios";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

// En production, on refuse de démarrer sans la configuration indispensable.
const requiredEnv = ["JWT_SECRET", "DATABASE_PUBLIC_URL", "TMDB_API_KEY"];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  if (isProduction) {
    console.error(`Variables d'environnement manquantes : ${missingEnv.join(", ")}`);
    process.exit(1);
  }
  console.warn(`⚠️ Variables d'environnement manquantes (dev) : ${missingEnv.join(", ")}`);
}

// Hors production uniquement : secret éphémère aléatoire (jamais une valeur connue).
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const JWT_EXPIRES_IN = "7d";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";
// Accepte un token v4 (Bearer) ou une clé v3 (32 caractères hexadécimaux).
const TMDB_IS_V3_KEY = /^[a-f0-9]{32}$/i.test(TMDB_KEY);

const app = express();
const prisma = new PrismaClient();

app.disable("x-powered-by");
// L'hébergeur (Render, etc.) place l'application derrière un proxy HTTPS
app.set("trust proxy", 1);

// Déploiement same-origin : CORS n'est activé que si CORS_ORIGIN est défini (front séparé en dev).
if (process.env.CORS_ORIGIN) {
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
    })
  );
}

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};

// ---------- Frontend statique ----------

const distDir = path.join(__dirname, "dist");
const sendIndex = (res) =>
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Frontend non construit (npm run build)" });
  });

app.use(express.static(distDir));

// Certaines pages du front (/watchlist, /seen, ...) portent le même nom qu'une route API :
// une navigation navigateur (Accept: text/html) reçoit la SPA, les appels axios reçoivent le JSON.
app.get(["/watchlist", "/seen", "/favorites", "/junk"], (req, res, next) => {
  if (req.accepts(["json", "html"]) === "html") return sendIndex(res);
  next();
});

// ---------- Helpers ----------

const MAX_INT = 2147483647;

const parseId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= MAX_INT ? n : null;
};

const isValidRating = (value) => Number.isInteger(value) && value >= 1 && value <= 5;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanString = (value, max) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= max
    ? value.trim()
    : null;

const serverError = (res, label, error) => {
  console.error(`❌ ${label} :`, error?.code || error?.message || "erreur inconnue");
  return res.status(500).json({ error: "Erreur serveur" });
};

const publicUser = { id: true, username: true };
const withReplyCount = { _count: { select: { replies: true } } };

// Numéros de saison/épisode TMDB (0 = épisodes spéciaux)
const parseNumber = (value, max = 10000) => {
  const n = Number(value);
  return /^\d+$/.test(String(value)) && Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

const averageOf = (reviews) => {
  const rated = reviews.filter(
    (r) => r.parentId == null && r.rating != null
  );
  if (rated.length === 0) return null;
  return rated.reduce((sum, r) => sum + r.rating, 0) / rated.length;
};

const tmdbGet = async (route, params = {}) => {
  const response = await axios.get(`${TMDB_BASE_URL}${route}`, {
    params: TMDB_IS_V3_KEY ? { ...params, api_key: TMDB_KEY } : params,
    headers: TMDB_IS_V3_KEY ? {} : { Authorization: "Bearer " + TMDB_KEY },
    timeout: 10000,
  });
  return response.data;
};

// Petit cache mémoire pour éviter de marteler TMDB (saisons d'une série)
const seasonCache = new Map();
const SEASON_CACHE_TTL = 10 * 60 * 1000;
const getSeason = async (seriesId, seasonNumber) => {
  const key = `${seriesId}:${seasonNumber}`;
  const cached = seasonCache.get(key);
  if (cached && Date.now() - cached.at < SEASON_CACHE_TTL) return cached.data;

  const raw = await tmdbGet(`/tv/${seriesId}/season/${seasonNumber}`, { language: "fr-FR" });
  const data = {
    id: raw.id,
    season_number: raw.season_number,
    name: raw.name,
    overview: raw.overview || "",
    air_date: raw.air_date || null,
    poster_path: raw.poster_path || null,
    episodes: (raw.episodes || []).map((e) => ({
      id: e.id,
      episode_number: e.episode_number,
      name: e.name,
      overview: e.overview || "",
      air_date: e.air_date || null,
      runtime: e.runtime || null,
      still_path: e.still_path || null,
    })),
  };
  if (seasonCache.size > 500) seasonCache.clear();
  seasonCache.set(key, { at: Date.now(), data });
  return data;
};

const tmdbError = (res, label, error) => {
  console.error(`❌ ${label} :`, error?.response?.status || error?.message || "erreur inconnue");
  return res.status(502).json({ error: "Erreur serveur TMDB" });
};

// ---------- Anti brute-force (en mémoire, suffisant pour une démo mono-instance) ----------

const createRateLimit = (windowMs, max, message) => {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
      if (now - entry.start > windowMs) hits.delete(ip);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);
    if (!entry || now - entry.start > windowMs) {
      hits.set(req.ip, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) return res.status(429).json({ error: message });
    next();
  };
};

const authRateLimit = createRateLimit(15 * 60 * 1000, 30, "Trop de tentatives, réessaie plus tard");
// Limite générale pour les actions d'écriture (épisodes, suppression d'avis)
const actionRateLimit = createRateLimit(60 * 1000, 120, "Trop de requêtes, ralentis un peu");

// ---------- Auth ----------

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Accès refusé, token manquant" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
};

// ---------- Santé ----------

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- Utilisateurs ----------

app.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, username: true },
    });

    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    res.json(user);
  } catch (error) {
    serverError(res, "Erreur /me", error);
  }
});

app.post("/register", authRateLimit, async (req, res) => {
  const { email, password, username } = req.body || {};

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ error: "Email invalide" });
  }

  // bcrypt ne tient compte que des 72 premiers octets
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    return res
      .status(400)
      .json({ error: "Le mot de passe doit contenir entre 8 et 72 caractères" });
  }

  let cleanUsername = null;
  if (username !== undefined && username !== null && username !== "") {
    cleanUsername = cleanString(username, 50);
    if (!cleanUsername) {
      return res.status(400).json({ error: "Nom d'utilisateur invalide (50 caractères max)" });
    }
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, username: cleanUsername, password: hashedPassword },
    });

    res.status(201).json({ message: "Utilisateur créé", userId: user.id });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Un compte existe déjà avec cet email" });
    }
    serverError(res, "Erreur inscription", error);
  }
});

app.post("/login", authRateLimit, async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const isValid = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !isValid) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.cookie("token", token, { ...cookieOptions, maxAge: COOKIE_MAX_AGE });
    res.json({ message: "Connexion réussie", userId: user.id });
  } catch (error) {
    serverError(res, "Erreur connexion", error);
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOptions);
  res.json({ message: "Déconnexion réussie" });
});

app.put("/account/update", authMiddleware, async (req, res) => {
  const { username } = req.body || {};

  let cleanUsername = null;
  if (username !== undefined && username !== null && username !== "") {
    cleanUsername = cleanString(username, 50);
    if (!cleanUsername) {
      return res.status(400).json({ error: "Nom d'utilisateur invalide (50 caractères max)" });
    }
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: { username: cleanUsername },
    });

    res.status(200).json({
      message: "Profil mis à jour avec succès",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
      },
    });
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }
    serverError(res, "Erreur mise à jour profil", error);
  }
});

// ---------- Watchlist / vus / favoris / corbeille ----------

const listByFilter = (label, buildWhere) => async (req, res) => {
  try {
    const entries = await prisma.watchlist.findMany({
      where: { userId: req.userId, ...buildWhere },
      include: { movie: true },
    });
    res.json(entries);
  } catch (error) {
    serverError(res, label, error);
  }
};

app.get(
  "/watchlist",
  authMiddleware,
  listByFilter("Erreur récupération watchlist", { status: { not: "JUNK" } })
);
app.get("/seen", authMiddleware, listByFilter("Erreur récupération films vus", { status: "SEEN" }));
app.get("/favorites", authMiddleware, listByFilter("Erreur récupération favoris", { isFavorite: true }));
app.get("/junk", authMiddleware, listByFilter("Erreur récupération corbeille", { status: "JUNK" }));

app.post("/watchlist", authMiddleware, async (req, res) => {
  const { tmdb_id, title, media_type, poster_path } = req.body || {};
  const userId = req.userId;

  const tmdbId = parseId(tmdb_id);
  const cleanTitle = cleanString(title, 300);
  const cleanMediaType = cleanString(media_type, 20);
  if (!tmdbId || !cleanTitle || !cleanMediaType) {
    return res.status(400).json({ error: "tmdb_id, title et media_type valides sont requis" });
  }
  const cleanPoster = typeof poster_path === "string" ? poster_path.slice(0, 300) : "";

  try {
    const movie = await prisma.movie.upsert({
      where: { tmdb_id: tmdbId },
      update: {},
      create: {
        tmdb_id: tmdbId,
        title: cleanTitle,
        media_type: cleanMediaType,
        poster_path: cleanPoster,
      },
    });

    const existingEntry = await prisma.watchlist.findFirst({
      where: { movieId: movie.id, userId },
    });

    if (existingEntry) {
      return res.status(400).json({ error: "Ce film est déjà dans la watchlist", movieId: movie.id });
    }

    await prisma.watchlist.create({ data: { movieId: movie.id, userId } });
    res.status(201).json({ message: "Film ajouté à la watchlist", movieId: movie.id });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(400).json({ error: "Ce film est déjà dans la watchlist" });
    }
    serverError(res, "Erreur ajout watchlist", error);
  }
});

// Retire une entrée de la watchlist (annulation d'un swipe)
app.delete("/watchlist/:movieId", actionRateLimit, authMiddleware, async (req, res) => {
  const movieId = parseId(req.params.movieId);
  if (!movieId) return res.status(400).json({ error: "Identifiant de film invalide" });
  try {
    await prisma.watchlist.deleteMany({ where: { movieId, userId: req.userId } });
    res.json({ message: "Retiré de la bibliothèque" });
  } catch (error) {
    serverError(res, "Erreur suppression watchlist", error);
  }
});

// Statut d'un titre (id TMDB) dans la bibliothèque de l'utilisateur courant
app.get("/library/:tmdbId", actionRateLimit, authMiddleware, async (req, res) => {
  const tmdbId = parseId(req.params.tmdbId);
  if (!tmdbId) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    const entry = await prisma.watchlist.findFirst({
      where: { userId: req.userId, movie: { tmdb_id: tmdbId } },
    });
    res.json(
      entry
        ? {
            inLibrary: true,
            movieId: entry.movieId,
            status: entry.status,
            isFavorite: entry.isFavorite,
            rating: entry.rating,
          }
        : { inLibrary: false }
    );
  } catch (error) {
    serverError(res, "Erreur statut bibliothèque", error);
  }
});

// Met à jour une entrée de la watchlist de l'utilisateur
const updateEntry = (label, okMessage, buildData, { requireExisting = false, validate } = {}) =>
  async (req, res) => {
    const movieId = parseId(req.params.movieId);
    if (!movieId) return res.status(400).json({ error: "Identifiant de film invalide" });

    if (validate) {
      const error = validate(req);
      if (error) return res.status(400).json({ error });
    }

    try {
      const result = await prisma.watchlist.updateMany({
        where: { movieId, userId: req.userId },
        data: buildData(req),
      });

      if (result.count === 0 && requireExisting) {
        return res.status(404).json({ error: "Ce film n'est pas dans ta watchlist." });
      }

      res.status(200).json({ message: okMessage });
    } catch (error) {
      serverError(res, label, error);
    }
  };

app.put(
  "/watchlist/:movieId/seen",
  authMiddleware,
  updateEntry(
    "Erreur marquage comme vu",
    "Film marqué comme vu et retiré de la watchlist",
    () => ({ status: "SEEN" }),
    { requireExisting: true }
  )
);

app.put(
  "/seen/:movieId/remove",
  authMiddleware,
  updateEntry(
    "Erreur retrait de SEEN",
    "Film retiré de SEEN et remis dans la Watchlist",
    () => ({ status: "WATCHLIST" })
  )
);

app.put(
  "/watchlist/:movieId/favorite",
  authMiddleware,
  updateEntry(
    "Erreur mise à jour favoris",
    "Favoris mis à jour",
    (req) => ({ isFavorite: req.body.isFavorite }),
    {
      validate: (req) =>
        typeof req.body?.isFavorite === "boolean" ? null : "isFavorite doit être un booléen",
    }
  )
);

app.put(
  "/watchlist/:movieId/junk",
  authMiddleware,
  updateEntry("Erreur corbeille", "Film déplacé vers la corbeille", () => ({
    status: "JUNK",
    isFavorite: false,
  }))
);

app.put(
  "/junk/:movieId/restore",
  authMiddleware,
  updateEntry("Erreur restauration", "Film restauré dans la Watchlist", () => ({
    status: "WATCHLIST",
  }))
);

app.put("/seen/:movieId/rating", authMiddleware, async (req, res) => {
  const movieId = parseId(req.params.movieId);
  const rating = Number(req.body?.rating);

  if (!movieId) return res.status(400).json({ error: "Identifiant de film invalide" });
  if (!isValidRating(rating)) {
    return res.status(400).json({ error: "La note doit être un entier entre 1 et 5." });
  }

  try {
    const result = await prisma.watchlist.updateMany({
      where: { movieId, userId: req.userId, status: "SEEN" },
      data: { rating },
    });

    if (result.count === 0) {
      return res.status(400).json({ error: "Ce film n'est pas marqué comme vu." });
    }

    res.status(200).json({ message: "Note mise à jour" });
  } catch (error) {
    serverError(res, "Erreur mise à jour du rating", error);
  }
});

// ---------- TMDB (proxy : la clé reste côté serveur) ----------

const validType = (type) => ["movie", "tv"].includes(type);

app.get("/tmdb/trending", async (req, res) => {
  const page = parseId(req.query.page) || 1;
  try {
    const data = await tmdbGet("/trending/all/day", { language: "fr-CH", page: Math.min(page, 500) });
    res.json(data);
  } catch (error) {
    tmdbError(res, "Erreur tendances TMDB", error);
  }
});

app.get("/tmdb/details/:tmdbId/:type", async (req, res) => {
  const tmdbId = parseId(req.params.tmdbId);
  const { type } = req.params;

  if (!tmdbId) return res.status(400).json({ error: "Identifiant invalide" });
  if (!validType(type)) {
    return res.status(400).json({ error: "Type invalide, doit être 'movie' ou 'tv'" });
  }

  try {
    const movieDetails = await tmdbGet(`/${type}/${tmdbId}`, {
      language: "fr-FR",
      append_to_response: "credits,videos,images,watch/providers",
    });

    let reviews = [];
    try {
      const movie = await prisma.movie.findUnique({
        where: { tmdb_id: tmdbId },
        include: {
          reviews: {
            where: { parentId: null },
            include: { user: { select: publicUser }, ...withReplyCount },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      reviews = movie ? movie.reviews : [];
    } catch (error) {
      console.error("❌ Erreur lecture reviews :", error?.code || error?.message);
    }

    const average = averageOf(reviews);

    res.json({
      ...movieDetails,
      flixmatchRating: average === null ? null : average.toFixed(1),
      reviews,
    });
  } catch (error) {
    tmdbError(res, "Erreur détails TMDB", error);
  }
});

app.get("/tmdb/recommendations/:tmdbId/:type", async (req, res) => {
  const tmdbId = parseId(req.params.tmdbId);
  const { type } = req.params;

  if (!tmdbId) return res.status(400).json({ error: "Identifiant invalide" });
  if (!validType(type)) {
    return res.status(400).json({ error: "Type invalide, doit être 'movie' ou 'tv'" });
  }

  try {
    res.json(await tmdbGet(`/${type}/${tmdbId}/recommendations`, { language: "fr-FR" }));
  } catch (error) {
    tmdbError(res, "Erreur recommandations TMDB", error);
  }
});

app.get("/tmdb/search/:query", async (req, res) => {
  const query = cleanString(req.params.query, 200);
  if (!query) return res.status(400).json({ error: "Recherche invalide" });

  try {
    const data = await tmdbGet("/search/multi", { query, language: "fr-FR" });
    res.json(data.results);
  } catch (error) {
    tmdbError(res, "Erreur recherche TMDB", error);
  }
});

// Saisons d'une série (liste légère, sans les épisodes)
app.get("/tmdb/tv/:tmdbId/seasons", async (req, res) => {
  const tmdbId = parseId(req.params.tmdbId);
  if (!tmdbId) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    const show = await tmdbGet(`/tv/${tmdbId}`, { language: "fr-FR" });
    const seasons = (show.seasons || []).map((season) => ({
      id: season.id,
      season_number: season.season_number,
      name: season.name,
      episode_count: season.episode_count || 0,
      air_date: season.air_date || null,
      poster_path: season.poster_path || null,
    }));
    res.json({ id: show.id, name: show.name, seasons });
  } catch (error) {
    if (error?.response?.status === 404) return res.status(404).json({ error: "Série introuvable" });
    tmdbError(res, "Erreur saisons TMDB", error);
  }
});

// Épisodes d'une saison
app.get("/tmdb/tv/:tmdbId/season/:seasonNumber", async (req, res) => {
  const tmdbId = parseId(req.params.tmdbId);
  const seasonNumber = parseNumber(req.params.seasonNumber, 500);
  if (!tmdbId || seasonNumber === null) {
    return res.status(400).json({ error: "Identifiant ou numéro de saison invalide" });
  }

  try {
    res.json(await getSeason(tmdbId, seasonNumber));
  } catch (error) {
    if (error?.response?.status === 404) return res.status(404).json({ error: "Saison introuvable" });
    tmdbError(res, "Erreur épisodes TMDB", error);
  }
});

app.get("/tmdb/genres", async (req, res) => {
  try {
    const data = await tmdbGet("/genre/movie/list", { language: "fr-FR" });
    res.json(data.genres);
  } catch (error) {
    tmdbError(res, "Erreur chargement genres", error);
  }
});

app.get("/tmdb/advanced-search", async (req, res) => {
  const { query, genre, year, minRating, maxDuration } = req.query;
  const page = Math.min(parseId(req.query.page) || 1, 500);

  const params = { language: "fr-FR", page };
  if (typeof query === "string" && query.trim()) params.query = query.trim().slice(0, 200);
  if (genre !== undefined && genre !== "") {
    if (!/^\d+(,\d+)*$/.test(String(genre))) {
      return res.status(400).json({ error: "Genre invalide" });
    }
    params.with_genres = String(genre);
  }
  if (year !== undefined && year !== "") {
    if (!/^\d{4}$/.test(String(year))) return res.status(400).json({ error: "Année invalide" });
    params.year = String(year);
  }
  if (minRating !== undefined && minRating !== "") {
    const n = Number(minRating);
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      return res.status(400).json({ error: "Note minimale invalide" });
    }
    params["vote_average.gte"] = n;
  }
  if (maxDuration !== undefined && maxDuration !== "") {
    const n = Number(maxDuration);
    if (!Number.isInteger(n) || n < 0 || n > 1000) {
      return res.status(400).json({ error: "Durée maximale invalide" });
    }
    params["with_runtime.lte"] = n;
  }

  try {
    // `discover` ignore le titre : avec un texte, on cherche puis on filtre genre / note côté serveur
    if (params.query) {
      const data = await tmdbGet("/search/movie", {
        language: params.language,
        page,
        query: params.query,
        ...(params.year ? { year: params.year } : {}),
      });
      const genreIds = params.with_genres ? params.with_genres.split(",").map(Number) : [];
      const minVote = params["vote_average.gte"] ?? 0;
      const results = (data.results || []).filter(
        (m) =>
          (m.vote_average || 0) >= minVote &&
          genreIds.every((g) => (m.genre_ids || []).includes(g))
      );
      return res.json({ ...data, results });
    }
    res.json(await tmdbGet("/discover/movie", params));
  } catch (error) {
    tmdbError(res, "Erreur recherche avancée", error);
  }
});

// ---------- Découverte (swipe) & « Où regarder » ----------

const REGION_REGEX = /^[A-Z]{2}$/;
const LANG_REGEX = /^[a-z]{2}-[A-Z]{2}$/;
const SORTS = ["popularity.desc", "vote_average.desc", "primary_release_date.desc"];

app.get("/tmdb/discover", async (req, res) => {
  const type = req.query.type === "tv" ? "tv" : "movie";
  const page = Math.min(parseId(req.query.page) || 1, 500);
  const language = LANG_REGEX.test(req.query.lang) ? req.query.lang : "fr-FR";
  const params = {
    language,
    page,
    include_adult: req.query.adult === "true",
    "vote_count.gte": 100,
    sort_by: SORTS.includes(req.query.sort) ? req.query.sort : "popularity.desc",
  };
  if (req.query.genre) {
    if (!/^\d+(,\d+)*$/.test(String(req.query.genre))) return res.status(400).json({ error: "Genre invalide" });
    params.with_genres = String(req.query.genre);
  }
  if (req.query.providers) {
    if (!/^\d+(\|\d+)*$/.test(String(req.query.providers))) return res.status(400).json({ error: "Plateformes invalides" });
    const region = REGION_REGEX.test(req.query.region) ? req.query.region : "FR";
    params.with_watch_providers = String(req.query.providers);
    params.watch_region = region;
    params.with_watch_monetization_types = "flatrate";
  }
  try {
    const data = await tmdbGet(`/discover/${type}`, params);
    res.json({
      ...data,
      results: (data.results || []).map((r) => ({ ...r, media_type: type })),
    });
  } catch (error) {
    tmdbError(res, "Erreur découverte TMDB", error);
  }
});

app.get("/tmdb/providers/:type", async (req, res) => {
  if (!validType(req.params.type)) return res.status(400).json({ error: "Type invalide" });
  const region = REGION_REGEX.test(req.query.region) ? req.query.region : "FR";
  try {
    const data = await tmdbGet(`/watch/providers/${req.params.type}`, { watch_region: region, language: "fr-FR" });
    res.json(
      (data.results || [])
        .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
        .map((p) => ({ id: p.provider_id, name: p.provider_name, logo_path: p.logo_path }))
    );
  } catch (error) {
    tmdbError(res, "Erreur plateformes TMDB", error);
  }
});

// Où regarder un titre dans une région (données JustWatch fournies par TMDB)
app.get("/tmdb/watch/:type/:tmdbId", async (req, res) => {
  const tmdbId = parseId(req.params.tmdbId);
  if (!tmdbId || !validType(req.params.type)) return res.status(400).json({ error: "Paramètres invalides" });
  const region = REGION_REGEX.test(req.query.region) ? req.query.region : "FR";
  try {
    const data = await tmdbGet(`/${req.params.type}/${tmdbId}/watch/providers`);
    const entry = data.results?.[region] || {};
    res.json({
      region,
      link: entry.link || null,
      flatrate: entry.flatrate || [],
      rent: entry.rent || [],
      buy: entry.buy || [],
    });
  } catch (error) {
    tmdbError(res, "Erreur où regarder TMDB", error);
  }
});

// ---------- Reviews ----------

// Note moyenne calculée à la volée : uniquement les avis principaux notés
app.get("/reviews/:tmdbId", async (req, res) => {
  const tmdbId = parseId(req.params.tmdbId);
  if (!tmdbId) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    const reviews = await prisma.review.findMany({
      where: { movie: { tmdb_id: tmdbId }, parentId: null },
      include: { user: { select: publicUser }, ...withReplyCount },
      orderBy: { createdAt: "desc" },
    });

    res.json({ reviews, avgRating: averageOf(reviews) });
  } catch (error) {
    serverError(res, "Erreur récupération avis", error);
  }
});

// Avis principal ou réponse, identifié par l'id TMDB du film
app.post("/reviews", authMiddleware, async (req, res) => {
  const { movieId, title, media_type, poster_path, comment, rating, parentId } = req.body || {};
  const userId = req.userId;

  const tmdbId = parseId(movieId);
  const cleanComment = cleanString(comment, 2000);
  if (!tmdbId) return res.status(400).json({ error: "Identifiant de film invalide" });
  if (!cleanComment) {
    return res.status(400).json({ error: "Le commentaire est requis (2000 caractères max)" });
  }

  const isReply = parentId !== undefined && parentId !== null;
  const parent = isReply ? parseId(parentId) : null;
  if (isReply && !parent) return res.status(400).json({ error: "parentId invalide" });
  if (!isReply && !isValidRating(Number(rating))) {
    return res.status(400).json({ error: "La note doit être un entier entre 1 et 5." });
  }

  try {
    let movie = await prisma.movie.findUnique({ where: { tmdb_id: tmdbId } });
    if (!movie) {
      const cleanTitle = cleanString(title, 300);
      if (!cleanTitle) return res.status(404).json({ error: "Film introuvable" });
      movie = await prisma.movie.upsert({
        where: { tmdb_id: tmdbId },
        update: {},
        create: {
          tmdb_id: tmdbId,
          title: cleanTitle,
          media_type: cleanString(media_type, 20) || "movie",
          poster_path: typeof poster_path === "string" ? poster_path.slice(0, 300) : "",
        },
      });
    }

    if (isReply) {
      const parentReview = await prisma.review.findUnique({ where: { id: parent } });
      if (!parentReview || parentReview.movieId !== movie.id) {
        return res.status(404).json({ error: "Avis parent introuvable" });
      }
    }

    const review = await prisma.review.create({
      data: {
        comment: cleanComment,
        userId,
        movieId: movie.id,
        parentId: isReply ? parent : null,
        rating: isReply ? null : Number(rating),
      },
      include: { user: { select: publicUser }, ...withReplyCount },
    });

    res.status(201).json({ message: "Avis ajouté", review });
  } catch (error) {
    serverError(res, "Erreur ajout review", error);
  }
});

// Avis principal sur un film identifié par son id interne (page « Vus »)
app.post("/reviews/:movieId", authMiddleware, async (req, res) => {
  const movieId = parseId(req.params.movieId);
  const rating = Number(req.body?.rating);
  const comment = cleanString(req.body?.comment, 2000);

  if (!movieId) return res.status(400).json({ error: "Identifiant de film invalide" });
  if (!isValidRating(rating)) {
    return res.status(400).json({ error: "La note doit être un entier entre 1 et 5." });
  }
  if (!comment) {
    return res.status(400).json({ error: "Le commentaire est requis (2000 caractères max)" });
  }

  try {
    const movie = await prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie) return res.status(404).json({ error: "Film introuvable" });

    const review = await prisma.review.create({
      data: { movieId, userId: req.userId, rating, comment },
    });

    res.status(201).json({ message: "Avis ajouté avec succès", review });
  } catch (error) {
    serverError(res, "Erreur ajout avis", error);
  }
});

app.get("/reviews/:reviewId/replies", async (req, res) => {
  const reviewId = parseId(req.params.reviewId);
  if (!reviewId) return res.status(400).json({ error: "Identifiant invalide" });

  const limit = Math.min(parseId(req.query.limit) || 3, 50);
  const cursor = req.query.cursor !== undefined ? parseId(req.query.cursor) : null;
  if (req.query.cursor !== undefined && !cursor) {
    return res.status(400).json({ error: "Curseur invalide" });
  }

  try {
    const replies = await prisma.review.findMany({
      where: { parentId: reviewId },
      include: { user: { select: publicUser }, ...withReplyCount },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "asc" },
    });

    const hasMore = replies.length > limit;
    if (hasMore) replies.pop();

    res.json({ replies, hasMore, nextCursor: hasMore ? replies[replies.length - 1].id : null });
  } catch (error) {
    serverError(res, "Erreur récupération des réponses", error);
  }
});

// Supprime un avis ou une réponse, uniquement par son auteur.
// Un avis qui a des réponses ne peut pas être supprimé (cela détacherait les réponses des autres).
app.delete("/reviews/:reviewId", actionRateLimit, authMiddleware, async (req, res) => {
  const reviewId = parseId(req.params.reviewId);
  if (!reviewId) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: withReplyCount,
    });
    if (!review) return res.status(404).json({ error: "Avis introuvable" });
    if (review.userId !== req.userId) {
      return res.status(403).json({ error: "Tu ne peux supprimer que tes propres avis" });
    }
    if (review._count.replies > 0) {
      return res.status(409).json({
        error: "Cet avis a des réponses : il ne peut pas être supprimé.",
      });
    }

    await prisma.review.delete({ where: { id: reviewId } });
    res.json({ message: "Avis supprimé" });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "Avis introuvable" });
    serverError(res, "Erreur suppression avis", error);
  }
});

// ---------- Suivi des épisodes ----------

const episodeSelect = { seasonNumber: true, episodeNumber: true, watchedAt: true };

// Nombre d'épisodes vus par série (pour les listes « À voir » / « Vus »)
app.get("/episodes", actionRateLimit, authMiddleware, async (req, res) => {
  try {
    const groups = await prisma.episodeWatch.groupBy({
      by: ["tmdbSeriesId"],
      where: { userId: req.userId },
      _count: { _all: true },
    });
    res.json(groups.map((g) => ({ tmdbSeriesId: g.tmdbSeriesId, watchedCount: g._count._all })));
  } catch (error) {
    serverError(res, "Erreur récapitulatif épisodes", error);
  }
});

// Épisodes vus d'une série par l'utilisateur courant
app.get("/episodes/:seriesId", actionRateLimit, authMiddleware, async (req, res) => {
  const seriesId = parseId(req.params.seriesId);
  if (!seriesId) return res.status(400).json({ error: "Identifiant de série invalide" });

  try {
    const watched = await prisma.episodeWatch.findMany({
      where: { userId: req.userId, tmdbSeriesId: seriesId },
      select: episodeSelect,
      orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
    });
    res.json({ watched });
  } catch (error) {
    serverError(res, "Erreur récupération épisodes vus", error);
  }
});

// Marque une saison entière comme vue / non vue (déclaré avant la route épisode)
app.put("/episodes/:seriesId/season/:seasonNumber", actionRateLimit, authMiddleware, async (req, res) => {
  const seriesId = parseId(req.params.seriesId);
  const seasonNumber = parseNumber(req.params.seasonNumber, 500);
  if (!seriesId || seasonNumber === null) {
    return res.status(400).json({ error: "Identifiant ou numéro de saison invalide" });
  }
  if (typeof req.body?.watched !== "boolean") {
    return res.status(400).json({ error: "watched doit être un booléen" });
  }

  try {
    if (!req.body.watched) {
      await prisma.episodeWatch.deleteMany({
        where: { userId: req.userId, tmdbSeriesId: seriesId, seasonNumber },
      });
    } else {
      const season = await getSeason(seriesId, seasonNumber).catch((error) => {
        throw Object.assign(error, { isTmdb: true });
      });
      await prisma.episodeWatch.createMany({
        data: season.episodes.map((e) => ({
          userId: req.userId,
          tmdbSeriesId: seriesId,
          seasonNumber,
          episodeNumber: e.episode_number,
          tmdbEpisodeId: e.id,
          name: e.name ? String(e.name).slice(0, 300) : null,
          runtime: e.runtime,
        })),
        skipDuplicates: true,
      });
    }

    const watched = await prisma.episodeWatch.findMany({
      where: { userId: req.userId, tmdbSeriesId: seriesId, seasonNumber },
      select: episodeSelect,
      orderBy: { episodeNumber: "asc" },
    });
    res.json({ watched });
  } catch (error) {
    if (error?.isTmdb) {
      if (error?.response?.status === 404) return res.status(404).json({ error: "Saison introuvable" });
      return tmdbError(res, "Erreur saison TMDB", error);
    }
    serverError(res, "Erreur mise à jour de la saison", error);
  }
});

// Marque un épisode vu / non vu
app.put("/episodes/:seriesId/:seasonNumber/:episodeNumber", actionRateLimit, authMiddleware, async (req, res) => {
  const seriesId = parseId(req.params.seriesId);
  const seasonNumber = parseNumber(req.params.seasonNumber, 500);
  const episodeNumber = parseId(req.params.episodeNumber);
  if (!seriesId || seasonNumber === null || !episodeNumber) {
    return res.status(400).json({ error: "Identifiants de série, saison ou épisode invalides" });
  }
  if (typeof req.body?.watched !== "boolean") {
    return res.status(400).json({ error: "watched doit être un booléen" });
  }

  const key = {
    userId_tmdbSeriesId_seasonNumber_episodeNumber: {
      userId: req.userId,
      tmdbSeriesId: seriesId,
      seasonNumber,
      episodeNumber,
    },
  };

  try {
    if (!req.body.watched) {
      await prisma.episodeWatch.deleteMany({
        where: { userId: req.userId, tmdbSeriesId: seriesId, seasonNumber, episodeNumber },
      });
      return res.json({ seasonNumber, episodeNumber, watched: false });
    }

    let episode;
    try {
      const season = await getSeason(seriesId, seasonNumber);
      episode = season.episodes.find((e) => e.episode_number === episodeNumber);
    } catch (error) {
      if (error?.response?.status === 404) return res.status(404).json({ error: "Épisode introuvable" });
      return tmdbError(res, "Erreur épisode TMDB", error);
    }
    if (!episode) return res.status(404).json({ error: "Épisode introuvable" });

    const entry = await prisma.episodeWatch.upsert({
      where: key,
      update: {},
      create: {
        userId: req.userId,
        tmdbSeriesId: seriesId,
        seasonNumber,
        episodeNumber,
        tmdbEpisodeId: episode.id,
        name: episode.name ? String(episode.name).slice(0, 300) : null,
        runtime: episode.runtime,
      },
      select: episodeSelect,
    });
    res.json({ ...entry, watched: true });
  } catch (error) {
    serverError(res, "Erreur mise à jour de l'épisode", error);
  }
});

// ---------- Fallback SPA ----------

// Les requêtes non-HTML (appels API) vers une route inconnue reçoivent un 404 JSON
app.get("*", (req, res, next) => {
  if (req.accepts(["json", "html"]) !== "html") return next();
  sendIndex(res);
});

app.use((req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON invalide" });
  }
  console.error("❌ Erreur non gérée :", err?.message);
  res.status(500).json({ error: "Erreur serveur" });
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
