import { defineConfig } from 'playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/artifacts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 15_000
  },
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure'
  }
})
