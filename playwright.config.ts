import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}/Advent-Studios-Website/`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/Advent-Studios-Website/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
