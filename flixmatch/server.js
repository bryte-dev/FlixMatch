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
import { isAired } from "./src/lib/episodes.js";
import { getImdbRating } from "./services/omdb.js";
import { mergeSearchResults } from "./src/lib/searchMerge.js";
import { MAX_COMMIT_BATCH, MAX_RESOLVE_BATCH, createImporter, sanitizeCommitItem, sanitizeResolveItem } from "./services/importer.js";

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
// Algorithme imposé à la vérification : refuse tout autre "alg" (dont "none")
const JWT_VERIFY_OPTIONS = { algorithms: ["HS256"] };
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
// Hash factice : même coût bcrypt si l'email n'existe pas (limite l'énumération par timing)
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("flixmatch-timing-dummy", 10);

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

// Corps JSON limités à 100 ko, sauf les lots d'import (épisodes nombreux)
const jsonSmall = express.json({ limit: "100kb" });
const jsonImport = express.json({ limit: "2mb" });
app.use((req, res, next) => (req.path.startsWith("/import/") ? jsonImport : jsonSmall)(req, res, next));
app.use(cookieParser());

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};

// ---------- Sécurité : en-têtes HTTP ----------
// Déclaré avant express.static pour que la page HTML et les fichiers statiques reçoivent aussi la CSP.

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    // Le service worker récupère lui-même les affiches TMDB : connect-src doit l'autoriser
    const connectSrc = ["'self'", "https://image.tmdb.org"];
    // PostHog : hôte configuré, ou hôte EU par défaut si seule la clé est fournie (cf. src/lib/analytics.js)
    const posthogKey = process.env.VITE_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost = process.env.VITE_POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || (posthogKey ? "https://eu.i.posthog.com" : "");
    for (const raw of [posthogHost]) {
      if (!raw) continue;
      try {
        connectSrc.push(new URL(raw).origin);
      } catch {
        /* host analytics ignoré si l'URL est invalide */
      }
    }
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "manifest-src 'self'",
        "worker-src 'self'",
        "img-src 'self' data: blob: https://image.tmdb.org https://www.themoviedb.org",
        "frame-src https://www.youtube-nocookie.com",
        `connect-src ${connectSrc.join(" ")}`,
      ].join("; ")
    );
  }
  next();
});

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
const validMediaType = (value) => (value === "movie" || value === "tv" ? value : null);

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
const REGION_REGEX = /^[A-Z]{2}$/;
const LANG_REGEX = /^[a-z]{2}-[A-Z]{2}$/;
const langOf = (value) => (LANG_REGEX.test(value) ? value : "fr-FR");

const parseNumber = (value, max = 10000) => {
  const n = Number(value);
  return /^\d+$/.test(String(value)) && Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

const countRated = (reviews) => reviews.filter((r) => r.parentId == null && r.rating != null).length;

const averageOf = (reviews) => {
  const rated = reviews.filter(
    (r) => r.parentId == null && r.rating != null
  );
  if (rated.length === 0) return null;
  return rated.reduce((sum, r) => sum + r.rating, 0) / rated.length;
};

const TMDB_TIMEOUT_MS = 8000;
const isTransient = (error) => {
  const status = error?.response?.status;
  return !status || status === 429 || status >= 500;
};

// Appel TMDB avec un nouvel essai court sur erreur passagère (réseau, 429, 5xx)
const tmdbGet = async (route, params = {}) => {
  const request = () =>
    axios.get(`${TMDB_BASE_URL}${route}`, {
      params: TMDB_IS_V3_KEY ? { ...params, api_key: TMDB_KEY } : params,
      headers: TMDB_IS_V3_KEY ? {} : { Authorization: "Bearer " + TMDB_KEY },
      timeout: TMDB_TIMEOUT_MS,
    });
  try {
    return (await request()).data;
  } catch (error) {
    if (!isTransient(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, error?.response?.status === 429 ? 1000 : 300));
    return (await request()).data;
  }
};

// Cache mémoire des réponses TMDB peu changeantes. Si TMDB est lent ou en panne, on ressert
// la dernière réponse connue (même expirée) plutôt qu'une erreur.
const tmdbCache = new Map();
const TMDB_CACHE_MAX = 800;
const tmdbCached = async (route, params, ttlMs, transform = (d) => d) => {
  const key = route + "?" + JSON.stringify(params);
  const hit = tmdbCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  try {
    const data = transform(await tmdbGet(route, params));
    tmdbCache.delete(key);
    tmdbCache.set(key, { at: Date.now(), data });
    if (tmdbCache.size > TMDB_CACHE_MAX) tmdbCache.delete(tmdbCache.keys().next().value);
    return data;
  } catch (error) {
    if (hit && isTransient(error)) return hit.data;
    throw error;
  }
};
const MINUTE = 60 * 1000;

// Fiche détaillée allégée : seuls les champs affichés sont gardés (réponse et cache plus légers)
const slimDetails = (d) => ({
  ...d,
  credits: d.credits
    ? {
        cast: (d.credits.cast || []).slice(0, 20),
        crew: (d.credits.crew || []).filter((p) => p.job === "Director"),
      }
    : undefined,
  videos: d.videos ? { results: (d.videos.results || []).filter((v) => v.site === "YouTube").slice(0, 12) } : undefined,
});

// Petit cache mémoire pour éviter de marteler TMDB (saisons d'une série)
const seasonCache = new Map();
const SEASON_CACHE_TTL = 10 * 60 * 1000;
const getSeason = async (seriesId, seasonNumber, language = "fr-FR") => {
  const key = `${seriesId}:${seasonNumber}:${language}`;
  const cached = seasonCache.get(key);
  if (cached && Date.now() - cached.at < SEASON_CACHE_TTL) return cached.data;

  const raw = await tmdbGet(`/tv/${seriesId}/season/${seasonNumber}`, { language });
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
const searchRateLimit = createRateLimit(60 * 1000, 60, "Trop de recherches, ralentis un peu");
const reviewRateLimit = createRateLimit(60 * 1000, 30, "Trop d'avis, ralentis un peu");
const importRateLimit = createRateLimit(60 * 1000, 90, "Import trop rapide, patiente quelques secondes");
const exportRateLimit = createRateLimit(60 * 1000, 10, "Trop d'exports, réessaie dans une minute");


// ---------- Sécurité : limitation globale, protection CSRF ----------

// Les requêtes qui modifient des données doivent venir de notre propre origine (ou de CORS_ORIGIN)
const allowedOrigins = new Set((process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean));
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // appels non navigateur (curl, tests) : pas de cookie ambiant à exploiter
  let host = "";
  try {
    host = new URL(origin).host;
  } catch {
    return res.status(403).json({ error: "Origine refusée" });
  }
  if (host === req.headers.host || allowedOrigins.has(origin)) return next();
  res.status(403).json({ error: "Origine refusée" });
});

// Limite globale par IP sur l'API (en plus des limites dédiées plus strictes)
app.use(createRateLimit(60 * 1000, 600, "Trop de requêtes, ralentis un peu"));

// ---------- Auth ----------

const authMiddleware = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Accès refusé, token manquant" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS);
    const userId = parseId(decoded.userId);
    if (!userId) return res.status(401).json({ error: "Token invalide ou expiré" });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      res.clearCookie("token", cookieOptions);
      return res.status(401).json({ error: "Token invalide ou expiré" });
    }
    req.userId = userId;
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
      select: { id: true, email: true, username: true, avatar: true, privacyProfile: true, privacyLibrary: true, privacyActivity: true },
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
      return res.status(409).json({ error: "Impossible de créer le compte avec ces informations" });
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
    const isValid = await bcrypt.compare(password, user?.password || DUMMY_PASSWORD_HASH);
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

const PRIVACY_LEVELS = ["public", "friends", "private"];
const AVATAR_REGEX = /^(preset:[a-z0-9-]{1,20}|generated|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/;
const MAX_AVATAR_LENGTH = 70000;
const accountSelect = { id: true, email: true, username: true, avatar: true, privacyProfile: true, privacyLibrary: true, privacyActivity: true };

app.put("/account/update", actionRateLimit, authMiddleware, async (req, res) => {
  const { username, avatar, privacyProfile, privacyLibrary, privacyActivity } = req.body || {};
  const data = {};

  if (username !== undefined) {
    if (username === null || username === "") data.username = null;
    else {
      data.username = cleanString(username, 50);
      if (!data.username) return res.status(400).json({ error: "Nom d'utilisateur invalide (50 caractères max)" });
    }
  }
  if (avatar !== undefined) {
    if (avatar === null || avatar === "") data.avatar = null;
    else if (typeof avatar === "string" && avatar.length <= MAX_AVATAR_LENGTH && AVATAR_REGEX.test(avatar)) data.avatar = avatar;
    else return res.status(400).json({ error: "Avatar invalide (image 70 Ko max)" });
  }
  for (const [field, value] of Object.entries({ privacyProfile, privacyLibrary, privacyActivity })) {
    if (value === undefined) continue;
    if (!PRIVACY_LEVELS.includes(value)) return res.status(400).json({ error: "Niveau de confidentialité invalide" });
    data[field] = value;
  }

  try {
    const updatedUser = await prisma.user.update({ where: { id: req.userId }, data, select: accountSelect });
    res.status(200).json({ message: "Profil mis à jour avec succès", user: updatedUser });
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }
    serverError(res, "Erreur mise à jour profil", error);
  }
});

// Avis de l'utilisateur + tout le fil de réponses qui en dépend : sinon les réponses
// d'autres personnes deviendraient des avis principaux orphelins (parentId → NULL).
const collectReviewThreads = async (tx, userId) => {
  const ids = new Set((await tx.review.findMany({ where: { userId }, select: { id: true } })).map((r) => r.id));
  let frontier = [...ids];
  while (frontier.length > 0) {
    const children = await tx.review.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
    frontier = children.map((c) => c.id).filter((id) => !ids.has(id));
    frontier.forEach((id) => ids.add(id));
  }
  return [...ids];
};

const wipeUserLibrary = async (tx, userId) => {
  const reviewIds = await collectReviewThreads(tx, userId);
  if (reviewIds.length > 0) await tx.review.deleteMany({ where: { id: { in: reviewIds } } });
  await tx.episodeWatch.deleteMany({ where: { userId } });
  await tx.watchlist.deleteMany({ where: { userId } });
};

const ACCOUNT_TX = { timeout: 20000, maxWait: 10000 };

// Réinitialise listes, notes, avis et historique d'épisodes (le compte est conservé)
app.post("/account/reset-data", authRateLimit, authMiddleware, async (req, res) => {
  if (req.body?.confirm !== "RESET") {
    return res.status(400).json({ error: "Confirmation invalide : envoie confirm=\"RESET\"" });
  }
  try {
    await prisma.$transaction((tx) => wipeUserLibrary(tx, req.userId), ACCOUNT_TX);
    res.json({ message: "Données réinitialisées" });
  } catch (error) {
    serverError(res, "Erreur réinitialisation des données", error);
  }
});

// Suppression définitive du compte (mot de passe + confirmation DELETE) et de toutes ses données
app.delete("/account", authRateLimit, authMiddleware, async (req, res) => {
  const { password, confirm } = req.body || {};
  if (typeof password !== "string" || !password) return res.status(400).json({ error: "Mot de passe requis" });
  if (confirm !== "DELETE") return res.status(400).json({ error: "Tape DELETE pour confirmer" });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(403).json({ error: "Mot de passe incorrect" });
    }
    await prisma.$transaction(async (tx) => {
      await wipeUserLibrary(tx, req.userId);
      await tx.follow.deleteMany({
        where: { OR: [{ followerId: req.userId }, { followingId: req.userId }] },
      });
      await tx.user.delete({ where: { id: req.userId } });
    }, ACCOUNT_TX);
    res.clearCookie("token", cookieOptions);
    res.json({ message: "Compte supprimé" });
  } catch (error) {
    serverError(res, "Erreur suppression du compte", error);
  }
});

// ---------- Social léger : profils, followers, invitations, fil d'activité ----------

// ---------- Import / export de bibliothèque ----------

const importer = createImporter({ prisma, tmdbGet, getSeason, isAired });

// Correspondance TMDB d'un lot d'éléments importés (aucune écriture)
app.post("/import/resolve", importRateLimit, authMiddleware, async (req, res) => {
  const raw = req.body?.items;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_RESOLVE_BATCH) {
    return res.status(400).json({ error: `items : 1 à ${MAX_RESOLVE_BATCH} éléments` });
  }
  const items = raw.map(sanitizeResolveItem);
  if (items.some((i) => !i)) return res.status(400).json({ error: "Élément d'import invalide" });
  try {
    res.json({ results: await importer.resolveItems(items) });
  } catch (error) {
    serverError(res, "Erreur correspondance import", error);
  }
});

// Écriture d'un lot d'éléments confirmés par l'utilisateur (idempotent)
app.post("/import/commit", importRateLimit, authMiddleware, async (req, res) => {
  const raw = req.body?.items;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_COMMIT_BATCH) {
    return res.status(400).json({ error: `items : 1 à ${MAX_COMMIT_BATCH} éléments` });
  }
  const items = raw.map(sanitizeCommitItem);
  if (items.some((i) => !i)) return res.status(400).json({ error: "Élément d'import invalide" });
  try {
    res.json({ results: await importer.commitItems(req.userId, items) });
  } catch (error) {
    serverError(res, "Erreur import", error);
  }
});

// Export complet des données de l'utilisateur (RGPD)
app.get("/account/export", exportRateLimit, authMiddleware, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await importer.exportLibrary(req.userId));
  } catch (error) {
    serverError(res, "Erreur export", error);
  }
});

const optionalAuth = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  try {
    req.userId = token ? parseId(jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS).userId) : null;
  } catch {
    req.userId = null;
  }
  next();
};

const isMutual = async (a, b) => {
  if (!a || !b) return false;
  const count = await prisma.follow.count({
    where: { OR: [{ followerId: a, followingId: b }, { followerId: b, followingId: a }] },
  });
  return count === 2;
};

const canView = async (level, viewerId, ownerId) => {
  if (viewerId && viewerId === ownerId) return true;
  if (level === "public") return true;
  if (level === "friends") return isMutual(viewerId, ownerId);
  return false;
};

const publicCard = { id: true, username: true, avatar: true };

app.get("/users/search", actionRateLimit, optionalAuth, async (req, res) => {
  const q = cleanString(req.query.q, 50);
  if (!q || q.length < 2) return res.json([]);
  try {
    const users = await prisma.user.findMany({
      where: { username: { contains: q, mode: "insensitive" }, privacyProfile: { not: "private" } },
      select: publicCard,
      take: 20,
    });
    res.json(users);
  } catch (error) {
    serverError(res, "Erreur recherche d'utilisateurs", error);
  }
});

// Code d'invitation de l'utilisateur courant (créé à la demande)
app.get("/invite", authMiddleware, async (req, res) => {
  try {
    let user = await prisma.user.findUnique({ where: { id: req.userId }, select: { inviteCode: true } });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
    if (!user.inviteCode) {
      user = await prisma.user.update({
        where: { id: req.userId },
        data: { inviteCode: crypto.randomBytes(6).toString("base64url") },
        select: { inviteCode: true },
      });
    }
    res.json({ code: user.inviteCode });
  } catch (error) {
    serverError(res, "Erreur code d'invitation", error);
  }
});

app.get("/invite/:code", actionRateLimit, async (req, res) => {
  const code = cleanString(req.params.code, 32);
  if (!code) return res.status(400).json({ error: "Code invalide" });
  try {
    const user = await prisma.user.findUnique({ where: { inviteCode: code }, select: publicCard });
    if (!user) return res.status(404).json({ error: "Invitation introuvable" });
    res.json(user);
  } catch (error) {
    serverError(res, "Erreur invitation", error);
  }
});

// Fil d'activité des personnes suivies (avis, épisodes, ajouts) — déclaré avant /users/:id
app.get("/feed", actionRateLimit, authMiddleware, async (req, res) => {
  try {
    const followed = await prisma.follow.findMany({ where: { followerId: req.userId }, select: { followingId: true } });
    const ids = followed.map((f) => f.followingId);
    if (ids.length === 0) return res.json([]);
    // On ne garde que les amis qui acceptent de partager leur activité avec l'utilisateur
    // Une seule requête pour les abonnements réciproques (au lieu d'une par personne suivie)
    const [owners, followsBack] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: ids } }, select: { ...publicCard, privacyActivity: true } }),
      prisma.follow.findMany({ where: { followerId: { in: ids }, followingId: req.userId }, select: { followerId: true } }),
    ]);
    const mutual = new Set(followsBack.map((f) => f.followerId));
    const visible = owners.filter((o) => o.privacyActivity === "public" || (o.privacyActivity === "friends" && mutual.has(o.id)));
    const visibleIds = visible.map((o) => o.id);
    if (visibleIds.length === 0) return res.json([]);
    const byId = new Map(visible.map((o) => [o.id, { id: o.id, username: o.username, avatar: o.avatar }]));

    const [library, reviews, episodes] = await Promise.all([
      prisma.watchlist.findMany({ where: { userId: { in: visibleIds }, status: { in: ["WATCHLIST", "SEEN"] } }, orderBy: { createdAt: "desc" }, take: 30, include: { movie: true } }),
      prisma.review.findMany({ where: { userId: { in: visibleIds }, parentId: null }, orderBy: { createdAt: "desc" }, take: 30, include: { movie: true } }),
      prisma.episodeWatch.findMany({ where: { userId: { in: visibleIds } }, orderBy: { watchedAt: "desc" }, take: 30 }),
    ]);
    const items = [
      ...library.map((e) => ({ type: e.status === "SEEN" ? "seen" : "watchlist", at: e.createdAt, user: byId.get(e.userId), media: { tmdb_id: e.movie.tmdb_id, title: e.movie.title, media_type: e.movie.media_type, poster_path: e.movie.poster_path } })),
      ...reviews.map((r) => ({ type: "review", at: r.createdAt, user: byId.get(r.userId), rating: r.rating, media: { tmdb_id: r.movie.tmdb_id, title: r.movie.title, media_type: r.movie.media_type, poster_path: r.movie.poster_path } })),
      ...episodes.map((e) => ({ type: "episode", at: e.watchedAt, user: byId.get(e.userId), media: { tmdb_id: e.tmdbSeriesId, media_type: "tv", title: null }, season: e.seasonNumber, episode: e.episodeNumber })),
    ]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 40);
    res.json(items);
  } catch (error) {
    serverError(res, "Erreur fil d'activité", error);
  }
});

// Genres favoris : ids de genres TMDB mémorisés en base (remplis à la demande, par petits lots)
const genreNameCache = new Map();
const genreNames = async (language) => {
  const cached = genreNameCache.get(language);
  if (cached && Date.now() - cached.at < 24 * 60 * 60 * 1000) return cached.map;
  const [movie, tv] = await Promise.all([
    tmdbGet("/genre/movie/list", { language }),
    tmdbGet("/genre/tv/list", { language }),
  ]);
  const map = new Map([...(movie.genres || []), ...(tv.genres || [])].map((g) => [g.id, g.name]));
  genreNameCache.set(language, { at: Date.now(), map });
  return map;
};

const topGenres = async (userId, language) => {
  try {
    const entries = await prisma.watchlist.findMany({
      where: { userId, status: { in: ["SEEN", "WATCHLIST"] } },
      include: { movie: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const missing = entries.filter((e) => e.movie.genreIds === "").slice(0, 12);
    await Promise.allSettled(
      missing.map(async (e) => {
        const data = await tmdbGet(`/${e.movie.media_type}/${e.movie.tmdb_id}`, { language: "en-US" });
        const ids = (data.genres || []).map((g) => g.id).join(",");
        await prisma.movie.update({ where: { id: e.movie.id }, data: { genreIds: ids || "-" } });
        e.movie.genreIds = ids || "-";
      })
    );
    const counts = new Map();
    for (const e of entries) {
      for (const g of e.movie.genreIds.split(",")) {
        const gid = Number(g);
        if (gid) counts.set(gid, (counts.get(gid) || 0) + (e.status === "SEEN" ? 2 : 1));
      }
    }
    const names = await genreNames(language);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([gid, count]) => ({ id: gid, name: names.get(gid) || String(gid), count }));
  } catch (error) {
    console.error("❌ Genres favoris :", error?.code || error?.message);
    return [];
  }
};

app.get("/users/:id", actionRateLimit, optionalAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { ...publicCard, privacyProfile: true, privacyLibrary: true, privacyActivity: true, _count: { select: { followers: true, following: true } } },
    });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const viewerId = req.userId;
    const following = viewerId ? (await prisma.follow.count({ where: { followerId: viewerId, followingId: id } })) > 0 : false;
    const base = { id: user.id, username: user.username, avatar: user.avatar, followers: user._count.followers, following: user._count.following, isSelf: viewerId === id, isFollowing: following };

    if (!(await canView(user.privacyProfile, viewerId, id))) return res.json({ ...base, restricted: true });

    const out = { ...base, restricted: false };
    if (await canView(user.privacyLibrary, viewerId, id)) {
      const [seen, series, episodes] = await Promise.all([
        prisma.watchlist.count({ where: { userId: id, status: "SEEN", movie: { media_type: "movie" } } }),
        prisma.watchlist.count({ where: { userId: id, movie: { media_type: "tv" }, status: { notIn: ["JUNK", "IGNORED"] } } }),
        prisma.episodeWatch.aggregate({ where: { userId: id }, _count: { _all: true }, _sum: { runtime: true } }),
      ]);
      const minutes = (episodes._sum.runtime || 0) + seen * 105; // durée moyenne estimée pour les films
      out.stats = { moviesSeen: seen, seriesFollowed: series, episodesWatched: episodes._count._all, hoursWatched: Math.round(minutes / 60) };
      out.stats.topGenres = await topGenres(id, langOf(req.query.lang));
      const favorites = await prisma.watchlist.findMany({ where: { userId: id, isFavorite: true }, include: { movie: true }, take: 12 });
      out.favorites = favorites.map((f) => ({ tmdb_id: f.movie.tmdb_id, title: f.movie.title, media_type: f.movie.media_type, poster_path: f.movie.poster_path }));
    }
    res.json(out);
  } catch (error) {
    serverError(res, "Erreur profil", error);
  }
});

app.post("/users/:id/follow", actionRateLimit, authMiddleware, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id || id === req.userId) return res.status(400).json({ error: "Identifiant invalide" });
  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) return res.status(404).json({ error: "Utilisateur introuvable" });
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.userId, followingId: id } },
      update: {},
      create: { followerId: req.userId, followingId: id },
    });
    res.status(201).json({ message: "Abonné" });
  } catch (error) {
    serverError(res, "Erreur abonnement", error);
  }
});

app.delete("/users/:id/follow", actionRateLimit, authMiddleware, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });
  try {
    await prisma.follow.deleteMany({ where: { followerId: req.userId, followingId: id } });
    res.json({ message: "Désabonné" });
  } catch (error) {
    serverError(res, "Erreur désabonnement", error);
  }
});

// ---------- Watchlist / vus / favoris / corbeille ----------

const listByFilter = (label, buildWhere) => async (req, res) => {
  try {
    const entries = await prisma.watchlist.findMany({
      where: { userId: req.userId, ...buildWhere },
      include: { movie: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    res.json(entries);
  } catch (error) {
    serverError(res, label, error);
  }
};

app.get(
  "/watchlist",
  authMiddleware,
  listByFilter("Erreur récupération watchlist", { status: { notIn: ["JUNK", "IGNORED"] } })
);
app.get("/seen", authMiddleware, listByFilter("Erreur récupération films vus", { status: "SEEN" }));
app.get("/favorites", authMiddleware, listByFilter("Erreur récupération favoris", { isFavorite: true }));
app.get("/junk", authMiddleware, listByFilter("Erreur récupération corbeille", { status: "JUNK" }));

app.post("/watchlist", actionRateLimit, authMiddleware, async (req, res) => {
  const { tmdb_id, title, media_type, poster_path } = req.body || {};
  const userId = req.userId;

  const tmdbId = parseId(tmdb_id);
  const cleanTitle = cleanString(title, 300);
  const cleanMediaType = validMediaType(media_type);
  if (!tmdbId || !cleanTitle || !cleanMediaType) {
    return res.status(400).json({ error: "tmdb_id, title et media_type valides sont requis" });
  }
  const cleanPoster = typeof poster_path === "string" ? poster_path.slice(0, 300) : "";

  try {
    const movie = await prisma.movie.upsert({
      where: { tmdb_id_media_type: { tmdb_id: tmdbId, media_type: cleanMediaType } },
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

    if (existingEntry?.status === "IGNORED") {
      await prisma.watchlist.update({ where: { id: existingEntry.id }, data: { status: "WATCHLIST" } });
      return res.status(201).json({ message: "Film ajouté à la watchlist", movieId: movie.id });
    }
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

// Titres ignorés (swipe à gauche) : stockés en base avec le statut IGNORED
app.get("/ignored", actionRateLimit, authMiddleware, async (req, res) => {
  try {
    const entries = await prisma.watchlist.findMany({ where: { userId: req.userId, status: "IGNORED" }, include: { movie: true } });
    res.json(entries.map((e) => ({ movieId: e.movieId, tmdb_id: e.movie.tmdb_id, media_type: e.movie.media_type })));
  } catch (error) {
    serverError(res, "Erreur titres ignorés", error);
  }
});

const upsertMovieFromBody = (body) => {
  const tmdbId = parseId(body?.tmdb_id);
  const title = cleanString(body?.title, 300);
  const mediaType = ["movie", "tv"].includes(body?.media_type) ? body.media_type : null;
  if (!tmdbId || !title || !mediaType) return null;
  const poster = typeof body.poster_path === "string" ? body.poster_path.slice(0, 300) : "";
  return prisma.movie.upsert({
    where: { tmdb_id_media_type: { tmdb_id: tmdbId, media_type: mediaType } },
    update: {},
    create: { tmdb_id: tmdbId, title, media_type: mediaType, poster_path: poster },
  });
};

app.post("/ignored", actionRateLimit, authMiddleware, async (req, res) => {
  try {
    const pending = upsertMovieFromBody(req.body);
    if (!pending) return res.status(400).json({ error: "tmdb_id, title et media_type valides sont requis" });
    const movie = await pending;
    const existing = await prisma.watchlist.findFirst({ where: { movieId: movie.id, userId: req.userId } });
    if (!existing) await prisma.watchlist.create({ data: { movieId: movie.id, userId: req.userId, status: "IGNORED" } });
    res.status(existing ? 200 : 201).json({ movieId: movie.id, created: !existing });
  } catch (error) {
    serverError(res, "Erreur ignorer le titre", error);
  }
});

// Série abandonnée (par utilisateur) ; crée l'entrée de bibliothèque si besoin
app.put("/library/abandoned", actionRateLimit, authMiddleware, async (req, res) => {
  if (typeof req.body?.abandoned !== "boolean") return res.status(400).json({ error: "abandoned doit être un booléen" });
  try {
    const pending = upsertMovieFromBody(req.body);
    if (!pending) return res.status(400).json({ error: "tmdb_id, title et media_type valides sont requis" });
    const movie = await pending;
    const existing = await prisma.watchlist.findFirst({ where: { movieId: movie.id, userId: req.userId } });
    if (existing) {
      await prisma.watchlist.update({
        where: { id: existing.id },
        data: { abandoned: req.body.abandoned, ...(existing.status === "IGNORED" ? { status: "WATCHLIST" } : {}) },
      });
    } else {
      await prisma.watchlist.create({ data: { movieId: movie.id, userId: req.userId, abandoned: req.body.abandoned } });
    }
    res.json({ movieId: movie.id, abandoned: req.body.abandoned });
  } catch (error) {
    serverError(res, "Erreur série abandonnée", error);
  }
});

// Séries abandonnées de l'utilisateur (ids TMDB)
app.get("/library/abandoned", actionRateLimit, authMiddleware, async (req, res) => {
  try {
    const entries = await prisma.watchlist.findMany({ where: { userId: req.userId, abandoned: true, movie: { media_type: "tv" } }, include: { movie: { select: { tmdb_id: true } } } });
    res.json(entries.map((e) => e.movie.tmdb_id));
  } catch (error) {
    serverError(res, "Erreur séries abandonnées", error);
  }
});

// Statut d'un titre (id TMDB) dans la bibliothèque de l'utilisateur courant
app.get("/library/:tmdbId", actionRateLimit, authMiddleware, async (req, res) => {
  const tmdbId = parseId(req.params.tmdbId);
  if (!tmdbId) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    // ?type=movie|tv : un même id TMDB peut désigner un film ET une série
    const mediaType = validMediaType(req.query.type);
    const entry = await prisma.watchlist.findFirst({
      where: { userId: req.userId, movie: { tmdb_id: tmdbId, ...(mediaType ? { media_type: mediaType } : {}) } },
    });
    if (entry?.status === "IGNORED") return res.json({ inLibrary: false, ignored: true, movieId: entry.movieId });
    res.json(
      entry
        ? {
            inLibrary: true,
            movieId: entry.movieId,
            status: entry.status,
            isFavorite: entry.isFavorite,
            rating: entry.rating,
            abandoned: entry.abandoned,
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
  actionRateLimit,
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
  actionRateLimit,
  authMiddleware,
  updateEntry(
    "Erreur retrait de SEEN",
    "Film retiré de SEEN et remis dans la Watchlist",
    () => ({ status: "WATCHLIST" })
  )
);

app.put(
  "/watchlist/:movieId/favorite",
  actionRateLimit,
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
  actionRateLimit,
  authMiddleware,
  updateEntry("Erreur corbeille", "Film déplacé vers la corbeille", () => ({
    status: "JUNK",
    isFavorite: false,
  }))
);

app.put(
  "/junk/:movieId/restore",
  actionRateLimit,
  authMiddleware,
  updateEntry("Erreur restauration", "Film restauré dans la Watchlist", () => ({
    status: "WATCHLIST",
  }))
);

app.put("/seen/:movieId/rating", actionRateLimit, authMiddleware, async (req, res) => {
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
    const data = await tmdbCached("/trending/all/day", { language: langOf(req.query.lang), page: Math.min(page, 500) }, 15 * MINUTE);
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
    const movieDetails = await tmdbCached(`/${type}/${tmdbId}`, {
      language: langOf(req.query.lang),
      append_to_response: "credits,videos,external_ids",
    }, 30 * MINUTE, slimDetails);

    let reviews = [];
    try {
      const movie = await prisma.movie.findUnique({
        where: { tmdb_id_media_type: { tmdb_id: tmdbId, media_type: type } },
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
    const imdb = await getImdbRating(movieDetails.imdb_id || movieDetails.external_ids?.imdb_id);

    res.json({
      ...movieDetails,
      flixmatchRating: average === null ? null : average.toFixed(1),
      flixmatchVotes: countRated(reviews),
      imdbRating: imdb?.rating ?? null,
      imdbVotes: imdb?.votes ?? null,
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
    res.json(await tmdbCached(`/${type}/${tmdbId}/recommendations`, { language: langOf(req.query.lang) }, 60 * MINUTE));
  } catch (error) {
    tmdbError(res, "Erreur recommandations TMDB", error);
  }
});

// Recherche multilingue : la requête part dans la langue de l'utilisateur ET en en-US (les titres
// originaux sont aussi indexés par TMDB), puis les résultats sont fusionnés et dédupliqués.
const SEARCH_ENDPOINTS = { all: "multi", movie: "movie", tv: "tv", person: "person" };

const multiSearch = async (query, type, page, lang) => {
  const languages = [...new Set([lang, "en-US"])];
  const settled = await Promise.allSettled(
    languages.map((language) => tmdbGet(`/search/${SEARCH_ENDPOINTS[type]}`, { query, language, page, include_adult: false }))
  );
  const fulfilled = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (fulfilled.length === 0) throw settled[0].reason;
  const lists = fulfilled.map((data) =>
    (data.results || []).map((r) => (type === "all" ? r : { ...r, media_type: type }))
  );
  return {
    page,
    total_pages: Math.max(...fulfilled.map((d) => d.total_pages || 1)),
    results: mergeSearchResults(lists),
  };
};

app.get("/tmdb/search/:query", searchRateLimit, async (req, res) => {
  const query = cleanString(req.params.query, 200);
  if (!query) return res.status(400).json({ error: "Recherche invalide" });

  try {
    const data = await multiSearch(query, "all", 1, langOf(req.query.lang));
    res.json(data.results);
  } catch (error) {
    tmdbError(res, "Erreur recherche TMDB", error);
  }
});

app.get("/tmdb/search", searchRateLimit, async (req, res) => {
  const query = cleanString(req.query.query, 200);
  const type = Object.hasOwn(SEARCH_ENDPOINTS, req.query.type) ? req.query.type : "all";
  if (!query) return res.status(400).json({ error: "Recherche invalide" });

  try {
    res.json(await multiSearch(query, type, Math.min(parseId(req.query.page) || 1, 500), langOf(req.query.lang)));
  } catch (error) {
    tmdbError(res, "Erreur recherche TMDB", error);
  }
});

// Correspondance par identifiant externe (TVDB / IMDb) : utilisé par les imports
app.get("/tmdb/find/:source/:id", actionRateLimit, async (req, res) => {
  const source = { tvdb: "tvdb_id", imdb: "imdb_id" }[req.params.source];
  const id = String(req.params.id);
  if (!source || !/^(tt)?\d{1,10}$/.test(id)) return res.status(400).json({ error: "Identifiant invalide" });
  try {
    const data = await tmdbGet(`/find/${id}`, { external_source: source, language: langOf(req.query.lang) });
    res.json({ movies: data.movie_results || [], tv: data.tv_results || [] });
  } catch (error) {
    tmdbError(res, "Erreur correspondance TMDB", error);
  }
});

// Saisons d'une série (liste légère, sans les épisodes)
app.get("/tmdb/tv/:tmdbId/seasons", async (req, res) => {
  const tmdbId = parseId(req.params.tmdbId);
  if (!tmdbId) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    const show = await tmdbGet(`/tv/${tmdbId}`, { language: langOf(req.query.lang) });
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
    res.json(await getSeason(tmdbId, seasonNumber, langOf(req.query.lang)));
  } catch (error) {
    if (error?.response?.status === 404) return res.status(404).json({ error: "Saison introuvable" });
    tmdbError(res, "Erreur épisodes TMDB", error);
  }
});

app.get("/tmdb/genres", async (req, res) => {
  try {
    const data = await tmdbCached("/genre/movie/list", { language: langOf(req.query.lang) }, 24 * 60 * MINUTE);
    res.json(data.genres);
  } catch (error) {
    tmdbError(res, "Erreur chargement genres", error);
  }
});

app.get("/tmdb/advanced-search", searchRateLimit, async (req, res) => {
  const { query, genre, year, minRating, maxDuration, originalLanguage, providers, sort } = req.query;
  const type = req.query.type === "tv" ? "tv" : "movie";
  const page = Math.min(parseId(req.query.page) || 1, 500);
  const language = langOf(req.query.lang);

  const params = { language, page };
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
  if (originalLanguage !== undefined && originalLanguage !== "") {
    if (!/^[a-z]{2,3}$/.test(String(originalLanguage))) return res.status(400).json({ error: "Langue originale invalide" });
    params.with_original_language = String(originalLanguage);
  }
  if (providers !== undefined && providers !== "") {
    if (!/^\d+(\|\d+)*$/.test(String(providers))) return res.status(400).json({ error: "Plateformes invalides" });
    params.with_watch_providers = String(providers);
    params.watch_region = REGION_REGEX.test(req.query.region) ? req.query.region : "FR";
    params.with_watch_monetization_types = "flatrate";
  }
  const dateField = type === "tv" ? "first_air_date" : "primary_release_date";
  const sortMap = {
    popularity: "popularity.desc",
    rating: "vote_average.desc",
    date: `${dateField}.desc`,
  };
  const sortBy = sortMap[sort] || sortMap.popularity;

  try {
    // `discover` ignore le titre : avec un texte, on cherche puis on filtre / trie côté serveur
    if (params.query) {
      const data = await tmdbGet(`/search/${type}`, {
        language,
        page,
        query: params.query,
        ...(params.year ? { [type === "tv" ? "first_air_date_year" : "year"]: params.year } : {}),
      });
      const genreIds = params.with_genres ? params.with_genres.split(",").map(Number) : [];
      const minVote = params["vote_average.gte"] ?? 0;
      let results = (data.results || [])
        .map((m) => ({ ...m, media_type: type }))
        .filter(
          (m) =>
            (m.vote_average || 0) >= minVote &&
            genreIds.every((g) => (m.genre_ids || []).includes(g)) &&
            (!params.with_original_language || m.original_language === params.with_original_language)
        );
      if (sort === "rating") results = results.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      else if (sort === "date") {
        const d = (m) => m.release_date || m.first_air_date || "";
        results = results.sort((a, b) => d(b).localeCompare(d(a)));
      }
      return res.json({ ...data, results });
    }

    const discoverParams = { ...params, sort_by: sortBy, "vote_count.gte": sortBy.startsWith("vote_average") ? 200 : undefined };
    if (params.year) {
      delete discoverParams.year;
      discoverParams[type === "tv" ? "first_air_date_year" : "primary_release_year"] = params.year;
    }
    const data = await tmdbGet(`/discover/${type}`, discoverParams);
    res.json({ ...data, results: (data.results || []).map((r) => ({ ...r, media_type: type })) });
  } catch (error) {
    tmdbError(res, "Erreur recherche avancée", error);
  }
});

// ---------- Découverte (swipe) & « Où regarder » ----------

const SORTS = ["popularity.desc", "vote_average.desc", "primary_release_date.desc"];

app.get("/tmdb/discover", async (req, res) => {
  const type = req.query.type === "tv" ? "tv" : "movie";
  const page = Math.min(parseId(req.query.page) || 1, 500);
  const language = langOf(req.query.lang);
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
    const data = await tmdbCached(`/watch/providers/${req.params.type}`, { watch_region: region, language: langOf(req.query.lang) }, 24 * 60 * MINUTE);
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
    const mediaType = validMediaType(req.query.type);
    const reviews = await prisma.review.findMany({
      where: { movie: { tmdb_id: tmdbId, ...(mediaType ? { media_type: mediaType } : {}) }, parentId: null },
      include: { user: { select: publicUser }, ...withReplyCount },
      orderBy: { createdAt: "desc" },
    });

    res.json({ reviews, avgRating: averageOf(reviews) });
  } catch (error) {
    serverError(res, "Erreur récupération avis", error);
  }
});

// Avis principal ou réponse, identifié par l'id TMDB du film
app.post("/reviews", reviewRateLimit, authMiddleware, async (req, res) => {
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
    const mediaType = validMediaType(media_type);
    let movie = await prisma.movie.findFirst({
      where: { tmdb_id: tmdbId, ...(mediaType ? { media_type: mediaType } : {}) },
    });
    if (!movie) {
      const cleanTitle = cleanString(title, 300);
      if (!cleanTitle) return res.status(404).json({ error: "Film introuvable" });
      movie = await prisma.movie.upsert({
        where: { tmdb_id_media_type: { tmdb_id: tmdbId, media_type: mediaType || "movie" } },
        update: {},
        create: {
          tmdb_id: tmdbId,
          title: cleanTitle,
          media_type: mediaType || "movie",
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
app.post("/reviews/:movieId", reviewRateLimit, authMiddleware, async (req, res) => {
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

// Marque / démarque plusieurs épisodes d'un coup (cascade « marquer les épisodes précédents »)
const MAX_BULK = 2000;
app.put("/episodes/:seriesId/bulk", actionRateLimit, authMiddleware, async (req, res) => {
  const seriesId = parseId(req.params.seriesId);
  const { watched, episodes } = req.body || {};
  if (!seriesId) return res.status(400).json({ error: "Identifiant de série invalide" });
  if (typeof watched !== "boolean" || !Array.isArray(episodes) || episodes.length === 0 || episodes.length > MAX_BULK) {
    return res.status(400).json({ error: "watched (booléen) et episodes (1 à 2000 éléments) sont requis" });
  }

  const bySeason = new Map();
  for (const item of episodes) {
    const seasonNumber = parseNumber(item?.seasonNumber, 500);
    const episodeNumber = parseId(item?.episodeNumber);
    if (seasonNumber === null || !episodeNumber) {
      return res.status(400).json({ error: "Saison ou épisode invalide" });
    }
    if (!bySeason.has(seasonNumber)) bySeason.set(seasonNumber, new Set());
    bySeason.get(seasonNumber).add(episodeNumber);
  }

  try {
    if (!watched) {
      await prisma.episodeWatch.deleteMany({
        where: {
          userId: req.userId,
          tmdbSeriesId: seriesId,
          OR: [...bySeason].map(([seasonNumber, numbers]) => ({ seasonNumber, episodeNumber: { in: [...numbers] } })),
        },
      });
    } else {
      const data = [];
      for (const [seasonNumber, numbers] of bySeason) {
        const season = await getSeason(seriesId, seasonNumber).catch((error) => {
          throw Object.assign(error, { isTmdb: true });
        });
        for (const e of season.episodes) {
          if (numbers.has(e.episode_number) && isAired(e)) {
            data.push({
              userId: req.userId,
              tmdbSeriesId: seriesId,
              seasonNumber,
              episodeNumber: e.episode_number,
              tmdbEpisodeId: e.id,
              name: e.name ? String(e.name).slice(0, 300) : null,
              runtime: e.runtime,
            });
          }
        }
      }
      await prisma.episodeWatch.createMany({ data, skipDuplicates: true });
    }

    const all = await prisma.episodeWatch.findMany({
      where: { userId: req.userId, tmdbSeriesId: seriesId },
      select: episodeSelect,
      orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
    });
    res.json({ watched: all });
  } catch (error) {
    if (error?.isTmdb) {
      if (error?.response?.status === 404) return res.status(404).json({ error: "Saison introuvable" });
      return tmdbError(res, "Erreur saison TMDB", error);
    }
    serverError(res, "Erreur mise à jour en lot", error);
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
        data: season.episodes.filter((e) => isAired(e)).map((e) => ({
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
    if (!isAired(episode)) return res.status(400).json({ error: "Cet épisode n'est pas encore diffusé" });

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
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Requête trop volumineuse" });
  }
  console.error("❌ Erreur non gérée :", err?.message);
  res.status(500).json({ error: "Erreur serveur" });
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
