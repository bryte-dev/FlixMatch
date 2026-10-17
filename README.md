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
- Tailwind CSS v4 (`@tailwindcss/vite`)
- TMDB API

## Key Features

- Movie and series discovery
- Authentication and account management
- Watchlist and favorites
- “Seen” and “Junk” library views
- Search results and advanced search
- Movie detail pages with trailers, cast, recommendations and reviews
- **TV episode tracking** (TV Time-style): seasons/episodes from TMDB, mark an episode or a whole season as seen, per-season and per-series progress
- Reviews and replies; you can delete your own review or reply (a review that still has replies cannot be deleted)
- Modern UI: skeleton loaders, toasts, pending states on every async action, responsive navbar, bottom tab bar on mobile
- **Discover (swipe)**: Pointer-Events swipe deck (right = configurable action watchlist/favorites, left = ignore, up = already seen, keyboard + buttons, undo), filters (movies/series, genre, my platforms), "where to watch" via TMDB Watch Providers (JustWatch data)
- **Smart episode tracking**: ticking episode N offers to mark 1..N-1 (same at season level and for the whole series), unticking offers to untick the following ones, "next episode" button, status (to watch / in progress / completed / abandoned), S2·E5 progress, unaired episodes and specials (season 0) handled
- **Multilingual search**: each query runs in the user's metadata language and in en-US; results are merged and de-duplicated; tabs All / Movies / Series / People; infinite scroll; advanced filters (genre, year, min rating, platform, original language, duration) and sort (popularity, rating, date)
- **Unified rating badges** IMDb / TMDB / FlixMatch (FlixMatch = average of user ratings, shown /10); IMDb via OMDb in an isolated service (`flixmatch/services/omdb.js`) with cache and graceful fallback
- **Settings** (stored on the device): theme, swipe action, metadata language, region, streaming platforms, adult content, JSON export
- **Themes**: dark, light, auto + secret themes (Hacker, Neon, Retro cinema) unlocked with the Konami code or 7 quick taps on the logo
- **PWA**: web manifest, service worker (shell + TMDB image cache, basic offline), iOS meta tags, safe areas, `100dvh`, 44px touch targets, `prefers-reduced-motion`

## Architecture Summary

- `flixmatch/src/pages/`: front-end pages such as Home, SearchResults, Watchlist, Favorites, Account, and MovieDetail
- `flixmatch/src/components/`: shared UI (navbar, cards, toasts, episode tracker, reviews)
- `flixmatch/prisma/`: database schema and migrations (latest: `EpisodeWatch` table for episode tracking)
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
   - Build Command: `npm ci --include=dev && npm run build` (Vite and Tailwind are needed at build time)
   - Start Command: `npm start` (runs `prisma migrate deploy`, then the server)
   - Health Check Path: `/health`
3. Environment variables:

   ```dotenv
   DATABASE_PUBLIC_URL=<Neon connection string>
   TMDB_API_KEY=<your TMDB v4 read access token>
   JWT_SECRET=<long random string, e.g. `openssl rand -hex 32`>
   NODE_ENV=production
   ```

   `JWT_SECRET` is **not** a JWT: it is just a long random secret used to sign sessions. On Render, let it generate the value (as in `render.yaml`) or run `openssl rand -hex 32`.

   Do **not** set `PORT` (the host provides it) nor `VITE_API_URL` (same origin).

The new `EpisodeWatch` migration (`20251011170000_add_episode_watch`) is applied automatically by `npm start` (`prisma migrate deploy`); no manual step is required on an existing database.

### TMDB proxy & new endpoints

All TMDB calls go through the server (the key never reaches the browser):
`GET /tmdb/tv/:id/seasons`, `GET /tmdb/tv/:id/season/:n`.

Authenticated, per-user endpoints: `GET /episodes`, `GET /episodes/:seriesId`, `PUT /episodes/:seriesId/:season/:episode` (`{ "watched": true|false }`), `PUT /episodes/:seriesId/season/:season`, `GET /library/:tmdbId`, `DELETE /reviews/:reviewId` (author only).

Notes: the Render free plan sleeps after ~15 min of inactivity (first request takes 30-60 s). In production the server refuses to start if `JWT_SECRET`, `DATABASE_PUBLIC_URL` or `TMDB_API_KEY` is missing. The TMDB key never reaches the browser.

## Environment variables

See `flixmatch/.env.example` (never commit `.env`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_PUBLIC_URL` | yes | PostgreSQL connection string (Neon, see Prisma `datasource`) |
| `TMDB_API_KEY` | yes | TMDB v4 read token (or v3 key) |
| `JWT_SECRET` | yes (prod) | Session signing secret |
| `OMDB_API_KEY` | no | Enables IMDb ratings via OMDb; without it IMDb badges are simply hidden |
| `CORS_ORIGIN`, `VITE_API_URL` | no | Separate front-end dev server only |

## Tests

`cd flixmatch && npm test` runs the Node test runner on the pure logic (episode cascade, search merge, swipe classification, OMDb parsing).

## Status of the "big update" and remaining work

Done: PWA/mobile, themes + fonts + sticker buttons, Discover swipe, smart episode tracking, multilingual search, rating badges, settings (local).

Not done yet (needs DB migrations and more work): full UI i18n (14 languages + RTL; only the TMDB metadata language is configurable for now), avatars/profile stats, followers / activity feed / per-section privacy, account deletion, server-side settings sync, TV Time ZIP import (adapter architecture, TMDB matching, batch import), splash screens, pull-to-refresh, custom lists as swipe target, persisting the "abandoned" series status and ignored titles in the database.

## Legal / attribution

<img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB" height="20">

This product uses the TMDB API but is not endorsed or certified by TMDB. "Where to watch" data is provided by JustWatch through TMDB. IMDb ratings come from OMDb. The free TMDB API and OMDb plans are for non-commercial use: a commercial agreement is needed before monetising the app.

## Notes to Fill In Later

- Exact user journey for the “match” concept
- Demo credentials
- Deployment link
- Screenshots / GIFs

---
