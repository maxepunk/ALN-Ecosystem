# FileStorage Implementation Bugs

## Bug: Session Files Not Being Saved to Disk

**Test:** `tests/unit/storage/FileStorage.test.js:54`
**Expected:** Session file should be saved at path `session-test-session-123.json`
**Actual:** File does not exist (ENOENT error when trying to stat the file)
**Evidence:**
```
ENOENT: no such file or directory, stat '/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/tests/fixtures/storage-test/session-test-session-123.json'
```

**Root Cause:** FileStorage may not be calling the save() method correctly, or persistenceService is not actually writing files to disk. The test creates a session and expects the file to exist, but the file is never created.

**Impact:** Affects 2 tests:
- "saves session to correct file path with correct structure"
- "persists multiple sessions independently"

## Bug: File Naming Mismatch for Multiple Sessions

**Test:** `tests/unit/storage/FileStorage.test.js:155`
**Expected:** Files named `session-session-1.json` and `session-session-2.json`
**Actual:** Files have hash-based names: `["962b0a7ca1e634d9576aedea261f31dd", "dce34729728717d1ca8103bc3168288c"]`
**Evidence:**
```
Expected value: "session-session-1.json"
Received array: ["962b0a7ca1e634d9576aedea261f31dd", "dce34729728717d1ca8103bc3168288c"]
```

**Root Cause:** FileStorage appears to be using a different file naming convention (hashing?) than what the test expects. Either the test expectations are wrong or the implementation changed without updating tests.

## Status

Tests left FAILING - implementation fix required separately.

The method name fix (get → load) is correct and those tests using load() are passing. These remaining failures are separate implementation bugs in the file persistence logic.
