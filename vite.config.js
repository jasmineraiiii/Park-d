import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Local development: the Park'd backend runs on http://localhost:4000 (npm run dev in the
// backend folder). Requests to /api and the live-update socket are proxied there, so the
// UI and the API share one origin. Set PARKD_BACKEND to point somewhere else.
const backend = process.env.PARKD_BACKEND || 'http://localhost:4000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/socket.io': { target: backend, changeOrigin: true, ws: true },
    },
  },
});
