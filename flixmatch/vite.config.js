import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // NEXT_PUBLIC_* accepté en plus de VITE_* (clé publique PostHog, voir src/lib/analytics.js)
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    outDir: 'dist'
  }
});
