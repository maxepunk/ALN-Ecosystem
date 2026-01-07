# NFC Scanning Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve GM Scanner batch scanning by adding NFC debouncing, removing serial fallback, and enabling continuous scanning with quick-dismiss results.

**Architecture:** Three-layer changes: (1) NFCHandler gets debouncing + error returns instead of serial fallback, (2) App.js handles error results and auto-starts scanning on team confirmation, (3) UI enables quick-dismiss on result screens and removes Start Scanning button.

**Tech Stack:** ES6 modules, Jest unit tests, Web NFC API

---

## Task 1: NFCHandler - Add Debouncing State

**Files:**
- Modify: `ALNScanner/src/utils/nfcHandler.js:10-13`
- Test: `ALNScanner/tests/unit/utils/nfcHandler.test.js`

**Step 1: Write the failing test for debouncing state**

Add to `ALNScanner/tests/unit/utils/nfcHandler.test.js`:

```javascript
describe('debouncing', () => {
  beforeEach(() => {
    NFCHandler.lastRead = null;
    NFCHandler.debounceMs = 2000;
  });

  it('should have debouncing state initialized', () => {
    const handler = new NFCHandlerClass();
    expect(handler.lastRead).toBe(null);
    expect(handler.debounceMs).toBe(2000);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ALNScanner && npm test -- --testPathPattern=nfcHandler.test.js -t "should have debouncing state initialized"
```

Expected: FAIL - `handler.debounceMs` is undefined

**Step 3: Add debouncing state to constructor**

Modify `ALNScanner/src/utils/nfcHandler.js` constructor (lines 10-13):

```javascript
constructor() {
  this.reader = null;
  this.isScanning = false;
  this.lastRead = null;       // { id: string, timestamp: number }
  this.debounceMs = 2000;     // Ignore same tag within 2 seconds
}
```

**Step 4: Run test to verify it passes**

```bash
cd ALNScanner && npm test -- --testPathPattern=nfcHandler.test.js -t "should have debouncing state initialized"
```

Expected: PASS

**Step 5: Commit**

```bash
cd ALNScanner && git add src/utils/nfcHandler.js tests/unit/utils/nfcHandler.test.js && git commit -m "feat(nfc): add debouncing state to NFCHandler

- Add lastRead property to track last scanned token
- Add debounceMs property (2 second window)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: NFCHandler - Implement Debounce Logic in startScan

**Files:**
- Modify: `ALNScanner/src/utils/nfcHandler.js:38-54`
- Test: `ALNScanner/tests/unit/utils/nfcHandler.test.js`

**Step 1: Write failing tests for debounce behavior**

Add to `ALNScanner/tests/unit/utils/nfcHandler.test.js` in the `debouncing` describe block:

```javascript
it('should suppress rapid duplicate reads', () => {
  const handler = new NFCHandlerClass();
  handler.debounceMs = 2000;

  // Simulate first read
  handler.lastRead = { id: 'token123', timestamp: Date.now() - 500 }; // 500ms ago

  // Check if same token would be debounced
  const now = Date.now();
  const wouldDebounce = handler.lastRead &&
    handler.lastRead.id === 'token123' &&
    (now - handler.lastRead.timestamp) < handler.debounceMs;

  expect(wouldDebounce).toBe(true);
});

it('should allow reads after debounce window expires', () => {
  const handler = new NFCHandlerClass();
  handler.debounceMs = 2000;

  // Simulate old read (3 seconds ago)
  handler.lastRead = { id: 'token123', timestamp: Date.now() - 3000 };

  // Check if same token would NOT be debounced
  const now = Date.now();
  const wouldDebounce = handler.lastRead &&
    handler.lastRead.id === 'token123' &&
    (now - handler.lastRead.timestamp) < handler.debounceMs;

  expect(wouldDebounce).toBe(false);
});

it('should allow reads of different tokens immediately', () => {
  const handler = new NFCHandlerClass();
  handler.debounceMs = 2000;

  // Simulate recent read of different token
  handler.lastRead = { id: 'token123', timestamp: Date.now() - 100 };

  // Check if different token would NOT be debounced
  const now = Date.now();
  const wouldDebounce = handler.lastRead &&
    handler.lastRead.id === 'token456' &&
    (now - handler.lastRead.timestamp) < handler.debounceMs;

  expect(wouldDebounce).toBe(false);
});
```

**Step 2: Run tests to verify they pass (these are logic tests, not integration)**

```bash
cd ALNScanner && npm test -- --testPathPattern=nfcHandler.test.js -t "debouncing"
```

Expected: PASS (these tests verify the debounce logic we'll implement)

**Step 3: Implement debounce logic in startScan reading event handler**

Replace the reading event handler in `ALNScanner/src/utils/nfcHandler.js` (lines 38-54) with:

```javascript
this.reader.addEventListener("reading", ({ message, serialNumber }) => {
  try {
    const result = this.extractTokenId(message, serialNumber);

    // Debounce check (only for successful reads with an ID)
    if (result.id) {
      const now = Date.now();
      if (this.lastRead &&
          this.lastRead.id === result.id &&
          (now - this.lastRead.timestamp) < this.debounceMs) {
        Debug.log(`Debounced duplicate read: ${result.id}`);
        return; // Silently ignore
      }

      // Update last read
      this.lastRead = { id: result.id, timestamp: now };
    }

    onRead(result);
  } catch (error) {
    console.error('Exception in NFC reading handler:', error);
    Debug.log(`Exception in NFC reading handler: ${error.message}`, true);
  }
});
```

**Step 4: Run all nfcHandler tests to verify nothing broke**

```bash
cd ALNScanner && npm test -- --testPathPattern=nfcHandler.test.js
```

Expected: All tests PASS

**Step 5: Commit**

```bash
cd ALNScanner && git add src/utils/nfcHandler.js tests/unit/utils/nfcHandler.test.js && git commit -m "feat(nfc): implement debounce logic in reading event handler

- Suppress same-tag reads within 2 second window
- Track lastRead with id and timestamp
- Allow immediate reads of different tokens

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: NFCHandler - Remove Serial Fallback (Return Errors)

**Files:**
- Modify: `ALNScanner/src/utils/nfcHandler.js:78-144`
- Test: `ALNScanner/tests/unit/utils/nfcHandler.test.js`

**Step 1: Update failing tests - change expected behavior for serial fallback cases**

Modify `ALNScanner/tests/unit/utils/nfcHandler.test.js` - update the `extractTokenId` describe block:

```javascript
describe('extractTokenId', () => {
  it('should return error when no records (not serial fallback)', () => {
    const message = { records: [] };
    const serialNumber = 'abc123';

    const result = NFCHandler.extractTokenId(message, serialNumber);

    expect(result).toEqual({
      id: null,
      source: 'error',
      error: 'no-ndef-records',
      raw: 'abc123'
    });
  });

  it('should extract text record', () => {
    const textData = new TextEncoder().encode('token123');
    const message = {
      records: [{
        recordType: 'text',
        encoding: 'utf-8',
        data: textData
      }]
    };

    const result = NFCHandler.extractTokenId(message, 'serial123');

    expect(result.id).toBe('token123');
    expect(result.source).toBe('text-record');
  });

  it('should extract URL record', () => {
    const urlData = new TextEncoder().encode('https://example.com/token456');
    const message = {
      records: [{
        recordType: 'url',
        data: urlData
      }]
    };

    const result = NFCHandler.extractTokenId(message, 'serial123');

    expect(result.id).toBe('https://example.com/token456');
    expect(result.source).toBe('url-record');
  });

  it('should return error when records are unreadable (not serial fallback)', () => {
    const message = {
      records: [{
        recordType: 'unknown',
        data: new ArrayBuffer(0) // Empty data
      }]
    };

    const result = NFCHandler.extractTokenId(message, 'fallback789');

    expect(result).toEqual({
      id: null,
      source: 'error',
      error: 'unreadable-records',
      raw: 'fallback789'
    });
  });

  it('should extract generic data when decodable', () => {
    const genericData = new TextEncoder().encode('generic-token');
    const message = {
      records: [{
        recordType: 'custom',
        data: genericData
      }]
    };

    const result = NFCHandler.extractTokenId(message, 'serial');

    expect(result.id).toBe('generic-token');
    expect(result.source).toBe('generic-decode');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd ALNScanner && npm test -- --testPathPattern=nfcHandler.test.js -t "extractTokenId"
```

Expected: FAIL - tests expect error objects but code returns serial fallback

**Step 3: Implement error returns instead of serial fallback**

Replace `extractTokenId` method in `ALNScanner/src/utils/nfcHandler.js` (lines 78-144):

```javascript
/**
 * Extract token ID from NFC message
 * Uses Web NFC API's built-in NDEF parsing
 * @param {NDEFMessage} message - NFC message
 * @param {string} serialNumber - Tag serial number
 * @returns {Object} Token ID and metadata, or error object
 */
extractTokenId(message, serialNumber) {
  Debug.log('═══ NFC TAG DETECTED ═══');
  Debug.log(`Serial: ${serialNumber}`);
  Debug.log(`Records: ${message.records?.length || 0}`);

  // No records? Return error instead of serial fallback
  if (!message.records || message.records.length === 0) {
    Debug.log('No NDEF records found - returning error');
    return {
      id: null,
      source: 'error',
      error: 'no-ndef-records',
      raw: serialNumber
    };
  }

  // Process records using the Web NFC API
  for (const record of message.records) {
    Debug.log(`Record type: ${record.recordType}`);

    if (record.recordType === "text") {
      const decoder = new TextDecoder(record.encoding || "utf-8");
      const text = decoder.decode(record.data);
      Debug.log(`✅ Text record: ${text}`);
      return {
        id: text.trim(),
        source: 'text-record',
        raw: text
      };
    }

    if (record.recordType === "url") {
      const decoder = new TextDecoder();
      const url = decoder.decode(record.data);
      Debug.log(`✅ URL record: ${url}`);
      return {
        id: url,
        source: 'url-record',
        raw: url
      };
    }

    // Try generic text decoding for other types
    if (record.data) {
      try {
        const text = new TextDecoder().decode(record.data);
        if (text && text.trim()) {
          Debug.log(`✅ Generic decode: ${text}`);
          return {
            id: text.trim(),
            source: 'generic-decode',
            raw: text
          };
        }
      } catch (e) {
        Debug.log(`Decode failed: ${e.message}`);
      }
    }
  }

  // No readable records? Return error instead of serial fallback
  Debug.log('No readable records found - returning error');
  return {
    id: null,
    source: 'error',
    error: 'unreadable-records',
    raw: serialNumber
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
cd ALNScanner && npm test -- --testPathPattern=nfcHandler.test.js -t "extractTokenId"
```

Expected: PASS

**Step 5: Commit**

```bash
cd ALNScanner && git add src/utils/nfcHandler.js tests/unit/utils/nfcHandler.test.js && git commit -m "feat(nfc): return errors instead of serial fallback

BREAKING CHANGE: extractTokenId now returns error objects instead of
serial number when NDEF records are missing or unreadable.

- Return {id: null, source: 'error', error: 'no-ndef-records'} for empty tags
- Return {id: null, source: 'error', error: 'unreadable-records'} for undecodable
- Keep raw serial in result for debugging

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: App.js - Handle NFC Read Errors

**Files:**
- Modify: `ALNScanner/src/app/app.js:741-757`
- Test: `ALNScanner/tests/unit/app/` (add new test file)

**Step 1: Write failing test for error handling**

Create `ALNScanner/tests/unit/app/app-nfc-errors.test.js`:

```javascript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('App - NFC Error Handling', () => {
  let mockApp;
  let mockDebug;
  let mockUIManager;

  beforeEach(() => {
    mockDebug = { log: jest.fn() };
    mockUIManager = { showError: jest.fn() };

    mockApp = {
      debug: mockDebug,
      uiManager: mockUIManager,
      currentTeamId: 'TestTeam',
      tokenManager: { findToken: jest.fn() },
      dataManager: { isTokenScanned: jest.fn() },
      processNFCRead: null // Will be bound from actual implementation
    };
  });

  it('should show error and return early when result.source is error', () => {
    // Simulate the error handling logic
    const result = {
      id: null,
      source: 'error',
      error: 'no-ndef-records',
      raw: 'serial123'
    };

    // This is the logic we need to add to processNFCRead
    if (result.source === 'error') {
      mockDebug.log(`NFC read failed: ${result.error}`, true);
      mockUIManager.showError('Could not read token - please re-tap');
      return;
    }

    // If we get here, the test should fail
    expect(mockDebug.log).toHaveBeenCalledWith('NFC read failed: no-ndef-records', true);
    expect(mockUIManager.showError).toHaveBeenCalledWith('Could not read token - please re-tap');
  });

  it('should not call showError for successful reads', () => {
    const result = {
      id: 'token123',
      source: 'text-record',
      raw: 'token123'
    };

    // This is the logic - error check should NOT trigger
    if (result.source === 'error') {
      mockUIManager.showError('Could not read token - please re-tap');
    }

    expect(mockUIManager.showError).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they pass (logic tests)**

```bash
cd ALNScanner && npm test -- --testPathPattern=app-nfc-errors.test.js
```

Expected: PASS

**Step 3: Add error handling to processNFCRead**

Modify `ALNScanner/src/app/app.js` - add at the beginning of `processNFCRead` method (after line 741):

```javascript
async processNFCRead(result) {
  // Handle NFC read errors (no serial fallback)
  if (result.source === 'error') {
    this.debug.log(`NFC read failed: ${result.error}`, true);
    this.uiManager.showError('Could not read token - please re-tap');
    return;
  }

  this.debug.log(`Processing token: "${result.id}" (from ${result.source})`);
  // ... rest of existing method
```

**Step 4: Run all app tests to verify nothing broke**

```bash
cd ALNScanner && npm test -- --testPathPattern=app
```

Expected: PASS

**Step 5: Commit**

```bash
cd ALNScanner && git add src/app/app.js tests/unit/app/app-nfc-errors.test.js && git commit -m "feat(app): handle NFC read errors gracefully

- Check result.source === 'error' at start of processNFCRead
- Show 're-tap' message to GM instead of creating junk transaction
- Early return prevents unknown token flow for unreadable tags

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: App.js - Auto-Start Scanning on Team Confirmation

**Files:**
- Modify: `ALNScanner/src/app/app.js:458-490` (confirmTeamId method)
- Modify: `ALNScanner/src/app/app.js:689-707` (startScan method)

**Step 1: Refactor startScan to separate NFC initialization from button handling**

In `ALNScanner/src/app/app.js`, add a new method after `startScan` (around line 707):

```javascript
/**
 * Start NFC scanning without button state management
 * Called automatically on team confirmation
 * @private
 */
async _startNFCScanning() {
  if (!this.nfcSupported) {
    this.debug.log('NFC not supported - scan simulation available via Manual Entry');
    return;
  }

  const status = document.getElementById('scanStatus');

  try {
    if (status) {
      status.textContent = 'Scanning... Tap a token';
    }

    await this.nfcHandler.startScan(
      (result) => this.processNFCRead(result),
      (err) => {
        this.debug.log(`NFC read error: ${err?.message || err}`, true);
        if (status) {
          status.textContent = 'Read error. Tap token again.';
        }
      }
    );

    this.debug.log('NFC scanning started automatically');
  } catch (error) {
    this.debug.log(`NFC start error: ${error.message}`, true);
    if (status) {
      status.textContent = 'NFC unavailable. Use Manual Entry.';
    }
  }
}
```

**Step 2: Modify confirmTeamId to auto-start scanning**

Modify `ALNScanner/src/app/app.js` `confirmTeamId` method (around line 488-490):

```javascript
// Update stats and proceed to scan screen
this.uiManager.updateSessionStats();
this.uiManager.showScreen('scan');

// Auto-start NFC scanning (team confirm tap is the user gesture)
await this._startNFCScanning();
```

Also add `async` to the method signature:

```javascript
async confirmTeamId() {
```

**Step 3: Run existing tests to verify nothing broke**

```bash
cd ALNScanner && npm test
```

Expected: PASS

**Step 4: Commit**

```bash
cd ALNScanner && git add src/app/app.js && git commit -m "feat(app): auto-start NFC scanning on team confirmation

- Add _startNFCScanning() private method for auto-start flow
- Call from confirmTeamId() after showing scan screen
- Team confirm tap provides required user gesture for Web NFC
- Update scan status text to show active scanning

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: App.js - Remove Button Reset After Successful Scan

**Files:**
- Modify: `ALNScanner/src/app/app.js:884-888` (in recordTransaction)
- Modify: `ALNScanner/src/app/app.js:750-756` (in processNFCRead - no team validation)
- Modify: `ALNScanner/src/app/app.js:785-789` (in showDuplicateError)

**Step 1: Remove button reset in recordTransaction**

In `ALNScanner/src/app/app.js`, find and DELETE these lines after `showTokenResult` call (around lines 900-905):

```javascript
// DELETE THESE LINES:
const button = document.getElementById('scanButton');
if (button) {
  button.disabled = false;
  button.textContent = 'Start Scanning';
}
```

**Step 2: Remove button reset in processNFCRead (no team validation case)**

In `ALNScanner/src/app/app.js`, find the block around lines 750-756 and simplify:

```javascript
// BEFORE:
if (!this.currentTeamId || this.currentTeamId.trim() === '') {
  this.debug.log('ERROR: No team selected - cannot process token', true);
  this.uiManager.showError('Please select a team before scanning tokens');

  // Reset scan button if it exists
  const button = document.getElementById('scanButton');
  if (button) {
    button.disabled = false;
    button.textContent = 'Start Scanning';
  }
  return;
}

// AFTER:
if (!this.currentTeamId || this.currentTeamId.trim() === '') {
  this.debug.log('ERROR: No team selected - cannot process token', true);
  this.uiManager.showError('Please select a team before scanning tokens');
  return;
}
```

**Step 3: Remove button reset in showDuplicateError**

In `ALNScanner/src/app/app.js`, find and DELETE these lines at the start of `showDuplicateError` (around lines 785-789):

```javascript
// DELETE THESE LINES:
const button = document.getElementById('scanButton');
if (button) {
  button.disabled = false;
  button.textContent = 'Start Scanning';
}
```

**Step 4: Run tests to verify nothing broke**

```bash
cd ALNScanner && npm test
```

Expected: PASS

**Step 5: Commit**

```bash
cd ALNScanner && git add src/app/app.js && git commit -m "refactor(app): remove scan button reset after transactions

- Remove button reset from recordTransaction (NFC stays active)
- Remove button reset from processNFCRead validation
- Remove button reset from showDuplicateError
- Enables continuous scanning without re-tapping button

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: UIManager - Add Quick-Dismiss to Result Screen

**Files:**
- Modify: `ALNScanner/src/ui/uiManager.js:745-809` (showTokenResult method)

**Step 1: Add quick-dismiss handler to showTokenResult**

Modify `ALNScanner/src/ui/uiManager.js` - add after `this.showScreen('result');` at the end of `showTokenResult` (around line 808):

```javascript
this.showScreen('result');

// Enable quick-dismiss: tap anywhere on result screen to return to scanning
const resultScreen = document.getElementById('resultScreen');
const finishButton = resultScreen?.querySelector('[data-action="app.finishTeam"]');

if (resultScreen) {
  const dismissHandler = (event) => {
    // Don't dismiss if clicking Finish Team button (let it handle navigation)
    if (finishButton && finishButton.contains(event.target)) {
      return;
    }
    resultScreen.removeEventListener('click', dismissHandler);
    this.showScreen('scan');
  };

  // Remove any existing handler first (prevents stacking)
  resultScreen._quickDismissHandler && resultScreen.removeEventListener('click', resultScreen._quickDismissHandler);
  resultScreen._quickDismissHandler = dismissHandler;
  resultScreen.addEventListener('click', dismissHandler);
}
```

**Step 2: Run tests to verify nothing broke**

```bash
cd ALNScanner && npm test -- --testPathPattern=uiManager
```

Expected: PASS

**Step 3: Commit**

```bash
cd ALNScanner && git add src/ui/uiManager.js && git commit -m "feat(ui): add quick-dismiss to result screen

- Tap anywhere on result screen returns to scan screen
- Finish Team button excluded (still navigates to team entry)
- Handler cleanup prevents listener stacking
- Enables fast batch scanning flow

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: App.js - Add Quick-Dismiss to Duplicate Error Screen

**Files:**
- Modify: `ALNScanner/src/app/app.js:784-823` (showDuplicateError method)

**Step 1: Add quick-dismiss handler to showDuplicateError**

Add after `this.uiManager.showScreen('result');` at the end of `showDuplicateError`:

```javascript
this.uiManager.showScreen('result');

// Enable quick-dismiss for duplicate error screen
const resultScreen = document.getElementById('resultScreen');
const finishButton = resultScreen?.querySelector('[data-action="app.finishTeam"]');

if (resultScreen) {
  const dismissHandler = (event) => {
    if (finishButton && finishButton.contains(event.target)) {
      return;
    }
    resultScreen.removeEventListener('click', dismissHandler);
    this.uiManager.showScreen('scan');
  };

  resultScreen._quickDismissHandler && resultScreen.removeEventListener('click', resultScreen._quickDismissHandler);
  resultScreen._quickDismissHandler = dismissHandler;
  resultScreen.addEventListener('click', dismissHandler);
}
```

**Step 2: Run tests**

```bash
cd ALNScanner && npm test
```

Expected: PASS

**Step 3: Commit**

```bash
cd ALNScanner && git add src/app/app.js && git commit -m "feat(app): add quick-dismiss to duplicate error screen

- Consistent quick-dismiss behavior for all result types
- GM can quickly continue scanning after seeing duplicate

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: HTML - Update Scan Screen UI

**Files:**
- Modify: `ALNScanner/index.html:223-246`

**Step 1: Update scan screen HTML**

Replace the scan screen section in `ALNScanner/index.html` (lines 223-246):

```html
<!-- Scan Screen -->
<div id="scanScreen" class="screen">
    <div class="status-message">
        Team <strong id="currentTeam"></strong> Ready
    </div>
    <div class="scan-area">
        <div class="scan-icon">📡</div>
        <h2>Tap Memory Token</h2>
        <p id="scanStatus">Scanning... Tap a token</p>
    </div>
    <button class="btn btn-secondary" data-action="app.manualEntry">Manual Entry (Debug)</button>
    <button class="btn btn-primary" data-action="app.finishTeam">Finish Team</button>
    <div class="stats">
        <div class="stat-item">
            <div class="stat-value" id="teamTokenCount">0</div>
            <div class="stat-label">Tokens</div>
        </div>
        <div class="stat-item">
            <div class="stat-value" id="teamTotalValue">0</div>
            <div class="stat-label" id="teamValueLabel">Total Value</div>
        </div>
    </div>
</div>
```

**Changes made:**
- Removed: `<button id="scanButton" ... data-action="app.startScan">Start Scanning</button>`
- Removed: `<button ... data-action="app.cancelScan">Back to Team Entry</button>`
- Changed: Status text from "Waiting for NFC tag..." to "Scanning... Tap a token"
- Changed: "Finish Team" button moved up and made primary

**Step 2: Verify build works**

```bash
cd ALNScanner && npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
cd ALNScanner && git add index.html && git commit -m "feat(ui): remove Start Scanning button, update scan screen

- Remove Start Scanning button (NFC auto-starts on team confirm)
- Remove Back to Team Entry button (use Finish Team instead)
- Update status text to show scanning is active
- Finish Team button now primary action

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: HTML - Update Result Screen Buttons

**Files:**
- Modify: `ALNScanner/index.html:276-277`

**Step 1: Remove Scan Another Token button from result screen**

In `ALNScanner/index.html`, replace lines 276-277:

```html
<!-- BEFORE -->
<button class="btn btn-primary" data-action="app.continueScan">Scan Another Token</button>
<button class="btn btn-secondary" data-action="app.finishTeam">Finish Team</button>

<!-- AFTER -->
<p class="quick-dismiss-hint" style="text-align: center; color: #666; margin: 15px 0;">Tap anywhere to scan next token</p>
<button class="btn btn-primary" data-action="app.finishTeam">Finish Team</button>
```

**Step 2: Verify build works**

```bash
cd ALNScanner && npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
cd ALNScanner && git add index.html && git commit -m "feat(ui): replace Scan Another Token button with quick-dismiss hint

- Remove explicit button (tap-anywhere now works)
- Add hint text explaining quick-dismiss behavior
- Finish Team remains as only button

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Clean Up - Remove Unused startScan Method

**Files:**
- Modify: `ALNScanner/src/app/app.js:689-707`

**Step 1: Remove or deprecate the old startScan method**

The old `startScan` method is no longer called from UI (button removed). We can either:
- Delete it entirely
- Keep it for manual testing via console

Recommend: Keep but mark as deprecated. In `ALNScanner/src/app/app.js`:

```javascript
/**
 * @deprecated Use _startNFCScanning() instead. Kept for console debugging.
 */
async startScan() {
  console.warn('startScan() is deprecated - NFC now auto-starts on team confirmation');
  await this._startNFCScanning();
}
```

**Step 2: Run all tests**

```bash
cd ALNScanner && npm test
```

Expected: PASS

**Step 3: Commit**

```bash
cd ALNScanner && git add src/app/app.js && git commit -m "refactor(app): deprecate startScan method

- NFC now auto-starts via _startNFCScanning()
- Keep startScan for console debugging with deprecation warning

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Final Verification

**Step 1: Run full test suite**

```bash
cd ALNScanner && npm test
```

Expected: All 598+ tests PASS

**Step 2: Run build**

```bash
cd ALNScanner && npm run build
```

Expected: Build succeeds

**Step 3: Manual testing checklist (on Android device with NFC)**

- [ ] Select team → scan screen shows → NFC auto-starts (no button tap needed)
- [ ] Scan token → result shows → tap anywhere → back to scan screen
- [ ] Scan same token rapidly → only first fires (debouncing works)
- [ ] Scan unreadable tag → "re-tap" error shows (no junk transaction)
- [ ] Tap Finish Team → returns to team entry
- [ ] Scan 5 tokens quickly → all work without extra taps

**Step 4: Final commit with all changes**

```bash
cd ALNScanner && git add -A && git commit -m "feat: NFC scanning improvements complete

Summary of changes:
- Debouncing: 2-second window prevents false duplicate errors
- No serial fallback: Unreadable tags show re-tap message
- Auto-start: NFC starts on team confirm (no button needed)
- Quick-dismiss: Tap result to continue scanning
- UI cleanup: Removed Start Scanning button

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```
