import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readPublicConfig } from './src/lib/config.ts'

export default defineConfig(({ mode }) => {
  const config = readPublicConfig(loadEnv(mode, process.cwd(), 'VITE_'))
  return {
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
