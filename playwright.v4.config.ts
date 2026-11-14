import { defineConfig, devices } from '@playwright/test';
process.env.LUZELA_V4_READONLY_QA = '1';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /\/(?:storefront|landing-recovery|attribution|checkout-shell|collab|login|public-trust|admin-auth|funnel-observability)\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 2,
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'docs/qa/v4/playwright-report', open: 'never' }]],
  outputDir: 'docs/qa/v4/test-results',
  use: { ...devices['Desktop Chrome'], baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3002', trace: 'retain-on-failure' },
});
