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
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.(?:jpg|jpeg|png|webp)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'zenpai-imagenes', expiration: { maxEntries: 80 } },
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
