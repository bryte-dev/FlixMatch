FROM node:18

WORKDIR /app

# Installer les dépendances
COPY package*.json ./
RUN npm install

# Copier le code source
COPY . .

# Générer le build du frontend
RUN npm run build

# Exécuter les migrations Prisma et démarrer le serveur
CMD npx prisma migrate deploy && node server.js
