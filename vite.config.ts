import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * Identificación del build. Vercel expone el commit desplegado en `VERCEL_GIT_COMMIT_SHA`; en
 * local no existe y queda como "dev". Se incrusta en el bundle para que la app pueda decir en
 * pantalla qué versión está corriendo: sin eso, saber si un deploy tomó el último commit es
 * adivinar mirando la interfaz.
 */
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'

export default defineConfig({
  plugins: [react()],
  define: { __COMMIT__: JSON.stringify(COMMIT) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Puerto fijo del proyecto: strictPort evita que Vite salte a otro si está ocupado.
  server: {
    port: 5181,
    strictPort: true,
    // La app corre embebida en Monday (iframe) y también en el navegador suelto: el proxy
    // evita el CORS de api.monday.com y mantiene el token fuera de la URL.
    proxy: {
      '/monday-api': {
        target: 'https://api.monday.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/monday-api/, '/v2'),
      },
    },
  },
})
