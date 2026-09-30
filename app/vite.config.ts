import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH permite servir bajo subcarpeta (p.ej. GitHub Pages: BASE_PATH=/Zenpai/);
// sin definirlo, raíz '/' como siempre (localhost, Vercel).
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono-zenpai.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'zenpai · tu mentor de cultivo',
        short_name: 'zenpai',
        description: 'Cuida tu cultivo de la semilla a la cosecha.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#05080a',
        theme_color: '#0a1310',
        lang: 'es',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icono-zenpai.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // las fotos de las guías "muéstrame cómo" (~1.3 MB) van en el precache: se abren sin internet
        // desde la primera visita. Van sin ?v= (howtos.ts), así coinciden con la URL del precache.
        // (las del remojo, agua-*, se piden con ?v= desde lib.ts: esas las guarda la caché de fotos)
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'assets/howto-*.webp'],
        // nuestras fotos viven en public/assets/, la misma carpeta que el JS con hash de Vite: sin
        // esto, workbox les pone revision:null y una foto reemplazada con el mismo nombre no le llega
        // a quien ya tiene la app. Solo el JS/CSS con hash se salta la revisión.
        dontCacheBustURLsMatching: /assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css)$/,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // las fotos llevan ?v=N (cache busting): el patrón tiene que aceptar la query
            urlPattern: /\/assets\/.*\.(?:jpg|jpeg|png|webp)(?:\?.*)?$/,
            handler: 'CacheFirst',
            // las 214 fotos de la carpa ya casi llenaban las 240 de antes
            options: { cacheName: 'zenpai-imagenes', expiration: { maxEntries: 300 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'zenpai-fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  server: { host: true, port: 5173 },
})
