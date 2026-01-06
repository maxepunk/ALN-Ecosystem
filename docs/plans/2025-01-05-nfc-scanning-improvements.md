# NFC Scanning Improvements Design

**Date:** 2025-01-05
**Status:** Ready for implementation
**Scope:** GM Scanner (ALNScanner)

## Problem Statement

Three interconnected issues make batch token scanning frustrating for GMs during live games:

1. **Serial fallback creates junk data** - When NDEF records are unreadable, falling back to serial number creates "Unknown Token" transactions that pollute history and appear on the public Detective scoreboard
2. **No debouncing** - Phone lingering near tag fires multiple NFC reads; second read triggers false "duplicate token" error
3. **Two taps between scans** - GM must tap "Scan Another Token" then "Start Scanning" for each token in a batch

## Design

### 1. NFCHandler: Remove Serial Fallback

**File:** `src/utils/nfcHandler.js`

**Current behavior:** When NDEF records are empty or unreadable, `extractTokenId()` returns the tag's serial number as the token ID.

**New behavior:** Return an explicit error result instead of unusable data.

```javascript
// Return object contract:
// Success: { id: "token123", source: "text-record", raw: "token123" }
// Failure: { id: null, source: "error", error: "no-ndef-records", raw: serialNumber }

extractTokenId(message, serialNumber) {
  // No records? Return error instead of serial fallback
  if (!message.records || message.records.length === 0) {
    Debug.log('No NDEF records found - returning error');
    return {
      id: null,
      source: 'error',
      error: 'no-ndef-records',
      raw: serialNumber  // Keep for debugging, but don't use as ID
    };
  }

  // Process records (text, url, generic decode)...
  for (const record of message.records) {
    // ... existing logic ...
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

### 2. NFCHandler: Add Debouncing

**File:** `src/utils/nfcHandler.js`

**Problem:** Web NFC fires multiple `reading` events when phone lingers near tag (500ms+).

**Solution:** Track last read, suppress same-tag reads within 2 second window.

```javascript
class NFCHandlerClass {
  constructor() {
    this.reader = null;
    this.isScanning = false;
    // NEW: Debouncing state
    this.lastRead = null;         // { id: string, timestamp: number }
    this.debounceMs = 2000;       // Ignore same tag within 2 seconds
  }

  async startScan(onRead, onError) {
    // ... existing setup ...

    this.reader.addEventListener("reading", ({ message, serialNumber }) => {
      try {
        const result = this.extractTokenId(message, serialNumber);

        // NEW: Debounce check (only for successful reads with an ID)
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
        // ... existing error handling ...
      }
    });

    // ... rest of method ...
  }
}
```

**Key decisions:**
- 2 second window - long enough to pull phone away, short enough for intentional re-scans
- Silent suppression - no error/callback, just ignore
- Only debounce successful reads (errors should always surface)

### 3. App.js: Handle Read Errors

**File:** `src/app/app.js`

**Change:** Check for error results at top of `processNFCRead()`.

```javascript
processNFCRead(result) {
  // NEW: Handle read errors (no serial fallback)
  if (result.source === 'error') {
    this.debug.log(`NFC read failed: ${result.error}`, true);
    this.uiManager.showError('Could not read token - please re-tap');
    // Don't navigate away, let quick-dismiss handle it
    return;
  }

  // ... existing flow continues ...
}
```

### 4. Batch Scanning UX: Auto-Start + Quick-Dismiss

**Goal:** Reduce batch scanning from 2 taps between scans to 0 taps.

#### 4a. Auto-start scanning on team confirmation

**File:** `src/app/app.js`

When GM confirms team selection, auto-start NFC scanning (user gesture = team confirm tap satisfies Web NFC requirement).

```javascript
async confirmTeamId(teamId) {
  // ... existing validation ...

  this.currentTeamId = teamId;
  this.uiManager.updateTeamDisplay(teamId);
  this.uiManager.showScreen('scan');

  // NEW: Auto-start scanning (team confirm tap is the gesture)
  if (this.nfcSupported) {
    await this.startNFCScanning();  // Renamed from startScan()
  }
}
```

#### 4b. Keep scanning active after successful scan

**File:** `src/app/app.js`

Remove button reset after successful scan in `recordTransaction()`:

```javascript
// REMOVE these lines (around line 884-888):
// const button = document.getElementById('scanButton');
// if (button) {
//   button.disabled = false;
//   button.textContent = 'Start Scanning';
// }
```

#### 4c. Quick-dismiss result screen

**File:** `src/ui/uiManager.js` (or `src/app/app.js`)

Add tap-anywhere-to-dismiss on result screen:

```javascript
showTokenResult(token, tokenId, isUnknown) {
  // ... existing result display logic ...

  this.showScreen('result');

  // NEW: Enable quick-dismiss (tap anywhere except Finish Team button)
  const resultScreen = document.getElementById('resultScreen');
  const finishButton = resultScreen.querySelector('[data-action="app.finishTeam"]');

  const dismissHandler = (event) => {
    // Don't dismiss if clicking Finish Team button
    if (finishButton && finishButton.contains(event.target)) {
      return;
    }
    resultScreen.removeEventListener('click', dismissHandler);
    this.showScreen('scan');  // Return to scan screen, same team, NFC still active
  };

  resultScreen.addEventListener('click', dismissHandler);
}
```

#### 4d. Update scan screen UI

**File:** `index.html`

Remove "Start Scanning" button, rename "Back to Team Entry":

```html
<!-- BEFORE -->
<button id="scanButton" class="btn btn-primary" data-action="app.startScan">Start Scanning</button>
<button class="btn btn-secondary" data-action="app.manualEntry">Manual Entry (Debug)</button>
<button class="btn btn-secondary" data-action="app.cancelScan">Back to Team Entry</button>

<!-- AFTER -->
<button class="btn btn-secondary" data-action="app.manualEntry">Manual Entry (Debug)</button>
<button class="btn btn-primary" data-action="app.finishTeam">Finish Team</button>
```

Update status text to show scanning is active:

```html
<p id="scanStatus">Scanning... Tap a token</p>
```

### 5. Apply Quick-Dismiss to Error States

Quick-dismiss should work for all result types (success, unknown token, duplicate, read error).

**Duplicate error (`showDuplicateError`):** Add same click handler pattern.

**Read error:** Show inline error on scan screen (via `uiManager.showError`), no navigation needed.

## Files Changed

| File | Changes |
|------|---------|
| `src/utils/nfcHandler.js` | Debouncing state + logic, error returns instead of serial fallback |
| `src/app/app.js` | Handle error results, auto-start scanning, remove button reset |
| `src/ui/uiManager.js` | Quick-dismiss handler on result screen |
| `index.html` | Remove Start Scanning button, rename Back button to Finish Team |

## New Scan Flow

```
1. Team Entry → tap "Confirm Team"
2. Scan screen shows, NFC auto-starts
3. GM taps token to phone
4. Result screen shows (success/error/duplicate)
5. GM taps anywhere → back to scan screen (NFC still active)
6. Repeat 3-5 for batch
7. GM taps "Finish Team" → team entry screen
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| NFC permission denied | Show error on scan screen, Manual Entry still available |
| NFC not supported | Auto-trigger simulated scan mode (existing behavior) |
| NDEF read error | Show "re-tap" message, quick-dismiss to retry |
| Duplicate token | Show duplicate message, quick-dismiss to continue |
| Rapid same-tag reads | Debounced at NFC layer, only first fires |
| Unreadable tag (serial only) | Error result, "re-tap" message, no junk transaction |

## Testing Considerations

- Unit tests for NFCHandler debouncing logic
- Unit tests for error result handling in processNFCRead
- E2E test for batch scanning flow (multiple tokens, same team)
- E2E test for quick-dismiss behavior
- Manual test on Android device with real NFC tags
