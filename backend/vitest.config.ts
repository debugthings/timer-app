import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './src/tests/globalSetup.ts',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run tests sequentially to avoid database conflicts
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    env: {
      DATABASE_URL: 'file:./test.db',
      NODE_ENV: 'test',
    },
  },
});
