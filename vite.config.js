import { defineConfig } from 'vite';

// `base: './'` makes the build work on GitHub Pages under /<repo>/ as well as on a custom domain.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
