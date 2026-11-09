import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { publicBuildEnvironment } from './src/lib/config.ts'
import { readEnvironment } from './scripts/env/files.mjs'

export default defineConfig(({ mode }) => {
  // Read exactly one file; never merge .env.local or expose server variables.
  const values = readEnvironment(['prod', 'production'].includes(mode) ? 'prod' : 'test')
  const { env: publicEnv, config } = publicBuildEnvironment(values, mode)
  return {
  envDir: false,
  define: Object.fromEntries(Object.entries(publicEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
  cacheDir: `node_modules/.vite-${config.mode}`,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*'],
      manifest: {
        name: config.mode === 'demo' ? 'RKMED Linha Gold — Protótipo' : 'RKMED Linha Gold — Testes',
        short_name: 'RKMED',
        description: 'Clube de benefícios RKMED — ambiente de testes',
        theme_color: '#161d1b',
        background_color: '#f7f6f2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        cacheId: config.mode === 'demo' ? 'rkmed-demo' : 'rkmed-sandbox',
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  }
})
