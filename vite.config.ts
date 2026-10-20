import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

          const rootJsPath = path.resolve(__dirname, 'app.bundle.js');
          const rootCssPath = path.resolve(__dirname, 'app.bundle.css');

          if (jsFile) {
            fs.copyFileSync(path.join(distAssets, jsFile), rootJsPath);
          }
          if (cssFile) {
            fs.copyFileSync(path.join(distAssets, cssFile), rootCssPath);
          }

          // Compute content hash of the built JS + CSS bundles so installed PWAs detect every update
          const hash = crypto.createHash('sha256');
          if (fs.existsSync(rootJsPath)) {
            hash.update(fs.readFileSync(rootJsPath));
          }
          if (fs.existsSync(rootCssPath)) {
            hash.update(fs.readFileSync(rootCssPath));
          }
          const versionHash = hash.digest('hex').slice(0, 8);

          // Stamp versionHash into sw.js
          const swPath = path.resolve(__dirname, 'sw.js');
          if (fs.existsSync(swPath)) {
            const swContent = fs.readFileSync(swPath, 'utf8');
            const updatedSw = swContent.replace(
              /const CACHE_NAME = ['"]dd-planner-[^'"]+['"];/,
              `const CACHE_NAME = 'dd-planner-${versionHash}';`
            );
            if (updatedSw !== swContent) {
              fs.writeFileSync(swPath, updatedSw, 'utf8');
            }
          }

          // Stamp versionHash into index.html
          const indexPath = path.resolve(__dirname, 'index.html');
          if (fs.existsSync(indexPath)) {
            const indexContent = fs.readFileSync(indexPath, 'utf8');
            const updatedIndex = indexContent.replace(
              /var BUNDLE_VERSION = ['"][^'"]*['"];/,
              `var BUNDLE_VERSION = '${versionHash}';`
            );
            if (updatedIndex !== indexContent) {
              fs.writeFileSync(indexPath, updatedIndex, 'utf8');
            }
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
