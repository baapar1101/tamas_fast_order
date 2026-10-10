import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const buildTime = Date.now();

function generateVersionJsonPlugin(): Plugin {
  return {
    name: 'generate-version-json',
    writeBundle() {
      try {
        const outDir = path.resolve(__dirname, 'dist');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(
          path.resolve(outDir, 'version.json'),
          JSON.stringify({ buildTime })
        );
      } catch (e) {
        console.error('Failed to write version.json:', e);
      }
    },
  };
}

const GENERATED_CHUNK_FILE = /^(?:index|admin|vendor|react|router|query|pdf)-[A-Za-z0-9_-]{8,}\.(?:js(?:\.map)?|css)$/;

function pruneStaleGeneratedChunksPlugin(): Plugin {
  return {
    name: 'prune-stale-generated-chunks',
    apply: 'build',
    writeBundle(_options, bundle) {
      const outDir = path.resolve(__dirname, 'dist');
      const assetsDir = path.join(outDir, 'assets');
      if (!fs.existsSync(assetsDir)) return;

      const currentFiles = new Set(Object.keys(bundle).map((file) => path.resolve(outDir, file)));
      for (const entry of fs.readdirSync(assetsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !GENERATED_CHUNK_FILE.test(entry.name)) continue;
        const filePath = path.resolve(assetsDir, entry.name);
        if (!currentFiles.has(filePath)) fs.unlinkSync(filePath);
      }
    },
  };
}

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [react(), generateVersionJsonPlugin(), pruneStaleGeneratedChunksPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      'shop.tamasmarket.com',
      'tamasmarket.com'
    ],
    // Dev talks to the API on the same origin, so cookies and uploads behave
    // exactly as they do in production behind nginx.
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // The server places a .user.ini file inside dist/ which causes Vite's
    // emptyOutDir (rmSync) to crash with ENOTDIR. Keep that file while
    // pruning obsolete generated chunks after each successful build.
    emptyOutDir: false,
    rollupOptions: {
      output: {
        // The admin panel is a separate chunk: a shopper never downloads it.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('html2pdf.js') ||
              id.includes('html2canvas') ||
              id.includes('jspdf') ||
              id.includes('dompurify')
            ) return 'pdf';
            if (id.includes('react-router')) return 'router';
            // `scheduler` belongs with react-dom: splitting them makes the two
            // chunks import each other in a cycle.
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('/scheduler/')) return 'react';
            if (id.includes('@tanstack')) return 'query';
            return 'vendor';
          }
          if (id.includes('/src/admin/')) return 'admin';
          return undefined;
        },
      },
    },
  },
});

