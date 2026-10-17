import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['brand/*.png', 'docs/*.pdf'],
      manifest: {
        name: 'Victor&Co CRM',
        short_name: 'Victor&Co',
        description: 'CRM Victor&Co Real Estate — operazioni, clienti, valutazioni, calendario',
        lang: 'it',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0d3447',
        background_color: '#ffffff',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/brand/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/brand/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Le mie operazioni', url: '/agent', icons: [{ src: '/brand/icon-192.png', sizes: '192x192' }] },
          { name: 'Calendario', url: '/calendar', icons: [{ src: '/brand/icon-192.png', sizes: '192x192' }] },
          { name: 'Vademecum', url: '/vademecum', icons: [{ src: '/brand/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // app shell: precache del build; navigazione SPA servita dall'index
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/docs\//],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Supabase: sempre rete; se offline, ultima risposta nota (max 1h)
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/(rest|storage)\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-api', networkTimeoutSeconds: 8, expiration: { maxEntries: 200, maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /\/docs\/.*\.pdf$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'docs', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
})
