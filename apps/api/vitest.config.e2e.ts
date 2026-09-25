import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// e2e tests that touch the database (auth) run against the real Neon dev
// database configured in .env, since there is no isolated test database yet
// (see docs/Pendencias.md). Tests that need a DB must clean up after themselves.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Default (5000ms) is too tight for flows that award XP: each award now also
    // evaluates the badge catalog, adding several more real round trips to Neon.
    testTimeout: 15000,
    env: {
      NODE_ENV: 'test',
    },
  },
});
