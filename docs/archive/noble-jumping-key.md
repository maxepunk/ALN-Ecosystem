# ALN Frontend Refactoring Plan

## Problem Statement

The ALN frontend code is **messy, difficult to maintain, and does not follow consistent patterns**:

1. **Monolithic Files**: 2062-line index.html with 1340 lines embedded CSS, 1198-line adminModule.js
2. **Inconsistent Patterns**: Some screens auto-update on events, others don't; mixed approaches
3. **Poor Mobile Responsiveness**: Single 500px max-width breakpoint constrains everything
4. **Tight Coupling**: Admin panel tightly coupled to scanner view, causing context issues

**Priority**: ENGINEERING BEST PRACTICES. Clean, maintainable, modular code FIRST. Feature fixes come AFTER architecture is solid.

## Scope

### Focus: GM Scanner Frontend Only
- 2 GM scanners running ALNScanner PWA (phones, maybe tablets)
- Player scanners (PWA + ESP32) are out of scope - working fine

### Display Configuration
- **Primary Display**: HDMI projector connected directly to Raspberry Pi
- **2nd Display**: Wireless via Chromecast (Pi casts browser content)

### Scanner Types (for reference - not modifying)
| Type | Codebase | Protocol | Status |
|------|----------|----------|--------|
| GM Scanner | ALNScanner/ (ES6 Vite) | WebSocket | **REFACTORING** |
| Player Scanner (Web) | aln-memory-scanner/ | HTTP | Out of scope |
| Player Scanner (ESP32) | arduino-cyd-player-scanner/ | HTTP | Out of scope |

---

## Phase 1: CSS Architecture & Mobile-First Design (HIGH PRIORITY)

### Problem
1340 lines of CSS embedded in index.html. Cannot maintain, cannot establish consistent patterns.

### Solution
Extract CSS to modular external files with proper mobile-first architecture.

### File Structure
```
ALNScanner/src/styles/
├── main.css          # Entry point (imports all others)
├── variables.css     # CSS custom properties (colors, spacing, typography)
├── base.css          # Reset, body, typography defaults
├── components.css    # Buttons, cards, inputs, modals
├── layout.css        # Container, grid, flexbox utilities
├── screens/
│   ├── scanner.css   # Scanner view screens
│   └── admin.css     # Admin panel sections
└── responsive.css    # Media query overrides
```

### Design System
```css
:root {
  --touch-target-min: 44px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
}

/* Mobile-first progression */
@media (min-width: 480px) { .container { max-width: 500px; } }
@media (min-width: 768px) { .admin-view .container { max-width: 768px; } }
```

### Files to Modify
- `ALNScanner/index.html` - Remove `<style>` block, add `<link>` to main.css
- Create all files in `ALNScanner/src/styles/`

### Success Criteria
- Zero embedded CSS in index.html
- All buttons 44px minimum touch target
- No horizontal scrolling on any viewport

---

## Phase 2: Admin Module Modularization (HIGH PRIORITY)

### Problem
`adminModule.js` is 1198 lines with 4 classes. Hard to maintain, test, or extend.

### Solution
Split into focused, single-responsibility modules.

### File Structure
```
ALNScanner/src/admin/
├── index.js              # Re-exports (backward compat)
├── SessionManager.js     # Session CRUD
├── VideoController.js    # Video/audio playback
├── SystemMonitor.js      # Health checks, devices
├── MonitoringDisplay.js  # DOM updates
├── DisplayController.js  # NEW: HDMI display mode
└── AdminOperations.js    # Score adjustments
```

### Each Module Should:
1. Be a single ES6 class with clear responsibility
2. Accept dependencies via constructor (testable)
3. Emit events for state changes (decoupled)
4. Have corresponding unit test file

### Files to Modify
- Split `ALNScanner/src/utils/adminModule.js` into separate files
- Update imports in `main.js` and `AdminController.js`
- Create `ALNScanner/tests/unit/admin/` with tests

### Success Criteria
- No file over 300 lines
- Each class has unit tests
- All existing E2E tests pass

---

## Phase 3: Event Architecture Standardization (MEDIUM PRIORITY)

### Problem
Inconsistent event handling - some screens auto-update, others don't.

### Solution
Centralized ScreenUpdateManager with consistent patterns.

### New File: `ALNScanner/src/ui/ScreenUpdateManager.js`
```javascript
export class ScreenUpdateManager {
  registerScreen(screenId, handlers) { ... }

  onDataUpdate(eventType, data) {
    const activeScreenId = this.getActiveScreenId();
    const handlers = this.screenHandlers.get(activeScreenId);
    handlers?.[eventType]?.(data);
  }
}
```

### Files to Modify
- Create `ALNScanner/src/ui/ScreenUpdateManager.js`
- Refactor `ALNScanner/src/main.js` event wiring (lines 68-164)

---

## Phase 4: Feature Enhancements (AFTER Architecture Clean)

### 4.1 State Validation on Reconnect

**Problem**: User must clear cache when reconnecting after session ends.

**New File**: `ALNScanner/src/services/StateValidationService.js`
- Validate orchestrator reachable
- Validate JWT not expired
- Validate session exists
- If ANY fail: clear stale state, show mode selection

**Modify**: `ALNScanner/src/app/initializationSteps.js`
- Add validation in `determineInitialScreen()` before mode restoration

### 4.2 HDMI Display Control

**Problem**: VLC idle loop and scoreboard.html are separate systems.

**Display Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                     RASPBERRY PI                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   DisplayControlService (State Machine)                      │
│   ├── IDLE_LOOP: VLC plays idle-loop.mp4                    │
│   ├── SCOREBOARD: Browser fullscreen on scoreboard.html     │
│   └── VIDEO: VLC plays triggered video, returns to previous │
│                                                              │
│   Output Methods:                                            │
│   ├── HDMI: Direct to projector (VLC or browser window)     │
│   └── Chromecast: Cast browser tab (scoreboard/video)       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Files to Create/Modify**:
- `backend/src/services/displayControlService.js` - State machine for display modes
- `backend/src/websocket/gmCommandHandler.js` - Add display commands
- `backend/public/scoreboard.html` - Add kiosk mode, Chromecast-friendly styling

**Admin Panel Controls** (in `DisplayController.js`):
- Show Idle Loop / Show Scoreboard toggle
- Play Video / Play Audio file selectors
- Cast to Chromecast button (if browser supports)

**Chromecast Considerations**:
- Scoreboard page must be visually clean for casting (no chrome, fullscreen)
- Video playback may need to be browser-based (HTML5) for casting compatibility
- Audio cues can play through Pi speakers while casting scoreboard

---

## Git Workflow

### Worktree Strategy

Using git worktrees to isolate refactoring work from main development:

```
/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/           # Main repo (main branch)
└── .worktrees/
    └── refactor-css/                                           # This refactor work
```

**Current State:**
- Main branch: `main` at `9be0dabf`
- Working branch: `refactor/css-architecture` (branched from main)

### Branch Strategy

Each phase gets its own branch, merged sequentially:

```
main ─────────────────────────────────────────────────────────►
  │
  └─► refactor/css-architecture (Phase 1) ──► PR #1 ──► merge
                                                           │
                                                           └─► refactor/admin-modules (Phase 2) ──► PR #2 ──► merge
                                                                                                                 │
                                                                                                                 └─► ...
```

| Phase | Branch Name | Base |
|-------|-------------|------|
| 1 | `refactor/css-architecture` | `main` |
| 2 | `refactor/admin-modules` | `main` (after Phase 1 merge) |
| 3 | `refactor/event-standardization` | `main` (after Phase 2 merge) |
| 4 | `feat/display-control` | `main` (after Phase 3 merge) |

### Commit Conventions

Follow conventional commits for clear history:

```
<type>(<scope>): <description>

Types:
- refactor: Code restructuring without behavior change
- feat: New functionality
- fix: Bug fixes
- test: Adding/updating tests
- docs: Documentation only
- chore: Build/tooling changes

Scopes:
- css: CSS architecture work
- admin: Admin module work
- events: Event system work
- display: Display control work
```

**Examples:**
```
refactor(css): extract variables.css with design tokens
refactor(css): create base.css with reset and typography
refactor(admin): split SessionManager from adminModule.js
feat(display): add DisplayControlService state machine
```

### Phase 1 Commit Plan

```
1. refactor(css): create styles directory structure
2. refactor(css): extract variables.css with noir design tokens
3. refactor(css): extract base.css with reset and typography
4. refactor(css): extract components.css (buttons, cards, inputs)
5. refactor(css): extract layout.css (container, grid, utilities)
6. refactor(css): extract screens/scanner.css
7. refactor(css): extract screens/admin.css
8. refactor(css): extract responsive.css with mobile-first breakpoints
9. refactor(css): create main.css entry point with imports
10. refactor(css): remove embedded styles from index.html
11. test(css): verify visual regression with screenshots
```

### PR Workflow

1. **Before PR**: Run full test suite
   ```bash
   cd ALNScanner && npm test && npm run build
   ```

2. **Create PR**: Use descriptive title and checklist
   ```
   ## refactor(css): Extract CSS to modular architecture

   ### Changes
   - Created 8 CSS modules in src/styles/
   - Removed 1340 lines of embedded CSS from index.html
   - Implemented noir/tactical design system

   ### Testing
   - [ ] npm test passes
   - [ ] npm run build succeeds
   - [ ] Visual regression screenshots attached
   - [ ] Tested on 320px, 480px, 768px viewports
   ```

3. **After merge**: Delete feature branch, create next phase branch from updated main

### Keeping Worktree Updated

```bash
# If main advances while working on Phase 1:
git fetch origin
git rebase origin/main

# After Phase 1 PR merges, for Phase 2:
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git pull origin main
git worktree add .worktrees/refactor-admin -b refactor/admin-modules
```

---

## Implementation Order

```
Phase 1: CSS Architecture ─────────────────► Foundation
         │                                   Branch: refactor/css-architecture
         │                                   PR → merge to main
         │
         └──► Phase 2: Admin Modularization ──► Clean code
                       │                        Branch: refactor/admin-modules
                       │                        PR → merge to main
                       │
                       └──► Phase 3: Event Standardization ──► Consistency
                                     │                         Branch: refactor/event-standardization
                                     │                         PR → merge to main
                                     │
                                     └──► Phase 4: Features ──► Enhancements
                                                               Branch: feat/display-control
                                                               PR → merge to main
```

Each phase must be complete and tested before starting the next.

---

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `ALNScanner/index.html` | 2062 | CSS extraction source |
| `ALNScanner/src/utils/adminModule.js` | 1198 | Modularization source |
| `ALNScanner/src/main.js` | 280 | Event wiring refactor |
| `ALNScanner/src/app/initializationSteps.js` | 336 | State validation |
| `backend/src/services/vlcService.js` | 626 | VLC control |
| `backend/public/scoreboard.html` | ~600 | Standalone scoreboard |

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| CSS extraction | Low | Visual regression screenshots |
| Admin modularization | Medium | Unit tests before splitting |
| Event standardization | Low | Additive changes only |
| Display integration | High | Test on Pi hardware early |

---

## Decisions Made

1. **Priority**: Code architecture FIRST, features AFTER
2. **Scope**: GM Scanner frontend only (player scanners out of scope)
3. **Display Architecture**: VLC Primary + Browser Scoreboard, with Chromecast for 2nd screen
4. **2nd Display**: Chromecast - Pi casts browser tab to wireless display
5. **Mobile-first**: All GM Scanner UI must work on 320px phones
