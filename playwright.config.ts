import { defineConfig, devices } from '@playwright/test';

const localBaseURL = 'http://127.0.0.1:4173/dazniausi-zodziai/';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? localBaseURL;
const useDeployedServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: './tests/browser',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'firefox-mobile',
      use: {
        ...devices['Desktop Firefox'],
        hasTouch: true,
        viewport: { width: 393, height: 852 }
      }
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'] }
    }
  ],
  webServer: useDeployedServer ? undefined : {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: localBaseURL,
    reuseExistingServer: false,
    timeout: 60_000
  }
});
