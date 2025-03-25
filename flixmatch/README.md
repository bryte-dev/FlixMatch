# FlixMatch - Application de gestion de films et séries

FlixMatch est une application web qui permet aux utilisateurs de rechercher des films et séries, de les ajouter à leur watchlist, de les marquer comme favoris, et de partager leurs avis.

## Fonctionnalités

- Recherche de films, séries et acteurs via l'API TMDB
- Système d'authentification (inscription, connexion)
- Gestion de profil utilisateur avec nom d'utilisateur personnalisable
- Watchlist personnalisée
- Système de favoris
- Films vus et corbeille
- Détails complets sur les films et séries
- Recherche Google pour les acteurs
- Système d'avis et de commentaires
- Interface utilisateur moderne avec Material UI

## Installation

1. Clonez le dépôt
2. Installez les dépendances :
   ```bash
   cd flixmatch
   npm install
   ```
3. Configurez les variables d'environnement dans le fichier `.env`
4. Lancez l'application en mode développement :
   ```bash
   npm run dev
   ```

## Migration Prisma

Pour appliquer la migration Prisma pour le champ username, exécutez :
```bash
npx prisma migrate dev --name add_username_field
```

## Technologies utilisées

- React.js
- Material UI
- Prisma
- PostgreSQL
- API TMDB
- Axios
- React Router

## Nouvelles fonctionnalités

- **Design amélioré avec Material UI** : Interface utilisateur moderne et professionnelle
- **Champ username** : Les utilisateurs peuvent désormais définir et modifier leur nom d'utilisateur
- **Page Account** : Nouvelle page permettant aux utilisateurs de gérer leur profil
- **Recherche Google pour les acteurs** : Possibilité de cliquer sur un acteur pour lancer une recherche Google
- **Images par défaut** : Affichage d'images par défaut pour les acteurs et films sans image dans l'API TMDB
