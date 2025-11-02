# ALNScanner Frontend Refactoring Plan

**Date:** November 2, 2025
**Based on:** ALNScanner_Screen_Flow_Analysis.md
**Scope:** Code quality and maintainability improvements
**Goal:** Transform monolithic HTML/JS application into modular, maintainable architecture

---

## Executive Summary

The ALNScanner frontend currently consists of **~8,000 lines** of code in a monolithic `index.html` file with embedded CSS and sequentially-loaded JavaScript modules. While functionally complete, the current architecture presents challenges for:

- **Maintainability**: All code in one file makes navigation and modification difficult
- **Testability**: Global window objects and tight coupling prevent unit testing
- **Scalability**: Adding features requires modifying the monolithic HTML
- **Developer Experience**: No hot reload, no build optimization, manual script ordering

This refactoring plan proposes a phased migration to a modern, component-based architecture while preserving all existing functionality and maintaining backward compatibility with the backend orchestrator contracts.

---

## Current State Analysis (from Screen Flow Document)

### Architecture Issues Identified

**1. Monolithic Structure**
- 2,117-line `index.html` with embedded CSS and HTML templates
- 15 JavaScript modules loaded via sequential `<script>` tags
- All modules expose to `window` object (global namespace pollution)
- Manual dependency management (brittle script ordering)

**2. State Management Problems**
```
window.App (1137 lines)
window.DataManager (600+ lines)
window.UIManager (687 lines)
window.ConnectionManager (300+ lines)
window.OrchestratorClient (400+ lines)
window.TokenManager (300+ lines)
window.Settings
window.SessionModeManager
window.NetworkedQueueManager
window.NFCHandler
window.AdminModule (800+ lines)
```
- State scattered across 11+ global singletons
- No single source of truth
- Difficult to track state changes
- Hard to debug state synchronization issues

**3. UI Component Issues**
- All 14 screens defined in single HTML file
- No component reusability (transaction cards, token displays duplicated)
- CSS classes scattered throughout 2117-line file
- Screen transitions managed manually via `display: none/block`
- No view composition or nesting

**4. Business Logic Coupling**
- Scoring logic mixed with UI updates (DataManager → UIManager direct calls)
- Transaction processing intertwined with screen navigation
- Admin controls tightly coupled to WebSocket events
- NFC handling mixed with UI feedback

**5. Testing Challenges**
- No module isolation (everything global)
- No mock interfaces (direct socket.io usage)
- No test coverage
- Difficult to test individual screens in isolation

---

## Refactoring Goals

### Primary Objectives

1. **Modularity**: Break monolithic HTML into composable components
2. **Maintainability**: Separate concerns (UI, state, business logic, network)
3. **Testability**: Enable unit and integration testing
4. **Developer Experience**: Introduce build tools, hot reload, linting
5. **Performance**: Code splitting, lazy loading, bundle optimization
6. **Type Safety**: Optional TypeScript for better IDE support and error prevention

### Non-Goals (Out of Scope)

- **UI/UX redesign**: Preserve existing design and user flows
- **Contract changes**: No modifications to WebSocket/HTTP API contracts
- **Feature additions**: Focus solely on refactoring existing functionality
- **Backend changes**: Backend orchestrator remains unchanged

---

## Proposed Architecture

### Technology Stack

**Build System:**
- **Vite 5.x**: Fast dev server with HMR, optimized production builds
- **Reason**: Native ES modules, fast cold start, simple config, great DX

**Module System:**
- **ES6 Modules**: Replace `<script>` tags with `import/export`
- **Reason**: Standard, tree-shakeable, better IDE support

**UI Framework (Optional - Phase 3):**
- **Option A: Vanilla JS Components** (recommended for minimal disruption)
- **Option B: Lit** (lightweight web components)
- **Option C: Vue 3** (progressive framework, good for PWAs)

**State Management:**
- **Phase 1**: Centralized singleton store (minimal disruption)
- **Phase 2**: Event-driven state bus (Mitt or custom EventEmitter)
- **Phase 3**: Reactive state management (Signals or Vue reactivity)

**Testing:**
- **Vitest**: Unit testing (Vite-compatible)
- **Playwright**: E2E testing (already in use for backend)
- **MSW**: API mocking for WebSocket/HTTP

**Type Safety (Optional):**
- **JSDoc** (Phase 1): Gradual typing without TS compiler
- **TypeScript** (Phase 3): Full type safety with .ts migration

### Directory Structure

```
ALNScanner/
├── public/                          # Static assets (not processed by Vite)
│   ├── manifest.json                # PWA manifest
│   ├── icons/                       # App icons
│   └── sw.js                        # Service worker (separate from bundle)
│
├── src/                             # Source code (processed by Vite)
│   ├── main.js                      # Entry point
│   ├── App.js                       # Root app component
│   │
│   ├── screens/                     # Screen components (14 screens)
│   │   ├── LoadingScreen.js
│   │   ├── GameModeScreen.js
│   │   ├── SettingsScreen.js
│   │   ├── TeamEntryScreen.js
│   │   ├── ScanScreen.js
│   │   ├── ResultScreen.js
│   │   ├── HistoryScreen.js
│   │   ├── ScoreboardScreen.js
│   │   └── TeamDetailsScreen.js
│   │
│   ├── views/                       # View tabs (networked mode)
│   │   ├── ScannerView.js
│   │   ├── AdminView.js
│   │   └── DebugView.js
│   │
│   ├── components/                  # Reusable UI components
│   │   ├── common/
│   │   │   ├── Button.js
│   │   │   ├── StatusMessage.js
│   │   │   ├── Toast.js
│   │   │   └── ConnectionStatus.js
│   │   ├── modals/
│   │   │   └── ConnectionWizard.js
│   │   ├── cards/
│   │   │   ├── TransactionCard.js
│   │   │   ├── TokenDetailCard.js
│   │   │   └── ScoreboardEntry.js
│   │   ├── forms/
│   │   │   └── Numpad.js
│   │   └── layout/
│   │       ├── Header.js
│   │       ├── ViewTabs.js
│   │       └── ScreenContainer.js
│   │
│   ├── store/                       # State management
│   │   ├── index.js                 # Store setup
│   │   ├── modules/
│   │   │   ├── session.js           # Session state (mode, team, etc.)
│   │   │   ├── transactions.js      # Transaction data
│   │   │   ├── connection.js        # Connection state
│   │   │   ├── tokens.js            # Token database
│   │   │   └── ui.js                # UI state (current screen, modals)
│   │   └── actions.js               # State mutations
│   │
│   ├── services/                    # Business logic (refactored from old structure)
│   │   ├── tokenService.js          # Token database & matching (was TokenManager)
│   │   ├── scoringService.js        # Scoring calculations (extracted from DataManager)
│   │   ├── transactionService.js    # Transaction processing (extracted from DataManager)
│   │   ├── nfcService.js            # NFC API wrapper (was NFCHandler)
│   │   ├── persistenceService.js    # localStorage management (was Settings)
│   │   └── queueService.js          # Offline queue (was NetworkedQueueManager)
│   │
│   ├── network/                     # Network layer
│   │   ├── orchestratorClient.js    # WebSocket client (refactored)
│   │   ├── connectionManager.js     # Connection lifecycle (refactored)
│   │   ├── discoveryService.js      # UDP server discovery
│   │   └── apiClient.js             # HTTP endpoints (if needed)
│   │
│   ├── admin/                       # Admin panel modules
│   │   ├── AdminPanel.js            # Container component
│   │   ├── SessionManager.js        # Session controls
│   │   ├── VideoController.js       # VLC controls
│   │   ├── SystemMonitor.js         # Health/status display
│   │   └── AdminOperations.js       # Score adjustments, interventions
│   │
│   ├── utils/                       # Utilities
│   │   ├── debug.js                 # Debug logging (preserved)
│   │   ├── config.js                # Constants (preserved)
│   │   ├── validators.js            # Input validation
│   │   └── formatters.js            # Display formatting (currency, time, etc.)
│   │
│   ├── styles/                      # CSS (extracted from index.html)
│   │   ├── main.css                 # Global styles
│   │   ├── variables.css            # CSS custom properties
│   │   ├── screens.css              # Screen-specific styles
│   │   ├── components.css           # Component styles
│   │   └── responsive.css           # Media queries
│   │
│   └── types/                       # Type definitions (if using TypeScript/JSDoc)
│       ├── transactions.js
│       ├── tokens.js
│       └── websocket.js
│
├── tests/                           # Test files
│   ├── unit/
│   │   ├── services/
│   │   ├── store/
│   │   └── utils/
│   ├── integration/
│   │   └── screens/
│   └── e2e/
│       └── flows/
│
├── index.html                       # Minimal HTML shell (Vite entry)
├── vite.config.js                   # Vite configuration
├── package.json                     # Dependencies
├── .eslintrc.js                     # Linting rules
├── .prettierrc.js                   # Code formatting
└── README.md                        # Development setup

# Legacy files (to be archived after migration)
ARCHIVE/
├── old-index.html                   # Original monolithic file
└── old-js/                          # Original JS modules
```

---

## Phase-by-Phase Migration Strategy

### Phase 0: Preparation (1-2 days)

**Objective:** Set up infrastructure without breaking existing functionality

**Tasks:**
1. **Create git branch**: `refactor/modular-architecture`
2. **Archive current code**: Copy `index.html` and `js/` to `ARCHIVE/`
3. **Initialize Vite project**: `npm create vite@latest . -- --template vanilla`
4. **Configure Vite**:
   - Set up public directory for PWA assets
   - Configure service worker handling
   - Set up CSS preprocessing (PostCSS)
5. **Set up linting**: ESLint + Prettier
6. **Verify legacy version still works**: Test all screens in standalone and networked modes

**Deliverables:**
- `vite.config.js` with PWA support
- `package.json` with dev dependencies
- `.eslintrc.js` and `.prettierrc.js`
- Working legacy version in `ARCHIVE/`

### Phase 1: Extract and Modularize (3-5 days)

**Objective:** Break monolithic structure into ES6 modules without changing logic

#### 1.1: Extract CSS (Day 1)

**From:** `index.html` lines 1-600 (embedded `<style>` tags)
**To:** `src/styles/*.css`

**Mapping:**
- Global styles + CSS variables → `main.css` + `variables.css`
- Screen-specific styles → `screens.css`
- Component styles (buttons, cards, modals) → `components.css`
- Media queries → `responsive.css`

**Process:**
```bash
# Extract CSS from index.html
# Import in main.js: import './styles/main.css'
```

**Validation:**
- Visual regression testing (screenshot comparison)
- All screens render identically

#### 1.2: Extract HTML Templates (Day 1-2)

**From:** `index.html` lines 601-2117 (14 screens + modals)
**To:** `src/screens/*.js` as template literals or DOM builders

**Example Transformation:**
```javascript
// OLD (index.html:1463-1468)
<div id="loadingScreen" class="screen">
    <div class="status-message">
        <div class="scan-icon">⏳</div>
        <p>Loading token database...</p>
    </div>
</div>

// NEW (src/screens/LoadingScreen.js)
export class LoadingScreen {
  constructor() {
    this.element = this.createTemplate();
  }

  createTemplate() {
    const screen = document.createElement('div');
    screen.id = 'loadingScreen';
    screen.className = 'screen';
    screen.innerHTML = `
      <div class="status-message">
        <div class="scan-icon">⏳</div>
        <p>Loading token database...</p>
      </div>
    `;
    return screen;
  }

  show() {
    this.element.classList.add('active');
  }

  hide() {
    this.element.classList.remove('active');
  }
}
```

**Screens to Extract (14 total):**
1. LoadingScreen (lines 1463-1468)
2. GameModeScreen (lines 1508-1551)
3. SettingsScreen (lines 1471-1505)
4. TeamEntryScreen (lines 1553-1570)
5. ScanScreen (lines 1572-1595)
6. ResultScreen (lines 1597-1623)
7. HistoryScreen (lines 1625-1662)
8. ScoreboardScreen (lines 1664-1676)
9. TeamDetailsScreen (lines 1678-1719)
10. AdminView (lines 1724-1817)
11. DebugView (lines 1820-1822)
12. ConnectionWizard (lines 1377-1417)
13. Header component
14. ViewTabs component

**Validation:**
- Each screen renders correctly
- Navigation still works
- All event handlers attached

#### 1.3: Refactor JavaScript Modules (Day 2-4)

**Current Module Loading Order (from analysis):**
```
1. config.js → utils/config.js
2. debug.js → utils/debug.js
3. nfcHandler.js → services/nfcService.js
4. adminModule.js → admin/AdminPanel.js (split into submodules)
5. tokenManager.js → services/tokenService.js
6. dataManager.js → services/transactionService.js + scoringService.js
7. standaloneDataManager.js → merge with transactionService
8. uiManager.js → store/modules/ui.js + components/layout/ScreenContainer.js
9. settings.js → services/persistenceService.js
10. connectionManager.js → network/connectionManager.js
11. networkedQueueManager.js → services/queueService.js
12. orchestratorClient.js → network/orchestratorClient.js
13. sessionModeManager.js → store/modules/session.js
14. initializationSteps.js → main.js (initialization flow)
15. app.js → App.js (root component)
```

**Refactoring Strategy:**

**A. Simple Renames (Low Risk):**
- `config.js` → `utils/config.js` (add `export` statements)
- `debug.js` → `utils/debug.js` (already good structure)
- `nfcHandler.js` → `services/nfcService.js` (rename class, export)

**B. Extract and Split (Medium Risk):**
- `dataManager.js` (600+ lines) → Split into:
  - `services/transactionService.js` (transaction CRUD)
  - `services/scoringService.js` (scoring calculations)
  - `store/modules/transactions.js` (state storage)

- `adminModule.js` (800+ lines) → Split into:
  - `admin/SessionManager.js` (session controls)
  - `admin/VideoController.js` (VLC controls)
  - `admin/SystemMonitor.js` (health display)
  - `admin/AdminOperations.js` (score adjustments)

**C. State Centralization (High Risk):**
- Consolidate all singleton state into centralized store
- Replace `window.App.currentTeamId` with `store.session.currentTeamId`
- Replace `window.DataManager.transactions` with `store.transactions.items`

**Example Refactor (TokenManager → tokenService):**

```javascript
// OLD (js/core/tokenManager.js)
const TokenManager = {
  database: {},
  async loadDatabase() {
    const response = await fetch('data/tokens.json');
    this.database = await response.json();
  },
  findToken(rfid) {
    return this.database[rfid] || null;
  }
};
window.TokenManager = TokenManager;

// NEW (src/services/tokenService.js)
class TokenService {
  #database = {};

  async loadDatabase() {
    try {
      const response = await fetch('/data/tokens.json');
      if (!response.ok) throw new Error('Failed to load tokens');
      this.#database = await response.json();
      return this.#database;
    } catch (error) {
      console.error('[TokenService] Load failed:', error);
      throw error;
    }
  }

  findToken(rfid) {
    const normalized = this.normalizeRFID(rfid);
    return this.#database[normalized] || null;
  }

  normalizeRFID(rfid) {
    return rfid.trim().toLowerCase();
  }

  getAll() {
    return { ...this.#database };
  }
}

// Singleton export
export const tokenService = new TokenService();
export default tokenService;
```

#### 1.4: Create Centralized Store (Day 4-5)

**Store Architecture:**

```javascript
// src/store/index.js
import { sessionModule } from './modules/session.js';
import { transactionsModule } from './modules/transactions.js';
import { connectionModule } from './modules/connection.js';
import { tokensModule } from './modules/tokens.js';
import { uiModule } from './modules/ui.js';

class Store {
  #listeners = new Map();

  constructor() {
    this.state = {
      session: sessionModule.state,
      transactions: transactionsModule.state,
      connection: connectionModule.state,
      tokens: tokensModule.state,
      ui: uiModule.state
    };

    this.actions = {
      session: sessionModule.actions(this),
      transactions: transactionsModule.actions(this),
      connection: connectionModule.actions(this),
      tokens: tokensModule.actions(this),
      ui: uiModule.actions(this)
    };
  }

  subscribe(path, callback) {
    if (!this.#listeners.has(path)) {
      this.#listeners.set(path, new Set());
    }
    this.#listeners.get(path).add(callback);

    // Return unsubscribe function
    return () => {
      this.#listeners.get(path)?.delete(callback);
    };
  }

  notify(path) {
    this.#listeners.get(path)?.forEach(callback => callback(this.getState(path)));
  }

  getState(path) {
    const parts = path.split('.');
    let value = this.state;
    for (const part of parts) {
      value = value[part];
      if (value === undefined) return undefined;
    }
    return value;
  }
}

export const store = new Store();
export default store;
```

**State Modules Example:**

```javascript
// src/store/modules/session.js
export const sessionModule = {
  state: {
    mode: null, // 'networked' | 'standalone'
    gameMode: null, // 'detective' | 'blackmarket'
    currentTeamId: null,
    deviceId: null,
    stationName: null,
    locked: false
  },

  actions: (store) => ({
    setMode(mode) {
      store.state.session.mode = mode;
      store.state.session.locked = true;
      store.notify('session.mode');
    },

    setGameMode(gameMode) {
      store.state.session.gameMode = gameMode;
      store.notify('session.gameMode');
    },

    setCurrentTeam(teamId) {
      store.state.session.currentTeamId = teamId;
      store.notify('session.currentTeamId');
    },

    reset() {
      store.state.session.currentTeamId = null;
      store.state.session.locked = false;
      store.notify('session');
    }
  })
};
```

**Migration Path:**
1. Create store structure
2. Migrate state from singletons one module at a time
3. Update references throughout codebase
4. Remove old singleton declarations

**Validation:**
- All state changes trigger UI updates
- No regressions in screen navigation
- localStorage persistence still works

### Phase 2: Component Extraction (3-4 days)

**Objective:** Extract reusable UI components to reduce duplication

#### 2.1: Identify Reusable Components (Day 1)

**From Screen Flow Analysis - Duplicated Patterns:**

1. **Transaction Cards** (used in History, Team Details, Admin panels)
   - RFID display
   - Token type badge
   - Value/score display
   - Timestamp
   - Delete button (networked mode)

2. **Token Detail Cards** (Team Details screen)
   - Group indicators
   - Progress bars
   - Bonus badges
   - Status icons

3. **Scoreboard Entries** (Scoreboard screen)
   - Rank medals (🥇🥈🥉)
   - Team ID
   - Score display
   - Gradient backgrounds

4. **Status Messages** (used across all screens)
   - Success (green)
   - Error (red)
   - Warning (orange)
   - Info (blue)

5. **Buttons** (everywhere)
   - Primary
   - Secondary
   - Icon buttons
   - Loading states

6. **Numpad** (Team Entry screen - could be reusable)
   - 3x4 grid
   - Display area
   - Clear/Enter logic

#### 2.2: Create Component Library (Day 2-3)

**Example Component (TransactionCard):**

```javascript
// src/components/cards/TransactionCard.js
export class TransactionCard {
  constructor(transaction, options = {}) {
    this.transaction = transaction;
    this.options = {
      showDelete: false,
      onDelete: null,
      ...options
    };
    this.element = this.render();
  }

  render() {
    const card = document.createElement('div');
    card.className = `transaction-card ${this.transaction.mode}`;
    card.innerHTML = `
      <div class="transaction-header">
        <span class="team-badge">Team ${this.transaction.teamId}</span>
        <span class="timestamp">${this.formatTime(this.transaction.timestamp)}</span>
      </div>
      <div class="transaction-body">
        <div class="token-info">
          <div class="rfid">${this.transaction.tokenId}</div>
          <div class="type-badge">${this.transaction.type || 'UNKNOWN'}</div>
        </div>
        <div class="value-display">
          ${this.formatValue(this.transaction)}
        </div>
      </div>
      ${this.options.showDelete ? this.renderDeleteButton() : ''}
    `;

    if (this.options.showDelete) {
      card.querySelector('.delete-btn')?.addEventListener('click', () => {
        this.options.onDelete?.(this.transaction);
      });
    }

    return card;
  }

  formatValue(tx) {
    if (tx.mode === 'detective') {
      return '⭐'.repeat(tx.value || 0);
    }
    return `$${tx.value || 0}`;
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
  }

  renderDeleteButton() {
    return `<button class="delete-btn" title="Delete">🗑️</button>`;
  }

  update(transaction) {
    this.transaction = transaction;
    const newElement = this.render();
    this.element.replaceWith(newElement);
    this.element = newElement;
  }

  destroy() {
    this.element.remove();
  }
}
```

**Component Registry:**
- `components/common/Button.js`
- `components/common/StatusMessage.js`
- `components/common/Toast.js`
- `components/common/ConnectionStatus.js`
- `components/cards/TransactionCard.js`
- `components/cards/TokenDetailCard.js`
- `components/cards/ScoreboardEntry.js`
- `components/forms/Numpad.js`
- `components/modals/ConnectionWizard.js`

#### 2.3: Refactor Screens to Use Components (Day 3-4)

**Before (HistoryScreen - inline HTML):**
```javascript
transactions.forEach(tx => {
  historyContainer.innerHTML += `
    <div class="transaction-card ${tx.mode}">
      <div class="team-badge">Team ${tx.teamId}</div>
      <div class="rfid">${tx.tokenId}</div>
      <div class="value">$${tx.value}</div>
    </div>
  `;
});
```

**After (HistoryScreen - using components):**
```javascript
import { TransactionCard } from '../components/cards/TransactionCard.js';

transactions.forEach(tx => {
  const card = new TransactionCard(tx, {
    showDelete: false
  });
  historyContainer.appendChild(card.element);
});
```

**Validation:**
- All screens render identically
- Component styles isolated
- Event handlers work correctly

### Phase 3: Service Layer & Dependency Injection (2-3 days)

**Objective:** Decouple business logic from UI, enable testing

#### 3.1: Create Service Interfaces (Day 1)

**Service Layer Pattern:**

```javascript
// src/services/scoringService.js
export class ScoringService {
  #config = {
    BASE_VALUES: { 1: 500, 2: 1000, 3: 1500, 4: 2000, 5: 2500 },
    TYPE_MULTIPLIERS: { Personal: 1, Business: 3, Technical: 5, UNKNOWN: 0 }
  };

  calculateTokenValue(token) {
    const base = this.#config.BASE_VALUES[token.valueRating] || 0;
    const multiplier = this.#config.TYPE_MULTIPLIERS[token.memoryType] || 0;
    return base * multiplier;
  }

  calculateGroupBonus(tokens, groupName) {
    const groupTokens = tokens.filter(t => t.group === groupName);
    const multiplier = this.parseGroupMultiplier(groupName);
    const baseValue = groupTokens.reduce((sum, t) => sum + this.calculateTokenValue(t), 0);
    return baseValue * (multiplier - 1);
  }

  calculateTeamScore(transactions, teamId) {
    const teamTx = transactions.filter(t => t.teamId === teamId);
    let baseScore = 0;
    const groups = new Map();

    // Calculate base score and track groups
    teamTx.forEach(tx => {
      baseScore += this.calculateTokenValue(tx);
      if (tx.group) {
        if (!groups.has(tx.group)) groups.set(tx.group, []);
        groups.get(tx.group).push(tx);
      }
    });

    // Calculate group bonuses
    let groupBonuses = 0;
    groups.forEach((tokens, groupName) => {
      if (this.isGroupComplete(tokens, groupName)) {
        groupBonuses += this.calculateGroupBonus(tokens, groupName);
      }
    });

    return {
      baseScore,
      groupBonuses,
      totalScore: baseScore + groupBonuses
    };
  }

  isGroupComplete(tokens, groupName) {
    // Implementation from existing logic
    const expectedSize = this.parseGroupSize(groupName);
    return tokens.length >= expectedSize;
  }

  parseGroupMultiplier(groupName) {
    const match = groupName.match(/\(x(\d+)\)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  parseGroupSize(groupName) {
    // Extract expected group size from token database
    return 3; // Placeholder
  }
}

export const scoringService = new ScoringService();
```

**Services to Create:**
1. `tokenService.js` - Token database operations
2. `scoringService.js` - Score calculations
3. `transactionService.js` - Transaction CRUD
4. `nfcService.js` - NFC API wrapper
5. `persistenceService.js` - localStorage abstraction
6. `queueService.js` - Offline queue management

#### 3.2: Dependency Injection Pattern (Day 2)

**Purpose:** Enable mocking for tests, reduce tight coupling

```javascript
// src/services/transactionService.js
export class TransactionService {
  constructor(dependencies = {}) {
    this.scoringService = dependencies.scoringService || scoringService;
    this.persistenceService = dependencies.persistenceService || persistenceService;
    this.store = dependencies.store || store;
  }

  async addTransaction(transaction) {
    // Validate
    if (!transaction.teamId || !transaction.tokenId) {
      throw new Error('Invalid transaction: missing required fields');
    }

    // Calculate score
    const score = this.scoringService.calculateTokenValue(transaction);
    const enhancedTx = { ...transaction, value: score, timestamp: Date.now() };

    // Update store
    this.store.actions.transactions.add(enhancedTx);

    // Persist
    await this.persistenceService.saveTransactions(this.store.state.transactions.items);

    return enhancedTx;
  }

  // More methods...
}

// Default singleton
export const transactionService = new TransactionService();

// Export class for testing
export default TransactionService;
```

**Test Example:**
```javascript
// tests/unit/services/transactionService.test.js
import { describe, it, expect, vi } from 'vitest';
import TransactionService from '../../../src/services/transactionService.js';

describe('TransactionService', () => {
  it('should add transaction with calculated score', async () => {
    // Mock dependencies
    const mockScoring = {
      calculateTokenValue: vi.fn(() => 1500)
    };
    const mockStore = {
      state: { transactions: { items: [] } },
      actions: { transactions: { add: vi.fn() } }
    };
    const mockPersistence = {
      saveTransactions: vi.fn()
    };

    const service = new TransactionService({
      scoringService: mockScoring,
      store: mockStore,
      persistenceService: mockPersistence
    });

    const tx = { teamId: '001', tokenId: 'abc123', valueRating: 3, memoryType: 'Personal' };
    await service.addTransaction(tx);

    expect(mockScoring.calculateTokenValue).toHaveBeenCalledWith(tx);
    expect(mockStore.actions.transactions.add).toHaveBeenCalledWith(
      expect.objectContaining({ value: 1500 })
    );
    expect(mockPersistence.saveTransactions).toHaveBeenCalled();
  });
});
```

#### 3.3: Refactor Network Layer (Day 3)

**OrchestratorClient Refactor:**

```javascript
// src/network/orchestratorClient.js
import io from 'socket.io-client';
import { EventEmitter } from '../utils/eventEmitter.js';

export class OrchestratorClient extends EventEmitter {
  #socket = null;
  #config = null;

  constructor(config = {}) {
    super();
    this.#config = config;
  }

  async connect({ url, token, deviceId, deviceType }) {
    try {
      this.#socket = io(url, {
        auth: { token, deviceId, deviceType, version: '1.0.0' },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 5000
      });

      this.#setupEventHandlers();

      return new Promise((resolve, reject) => {
        this.#socket.on('connect', () => {
          this.emit('connected');
          resolve();
        });
        this.#socket.on('connect_error', (error) => {
          this.emit('error', error);
          reject(error);
        });
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  #setupEventHandlers() {
    // WebSocket event listeners
    this.#socket.on('sync:full', (data) => this.emit('sync', data));
    this.#socket.on('transaction:new', (data) => this.emit('transaction', data));
    this.#socket.on('score:updated', (data) => this.emit('scoreUpdate', data));
    this.#socket.on('disconnect', () => this.emit('disconnected'));
  }

  emit(event, data) {
    // Emit to internal listeners (not socket.io)
    super.emit(event, data);
  }

  send(event, data) {
    // Send to server via socket.io
    if (!this.#socket) throw new Error('Not connected');
    return new Promise((resolve, reject) => {
      this.#socket.emit(event, data, (response) => {
        if (response?.error) reject(response.error);
        else resolve(response);
      });
    });
  }

  disconnect() {
    this.#socket?.disconnect();
    this.#socket = null;
  }

  isConnected() {
    return this.#socket?.connected || false;
  }
}

export const orchestratorClient = new OrchestratorClient();
```

**Benefits:**
- Testable (can mock EventEmitter behavior)
- Decoupled from Socket.io (can swap implementations)
- Clear separation between internal events and WebSocket events

### Phase 4: Testing Infrastructure (2-3 days)

**Objective:** Add unit tests, integration tests, and E2E tests

#### 4.1: Unit Testing Setup (Day 1)

**Vitest Configuration:**

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'tests/', 'ARCHIVE/']
    }
  }
});
```

**Test Structure:**
```
tests/
├── unit/
│   ├── services/
│   │   ├── scoringService.test.js
│   │   ├── transactionService.test.js
│   │   ├── tokenService.test.js
│   │   └── nfcService.test.js
│   ├── store/
│   │   ├── session.test.js
│   │   └── transactions.test.js
│   └── utils/
│       ├── validators.test.js
│       └── formatters.test.js
├── integration/
│   ├── screens/
│   │   ├── ScanScreen.test.js
│   │   └── TeamDetailsScreen.test.js
│   └── flows/
│       ├── standalone-flow.test.js
│       └── networked-flow.test.js
└── e2e/
    └── flows/
        ├── complete-game-session.spec.js
        └── admin-operations.spec.js
```

**Example Test Coverage:**

```javascript
// tests/unit/services/scoringService.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { ScoringService } from '../../../src/services/scoringService.js';

describe('ScoringService', () => {
  let service;

  beforeEach(() => {
    service = new ScoringService();
  });

  describe('calculateTokenValue', () => {
    it('should calculate value for 3-star Personal token', () => {
      const token = { valueRating: 3, memoryType: 'Personal' };
      expect(service.calculateTokenValue(token)).toBe(1500); // 1500 * 1
    });

    it('should calculate value for 5-star Technical token', () => {
      const token = { valueRating: 5, memoryType: 'Technical' };
      expect(service.calculateTokenValue(token)).toBe(12500); // 2500 * 5
    });

    it('should return 0 for UNKNOWN type', () => {
      const token = { valueRating: 5, memoryType: 'UNKNOWN' };
      expect(service.calculateTokenValue(token)).toBe(0);
    });
  });

  describe('calculateGroupBonus', () => {
    it('should calculate 50% bonus for complete group (x2)', () => {
      const tokens = [
        { group: 'TestGroup (x2)', valueRating: 3, memoryType: 'Personal' },
        { group: 'TestGroup (x2)', valueRating: 3, memoryType: 'Personal' }
      ];
      const bonus = service.calculateGroupBonus(tokens, 'TestGroup (x2)');
      expect(bonus).toBe(1500); // (1500 * 2) * (2 - 1) = 1500
    });
  });

  describe('calculateTeamScore', () => {
    it('should calculate total score with group bonuses', () => {
      const transactions = [
        { teamId: '001', valueRating: 3, memoryType: 'Personal', group: 'Group1 (x2)' },
        { teamId: '001', valueRating: 3, memoryType: 'Personal', group: 'Group1 (x2)' },
        { teamId: '001', valueRating: 5, memoryType: 'Business', group: null }
      ];

      const result = service.calculateTeamScore(transactions, '001');

      expect(result.baseScore).toBe(1500 + 1500 + 7500); // 10500
      expect(result.groupBonuses).toBeGreaterThan(0);
      expect(result.totalScore).toBe(result.baseScore + result.groupBonuses);
    });
  });
});
```

#### 4.2: Integration Testing (Day 2)

**Test Screen Interactions:**

```javascript
// tests/integration/screens/ScanScreen.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScanScreen } from '../../../src/screens/ScanScreen.js';
import { store } from '../../../src/store/index.js';
import { nfcService } from '../../../src/services/nfcService.js';

describe('ScanScreen Integration', () => {
  let screen;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    store.actions.session.setCurrentTeam('001');
    screen = new ScanScreen({ store, nfcService });
    document.getElementById('app').appendChild(screen.element);
  });

  it('should start NFC scan when button clicked', async () => {
    const scanSpy = vi.spyOn(nfcService, 'startScan');

    const scanButton = screen.element.querySelector('.start-scan-btn');
    scanButton.click();

    expect(scanSpy).toHaveBeenCalled();
  });

  it('should display scanned token result', async () => {
    const mockToken = {
      id: 'abc123',
      valueRating: 3,
      memoryType: 'Personal',
      group: 'TestGroup'
    };

    await screen.handleScanResult(mockToken);

    expect(screen.element.querySelector('.token-result')).toBeTruthy();
    expect(screen.element.textContent).toContain('abc123');
  });

  it('should show duplicate error for already scanned token', async () => {
    const tokenId = 'duplicate123';

    // First scan
    await screen.handleScanResult({ id: tokenId });

    // Second scan (duplicate)
    await screen.handleScanResult({ id: tokenId });

    expect(screen.element.querySelector('.error-message')).toBeTruthy();
    expect(screen.element.textContent).toContain('Already Scanned');
  });
});
```

#### 4.3: E2E Testing (Day 3)

**Playwright E2E Tests:**

```javascript
// tests/e2e/flows/complete-game-session.spec.js
import { test, expect } from '@playwright/test';

test.describe('Complete Game Session (Standalone)', () => {
  test('should complete full scanning flow', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 1. Loading screen
    await expect(page.locator('#loadingScreen')).toBeVisible();
    await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 5000 });

    // 2. Game mode selection
    await expect(page.locator('#gameModeScreen')).toBeVisible();
    await page.click('button:has-text("Standalone Game")');

    // 3. Team entry
    await expect(page.locator('#teamEntryScreen')).toBeVisible();
    await page.click('button:has-text("1")');
    await page.click('button:has-text("2")');
    await page.click('button:has-text("3")');
    await page.click('button:has-text("Enter")');

    // 4. Scan screen
    await expect(page.locator('#scanScreen')).toBeVisible();
    await expect(page.locator('#currentTeam')).toHaveText('123');

    // 5. Manual entry (simulate NFC)
    await page.click('button:has-text("Manual Entry")');
    await page.fill('input[type="text"]', 'test-token-001');
    await page.press('input[type="text"]', 'Enter');

    // 6. Result screen
    await expect(page.locator('#resultScreen')).toBeVisible();
    await expect(page.locator('.transaction-result')).toBeVisible();

    // 7. History check
    await page.click('[data-testid="history-button"]');
    await expect(page.locator('#historyScreen')).toBeVisible();
    await expect(page.locator('.transaction-card')).toHaveCount(1);
  });
});
```

**Coverage Goals:**
- Unit Tests: 80%+ coverage of services and store
- Integration Tests: All 14 screens with key interactions
- E2E Tests: 5 critical user flows (standalone, networked, admin operations)

### Phase 5: Build Optimization & PWA (1-2 days)

**Objective:** Optimize bundle size, maintain PWA functionality

#### 5.1: Code Splitting (Day 1)

**Vite Configuration:**

```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk
          vendor: ['socket.io-client'],

          // Admin panel (lazy load for networked mode)
          admin: [
            './src/admin/SessionManager.js',
            './src/admin/VideoController.js',
            './src/admin/SystemMonitor.js',
            './src/admin/AdminOperations.js'
          ],

          // Screens (lazy load)
          screens: [
            './src/screens/LoadingScreen.js',
            './src/screens/GameModeScreen.js',
            './src/screens/ScanScreen.js',
            // ... more screens
          ]
        }
      }
    },
    chunkSizeWarningLimit: 500 // KB
  }
});
```

**Lazy Loading Example:**

```javascript
// src/App.js
export class App {
  async loadAdminPanel() {
    if (this.store.state.session.mode !== 'networked') return;

    // Lazy load admin panel only in networked mode
    const { AdminPanel } = await import('./admin/AdminPanel.js');
    this.adminPanel = new AdminPanel({ store, orchestratorClient });
  }

  async navigateToScreen(screenName) {
    // Lazy load screens on-demand
    const screenModule = await import(`./screens/${screenName}.js`);
    const ScreenClass = screenModule.default;
    const screen = new ScreenClass({ store });
    this.showScreen(screen);
  }
}
```

**Expected Bundle Sizes:**
- Main bundle: ~50-80 KB (core app, store, services)
- Vendor chunk: ~100-150 KB (socket.io-client)
- Admin chunk: ~30-50 KB (lazy loaded)
- Screen chunks: ~10-20 KB each (lazy loaded)

#### 5.2: PWA Configuration (Day 2)

**Vite PWA Plugin:**

```javascript
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ALN Scanner',
        short_name: 'ALNScanner',
        description: 'Memory token scanner for About Last Night game',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300 // 5 minutes
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\/data\/tokens\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tokens-cache',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 86400 // 24 hours
              }
            }
          }
        ]
      }
    })
  ]
});
```

**Service Worker Strategy:**
- Cache-first for static assets (JS, CSS, images)
- Network-first for API calls (orchestrator connection)
- Stale-while-revalidate for token database

### Phase 6: Documentation & Handoff (1 day)

**Objective:** Document new architecture, migration guide, development workflow

**Documentation Deliverables:**

1. **README.md** (Development setup)
   - Installation instructions
   - Dev server startup
   - Build commands
   - Testing commands

2. **ARCHITECTURE.md** (System design)
   - Directory structure explanation
   - State management flow
   - Component hierarchy
   - Service layer design
   - WebSocket event flow

3. **MIGRATION_GUIDE.md** (For future changes)
   - How to add new screens
   - How to add new components
   - How to modify state
   - How to add WebSocket events

4. **TESTING.md** (Testing guide)
   - How to write unit tests
   - How to write integration tests
   - How to run E2E tests
   - Mocking strategies

5. **API.md** (Component API reference)
   - Screen components
   - Reusable components
   - Services
   - Store modules

---

## Migration Checklist

### Pre-Migration

- [ ] Create feature branch: `refactor/modular-architecture`
- [ ] Archive current code to `ARCHIVE/`
- [ ] Set up Vite project structure
- [ ] Configure ESLint and Prettier
- [ ] Verify legacy version still works

### Phase 1: Extract and Modularize

- [ ] Extract CSS to separate files
- [ ] Extract HTML templates to screen components
- [ ] Refactor JavaScript modules to ES6 imports
- [ ] Create centralized store
- [ ] Migrate state from singletons to store
- [ ] Update all state references
- [ ] Verify no regressions (visual + functional)

### Phase 2: Component Extraction

- [ ] Identify reusable components (12+ components)
- [ ] Create component library
- [ ] Refactor screens to use components
- [ ] Test component isolation
- [ ] Verify UI consistency

### Phase 3: Service Layer

- [ ] Create service interfaces (6 services)
- [ ] Implement dependency injection
- [ ] Refactor network layer
- [ ] Test service methods in isolation

### Phase 4: Testing

- [ ] Set up Vitest
- [ ] Write unit tests (80%+ coverage)
- [ ] Write integration tests (14 screens)
- [ ] Write E2E tests (5 critical flows)
- [ ] Verify test coverage reports

### Phase 5: Optimization

- [ ] Configure code splitting
- [ ] Implement lazy loading
- [ ] Set up PWA plugin
- [ ] Optimize bundle sizes
- [ ] Test offline functionality

### Phase 6: Documentation

- [ ] Write README.md
- [ ] Write ARCHITECTURE.md
- [ ] Write MIGRATION_GUIDE.md
- [ ] Write TESTING.md
- [ ] Write API.md

### Post-Migration

- [ ] Full regression testing (standalone mode)
- [ ] Full regression testing (networked mode)
- [ ] Test on Android devices (NFC)
- [ ] Test PWA installation
- [ ] Code review with team
- [ ] Merge to main branch

---

## Risk Mitigation

### High-Risk Changes

1. **State Management Centralization**
   - **Risk:** Breaking existing state synchronization
   - **Mitigation:** Migrate one module at a time, keep legacy fallbacks

2. **WebSocket Event Handling**
   - **Risk:** Breaking real-time synchronization
   - **Mitigation:** Preserve event names and payloads, add integration tests

3. **NFC API Wrapper**
   - **Risk:** Breaking physical token scanning
   - **Mitigation:** Test on Android devices after every change

4. **Service Worker Changes**
   - **Risk:** Breaking offline functionality
   - **Mitigation:** Test offline mode extensively, preserve cache strategies

### Rollback Strategy

1. **Preserve ARCHIVE/**: Keep fully functional legacy version
2. **Feature Branch**: Work on `refactor/modular-architecture` branch
3. **Parallel Deployment**: Run both versions side-by-side during migration
4. **Git Tags**: Tag each phase completion for rollback points

---

## Success Metrics

### Code Quality

- [ ] Bundle size < 500 KB (main chunk)
- [ ] Lighthouse score > 90 (PWA)
- [ ] ESLint errors: 0
- [ ] Test coverage > 80%
- [ ] Build time < 10s
- [ ] Hot reload time < 1s

### Functionality

- [ ] All 14 screens render identically
- [ ] All user flows work (standalone + networked)
- [ ] NFC scanning works on Android
- [ ] WebSocket real-time sync works
- [ ] Offline queue works
- [ ] Admin panel works
- [ ] PWA installation works

### Developer Experience

- [ ] npm run dev starts in < 5s
- [ ] Hot reload works for all file types
- [ ] npm test runs in < 30s
- [ ] Clear error messages
- [ ] IDE autocomplete works
- [ ] Code is self-documenting

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0: Preparation | 1-2 days | None |
| Phase 1: Extract & Modularize | 3-5 days | Phase 0 |
| Phase 2: Components | 3-4 days | Phase 1 |
| Phase 3: Services | 2-3 days | Phase 1 |
| Phase 4: Testing | 2-3 days | Phase 2, 3 |
| Phase 5: Optimization | 1-2 days | Phase 4 |
| Phase 6: Documentation | 1 day | Phase 5 |
| **Total** | **13-20 days** | Sequential |

**Realistic Timeline:** 3-4 weeks with one developer working full-time

---

## Open Questions

1. **TypeScript Migration**: Should we migrate to TypeScript in Phase 3, or stick with JSDoc?
2. **UI Framework**: Should we introduce Lit/Vue in Phase 2, or keep vanilla JS?
3. **State Management Library**: Should we use a library (Zustand, Pinia) or custom store?
4. **CSS Methodology**: Should we use CSS Modules, BEM, or keep current class naming?
5. **Test Strategy**: Should we prioritize unit tests or integration tests?

---

## Appendix A: Technology Decision Matrix

| Technology | Pros | Cons | Recommendation |
|------------|------|------|----------------|
| **Vite** | Fast HMR, simple config, great DX | New to team | ✅ Use |
| **TypeScript** | Type safety, better IDE support | Learning curve, migration effort | ⚠️ Optional (Phase 3) |
| **Lit** | Lightweight, web components, reactive | New paradigm | ⚠️ Optional (Phase 2) |
| **Vue 3** | Progressive, reactive, great docs | Larger bundle, overkill for this app | ❌ Skip |
| **Zustand** | Simple state management | Another dependency | ⚠️ Optional (Phase 1) |
| **Vitest** | Fast, Vite-compatible, great API | New to team | ✅ Use |
| **Playwright** | Already in use for backend E2E | None | ✅ Use |
| **ESLint** | Code quality, catch errors | Config complexity | ✅ Use |
| **Prettier** | Consistent formatting | None | ✅ Use |

---

## Appendix B: File Size Comparison

**Before Refactor:**
```
index.html:           2,117 lines
js/app/app.js:        1,137 lines
js/ui/uiManager.js:     687 lines
js/utils/adminModule.js: 800 lines
js/core/dataManager.js:  600 lines
js/network/orchestratorClient.js: 400 lines
Total:                ~5,741 lines in 6+ files
```

**After Refactor (Estimated):**
```
src/                  ~8,000 lines across 60+ files
├── screens/          ~1,200 lines (14 screens × ~85 lines avg)
├── components/       ~800 lines (12 components × ~65 lines avg)
├── services/         ~1,200 lines (6 services × ~200 lines avg)
├── store/            ~600 lines (5 modules × ~120 lines avg)
├── network/          ~500 lines (refactored)
├── admin/            ~1,000 lines (split from 800)
├── utils/            ~400 lines (preserved)
└── styles/           ~800 lines (CSS extracted from HTML)

Average file size: ~133 lines (down from ~956 lines)
Files: 60+ (up from 6)
```

**Benefits:**
- Smaller, more focused files
- Better code organization
- Easier to navigate
- Easier to test
- Easier to maintain

---

## Conclusion

This refactoring plan transforms the ALNScanner frontend from a monolithic 2,117-line HTML file into a modern, modular, testable application architecture. The phased approach minimizes risk while delivering incremental improvements in code quality, maintainability, and developer experience.

**Key Takeaways:**
1. **Preserve Functionality**: No user-facing changes, only internal improvements
2. **Incremental Migration**: 6 phases with clear validation checkpoints
3. **Test Coverage**: Unit, integration, and E2E tests ensure no regressions
4. **Modern Tooling**: Vite, ES6 modules, code splitting, PWA optimization
5. **Documentation**: Comprehensive guides for future development

**Next Steps:**
1. Review this plan with the team
2. Answer open questions (TypeScript? UI framework? State library?)
3. Create Phase 0 branch and begin preparation
4. Execute phases sequentially with validation at each step
