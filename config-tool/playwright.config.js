// B0 BS.3 — the two config-tool Playwright smokes (D-B0.2r2). The spec
// manages its own server lifecycle against a fixture tree (the backend
// E2E precedent); nothing here touches the checked-in pack.
'use strict';
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 60000,
  use: {
    ignoreHTTPSErrors: true, // the tool serves the backend's self-signed pair
  },
});
