import { defineConfig } from '@playwright/test';

// Os testes rodam contra o build de produção (vite preview), para exercitar o service worker.
// PW_CHANNEL=msedge ou PW_CHANNEL=chrome usa um navegador já instalado em vez do Chromium
// baixado pelo Playwright.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    channel: process.env.PW_CHANNEL || undefined,
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
