import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'emit-root-github-pages-bundle',
      closeBundle() {
        try {
          const distAssets = path.resolve(__dirname, 'dist/assets');
          if (!fs.existsSync(distAssets)) return;
          const files = fs.readdirSync(distAssets);
          const jsFile = files.find((f) => f.endsWith('.js'));
          const cssFile = files.find((f) => f.endsWith('.css'));
          if (jsFile) {
            fs.copyFileSync(
              path.join(distAssets, jsFile),
              path.resolve(__dirname, 'app.bundle.js')
            );
          }
          if (cssFile) {
            fs.copyFileSync(
              path.join(distAssets, cssFile),
              path.resolve(__dirname, 'app.bundle.css')
            );
          }
        } catch (err) {
          console.error('Failed to copy root bundle for GitHub Pages:', err);
        }
      },
    },
  ],
  build: {
    assetsInlineLimit: 500000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/app.[ext]',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
