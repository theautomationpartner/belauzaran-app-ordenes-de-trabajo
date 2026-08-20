import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
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
