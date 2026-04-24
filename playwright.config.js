const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/integration',
  timeout: 60_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
