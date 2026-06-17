import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the Express server so the SPA and API share an origin.
// envDir points one level up so the client reads the single repo-root .env
// (same file the server uses) for its VITE_* vars — we keep one .env, not two.
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
