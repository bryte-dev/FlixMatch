import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      input: "src/main.jsx"
    }),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0', // Permet à tous les appareils sur le réseau local d'accéder
    port: 5173, // Le port sur lequel le serveur écoute
  },
})
