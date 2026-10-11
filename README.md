# FlixMatch

FlixMatch is a **“Tinder for Movies”** concept: a movie discovery application with account features, watchlist management, and media exploration workflows.

## Overview

The repository combines a React/Vite front end with a Node/Express backend and Prisma-managed persistence. Public code and metadata show account flows, movie detail pages, search results, and multiple personal library views.

## Goal / Objective

FlixMatch appears to focus on making movie discovery and personal curation more engaging through a swipe-friendly or recommendation-oriented product concept.

> TODO: Clarify how the “Tinder for Movies” interaction works in the current version (swipe UI, recommendation logic, matching metaphor, or branding only).

## Visuals

- **Home screen screenshot:** TODO
- **Discovery / recommendation GIF:** TODO
- **Live demo link:** TODO

## Stack

- JavaScript
- React
- Vite
- Express
- Prisma
- PostgreSQL
- Material UI
- TMDB API

## Key Features

- Movie and series discovery
- Authentication and account management
- Watchlist and favorites
- “Seen” and “Junk” library views
- Search results and advanced search
- Movie detail pages

## Architecture Summary

- `flixmatch/src/pages/`: front-end pages such as Home, SearchResults, Watchlist, Favorites, Account, and MovieDetail
- `prisma/`: database schema and migrations
- server layer present through `npm start`

## Run Locally

```bash
cd flixmatch
cp .env.example .env   # then fill in the values
npm install            # also runs `prisma generate`
npx prisma migrate deploy
npm run build && npm start   # app + API on http://localhost:3000
```

For frontend development with hot reload, run `npm start` (API) and `npm run dev` (Vite) side by side and set `VITE_API_URL=http://localhost:3000` and `CORS_ORIGIN=http://localhost:5173`.

## Deploy for free (Render + Neon)

The app is a single Express service that serves the Vite build (`dist`) and the API on the same origin.

1. **Database**: create a free project on [Neon](https://neon.tech) and copy the direct (non-pooled) Postgres connection string (ending with `?sslmode=require`).
2. **App**: on [Render](https://render.com), create a **Web Service** (Free plan) from this GitHub repo, or use the `render.yaml` Blueprint at the repo root.
   - Root Directory: `flixmatch`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start` (runs `prisma migrate deploy`, then the server)
   - Health Check Path: `/health`
3. Environment variables:

   ```dotenv
   DATABASE_PUBLIC_URL=<Neon connection string>
   TMDB_API_KEY=<your TMDB v4 read access token>
   JWT_SECRET=<long random string, e.g. `openssl rand -hex 32`>
   NODE_ENV=production
   ```

   Do **not** set `PORT` (the host provides it) nor `VITE_API_URL` (same origin).

Notes: the Render free plan sleeps after ~15 min of inactivity (first request takes 30-60 s). In production the server refuses to start if `JWT_SECRET`, `DATABASE_PUBLIC_URL` or `TMDB_API_KEY` is missing. The TMDB key never reaches the browser.

## Notes to Fill In Later

- Exact user journey for the “match” concept
- Demo credentials
- Environment variables
- Deployment link
- Screenshots / GIFs

---
