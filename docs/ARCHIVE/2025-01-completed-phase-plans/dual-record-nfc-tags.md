# Dual-Record NFC Tags Implementation Plan

**Status:** Ready for implementation
**Priority:** Medium - Enables "tap to scan" on Android without pre-opened PWA
**Estimated Effort:** 3-4 hours (including Android tag writer tool)
**Dependencies:** None

## Problem Statement

Currently, players must have the player scanner PWA open in their browser before tapping NFC tags. This adds friction to the experience.

**Goal:** Allow Android users to tap an NFC tag and have it automatically open the player scanner with the token already processed.

## Solution Overview

Program NTAG215 tags with two NDEF records:
1. **Text record** (first): Token ID for hardware/web scanners
2. **URL record** (second): Deep link for Android "tap to open" experience

### How Different Readers Handle Dual Records

| Reader | Behavior | Result |
|--------|----------|--------|
| **ESP32 (MFRC522)** | Parses NDEF, extracts first text record | Gets `kaa001` |
| **GM Scanner (Web NFC)** | Iterates records, returns first text match | Gets `kaa001` |
| **Player Scanner (Web NFC)** | Same as GM Scanner | Gets `kaa001` |
| **Android OS (no app open)** | Sees URL record, opens browser | Opens player scanner URL |

**Critical:** Text record MUST be first. URL record second.

---

## Implementation Steps

### Step 1: Add URL Parameter Handling to Player Scanner

**File:** `aln-memory-scanner/index.html`

Find the `init()` method in the `MemoryScanner` class and add URL parameter handling:

```javascript
async init() {
    // ... existing initialization code ...

    // NEW: Check for token in URL parameter (from NFC tag tap)
    this.handleUrlToken();

    // ... rest of init ...
}

/**
 * Handle token passed via URL parameter from NFC tag
 * Enables "tap tag -> auto-open browser -> auto-process token" flow
 */
handleUrlToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
        console.log(`[NFC-URL] Token from URL parameter: ${tokenFromUrl}`);

        // Clean URL to prevent re-processing on refresh
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        // Process the token after a short delay to ensure app is initialized
        setTimeout(() => {
            this.handleTokenFromUrl(tokenFromUrl);
        }, 500);
    }
}

/**
 * Process token received from URL parameter
 * @param {string} tokenId - Token ID from URL
 */
async handleTokenFromUrl(tokenId) {
    console.log(`[NFC-URL] Processing token: ${tokenId}`);

    // Use existing scan handling logic
    const token = this.tokens[tokenId] || this.tokens[tokenId.toLowerCase()];

    if (token) {
        this.displayToken(token, tokenId);
        this.addToCollection(tokenId);

        // If in networked mode, submit to orchestrator
        if (this.orchestrator && !this.orchestrator.isStandalone) {
            await this.orchestrator.submitScan(tokenId);
        }
    } else {
        console.warn(`[NFC-URL] Token not found: ${tokenId}`);
        this.showError(`Unknown token: ${tokenId}`);
    }
}
```

---

### Step 2: ALN Tag Writer Tool

A production utility PWA for programming NFC tags with integrated write-verify workflow.

**Location:** `tools/tag-writer/`

#### Core Workflow: Write → Verify → Next

The key insight: Each tag goes through a **Write → Verify → Confirm** cycle before moving to the next. This catches write failures immediately.

```
┌─────────────────────────────────────────────────────────┐
│  1. WRITE PHASE                                         │
│     Display: "kaa001 — Place tag to write"              │
│     Action: User places tag                             │
│     NFC: Write dual records                             │
│                    ↓                                    │
├─────────────────────────────────────────────────────────┤
│  2. VERIFY PHASE                                        │
│     Display: "Written! Keep tag in place to verify..."  │
│     Action: Automatic (tag still on device)             │
│     NFC: Read back and validate structure               │
│                    ↓                                    │
├─────────────────────────────────────────────────────────┤
│  3. RESULT PHASE                                        │
│     Display: "✓ Verified" or "✗ Verification failed"   │
│     Show: Text record, URL record, validation checks    │
│     Action: User removes tag                            │
│                    ↓                                    │
├─────────────────────────────────────────────────────────┤
│  4. NEXT PHASE                                          │
│     Display: "Remove tag, then place next tag"          │
│     Advance to next token in queue                      │
└─────────────────────────────────────────────────────────┘
```

#### File Structure

```
tools/tag-writer/
├── index.html      # Complete PWA (single file)
└── README.md       # Usage instructions
```

#### index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>ALN Tag Writer</title>
    <meta name="theme-color" content="#dc2626">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-deep: #0a0a0f;
            --bg-panel: #12121a;
            --bg-elevated: #1a1a24;
            --bg-input: #0f0f16;
            --border: #2a2a3a;
            --text-primary: #e8e8ed;
            --text-secondary: #8888a0;
            --text-muted: #55556a;
            --accent: #dc2626;
            --accent-glow: rgba(220, 38, 38, 0.2);
            --success: #22c55e;
            --success-glow: rgba(34, 197, 94, 0.2);
            --warning: #f59e0b;
            --error: #ef4444;
            --font-mono: 'JetBrains Mono', monospace;
            --font-sans: 'Inter', -apple-system, sans-serif;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
            font-family: var(--font-sans);
            background: var(--bg-deep);
            color: var(--text-primary);
            min-height: 100vh;
            min-height: 100dvh;
            -webkit-tap-highlight-color: transparent;
        }

        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background-image:
                linear-gradient(rgba(220, 38, 38, 0.02) 1px, transparent 1px),
                linear-gradient(90deg, rgba(220, 38, 38, 0.02) 1px, transparent 1px);
            background-size: 32px 32px;
            pointer-events: none;
        }

        .app { position: relative; max-width: 480px; margin: 0 auto; padding: 16px; }

        /* Header */
        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 0 20px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 20px;
        }
        .header-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, var(--accent), #991b1b);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            box-shadow: 0 4px 20px var(--accent-glow);
        }
        .header h1 {
            font-family: var(--font-mono);
            font-size: 1.2rem;
            font-weight: 700;
        }
        .header .env-badge {
            margin-left: auto;
            padding: 4px 10px;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 4px;
            font-family: var(--font-mono);
            font-size: 0.7rem;
            color: var(--text-muted);
        }

        /* Panels */
        .panel {
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 12px;
            margin-bottom: 16px;
        }
        .panel-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            font-family: var(--font-mono);
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-muted);
        }
        .panel-body { padding: 16px; }

        /* Form elements */
        .form-row { margin-bottom: 14px; }
        .form-row:last-child { margin-bottom: 0; }
        .form-label {
            display: block;
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-bottom: 6px;
            font-family: var(--font-mono);
        }
        select, input[type="text"] {
            width: 100%;
            padding: 12px 14px;
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            font-family: var(--font-mono);
            font-size: 0.9rem;
        }
        select:focus, input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        /* Buttons */
        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 14px 20px;
            border: none;
            border-radius: 8px;
            font-family: var(--font-mono);
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s;
        }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-primary {
            background: var(--accent);
            color: white;
        }
        .btn-primary:active:not(:disabled) { transform: scale(0.98); }
        .btn-secondary {
            background: var(--bg-elevated);
            color: var(--text-primary);
            border: 1px solid var(--border);
        }
        .btn-row { display: flex; gap: 8px; }
        .btn-row .btn { flex: 1; }
        .btn-sm { padding: 10px 14px; font-size: 0.75rem; }
        .btn-icon { padding: 10px; width: auto; }

        /* Status bar */
        .status-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            background: var(--bg-input);
            border-radius: 6px;
            font-family: var(--font-mono);
            font-size: 0.8rem;
            color: var(--text-secondary);
        }
        .status-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--text-muted);
            flex-shrink: 0;
        }
        .status-dot.loading { background: var(--warning); animation: pulse 1s infinite; }
        .status-dot.success { background: var(--success); }
        .status-dot.error { background: var(--error); }
        @keyframes pulse { 50% { opacity: 0.4; } }

        /* Token list */
        .token-list-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        .token-count {
            font-family: var(--font-mono);
            font-size: 0.75rem;
            color: var(--text-muted);
        }
        .token-filters { display: flex; gap: 4px; }
        .filter-btn {
            padding: 6px 10px;
            background: transparent;
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text-muted);
            font-family: var(--font-mono);
            font-size: 0.65rem;
            cursor: pointer;
        }
        .filter-btn:hover { color: var(--text-secondary); border-color: var(--text-muted); }
        .filter-btn.active { background: var(--accent); border-color: var(--accent); color: white; }

        .token-list {
            max-height: 240px;
            overflow-y: auto;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--bg-input);
        }
        .token-item {
            display: flex;
            align-items: center;
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            gap: 10px;
            transition: background 0.1s;
        }
        .token-item:last-child { border-bottom: none; }
        .token-item:active { background: rgba(255,255,255,0.03); }
        .token-item.selected { background: var(--accent-glow); }
        .token-item.written { background: var(--success-glow); }

        .token-check {
            width: 18px; height: 18px;
            border: 2px solid var(--border);
            border-radius: 4px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            color: transparent;
        }
        .token-item.selected .token-check { background: var(--accent); border-color: var(--accent); color: white; }
        .token-item.written .token-check { background: var(--success); border-color: var(--success); color: white; }
        .token-id { font-family: var(--font-mono); font-size: 0.85rem; flex: 1; }
        .token-badge {
            font-size: 0.65rem;
            padding: 2px 6px;
            background: var(--success);
            color: white;
            border-radius: 3px;
            font-family: var(--font-mono);
        }

        .empty-state {
            padding: 40px 20px;
            text-align: center;
            color: var(--text-muted);
        }

        /* ==================== WRITE MODE ==================== */
        .write-overlay {
            position: fixed;
            inset: 0;
            background: var(--bg-deep);
            z-index: 100;
            display: none;
            flex-direction: column;
        }
        .write-overlay.active { display: flex; }

        .write-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            background: var(--bg-panel);
            border-bottom: 1px solid var(--border);
        }
        .write-progress {
            font-family: var(--font-mono);
            font-size: 0.9rem;
        }
        .write-progress strong { color: var(--accent); }

        .write-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px 24px;
            text-align: center;
        }

        .write-token {
            font-family: var(--font-mono);
            font-size: 2.2rem;
            font-weight: 700;
            color: var(--accent);
            margin-bottom: 8px;
            text-shadow: 0 0 40px var(--accent-glow);
        }
        .write-phase {
            font-size: 0.9rem;
            color: var(--text-secondary);
            margin-bottom: 30px;
            min-height: 1.5em;
        }

        .write-visual {
            width: 140px; height: 140px;
            border: 3px solid var(--border);
            border-radius: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 56px;
            margin-bottom: 30px;
            position: relative;
            transition: all 0.3s;
        }
        .write-visual.writing {
            border-color: var(--accent);
            animation: write-pulse 1.5s ease-in-out infinite;
        }
        .write-visual.verifying {
            border-color: var(--warning);
        }
        .write-visual.success {
            border-color: var(--success);
            animation: none;
        }
        .write-visual.error {
            border-color: var(--error);
            animation: none;
        }
        @keyframes write-pulse {
            0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
            50% { box-shadow: 0 0 0 20px transparent; }
        }

        /* Verification result */
        .verify-result {
            width: 100%;
            max-width: 320px;
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 14px;
            text-align: left;
            font-family: var(--font-mono);
            font-size: 0.75rem;
            margin-bottom: 20px;
        }
        .verify-row {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 6px 0;
            border-bottom: 1px solid var(--border);
        }
        .verify-row:last-child { border-bottom: none; }
        .verify-icon { flex-shrink: 0; }
        .verify-icon.ok { color: var(--success); }
        .verify-icon.fail { color: var(--error); }
        .verify-label { color: var(--text-muted); flex-shrink: 0; width: 50px; }
        .verify-value {
            flex: 1;
            word-break: break-all;
            color: var(--text-primary);
        }

        .write-footer {
            padding: 16px 20px;
            background: var(--bg-panel);
            border-top: 1px solid var(--border);
        }
        .write-footer .btn-row { gap: 10px; }
    </style>
</head>
<body>
    <div class="app">
        <header class="header">
            <div class="header-icon">🏷️</div>
            <h1>ALN Tag Writer</h1>
            <div class="env-badge" id="envBadge">DEV</div>
        </header>

        <!-- Config Panel -->
        <section class="panel">
            <div class="panel-header">Configuration</div>
            <div class="panel-body">
                <div class="form-row">
                    <label class="form-label">Environment</label>
                    <select id="environment">
                        <option value="dev">Dev — raspberrypi.local</option>
                        <option value="prod">Prod — aln-orchestrator.local</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="btn-row">
                        <button class="btn btn-secondary" id="loadTokens">📂 Load Tokens</button>
                    </div>
                </div>
                <div class="status-bar" id="loadStatus">
                    <span class="status-dot"></span>
                    <span>No tokens loaded</span>
                </div>
            </div>
        </section>

        <!-- Token Selection -->
        <section class="panel">
            <div class="panel-header">Tokens</div>
            <div class="panel-body">
                <div class="token-list-header">
                    <span class="token-count" id="tokenCount">0 tokens</span>
                    <div class="token-filters">
                        <button class="filter-btn active" data-filter="all">All</button>
                        <button class="filter-btn" data-filter="unwritten">Todo</button>
                        <button class="filter-btn" data-filter="written">Done</button>
                    </div>
                </div>
                <div class="token-list" id="tokenList">
                    <div class="empty-state">Load tokens to begin</div>
                </div>
            </div>
        </section>

        <!-- Action -->
        <button class="btn btn-primary" id="startBtn" disabled>
            ▶️ Start Writing
        </button>
    </div>

    <!-- Write Mode Overlay -->
    <div class="write-overlay" id="writeOverlay">
        <div class="write-header">
            <div class="write-progress">
                <strong id="currentNum">1</strong> / <span id="totalNum">0</span>
            </div>
            <button class="btn btn-secondary btn-sm" id="cancelBtn">Cancel</button>
        </div>

        <div class="write-main">
            <div class="write-token" id="writeToken">---</div>
            <div class="write-phase" id="writePhase">Initializing...</div>
            <div class="write-visual" id="writeVisual">📱</div>

            <div class="verify-result" id="verifyResult" style="display: none;">
                <div class="verify-row">
                    <span class="verify-icon" id="vText">○</span>
                    <span class="verify-label">Text:</span>
                    <span class="verify-value" id="vTextVal">—</span>
                </div>
                <div class="verify-row">
                    <span class="verify-icon" id="vUrl">○</span>
                    <span class="verify-label">URL:</span>
                    <span class="verify-value" id="vUrlVal">—</span>
                </div>
                <div class="verify-row">
                    <span class="verify-icon" id="vOrder">○</span>
                    <span class="verify-label">Order:</span>
                    <span class="verify-value" id="vOrderVal">—</span>
                </div>
            </div>
        </div>

        <div class="write-footer">
            <div class="btn-row">
                <button class="btn btn-secondary" id="retryBtn" style="display: none;">🔄 Retry</button>
                <button class="btn btn-secondary" id="skipBtn">⏭️ Skip</button>
                <button class="btn btn-primary" id="nextBtn" style="display: none;">Next →</button>
            </div>
        </div>
    </div>

    <script>
        // ==================== STATE ====================
        const state = {
            tokens: {},
            selected: new Set(),
            written: new Set(),
            queue: [],
            queueIndex: 0,
            running: false,
            filter: 'all'
        };

        const config = {
            dev: {
                name: 'DEV',
                baseUrl: 'https://raspberrypi.local:3000/player-scanner/',
                tokensUrl: 'https://raspberrypi.local:3000/player-scanner/data/tokens.json'
            },
            prod: {
                name: 'PROD',
                baseUrl: 'https://aln-orchestrator.local:3000/player-scanner/',
                tokensUrl: 'https://aln-orchestrator.local:3000/player-scanner/data/tokens.json'
            }
        };

        const getEnv = () => config[document.getElementById('environment').value];

        // ==================== DOM ====================
        const $ = id => document.getElementById(id);

        // Environment badge update
        $('environment').addEventListener('change', () => {
            $('envBadge').textContent = getEnv().name;
        });

        // ==================== LOAD TOKENS ====================
        $('loadTokens').addEventListener('click', async () => {
            setStatus('loadStatus', 'Loading...', 'loading');
            try {
                const res = await fetch(getEnv().tokensUrl, { signal: AbortSignal.timeout(10000) });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                state.tokens = await res.json();
                state.selected = new Set(Object.keys(state.tokens));
                setStatus('loadStatus', `${Object.keys(state.tokens).length} tokens loaded`, 'success');
                renderList();
                updateStartBtn();
            } catch (e) {
                setStatus('loadStatus', `Error: ${e.message}`, 'error');
            }
        });

        function setStatus(id, text, type = '') {
            const bar = $(id);
            bar.querySelector('.status-dot').className = `status-dot ${type}`;
            bar.querySelector('span:last-child').textContent = text;
        }

        // ==================== TOKEN LIST ====================
        function renderList() {
            const list = $('tokenList');
            let ids = Object.keys(state.tokens).sort();

            if (state.filter === 'unwritten') ids = ids.filter(id => !state.written.has(id));
            if (state.filter === 'written') ids = ids.filter(id => state.written.has(id));

            if (ids.length === 0) {
                list.innerHTML = '<div class="empty-state">No tokens match filter</div>';
                updateCount();
                return;
            }

            list.innerHTML = ids.map(id => {
                const sel = state.selected.has(id);
                const done = state.written.has(id);
                let cls = 'token-item';
                if (sel) cls += ' selected';
                if (done) cls += ' written';
                return `
                    <div class="${cls}" data-id="${id}">
                        <div class="token-check">${done ? '✓' : sel ? '✓' : ''}</div>
                        <span class="token-id">${id}</span>
                        ${done ? '<span class="token-badge">Done</span>' : ''}
                    </div>
                `;
            }).join('');

            list.querySelectorAll('.token-item').forEach(el => {
                el.addEventListener('click', () => toggleToken(el.dataset.id));
            });

            updateCount();
        }

        function toggleToken(id) {
            if (state.selected.has(id)) state.selected.delete(id);
            else state.selected.add(id);
            renderList();
            updateStartBtn();
        }

        function updateCount() {
            const total = Object.keys(state.tokens).length;
            const sel = state.selected.size;
            const done = state.written.size;
            $('tokenCount').textContent = `${sel} selected, ${done} written`;
        }

        function updateStartBtn() {
            const pending = [...state.selected].filter(id => !state.written.has(id));
            $('startBtn').disabled = pending.length === 0;
            $('startBtn').textContent = pending.length > 0
                ? `▶️ Write ${pending.length} Tag${pending.length > 1 ? 's' : ''}`
                : '▶️ Start Writing';
        }

        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.filter = btn.dataset.filter;
                renderList();
            });
        });

        // ==================== WRITE MODE ====================
        $('startBtn').addEventListener('click', startWriting);
        $('cancelBtn').addEventListener('click', stopWriting);
        $('skipBtn').addEventListener('click', () => advanceQueue());
        $('retryBtn').addEventListener('click', () => processCurrentTag());
        $('nextBtn').addEventListener('click', () => advanceQueue());

        function startWriting() {
            state.queue = [...state.selected].filter(id => !state.written.has(id));
            if (state.queue.length === 0) return;

            state.queueIndex = 0;
            state.running = true;
            $('writeOverlay').classList.add('active');
            $('totalNum').textContent = state.queue.length;

            processCurrentTag();
        }

        function stopWriting() {
            state.running = false;
            $('writeOverlay').classList.remove('active');
            renderList();
            updateStartBtn();
        }

        function advanceQueue() {
            state.queueIndex++;
            if (state.queueIndex >= state.queue.length) {
                stopWriting();
                return;
            }
            processCurrentTag();
        }

        async function processCurrentTag() {
            if (!state.running) return;

            const tokenId = state.queue[state.queueIndex];
            $('currentNum').textContent = state.queueIndex + 1;
            $('writeToken').textContent = tokenId;

            // Reset UI
            $('verifyResult').style.display = 'none';
            $('retryBtn').style.display = 'none';
            $('nextBtn').style.display = 'none';
            $('skipBtn').style.display = 'block';

            // Phase 1: Write
            setPhase('writing', 'Place tag to write...');

            try {
                await writeTag(tokenId);

                // Phase 2: Verify
                setPhase('verifying', 'Written! Verifying...');
                await sleep(300);

                const result = await readTag();
                showVerifyResult(tokenId, result);

                // Phase 3: Success
                setPhase('success', 'Verified! Remove tag.');
                state.written.add(tokenId);
                $('skipBtn').style.display = 'none';
                $('nextBtn').style.display = 'block';

            } catch (err) {
                setPhase('error', `Error: ${err.message}`);
                $('retryBtn').style.display = 'block';
            }
        }

        function setPhase(visual, text) {
            $('writeVisual').className = `write-visual ${visual}`;
            $('writePhase').textContent = text;
        }

        async function writeTag(tokenId) {
            if (!('NDEFReader' in window)) throw new Error('NFC not supported');

            const url = `${getEnv().baseUrl}?token=${tokenId}`;
            const writer = new NDEFReader();
            await writer.write({
                records: [
                    { recordType: "text", data: tokenId },
                    { recordType: "url", data: url }
                ]
            });
        }

        async function readTag() {
            return new Promise(async (resolve, reject) => {
                const reader = new NDEFReader();
                const ctrl = new AbortController();
                const timeout = setTimeout(() => { ctrl.abort(); reject(new Error('Read timeout')); }, 5000);

                reader.addEventListener('reading', ({ message }) => {
                    clearTimeout(timeout);
                    ctrl.abort();
                    const records = [...message.records].map(r => ({
                        type: r.recordType,
                        data: new TextDecoder(r.encoding || 'utf-8').decode(r.data)
                    }));
                    resolve(records);
                }, { signal: ctrl.signal });

                reader.addEventListener('readingerror', () => {
                    clearTimeout(timeout);
                    ctrl.abort();
                    reject(new Error('Read failed'));
                }, { signal: ctrl.signal });

                await reader.scan({ signal: ctrl.signal });
            });
        }

        function showVerifyResult(expectedToken, records) {
            const text = records.find(r => r.type === 'text');
            const url = records.find(r => r.type === 'url');
            const orderOk = records[0]?.type === 'text';
            const textOk = text?.data === expectedToken;
            const urlOk = url?.data.includes(`token=${expectedToken}`);

            $('vText').textContent = textOk ? '✓' : '✗';
            $('vText').className = `verify-icon ${textOk ? 'ok' : 'fail'}`;
            $('vTextVal').textContent = text?.data || '(missing)';

            $('vUrl').textContent = urlOk ? '✓' : '✗';
            $('vUrl').className = `verify-icon ${urlOk ? 'ok' : 'fail'}`;
            $('vUrlVal').textContent = url?.data || '(missing)';

            $('vOrder').textContent = orderOk ? '✓' : '✗';
            $('vOrder').className = `verify-icon ${orderOk ? 'ok' : 'fail'}`;
            $('vOrderVal').textContent = orderOk ? 'Text first (correct)' : 'Text should be first!';

            $('verifyResult').style.display = 'block';
        }

        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

        // ==================== INIT ====================
        if (!('NDEFReader' in window)) {
            alert('Web NFC not supported. Use Chrome on Android.');
        }
    </script>
</body>
</html>
```

---

### Step 3: Workflow Summary

#### Write-Verify Cycle (Per Tag)

1. **Write Phase**
   - Display token ID prominently
   - Show "Place tag to write..."
   - User places NTAG215 on device
   - Write dual records (text + URL)

2. **Verify Phase** (automatic, tag still in place)
   - Display "Written! Verifying..."
   - Read back tag contents
   - Validate structure:
     - Text record present and matches token ID
     - URL record present and contains token ID
     - Text record is first (correct order)

3. **Result Phase**
   - Show verification breakdown
   - Green checkmarks for passing checks
   - Red X for failures
   - "Remove tag" prompt

4. **Next Phase**
   - User removes tag
   - Taps "Next →" to advance
   - Or "Skip" to skip problem tags
   - Or "Retry" if write failed

#### Selection & Filtering

- **All**: Show all tokens
- **Todo**: Show only unwritten tokens
- **Done**: Show already-written tokens
- Progress persists during session
- "Select All" defaults on load for full batch

---

## Testing Checklist

### Before Programming Tags

- [ ] Player scanner URL parameter handling code added
- [ ] Test manually: `https://raspberrypi.local:3000/player-scanner/?token=kaa001`
- [ ] Verify token displays correctly
- [ ] Verify URL is cleaned from address bar after processing

### Tag Writer Tool

- [ ] Loads tokens from orchestrator
- [ ] Environment switch updates URLs
- [ ] Write + verify cycle works
- [ ] Failed writes show error, allow retry
- [ ] Skip advances to next token
- [ ] Progress (written set) persists during session
- [ ] Filter buttons work correctly

### After Programming Tags

- [ ] ESP32 scanner reads tag → gets `kaa001`
- [ ] GM Scanner reads tag → gets `kaa001`
- [ ] Player Scanner (PWA open) reads tag → gets `kaa001`
- [ ] Android phone (no app) taps tag → Chrome opens → token displays

---

## Environment-Specific URLs

| Environment | mDNS Hostname | Tag URL Base |
|-------------|---------------|--------------|
| **Dev (Pi 5)** | `raspberrypi` | `https://raspberrypi.local:3000/player-scanner/` |
| **Prod (Pi 4)** | `aln-orchestrator` | `https://aln-orchestrator.local:3000/player-scanner/` |

---

## Future Enhancements

1. **Notion sync endpoint** - Backend API to trigger sync before batch
2. **Export session** - Save list of written tokens as CSV
3. **Persistent storage** - Remember written tokens across sessions (localStorage)
4. **Sound feedback** - Audio cue on successful write/verify
