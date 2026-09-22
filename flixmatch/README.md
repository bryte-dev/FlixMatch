# FlixMatch 🎬

FlixMatch is a movie and TV show discovery platform inspired by the idea of **“Tinder for Movies.”**

The application allows users to search for movies, TV shows, and actors, view detailed information, manage a personal watchlist, mark titles as seen, add favorites, move titles to a junk section, and share reviews.

> **Project status: functional prototype / student project**
>
> The main application structure is present, including a React frontend, an Express backend, PostgreSQL persistence through Prisma, authentication, TMDB integration, watchlist management, reviews, and user profiles.
>
> However, the project still contains technical inconsistencies and configuration issues that should be addressed before treating it as a production-ready application.

---

## Project Goal

The goal of FlixMatch is to make movie discovery more interactive and personal.

Instead of simply browsing a large movie catalog, users can:

- search for movies and TV shows;
- discover new content;
- inspect detailed information;
- build a personal watchlist;
- organize titles by status;
- mark movies as seen;
- rate and review movies;
- save favorites;
- remove unwanted titles;
- discuss movies through reviews and replies.

The project is based on the following product idea:

```text
Discover a movie
    ↓
View its details
    ↓
Add it to your watchlist
    ↓
Watch it
    ↓
Rate and review it
    ↓
Keep organizing your personal movie library
```

---

## The “Tinder for Movies” Concept

The name FlixMatch refers to the idea of discovering movies in a simple, engaging, and personal way, similar to the browsing experience popularized by dating applications.

However, in the current codebase, the “Tinder” aspect is mainly a product concept and branding direction.

The repository clearly contains:

- movie discovery;
- search;
- recommendations;
- watchlists;
- favorites;
- seen and junk sections;
- reviews;
- movie details.

There is no clearly identifiable full swipe-based matching system or user-to-user movie matching algorithm in the current application structure.

Therefore, FlixMatch is currently best described as:

> **A personalized movie discovery and organization platform inspired by the Tinder user experience.**

---

## Main Features

### Movie and TV Show Search

The application uses the TMDB API to search for:

- movies;
- TV shows;
- actors;
- other media results.

The backend exposes TMDB-related routes for:

- general search;
- advanced search;
- movie and TV show details;
- recommendations;
- genres.

### Movie Details

The detail page can display information retrieved from TMDB, including:

- title;
- poster;
- description;
- cast;
- videos;
- images;
- streaming provider information;
- recommendations;
- local FlixMatch reviews;
- local average rating.

The frontend route is:

```text
/:type/:tmdbId
```

For example:

```text
/movie/123
/tv/456
```

### Authentication

The application includes:

- user registration;
- login;
- logout;
- authentication persistence;
- protected pages;
- current-user retrieval;
- profile updates.

Authentication is implemented with:

- bcrypt for password hashing;
- JSON Web Tokens;
- HTTP-only cookies;
- an authentication context in React;
- Prisma and PostgreSQL for user persistence.

### Watchlist

Authenticated users can add movies or TV shows to their personal watchlist.

The watchlist prevents the same movie from being added more than once for the same user through the database constraint:

```text
(movieId, userId)
```

Users can also view the movie information associated with each watchlist entry.

### Seen Movies

Users can mark a title as seen.

Seen titles are stored using the `SEEN` status and displayed separately from the active watchlist.

Users can also restore a seen title to the regular watchlist.

### Favorites

Users can mark a title as a favorite.

The favorites page displays all watchlist entries where:

```text
isFavorite = true
```

### Junk Section

Users can move titles to a junk or discarded section.

Junk entries use the `JUNK` status and are excluded from the regular watchlist.

Users can restore junk titles back to the normal watchlist.

### Ratings

Users can rate seen movies from 1 to 5.

The application stores the personal rating in the watchlist entry and also supports movie review ratings.

### Reviews and Replies

Authenticated users can write reviews for movies.

The review system supports:

- written comments;
- ratings;
- review authors;
- replies;
- nested discussions;
- local average ratings.

Reviews are stored in the Prisma database.

### User Profiles

Users can manage a username through the account page.

The backend exposes:

```text
PUT /account/update
```

The current user can also be retrieved through:

```text
GET /me
```

### Advanced Search

The project includes an advanced search page with support for filters such as:

- text query;
- genre;
- release year;
- minimum rating;
- maximum duration;
- pagination.

---

## Technology Stack

### Frontend

- **React**
- **Vite**
- **JavaScript**
- **React Router**
- **Material UI**
- **Axios**
- **Swiper**
- **React Icons**

### Backend

- **Node.js**
- **Express**
- **JavaScript**
- **Prisma**
- **PostgreSQL**
- **bcryptjs**
- **JSON Web Tokens**
- **cookie-parser**
- **CORS**
- **Axios**

### External API

- **TMDB API**

TMDB provides the movie, TV show, actor, genre, image, video, and recommendation data.

---

## Project Structure

```text
FlixMatch/
├── flixmatch/
│   ├── src/
│   │   ├── App.jsx                 Main React application and routing
│   │   ├── main.jsx                React entry point
│   │   ├── AuthContext.jsx         Authentication state and user session
│   │   ├── theme.js                Material UI theme
│   │   │
│   │   ├── components/
│   │   │   ├── Navbar.jsx          Main navigation
│   │   │   └── SearchBar.jsx       Search interface and search results
│   │   │
│   │   ├── pages/
│   │   │   ├── Home.jsx            Home and movie discovery
│   │   │   ├── Login.jsx           Login page
│   │   │   ├── Register.jsx        Registration page
│   │   │   ├── Watchlist.jsx       Personal watchlist
│   │   │   ├── Favorites.jsx       Favorite titles
│   │   │   ├── Seen.jsx             Seen titles
│   │   │   ├── Junk.jsx             Discarded titles
│   │   │   ├── Account.jsx          User account and profile
│   │   │   ├── MovieDetail.jsx      Movie or TV show details
│   │   │   └── AdvancedSearch.jsx  Advanced TMDB search
│   │   │
│   │   ├── services/
│   │   │   └── tmdb.js             TMDB-related frontend helpers
│   │   │
│   │   ├── assets/                 Frontend assets
│   │   └── styles/                 Global and page styles
│   │
│   ├── prisma/
│   │   ├── schema.prisma           Database schema
│   │   ├── migrations/             Prisma migrations
│   │   └── ERD.svg                 Entity relationship diagram
│   │
│   ├── public/                     Logos, icons, and fallback images
│   ├── server.js                   Express API and production server
│   ├── package.json                Dependencies and scripts
│   ├── vite.config.js              Vite configuration
│   ├── railway.json                Railway deployment configuration
│   ├── Procfile                    Process start command
│   └── index.html                  Vite HTML entry point
│
├── README.md
├── LICENSE
├── .gitignore
└── .dockerignore
```

---

## Application Architecture

FlixMatch combines a React/Vite frontend and an Express/Prisma backend in the same application directory.

The general architecture is:

```text
React frontend
    ↓
Axios requests
    ↓
Express API
    ├── Authentication
    ├── Watchlist management
    ├── Reviews
    ├── Profile management
    └── TMDB proxy routes
    ↓
Prisma
    ↓
PostgreSQL
```

### Frontend Entry Point

The frontend starts in:

```text
src/main.jsx
```

This file configures:

- React;
- React Router;
- Material UI;
- the global theme;
- CSS reset;
- the main `App` component.

### Application Routing

Routes are configured in:

```text
src/App.jsx
```

The application contains public routes such as:

```text
/
 /login
 /register
 /search
 /search/:query
 /advanced-search
 /:type/:tmdbId
```

Private routes include:

```text
/watchlist
/favorites
/seen
/junk
/account
```

Private pages are protected through the `PrivateRoute` component, which checks whether a user exists in `AuthContext`.

### Authentication Context

Authentication state is managed in:

```text
src/AuthContext.jsx
```

The context is responsible for:

- checking the current session;
- logging in;
- logging out;
- updating the profile;
- storing the current user in React state;
- exposing a loading state.

The frontend uses cookies for authentication and enables Axios credentials:

```text
withCredentials: true
```

### Backend Server

The backend is implemented in:

```text
server.js
```

The Express server is responsible for:

- serving the API;
- authenticating users;
- managing cookies;
- communicating with Prisma;
- accessing TMDB;
- serving the production Vite build;
- returning `index.html` for client-side routing.

### Database Layer

Prisma is configured with PostgreSQL.

The database contains the following core models:

```text
User
Movie
Watchlist
Review
```

---

## Database Model

### User

Represents a FlixMatch user.

Fields include:

- `id`;
- `email`;
- `username`;
- `password`.

A user can have:

- multiple watchlist entries;
- multiple reviews.

### Movie

Represents a movie or TV show stored locally after being used by a user.

Fields include:

- `id`;
- `tmdb_id`;
- `title`;
- `media_type`;
- `poster_path`.

The TMDB identifier is unique.

### Watchlist

Represents the relationship between a user and a movie.

Fields include:

- `movieId`;
- `userId`;
- `isFavorite`;
- `status`;
- `rating`.

Possible statuses are:

```text
WATCHLIST
SEEN
JUNK
```

The combination of `movieId` and `userId` is unique.

### Review

Represents a user's review of a movie.

Fields include:

- `userId`;
- `movieId`;
- `rating`;
- `comment`;
- `createdAt`;
- `parentId`.

Reviews can have replies through the self-referencing relationship:

```text
Review → replies → Review
```

---

## Main API Routes

### Authentication

```http
POST /register
POST /login
POST /logout
GET /me
```

### Profile

```http
PUT /account/update
```

### Watchlist

```http
GET /watchlist
POST /watchlist
PUT /watchlist/:movieId/seen
PUT /seen/:movieId/remove
GET /seen
PUT /watchlist/:movieId/favorite
GET /favorites
PUT /watchlist/:movieId/junk
GET /junk
PUT /junk/:movieId/restore
```

### TMDB Proxy Routes

```http
GET /api/config
GET /tmdb/search/:query
GET /tmdb/details/:tmdbId/:type
GET /tmdb/recommendations/:tmdbId/:type
GET /tmdb/genres
GET /tmdb/advanced-search
```

### Reviews

```http
POST /reviews
GET /reviews/:tmdbId
POST /reviews/:movieId
GET /reviews/:reviewId/replies
```

---

## What Currently Works

Based on the current repository structure and implementation, the following features are present and appear to be implemented.

### Frontend and Navigation

- React frontend with Vite;
- React Router navigation;
- Material UI theme;
- global styling;
- public and private routes;
- navigation bar;
- search interface;
- movie detail routes;
- account and library pages.

### Authentication

- user registration;
- password hashing with bcryptjs;
- user login;
- JWT generation;
- HTTP-only cookie storage;
- logout;
- session checking through `/me`;
- protected pages;
- profile username update.

### TMDB Integration

- movie and TV show search;
- movie and TV show details;
- recommendations;
- genre loading;
- advanced movie search;
- actor-related search functionality;
- fallback images when TMDB has no image available.

### Personal Movie Management

- add titles to the watchlist;
- prevent duplicate entries per user;
- retrieve the current user's watchlist;
- mark titles as seen;
- restore seen titles;
- mark titles as favorites;
- retrieve favorites;
- move titles to junk;
- retrieve junk titles;
- restore junk titles.

### Reviews

- create reviews;
- add ratings;
- retrieve reviews;
- calculate local average ratings;
- create review replies;
- retrieve replies;
- associate reviews with users and movies.

### User Account

- retrieve the current user;
- edit the username;
- display account-related information;
- keep authentication state in a React context.

### Deployment Preparation

The project includes configuration for:

- Vite production builds;
- Railway deployment;
- a `Procfile`;
- serving the generated `dist` folder through Express;
- Prisma generation and migrations during `postinstall`.

---

## What Does Not Fully Work or Needs Attention

The following points are visible from the current implementation and repository configuration.

### 1. The server does not explicitly use `process.env.PORT`

The server ends with:

```js
app.listen(() => {
  console.log(`Server running on port ${process.env.PORT}`);
});
```

The port is logged, but it is not passed to `app.listen`.

This can cause deployment problems because platforms such as Railway usually provide a dynamic `PORT` environment variable.

The server should normally listen on something equivalent to:

```js
app.listen(process.env.PORT || 3000)
```

In the current state, the application may fail to start correctly in some hosting environments.

### 2. The README does not fully document environment variables

The application requires configuration that is not completely documented in the existing README.

At minimum, the project uses:

```dotenv
DATABASE_PUBLIC_URL=
TMDB_API_KEY=
JWT_SECRET=
VITE_API_URL=
PORT=
NODE_ENV=
```

The exact values and local development setup should be documented before onboarding another developer.

### 3. TMDB API configuration is mandatory for movie data

Search, recommendations, details, genres, and advanced search all depend on:

```dotenv
TMDB_API_KEY=
```

Without a valid TMDB API key:

- search will fail;
- movie details will fail;
- recommendations will fail;
- advanced search will fail;
- genre loading will fail.

### 4. PostgreSQL and Prisma are mandatory for account features

The database URL is configured through:

```dotenv
DATABASE_PUBLIC_URL=
```

Without a working PostgreSQL database:

- registration will fail;
- login will fail;
- watchlists will not load;
- reviews will not work;
- profile updates will fail;
- Prisma migrations cannot be applied.

### 5. The “swipe matching” system is not clearly implemented

The application is described as “Tinder for Movies,” but the current route and component structure does not clearly show:

- a swipe card interface;
- left/right swipe actions;
- a matching algorithm;
- shared movie matching between users;
- pair recommendations;
- social matching between accounts.

The current implementation is more focused on movie discovery and personal organization than on actual Tinder-style matching.

### 6. There are duplicate `/me` route definitions

The backend defines `/me` more than once.

This creates unnecessary ambiguity and makes the server harder to maintain. Only one implementation should remain responsible for returning the authenticated user.

### 7. Error handling is inconsistent

Some routes validate input carefully, but many others return generic errors such as:

```text
Erreur serveur
```

Potential improvements would include:

- consistent error response formats;
- better validation;
- more meaningful HTTP status codes;
- handling database constraint errors;
- handling missing TMDB results;
- handling invalid movie identifiers;
- user-facing frontend error messages.

### 8. Password reset is not clearly implemented

The current frontend contains login and registration flows, but a complete password recovery process is not clearly visible in the current application structure.

A production-ready version would require:

- a forgot-password page;
- email delivery;
- reset tokens;
- token expiration;
- secure password replacement;
- confirmation messages.

### 9. Security defaults are not suitable for production

The server defines a fallback JWT secret:

```js
process.env.JWT_SECRET || "ultra_secret_key"
```

This is convenient for development but unsafe for production.

A production deployment should fail to start when `JWT_SECRET` is missing instead of using a known fallback value.

### 10. CORS is broadly configured

The backend currently uses:

```js
app.use(cors());
```

This allows broad cross-origin access.

For production, CORS should be restricted to the actual frontend domain.

### 11. Review logic contains possible inconsistencies

The backend contains more than one review creation route:

```text
POST /reviews
POST /reviews/:movieId
```

These two routes use slightly different data creation patterns.

This may create inconsistent review behavior depending on which route the frontend calls.

### 12. Review average calculations should be reviewed

Some review calculations include ratings from all retrieved reviews, while replies can have a null rating.

This means average rating logic should be checked carefully to ensure that:

- replies are excluded from averages;
- null ratings are ignored;
- only top-level reviews affect the movie rating;
- duplicate review behavior is controlled.

### 13. No automated test suite is visible

The repository does not show a dedicated automated test structure for:

- authentication;
- watchlist operations;
- reviews;
- TMDB integration;
- route protection;
- database behavior.

This means regressions could be introduced without being detected automatically.

### 14. The repository contains no Dockerfile

The repository contains Docker-related ignore files, but no current Dockerfile was found in the project structure.

As a result, Docker deployment is not directly documented or configured.

### 15. The frontend and backend configuration must match

The frontend uses:

```js
import.meta.env.VITE_API_URL
```

The backend is expected to run separately or serve the built frontend.

The value of `VITE_API_URL` must point to the correct backend URL in development and deployment.

For example:

```dotenv
VITE_API_URL=http://localhost:3000
```

If the frontend is deployed separately, this value must point to the deployed backend.

---

## Environment Variables

Create a `.env` file for the backend and a `.env` or `.env.local` file for the Vite frontend, depending on the deployment setup.

### Backend variables

```dotenv
DATABASE_PUBLIC_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
TMDB_API_KEY=your_tmdb_api_key
JWT_SECRET=your_long_random_secret
PORT=3000
NODE_ENV=development
```

### Frontend variable

```dotenv
VITE_API_URL=http://localhost:3000
```

The frontend variable must be available to Vite at build time.

---

## Installation

From the repository root:

```bash
cd flixmatch
npm install
```

The `postinstall` script runs:

```bash
prisma generate
prisma migrate deploy
```

This means a valid database configuration may be required during installation.

---

## Database Setup

The project uses Prisma with PostgreSQL.

Generate the Prisma client:

```bash
npx prisma generate
```

Apply existing migrations:

```bash
npx prisma migrate deploy
```

During development, a new migration can be created with:

```bash
npx prisma migrate dev --name migration_name
```

For example:

```bash
npx prisma migrate dev --name add_username_field
```

The Prisma schema is located at:

```text
prisma/schema.prisma
```

---

## Running the Application

### Development Frontend

From the `flixmatch` directory:

```bash
npm run dev
```

This starts the Vite development server.

The frontend usually runs on:

```text
http://localhost:5173
```

### Backend

The backend is started with:

```bash
npm run start
```

This executes:

```text
node server.js
```

The backend should normally run on the port configured by:

```dotenv
PORT=3000
```

### Production Build

Build the frontend:

```bash
npm run build
```

Preview the Vite production build:

```bash
npm run preview
```

Start the Express production server:

```bash
npm start
```

The Express server is designed to serve the generated `dist` directory.

---

## Available Scripts

```bash
npm run dev
```

Starts the Vite development server.

```bash
npm run build
```

Builds the React frontend.

```bash
npm run preview
```

Previews the generated Vite build.

```bash
npm run start
```

Starts the Express server.

```bash
npm run lint
```

Runs ESLint.

```bash
npx prisma generate
```

Generates the Prisma client.

```bash
npx prisma migrate deploy
```

Applies existing production migrations.

---

## Deployment

The repository contains configuration for Railway.

The Railway configuration uses:

```json
{
  "buildCommand": "npm run build",
  "startCommand": "npm run start"
}
```

A deployment environment must provide at least:

```dotenv
DATABASE_PUBLIC_URL=
TMDB_API_KEY=
JWT_SECRET=
PORT=
NODE_ENV=production
```

The frontend build must also receive:

```dotenv
VITE_API_URL=
```

### Deployment checklist

- PostgreSQL database created;
- database URL configured;
- Prisma migrations applied;
- TMDB API key configured;
- JWT secret configured;
- frontend API URL configured;
- production CORS configured;
- server configured to listen on the hosting platform's port;
- frontend production build generated;
- Express configured to serve `dist`;
- cookies configured correctly for the production domain;
- HTTPS enabled.

---

## User Journey

### New User

```text
Open FlixMatch
    ↓
Create an account
    ↓
Log in
    ↓
Search for movies or TV shows
    ↓
Open a movie detail page
    ↓
Add the title to the watchlist
    ↓
Watch the movie
    ↓
Mark it as seen
    ↓
Rate and review it
```

### Returning User

```text
Open FlixMatch
    ↓
Session is checked through /me
    ↓
User accesses the application
    ↓
User manages watchlist, favorites, seen titles, and junk
```

### Discovery Flow

```text
Search with TMDB
    ↓
Display search results
    ↓
Open movie or TV show details
    ↓
Display recommendations
    ↓
Add selected titles to personal collections
```

---

## Current Project Assessment

FlixMatch is more than a static frontend. It contains a real full-stack structure with:

- a React interface;
- an Express server;
- authentication;
- a relational database;
- external API integration;
- personal user data;
- protected routes;
- reviews and replies;
- deployment configuration.

The project is therefore a solid functional prototype.

However, it should not currently be presented as a completely production-ready service because:

- deployment configuration still needs verification;
- environment variables are not fully documented;
- the server port handling needs attention;
- security defaults need improvement;
- the swipe and matching concept is not fully implemented;
- no automated tests are visible;
- some route definitions and review flows are duplicated;
- error handling is inconsistent;
- password recovery is incomplete or not clearly implemented.

---

## Summary

FlixMatch is a movie and TV show discovery application inspired by Tinder-style browsing.

Its purpose is to help users:

```text
Find movies
    +
Explore recommendations
    +
Build a watchlist
    +
Track watched titles
    +
Save favorites
    +
Discard unwanted titles
    +
Rate and review content
```

The application currently includes a functional foundation based on:

```text
React
    +
Vite
    +
Express
    +
Prisma
    +
PostgreSQL
    +
TMDB API
```

The most complete part of the project is the combination of movie discovery and personal movie organization.

The “Tinder for Movies” aspect is currently more of a product concept than a fully implemented swipe-and-match system. The project is best described as a **full-stack movie discovery and personal library prototype**, with several advanced features already present and a number of technical improvements still required before production use.
