import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Servido em https://dominio/host — os assets precisam resolver sob /host/.
  base: '/host/',
  plugins: [react()],
  resolve: {
    alias: {
      '@karick/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    fs: { allow: ['../..'] },
  },
});
