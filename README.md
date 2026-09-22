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
npm install
npm run dev
```

> TODO: Document the exact backend start command, required environment variables, database setup, and TMDB API configuration.

## Notes to Fill In Later

- Exact user journey for the “match” concept
- Demo credentials
- Environment variables
- Deployment link
- Screenshots / GIFs

---
