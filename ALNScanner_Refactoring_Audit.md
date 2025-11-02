# ALNScanner Refactoring Plan - Comprehensive Audit Report

**Date**: November 2, 2025
**Auditor**: Claude
**Documents Reviewed**:
- ALNScanner_Refactoring_Plan.md (1,616 lines)
- ALNScanner_Screen_Flow_Analysis.md (1,989 lines)
- CLAUDE.md (parent repo)
- ALNScanner/CLAUDE.md (submodule)
- Backend contracts (asyncapi.yaml, openapi.yaml)

---

## Executive Summary

The refactoring plan is **fundamentally sound** with a well-structured 6-phase approach. However, there are **12 critical gaps and 18 recommendations** that need to be addressed before proceeding. The timeline estimate of 13-20 days may be **optimistic by 30-50%** when accounting for unforeseen issues and the missing items identified below.

**Overall Risk Assessment**: **MEDIUM-HIGH**
- **Architecture**: ✅ Solid
- **Testing Strategy**: ✅ Comprehensive
- **Timeline**: ⚠️ Optimistic
- **Deployment Strategy**: ❌ Critical Gap
- **Submodule Handling**: ❌ Critical Gap
- **Contract Compatibility**: ✅ Acknowledged but untested

---

## Critical Gaps (Must Address Before Starting)

### 1. **GitHub Pages Deployment Strategy (CRITICAL)**

**Issue**: The plan mentions Vite build process but completely omits GitHub Pages deployment configuration, which is essential for standalone mode.

**Impact**: HIGH - Standalone mode is a core feature
- Current system: Deployed to GitHub Pages at `https://maxepunk.github.io/ALNScanner/`
- Standalone mode **requires** GitHub Pages for offline operation without orchestrator
- Vite's default output may not work with GitHub Pages subdirectory paths

**Missing Details**:
```javascript
// vite.config.js - MISSING
export default defineConfig({
  base: '/ALNScanner/',  // CRITICAL: GitHub Pages subdirectory
  build: {
    outDir: 'dist',      // Must be 'dist' or '.' for GH Pages
    assetsDir: 'assets'  // Relative asset paths
  }
})
```

**Recommendation**:
- Add Phase 0 task: "Configure Vite for GitHub Pages deployment"
- Add Phase 6 task: "Test GitHub Pages deployment with standalone mode"
- Document deployment workflow in migration guide
- Create `.github/workflows/deploy.yml` for automated deployment
- Test that `data/tokens.json` is accessible after build (submodule issue - see #2)

---

### 2. **Git Submodule Handling (CRITICAL)**

**Issue**: The plan mentions loading from `data/tokens.json` but doesn't address how Vite will handle the git submodule directory structure.

**Current Structure**:
```
ALNScanner/
├── data/              # [Git submodule → ALN-TokenData]
│   └── tokens.json
```

**Problems**:
- Vite's build process may not copy submodule contents to dist/
- `public/` folder strategy won't work (data/ is outside public/)
- Token sync script (`sync.py`) needs to work with new structure
- GitHub Pages deployment must include submodule data

**Impact**: HIGH - Token database won't load after build

**Missing Details**:
1. Where does `data/` go in the new structure?
   - Option A: `public/data/` (copy manually, breaks submodule link)
   - Option B: `src/assets/data/` (bundled, large bundle size)
   - Option C: Custom Vite plugin to preserve `data/` in output
2. How does `sync.py` work with new structure?
3. How do we ensure GitHub Pages deployment includes `data/`?

**Recommendation**:
```javascript
// vite.config.js - ADD THIS
export default defineConfig({
  plugins: [
    {
      name: 'copy-token-data',
      writeBundle() {
        // Copy data/ submodule to dist/data/
        fs.cpSync('data', 'dist/data', { recursive: true });
      }
    }
  ]
})
```

**Alternative**: Keep tokens in submodule, use Vite's `copyPublicDir` option:
```javascript
export default defineConfig({
  publicDir: false, // Disable default public copy
  plugins: [
    // Custom plugin to copy specific submodule files
  ]
})
```

---

### 3. **HTTPS Requirement for NFC (UNDOCUMENTED)**

**Issue**: The plan doesn't explicitly call out that HTTPS is **mandatory** for Web NFC API testing and production.

**Current Reality** (from ALNScanner/CLAUDE.md):
- NFC requires HTTPS (except localhost)
- Development requires self-signed certificates
- GitHub Pages provides HTTPS automatically ✅
- Local dev needs `npx http-server -S -C cert.pem -K key.pem`

**Impact**: MEDIUM - Developers may waste time with HTTP-only dev servers

**Missing from Plan**:
- Phase 0: Generate self-signed certificates for local HTTPS dev
- Phase 4: Test NFC on HTTPS dev server (not HTTP)
- Phase 6: Document HTTPS requirement in README

**Recommendation**:
Add to Phase 0 (Preparation):
```bash
# Generate self-signed cert for local NFC testing
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Add to package.json
"scripts": {
  "dev": "vite --https --cert ./cert.pem --key ./key.pem",
  "dev:http": "vite"  // For non-NFC testing only
}
```

---

### 4. **Service Worker Migration (HIGH RISK)**

**Issue**: The plan mentions using Vite PWA plugin but doesn't address migration path from current `sw.js`.

**Current State**:
- Manual `sw.js` (76 lines) handles caching
- Registered in Phase 1J of initialization
- Uses Cache API with specific strategies

**Proposed State**:
- Vite PWA plugin generates new service worker
- Workbox-based caching strategies
- Different cache names and structure

**Risks**:
1. **Breaking change**: Old service worker conflicts with new one
2. **Cache invalidation**: Users stuck with old cached version
3. **Offline functionality**: Different cache strategies may break offline mode
4. **Version migration**: No plan to unregister old service worker

**Missing from Plan**:
```javascript
// src/main.js - ADD VERSION CHECK
if ('serviceWorker' in navigator) {
  // Unregister old service worker
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => {
      if (reg.scope.includes('/sw.js')) {
        reg.unregister();
      }
    });
  });
}
```

**Recommendation**:
- Add Phase 5.2 task: "Service Worker Migration Strategy"
  - Force cache invalidation on first load
  - Unregister old service worker
  - Test offline-to-online upgrade path
  - Document cache key changes
- Add to Migration Checklist: "Clear browser cache on all test devices"

---

### 5. **Standalone vs Networked Mode Split (ARCHITECTURAL)**

**Issue**: The plan treats both modes equally, but they have fundamentally different requirements.

**Current Reality**:
- **Standalone Mode**:
  - No Socket.io needed (60% of bundle size)
  - No admin panel needed
  - GitHub Pages deployment essential
  - Simpler state management

- **Networked Mode**:
  - Socket.io required
  - Admin panel required
  - WebSocket connection management
  - Complex state synchronization

**Missing from Plan**:
- Code splitting strategy to load Socket.io only in networked mode
- Lazy loading admin panel components (save 800+ lines)
- Conditional compilation or runtime feature flags

**Current Bundle Estimate**:
- Main: 50-80 KB
- Vendor (socket.io): 100-150 KB ⚠️ **Not needed in standalone!**

**Recommendation**:
```javascript
// Phase 5.1: Add conditional loading
export class App {
  async initNetworkedMode() {
    // Lazy load Socket.io only when needed
    const { io } = await import('socket.io-client');
    const { OrchestratorClient } = await import('./network/orchestratorClient.js');

    this.orchestratorClient = new OrchestratorClient(io);
  }

  async initStandaloneMode() {
    // No Socket.io loaded, smaller bundle
    console.log('Standalone mode - no network dependencies loaded');
  }
}
```

**Expected Savings**:
- Standalone bundle: ~80 KB (down from ~230 KB)
- Networked bundle: ~230 KB (same as before)
- 65% bundle size reduction for standalone users

---

### 6. **localStorage Key Migration (BREAKING CHANGE)**

**Issue**: The plan doesn't address migrating existing localStorage data to new structure.

**Current Keys** (from Screen Flow Analysis):
```
aln_transactions
aln_scanned_tokens
aln_deviceId
aln_stationName
aln_mode
orchestratorUrl
gmToken
deviceId
stationName
mode
gameSessionMode
lastStationNum
orchestratorOfflineQueue
```

**Problem**: New centralized store will use different keys
- Risk of data loss for users with active sessions
- No migration path documented
- localStorage keys duplicated (e.g., `deviceId` and `aln_deviceId`)

**Missing from Plan**:
```javascript
// src/services/persistenceService.js - ADD MIGRATION
export class PersistenceService {
  migrateFromLegacy() {
    // Migrate old keys to new structure
    const oldTransactions = localStorage.getItem('aln_transactions');
    if (oldTransactions && !localStorage.getItem('app_state_v2')) {
      const migrated = this.transformLegacyData(oldTransactions);
      localStorage.setItem('app_state_v2', JSON.stringify(migrated));

      // Keep old data for 30 days (rollback safety)
      localStorage.setItem('legacy_backup', oldTransactions);
      localStorage.setItem('migration_date', Date.now());
    }
  }
}
```

**Recommendation**:
- Add Phase 1.4 task: "localStorage Migration Strategy"
- Write migration function in persistenceService
- Test with real localStorage data
- Add rollback capability
- Document breaking change in migration guide

---

### 7. **URL Mode Override (`?mode=blackmarket`) (MISSING)**

**Issue**: The plan doesn't mention preserving the URL query parameter override feature.

**Current Feature** (from Screen Flow Analysis):
- Phase 1B: ApplyURLModeOverride()
- `?mode=blackmarket` or `?mode=black-market` overrides stored mode
- Used for testing and quick mode switching

**Impact**: MEDIUM - Useful debugging feature
- Not critical but valuable for testing
- Easy to lose during refactor

**Recommendation**:
Add to Phase 1.3 (Refactor JavaScript Modules):
```javascript
// src/utils/config.js
export function applyURLModeOverride() {
  const params = new URLSearchParams(window.location.search);
  const urlMode = params.get('mode');

  if (urlMode === 'blackmarket' || urlMode === 'black-market') {
    return 'blackmarket';
  } else if (urlMode === 'detective') {
    return 'detective';
  }

  return null; // No override
}
```

---

### 8. **Admin Audit Trail Format (CONTRACT COMPATIBILITY)**

**Issue**: The plan doesn't verify that admin adjustment format matches backend contract.

**Backend Contract** (from asyncapi.yaml, score:updated event):
```yaml
adminAdjustments:
  type: array
  items:
    gmStation: string
    delta: number
    reason: string
    timestamp: string
```

**Screen Flow Analysis mentions**:
- "Includes admin adjustments audit trail"
- "adminAdjustments array"

**But Plan Doesn't Show**:
- Where this data structure is parsed
- How it's displayed in UI
- Whether format is validated

**Recommendation**:
Add to Phase 3.3 (Refactor Network Layer):
```javascript
// src/network/orchestratorClient.js
#setupEventHandlers() {
  this.#socket.on('score:updated', (envelope) => {
    const { teamId, totalScore, adminAdjustments } = envelope.data;

    // Validate contract format
    if (adminAdjustments && !Array.isArray(adminAdjustments)) {
      console.error('Invalid adminAdjustments format');
      return;
    }

    this.emit('scoreUpdate', {
      teamId,
      totalScore,
      adminAdjustments: adminAdjustments || []
    });
  });
}
```

---

### 9. **Offline Queue Deduplication (DATA INTEGRITY)**

**Issue**: The plan mentions offline queue but doesn't detail deduplication strategy.

**Current System** (from Screen Flow Analysis):
- NetworkedQueueManager queues transactions when offline
- Rate limiting to prevent server overload
- Deduplicates to prevent double-submission

**Problem**: How does deduplication work after refactor?
- Transaction IDs?
- Timestamp-based?
- RFID + Team ID composite key?

**Missing Details**:
```javascript
// src/services/queueService.js - HOW IS THIS IMPLEMENTED?
export class QueueService {
  isDuplicate(transaction) {
    // MISSING: What's the deduplication key?
    // Option 1: tx.id (but transactions may not have IDs yet)
    // Option 2: `${tx.rfid}_${tx.teamId}` (but what about re-scans?)
    // Option 3: Timestamp-based (risky)
  }
}
```

**Recommendation**:
- Add to Phase 3.1: "Define transaction deduplication strategy"
- Use composite key: `${tokenId}_${teamId}_${timestamp_rounded_to_second}`
- Document in service layer design
- Add unit tests for edge cases:
  - Same token, same team, rapid succession
  - Queue sync after long offline period
  - Partial queue submission (some succeed, some fail)

---

### 10. **Video Queue Display (ADMIN PANEL)**

**Issue**: The plan shows admin panel structure but doesn't detail video queue component.

**Current Admin Panel** (from Screen Flow Analysis):
- Video queue display (scrollable list)
- Shows upcoming videos
- Progress bar for current video
- Manual video addition via autocomplete

**Missing from Plan**:
- How is video autocomplete populated?
- Where does video list come from?
- Is it from backend or hardcoded?

**Impact**: MEDIUM - Admin panel won't be fully functional

**Recommendation**:
Add to Phase 2.2 (Create Component Library):
```javascript
// src/admin/VideoController.js
export class VideoController {
  #availableVideos = []; // Populated from backend

  async loadAvailableVideos() {
    // Get video list from backend /api/videos endpoint
    // OR parse from orchestrator sync:full event
    const response = await fetch(`${this.orchestratorUrl}/api/videos`);
    this.#availableVideos = await response.json();
    this.renderAutocomplete();
  }
}
```

**Check**: Does backend have `/api/videos` endpoint?
- If not, add to contracts
- If yes, verify it's in openapi.yaml

---

### 11. **Manual Entry Fallback (NFC ALTERNATIVE)**

**Issue**: The plan mentions NFC service but doesn't detail manual entry fallback.

**Current System** (from Screen Flow Analysis):
- "Manual Entry (Debug)" button on Scan Screen
- `prompt()` dialog for RFID input
- Processes same as NFC scan

**Why It Matters**:
- NFC only works on Android Chrome/Edge
- Desktop testing requires manual entry
- iOS devices can't use NFC
- Critical for development workflow

**Missing from Plan**:
```javascript
// src/services/nfcService.js - ADD MANUAL FALLBACK
export class NFCService {
  async startScan() {
    if (this.isSupported) {
      return this.startNFCScan();
    } else {
      return this.startManualEntry(); // ← NOT IN PLAN
    }
  }

  async startManualEntry() {
    const rfid = prompt('Enter token RFID:');
    if (!rfid) return null;

    return {
      id: rfid.trim(),
      source: 'manual',
      raw: rfid
    };
  }
}
```

**Recommendation**:
- Add to Phase 3.1: "Implement manual entry fallback in NFCService"
- Add UI toggle: "Use Manual Entry" checkbox
- Add to E2E tests: Test manual entry flow

---

### 12. **Rollback Strategy Details (RISK MITIGATION)**

**Issue**: The plan mentions "rollback strategy" but doesn't provide concrete steps.

**Plan States**:
- "Preserve ARCHIVE/: Keep fully functional legacy version"
- "Feature Branch: Work on refactor/modular-architecture branch"
- "Parallel Deployment: Run both versions side-by-side"

**Missing**:
1. How to run both versions side-by-side?
   - Separate subdirectories on GitHub Pages?
   - Different branches deployed to different URLs?
2. What triggers a rollback?
   - Critical bugs found?
   - Performance degradation?
   - NFC doesn't work?
3. How long to keep old version?
   - Until refactor proven stable?
   - 30 days?
   - One game session?

**Recommendation**:
```yaml
# .github/workflows/deploy-both-versions.yml
name: Deploy Both Versions

on:
  push:
    branches: [refactor/modular-architecture]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Legacy to /legacy
        run: |
          cp -r ARCHIVE/* deploy/legacy/

      - name: Build and Deploy New to /beta
        run: |
          npm run build
          cp -r dist/* deploy/beta/

      - name: Deploy to GitHub Pages
        # Both versions accessible:
        # https://maxepunk.github.io/ALNScanner/       (legacy)
        # https://maxepunk.github.io/ALNScanner/beta/  (new)
```

**Rollback Criteria** (add to plan):
- If > 3 critical bugs found in first week
- If NFC success rate < 95% (vs 99% in legacy)
- If bundle size > 500 KB (performance regression)
- If any core user flow broken

---

## Medium-Priority Issues (Should Address)

### 13. **Debug Console Persistence**

**Issue**: Debug view in networked mode - how is it preserved in new architecture?

**Current**:
- `debug.js` utility with global Debug object
- Debug console in networked mode shows real-time logs

**Plan Shows**:
- `utils/debug.js` preserved
- Debug view mentioned

**Missing**: How do logs accumulate in new event-driven architecture?

**Recommendation**: Add event bus for debug logging
```javascript
// src/utils/debug.js
export const Debug = {
  logs: [],
  maxLogs: 1000,

  log(message) {
    const entry = { timestamp: Date.now(), message };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.shift();

    // Emit event for debug view
    window.dispatchEvent(new CustomEvent('debug:log', { detail: entry }));
  }
};
```

---

### 14. **Token Matching Fuzzy Logic**

**Issue**: Plan mentions "token matching" but doesn't detail fuzzy matching logic.

**Screen Flow Analysis States**:
- "Fuzzy matching on RFID"
- "Handles case variations"
- "Handles format variations (with/without colons)"

**Missing**: Where does this logic live in new architecture?

**Recommendation**:
```javascript
// src/services/tokenService.js
export class TokenService {
  normalizeRFID(rfid) {
    return rfid
      .toLowerCase()
      .replace(/[^a-f0-9]/g, '')  // Remove non-hex chars
      .trim();
  }

  findToken(rfid) {
    const normalized = this.normalizeRFID(rfid);

    // Try exact match first
    if (this.#database[normalized]) {
      return { token: this.#database[normalized], matchedId: normalized };
    }

    // Try fuzzy match (case variations, format variations)
    for (const [id, token] of Object.entries(this.#database)) {
      if (this.normalizeRFID(id) === normalized) {
        return { token, matchedId: id };
      }
    }

    return null;
  }
}
```

---

### 15. **History Badge Count Updates**

**Issue**: Plan shows history badge in header but doesn't detail update mechanism.

**Current**: `UIManager.updateHistoryBadge()` called after transactions

**Missing**: In event-driven architecture, what triggers badge update?

**Recommendation**:
```javascript
// src/store/modules/transactions.js
actions: (store) => ({
  add(transaction) {
    store.state.transactions.items.push(transaction);

    // Trigger badge update
    store.notify('transactions.count');
  }
})

// src/components/layout/Header.js
constructor({ store }) {
  this.unsubscribe = store.subscribe('transactions.count', (count) => {
    this.updateBadge(count);
  });
}
```

---

### 16. **Scoreboard Rank Styling**

**Issue**: Plan shows scoreboard but doesn't detail medal/gradient rendering.

**Current CSS Classes**:
- `.scoreboard-entry.rank-1` - Gold gradient
- `.scoreboard-entry.rank-2` - Silver gradient
- `.scoreboard-entry.rank-3` - Bronze gradient

**Missing**: How is this styled in component-based architecture?

**Recommendation**:
```javascript
// src/components/cards/ScoreboardEntry.js
export class ScoreboardEntry {
  render() {
    const rankClass = this.getRankClass(this.entry.rank);
    const medal = this.getMedalIcon(this.entry.rank);

    this.element.className = `scoreboard-entry ${rankClass}`;
    this.element.innerHTML = `
      <span class="rank-medal">${medal}</span>
      <span class="team-id">${this.entry.teamId}</span>
      <span class="score">$${this.entry.totalScore}</span>
    `;
  }

  getRankClass(rank) {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return '';
  }

  getMedalIcon(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }
}
```

---

### 17. **Session Stats Calculation**

**Issue**: Plan shows stats display but doesn't detail calculation logic.

**Current**: `DataManager.getSessionStats()` computes:
- Total scans count
- Unique teams count
- Total value/score
- Average value/score

**Missing**: Where does this live in new architecture?

**Recommendation**:
```javascript
// src/services/transactionService.js
export class TransactionService {
  getSessionStats() {
    const transactions = this.store.state.transactions.items;
    const uniqueTeams = new Set(transactions.map(t => t.teamId));

    const totalValue = transactions.reduce((sum, t) => sum + (t.value || 0), 0);
    const avgValue = transactions.length > 0 ? totalValue / transactions.length : 0;

    return {
      totalScans: transactions.length,
      uniqueTeams: uniqueTeams.size,
      totalValue,
      avgValue: Math.round(avgValue)
    };
  }
}
```

---

### 18. **Screen Transition Animations**

**Issue**: Plan doesn't mention preserving screen transition animations.

**Current**: Likely CSS transitions for screen visibility changes

**Risk**: New architecture may break smooth transitions

**Recommendation**:
Add to Phase 1.1 (Extract CSS):
- Preserve transition/animation classes
- Test screen transitions after CSS extraction
- Add `.screen-enter` and `.screen-leave` animations if not present

---

## Timeline Analysis

### Original Estimate: 13-20 days (3-4 weeks)

**Phase Breakdown**:
| Phase | Estimate | Realistic | Notes |
|-------|----------|-----------|-------|
| Phase 0: Preparation | 1-2 days | 2-3 days | +SSL certs, +GH Pages config, +submodule strategy |
| Phase 1: Extract & Modularize | 3-5 days | 5-7 days | +localStorage migration, +URL override, +CSS animations |
| Phase 2: Components | 3-4 days | 4-5 days | +Video queue, +scoreboard styling, +history badge |
| Phase 3: Services | 2-3 days | 3-4 days | +Offline queue dedup, +admin audit format validation |
| Phase 4: Testing | 2-3 days | 3-5 days | +NFC testing on HTTPS, +service worker migration tests |
| Phase 5: Optimization | 1-2 days | 2-3 days | +Standalone/networked split, +GitHub Pages deployment |
| Phase 6: Documentation | 1 day | 2 days | +Deployment guide, +localStorage migration guide |
| **Total** | **13-20 days** | **21-31 days** | **+50% realistic estimate** |

**Unaccounted Time**:
- Bug fixes: +3-5 days
- Unforeseen issues: +2-3 days
- Testing on real devices (Android NFC): +1-2 days
- Code review and revisions: +2-3 days

**Realistic Total**: **28-42 days (4-6 weeks)**

---

## Risk Assessment Updates

### Additional High-Risk Items (Not in Plan)

**1. Bundle Size for Standalone Mode**
- **Risk**: Including Socket.io in standalone mode wastes 150 KB
- **Mitigation**: Conditional loading (see Gap #5)
- **Impact**: 65% bundle size reduction possible

**2. GitHub Pages Asset Paths**
- **Risk**: Vite's default base path may not work with GitHub Pages
- **Mitigation**: Configure `base: '/ALNScanner/'` in vite.config.js
- **Impact**: Complete app failure on GitHub Pages

**3. Service Worker Version Conflict**
- **Risk**: Old service worker interferes with new one
- **Mitigation**: Force unregister old SW (see Gap #4)
- **Impact**: Users stuck with broken cached version

**4. Token Database Submodule After Build**
- **Risk**: `data/` directory not copied to dist/
- **Mitigation**: Custom Vite plugin (see Gap #2)
- **Impact**: App loads but no tokens available

---

## Testing Strategy Enhancements

### Missing Test Scenarios

**1. Cross-Browser Testing**
- [ ] Chrome (NFC)
- [ ] Edge (NFC)
- [ ] Firefox (manual entry only)
- [ ] Safari (manual entry only)
- [ ] Mobile Chrome (actual NFC hardware)

**2. Deployment Testing**
- [ ] GitHub Pages deployment with submodule
- [ ] Standalone mode on GitHub Pages
- [ ] Networked mode with custom orchestrator URL
- [ ] Service worker upgrade path

**3. Data Migration Testing**
- [ ] Users with existing localStorage data
- [ ] Empty localStorage (new users)
- [ ] Corrupted localStorage (edge case)
- [ ] Multi-tab sync (localStorage changes in other tab)

**4. Offline/Online Transitions**
- [ ] Go offline during scan
- [ ] Queue multiple transactions while offline
- [ ] Reconnect and sync queue
- [ ] Deduplication works correctly

---

## Open Questions (Still Unanswered)

### From Plan's "Open Questions" Section

1. **TypeScript Migration**: ✅ Recommendation: Start with JSDoc (Phase 1), defer TS to future
2. **UI Framework**: ✅ Recommendation: Keep Vanilla JS (Option A) for minimal disruption
3. **State Management Library**: ✅ Recommendation: Custom store (in plan) is fine
4. **CSS Methodology**: ⚠️ Recommendation: Keep current classes, extract to files
5. **Test Strategy**: ✅ Recommendation: Prioritize integration tests (screens) first

### New Questions from Audit

6. **Submodule Strategy**: How do we handle `data/` in Vite build?
   - Recommendation: Custom plugin to copy `data/` to `dist/data/`

7. **GitHub Pages Deployment**: What's the automated deployment process?
   - Recommendation: GitHub Actions workflow (see Gap #12)

8. **Service Worker Migration**: How do we handle old SW?
   - Recommendation: Force unregister, cache invalidation (see Gap #4)

9. **localStorage Migration**: How do we migrate user data?
   - Recommendation: Migration function in persistenceService (see Gap #6)

10. **Rollback Criteria**: When do we rollback to legacy?
    - Recommendation: Define criteria (see Gap #12)

---

## Recommendations Summary

### Before Starting Phase 0

**1. Update Plan Document** ✅
- Add all 12 critical gaps as tasks
- Revise timeline to 28-42 days
- Add deployment strategy section
- Add submodule handling section

**2. Create New Documents** ✅
- `DEPLOYMENT.md`: GitHub Pages deployment guide
- `MIGRATION.md`: localStorage migration guide
- `TESTING_CHECKLIST.md`: Cross-browser and deployment tests

**3. Technical Spikes** (2-3 days)
- [ ] Spike: Vite + git submodule strategy (0.5 day)
- [ ] Spike: Service worker migration approach (0.5 day)
- [ ] Spike: Conditional Socket.io loading (0.5 day)
- [ ] Spike: GitHub Pages deployment test (0.5 day)

**4. Risk Mitigation**
- [ ] Set up parallel deployment (legacy + beta)
- [ ] Define rollback criteria
- [ ] Create emergency rollback script

---

## Conclusion

### Overall Assessment

The refactoring plan is **well-structured and thorough**, but **incomplete** for production readiness. The 12 critical gaps identified would likely surface during implementation and cause significant delays or rework.

### Go/No-Go Recommendation

**🟡 CONDITIONAL GO** - Proceed ONLY after addressing:
1. ✅ GitHub Pages deployment strategy (Gap #1)
2. ✅ Git submodule handling (Gap #2)
3. ✅ Service worker migration (Gap #4)
4. ✅ Standalone/networked code splitting (Gap #5)
5. ✅ localStorage migration (Gap #6)

### Success Criteria Updates

Add to plan's success metrics:
- [ ] Standalone mode works on GitHub Pages
- [ ] Bundle size < 100 KB for standalone (without Socket.io)
- [ ] NFC works on HTTPS dev server
- [ ] Service worker upgrades without manual cache clear
- [ ] localStorage migration succeeds for existing users
- [ ] Parallel deployment (legacy + beta) runs for 1 week minimum

### Next Steps

1. **Review this audit** with team
2. **Address 5 critical gaps** listed above
3. **Run 4 technical spikes** (2-3 days)
4. **Update timeline** to 28-42 days
5. **Create additional documentation** (deployment, migration)
6. **Set up parallel deployment infrastructure**
7. **Begin Phase 0** with updated plan

---

## Appendix: Contract Compatibility Checklist

### WebSocket Events (from asyncapi.yaml)

Based on reading the contracts, verify these events are handled:

**Client → Server**:
- [ ] `gm:scan` - Token scan submission
- [ ] `admin:intervention` - Score adjustments
- [ ] `admin:session:create` - Session management
- [ ] `admin:session:end`
- [ ] `admin:video:control` - VLC controls

**Server → Client**:
- [ ] `sync:full` - Complete state sync (auto on connect)
- [ ] `transaction:new` - Broadcast new transaction
- [ ] `transaction:deleted` - Broadcast transaction deletion
- [ ] `score:updated` - Broadcast score changes (with adminAdjustments)
- [ ] `session:update` - Session lifecycle changes
- [ ] `video:status` - Video playback updates
- [ ] `device:connected` - Device status
- [ ] `device:disconnected`

**Envelope Format** (all events):
```javascript
{
  event: string,
  data: object,
  timestamp: string
}
```

### HTTP Endpoints (from openapi.yaml)

- [ ] `POST /api/admin/auth` - JWT authentication
- [ ] `GET /health` - Health check
- [ ] `GET /api/state` - State retrieval (debug only)
- [ ] `POST /api/scan` - Player scanner endpoint (not used by GM scanner)

---

**End of Audit Report**
