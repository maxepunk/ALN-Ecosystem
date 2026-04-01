# Scoreboard Enhancement Design

**Date:** 2026-03-05
**Status:** Approved for implementation planning

## Summary

Redesign the scoreboard display (`backend/public/scoreboard.html`) to handle a larger token set by grouping exposed evidence by character, add a scrolling score ticker showing all teams, replace the wall clock with a game countdown timer, and fix the session transition bug that requires a browser refresh between sessions.

## Current State

The scoreboard is a self-contained HTML file (~1529 lines) served by the backend at `/scoreboard`. It connects via WebSocket as a GM device (JWT auth, `gm` room + session room). Two visual sections: evidence cards (detective mode transactions) and a score ticker (black market rankings). "Classified Evidence Terminal" aesthetic with film grain, scanlines, vignette, pushpins, typewriter fonts.

### Current Problems

1. **Evidence display is flat** -- hero card + grid of 8 cards, no grouping. Older evidence falls off the visible grid with no cycling. (The hero timeout/duration config `heroDisplayDuration: 15000` was declared but never wired up.)
2. **Score ticker truncates** -- hard-coded `slice(0, 6)`, doesn't scroll, small text unreadable on projector.
3. **Session transition bug** -- when a session ends and a new one starts, the `sync:full` handler appends to `evidenceLog` instead of replacing, and `session:update` has no logic to detect session changes. Old data persists until manual refresh.
4. **Wall clock is meaningless** -- shows real time, not game time. Players don't know how much time remains.

## Design

### Layout Structure

Two zones filling the viewport:

```
+----------------------------------------------------------+
|  CASE FILE: ABOUT LAST NIGHT          [countdown] [REC]  |
+----------------------------------------------------------+
|                                                          |
|  ALEX REEVES                              (pips)         |
|  05/12/2022 - ALEX refactors MARCUS's prototype...       |
|  11:32PM - ALEX's pent-up rage about stolen equity...    |
|                                                          |
|  ASHE MOTOKO                              (pips)         |
|  11:30PM - ASHE witnesses MARCUS treat KAI like dirt.    |
|                                                          |
|                                          page dots       |
+----------------------------------------------------------+
|  #1 Whitemetal $450,000  *  #2 O'Brien $325,000  * ...   |
+----------------------------------------------------------+
```

- **Main evidence area** (~85%): Character-grouped evidence cards, page-based cycling.
- **Score ticker** (~15%): Horizontal scrolling marquee of ALL team scores ranked by earnings.

### Evidence Cards

Each character group is a single "pinned document" with:

- **Inline header**: Character name (uppercase, typewriter font) + pips showing exposed/total tokens (e.g., `ALEX REEVES  (filled)(filled)(empty)` for 2 of 3 exposed).
- **Entries**: Full summary text, never truncated, in body font. Sorted chronologically (earliest first within a character) so the story reads top-to-bottom.
- **No team name on cards** -- the character grouping provides context.
- **Visual treatment**: Cream paper background, slight random rotation, pushpin decoration, red left-border accent. Applied at the character-group level (one pinned document per character, not per token).

Character groups are ordered by most recent exposure -- the character whose evidence was most recently added appears first across all pages.

Only characters with at least one exposed token appear. The absence of a character implicitly communicates they haven't been investigated.

### Pip Data

Total tokens per character comes from an HTTP fetch of `/api/tokens` at startup. The scoreboard builds a `Map<owner, totalCount>` from the raw token data. This is static for the game duration.

Exposed count per character is tracked client-side from detective-mode transactions (via `transaction:new` and `sync:full` recentTransactions). The `owner` field will be added to transaction enrichment (see Backend Changes below).

### Page Composition and Cycling

Pages are calculated dynamically based on actual content height, not a fixed card count. Summaries never truncate, so a page with one character having 4 long summaries might only fit one other character, while a page of single-entry characters might fit 4-5 groups.

Algorithm:
1. Calculate available height: viewport minus header minus ticker.
2. Render character groups in sort order (most recently exposed first).
3. Fill the page until the next group wouldn't fit. That's a page break.
4. Repeat for remaining groups.

Cycling:
- Timer-based advance through pages.
- Adaptive interval: 1 page = no cycling; 2-3 pages = ~18s per page; 4+ pages = ~12s per page.
- Small dot indicators at bottom-right of evidence area showing current page.

New evidence interruption:
- On detective `transaction:new`, calculate which page the character lands on.
- Immediately transition to that page with flash effect.
- Reset cycle timer so the page gets full display time before advancing.

New character appearing for the first time gets the "evidence incoming" drop-in animation.

### Score Ticker

Scrolling horizontal marquee showing ALL teams ranked by earnings. Format per entry:

```
#1  Whitemetal Inc  $450,000   *   #2  O'Brien & Co  $325,000   *   ...
```

Rank, team name, dollar amount inline with separator dots. No bar charts (hard to read on projector).

Typography sized for projector readability: team names and scores at `clamp(1.25rem, 2.5vw, 2rem)` minimum. Drop the fixed "STANDINGS" label.

Scroll speed: ~60-80px/sec, slow enough to read each entry. If only 2-3 teams, pause-and-slide instead of continuous scroll.

Score change animation: briefly flash entry amber on update.

Ticker height: ~120px (slightly taller than current 100px for larger text).

### Game Countdown Timer

Replaces the wall clock in the header. Shows remaining time: `expectedDuration - elapsed`, displayed as `HH:MM:SS` counting down.

Data source: `gameClock` from `sync:full` (`{status, elapsed, expectedDuration}`) and `service:state` domain `gameclock` for lifecycle changes.

Implementation follows the GM Scanner's established pattern (SessionRenderer.js):
- Listen to `service:state` domain `gameclock` for status changes (started/paused/resumed).
- Run a client-side `setInterval(1000)` that decrements the display while status is `running`.
- On any `service:state` gameclock event, re-sync elapsed from the server payload to prevent drift.
- No per-tick WebSocket broadcast needed (avoids 60+ events/min overhead).

The `expectedDuration` value is already configurable via the `SESSION_TIMEOUT` env var (default 120 minutes, stored in `config.session.sessionTimeout`). It is used by session overtime detection but currently hardcoded to `7200` in `syncHelpers.js`. This enhancement will wire it through: `config.session.sessionTimeout * 60` (minutes to seconds).

Display states:
- **Before game starts (stopped)**: `--:--:--`
- **Running**: Countdown in green, colons blinking.
- **Paused**: Countdown frozen, entire time string blinking.
- **Overtime (elapsed > expectedDuration)**: `00:00:00` blinking red.

### Animations

Analog/tactile feel over digital, aligned with "classified evidence board" aesthetic.

**Page transitions**: Quick fade-to-black and back (~400ms total). Surveillance camera cutting between feeds. No sliding.

**New evidence arrival**: Existing white screen flash (~300ms) stays. New character group drops in from above with slight bounce and rotation settle (existing `evidenceIncoming` animation). New entry on existing character: group subtly "lifts" (small scale-up) and settles as the new summary appears.

**Pip fill**: Simple opacity transition (~500ms). Dot solidifying like ink bleeding into paper.

**Preserved from current**: Film grain, vignette, scanline overlays, random card rotation, pushpin decoration, blinking REC indicator, score flash on ticker updates.

**Removed**: Typewriter text animation (no hero card), staggered `cardCascade` delays (groups appear as a page).

### Session Transition Fix

**Root cause**: `sync:full` handler appends to evidence instead of replacing, and no session ID tracking.

**Fix**: Track `state.sessionId`. On every `sync:full`, compare `data.session?.id` against stored ID.

On session change (different ID):
- Clear `evidenceLog`, `teamScores`, `ownerExposedCounts`.
- Update `state.sessionId`.
- Load fresh data from sync payload.
- Reset page cycling to page 1.

On `session:update`:
- Detect new session by ID comparison only (not status) -- team additions emit `session:update` with same ID and must NOT trigger a clear.
- On status `'ended'`: stop page cycling, freeze countdown at `00:00:00`, evidence stays visible.

On `sync:full` handler: REPLACE evidence data entirely (not append). Remove the `.some()` dedup check that causes stale data persistence.

This mirrors the GM Scanner's `_handleSessionBoundary()` pattern in `networkedSession.js`.

## Backend Changes (Minimal, Additive)

All changes are additive -- no existing behavior modified. GM Scanner and backend continue working unchanged.

### 1. Preserve owner in tokenService

**File**: `backend/src/services/tokenService.js` (loadTokens, metadata object)

Add `owner: token.owner || null` to the metadata object alongside existing `rfid`, `group`, `originalType`, `rating`, `summary`.

### 2. Enrich transactions with owner

**File**: `backend/src/websocket/broadcasts.js` (`transaction:added` listener)

Add `owner: token?.metadata?.owner || null` to the transaction enrichment payload, following the same pattern as `memoryType`, `valueRating`, `group`, `summary`.

**File**: `backend/src/websocket/syncHelpers.js` (`buildSyncFullPayload` recentTransactions enrichment)

Add `owner: token?.metadata?.owner || null` to the recentTransactions enrichment. Also add `group` (already present in `broadcasts.js` but missing from syncHelpers -- pre-existing inconsistency) and `isUnknown` for parity.

### 3. Add teamScore to transaction:new payload

**File**: `backend/src/websocket/broadcasts.js`

The deprecated `score:updated` WebSocket event will NOT be used. Instead, enrich `transaction:new` with `teamScore` so consumers can extract score data from transaction events directly.

`broadcasts.js` already listens to both `transaction:accepted` (which has `teamScore`) at line 235 and `transaction:added` (which triggers `transaction:new`) at line 171. Since `transaction:accepted` fires before `transaction:added` (sessionService persists in its `transaction:accepted` listener, then emits `transaction:added`), the approach is:

- In the `transaction:accepted` listener, stash `payload.teamScore` keyed by `transaction.id`.
- In the `transaction:added` listener, retrieve and include the stashed `teamScore` in the `transaction:new` payload, then delete the stash entry.

Payload addition:
```javascript
teamScore: stashedTeamScore || null  // {teamId, currentScore, baseScore, bonusPoints, ...}
```

### 4. Broadcast score:adjusted to WebSocket

**File**: `backend/src/websocket/broadcasts.js`

The internal `score:adjusted` event (from `transactionService`) already exists but only triggers `score:updated`. Add a new WebSocket broadcast `score:adjusted` to the session room with the `teamScore` payload. This covers admin score adjustments (manual add/subtract) which don't flow through `transaction:new`.

Payload: `{ teamScore: { teamId, currentScore, baseScore, bonusPoints, tokensScanned, completedGroups, adminAdjustments, lastUpdate } }`

**Note**: `score:updated` continues to broadcast unchanged for now (existing GM Scanner consumers). Deprecation is a separate concern.

### 5. Update AsyncAPI contract

**File**: `backend/contracts/asyncapi.yaml`

Add to the `transaction:new` transaction schema (all optional):
- `owner`: string -- character who owns this memory
- `status`: string enum (`accepted`, `duplicate`, `error`) -- transaction processing result (always `accepted` for broadcast transactions, but documented for completeness)
- `isUnknown`: boolean -- true if token ID not found in database
- `teamScore`: object -- team's updated score after this transaction

Add new `score:adjusted` event schema with `teamScore` payload.

No `additionalProperties: false` exists, so these are all non-breaking additions.

### 6. Wire expectedDuration from config

**File**: `backend/src/websocket/syncHelpers.js` (`buildGameClockState`)

Replace hardcoded `7200` with `config.session.sessionTimeout * 60` in all THREE occurrences:
- Line 140: fallback when `gameClockService` is null
- Line 146: main path
- Line 150: error catch fallback

The config value already exists (`SESSION_TIMEOUT` env var, default 120 minutes) and is used by session overtime detection -- just not wired to the sync payload yet.

### Safety Verification

- No consumer uses strict destructuring on transaction payloads -- all use dot notation with optional chaining.
- AsyncAPI schema has no `additionalProperties: false` -- extra fields are permitted.
- GM Scanner's `orchestratorClient.js` messageTypes list does NOT need updating -- no new events added. (`score:adjusted` is a new event but GM Scanner doesn't need it -- it has its own scoring.)
- Contract tests use AJV which permits additional properties by default.
- The `owner` field already exists in tokens.json and is used by `sessionReportGenerator._getTokenOwner()`.
- `score:updated` continues to broadcast (not removed) -- existing consumers unaffected.

## Data Flow Summary

```
tokens.json (owner field)
    |
    v
tokenService.loadTokens() --- adds owner to metadata
    |
    +---> GET /api/tokens (raw) --- scoreboard fetches once at startup for pip totals
    |
    v
broadcasts.js enrichment --- adds owner, teamScore to transaction:new payload
syncHelpers.js enrichment --- adds owner, group, isUnknown to sync:full recentTransactions
    |
    v
scoreboard.html
    |--- sync:full: session boundary detection, full state replace, scores, evidence
    |--- transaction:new: add evidence grouped by owner, update pips, update ticker from teamScore
    |--- score:adjusted: update ticker for admin score adjustments
    |--- service:state (gameclock): sync countdown timer
    |--- session:update: detect new session ID, handle ended status
    |--- transaction:deleted: remove evidence entry, recalculate ticker from sync:full
    |--- scores:reset: clear all scores and evidence
    |--- display:mode: toggle overlay for video playback
```

## Out of Scope

- Adding character portraits or images to evidence cards.
- Splitting scoreboard.html into multiple files/modules.
- Changes to GM Scanner UI.
- Changes to player scanner.
