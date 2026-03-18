import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: { DATABASE_PATH: ':memory:' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
    },
    // Isolate each test file so in-memory store resets between files
    isolate: true,
    // Sequential within file to preserve deterministic state
    sequence: {
      shuffle: false,
    },
  },
});
