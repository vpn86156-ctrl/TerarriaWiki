import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
export default defineConfig({
  plugins: [
    { name: 'source-html', transformIndexHtml: { order: 'pre', handler: () => readFileSync(new URL('./index.dev.html', import.meta.url), 'utf8') } },
    react(),
  ],
  server: { host: '0.0.0.0', allowedHosts: true },
});
