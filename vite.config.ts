import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function createFdvBuildVersionPlugin(): Plugin {
  const builtAt = new Date().toISOString();
  const isoCompact = builtAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const rawCommit = String(process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || '').trim();
  const commitShort = rawCommit.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7);
  const rand = crypto.randomBytes(3).toString('hex');
  const buildId = commitShort ? `${isoCompact}-${commitShort}-${rand}` : `${isoCompact}-${rand}`;
  const payloadJson = `${JSON.stringify({ app: 'dashboard-fdv', buildId, builtAt }, null, 2)}\n`;

  let resolvedRoot = process.cwd();
  let resolvedOutDir = 'dist';

  return {
    name: 'fdv-build-version',
    config() {
      return {
        define: {
          __APP_BUILD_ID__: JSON.stringify(buildId),
          __APP_BUILT_AT__: JSON.stringify(builtAt),
        },
      };
    },
    configResolved(config) {
      resolvedRoot = config.root || process.cwd();
      resolvedOutDir = config.build?.outDir || 'dist';
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname !== '/version.json') {
          next();
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.end(payloadJson);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: payloadJson,
      });
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const absOutDir = path.isAbsolute(resolvedOutDir)
          ? resolvedOutDir
          : path.resolve(resolvedRoot, resolvedOutDir);
        const swPath = path.join(absOutDir, 'sw.js');
        if (fs.existsSync(swPath)) {
          const content = fs.readFileSync(swPath, 'utf8');
          if (content.includes('__APP_BUILD_ID__')) {
            fs.writeFileSync(swPath, content.split('__APP_BUILD_ID__').join(buildId), 'utf8');
          }
        }
      },
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), createFdvBuildVersionPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/bcv-proxy': {
          target: 'https://www.bcv.org.ve',
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/bcv-proxy/, ''),
        },
      },
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-pdf': ['jspdf', 'jspdf-autotable'],
            'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
  };
});
