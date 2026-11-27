import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  root: 'frontend',
  plugins: [tailwindcss()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:4173', changeOrigin: false } } },
});
