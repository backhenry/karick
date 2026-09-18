import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@karick/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // session.ts lê SESSION_SECRET no import — precisa existir antes dos módulos.
    env: { SESSION_SECRET: 'test-secret-para-vitest-1234567890', NODE_ENV: 'test' },
  },
});
