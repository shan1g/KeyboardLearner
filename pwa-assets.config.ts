import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Regenerate the PNG/ICO icons in public/ after changing public/icon.svg:
//   npx pwa-assets-generator
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#070b16' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#070b16' } },
  },
  images: ['public/icon.svg'],
});
