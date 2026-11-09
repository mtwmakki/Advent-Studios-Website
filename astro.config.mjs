// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mtwmakki.github.io',
  base: '/Advent-Studios-Website',
  trailingSlash: 'ignore',
  output: 'static',
  build: { inlineStylesheets: 'always' },
  // The 3D foldable (three.js) is one lazy chunk of about 145 KB gzipped, loaded only after the first scroll.
  vite: { build: { chunkSizeWarningLimit: 650 } },
});
