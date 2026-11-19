import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 30000,
    env: { DEMO_MODE: 'mock', DEMO_CLOCK_MODE: 'fixed', DEMO_FIXED_NOW: '2026-11-19T12:00:00.000Z', DEMO_RESET_ENABLED: 'true' },
  },
});
