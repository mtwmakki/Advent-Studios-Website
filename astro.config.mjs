// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mtwmakki.github.io',
  base: '/Advent-Studios-Website',
  trailingSlash: 'ignore',
  output: 'static',
  build: { inlineStylesheets: 'always' },
});
