import { defineConfig, devices } from '@playwright/test';
/** E2E runs against an isolated seeded DB (hubfares-test-e2e.sqlite) on port 3100 — never the demo DB. */
const env = { DATABASE_URL: 'file:./data/hubfares-test-e2e.sqlite', DEMO_MODE: 'mock', DEMO_CLOCK_MODE: 'system', DEMO_RESET_ENABLED: 'true', APP_BASE_URL: 'http://localhost:3100' };
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 20_000, navigationTimeout: 60_000 },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: process.env.E2E_USE_BUILD ? 'npm run seed && npx next start -p 3100' : 'npm run seed && npx next dev -p 3100',
    url: 'http://localhost:3100/login',
    timeout: 240_000,
    reuseExistingServer: false,
    env,
  },
});
