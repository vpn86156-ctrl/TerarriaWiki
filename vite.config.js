import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import {buildOffline} from './scripts/offline-build.mjs';
export default defineConfig({
  plugins: [
    { name: 'source-html', transformIndexHtml: { order: 'pre', handler: () => readFileSync(new URL('./index.dev.html', import.meta.url), 'utf8') } },
    react(),
    {name:'offline-snapshot',apply:'build',writeBundle(){buildOffline()}},
  ],
  server: { host: '0.0.0.0', allowedHosts: true },
});
