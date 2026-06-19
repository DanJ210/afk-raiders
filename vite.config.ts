import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      workbox: {
        // Precache all built assets — the full app shell works offline
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // SPA: serve cached index.html for any navigation request while offline
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'AFK Raiders',
        short_name: 'AFK Raiders',
        description: 'A zero-player idle comedy game — watch your Raider loot, panic, and die.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        categories: ['games'],
        screenshots: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            form_factor: 'narrow',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
          },
        ],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Ready Up',
            short_name: 'Deploy',
            description: 'Open AFK Raiders',
            url: '/',
            icons: [
              {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
              },
            ],
          },
        ],
      },
    }),
  ],
  test: {
    // Engine tests run in Node — no DOM required
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
