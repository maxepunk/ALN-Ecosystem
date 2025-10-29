# Browser Context Manager for Multi-Device E2E Testing

## Overview

The Browser Context Manager (`browser-contexts.js`) provides isolated browser contexts for simulating multiple devices in E2E tests. This enables testing scenarios where multiple GM scanners, player scanners, admin panels, and scoreboard displays connect to the orchestrator simultaneously.

## Key Features

- **Isolated Browser Contexts**: Separate cookies, storage, and cache per device
- **Desktop and Mobile Viewports**: Pre-configured viewport sizes matching Playwright config
- **HTTPS Support**: Automatic handling of self-signed certificates (ignoreHTTPSErrors)
- **Multi-Instance Tracking**: Automatic tracking of all contexts for cleanup
- **Memory Management**: Prevents memory leaks through comprehensive cleanup

## API Reference

### Core Functions

#### `createBrowserContext(browser, contextType, options)`

Create an isolated browser context with specified configuration.

**Parameters:**
- `browser` (Browser): Playwright browser instance
- `contextType` ('desktop' | 'mobile'): Context type
- `options` (Object, optional): Additional context options
  - `viewport` (Object): Custom viewport override
  - `userAgent` (string): Custom user agent
  - `ignoreHTTPSErrors` (boolean): Ignore SSL errors (default: true)
  - `permissions` (Array): Permissions to grant
  - `locale` (string): Locale (default: 'en-US')
  - `timezoneId` (string): Timezone (default: 'America/New_York')

**Returns:** `Promise<BrowserContext>`

**Example:**
```javascript
const context = await createBrowserContext(browser, 'mobile');
```

---

#### `createMultipleContexts(browser, count, contextType, options)`

Create multiple browser contexts of the same type.

**Parameters:**
- `browser` (Browser): Playwright browser instance
- `count` (number): Number of contexts to create
- `contextType` ('desktop' | 'mobile'): Context type
- `options` (Object, optional): Additional context options

**Returns:** `Promise<Array<BrowserContext>>`

**Example:**
```javascript
const gmContexts = await createMultipleContexts(browser, 3, 'mobile');
```

---

#### `createPage(context)`

Create a new page in the specified browser context.

**Parameters:**
- `context` (BrowserContext): Browser context

**Returns:** `Promise<Page>`

**Example:**
```javascript
const page = await createPage(context);
```

---

#### `closeBrowserContext(context)`

Close a single browser context and remove from tracking.

**Parameters:**
- `context` (BrowserContext): Context to close

**Returns:** `Promise<void>`

**Example:**
```javascript
await closeBrowserContext(context);
```

---

#### `closeAllContexts()`

Close all tracked browser contexts. Use in `afterAll` hooks.

**Returns:** `Promise<void>`

**Example:**
```javascript
afterAll(async () => {
  await closeAllContexts();
});
```

---

### Inspection Functions

#### `getActiveContextCount()`

Get the number of currently active contexts.

**Returns:** `number`

---

#### `getAllActiveContexts()`

Get all active browser contexts (returns a copy).

**Returns:** `Array<BrowserContext>`

---

## Viewport Configurations

### Desktop Viewport
```javascript
{
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
  userAgent: 'Desktop Chrome'
}
```

### Mobile Viewport (Pixel 5)
```javascript
{
  viewport: { width: 393, height: 851 },
  deviceScaleFactor: 2.75,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Pixel 5'
}
```

## Multi-Instance Tracking

The module maintains a module-level array of all created contexts:

```javascript
const activeContexts = [];
```

**Tracking Behavior:**
- Contexts are added to array when created via `createBrowserContext()` or `createMultipleContexts()`
- Contexts are removed when closed via `closeBrowserContext()`
- All contexts are closed and cleared via `closeAllContexts()`

**Why This Matters:**
- Prevents memory leaks in test suites
- Enables global cleanup in `afterAll` hooks
- Provides visibility into active contexts for debugging

## Cleanup Strategy

### Per-Test Cleanup
```javascript
afterEach(async () => {
  await closeAllContexts();
});
```

### Suite-Level Cleanup
```javascript
afterAll(async () => {
  await closeAllContexts();
  await browser.close();
});
```

### Manual Cleanup
```javascript
const context = await createBrowserContext(browser, 'mobile');
// ... use context ...
await closeBrowserContext(context);
```

## Common Usage Patterns

### Pattern 1: Single Device Test
```javascript
const context = await createBrowserContext(browser, 'mobile');
const page = await createPage(context);
const scanner = new GMScannerPage(page);

await scanner.goto();
await scanner.enterTeam('001');
await scanner.manualEntry('sof002');
```

### Pattern 2: Multiple GM Scanners
```javascript
const contexts = await createMultipleContexts(browser, 3, 'mobile');
const pages = await Promise.all(contexts.map(ctx => createPage(ctx)));
const scanners = pages.map(page => new GMScannerPage(page));

await Promise.all(scanners.map(scanner => scanner.goto()));
await scanners[0].enterTeam('001');
await scanners[1].enterTeam('002');
await scanners[2].enterTeam('003');
```

### Pattern 3: Mixed Device Types
```javascript
const gmContexts = await createMultipleContexts(browser, 2, 'mobile');
const adminContext = await createBrowserContext(browser, 'desktop');

const gmPages = await Promise.all(gmContexts.map(ctx => createPage(ctx)));
const adminPage = await createPage(adminContext);

// GM scanners perform scans
// Admin panel observes WebSocket updates
```

## Integration with Page Objects

The browser context manager works seamlessly with page objects:

```javascript
const context = await createBrowserContext(browser, 'mobile');
const page = await createPage(context);

// Use page object
const scanner = new GMScannerPage(page);
await scanner.goto();
await scanner.enterTeam('001');
```

## Testing Multi-Device Scenarios

### Scenario 1: Concurrent Scanning (3 GM Scanners)
```javascript
const contexts = await createMultipleContexts(browser, 3, 'mobile');
const scanners = await Promise.all(contexts.map(async ctx => {
  const page = await createPage(ctx);
  return new GMScannerPage(page);
}));

await Promise.all(scanners.map(scanner => scanner.goto()));

// All scanners perform scans concurrently
await Promise.all([
  scanners[0].manualEntry('sof002'),
  scanners[1].manualEntry('jaw001'),
  scanners[2].manualEntry('vic003'),
]);
```

### Scenario 2: Admin Observing Scanner Activity
```javascript
const gmContext = await createBrowserContext(browser, 'mobile');
const adminContext = await createBrowserContext(browser, 'desktop');

const gmPage = await createPage(gmContext);
const adminPage = await createPage(adminContext);

const scanner = new GMScannerPage(gmPage);
await scanner.goto();
await scanner.manualEntry('sof002');

// Admin panel receives WebSocket sync:full event
// Verify state update in admin panel
```

### Scenario 3: Offline Queue Synchronization
```javascript
const contexts = await createMultipleContexts(browser, 2, 'mobile');
const scanners = /* setup scanners */;

// Scanners go offline
// Perform scans (queued locally)
await scanners[0].manualEntry('sof002');

// Verify offline queue
const isOffline = await scanners[0].isOffline();
expect(isOffline).toBe(true);

// Reconnect and verify sync
```

## Performance Considerations

### Raspberry Pi Optimization
The module includes Pi-specific browser arguments:

```javascript
const PI_BROWSER_ARGS = [
  '--disable-dev-shm-usage',  // Use /tmp instead of /dev/shm
  '--no-sandbox',              // Required for Pi compatibility
  '--disable-setuid-sandbox',
  '--disable-gpu',             // GPU reserved for VLC
  '--disable-web-security',    // Allow self-signed certs
];
```

### Parallel Context Creation
`createMultipleContexts()` creates contexts in parallel for faster test execution:

```javascript
// Creates 5 contexts in parallel (not sequential)
const contexts = await createMultipleContexts(browser, 5, 'mobile');
```

## Troubleshooting

### Issue: Contexts Not Cleaning Up
**Solution:** Ensure `closeAllContexts()` is called in `afterAll` hook:
```javascript
afterAll(async () => {
  await closeAllContexts();
  await browser.close();
});
```

### Issue: Memory Leaks in Test Suite
**Solution:** Use `afterEach` to clean up after each test:
```javascript
afterEach(async () => {
  await closeAllContexts();
});
```

### Issue: HTTPS Certificate Errors
**Solution:** Contexts automatically set `ignoreHTTPSErrors: true`. Verify it's not overridden:
```javascript
const context = await createBrowserContext(browser, 'mobile', {
  ignoreHTTPSErrors: true  // Explicitly set if needed
});
```

### Issue: Viewport Not Applied
**Solution:** Verify custom viewport is passed correctly:
```javascript
const context = await createBrowserContext(browser, 'mobile', {
  viewport: { width: 400, height: 800 }  // Override mobile default
});
```

## Testing the Module

Run smoke tests to validate functionality:

```bash
cd backend
npx jest tests/e2e/setup/browser-contexts.test.js --verbose
```

**Expected Output:**
```
✓ should create a desktop browser context with correct viewport
✓ should create a mobile browser context with correct viewport
✓ should create multiple contexts of the same type
✓ should simulate 3 GM scanners + 1 admin panel
✓ should create isolated contexts
... (19 tests total)
```

## Files

- `browser-contexts.js` - Main module implementation
- `browser-contexts.test.js` - Smoke tests validating functionality
- `browser-contexts.example.js` - Usage examples for common scenarios
- `BROWSER_CONTEXTS_README.md` - This documentation

## References

- Playwright Browser API: https://playwright.dev/docs/api/class-browser
- Playwright BrowserContext: https://playwright.dev/docs/api/class-browsercontext
- GM Scanner Page Object: `backend/tests/e2e/helpers/page-objects/GMScannerPage.js`
- Playwright Config: `backend/playwright.config.js`
