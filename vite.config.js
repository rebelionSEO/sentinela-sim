import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        → build normal en dist/ (para hosting: Vercel, Netlify, etc.)
// `npm run build:single` → un solo index.html con todo adentro (para compartir como archivo)
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  // Puerto propio para no chocar con otros proyectos que usan el 5173, y abre el navegador solo.
  server: { port: 5199, strictPort: true, open: true },
}));
