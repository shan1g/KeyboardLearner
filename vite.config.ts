import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // New versions install in the background and apply on the next launch,
        // so a locked game is never reloaded mid-play.
        registerType: 'autoUpdate',
        injectRegister: 'script-defer',
        manifest: {
          id: '/',
          name: 'Keyboard Smasher',
          short_name: 'Smasher',
          description: 'A playful game for kids to learn letters by smashing the keyboard.',
          lang: 'en',
          display: 'fullscreen',
          display_override: ['fullscreen', 'standalone'],
          orientation: 'any',
          background_color: '#070b16',
          theme_color: '#070b16',
          categories: ['education', 'games', 'kids'],
          icons: [
            {src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png'},
            {src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png'},
            {src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
            {src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
        },
        workbox: {
          // Precache everything (app, fonts, icons) so it works fully offline after first visit.
          // Includes the Learn mode voice clips (public/voice/*.mp3, a few MB).
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,mp3}'],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
