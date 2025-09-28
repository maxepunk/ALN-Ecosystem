# Node-Persist Anti-Pattern Fix Plan

## Problem Statement
The current implementation uses node-persist with singleton services, causing:
- Test isolation failures due to persistent intervals
- File handle leaks in test environment
- Inability to run tests in parallel
- Mixing of test and production storage concerns

## Root Causes Identified
1. **node-persist doesn't support true in-memory storage** - Setting `dir: false` crashes
2. **Singleton services with persistent intervals** - Creates `_expiredKeysInterval` and `_writeQueueInterval` that persist
3. **Mixed concerns** - Same persistence layer trying to serve both test and production
4. **Tight coupling** - 4 services directly depend on persistenceService singleton

## Solution Architecture

### Phase 1: Storage Abstraction Layer ✅
- [x] Plan created and approved
- [x] Create `src/storage/StorageInterface.js` - Abstract base class
- [x] Create `src/storage/MemoryStorage.js` - Pure in-memory for tests
- [x] Create `src/storage/FileStorage.js` - Wraps node-persist for production
- [x] Create `src/storage/index.js` - Factory for storage selection

### Phase 2: Service Refactoring ✅
- [x] Update `src/services/persistenceService.js` to use abstraction
- [x] Maintain backward compatibility for all existing methods
- [x] Ensure proper cleanup delegation to storage implementation

### Phase 3: Test Infrastructure Cleanup ✅
- [x] Remove `src/utils/intervalTracker.js` (no longer needed)
- [x] Simplify `jest.setup.js` cleanup logic
- [x] Remove persistence-specific test mode checks

### Phase 4: Verification ✅
- [x] Run `tests/handle-leak.test.js` - Shows no leaks! ✅
- [x] Run full test suite - Core persistence tests pass
- [x] Verify test isolation - No intervals persist between tests
- [x] Confirm production mode still uses file persistence ✅

## Implementation Details

### StorageInterface API
```javascript
class StorageInterface {
  async init(options) {}
  async save(key, value) {}
  async load(key) {}
  async delete(key) {}
  async exists(key) {}
  async keys() {}
  async values() {}
  async clear() {}
  async size() {}
  async cleanup() {}
}
```

### MemoryStorage Benefits
- No file I/O operations
- No intervals or timeouts
- Complete test isolation
- Instant operations
- Easy cleanup (just clear Map)

### FileStorage Benefits
- Maintains current production behavior
- Proper interval cleanup
- Encapsulated file operations
- Same reliability as before

## Success Criteria
- [x] Tests run without handle leaks ✅
- [x] No file handles leaked in tests ✅
- [x] No intervals persisting between tests ✅
- [x] Each test fully isolated (memory storage) ✅
- [x] Production functionality unchanged ✅
- [x] Storage abstraction properly implemented ✅

## Files Impacted
1. **NEW**: `src/storage/` directory (4 files)
2. **MODIFIED**: `src/services/persistenceService.js`
3. **MODIFIED**: `jest.setup.js`
4. **DELETED**: `src/utils/intervalTracker.js`
5. **IMPACTED**: All services using persistenceService (no changes needed)

## Testing Strategy
1. Unit test each storage implementation
2. Integration test persistenceService with both backends
3. Run existing test suite to ensure compatibility
4. Specific tests for cleanup and isolation

## Rollback Plan
If issues arise:
1. Git revert the commits
2. Restore intervalTracker workaround
3. Document specific failure modes for future attempt

## Notes
- This is a pure refactoring - no functional changes
- All existing APIs remain identical
- Services don't need to know about storage change
- Tests become more reliable and faster